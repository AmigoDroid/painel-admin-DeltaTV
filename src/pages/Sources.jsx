import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Badge, Empty, Field, LoadError, Modal, Pager, Table, useAction, useList, useUi, RowMenu } from "../ui.jsx";

export default function Sources() {
  const list = useList("/admin/sources", {});
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);
  return (
    <>
      <div className="page-head"><h2>Fontes de conteúdo</h2><button className="btn primary" onClick={() => setCreating(true)}>Nova fonte</button></div>
      <p className="muted">Somente cadastre fontes que você tem autorização para distribuir. As URLs ficam cifradas e nunca são enviadas ao cliente final.</p>
      <Table><thead><tr><th>Nome</th><th>Tipo</th><th>Escopo</th><th>Entrega</th><th>Host</th><th>Parceiros</th><th>Status</th></tr></thead>
        <tbody>{list.data.map((s) => (
          <tr key={s.id} className="click" onClick={() => setOpenId(s.id)}><td>{s.name}</td><td>{s.kind === "playlist" ? "Playlist M3U" : "Catálogo"}</td>
            <td>{s.scope === "global" ? "Global (individuais)" : "Parceiros"}</td><td>{s.deliveryMode === "proxy" ? "Proxy" : "Redirecionamento"}{s.signing.type !== "none" && ` · ${s.signing.type}`}</td>
            <td>{s.host || "—"}</td><td>{s.Partners?.length ?? 0}</td><td><Badge status={s.status} /></td></tr>))}</tbody></Table>
      <Empty loading={list.loading} error={list.error} count={list.data.length} />
      <Pager meta={list.meta} onPage={list.setPage} />
      {creating && <SourceForm onClose={() => setCreating(false)} onSaved={() => { setCreating(false); list.reload(); }} />}
      {openId && <SourceDetail id={openId} onClose={() => setOpenId(null)} onChanged={list.reload} />}
    </>
  );
}

function SourceForm({ source, onClose, onSaved }) {
  const run = useAction();
  const edit = !!source;
  const [f, setF] = useState({ name: source?.name || "", kind: source?.kind || "playlist", scope: source?.scope || "partner", deliveryMode: source?.deliveryMode || "redirect", url: "", signingType: source?.signing?.type || "none", secret: "", ttl: source?.signing?.ttlSeconds || 60 });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    const body = { name: f.name, scope: f.scope, deliveryMode: f.deliveryMode };
    if (!edit) body.kind = f.kind;
    if (f.url) body.url = f.url;
    body.signing = f.signingType === "none" ? { type: "none" } : { type: f.signingType, ttlSeconds: Number(f.ttl), ...(f.secret ? { secret: f.secret } : {}) };
    const r = await run(() => api(edit ? `/admin/sources/${source.id}` : "/admin/sources", { method: edit ? "PATCH" : "POST", body }), "Fonte salva.");
    if (r) onSaved(r);
  };
  return (
    <Modal title={edit ? "Editar fonte" : "Nova fonte"} onClose={onClose}>
      <Field label="Nome"><input value={f.name} onChange={set("name")} /></Field>
      {!edit && <Field label="Tipo"><select value={f.kind} onChange={set("kind")}><option value="playlist">Playlist M3U (URL)</option><option value="catalog">Catálogo manual (canais cadastrados)</option></select></Field>}
      {(f.kind === "playlist" || edit) && <Field label={edit ? "Nova URL (deixe vazio para manter)" : "URL da playlist"} hint="Endereços internos/privados são bloqueados (SSRF)."><input value={f.url} onChange={set("url")} placeholder="https://…" autoComplete="off" /></Field>}
      <div className="row">
        <Field label="Escopo"><select value={f.scope} onChange={set("scope")}><option value="partner">Parceiros vinculados</option><option value="global">Global (licenças individuais)</option></select></Field>
        <Field label="Entrega" hint="Vale só para o gateway de reprodução desta fonte (não para os servidores Xtream das parcerias). Redirecionamento não consome sua banda; proxy esconde a origem do app, com limite de concorrência."><select value={f.deliveryMode} onChange={set("deliveryMode")}><option value="redirect">Redirecionamento (302)</option><option value="proxy">Proxy (opcional)</option></select></Field>
      </div>
      <Field label="URL assinada na origem" hint="Use apenas se o servidor de origem valida a assinatura; torna o bloqueio efetivo também na origem."><select value={f.signingType} onChange={set("signingType")}><option value="none">Sem assinatura</option><option value="hmac-query">HMAC na query (expires/token)</option><option value="nginx-secure-link">nginx secure_link (md5/expires)</option></select></Field>
      {f.signingType !== "none" && <div className="row"><Field label="Segredo compartilhado (mín. 16)"><input type="password" value={f.secret} onChange={set("secret")} /></Field><Field label="Validade da URL (s)"><input type="number" min="5" max="3600" value={f.ttl} onChange={set("ttl")} /></Field></div>}
      <div className="actions"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={submit}>Salvar</button></div>
    </Modal>
  );
}

function SourceDetail({ id, onClose, onChanged }) {
  const { confirm } = useUi();
  const run = useAction();
  const [s, setS] = useState(null);
  const [error, setError] = useState("");
  const [partners, setPartners] = useState([]);
  const [partnerQuery, setPartnerQuery] = useState("");
  const [partnerPage, setPartnerPage] = useState(1);
  const [partnerPages, setPartnerPages] = useState(1);
  const [knownPartners, setKnownPartners] = useState({});
  const [partnersError, setPartnersError] = useState("");
  const [selected, setSelected] = useState([]);
  const [channels, setChannels] = useState([]);
  const [editing, setEditing] = useState(false);
  const [ch, setCh] = useState({ name: "", streamUrl: "", kind: "live" });
  const load = async () => {
    try {
      const src = await api(`/admin/sources/${id}`);
      setS(src); setSelected(src.Partners.map((p) => p.id));
      setKnownPartners((prior) => ({ ...prior, ...Object.fromEntries(src.Partners.map((p) => [p.id, p])) }));
      setError("");
      if (src.kind === "catalog") setChannels((await api(`/admin/sources/${id}/channels`, { query: { pageSize: 100 } })).data);
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      api("/admin/partners", { query: { q: partnerQuery.trim(), page: partnerPage, pageSize: 20 }, signal: ctrl.signal })
        .then((r) => { if (!ctrl.signal.aborted) {
          setPartners(r.data || []); setPartnerPages(r.meta?.totalPages || 1); setPartnersError("");
          setKnownPartners((prior) => ({ ...prior, ...Object.fromEntries((r.data || []).map((p) => [p.id, p])) }));
        } }).catch((e) => { if (!ctrl.signal.aborted) setPartnersError(e.message); });
    }, 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [id, partnerQuery, partnerPage]);
  if (!s) return <Modal title="Fonte" onClose={onClose}>{error ? <LoadError error={error} onRetry={load} /> : <p className="muted">Carregando…</p>}</Modal>;

  const savePartners = async () => { if (await run(() => api(`/admin/sources/${id}/partners`, { method: "PUT", body: { partnerIds: selected } }), "Parceiros atualizados.")) { load(); onChanged(); } };
  const remove = async () => {
    if (!(await confirm({ title: "Excluir fonte", message: "Remove a fonte, seus canais e vínculos. Os clientes deixam de receber este conteúdo.", danger: true, confirmLabel: "Excluir" }))) return;
    if (await run(() => api(`/admin/sources/${id}`, { method: "DELETE" }), "Fonte excluída.")) { onChanged(); onClose(); }
  };
  const toggle = async () => { if (await run(() => api(`/admin/sources/${id}`, { method: "PATCH", body: { status: s.status === "active" ? "disabled" : "active" } }), "Status atualizado.")) { load(); onChanged(); } };
  const addChannel = async () => { if (await run(() => api(`/admin/sources/${id}/channels`, { method: "POST", body: ch }), "Canal adicionado.")) { setCh({ name: "", streamUrl: "", kind: "live" }); load(); } };
  const delChannel = async (c) => { if (await confirm({ title: "Excluir canal", message: c.name, danger: true }) && await run(() => api(`/admin/sources/${id}/channels/${c.id}`, { method: "DELETE" }), "Canal excluído.")) load(); };

  return (
    <Modal title={s.name} onClose={onClose} wide>
      <dl className="kv"><dt>Status</dt><dd><Badge status={s.status} /></dd><dt>Host</dt><dd>{s.host || "—"}</dd><dt>Entrega</dt><dd>{s.deliveryMode === "proxy" ? "Proxy" : "Redirecionamento"} · assinatura: {s.signing.type}{s.signing.hasSecret ? " (segredo definido)" : ""}</dd></dl>
      <div className="actions left"><button className="btn" onClick={() => setEditing(true)}>Editar</button><button className="btn" onClick={toggle}>{s.status === "active" ? "Desativar" : "Ativar"}</button><button className="btn danger" onClick={remove}>Excluir</button></div>
      {s.scope === "partner" && <div className="card" style={{ margin: "12px 0" }}><h3>Parceiros com acesso</h3>
        <input type="search" placeholder="Buscar parceiro…" value={partnerQuery} onChange={(e) => { setPartnerQuery(e.target.value); setPartnerPage(1); }} />
        <p className="muted">{selected.length} selecionado(s). Navegue pelas páginas; os vínculos selecionados permanecem marcados.</p>
        <div style={{ maxHeight: 170, overflowY: "auto", display: "grid", gap: 6 }}>
          {[...new Set([...selected, ...partners.map((p) => p.id)])].map((partnerId) => {
            const p = knownPartners[partnerId];
            return <label key={partnerId}><input type="checkbox" style={{ width: "auto" }} checked={selected.includes(partnerId)}
              onChange={(e) => setSelected((prior) => e.target.checked ? [...new Set([...prior, partnerId])] : prior.filter((x) => x !== partnerId))} /> {p?.name || partnerId}</label>;
          })}
        </div>
        {partnersError && <span className="error">{partnersError}</span>}
        <div className="actions left"><button className="btn sm" disabled={partnerPage <= 1} onClick={() => setPartnerPage((p) => p - 1)}>Anterior</button>
          <span className="muted">Página {partnerPage} de {partnerPages}</span>
          <button className="btn sm" disabled={partnerPage >= partnerPages} onClick={() => setPartnerPage((p) => p + 1)}>Próxima</button></div>
        <div className="actions"><button className="btn primary" onClick={savePartners}>Salvar vínculos</button></div></div>}
      {s.kind === "catalog" && <><h3>Canais</h3>
        <div className="row"><Field label="Nome"><input value={ch.name} onChange={(e) => setCh({ ...ch, name: e.target.value })} /></Field><Field label="URL de reprodução"><input value={ch.streamUrl} onChange={(e) => setCh({ ...ch, streamUrl: e.target.value })} /></Field></div>
        <div className="actions left"><select style={{ width: "auto" }} value={ch.kind} onChange={(e) => setCh({ ...ch, kind: e.target.value })}><option value="live">Canal ao vivo</option><option value="movie">Filme</option><option value="series">Série</option></select><button className="btn primary" disabled={!ch.name || !ch.streamUrl} onClick={addChannel}>Adicionar canal</button></div>
        <Table><thead><tr><th>Nome</th><th>Tipo</th><th>Status</th><th /></tr></thead><tbody>{channels.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.kind}</td><td><Badge status={c.status} /></td><td className="actions">
              <RowMenu items={[
                { label: "Excluir", danger: true, onClick: () => delChannel(c) },
              ]} />
            </td></tr>)}</tbody></Table></>}
      {editing && <SourceForm source={s} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); onChanged(); }} />}
    </Modal>
  );
}
