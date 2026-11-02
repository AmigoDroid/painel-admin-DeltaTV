import { useEffect, useState } from "react";
import { api } from "../api.js";
export default function Notifications() {
  const [partners, setPartners] = useState([]), [audience, setAudience] = useState("all"), [selected, setSelected] = useState([]);
  const [search, setSearch] = useState(""), [searchPage, setSearchPage] = useState(1), [searchPages, setSearchPages] = useState(1), [searchBusy, setSearchBusy] = useState(false);
  const [title, setTitle] = useState(""), [message, setMessage] = useState(""), [severity, setSeverity] = useState("info");
  const [busy, setBusy] = useState(false), [info, setInfo] = useState(""), [error, setError] = useState(""), [history, setHistory] = useState([]);
  const [page, setPage] = useState(1), [pages, setPages] = useState(1), [openId, setOpenId] = useState(null), [recipients, setRecipients] = useState([]), [recipientPage, setRecipientPage] = useState(1), [recipientPages, setRecipientPages] = useState(1), [loadingRecipients, setLoadingRecipients] = useState(false);
  const refresh = (p = page) => api("/admin/notifications/campaigns", { query: { page: p } }).then(v => { setHistory(v.data || []); setPages(v.meta?.pages || 1); }).catch(e => setError(e.message));
  const openRecipients = async (id, p = 1) => { setOpenId(id); setRecipientPage(p); setLoadingRecipients(true); try { const r = await api(`/admin/notifications/campaigns/${id}/recipients`, { query: { page: p, limit: 50 } }); setRecipients(r.data || []); setRecipientPages(r.meta?.pages || 1); } catch (e) { setError(e.message); } finally { setLoadingRecipients(false); } };
  useEffect(() => { refresh(1); }, []);
  useEffect(() => {
    if (audience !== "selected") return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchBusy(true);
      try {
        const result = await api("/admin/notifications/recipient-search", { query: { q: search.trim(), page: searchPage, limit: 20 } });
        if (!controller.signal.aborted) { setPartners(result.data || []); setSearchPages(Math.max(1,result.meta?.pages || 1)); }
      } catch (e) { if (!controller.signal.aborted) setError(e.message); }
      finally { if (!controller.signal.aborted) setSearchBusy(false); }
    }, 300);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [audience, search, searchPage]);
  const toggle = (p) => setSelected(v => v.some(x => x.id === p.id) ? v.filter(x => x.id !== p.id) : [...v, { id:p.id, name:p.name }]);
  async function submit(e) {
    e.preventDefault(); if (!window.confirm(`Enviar esta notificação para ${audience === "all" ? "todas as revendas" : audience === "content" ? "todos os parceiros de conteúdo" : selected.length + " destinatário(s)"}?`)) return;
    setBusy(true); setError(""); setInfo("");
    try { const r = await api("/admin/notifications/send", { method: "POST", body: { audience, partnerIds: selected.map(p => p.id), title, message, severity } });
      setInfo(`Notificação enviada para ${r.sent} destinatário(s).`); setTitle(""); setMessage(""); setPage(1); setOpenId(null); refresh(1);
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div><div className="page-head"><h2>Notificações às revendas e parceiros de conteúdo</h2></div><p className="muted">Os avisos ficam salvos, inclusive para contas offline.</p>
  <form className="card" onSubmit={submit} style={{ padding: 20, display: "grid", gap: 12 }}>
    <label>Destinatários<select value={audience} onChange={e => setAudience(e.target.value)}><option value="all">Todas as revendas</option><option value="content">Todos os parceiros de conteúdo</option><option value="selected">Selecionar destinatários ou parceiros</option></select></label>
    {audience === "selected" && <section aria-label="Selecionar destinatários" style={{ display:"grid",gap:12,minWidth:0 }}>
      <label>Buscar parceiro ou revenda por nome, código ou email<input type="search" value={search} onChange={e => { setSearch(e.target.value); setSearchPage(1); }} placeholder="Digite para buscar entre todas as revendas" /></label>
      <div aria-live="polite"><strong>{selected.length} selecionada(s)</strong>{selected.length > 0 && <button type="button" className="btn sm" style={{marginLeft:12}} onClick={() => setSelected([])}>Limpar seleção</button>}</div>
      {selected.length > 0 && <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{selected.map(p => <button key={p.id} type="button" className="btn sm" onClick={() => toggle(p)} title="Remover destinatário">{p.name} ×</button>)}</div>}
      <div className="card" style={{padding:12,display:"grid",gap:8}}>{searchBusy && <small>Pesquisando…</small>}{partners.map(p => <label key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:8,overflowWrap:"anywhere"}}><input type="checkbox" checked={selected.some(x => x.id === p.id)} onChange={() => toggle(p)}/><span><b>{p.name}</b><small className="muted" style={{display:"block"}}>{p.slug} · {p.status}</small></span></label>)}{!searchBusy && !partners.length && <p className="muted">Nenhum destinatário encontrado.</p>}</div>
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}><button type="button" className="btn" disabled={searchPage<=1} onClick={() => setSearchPage(v=>v-1)}>Anterior</button><small>Página {searchPage} de {searchPages}</small><button type="button" className="btn" disabled={searchPage>=searchPages} onClick={() => setSearchPage(v=>v+1)}>Próxima</button></div>
    </section>}
    <label>Prioridade<select value={severity} onChange={e => setSeverity(e.target.value)}><option value="info">Informativa</option><option value="important">Importante</option><option value="warning">Atenção</option></select></label>
    <label>Título<input required maxLength={140} minLength={3} value={title} onChange={e => setTitle(e.target.value)}/></label>
    <label>Mensagem<textarea required rows={5} maxLength={4000} minLength={3} value={message} onChange={e => setMessage(e.target.value)}/></label>
    <button type="submit" className="btn primary" disabled={busy || (audience === "selected" && !selected.length)}>{busy ? "Enviando…" : "Enviar notificação"}</button>
    {info && <p role="status">{info}</p>}{error && <p role="alert">{error}</p>}
  </form><h3>Comunicados enviados</h3>
  <p className="muted">Cada comunicado aparece uma única vez. Abra os destinatários para ver os registros filhos e quem marcou como lida. A leitura não confirma que a pessoa leu todo o texto.</p>
  <div style={{ display: "grid", gap: 12 }}>
    {history.length === 0 && <p className="muted">Nenhuma notificação enviada.</p>}
    {history.map(n => <article className="card" style={{ padding: 16, minWidth: 0 }} key={n.id}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}><b style={{ overflowWrap: "anywhere" }}>{n.title}</b><small>{new Date(n.createdAt).toLocaleString("pt-BR")}</small></div>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{n.message}</p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}><span><b>{n.total}</b> destinatário(s)</span><span style={{ color: "#20875a" }}><b>{n.read}</b> lida(s)</span><span><b>{n.unread}</b> pendente(s)</span>
      <button type="button" className="btn" onClick={() => openId === n.id ? setOpenId(null) : openRecipients(n.id)}> {openId === n.id ? "Ocultar revendas" : "Ver revendas destinatárias"} </button></div>
      {openId === n.id && <section style={{ marginTop: 14, borderTop: "1px solid var(--border, #ddd)", paddingTop: 12 }} aria-label="Detalhes de leitura por revenda">
        {loadingRecipients ? <p>Carregando destinatários…</p> : <div style={{ display: "grid", gap: 8 }}>
          {recipients.map(r => <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "10px 0", borderBottom: "1px solid var(--border, #ddd)" }}><span style={{ overflowWrap: "anywhere" }}><b>{r.partnerName}</b>{r.partnerSlug && <small className="muted"> · {r.partnerSlug}</small>}</span><span>{r.readAt ? <>✅ Lida em {new Date(r.readAt).toLocaleString("pt-BR")}</> : <>○ Ainda não lida</>}</span></div>)}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}><button type="button" className="btn" disabled={recipientPage <= 1} onClick={() => openRecipients(n.id, recipientPage - 1)}>Anterior</button><small>Página {recipientPage} de {recipientPages}</small><button type="button" className="btn" disabled={recipientPage >= recipientPages} onClick={() => openRecipients(n.id, recipientPage + 1)}>Próxima</button><button type="button" className="btn" onClick={() => openRecipients(n.id, recipientPage)}>Atualizar leituras</button></div>
        </div>}
      </section>}
    </article>)}
  </div><div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}><button type="button" className="btn" disabled={page <= 1} onClick={() => { setPage(page - 1); refresh(page - 1); setOpenId(null); }}>Anterior</button><span>Página {page} de {pages}</span><button type="button" className="btn" disabled={page >= pages} onClick={() => { setPage(page + 1); refresh(page + 1); setOpenId(null); }}>Próxima</button></div>
  </div>;
}
