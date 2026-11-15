import { useEffect, useState } from 'react';
import { api } from '../api.js';
import PartnerPicker from '../PartnerPicker.jsx';
import { fmtDate, Pager } from '../ui.jsx';
import { toCents, formatBRL } from '@deltatv/ui/money';
import './legacy-migration.css';

const TYPES = {
  linked: ['Vinculado', 'ok'], ready: ['Pronto para análise', 'ok'],
  needs_customer: ['Importar cadastro', 'info'], review: ['Revisão obrigatória', 'warn'],
};
export default function LegacyMigration() {
  const [partnerId, setPartnerId] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]), [meta, setMeta] = useState(null), [missingClientRecords, setMissingClientRecords] = useState(0);
  const [selected, setSelected] = useState(null), [details, setDetails] = useState(null);
  const [plans, setPlans] = useState([]), [planId, setPlanId] = useState('');
  const [subscriptionId, setSubscriptionId] = useState(''), [sharedMacConfirmed, setSharedMacConfirmed] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: '', price: '', slots: '1', months: '1' });
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');

  const refresh = async (id = partnerId, p = page) => {
    if (!id) { setItems([]); setMeta(null); return; }
    setLoading(true);
    try {
      const result = await api('/admin/devices/legacy-migration/preview', { query: { partnerId:id, page:p, pageSize:20 } });
      setItems(result.data || []); setMeta(result.meta || null); setMissingClientRecords(Number(result.missingClientRecords || 0)); setError('');
      if (selected) setSelected(prev => result.data?.find(row => row.legacyClientId === prev?.legacyClientId) || prev);
    } catch (e) { setError(e.message || 'Falha ao consultar legados.'); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let cancelled = false;
    if (!partnerId) { setItems([]); setMeta(null); return undefined; }
    setLoading(true);
    api('/admin/devices/legacy-migration/preview', { query:{ partnerId, page, pageSize:20 } })
      .then(result => { if (!cancelled) { setItems(result.data || []); setMeta(result.meta || null); setMissingClientRecords(Number(result.missingClientRecords || 0)); setError(''); } })
      .catch(e => { if (!cancelled) setError(e.message || 'Falha ao consultar legados.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [partnerId, page]);
  const open = async row => {
    setSelected(row); setDetails(null); setSubscriptionId(''); setPlanId(''); setSharedMacConfirmed(false);
    setError(''); setNotice('');
    try {
      const result = await api(`/admin/commerce/plans/${partnerId}`);
      setPlans(result.data || []);
      if (row.commerceCustomerId) {
        const found = await api(`/admin/commerce/customers/${partnerId}/${row.commerceCustomerId}`);
        setDetails(found);
      }
    } catch (e) { setError(e.message || 'Falha ao carregar planos comerciais.'); }
  };
  const run = async action => {
    setBusy(true); setError(''); setNotice('');
    try { await action(); await refresh(); }
    catch(e) { setError(e.message || 'Operação não concluída.'); }
    finally { setBusy(false); }
  };
  const importCustomer = () => run(async () => {
    const result = await api('/admin/devices/legacy-migration/import-customer', {
      method:'POST', body:{ partnerId, legacyClientId:selected.legacyClientId },
    });
    const updated = { ...selected, commerceCustomerId:result.customerId };
    setSelected(updated);
    const found = await api(`/admin/commerce/customers/${partnerId}/${result.customerId}`);
    setDetails(found);
    setNotice(result.imported ? 'Ficha comercial importada sem modificar a licença.' : 'Este cadastro já havia sido importado.');
  });
  const createPlan = () => run(async () => {
    const cents = toCents(newPlan.price);
    if (cents == null) throw Error('Informe um preço comercial válido.');
    const body = {name:newPlan.name.trim(),priceCents:cents,periodMonths:Number(newPlan.months),includedSlots:Number(newPlan.slots),
      billingMode:'prepaid',allowExtra:false,allowResell:false,overageCents:null,graceDays:5};
    const plan = await api(`/admin/commerce/plans/${partnerId}`, {method:'POST',body});
    setPlans(list => [...list, {...body,id:plan.id,active:true}]);
    setPlanId(plan.id);
    setNotice('Plano comercial criado. Nenhuma licença foi emitida.');
  });
  const createSubscription = () => run(async () => {
    if (!selected?.commerceCustomerId || !planId) throw Error('Importe o cliente e selecione um plano.');
    const result = await api(`/admin/commerce/customers/${partnerId}/${selected.commerceCustomerId}/subscriptions`,{
      method:'POST',body:{planId},
    });
    const found = await api(`/admin/commerce/customers/${partnerId}/${selected.commerceCustomerId}`);
    setDetails(found); setSubscriptionId(result.id);
    setNotice('Assinatura criada em rascunho. Confira o acordo comercial antes de aprovar.');
  });
  const approveSubscription = () => run(async () => {
    if (!window.confirm('Confirmar o acordo comercial? Esta ação marca o plano como ativo; NÃO recebe pagamento, NÃO gera licença e NÃO renova a TV.')) return;
    await api(`/admin/commerce/subscriptions/${partnerId}/${subscriptionId}/state`,{
      method:'POST',body:{state:'active',reason:'Migração manual auditada de cadastro legado'},
    });
    const found = await api(`/admin/commerce/customers/${partnerId}/${selected.commerceCustomerId}`);
    setDetails(found);
    setNotice('Plano comercial ativo. A licença da TV permanece inalterada.');
  });
  const link = () => run(async () => {
    if (!window.confirm('Vincular somente a ativação selecionada ao plano? O prazo e o proprietário da licença NÃO serão alterados.')) return;
    await api('/admin/devices/legacy-migration/link-activation', {method:'POST',body:{
      partnerId,legacyClientId:selected.legacyClientId,activationId:selected.activationId,subscriptionId,
      acknowledgeSharedMac:sharedMacConfirmed,acknowledgeNoLicenseChange:true,
    }});
    setNotice('Ativação existente vinculada ao plano comercial. Licença e estoque preservados.');
  });

  const subscriptions = details?.subscriptions || [];
  const chosen = subscriptions.find(s => s.id === subscriptionId);
  const licenseReady = selected && selected.activationCount === 1 && selected.activationStatus === 'active'
    && selected.licenseStatus === 'active' && selected.licenseExpiresAt && new Date(selected.licenseExpiresAt).getTime() > Date.now()
    && (!selected.licenseOwnerPartnerId || selected.licenseOwnerPartnerId === partnerId);
  return <div className="legacy-migration">
    <div className="page-head"><h2>Migração de dispositivos legados</h2></div>
    <p className="muted">Inventário por revenda. Nenhum aparelho será migrado em massa, nenhuma licença será emitida e nenhum vencimento será alterado automaticamente.</p>
    <section className="card">
      <h3>1. Selecione a revenda</h3>
      <PartnerPicker value={partnerId} onChange={id=>{setPartnerId(id);setSelected(null);setPage(1);}} ariaLabel="Selecionar revenda" emptyLabel="Selecionar revenda…" />
      {meta && <p className="muted">{meta.total.toLocaleString('pt-BR')} ficha(s) legada(s) encontrada(s). {missingClientRecords.toLocaleString('pt-BR')} ativação(ões) sem ficha antiga: precisam de cadastro/revisão separados e não entram neste assistente.</p>}
      {loading && <p role="status">Carregando inventário…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {notice && <p className="badge ok" role="status">{notice}</p>}
      <div className="legacy-candidates">{items.map(row => <button type="button" key={row.legacyClientId}
        className={'legacy-candidate'+(selected?.legacyClientId===row.legacyClientId?' selected':'')}
        onClick={()=>open(row)}>
        <strong>{row.name}</strong><span className="mono">{row.mac}</span>
        <span className={'badge '+(TYPES[row.state]?.[1]||'muted')}>{TYPES[row.state]?.[0]||row.state}</span>
        <small>{row.reason}</small>
      </button>)}</div>
      {!loading&&partnerId&&!items.length&&<p className="muted">Não há cadastros antigos nesta página.</p>}
      <Pager meta={meta} onPage={setPage}/>
    </section>
    {selected && <section className="card legacy-detail">
      <div className="page-head"><h3>2. Revisar {selected.name}</h3><button type="button" className="btn" onClick={()=>setSelected(null)}>Fechar</button></div>
      <p>MAC: <strong className="mono">{selected.mac}</strong> · Ativação: {selected.activationStatus||'Não encontrada'} · Licença: {selected.licenseStatus||'Não identificada'} · Vencimento: {fmtDate(selected.licenseExpiresAt)}</p>
      <p className="muted">Aplicativo: {selected.platform || 'desconhecido'} · Versão: {selected.appVersion || 'não informada'} · Tipo de identidade: {selected.identifierType || 'legada'}. Recursos modernos dependem da compatibilidade real da TV.</p>
      <p className="muted">{selected.reason} {Number(selected.otherPartnerCount)>0 && `Este MAC também aparece em ${selected.otherPartnerCount} outra(s) parceria(s).`}</p>
      {selected.linkedSubscriptionId && <p className="badge ok">Este dispositivo já está vinculado comercialmente. Não será migrado de novo.</p>}
      {!selected.commerceCustomerId && <button className="btn primary" disabled={busy} onClick={importCustomer}>Importar ficha comercial (sem licença)</button>}
      {selected.commerceCustomerId && <>
        <h3>3. Plano comercial do cliente</h3>
        <label>Plano disponível <select value={planId} onChange={e=>setPlanId(e.target.value)}><option value="">Selecionar plano para nova assinatura…</option>
          {plans.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name} · {formatBRL(p.priceCents)}</option>)}</select></label>
        <button className="btn" disabled={busy||!planId} onClick={createSubscription}>Criar assinatura em rascunho</button>
        <details className="legacy-create-plan"><summary>Não existe um plano adequado? Cadastrar novo plano comercial</summary>
          <div className="legacy-plan-grid">
            <label>Nome <input value={newPlan.name} onChange={e=>setNewPlan(v=>({...v,name:e.target.value}))}/></label>
            <label>Preço em reais <input inputMode="decimal" value={newPlan.price} onChange={e=>setNewPlan(v=>({...v,price:e.target.value}))}/></label>
            <label>Vagas de TVs <input type="number" min="1" value={newPlan.slots} onChange={e=>setNewPlan(v=>({...v,slots:e.target.value}))}/></label>
            <label>Meses <input type="number" min="1" max="120" value={newPlan.months} onChange={e=>setNewPlan(v=>({...v,months:e.target.value}))}/></label>
          </div><button type="button" disabled={busy||newPlan.name.trim().length<2} className="btn" onClick={createPlan}>Cadastrar plano</button>
        </details>
        <label>Assinatura do cliente <select value={subscriptionId} onChange={e=>setSubscriptionId(e.target.value)}><option value="">Selecione assinatura...</option>
          {subscriptions.map(s=><option key={s.id} value={s.id}>{s.planName} · {s.state} · {s.usedSlots}/{s.slots??'∞'} TV(s)</option>)}</select></label>
        {chosen?.state==='draft' && <button type="button" className="btn" disabled={busy} onClick={approveSubscription}>Aprovar plano comercial (confirmar acordo)</button>}
        {chosen?.state==='active' && <>
          {Number(selected.otherPartnerCount)>0 && <label className="legacy-ack"><input type="checkbox" checked={sharedMacConfirmed} onChange={e=>setSharedMacConfirmed(e.target.checked)}/> Conferi manualmente este vínculo de MAC compartilhado; não misturar os parceiros</label>}
          {!licenseReady && <p className="error">Esta licença não atende aos requisitos para vínculo automático. Faça a revisão antes de continuar.</p>}
          <button type="button" className="btn primary" disabled={busy||!licenseReady||!!selected.linkedSubscriptionId||(Number(selected.otherPartnerCount)>0&&!sharedMacConfirmed)} onClick={link}>
            Vincular licença existente ao plano
          </button>
        </>}
      </>}
      <p className="muted">O novo plano é comercial; o acesso da TV continua sendo decidido pelo licenciamento técnico já existente.</p>
    </section>}
  </div>;
}
