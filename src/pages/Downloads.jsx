import { useEffect, useState } from "react";
import { api, getAuth } from "../api.js";
import { Empty, Field, Modal, Pager, RowMenu, Table, fmtDateTime, useAction, useDebounced, useList, useUi } from "../ui.jsx";

/**
 * Downloads e links: o admin cadastra aqui o que os revendedores veem, somente leitura, no portal deles.
 * Tipo "Aplicativo" = nome, versão, link e código numérico do Downloader; tipo "Link" = só título e endereço.
 * Suporte só consulta (o backend impõe: downloads:read / downloads:write).
 */
const KIND = { app: "Aplicativo", link: "Link" };
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
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const isApp = f.kind === "app";
  const urlOk = !!safeHref(f.downloadUrl.trim());
  const submit = async () => {
    setBusy(true);
    const body = { kind: f.kind, name: f.name.trim(), version: f.version.trim(), downloadUrl: f.downloadUrl.trim(), downloaderCode: f.downloaderCode.trim() };
    const r = await run(() => api(edit ? `/admin/app-downloads/${item.id}` : "/admin/app-downloads", { method: edit ? "PATCH" : "POST", body }), "Item salvo.");
    setBusy(false);
    if (r) onSaved();
  };
  return (
    <Modal title={edit ? "Editar item" : "Novo item"} onClose={onClose}>
      <Field label="Tipo"><select value={f.kind} onChange={set("kind")}><option value="app">Aplicativo (com versão e código do Downloader)</option><option value="link">Link (só título e endereço)</option></select></Field>
      <div className="row">
        <Field label={isApp ? "Nome do aplicativo" : "Título do link"}><input value={f.name} maxLength={120} onChange={set("name")} placeholder={isApp ? "Ex.: Delta TV" : "Ex.: Tutorial de instalação"} autoFocus /></Field>
        {isApp && <Field label="Versão (opcional)"><input value={f.version} maxLength={40} onChange={set("version")} placeholder="Ex.: 2.1.0" /></Field>}
      </div>
      <Field label={isApp ? "Link de download" : "Endereço do link"} hint={f.downloadUrl && !urlOk ? "O link precisa começar com http:// ou https://" : undefined}>
        <input value={f.downloadUrl} maxLength={2048} onChange={set("downloadUrl")} placeholder="https://..." inputMode="url" spellCheck={false} />
      </Field>
      {isApp && (
        <Field label="Código do Downloader (opcional)" hint="Só números: é o código que o cliente digita no app Downloader.">
          <input value={f.downloaderCode} maxLength={20} inputMode="numeric" className="mono" placeholder="Ex.: 123456"
            onChange={(e) => setF({ ...f, downloaderCode: e.target.value.replace(/\D/g, "") })} />
        </Field>
      )}
      <div className="actions">
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={busy || !f.name.trim() || !urlOk} onClick={submit}>{busy ? "Salvando…" : "Salvar"}</button>
      </div>
    </Modal>
  );
}
