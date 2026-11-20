import {useEffect,useState} from 'react';
import {api,downloadNetworkFinanceCsv} from '../api.js';
import {Modal} from '../ui.jsx';
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n||0)/100);
const date=d=>d?new Date(d).toLocaleString('pt-BR'):'—';
const provider={mercadopago:'Mercado Pago',infinitepay:'InfinitePay'};
export default function NetworkFinanceSuperadmin(){
 const [filters,setFilters]=useState({adminId:'',partnerId:'',kind:'',status:'',provider:'',method:'',fromDate:'',toDate:''});
 const [page,setPage]=useState(1),[result,setResult]=useState({data:[],meta:{},totals:{},byAdmin:[],byPeriod:[]});
 const [gateways,setGateways]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[cancel,setCancel]=useState(null);
 const params=Object.fromEntries(Object.entries(filters).filter(([,v])=>v));
 useEffect(()=>{let active=true;Promise.all([api('/admin/finance-networks/charges',{query:{...params,page,pageSize:25}}),api('/admin/finance-networks/gateways')])
 .then(([r,g])=>{if(active){setResult(r);setGateways(g.data||[]);setError('')}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[JSON.stringify(filters),page]);
 const change=(key,v)=>{setPage(1);setFilters(p=>({...p,[key]:v}))};
 const cancelCharge=async e=>{e.preventDefault();setBusy(true);setError('');try{await api(`/admin/finance-networks/charges/${cancel.id}/cancel`,{method:'POST',body:{reason:cancel.reason}});setCancel(null);setPage(1);const r=await api('/admin/finance-networks/charges',{query:{...params,page:1,pageSize:25}});setResult(r)}catch(e){setError(e.message)}finally{setBusy(false)}};
 const exportCsv=async()=>{setBusy(true);setError('');try{await downloadNetworkFinanceCsv(params)}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <div style={{display:'grid',gap:18}}><header><h1>Financeiro das redes</h1><p className="muted">Visão consolidada das cobranças comerciais dos Admins. Sem tokens, dados bancários ou comissões.</p></header>
  {error&&<div className="alert" role="alert">{error}</div>}
  <section className="card" style={{padding:18}}><h2>Filtros</h2><div style={{display:'flex',flexWrap:'wrap',gap:10}}>
   <label>Admin<select value={filters.adminId} onChange={e=>change('adminId',e.target.value)}><option value="">Todos</option>{gateways.map(g=><option key={g.adminId} value={g.adminId}>{g.adminName}</option>)}</select></label>
   <label>Parceiro (UUID)<input placeholder="UUID" value={filters.partnerId} onChange={e=>change('partnerId',e.target.value)}/></label>
   <label>Tipo<select value={filters.kind} onChange={e=>change('kind',e.target.value)}><option value="">Todos</option><option value="renewal">Renovação</option><option value="upgrade">Upgrade</option></select></label>
   <label>Status<select value={filters.status} onChange={e=>change('status',e.target.value)}><option value="">Todos</option>{['creating','pending','paid','expired','cancelled','failed','review'].map(s=><option key={s}>{s}</option>)}</select></label>
   <label>Provedor<select value={filters.provider} onChange={e=>change('provider',e.target.value)}><option value="">Todos</option><option value="mercadopago">Mercado Pago</option><option value="infinitepay">InfinitePay</option></select></label>
   <label>Método<select value={filters.method} onChange={e=>change('method',e.target.value)}><option value="">Todos</option><option value="automatic">Automático</option><option value="manual">Manual</option></select></label>
   <label>Início<input type="date" value={filters.fromDate} onChange={e=>change('fromDate',e.target.value)}/></label>
   <label>Fim<input type="date" value={filters.toDate} onChange={e=>change('toDate',e.target.value)}/></label>
  </div><button className="btn" disabled={busy} onClick={exportCsv}>Exportar CSV (até 2.000 linhas)</button></section>
  <section className="card" style={{padding:18}}><h2>Totais do período e filtros (SQL)</h2><div className="row" style={{gap:20,flexWrap:'wrap'}}><span>Pago <b>{money(result.totals?.paid)}</b></span><span>Pendente <b>{money(result.totals?.pending)}</b></span><span>Expirado <b>{money(result.totals?.expired)}</b></span></div></section>
  <section className="card" style={{padding:18}}><h2>Movimentações</h2><div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Admin</th><th>Parceiro</th><th>Tipo e planos</th><th>Valor</th><th>Status</th><th>Provedor/método</th><th>Criação/pagamento</th><th>Referência</th><th></th></tr></thead><tbody>
   {(result.data||[]).map(r=><tr key={r.id}><td>{r.adminName}</td><td>{r.partnerName}</td><td>{r.kind==='renewal'?'Renovação':'Upgrade'} · {r.planFrom||'—'} → {r.planTo}</td><td>{money(r.amountCents)}</td><td>{r.status}</td><td>{r.manualWithoutProviderProof?<strong>Manual (sem comprovação do provedor)</strong>:r.method==='manual'?'Manual':provider[r.provider]||'—'}</td><td>{date(r.createdAt)}<br/>{date(r.paidAt)}</td><td>{r.reference||'—'}</td><td>{r.status==='pending'&&<button className="btn sm" onClick={()=>setCancel({id:r.id,reason:''})}>Cancelar</button>}</td></tr>)}
   {!result.data?.length&&<tr><td colSpan={9}>Nenhuma cobrança.</td></tr>}</tbody></table></div><div className="row"><button className="btn" disabled={page<=1} onClick={()=>setPage(v=>v-1)}>Anterior</button><span>Página {page} · {result.meta?.total||0} registros</span><button className="btn" disabled={page*25>=(result.meta?.total||0)} onClick={()=>setPage(v=>v+1)}>Próxima</button></div></section>
  <section className="card" style={{padding:18}}><h2>Totais por Admin</h2><div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Admin</th><th>Pago</th><th>Pendente</th><th>Expirado</th></tr></thead><tbody>{(result.byAdmin||[]).map(r=><tr key={r.adminId}><td>{r.adminName}</td><td>{money(r.paid)}</td><td>{money(r.pending)}</td><td>{money(r.expired)}</td></tr>)}</tbody></table></div>
   <h2>Totais por mês</h2><table className="table"><thead><tr><th>Período</th><th>Pago</th><th>Pendente</th><th>Expirado</th></tr></thead><tbody>{(result.byPeriod||[]).map(r=><tr key={r.period}><td>{r.period}</td><td>{money(r.paid)}</td><td>{money(r.pending)}</td><td>{money(r.expired)}</td></tr>)}</tbody></table></section>
  <section className="card" style={{padding:18}}><h2>Gateways ativos (sem credenciais)</h2><div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Admin</th><th>Configurado</th><th>Provedor</th><th>Conta mascarada</th></tr></thead><tbody>{gateways.map(g=><tr key={g.adminId}><td>{g.adminName}</td><td>{g.configured?'Sim':'Não'}</td><td>{provider[g.provider]||'—'}</td><td>{g.accountRefMasked||'—'}</td></tr>)}</tbody></table></div></section>
  {cancel&&<Modal title="Cancelar cobrança pendente" onClose={()=>setCancel(null)}><form onSubmit={cancelCharge}><p>O cancelamento é excepcional e ficará registrado na auditoria.</p><label>Motivo<textarea minLength={5} maxLength={500} required value={cancel.reason} onChange={e=>setCancel(p=>({...p,reason:e.target.value}))}/></label><button className="btn primary" disabled={busy}>Confirmar cancelamento</button></form></Modal>}
 </div>;
}
