import { useEffect, useMemo, useState } from 'react';
import { api, getAuth } from '../api.js';
import { Modal } from '../ui.jsx';
import OneOffChargeModal from './OneOffChargeModal.jsx';

const labels={mercadopago:'Mercado Pago',infinitepay:'InfinitePay'};
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n||0)/100);
const day=n=>n?new Date(n).toLocaleString('pt-BR'):'—';
const localInput=v=>v?new Date(v).toLocaleString('sv-SE',{timeZone:'America/Sao_Paulo'}).replace(' ','T').slice(0,16):'';
const snapshotLines=b=>b?<ul style={{margin:'6px 0',paddingLeft:22}}>
 <li>Plano/base: {money(b.baseCents)}</li>{b.earlyDiscountCents>0&&<li>Desconto antecipado: −{money(b.earlyDiscountCents)}</li>}
 {b.manualDiscountCents>0&&<li>Desconto manual: −{money(b.manualDiscountCents)}</li>}
 {b.lateFeeCents>0&&<li>Multa {b.lateFeePct}%: {money(b.lateFeeCents)}</li>}
 {b.interestCents>0&&<li>Juros {b.daysLate} dia(s): {money(b.interestCents)}</li>}
 {(b.waiverFeeCents+b.waiverInterestCents)>0&&<li>Abono: −{money(b.waiverFeeCents+b.waiverInterestCents)}</li>}
 <li><strong>Total: {money(b.totalCents)}</strong></li></ul>:null;
const quoteBody=v=>({partnerId:v.partnerId,kind:v.kind,planTo:v.planTo,
 ...(v.manualType?{manualDiscount:{type:v.manualType,value:Number(v.manualValue),stack:Boolean(v.stack),reason:v.manualReason||''}}:{}),
 ...(v.waive?{waiver:{full:Boolean(v.waiveAll),lateFeeCents:Math.round(Number(v.waiveFee||0)*100),
   interestCents:Math.round(Number(v.waiveInterest||0)*100),reason:v.waiveReason||''}}:{})});
const instructions={
 mercadopago: <ol><li>Entre em <a href="https://www.mercadopago.com.br/developers/pt" target="_blank" rel="noreferrer">Mercado Pago Developers</a> e abra <b>Suas integrações</b>.</li><li>Selecione sua aplicação, abra <b>Credenciais de produção</b> e copie o <b>Access Token</b>.</li><li>Em <b>Webhooks</b> na integração de produção, gere a <b>assinatura secreta</b> e salve-a aqui. O backend envia automaticamente a <code>notification_url</code> específica de cada cobrança, em HTTPS. Não cadastre um URL genérico sem o identificador do pagamento.</li><li>Quando houver notificação, o sistema verifica a assinatura <code>x-signature</code>, reconsulta o pagamento e confere valor, Pix, recebedor e referência. Uma URL acessível, sozinha, não confirma o pagamento.</li></ol>,
 infinitepay: <ol><li>Entre na sua conta <a href="https://www.infinitepay.io/checkout-documentacao" target="_blank" rel="noreferrer">InfinitePay — Checkout Integrado</a>.</li><li>Copie sua <b>InfiniteTag</b> (sem o símbolo $) e obtenha a <b>API Key</b> do Checkout Integrado, que começa com <code>inchk_</code>.</li><li>A cada cobrança, o servidor envia <code>webhook_url</code> no pedido do link. A InfinitePay não exige cadastrar a URL separadamente. O aviso não é assinado; a confirmação sempre exige consulta <code>payment_check</code> com os identificadores corretos.</li><li>O teste cria um link real de R$ 1,00, sem cobrar ninguém até que seja pago. Não efetue esse pagamento.</li></ol>,
};
export default function NetworkFinance(){
 const viewer=getAuth()?.user;
 const granted=new Set(viewer?.delegatedPermissions||[]);
 const canRead=granted.has('network:billing:read');
 const canWrite=granted.has('network:billing:write');
 const canGateways=granted.has('network:gateways:read')||granted.has('network:gateways:write');
 const canConfigure=granted.has('network:gateways:write');
 const [gateways,setGateways]=useState([]),[charges,setCharges]=useState([]),[totals,setTotals]=useState({}),[meta,setMeta]=useState({}),[page,setPage]=useState(1);
 const [status,setStatus]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [editing,setEditing]=useState(null),[form,setForm]=useState({}),[partners,setPartners]=useState([]),[plans,setPlans]=useState([]);
 const [newCharge,setNewCharge]=useState(null),[manual,setManual]=useState(null),[cancel,setCancel]=useState(null),[oneOff,setOneOff]=useState(false);
 const [billingSettings,setBillingSettings]=useState(null),[editSettings,setEditSettings]=useState(false),[preview,setPreview]=useState(null),[webhookInfo,setWebhookInfo]=useState(null);
 const load=async()=>{
  const [gs,cs,bs]=await Promise.all([canGateways?api('/admin/workspace/finance/gateways'):Promise.resolve({data:[]}),
   canRead?api('/admin/workspace/finance/charges',{query:{page,pageSize:20,status:status||undefined}}):Promise.resolve({data:[]}),
   canRead?api('/admin/workspace/finance/pricing/settings'):Promise.resolve(null)]);
  setGateways(gs.data||[]);setCharges(cs.data||[]);setMeta(cs.meta||{});setTotals(cs.totals||{});if(bs)setBillingSettings(bs);
 };
 useEffect(()=>{let alive=true;Promise.all([canGateways?api('/admin/workspace/finance/gateways'):Promise.resolve({data:[]}),
  canRead?api('/admin/workspace/finance/charges',{query:{page,pageSize:20,status:status||undefined}}):Promise.resolve({data:[]}),
  canRead?api('/admin/workspace/finance/pricing/settings'):Promise.resolve(null)])
  .then(([gs,cs,bs])=>{if(alive){setGateways(gs.data||[]);setCharges(cs.data||[]);setMeta(cs.meta||{});setTotals(cs.totals||{});if(bs)setBillingSettings(bs);setError('');}})
  .catch(e=>{if(alive)setError(e.message)});return()=>{alive=false};},[page,status,canGateways,canRead]);
 const action=async(fn,notice)=>{setBusy(true);setError('');setMessage('');try{await fn();await load();setMessage(notice);return true;}catch(e){setError(e.message||'Falha de operação.');return false;}finally{setBusy(false)}};
 const edit=provider=>{setForm({provider,handle:'',apiKey:'',accessToken:'',webhookSecret:''});setEditing(provider)};
 const save=e=>{e.preventDefault();const {provider}=form;const fields=provider==='mercadopago'?{accessToken:form.accessToken,webhookSecret:form.webhookSecret}:{handle:form.handle,apiKey:form.apiKey};void action(()=>api(`/admin/workspace/finance/gateways/${provider}`,{method:'PUT',body:{provider,...fields}}),'Credenciais salvas. Teste a conexão antes de ativar.').then(ok=>ok&&setEditing(null));};
 const startCharge=async()=>{setError('');try{
  const [p,pl]=await Promise.all([api('/admin/workspace/partners',{query:{pageSize:100,page:1}}),api('/admin/workspace/plans')]);
  setPartners(p.data||[]);setPlans(pl.data||[]);setPreview(null);setNewCharge({partnerId:'',kind:'renewal',planTo:'',method:'automatic',manualType:'',manualValue:'',manualReason:'',stack:false,waive:false,waiveAll:true,waiveReason:'',waiveFee:0,waiveInterest:0});
 }catch(e){setError(e.message)}};
 const changeCharge=(key,value)=>{setPreview(null);setNewCharge(v=>({...v,[key]:value}))};
 const previewCharge=async()=>{setBusy(true);setError('');try{const q=await api('/admin/workspace/finance/charges/preview',{method:'POST',body:quoteBody(newCharge)});setPreview(q)}catch(e){setError(e.message)}finally{setBusy(false)}};
 const create=async e=>{e.preventDefault();if(!preview){setError('Faça a prévia antes de criar a cobrança.');return;}
  setBusy(true);setError('');try{
   await api('/admin/workspace/finance/charges',{method:'POST',body:{...quoteBody(newCharge),method:newCharge.method,previewFingerprint:preview.previewFingerprint}});
   setNewCharge(null);setPreview(null);await load();setMessage('Cobrança criada. O parceiro pode consultar o pagamento na aba Financeiro.');
  }catch(err){if(err.status===409&&err.details?.quote)setPreview(err.details.quote);
   else setPreview(null);setError(err.message||'Falha ao criar cobrança.');}finally{setBusy(false)} };
 const saveBilling=e=>{e.preventDefault();if(!billingSettings)return;const v=billingSettings.settings;
   const {defaultDiscountDays:_unusedDiscountDays,shortCycleDays:_unusedShortCycle,...effective}=v;
   const normalize={...effective,earlyPlanKeys:Array.isArray(v.earlyPlanKeys)?v.earlyPlanKeys: String(v.earlyPlanKeys||'').split(',').map(x=>x.trim()).filter(Boolean),
     earlyStartsAt:v.earlyStartsAt?new Date(`${localInput(v.earlyStartsAt)}:00-03:00`).toISOString():null,
     earlyEndsAt:v.earlyEndsAt?new Date(`${localInput(v.earlyEndsAt)}:00-03:00`).toISOString():null};
   void action(()=>api('/admin/workspace/finance/pricing/settings',{method:'PUT',body:normalize}),'Regras de cobrança atualizadas.').then(ok=>ok&&setEditSettings(false));};
 useEffect(()=>{if(!canGateways)return;let active=true;
  api('/admin/workspace/finance/gateways/webhook-info').then(info=>{if(active)setWebhookInfo(info)}).catch(()=>{});
  return()=>{active=false};
 },[canGateways]);
 const providerList=useMemo(()=>['mercadopago','infinitepay'].map(p=>gateways.find(g=>g.provider===p)||{provider:p,configured:false,active:false,tested:false}),[gateways]);
 return <div style={{display:'grid',gap:18}}>
  <header><h1>Recebimentos da minha rede</h1><p className="muted">Os valores vão diretamente para o provedor configurado na sua conta. Não há transferência para a carteira DeltaTV.</p></header>
  {error&&<div className="alert" role="alert" style={{position:'fixed',top:16,right:16,zIndex:10000,maxWidth:'min(95vw,520px)',boxShadow:'0 6px 22px #0003'}}>{error}</div>}{message&&<div className="notice" role="status">{message}</div>}
  {!canGateways&&<div className="notice" role="status">Para visualizar e configurar Mercado Pago ou InfinitePay, solicite à DeltaTV a permissão de gateways desta rede.</div>}
  {canGateways&&<section className="card" style={{padding:20}}><h2>Provedor ativo — selecione apenas um</h2>
   <p className="muted">Trocar de provedor não invalida as cobranças em aberto. As credenciais antigas ficam preservadas enquanto houver pagamento pendente.</p>
   <div className="notice"><strong>Webhooks</strong><p>Mercado Pago: em <b>Suas integrações → Webhooks → Produção</b>, cadastre a URL abaixo no evento <b>Pagamentos</b>. Depois copie a assinatura secreta para Configurar Mercado Pago. A plataforma também informa automaticamente a URL específica em cada Pix.</p>
    {webhookInfo?.mercadopagoUrl&&<label>URL pública do Mercado Pago<input readOnly value={webhookInfo.mercadopagoUrl} onFocus={e=>e.target.select()}/></label>}
    <p>InfinitePay: nenhuma URL fixa precisa ser cadastrada. O backend informa o webhook na criação de cada checkout e confirma o recebimento por <code>payment_check</code>.</p>
    <small>O teste de conexão do gateway NÃO testa entrega de webhook. Confirme também uma cobrança controlada e o registro de pagamento.</small></div>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(250px,1fr))',gap:16}}>{providerList.map(g=><div key={g.provider} className="card" style={{padding:16}}>
    <h3>{labels[g.provider]}</h3><p>{g.active?'Ativo':g.configured?'Cadastrado, inativo':'Não cadastrado'}</p><p className="muted">Conta: {g.accountRefMasked||'Não informada'}<br/>Conexão: {g.tested?'Testada':'Teste necessário'}</p>
    <div className="row" style={{flexWrap:'wrap',gap:8}}>{canConfigure&&<><button className="btn" onClick={()=>edit(g.provider)}>Configurar</button>
     <button className="btn" disabled={!g.configured||busy} onClick={()=>action(()=>api(`/admin/workspace/finance/gateways/${g.provider}/test`,{method:'POST'}),'Conexão verificada.')}>Testar conexão</button>
     <button className="btn primary" disabled={!g.configured||!g.tested||g.active||busy} onClick={()=>action(()=>api(`/admin/workspace/finance/gateways/${g.provider}/activate`,{method:'POST'}),'Gateway ativo atualizado.')}>Ativar</button></>}
    </div></div>)}</div></section>}
  {canRead&&billingSettings&&<section className="card" style={{padding:20}}>
    <div className="row" style={{justifyContent:'space-between',flexWrap:'wrap'}}><h2>Multa, juros e descontos</h2>{canWrite&&<button className="btn" onClick={()=>setEditSettings(true)}>Configurar regras</button>}</div>
    <p>Multa: {billingSettings.settings.lateFeeEnabled?billingSettings.settings.lateFeePct:0}% · Juros: {billingSettings.settings.interestMonthlyPct}% ao mês · Tolerância: {billingSettings.settings.toleranceDays} dia(s).</p>
    <p>Exemplo numérico — plano R$ 50,00, 6 dias em atraso: <strong>{money(5000+(billingSettings.settings.lateFeeEnabled&&6>billingSettings.settings.toleranceDays?Math.round(5000*billingSettings.settings.lateFeePct/100)+Math.round(5000*billingSettings.settings.interestMonthlyPct*6/3000):0))}</strong>. O valor definitivo é sempre calculado no servidor.</p>
    <p className="muted">Teto DeltaTV: multa {billingSettings.caps.lateFeePct}% e juros {billingSettings.caps.interestMonthlyPct}% ao mês. Desconto antecipado: {billingSettings.settings.earlyDiscountEnabled?'Ativo':'Desativado'}.</p>
   </section>}
  {canRead&&<section className="card" style={{padding:20}}><div className="row" style={{justifyContent:'space-between',gap:10,flexWrap:'wrap'}}><h2>Cobranças e movimentações</h2>
   {canWrite&&<div className="row" style={{gap:8}}>{granted.has('network:plans:read')&&<button className="btn" onClick={startCharge}>Renovar / Upgrade</button>}<button className="btn primary" onClick={()=>setOneOff(true)}>Cobrança avulsa</button></div>}</div>
   <div className="row" style={{flexWrap:'wrap',gap:12}}><label>Status <select value={status} onChange={e=>{setPage(1);setStatus(e.target.value)}}><option value="">Todos</option>{['creating','pending','paid','expired','cancelled','failed','review','needs_review'].map(s=><option key={s} value={s}>{s}</option>)}</select></label>
   <span>Pago: <strong>{money(totals.paid)}</strong></span><span>Pendente: <strong>{money(totals.pending)}</strong></span><span>Expirado: <strong>{money(totals.expired)}</strong></span></div>
   <div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>Parceiro</th><th>Tipo / plano</th><th>Valor</th><th>Status</th><th>Recebimento</th><th>Criado / pago</th><th>Ações</th></tr></thead><tbody>{charges.map(c=><tr key={c.id}><td>{c.partnerName}</td><td>{c.kind==='one_off'?`Avulsa: ${c.description||'Serviço adicional'}`:`${c.kind==='renewal'?'Renovação':'Upgrade'}: ${c.planFrom||'—'} → ${c.planTo}`}</td><td>{money(c.amountCents)}{snapshotLines(c.breakdown)}</td><td>{c.status==='needs_review'?'Precisa de revisão':c.status}</td><td>{c.method==='manual'?'Manual (sem comprovação do provedor)':labels[c.provider]||'—'}<br/><small>{c.reference||'—'}</small></td><td>{day(c.createdAt)}<br/>{day(c.paidAt)}</td><td>{c.status==='pending'&&canWrite&&<div className="row" style={{gap:6}}>{c.method==='manual'&&<button className="btn sm" onClick={()=>setManual({id:c.id,reference:''})}>Confirmar manual</button>}<button className="btn sm" onClick={()=>setCancel({id:c.id,reason:''})}>Cancelar</button></div>}</td></tr>)}
   {!charges.length&&<tr><td colSpan={7}>Nenhuma cobrança encontrada.</td></tr>}</tbody></table></div>
   <div className="row"><button className="btn" disabled={page<=1} onClick={()=>setPage(v=>v-1)}>Anterior</button><span>Página {page} · {meta.total||0} registros</span><button className="btn" disabled={page*20>=(meta.total||0)} onClick={()=>setPage(v=>v+1)}>Próxima</button></div>
  </section>}
  {oneOff&&<OneOffChargeModal onClose={()=>setOneOff(false)} onCreated={()=>{setOneOff(false);void load();setMessage('Cobrança avulsa emitida.')}}/>}
  {editing&&<Modal title={`Configurar ${labels[editing]}`} onClose={()=>setEditing(null)} wide><form onSubmit={save}><p>Os segredos são armazenados criptografados e nunca são exibidos novamente. Salvar desativa esse provedor até o próximo teste.</p>
   {instructions[editing]}
   {editing==='mercadopago'?<><label className="label">Access Token de produção<input required type="password" autoComplete="off" value={form.accessToken} onChange={e=>setForm(v=>({...v,accessToken:e.target.value}))}/></label><label className="label">Segredo de assinatura do webhook<input required type="password" autoComplete="off" value={form.webhookSecret} onChange={e=>setForm(v=>({...v,webhookSecret:e.target.value}))}/></label></>:
    <><label className="label">InfiniteTag<input required value={form.handle} onChange={e=>setForm(v=>({...v,handle:e.target.value}))}/></label><label className="label">API Key do Checkout Integrado<input required type="password" autoComplete="off" value={form.apiKey} onChange={e=>setForm(v=>({...v,apiKey:e.target.value}))}/></label></>}
   <div className="row"><button className="btn" type="button" onClick={()=>setEditing(null)}>Fechar</button><button className="btn primary" disabled={busy}>Salvar credenciais</button></div></form></Modal>}
  {newCharge&&<Modal title="Nova cobrança da rede" onClose={()=>{setNewCharge(null);setPreview(null)}} wide><form onSubmit={create} style={{display:'grid',gap:12}}>
    <label>Parceiro<select required value={newCharge.partnerId} onChange={e=>changeCharge('partnerId',e.target.value)}><option value="">Selecione</option>{partners.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <label>Operação<select value={newCharge.kind} onChange={e=>changeCharge('kind',e.target.value)}><option value="renewal">Renovação</option><option value="upgrade">Upgrade</option></select></label>
    <label>Plano<select required value={newCharge.planTo} onChange={e=>changeCharge('planTo',e.target.value)}><option value="">Selecione</option>{plans.filter(p=>p.active&&Number(p.monthlyPriceCents)>0).map(p=><option key={p.key} value={p.key}>{p.name} — {money(p.monthlyPriceCents)}</option>)}</select></label>
    <label>Método<select value={newCharge.method} onChange={e=>changeCharge('method',e.target.value)}><option value="automatic">Automático (gateway ativo)</option><option value="manual">Conferência manual</option></select></label>
    <label>Desconto manual<select value={newCharge.manualType} onChange={e=>changeCharge('manualType',e.target.value)}><option value="">Nenhum</option><option value="days">Dias</option><option value="percent">Percentual</option></select></label>
    {newCharge.manualType&&<><label>{newCharge.manualType==='days'?'Quantidade de dias':'Percentual (1–100)'}<input type="number" min="1" step={newCharge.manualType==='days'?'1':'0.01'} required value={newCharge.manualValue} onChange={e=>changeCharge('manualValue',e.target.value)}/></label>
      <label>Motivo (opcional)<input maxLength={300} value={newCharge.manualReason} onChange={e=>changeCharge('manualReason',e.target.value)}/></label>
      <label><input type="checkbox" checked={newCharge.stack} onChange={e=>changeCharge('stack',e.target.checked)}/> Acumular com desconto antecipado</label></>}
    <label><input type="checkbox" checked={newCharge.waive} onChange={e=>changeCharge('waive',e.target.checked)}/> Abonar multa ou juros</label>
    {newCharge.waive&&<><label><input type="checkbox" checked={newCharge.waiveAll} onChange={e=>changeCharge('waiveAll',e.target.checked)}/> Abonar todos os encargos</label>
      {!newCharge.waiveAll&&<><label>Abono multa (R$)<input type="number" step="0.01" min="0" value={newCharge.waiveFee} onChange={e=>changeCharge('waiveFee',e.target.value)}/></label>
      <label>Abono juros (R$)<input type="number" step="0.01" min="0" value={newCharge.waiveInterest} onChange={e=>changeCharge('waiveInterest',e.target.value)}/></label></>}
      <label>Motivo obrigatório<input required minLength={5} maxLength={300} value={newCharge.waiveReason} onChange={e=>changeCharge('waiveReason',e.target.value)}/></label></>}
    <button className="btn" type="button" disabled={busy||!newCharge.partnerId||!newCharge.planTo} onClick={previewCharge}>Recalcular prévia no servidor</button>
    {preview&&<section role="status" className="notice"><h3>Conta detalhada</h3>{snapshotLines(preview.breakdown)}<p>{preview.conditions}</p><p>Se o dia virar ou a regra mudar, será exigida uma nova prévia.</p></section>}
    <button className="btn primary" disabled={busy||!preview}>Criar cobrança com valor confirmado</button></form></Modal>}
  {editSettings&&billingSettings&&<Modal title="Regras de cobrança da minha rede" onClose={()=>setEditSettings(false)} wide><form onSubmit={saveBilling} style={{display:'grid',gap:10}}>
    <p>Tetos definidos pela DeltaTV: multa {billingSettings.caps.lateFeePct}% e juros {billingSettings.caps.interestMonthlyPct}% ao mês.</p>
    <label><input type="checkbox" checked={billingSettings.settings.lateFeeEnabled} onChange={e=>setBillingSettings(v=>({...v,settings:{...v.settings,lateFeeEnabled:e.target.checked}}))}/> Aplicar encargos por atraso</label>
    {[["lateFeePct","Multa única (%)",'0.01',billingSettings.caps.lateFeePct],["interestMonthlyPct","Juros simples ao mês (%)",'0.01',billingSettings.caps.interestMonthlyPct],["toleranceDays","Dias de tolerância",'1',10],["minChargeCents","Cobrança mínima (centavos)",'1',100000000],["earlyMinDaysBefore","Antecedência mínima (dias)",'1',3660]].map(([key,title,step,max])=><label key={key}>{title}<input type="number" min={key==='minChargeCents'?1:0} max={max} step={step} value={billingSettings.settings[key]??0} onChange={e=>setBillingSettings(v=>({...v,settings:{...v.settings,[key]:Number(e.target.value)}}))}/></label>)}
    <label><input type="checkbox" checked={billingSettings.settings.earlyDiscountEnabled} onChange={e=>setBillingSettings(v=>({...v,settings:{...v.settings,earlyDiscountEnabled:e.target.checked}}))}/> Desconto antecipado programado</label>
    <label>Tipo de desconto<select value={billingSettings.settings.earlyDiscountType} onChange={e=>setBillingSettings(v=>({...v,settings:{...v.settings,earlyDiscountType:e.target.value}}))}><option value="percent">Percentual</option><option value="fixed_cents">Valor fixo em centavos</option></select></label>
    <label>Valor do desconto<input type="number" min="0" step={billingSettings.settings.earlyDiscountType==='percent'?'0.01':'1'} value={billingSettings.settings.earlyDiscountValue??0} onChange={e=>setBillingSettings(v=>({...v,settings:{...v.settings,earlyDiscountValue:Number(e.target.value)}}))}/></label>
    {[["earlyStartsAt","Início da campanha"],["earlyEndsAt","Fim da campanha"]].map(([key,title])=><label key={key}>{title}<input type="datetime-local" value={localInput(billingSettings.settings[key])} onChange={e=>setBillingSettings(v=>({...v,settings:{...v.settings,[key]:e.target.value?new Date(`${e.target.value}:00-03:00`).toISOString():null}}))}/></label>)}
    <label>Planos aplicáveis (chaves separadas por vírgula, vazio = todos)<input value={billingSettings.settings.earlyPlanKeys?.join(', ')||''} onChange={e=>setBillingSettings(v=>({...v,settings:{...v.settings,earlyPlanKeys:e.target.value.split(',').map(s=>s.trim()).filter(Boolean)}}))}/></label>
    <div className="row"><button type="button" className="btn" onClick={()=>setEditSettings(false)}>Fechar</button><button disabled={busy} className="btn primary">Salvar regras</button></div></form></Modal>}
  {manual&&<Modal title="Confirmar recebimento manual" onClose={()=>setManual(null)}><form onSubmit={e=>{e.preventDefault();void action(()=>api(`/admin/workspace/finance/charges/${manual.id}/manual`,{method:'POST',body:{reference:manual.reference}}),'Confirmação manual registrada sem prova do provedor.').then(ok=>ok&&setManual(null))}}>
   <p>Operação sem comprovação do gateway. Registre a referência verificável do recebimento.</p><input required minLength={5} maxLength={160} value={manual.reference} onChange={e=>setManual(v=>({...v,reference:e.target.value}))}/><button disabled={busy} className="btn primary">Confirmar recebimento</button></form></Modal>}
  {cancel&&<Modal title="Cancelar cobrança pendente" onClose={()=>setCancel(null)}><form onSubmit={e=>{e.preventDefault();void action(()=>api(`/admin/workspace/finance/charges/${cancel.id}/cancel`,{method:'POST',body:{reason:cancel.reason}}),'Cancelamento auditado.').then(ok=>ok&&setCancel(null))}}>
   <label>Motivo<textarea required minLength={5} maxLength={500} value={cancel.reason} onChange={e=>setCancel(v=>({...v,reason:e.target.value}))}/></label><button disabled={busy} className="btn primary">Cancelar cobrança</button></form></Modal>}
 </div>;
}
