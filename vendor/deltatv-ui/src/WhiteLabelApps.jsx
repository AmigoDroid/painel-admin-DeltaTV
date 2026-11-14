import React, { useCallback, useEffect, useState } from "react";

import "./white-label.css";

const ROOT = "/partner/white-label";
const money = (cents) => (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt = (value) => value ? String(value).split("-").reverse().join("/") : "Aguardando pagamento";
const stateText = { active: "Ativo", draft: "Preparando", suspended: "Suspenso", archived: "Arquivado", payment_required: "Mensalidade pendente", owner_inactive: "Conta suspensa" };
const blank = { name: "", baseUrl: "", priority: 0, status: "active" };

export default function WhiteLabelApps({api}) {
  const [apps, setApps] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [appPage, setAppPage] = useState(1);
  const [appsMeta, setAppsMeta] = useState({ totalPages: 1 });
  const [details, setDetails] = useState(null);
  const [servers, setServers] = useState([]);
  const [activations, setActivations] = useState({ data: [], meta: {} });
  const [payments, setPayments] = useState([]);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadApps = useCallback(async () => {
    try {
      const response = await api(ROOT, { query: { page: appPage, pageSize: 25 } });
      setApps(response.data || []); setAppsMeta(response.meta || { totalPages: 1 });
      setSelectedId(current => (response.data || []).some(a => a.id === current) ? current : response.data?.[0]?.id || "");
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [appPage]);
  useEffect(() => { void loadApps(); }, [loadApps]);
  const refreshDetails = useCallback(async () => {
    if (!selectedId) { setDetails(null); setServers([]); setPayments([]); setActivations({ data: [], meta: {} }); return; }
    try {
      const [a, s, d, p] = await Promise.all([
        api(`${ROOT}/${selectedId}`), api(`${ROOT}/${selectedId}/servers`),
        api(`${ROOT}/${selectedId}/activations`, { query: { page, pageSize: 15 } }), api(`${ROOT}/${selectedId}/payments`),
      ]);
      setDetails(a); setServers(s.data || []); setActivations(d); setPayments(p.data || []);
      setError("");
    } catch (e) { setError(e.message); }
  }, [selectedId, page]);
  useEffect(() => { void refreshDetails(); }, [refreshDetails]);
  const execute = async (fn, message) => {
    setBusy(true); setError(""); setNotice("");
    try { await fn(); setNotice(message); await refreshDetails(); await loadApps(); return true; }
    catch (e) { setError(e.message); return false; }
    finally { setBusy(false); }
  };
  const saveServer = async e => {
    e.preventDefault();
    const body = { name: form.name.trim(), baseUrl: form.baseUrl.trim(), priority: Number(form.priority), status: form.status };
    const ok = await execute(() => api(`${ROOT}/${selectedId}/servers${form.id ? `/${form.id}` : ""}`,
      { method: form.id ? "PATCH" : "POST", body }), "Servidor salvo com sucesso.");
    if (ok) setForm(null);
  };
  const deleteServer = s => { if (window.confirm(`Excluir ${s.name} deste aplicativo?`))
    void execute(() => api(`${ROOT}/${selectedId}/servers/${s.id}`, { method: "DELETE" }), "Servidor removido."); };
  const toggle = a => {
    const action = a.status === "active" ? "revoke" : "restore";
    if (window.confirm(`${action === "revoke" ? "Liberar a vaga e bloquear" : "Restaurar"} esta instalação?`))
      void execute(() => api(`${ROOT}/${selectedId}/activations/${a.id}/${action}`, { method: "POST" }), "Ativação atualizada.");
  };
  return <div className="wl-root">
    <section className="panel wl-head">
      <h2>Meus aplicativos</h2>
      <p>Cada aplicativo tem seus próprios servidores e ativações. O login IPTV é feito com o usuário e a senha do assinante; essas credenciais não são armazenadas neste painel.</p>
      <div className="wl-selector"><label htmlFor="wl-app">Aplicativo contratado</label>
        <select id="wl-app" value={selectedId} onChange={e => { setSelectedId(e.target.value); setPage(1); }}>
          {apps.map(a => <option key={a.id} value={a.id}>{a.name} · {a.appKey}</option>)}
        </select><button type="button" className="outline" disabled={appPage <= 1} onClick={() => setAppPage(p => p - 1)}>←</button>
        <span className="wl-app-page">{appPage} / {appsMeta.totalPages || 1}</span>
        <button type="button" className="outline" disabled={appPage >= (appsMeta.totalPages || 1)} onClick={() => setAppPage(p => p + 1)}>→</button>
        <button type="button" className="outline" onClick={refreshDetails} disabled={!selectedId || busy}>Atualizar</button></div>
    </section>
    {error && <div className="alert" role="alert">{error}</div>}
    {notice && <div className="wl-message" role="status">{notice}</div>}
    {!selectedId && <section className="panel wl-empty">{loading ? "Consultando…" : "Nenhum aplicativo contratado. Solicite ao Superadmin a ativação de um aplicativo."}</section>}
    {details && <>
      <div className="wl-stats">
        <div className="panel"><small>Plano</small><strong>{details.planType === "unlimited" ? "Ilimitado" : `${details.activeActivations} / ${details.activationLimit}`}</strong><span>aparelhos ativos</span></div>
        <div className="panel"><small>Mensalidade</small><strong>{money(details.monthlyFeeCents)}</strong><span>pagamento registrado pelo administrador</span></div>
        <div className="panel"><small>Válido até</small><strong>{fmt(details.paidThrough)}</strong><span>{stateText[details.effectiveStatus] || details.effectiveStatus}</span></div>
      </div>
      <section className="panel"><h3>Identidade e distribuição</h3>
        <div className="wl-grid"><p><b>Aplicativo</b><span>{details.name}</span></p>
          <p><b>Identificador</b><code>{details.appKey}</code></p>
          <p><b>Download</b>{/^https?:\/\//i.test(details.downloadUrl || "") ? <a href={details.downloadUrl} target="_blank" rel="noreferrer">Instalar aplicativo</a> : <span>Aguardando pacote do aplicativo</span>}</p></div>
      </section>
      <section className="panel"><div className="wl-title"><div><h3>Servidores Xtream</h3><p>URLs próprias do seu serviço. O aparelho testa o login IPTV e escolhe um servidor válido.</p></div>
        <button type="button" className="primary" onClick={() => setForm({ ...blank })}>+ Adicionar URL</button></div>
        {servers.map(s => <div className="wl-item" key={s.id}><div><b>{s.name}</b><small>{s.baseUrl}</small><small>Prioridade {s.priority} · {s.status === "active" ? "Ativo" : "Desativado"}</small></div>
          <div className="wl-actions"><button type="button" className="outline" onClick={() => setForm(s)}>Editar</button><button type="button" className="revoke" onClick={() => deleteServer(s)}>Excluir</button></div></div>)}
        {!servers.length && <p>Nenhuma URL cadastrada. O aplicativo não poderá autenticar até você adicionar seu servidor.</p>}
      </section>
      <section className="panel"><h3>Instalações e ativações</h3>
        <p>Um aparelho ocupa uma vaga enquanto estiver ativo. Revogar libera a vaga, mas impede que a mesma instalação entre novamente sem restauração.</p>
        {activations.data?.map(a => <div className="wl-item" key={a.id}><div><b>{a.platform}</b><small>Ativado em {new Date(a.activatedAt).toLocaleString("pt-BR")}</small>
          <small>{a.status === "active" ? "Ativo" : "Revogado"} · último acesso {a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleString("pt-BR") : "não registrado"}</small></div>
          <button type="button" className="outline" onClick={() => toggle(a)}>{a.status === "active" ? "Revogar" : "Restaurar"}</button></div>)}
        {!activations.data?.length && <p>Nenhum aparelho ativado ainda.</p>}
        {(activations.meta?.totalPages || 1) > 1 && <div className="wl-actions"><button type="button" disabled={page <= 1} onClick={() => setPage(x => x - 1)}>Anterior</button>
          <span>{page} de {activations.meta.totalPages}</span><button type="button" disabled={page >= activations.meta.totalPages} onClick={() => setPage(x => x + 1)}>Próxima</button></div>}
      </section>
      <section className="panel"><h3>Histórico de mensalidades</h3>
        <p>Somente pagamentos registrados pela administração. A cobrança Pix automática ainda não faz parte deste serviço.</p>
        {payments.map(p => <div className="wl-item" key={p.id}><div><b>{money(p.amountCents)} · {p.months} mês(es)</b><small>Referência: {p.reference} · registrado em {new Date(p.paidAt).toLocaleString("pt-BR")}</small></div><span>Até {fmt(p.paidThrough)}</span></div>)}
        {!payments.length && <p>Sem pagamentos registrados.</p>}
      </section>
    </>}
    {form && <div className="wl-overlay" role="presentation" onMouseDown={e => e.target === e.currentTarget && setForm(null)}>
      <form className="panel wl-modal" onSubmit={saveServer} role="dialog" aria-modal="true" aria-label="Configuração de servidor">
        <div className="wl-title"><h3>{form.id ? "Editar servidor" : "Adicionar servidor"}</h3><button type="button" className="outline" onClick={() => setForm(null)}>Fechar</button></div>
        <label>Nome<input required maxLength={120} value={form.name} onChange={e => setForm(v => ({ ...v, name: e.target.value }))}/></label>
        <label>URL base<input required type="url" placeholder="https://iptv.exemplo.com:8080" value={form.baseUrl} onChange={e => setForm(v => ({ ...v, baseUrl: e.target.value }))}/></label>
        <label>Prioridade<input type="number" min={-1000} max={1000} value={form.priority} onChange={e => setForm(v => ({ ...v, priority: e.target.value }))}/></label>
        <label>Situação<select value={form.status} onChange={e => setForm(v => ({ ...v, status: e.target.value }))}><option value="active">Ativo</option><option value="disabled">Desativado</option></select></label>
        <button className="primary" disabled={busy}>{busy ? "Salvando…" : "Salvar servidor"}</button>
      </form>
    </div>}
  </div>;
}
