import { useEffect, useMemo, useState } from 'react';
import { api, getAuth } from '../api.js';
import { Modal } from '../ui.jsx';

const labels={mercadopago:'Mercado Pago',infinitepay:'InfinitePay'};
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n||0)/100);
const day=n=>n?new Date(n).toLocaleString('pt-BR'):'—';
const instructions={
 mercadopago: <ol><li>Entre em <a href="https://www.mercadopago.com.br/developers/pt" target="_blank" rel="noreferrer">Mercado Pago Developers</a> e abra <b>Suas integrações</b>.</li><li>Selecione sua aplicação, abra <b>Credenciais de produção</b> e copie o <b>Access Token</b>.</li><li>Em <b>Webhooks</b>, configure o endereço informado pelo suporte técnico para cobranças da rede e gere a <b>assinatura secreta</b>. Guarde-a apenas aqui.</li></ol>,
 infinitepay: <ol><li>Entre na sua conta <a href="https://www.infinitepay.io/checkout-documentacao" target="_blank" rel="noreferrer">InfinitePay — Checkout Integrado</a>.</li><li>Copie sua <b>InfiniteTag</b> (sem o símbolo $) e obtenha a <b>API Key</b> do Checkout Integrado, que começa com <code>inchk_</code>.</li><li>O teste cria um link de R$ 1,00, sem cobrar ninguém. Não efetue o pagamento desse link.</li></ol>,
};
export default function NetworkFinance(){
 const viewer=getAuth()?.user;
 const granted=new Set(viewer?.delegatedPermissions||[]);
 const canRead=granted.has('network:billing:read');
 const canWrite=granted.has('network:billing:write');
 const canGateways=granted.has('network:gateways:read');
 const canConfigure=granted.has('network:gateways:write');
 const [gateways,setGateways]=useState([]),[charges,setCharges]=useState([]),[totals,setTotals]=useState({}),[meta,setMeta]=useState({}),[page,setPage]=useState(1);
 const [status,setStatus]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [editing,setEditing]=useState(null),[form,setForm]=useState({}),[partners,setPartners]=useState([]),[plans,setPlans]=useState([]);
 const [newCharge,setNewCharge]=useState(null),[manual,setManual]=useState(null),[cancel,setCancel]=useState(null);
 const load=async()=>{
  const [gs,cs]=await Promise.all([canGateways?api('/admin/workspace/finance/gateways'):Promise.resolve({data:[]}),
   canRead?api('/admin/workspace/finance/charges',{query:{page,pageSize:20,status:status||undefined}}):Promise.resolve({data:[]})]);
  setGateways(gs.data||[]);setCharges(cs.data||[]);setMeta(cs.meta||{});setTotals(cs.totals||{});
 };
 useEffect(()=>{let alive=true;Promise.all([canGateways?api('/admin/workspace/finance/gateways'):Promise.resolve({data:[]}),
  canRead?api('/admin/workspace/finance/charges',{query:{page,pageSize:20,status:status||undefined}}):Promise.resolve({data:[]})])
  .then(([gs,cs])=>{if(alive){setGateways(gs.data||[]);setCharges(cs.data||[]);setMeta(cs.meta||{});setTotals(cs.totals||{});setError('');}})
  .catch(e=>{if(alive)setError(e.message)});return()=>{alive=false};},[page,status,canGateways,canRead]);
 const action=async(fn,notice)=>{setBusy(true);setError('');setMessage('');try{await fn();await load();setMessage(notice);return true;}catch(e){setError(e.message||'Falha de operação.');return false;}finally{setBusy(false)}};
 const edit=provider=>{setForm({provider,handle:'',apiKey:'',accessToken:'',webhookSecret:''});setEditing(provider)};
 const save=e=>{e.preventDefault();const {provider}=form;const fields=provider==='mercadopago'?{accessToken:form.accessToken,webhookSecret:form.webhookSecret}:{handle:form.handle,apiKey:form.apiKey};void action(()=>api(`/admin/workspace/finance/gateways/${provider}`,{method:'PUT',body:{provider,...fields}}),'Credenciais salvas. Teste a conexão antes de ativar.').then(ok=>ok&&setEditing(null));};
 const startCharge=async()=>{setError('');try{
  const [p,pl]=await Promise.all([api('/admin/workspace/partners',{query:{pageSize:100,page:1}}),api('/admin/workspace/plans')]);
  setPartners(p.data||[]);setPlans(pl.data||[]);setNewCharge({partnerId:'',kind:'renewal',planTo:'',method:'automatic'});
 }catch(e){setError(e.message)}};
 const create=e=>{e.preventDefault();void action(()=>api('/admin/workspace/finance/charges',{method:'POST',body:newCharge}),'Cobrança criada. O parceiro pode consultar o pagamento na aba Financeiro.').then(ok=>ok&&setNewCharge(null));};
 const providerList=useMemo(()=>['mercadopago','infinitepay'].map(p=>gateways.find(g=>g.provider===p)||{provider:p,configured:false,active:false,tested:false}),[gateways]);
 return <div style={{display:'grid',gap:18}}>
  <header><h1>Recebimentos da minha rede</h1><p className="muted">Os valores vão diretamente para o provedor configurado na sua conta. Não há transferência para a carteira DeltaTV.</p></header>
  {error&&<div className="alert" role="alert">{error}</div>}{message&&<div className="notice" role="status">{message}</div>}
  {canGateways&&<section className="card" style={{padding:20}}><h2>Provedor ativo — selecione apenas um</h2>
   <p className="muted">Trocar de provedor não invalida as cobranças em aberto. As credenciais antigas ficam preservadas enquanto houver pagamento pendente.</p>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:16}}>{providerList.map(g=><div key={g.provider} className="card" style={{padding:16}}>
    <h3>{labels[g.provider]}</h3><p>{g.active?'Ativo':g.configured?'Cadastrado, inativo':'Não cadastrado'}</p><p className="muted">Conta: {g.accountRefMasked||'Não informada'}<br/>Conexão: {g.tested?'Testada':'Teste necessário'}</p>
    <div className="row" style={{flexWrap:'wrap',gap:8}}>{canConfigure&&<><button className="btn" onClick={()=>edit(g.provider)}>Configurar</button>
     <button className="btn" disabled={!g.configured||busy} onClick={()=>action(()=>api(`/admin/workspace/finance/gateways/${g.provider}/test`,{method:'POST'}),'Conexão verificada.')}>Testar conexão</button>
     <button className="btn primary" disabled={!g.configured||!g.tested||g.active||busy} onClick={()=>action(()=>api(`/admin/workspace/finance/gateways/${g.provider}/activate`,{method:'POST'}),'Gateway ativo atualizado.')}>Ativar</button></>}
    </div></div>)}</div></section>}
  {canRead&&<section className="card" style={{padding:20}}><div className="row" style={{justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><h2>Cobranças e movimentações</h2>
   {canWrite&&granted.has('network:plans:read')&&<button className="btn primary" onClick={startCharge}>Nova cobrança</button>}</div>
   <div className="row" style={{flexWrap:'wrap',gap:12}}><label>Status <select value={status} onChange={e=>{setPage(1);setStatus(e.target.value)}}><option value="">Todos</option>{['creating','pending','paid','expired','cancelled','failed','review'].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
   <span>Pago: <strong>{money(totals.paid)}</strong></span><span>Pendente: <strong>{money(totals.pending)}</strong></span><span>Expirado: <strong>{money(totals.expired)}</strong></span></div>
   <div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Parceiro</th><th>Tipo / plano</th><th>Valor</th><th>Status</th><th>Recebimento</th><th>Criado / pago</th><th>Ações</th></tr></thead><tbody>{charges.map(c=><tr key={c.id}><td>{c.partnerName}</td><td>{c.kind==='renewal'?'Renovação':'Upgrade'}: {c.planFrom||'—'} → {c.planTo}</td><td>{money(c.amountCents)}</td><td>{c.status}</td><td>{c.method==='manual'?'Manual (sem comprovação do provedor)':labels[c.provider]||'—'}<br/><small>{c.reference||'—'}</small></td><td>{day(c.createdAt)}<br/>{day(c.paidAt)}</td><td>{c.status==='pending'&&canWrite&&<div className="row" style={{gap:6}}>{c.method==='manual'&&<button className="btn sm" onClick={()=>setManual({id:c.id,reference:''})}>Confirmar manual</button>}<button className="btn sm" onClick={()=>setCancel({id:c.id,reason:''})}>Cancelar</button></div>}</td></tr>)}
   {!charges.length&&<tr><td colSpan={7}>Nenhuma cobrança encontrada.</td></tr>}</tbody></table></div>
   <div className="row"><button className="btn" disabled={page<=1} onClick={()=>setPage(v=>v-1)}>Anterior</button><span>Página {page} · {meta.total||0} registros</span><button className="btn" disabled={page*20>=(meta.total||0)} onClick={()=>setPage(v=>v+1)}>Próxima</button></div>
  </section>}
  {editing&&<Modal title={`Configurar ${labels[editing]}`} onClose={()=>setEditing(null)} wide><form onSubmit={save}><p>Os segredos são armazenados criptografados e nunca são exibidos novamente. Salvar desativa esse provedor até o próximo teste.</p>
   {instructions[editing]}
   {editing==='mercadopago'?<><label className="label">Access Token de produção<input required type="password" autoComplete="off" value={form.accessToken} onChange={e=>setForm(v=>({...v,accessToken:e.target.value}))}/></label><label className="label">Segredo de assinatura do webhook<input required type="password" autoComplete="off" value={form.webhookSecret} onChange={e=>setForm(v=>({...v,webhookSecret:e.target.value}))}/></label></>:
    <><label className="label">InfiniteTag<input required value={form.handle} onChange={e=>setForm(v=>({...v,handle:e.target.value}))}/></label><label className="label">API Key do Checkout Integrado<input required type="password" autoComplete="off" value={form.apiKey} onChange={e=>setForm(v=>({...v,apiKey:e.target.value}))}/></label></>}
   <div className="row"><button className="btn" type="button" onClick={()=>setEditing(null)}>Fechar</button><button className="btn primary" disabled={busy}>Salvar credenciais</button></div></form></Modal>}
  {newCharge&&<Modal title="Nova cobrança da rede" onClose={()=>setNewCharge(null)}><form onSubmit={create} style={{display:'grid',gap:12}}>
    <label>Parceiro<select required value={newCharge.partnerId} onChange={e=>setNewCharge(v=>({...v,partnerId:e.target.value}))}><option value="">Selecione</option>{partners.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Operação<select value={newCharge.kind} onChange={e=>setNewCharge(v=>({...v,kind:e.target.value}))}><option value="renewal">Renovação</option><option value="upgrade">Upgrade</option></select></label>
    <label>Plano<select required value={newCharge.planTo} onChange={e=>setNewCharge(v=>({...v,planTo:e.target.value}))}><option value="">Selecione</option>{plans.filter(p=>p.active&&Number(p.monthlyPriceCents)>0).map(p=><option key={p.key} value={p.key}>{p.name} — {money(p.monthlyPriceCents)}</option>)}</select></label>
    <label>Método<select value={newCharge.method} onChange={e=>setNewCharge(v=>({...v,method:e.target.value}))}><option value="automatic">Automático (gateway ativo)</option><option value="manual">Conferência manual</option></select></label>
    <p className="muted">O preço é consultado novamente no servidor. Somente pagamento confirmado libera o prazo do contrato.</p>
    <button className="btn primary" disabled={busy}>Criar cobrança</button></form></Modal>}
  {manual&&<Modal title="Confirmar recebimento manual" onClose={()=>setManual(null)}><form onSubmit={e=>{e.preventDefault();void action(()=>api(`/admin/workspace/finance/charges/${manual.id}/manual`,{method:'POST',body:{reference:manual.reference}}),'Confirmação manual registrada sem prova do provedor.').then(ok=>ok&&setManual(null))}}>
   <p>Operação sem comprovação do gateway. Registre a referência verificável do recebimento.</p><input required minLength={5} maxLength={160} value={manual.reference} onChange={e=>setManual(v=>({...v,reference:e.target.value}))}/><button disabled={busy} className="btn primary">Confirmar recebimento</button></form></Modal>}
  {cancel&&<Modal title="Cancelar cobrança pendente" onClose={()=>setCancel(null)}><form onSubmit={e=>{e.preventDefault();void action(()=>api(`/admin/workspace/finance/charges/${cancel.id}/cancel`,{method:'POST',body:{reason:cancel.reason}}),'Cancelamento auditado.').then(ok=>ok&&setCancel(null))}}>
   <label>Motivo<textarea required minLength={5} maxLength={500} value={cancel.reason} onChange={e=>setCancel(v=>({...v,reason:e.target.value}))}/></label><button disabled={busy} className="btn primary">Cancelar cobrança</button></form></Modal>}
 </div>;
}
