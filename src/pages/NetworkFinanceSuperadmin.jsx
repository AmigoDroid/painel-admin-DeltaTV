import {useEffect,useState} from 'react';
import {api,downloadNetworkFinanceCsv} from '../api.js';
import {Modal} from '../ui.jsx';
import OneOffChargeModal from './OneOffChargeModal.jsx';
import {blankManualCharge,manualChargeQuote} from './network-finance-form.js';
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n||0)/100);
const date=d=>d?new Date(d).toLocaleString('pt-BR'):'—';
const provider={mercadopago:'Mercado Pago',infinitepay:'InfinitePay'};
export default function NetworkFinanceSuperadmin(){
 const [filters,setFilters]=useState({adminId:'',partnerId:'',kind:'',status:'',provider:'',method:'',fromDate:'',toDate:'',lateOnly:'',earlyOnly:'',manualOnly:'',waiverOnly:''});
 const [page,setPage]=useState(1),[result,setResult]=useState({data:[],meta:{},totals:{},byAdmin:[],byPeriod:[]});
 const [gateways,setGateways]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[cancel,setCancel]=useState(null),[caps,setCaps]=useState(null),[editCaps,setEditCaps]=useState(false);
 const [manualForm,setManualForm]=useState(null),[quote,setQuote]=useState(null),[manualPlans,setManualPlans]=useState([]),[manualPartners,setManualPartners]=useState([]),[oneOff,setOneOff]=useState(false),[oneOffManual,setOneOffManual]=useState(null);
 const field=(key,value)=>{setQuote(null);setManualForm(v=>({...v,[key]:value}));};
 const openManual=async()=>{setBusy(true);setError('');try{
   const selectedAdmin=filters.adminId;
   if(!selectedAdmin){setError('Selecione um Admin no filtro antes de criar cobrança.');return;}
   const [p,pl]=await Promise.all([
     api('/admin/workspace/partners',{query:{adminId:selectedAdmin,page:1,pageSize:100}}),
     api('/admin/workspace/plans',{query:{adminId:selectedAdmin}})]);
   setManualPartners(p.data||[]);setManualPlans(pl.data||[]);
   setManualForm({...blankManualCharge(),adminId:selectedAdmin});setQuote(null);
 }catch(e){setError(e.message)}finally{setBusy(false)}};
 const previewManual=async()=>{setBusy(true);setError('');try{
  const r=await api('/admin/finance-networks/charges/preview',{method:'POST',body:{...manualChargeQuote(manualForm),adminId:manualForm.adminId}});
  setQuote(r);
 }catch(e){setQuote(null);setError(e.message)}finally{setBusy(false)}};
 const createManual=async e=>{e.preventDefault();if(!quote)return;
  setBusy(true);setError('');try{
   await api('/admin/finance-networks/charges',{method:'POST',body:{...manualChargeQuote(manualForm),adminId:manualForm.adminId,method:'manual',previewFingerprint:quote.previewFingerprint}});
   setManualForm(null);setQuote(null);
   const r=await api('/admin/finance-networks/charges',{query:{...params,page:1,pageSize:25}});setResult(r);setPage(1);
  }catch(e){if(e.status===409&&e.details?.quote)setQuote(e.details.quote);else setQuote(null);setError(e.message)}finally{setBusy(false)};
 };
 const params=Object.fromEntries(Object.entries(filters).filter(([,v])=>v));
 useEffect(()=>{let active=true;Promise.all([api('/admin/finance-networks/charges',{query:{...params,page,pageSize:25}}),api('/admin/finance-networks/gateways'),api('/admin/finance-networks/pricing/caps')])
 .then(([r,g,c])=>{if(active){setResult(r);setGateways(g.data||[]);setCaps(c);setError('')}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[JSON.stringify(filters),page]);
 const change=(key,v)=>{setPage(1);setFilters(p=>({...p,[key]:v}))};
 const cancelCharge=async e=>{e.preventDefault();setBusy(true);setError('');try{await api(`/admin/finance-networks/charges/${cancel.id}/cancel`,{method:'POST',body:{reason:cancel.reason}});setCancel(null);setPage(1);const r=await api('/admin/finance-networks/charges',{query:{...params,page:1,pageSize:25}});setResult(r)}catch(e){setError(e.message)}finally{setBusy(false)}};
 const saveCaps=async e=>{e.preventDefault();setBusy(true);setError('');try{const r=await api('/admin/finance-networks/pricing/caps',{method:'PUT',body:caps});setCaps(r);setEditCaps(false)}catch(e){setError(e.message)}finally{setBusy(false)}};
 const exportCsv=async()=>{setBusy(true);setError('');try{await downloadNetworkFinanceCsv(params)}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <div style={{display:'grid',gap:18}}><header><h1>Financeiro das redes</h1><p className="muted">Visão consolidada das cobranças comerciais dos Admins. Sem tokens, dados bancários ou comissões.</p></header>
  {error&&<div className="alert" role="alert" style={{position:'fixed',top:16,right:16,zIndex:10000,maxWidth:'min(95vw,520px)',boxShadow:'0 6px 22px #0003'}}>{error}</div>}
  <section className="card" style={{padding:18}}><h2>Filtros</h2><div style={{display:'flex',flexWrap:'wrap',gap:10}}>
   <label>Admin<select value={filters.adminId} onChange={e=>change('adminId',e.target.value)}><option value="">Todos</option>{gateways.map(g=><option key={g.adminId} value={g.adminId}>{g.adminName}</option>)}</select></label>
   <label>Parceiro (UUID)<input placeholder="UUID" value={filters.partnerId} onChange={e=>change('partnerId',e.target.value)}/></label>
   <label>Tipo<select value={filters.kind} onChange={e=>change('kind',e.target.value)}><option value="">Todos</option><option value="renewal">Renovação</option><option value="upgrade">Upgrade</option><option value="one_off">Avulsa</option></select></label>
   <label>Status<select value={filters.status} onChange={e=>change('status',e.target.value)}><option value="">Todos</option>{['creating','pending','paid','expired','cancelled','failed','review','needs_review'].map(s=><option key={s}>{s}</option>)}</select></label>
   <label>Provedor<select value={filters.provider} onChange={e=>change('provider',e.target.value)}><option value="">Todos</option><option value="mercadopago">Mercado Pago</option><option value="infinitepay">InfinitePay</option></select></label>
   <label>Método<select value={filters.method} onChange={e=>change('method',e.target.value)}><option value="">Todos</option><option value="automatic">Automático</option><option value="manual">Manual</option></select></label>
   <label>Início<input type="date" value={filters.fromDate} onChange={e=>change('fromDate',e.target.value)}/></label>
   <label>Fim<input type="date" value={filters.toDate} onChange={e=>change('toDate',e.target.value)}/></label>
   {[["lateOnly","Em atraso"],["earlyOnly","Com desconto antecipado"],["manualOnly","Com desconto manual"],["waiverOnly","Com abono"]].map(([key,label])=><label key={key}>{label}<select value={filters[key]} onChange={e=>change(key,e.target.value)}><option value="">Todos</option><option value="true">Sim</option><option value="false">Não</option></select></label>)}
  </div><div className="row" style={{gap:12}}><button className="btn" disabled={busy} onClick={exportCsv}>Exportar CSV (até 2.000 linhas)</button>
  <button className="btn primary" disabled={busy||!filters.adminId} onClick={()=>setOneOff(true)}>Emitir cobrança avulsa</button><button className="btn" disabled={busy||!filters.adminId} onClick={openManual}>Conceder ajuste manual</button></div></section>
  <section className="card" style={{padding:18}}><h2>Totais do período e filtros (SQL)</h2><div className="row" style={{gap:20,flexWrap:'wrap'}}><span>Pago <b>{money(result.totals?.paid)}</b></span><span>Pendente <b>{money(result.totals?.pending)}</b></span><span>Expirado <b>{money(result.totals?.expired)}</b></span><span>Multas <b>{money(result.totals?.late_fees)}</b></span><span>Juros <b>{money(result.totals?.interest)}</b></span><span>Descontos <b>{money(result.totals?.discounts)}</b></span><span>Abonos <b>{money(result.totals?.waivers)}</b></span></div></section>
  <section className="card" style={{padding:18}}><h2>Movimentações</h2><div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Admin</th><th>Parceiro</th><th>Tipo e planos</th><th>Valor</th><th>Status</th><th>Provedor/método</th><th>Criação/pagamento</th><th>Referência</th><th></th></tr></thead><tbody>
   {(result.data||[]).map(r=><tr key={r.id}><td>{r.adminName}</td><td>{r.partnerName}</td><td>{r.kind==='one_off'?`Avulsa · ${r.description||'Serviço adicional'}`:`${r.kind==='renewal'?'Renovação':'Upgrade'} · ${r.planFrom||'—'} → ${r.planTo}`}</td><td>{money(r.amountCents)}<details><summary>Composição</summary><div>Base: {money(r.breakdown?.baseCents)}<br/>Multa: {money(r.breakdown?.lateFeeCents)}<br/>Juros: {money(r.breakdown?.interestCents)}<br/>Antecipado: −{money(r.breakdown?.earlyDiscountCents)}<br/>Manual: −{money(r.breakdown?.manualDiscountCents)}<br/>Abono: −{money((r.breakdown?.waiverFeeCents||0)+(r.breakdown?.waiverInterestCents||0))}<br/>Responsável: {r.breakdown?.manual?.actorId||r.breakdown?.waiver?.actorId||'—'}</div></details></td><td>{r.status==='needs_review'?'Precisa de revisão':r.status}</td><td>{r.manualWithoutProviderProof?<strong>Manual (sem comprovação do provedor)</strong>:r.method==='manual'?'Manual':provider[r.provider]||'—'}</td><td>{date(r.createdAt)}<br/>{date(r.paidAt)}</td><td>{r.reference||'—'}</td><td>{r.status==='pending'&&<div className="row" style={{gap:6}}>{r.kind==='one_off'&&r.method==='manual'&&<button className="btn sm" onClick={()=>setOneOffManual({id:r.id,reference:''})}>Confirmar manual</button>}<button className="btn sm" onClick={()=>setCancel({id:r.id,reason:''})}>Cancelar</button></div>}</td></tr>)}
   {!result.data?.length&&<tr><td colSpan={9}>Nenhuma cobrança.</td></tr>}</tbody></table></div><div className="row"><button className="btn" disabled={page<=1} onClick={()=>setPage(v=>v-1)}>Anterior</button><span>Página {page} · {result.meta?.total||0} registros</span><button className="btn" disabled={page*25>=(result.meta?.total||0)} onClick={()=>setPage(v=>v+1)}>Próxima</button></div></section>
  <section className="card" style={{padding:18}}><h2>Totais por Admin</h2><div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Admin</th><th>Pago</th><th>Pendente</th><th>Expirado</th><th>Multas</th><th>Juros</th><th>Descontos</th><th>Abonos</th></tr></thead><tbody>{(result.byAdmin||[]).map(r=><tr key={r.adminId}><td>{r.adminName}</td><td>{money(r.paid)}</td><td>{money(r.pending)}</td><td>{money(r.expired)}</td><td>{money(r.late_fees)}</td><td>{money(r.interest)}</td><td>{money(r.discounts)}</td><td>{money(r.waivers)}</td></tr>)}</tbody></table></div>
   <h2>Totais por mês</h2><table className="table"><thead><tr><th>Período</th><th>Pago</th><th>Pendente</th><th>Expirado</th><th>Multas</th><th>Juros</th><th>Descontos</th><th>Abonos</th></tr></thead><tbody>{(result.byPeriod||[]).map(r=><tr key={r.period}><td>{r.period}</td><td>{money(r.paid)}</td><td>{money(r.pending)}</td><td>{money(r.expired)}</td><td>{money(r.late_fees)}</td><td>{money(r.interest)}</td><td>{money(r.discounts)}</td><td>{money(r.waivers)}</td></tr>)}</tbody></table></section>
  <section className="card" style={{padding:18}}><h2>Tetos da plataforma (somente Superadmin)</h2>{caps&&<p>Multa máxima: {caps.lateFeePct}% · Juros máximos: {caps.interestMonthlyPct}% ao mês. {caps.conditionsText}</p>}
    <button className="btn" onClick={()=>setEditCaps(true)}>Editar tetos e condições</button></section>
  <section className="card" style={{padding:18}}><h2>Gateways ativos (sem credenciais)</h2><div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Admin</th><th>Configurado</th><th>Provedor</th><th>Conta mascarada</th></tr></thead><tbody>{gateways.map(g=><tr key={g.adminId}><td>{g.adminName}</td><td>{g.configured?'Sim':'Não'}</td><td>{provider[g.provider]||'—'}</td><td>{g.accountRefMasked||'—'}</td></tr>)}</tbody></table></div></section>
  {oneOff&&<OneOffChargeModal adminId={filters.adminId} onClose={()=>setOneOff(false)} onCreated={()=>{setOneOff(false);setPage(1);void api('/admin/finance-networks/charges',{query:{...params,page:1,pageSize:25}}).then(setResult).catch(e=>setError(e.message))}}/>}
  {manualForm&&<Modal wide title="Ajuste manual — cobrança da rede selecionada" onClose={()=>{setManualForm(null);setQuote(null)}}>
   <form onSubmit={createManual} style={{display:'grid',gap:12}}>
     <p className="muted">A prévia é obrigatória. Ajustes não modificam cobranças antigas nem dados de outras redes.</p>
     <label>Parceiro<select required value={manualForm.partnerId} onChange={e=>field('partnerId',e.target.value)}><option value="">Selecione</option>{manualPartners.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
     <label>Tipo<select value={manualForm.kind} onChange={e=>field('kind',e.target.value)}><option value="renewal">Renovação</option><option value="upgrade">Upgrade</option></select></label>
     <label>Plano<select required value={manualForm.planTo} onChange={e=>field('planTo',e.target.value)}><option value="">Selecione</option>{manualPlans.filter(p=>p.active&&Number(p.monthlyPriceCents)>0).map(p=><option key={p.key} value={p.key}>{p.name} · {money(p.monthlyPriceCents)}</option>)}</select></label>
     <label>Tipo de desconto<select value={manualForm.manualType} onChange={e=>field('manualType',e.target.value)}><option value="">Sem desconto</option><option value="days">Em dias</option><option value="percent">Percentual</option></select></label>
     {manualForm.manualType&&<><label>Valor do desconto<input type="number" min="1" required step={manualForm.manualType==='days'?'1':'0.01'} value={manualForm.manualValue} onChange={e=>field('manualValue',e.target.value)}/></label>
     <label>Motivo obrigatório para desconto<input required minLength={5} maxLength={300} value={manualForm.manualReason} onChange={e=>field('manualReason',e.target.value)}/></label>
     <label><input type="checkbox" checked={manualForm.stack} onChange={e=>field('stack',e.target.checked)}/> Acumular com desconto antecipado</label></>}
     <label><input type="checkbox" checked={manualForm.waive} onChange={e=>field('waive',e.target.checked)}/> Abonar multa/juros</label>
     {manualForm.waive&&<><label><input type="checkbox" checked={manualForm.waiveAll} onChange={e=>field('waiveAll',e.target.checked)}/> Abono integral</label>
      {!manualForm.waiveAll&&<><label>Multa (R$)<input type="number" min="0" step="0.01" value={manualForm.waiveFee} onChange={e=>field('waiveFee',e.target.value)}/></label>
       <label>Juros (R$)<input type="number" min="0" step="0.01" value={manualForm.waiveInterest} onChange={e=>field('waiveInterest',e.target.value)}/></label></>}
      <label>Motivo obrigatório para abono<input required minLength={5} maxLength={300} value={manualForm.waiveReason} onChange={e=>field('waiveReason',e.target.value)}/></label></>}
     <button type="button" className="btn" disabled={busy||!manualForm.partnerId||!manualForm.planTo||(!!manualForm.manualType&&manualForm.manualReason.trim().length<5)} onClick={previewManual}>Recalcular prévia no servidor</button>
     {quote&&<div role="status" className="notice">Valor previsto: <strong>{money(quote.amountCents)}</strong>.
       <div>Plano/base: {money(quote.breakdown?.baseCents)} · Multa: {money(quote.breakdown?.lateFeeCents)} · Juros: {money(quote.breakdown?.interestCents)}</div>
       <div>Antecipado: −{money(quote.breakdown?.earlyDiscountCents)} · Manual: −{money(quote.breakdown?.manualDiscountCents)} · Abono: −{money((quote.breakdown?.waiverFeeCents||0)+(quote.breakdown?.waiverInterestCents||0))}</div></div>}
     <button className="btn primary" disabled={busy||!quote}>Criar cobrança manual auditada</button>
   </form></Modal>}
  {editCaps&&caps&&<Modal title="Tetos e condições da DeltaTV" onClose={()=>setEditCaps(false)}><form onSubmit={saveCaps} style={{display:'grid',gap:12}}>
    <label>Teto de multa (%)<input type="number" min="0" max="100" step="0.01" value={caps.lateFeePct} onChange={e=>setCaps(v=>({...v,lateFeePct:Number(e.target.value)}))}/></label>
    <label>Teto de juros ao mês (%)<input type="number" min="0" max="100" step="0.01" value={caps.interestMonthlyPct} onChange={e=>setCaps(v=>({...v,interestMonthlyPct:Number(e.target.value)}))}/></label>
    <label>Condições gerais<textarea maxLength={2000} value={caps.conditionsText||''} onChange={e=>setCaps(v=>({...v,conditionsText:e.target.value}))}/></label>
    <button disabled={busy} className="btn primary">Salvar tetos</button></form></Modal>}
  {oneOffManual&&<Modal title="Confirmar recebimento avulso manual" onClose={()=>setOneOffManual(null)}><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await api(`/admin/finance-networks/charges/${oneOffManual.id}/manual`,{method:'POST',body:{reference:oneOffManual.reference}});setOneOffManual(null);setResult(await api('/admin/finance-networks/charges',{query:{...params,page,pageSize:25}}))}catch(err){setError(err.message)}finally{setBusy(false)}}}><p>Sem comprovação do provedor. Informe referência verificável.</p><input minLength={5} maxLength={160} required value={oneOffManual.reference} onChange={e=>setOneOffManual(v=>({...v,reference:e.target.value}))}/><button disabled={busy} className="btn primary">Confirmar com auditoria</button></form></Modal>}
  {cancel&&<Modal title="Cancelar cobrança pendente" onClose={()=>setCancel(null)}><form onSubmit={cancelCharge}><p>O cancelamento é excepcional e ficará registrado na auditoria.</p><label>Motivo<textarea minLength={5} maxLength={500} required value={cancel.reason} onChange={e=>setCancel(p=>({...p,reason:e.target.value}))}/></label><button className="btn primary" disabled={busy}>Confirmar cancelamento</button></form></Modal>}
 </div>;
}
