import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import PartnerPicker from "../PartnerPicker.jsx";
import { fmtMoney } from "../ui.jsx";
import "./white-label.css";
const ROOT = "/admin/white-label";
const initial = { partnerId: "", name: "", appKey: "", status: "draft", planType: "limited", activationLimit: "100", monthlyFeeCents: "9900", paidThrough: "", logoUrl: "", downloadUrl: "", notes: "" };
const statuses = { draft: "Em preparação", active: "Ativo", suspended: "Suspenso", archived: "Arquivado", payment_required: "Pendente de pagamento", owner_inactive: "Titular inativo" };
const inputAmount = n => Number.isFinite(Number(n)) ? String((Number(n) / 100).toFixed(2)) : "0.00";
const cents = n => Math.round(Number(n) * 100);
const errText = e => e?.message || "Falha ao salvar os dados.";

export default function WhiteLabel() {
  const [apps, setApps] = useState([]), [search, setSearch] = useState(""), [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ totalPages: 1, total: 0 });
  const [chosen, setChosen] = useState(null), [servers, setServers] = useState([]), [activations, setActivations] = useState({ data: [], meta: {} }), [payments, setPayments] = useState([]);
  const [form, setForm] = useState(null), [serverForm, setServerForm] = useState(null), [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [activationPage, setActivationPage] = useState(1);
  const load = useCallback(async () => {
    try {
      const r = await api(ROOT, { query: { page, pageSize: 20, q: search } });
      setApps(r.data || []); setMeta(r.meta || {});
    } catch (e) { setError(errText(e)); }
  }, [page, search]);
  useEffect(() => { void load(); }, [load]);
  const reloadDetail = useCallback(async () => {
    if (!chosen?.id) return;
    try {
      const [app, ss, aa, pp] = await Promise.all([
        api(`${ROOT}/${chosen.id}`), api(`${ROOT}/${chosen.id}/servers`),
        api(`${ROOT}/${chosen.id}/activations`, { query: { page: activationPage, pageSize: 20 } }), api(`${ROOT}/${chosen.id}/payments`),
      ]);
      setChosen(app); setServers(ss.data || []); setActivations(aa); setPayments(pp.data || []);
    } catch (e) { setError(errText(e)); }
  }, [chosen?.id, activationPage]);
  useEffect(() => { void reloadDetail(); }, [reloadDetail]);
  const task = async (cb, success) => {
    setBusy(true); setError(""); setNotice("");
    try { await cb(); setNotice(success); await load(); await reloadDetail(); return true; }
    catch (e) { setError(errText(e)); return false; }
    finally { setBusy(false); }
  };
  const submit = async e => {
    e.preventDefault();
    if (!form.partnerId) { setError("Escolha o cliente responsável pelo aplicativo."); return; }
    const body = { ...form,
      activationLimit: form.planType === "unlimited" ? null : Number(form.activationLimit),
      monthlyFeeCents: cents(form.monthlyFeeCents),
      paidThrough: form.paidThrough || null, logoUrl: form.logoUrl || null, downloadUrl: form.downloadUrl || null,
      notes: form.notes || null };
    if (form.id) { delete body.partnerId; delete body.appKey; delete body.id; delete body.partnerName; delete body.partnerKind; delete body.activeActivations; delete body.availableActivations; delete body.effectiveStatus; delete body.createdAt; delete body.updatedAt; }
    const id = form.id;
    const result = await task(() => api(id ? `${ROOT}/${id}` : ROOT, { method: id ? "PATCH" : "POST", body }), "Contrato do aplicativo salvo.");
    if (result) setForm(null);
  };
  const doServer = async e => {
    e.preventDefault();
    const id = chosen.id;
    const b = { name: serverForm.name.trim(), baseUrl: serverForm.baseUrl.trim(), priority: Number(serverForm.priority), status: serverForm.status };
    if (await task(() => api(`${ROOT}/${id}/servers${serverForm.id ? `/${serverForm.id}` : ""}`, { method: serverForm.id ? "PATCH" : "POST", body: b }), "Servidor salvo.")) setServerForm(null);
  };
  const doPayment = async e => {
    e.preventDefault();
    if (await task(() => api(`${ROOT}/${chosen.id}/payments`, { method: "POST", body: {
      reference: payment.reference.trim(), months: Number(payment.months), amountCents: cents(payment.amount), notes: payment.notes.trim() } }), "Pagamento manual registrado. Assinatura renovada.")) setPayment(null);
  };
  const doActivation = a => {
    const action = a.status === "active" ? "revoke" : "restore";
    if (window.confirm(`${action === "revoke" ? "Revogar" : "Restaurar"} a ativação desta instalação?`))
      void task(() => api(`${ROOT}/${chosen.id}/activations/${a.id}/${action}`, { method: "POST" }), "Ativação atualizada.");
  };
  const openEdit = a => setForm({ ...a, logoUrl: a.logoUrl || "", downloadUrl: a.downloadUrl || "", paidThrough: a.paidThrough || "",
    monthlyFeeCents: inputAmount(a.monthlyFeeCents), activationLimit: a.activationLimit || "", notes: a.notes || "" });
  const openNew = () => setForm({ ...initial, monthlyFeeCents: inputAmount(9900) });
  return <div className="adm-wl">
    <header className="page-head"><div><h2>Aplicativos white-label</h2><p className="muted">Venda um aplicativo com painel, servidores próprios e mensalidade. O DeltaTV permanece independente.</p></div>
      <button type="button" className="btn primary" onClick={openNew}>+ Novo aplicativo</button></header>
    <div className="toolbar"><input type="search" placeholder="Buscar aplicativo ou identificador" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/>
      <button type="button" className="btn" onClick={load}>Atualizar</button></div>
    {error && <p className="adm-wl-error" role="alert">{error}</p>}{notice && <p className="adm-wl-ok" role="status">{notice}</p>}
    <div className="table-wrap"><table><thead><tr><th>Aplicativo</th><th>Cliente</th><th>Plano</th><th>Mensalidade</th><th>Vigência</th><th>Situação</th><th /></tr></thead><tbody>
      {apps.map(a => <tr key={a.id}><td><b>{a.name}</b><br/><small className="mono muted">{a.appKey}</small></td>
        <td>{a.partnerName || "—"}</td><td>{a.planType === "unlimited" ? "Ilimitado" : `${a.activeActivations}/${a.activationLimit} aparelhos`}</td>
        <td>{fmtMoney(a.monthlyFeeCents)}</td><td>{a.paidThrough || "Não liberado"}</td><td>{statuses[a.effectiveStatus] || a.effectiveStatus}</td>
        <td><button className="btn sm" onClick={() => { setChosen(a); setActivationPage(1); }}>Gerenciar</button></td></tr>)}
    </tbody></table></div>
    <div className="pager"><span>{meta.total || 0} aplicativo(s) · página {page}</span><div><button className="btn sm" disabled={page <= 1} onClick={() => setPage(x => x - 1)}>Anterior</button>
      <button className="btn sm" disabled={page >= (meta.totalPages || 1)} onClick={() => setPage(x => x + 1)}>Próxima</button></div></div>
    {chosen && <section className="adm-wl-box"><div className="page-head"><div><h3>{chosen.name}</h3><small className="muted mono">{chosen.appKey} · {chosen.partnerName}</small></div>
      <div className="adm-wl-actions"><button className="btn" onClick={() => openEdit(chosen)}>Editar plano</button>
      <button className="btn primary" onClick={() => setPayment({ months: 1, amount: inputAmount(chosen.monthlyFeeCents), reference: "", notes: "" })}>Registrar mensalidade</button>
      <button className="btn sm" onClick={() => setChosen(null)}>Fechar</button></div></div>
      <p><b>Situação:</b> {statuses[chosen.effectiveStatus] || chosen.effectiveStatus} · <b>Válido até:</b> {chosen.paidThrough || "Pendente"} · <b>Aparelhos:</b> {chosen.activeActivations}{chosen.planType === "limited" ? ` / ${chosen.activationLimit}` : " (ilimitados)"}</p>
      <div className="adm-wl-cols"><div><header className="page-head"><h3>URLs do cliente</h3><button className="btn sm" onClick={() => setServerForm({ name: "", baseUrl: "", priority: 0, status: "active" })}>+ Servidor</button></header>
        {servers.map(s => <div className="adm-wl-entry" key={s.id}><div><b>{s.name}</b><small>{s.baseUrl} · {s.status}</small></div><div className="adm-wl-actions"><button className="btn sm" onClick={() => setServerForm(s)}>Editar</button>
          <button className="btn sm danger" onClick={() => { if (window.confirm(`Remover URL ${s.name}?`)) void task(() => api(`${ROOT}/${chosen.id}/servers/${s.id}`, { method: "DELETE" }), "URL removida."); }}>Excluir</button></div></div>)}
        {!servers.length && <p className="muted">O cliente ainda não cadastrou servidores.</p>}</div>
      <div><h3>Pagamentos registrados</h3><p className="muted">Registro manual do superadmin, não confirmação automática do Pix.</p>
        {payments.map(p => <div className="adm-wl-entry" key={p.id}><b>{fmtMoney(p.amountCents)}</b><small>{p.reference} · {p.months} mês(es) · até {p.paidThrough}</small></div>)}
        {!payments.length && <p className="muted">Ainda sem pagamentos.</p>}</div></div>
      <h3 style={{ marginTop: 22 }}>Instalações</h3><div className="table-wrap"><table><thead><tr><th>Plataforma</th><th>Ativado em</th><th>Último uso</th><th>Situação</th><th /></tr></thead><tbody>
        {activations.data?.map(a => <tr key={a.id}><td>{a.platform}</td><td>{new Date(a.activatedAt).toLocaleString("pt-BR")}</td>
          <td>{a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleString("pt-BR") : "—"}</td><td>{a.status}</td><td><button className="btn sm" onClick={() => doActivation(a)}>{a.status === "active" ? "Revogar" : "Restaurar"}</button></td></tr>)}
      </tbody></table></div>
      <div className="pager"><span>Página {activationPage} de {activations.meta?.totalPages || 1}</span><div><button className="btn sm" disabled={activationPage <= 1} onClick={() => setActivationPage(x => x - 1)}>Anterior</button>
        <button className="btn sm" disabled={activationPage >= (activations.meta?.totalPages || 1)} onClick={() => setActivationPage(x => x + 1)}>Próxima</button></div></div>
    </section>}
    {form && <div className="overlay" role="presentation" onMouseDown={e => e.target === e.currentTarget && setForm(null)}><form className="modal adm-wl-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-label="Contrato do aplicativo">
      <header><h3>{form.id ? "Editar aplicativo" : "Novo aplicativo"}</h3><button type="button" className="btn sm" onClick={() => setForm(null)}>Fechar</button></header>
      <div className="modal-body"><label>Cliente contratante</label><PartnerPicker disabled={!!form.id} value={form.partnerId} onChange={partnerId => setForm(x => ({ ...x, partnerId }))}/>
        <div className="row"><label>Nome do aplicativo<input required minLength={2} maxLength={120} value={form.name} onChange={e => setForm(x => ({ ...x, name: e.target.value }))}/></label>
          <label>Chave pública do app<input required disabled={!!form.id} pattern="[a-z][a-z0-9-]{2,63}" value={form.appKey} onChange={e => setForm(x => ({ ...x, appKey: e.target.value.toLowerCase() }))}/></label></div>
        <div className="row"><label>Plano<select value={form.planType} onChange={e => setForm(x => ({ ...x, planType: e.target.value }))}><option value="limited">X ativações</option><option value="unlimited">Ilimitado</option></select></label>
          {form.planType === "limited" && <label>Quantidade de aparelhos<input type="number" min="1" required value={form.activationLimit} onChange={e => setForm(x => ({ ...x, activationLimit: e.target.value }))}/></label>}</div>
        <div className="row"><label>Mensalidade (R$)<input type="number" min="0" step="0.01" required value={form.monthlyFeeCents} onChange={e => setForm(x => ({ ...x, monthlyFeeCents: e.target.value }))}/></label>
          <label>Pago até<input type="date" value={form.paidThrough} onChange={e => setForm(x => ({ ...x, paidThrough: e.target.value }))}/></label></div>
        <label>Situação<select value={form.status} onChange={e => setForm(x => ({ ...x, status: e.target.value }))}><option value="draft">Preparando</option><option value="active">Ativo</option><option value="suspended">Suspenso</option><option value="archived">Arquivado</option></select></label>
        <label>Logo (URL pública)<input type="url" maxLength={500} value={form.logoUrl} onChange={e => setForm(x => ({ ...x, logoUrl: e.target.value }))}/></label>
        <label>Link do aplicativo<input type="url" maxLength={500} value={form.downloadUrl} onChange={e => setForm(x => ({ ...x, downloadUrl: e.target.value }))}/></label>
        <label>Observações<textarea maxLength={2000} rows={3} value={form.notes} onChange={e => setForm(x => ({ ...x, notes: e.target.value }))}/></label>
        <div className="adm-wl-actions"><button className="btn" type="button" onClick={() => setForm(null)}>Cancelar</button><button className="btn primary" disabled={busy || !form.partnerId}>Salvar aplicativo</button></div>
      </div></form></div>}
    {serverForm && <div className="overlay" role="presentation" onMouseDown={e => e.target === e.currentTarget && setServerForm(null)}><form className="modal adm-wl-modal" onSubmit={doServer} role="dialog" aria-modal="true"><header><h3>Servidor Xtream</h3><button type="button" className="btn sm" onClick={() => setServerForm(null)}>Fechar</button></header>
      <div className="modal-body"><label>Nome<input required value={serverForm.name} onChange={e => setServerForm(x => ({ ...x, name: e.target.value }))}/></label>
        <label>URL base<input required type="url" value={serverForm.baseUrl} onChange={e => setServerForm(x => ({ ...x, baseUrl: e.target.value }))}/></label>
        <div className="row"><label>Prioridade<input type="number" min="-1000" max="1000" value={serverForm.priority} onChange={e => setServerForm(x => ({ ...x, priority: e.target.value }))}/></label>
          <label>Situação<select value={serverForm.status} onChange={e => setServerForm(x => ({ ...x, status: e.target.value }))}><option value="active">Ativo</option><option value="disabled">Desativado</option></select></label></div>
        <button className="btn primary" disabled={busy}>Salvar URL</button></div></form></div>}
    {payment && <div className="overlay" role="presentation" onMouseDown={e => e.target === e.currentTarget && setPayment(null)}><form className="modal adm-wl-modal" onSubmit={doPayment} role="dialog" aria-modal="true"><header><h3>Registrar mensalidade recebida</h3><button type="button" className="btn sm" onClick={() => setPayment(null)}>Fechar</button></header>
      <div className="modal-body"><p className="muted">Registre apenas pagamentos externos efetivamente confirmados. O sistema estenderá o vencimento do aplicativo; não processa Pix nesta tela.</p>
        <label>Referência única (comprovante ou identificação)<input required minLength={3} maxLength={120} value={payment.reference} onChange={e => setPayment(x => ({ ...x, reference: e.target.value }))}/></label>
        <div className="row"><label>Meses<input type="number" min="1" max="24" value={payment.months} onChange={e => setPayment(x => ({ ...x, months: e.target.value, amount: inputAmount(chosen.monthlyFeeCents * Number(e.target.value)) }))}/></label>
          <label>Valor recebido (R$)<input type="number" min="0" step="0.01" required value={payment.amount} onChange={e => setPayment(x => ({ ...x, amount: e.target.value }))}/></label></div>
        <label>Observação<input maxLength={500} value={payment.notes} onChange={e => setPayment(x => ({ ...x, notes: e.target.value }))}/></label>
        <button className="btn primary" disabled={busy}>Confirmar recebimento manual</button></div></form></div>}
  </div>;
}
