import { useEffect, useRef, useState } from "react";
import { api, getAuth, uploadFile } from "../api.js";
import { Empty, Field, Modal, Pager, RowMenu, Table, fmtDateTime, useAction, useDebounced, useList, useUi } from "../ui.jsx";

/**
 * Downloads e links: o admin cadastra aqui o que os revendedores veem, somente leitura, no portal deles.
 * Tipo "Aplicativo" = nome, versão, link e código numérico do Downloader; tipo "Link" = só título e endereço.
 * Suporte só consulta (o backend impõe: downloads:read / downloads:write).
 */
const KIND = { app: "Aplicativo", link: "Link" };
const fmtSize = (n) => (n == null ? "" : n >= 1048576 ? `${(n / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
// Só abre links http(s): o endereço vem de um cadastro e nunca deve virar "javascript:" no href.
const safeHref = (u) => { try { return ["http:", "https:"].includes(new URL(u).protocol) ? u : undefined; } catch { return undefined; } };

export default function Downloads() {
  const me = getAuth()?.user;
  const canWrite = me?.role === "superadmin" || me?.role === "admin";
  const { confirm } = useUi();
  const run = useAction();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const list = useList("/admin/app-downloads", { q: "", kind: "" });
  const [form, setForm] = useState(null);
  useEffect(() => { list.filter({ q: dq }); /* eslint-disable-next-line */ }, [dq]);

  const remove = async (d) => {
    if (await confirm({ title: "Excluir item", message: `Excluir "${d.name}"? Os revendedores deixam de ver este item.`, danger: true, confirmLabel: "Excluir" })
      && await run(() => api(`/admin/app-downloads/${d.id}`, { method: "DELETE" }), "Item excluído.")) list.reload();
  };

  return (
    <>
      <div className="page-head"><h2>Downloads e links</h2></div>
      <p className="muted">O que você cadastrar aqui aparece para os revendedores em <strong>Downloads e links</strong>, só para consulta. Use <strong>Aplicativo</strong> para apps (com versão e código do Downloader) e <strong>Link</strong> para qualquer outro endereço.</p>
      <div className="toolbar">
        <input placeholder="Buscar por nome ou versão" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={list.params.kind} onChange={(e) => list.filter({ kind: e.target.value })}><option value="">Todos os tipos</option><option value="app">Aplicativos</option><option value="link">Links</option></select>
        {canWrite && <button className="btn primary" onClick={() => setForm({})}>Novo item</button>}
      </div>
      <Table>
        <thead><tr><th>Nome</th><th>Tipo</th><th>Versão</th><th>Código Downloader</th><th>Link</th><th>Atualizado em</th>{canWrite && <th />}</tr></thead>
        <tbody>{list.data.map((d) => (
          <tr key={d.id}>
            <td><strong>{d.name}</strong></td>
            <td><span className={`badge ${d.kind === "link" ? "muted" : "info"}`}>{KIND[d.kind] || d.kind}</span></td>
            <td>{d.version || <span className="muted">—</span>}</td>
            <td>{d.downloaderCode ? <span className="mono">{d.downloaderCode}</span> : <span className="muted">—</span>}</td>
            <td style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {d.hosted && <span className="badge ok" style={{ marginRight: 8 }}>Na VPS · {fmtSize(d.fileSize)}</span>}
              {safeHref(d.downloadUrl) ? <a href={safeHref(d.downloadUrl)} target="_blank" rel="noopener noreferrer" title={d.downloadUrl}>{d.downloadUrl}</a> : d.downloadUrl}
            </td>
            <td>{fmtDateTime(d.updatedAt)}</td>
            {canWrite && <td className="actions"><RowMenu items={[
              { label: "Editar", onClick: () => setForm({ item: d }) },
              { label: "Excluir", danger: true, onClick: () => remove(d) },
            ]} /></td>}
          </tr>))}</tbody>
      </Table>
      <Empty loading={list.loading} error={list.error} count={list.data.length} />
      <Pager meta={list.meta} onPage={list.setPage} />
      {form && <DownloadForm item={form.item} onClose={() => setForm(null)} onSaved={() => { setForm(null); list.reload(); }} />}
    </>
  );
}

function DownloadForm({ item, onClose, onSaved }) {
  const run = useAction();
  const edit = !!item;
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    kind: item?.kind || "app", name: item?.name || "", version: item?.version || "", downloadUrl: item?.downloadUrl || "", downloaderCode: item?.downloaderCode || "",
  });
  // Origem do aplicativo: link externo ou APK enviado para a VPS.
  const [mode, setMode] = useState(item?.hosted ? "file" : "url");
  // undefined = não mexe no arquivo; "<id>" = enviado agora (vira do item ao salvar); null = deixa de usar o arquivo da VPS.
  const [fileId, setFileId] = useState(undefined);
  const [size, setSize] = useState(item?.fileSize ?? null);
  const [up, setUp] = useState(null); // envio em andamento ou erro: { name, pct } | { error }
  const job = useRef(null);
  const pending = useRef(null); // arquivo enviado e ainda não salvo (descartado se o formulário for fechado)

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const isApp = f.kind === "app";
  const m = isApp ? mode : "url";
  const uploading = !!up && !up.error;
  const hasFile = !!fileId || (!!item?.hosted && fileId === undefined);
  const urlOk = !!safeHref(f.downloadUrl.trim());
  const ready = m === "file" ? hasFile && !uploading : urlOk;

  const discardPending = async () => {
    const id = pending.current; pending.current = null;
    if (id) await api(`/admin/app-downloads/upload/${id}`, { method: "DELETE" }).catch(() => {});
  };
  const close = async () => { job.current?.abort(); await discardPending(); onClose(); };

  const chooseMode = async (next) => {
    if (next === mode || uploading) return;
    setMode(next);
    await discardPending();
    if (next === "url") {
      // sai do arquivo: se o item tinha um da VPS, ele será removido ao salvar (com o novo link)
      setFileId(item?.hosted ? null : undefined); setF((x) => ({ ...x, downloadUrl: "" }));
    } else {
      setFileId(undefined); setSize(item?.fileSize ?? null); setF((x) => ({ ...x, downloadUrl: item?.hosted ? item.downloadUrl : "" }));
    }
  };

  const pick = async (file) => {
    if (!file) return;
    if (!/\.apk$/i.test(file.name)) { setUp({ error: "Escolha um arquivo .apk." }); return; }
    await discardPending();
    setUp({ name: file.name, pct: 0 });
    try {
      await api("/admin/app-downloads", { query: { pageSize: 1 } }); // renova a sessão antes de um envio longo
      job.current = uploadFile("/admin/app-downloads/upload", file, { query: { filename: file.name }, onProgress: (pct) => setUp((u) => (u && !u.error ? { ...u, pct } : u)) });
      const r = await job.current.promise;
      pending.current = r.fileId; setFileId(r.fileId); setSize(r.size); setF((x) => ({ ...x, downloadUrl: r.downloadUrl })); setUp(null);
    } catch (e) {
      setUp(e.aborted ? null : { error: e.message });
    } finally { job.current = null; }
  };

  const submit = async () => {
    setBusy(true);
    const body = { kind: f.kind, name: f.name.trim(), version: f.version.trim(), downloadUrl: f.downloadUrl.trim(), downloaderCode: f.downloaderCode.trim() };
    if (isApp && fileId !== undefined) body.fileId = m === "file" ? fileId : null;
    const r = await run(() => api(edit ? `/admin/app-downloads/${item.id}` : "/admin/app-downloads", { method: edit ? "PATCH" : "POST", body }), "Item salvo.");
    setBusy(false);
    if (r) { pending.current = null; onSaved(); }
  };
  return (
    <Modal title={edit ? "Editar item" : "Novo item"} onClose={close}>
      <Field label="Tipo"><select value={f.kind} disabled={uploading} onChange={set("kind")}><option value="app">Aplicativo (com versão e código do Downloader)</option><option value="link">Link (só título e endereço)</option></select></Field>
      <div className="row">
        <Field label={isApp ? "Nome do aplicativo" : "Título do link"}><input value={f.name} maxLength={120} onChange={set("name")} placeholder={isApp ? "Ex.: Delta TV" : "Ex.: Tutorial de instalação"} autoFocus /></Field>
        {isApp && <Field label="Versão (opcional)"><input value={f.version} maxLength={40} onChange={set("version")} placeholder="Ex.: 2.1.0" /></Field>}
      </div>
      {isApp && (
        <Field label="Origem do aplicativo">
          <select value={mode} disabled={uploading} onChange={(e) => chooseMode(e.target.value)}>
            <option value="url">Link externo (colar o endereço)</option>
            <option value="file">Enviar o arquivo APK para a minha VPS</option>
          </select>
        </Field>
      )}
      {m === "url" ? (
        <Field label={isApp ? "Link de download" : "Endereço do link"} hint={f.downloadUrl && !urlOk ? "O link precisa começar com http:// ou https://" : undefined}>
          <input value={f.downloadUrl} maxLength={2048} onChange={set("downloadUrl")} placeholder="https://..." inputMode="url" spellCheck={false} />
        </Field>
      ) : (
        <Field label="Arquivo APK" hint={up?.error || (hasFile ? "O link de download é gerado automaticamente." : "Escolha o .apk no seu computador.")}>
          {uploading ? (
            <div>
              <div className="muted">Enviando {up.name}… {up.pct}%</div>
              <progress value={up.pct} max="100" style={{ width: "100%" }} />
              <button type="button" className="btn sm" onClick={() => job.current?.abort()}>Cancelar envio</button>
            </div>
          ) : (
            <>
              {hasFile && <div style={{ marginBottom: 8 }}><span className="badge ok">Na VPS{size != null ? ` · ${fmtSize(size)}` : ""}</span> <span className="muted mono" style={{ wordBreak: "break-all" }}>{f.downloadUrl}</span></div>}
              <input type="file" accept=".apk,application/vnd.android.package-archive" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            </>
          )}
        </Field>
      )}
      {isApp && (
        <Field label="Código do Downloader (opcional)" hint="Só números: é o código que o cliente digita no app Downloader.">
          <input value={f.downloaderCode} maxLength={20} inputMode="numeric" className="mono" placeholder="Ex.: 123456"
            onChange={(e) => setF({ ...f, downloaderCode: e.target.value.replace(/\D/g, "") })} />
        </Field>
      )}
      <div className="actions">
        <button className="btn" onClick={close}>Cancelar</button>
        <button className="btn primary" disabled={busy || !f.name.trim() || !ready} onClick={submit}>{busy ? "Salvando…" : "Salvar"}</button>
      </div>
    </Modal>
  );
}
