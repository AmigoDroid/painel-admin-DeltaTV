import {useCallback,useEffect,useState} from 'react';
import {api} from '../api.js';

const sections=[['payments','Pagamentos e webhooks'],['trial','Teste grátis'],['web','Player Web'],['costs','Custos e margem']];
const cash=c=>(Number(c||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fields=[
 ['vpsMonthlyCents','VPS mensal (R$)',100],['domainAnnualCents','Domínio anual (R$)',100],
 ['otherMonthlyCents','Outros custos mensais (R$)',100],['proxyCostPerGbCents','Proxy por GB (R$)',100],
 ['forecastProxyGbPerPartner','Consumo previsto por parceiro (GB)',1],
 ['targetMarginBp','Margem-alvo (%)',100],['taxBp','Impostos/taxas previstos (%)',100],['reserveBp','Reserva (%)',100]
];
const Field=({label,children})=><label style={{display:'grid',gap:5}}><strong>{label}</strong>{children}</label>;
const FormGrid=({children})=><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,210px),1fr))',gap:12}}>{children}</div>;

export default function GlobalSettings(){
 const [tab,setTab]=useState('payments'),[data,setData]=useState(null),[edit,setEdit]=useState(null),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[message,setMessage]=useState('');
 const load=useCallback(async()=>{
  const x=await api('/admin/global-config');setData(x);
  setEdit({trial:x.platform?.trial,web:x.platform?.web,
   payments:x.payment?{defaultGateway:x.payment.defaultGateway}:null,
   costs:x.costs?.settings?{
    vpsMonthlyCents:Number(x.costs.settings.vps_monthly_cents),domainAnnualCents:Number(x.costs.settings.domain_annual_cents),
    otherMonthlyCents:Number(x.costs.settings.other_monthly_cents),proxyCostPerGbCents:Number(x.costs.settings.proxy_cost_per_gb_cents),
    forecastProxyGbPerPartner:Number(x.costs.settings.forecast_proxy_gb_per_partner),
    targetMarginBp:Number(x.costs.settings.target_margin_bp),taxBp:Number(x.costs.settings.tax_bp),reserveBp:Number(x.costs.settings.reserve_bp)}:null});
 },[]);
 useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
 const save=async e=>{e.preventDefault();setBusy(true);setError('');setMessage('');try{
  await api(`/admin/global-config/${tab}`,{method:'PUT',body:edit[tab]});await load();setMessage('Configurações salvas e auditadas.');
 }catch(e){setError(e.message||'Falha ao salvar.');}finally{setBusy(false);}};
 const update=(section,key,value)=>setEdit(old=>({...old,[section]:{...old[section],[key]:value}}));
 const copy=url=>navigator.clipboard?.writeText(url).catch(()=>{});
 return <div style={{display:'grid',gap:18,maxWidth:1180}}>
  <header><h1>Configurações Globais</h1><p className="muted">Um só lugar para as preferências da <strong>DeltaTV</strong>. Os módulos operacionais continuam usando as regras existentes no backend.</p></header>
  <nav className="tabs" role="tablist" aria-label="Seções de configuração global">{sections.map(([id,label])=><button key={id} className={`tab ${tab===id?'active':''}`} role="tab" aria-selected={tab===id} type="button" onClick={()=>{setTab(id);setError('');setMessage('');}}>{label}</button>)}</nav>
  {error&&<div className="alert" role="alert">{error}</div>}{message&&<div className="notice" role="status">{message}</div>}
  {!data&&<p>Carregando configurações…</p>}
  {data?.errors?.[tab]&&<div className="alert" role="alert">{data.errors[tab].message} ({data.errors[tab].code})</div>}
  {tab==='payments'&&data&&<div style={{display:'grid',gap:14}}>
   <section className="card" style={{padding:18,display:'grid',gap:12}}>
    <h2>Gateway padrão — venda do Painel do Parceiro</h2>
    <p className="muted">Credenciais globais no .env do backend. Cada Master pode ter suas próprias credenciais e pagamentos, sem acesso às chaves da DeltaTV. Pedidos existentes mantêm seu gateway.</p>
    {edit?.payments&&<form onSubmit={save} style={{display:'grid',gap:12,maxWidth:600}}>
     <Field label="Recebimento padrão da DeltaTV"><select value={edit.payments.defaultGateway} onChange={e=>update('payments','defaultGateway',e.target.value)}>
      {(data.payment?.availableGateways||[]).map(g=><option key={g.provider} disabled={!g.enabled} value={g.provider}>{g.label}{g.enabled?'':' (não configurado)'}</option>)}
     </select></Field>
     <small className="muted">InfinitePay: {data.payment?.credentials?.infinitepayKeyPresent?'API Key configurada':'API Key ausente'} · Mercado Pago: {data.payment?.credentials?.mercadoPagoConfigured?'Configurado':'Token ausente'}.</small>
     <button className="btn primary" disabled={busy||!data.payment?.availableGateways?.find(g=>g.provider===edit.payments.defaultGateway&&g.enabled)}>{busy?'Salvando…':'Salvar gateway padrão'}</button>
    </form>}
   </section>
   <section className="card" style={{padding:18,display:'grid',gap:12}}>
    <h2>Webhooks e confirmação</h2>
    {!data.publicHttps&&<p role="alert" className="alert">PUBLIC_BASE_URL deve usar HTTPS público para receber webhooks.</p>}
    <p className="muted">Aqui aparecem os endereços calculados pelo servidor, não o status real de entrega. O backend confirma pagamentos consultando o provedor antes de liberar acesso.</p>
    {(data.webhooks||[]).map(w=><div key={w.id} style={{borderTop:'1px solid var(--border,#ddd)',paddingTop:12,display:'grid',gap:6}}>
     <strong>{w.provider} — {w.group}</strong><code style={{overflowWrap:'anywhere'}}>{w.url||'Origem não configurada'}</code>
     <small className="muted">{w.authentication}{w.dynamic?' · Webhook vinculado ao Master':''}</small>
     <div><button className="btn sm" type="button" disabled={!w.url||w.dynamic} onClick={()=>copy(w.url)}>Copiar URL</button></div>
    </div>)}
   </section>
   <section className="card" style={{padding:18}}><h2>Pix legado</h2><p className="muted">{data.legacyPix?.provider||'Sem provedor identificado'} · {data.legacyPix?.configured?'Token configurado':'Token ausente'}. As cobranças históricas continuam acessíveis no Financeiro.</p></section>
  </div>}
  {tab==='trial'&&edit?.trial&&<form onSubmit={save} className="card" style={{padding:18,display:'grid',gap:14,maxWidth:600}}>
   <h2>Teste grátis de novos dispositivos</h2><label><input type="checkbox" checked={edit.trial.enabled} onChange={e=>update('trial','enabled',e.target.checked)}/> Habilitar período gratuito</label>
   <Field label="Duração do teste (dias)"><input type="number" min="1" max="365" required value={edit.trial.days} onChange={e=>update('trial','days',Number(e.target.value))}/></Field>
   <p className="muted">Esta configuração é do sistema de ativação existente, não da rede comercial do Painel do Parceiro.</p>
   <div><button className="btn primary" disabled={busy}>Salvar teste grátis</button></div></form>}
  {tab==='web'&&edit?.web&&<form onSubmit={save} className="card" style={{padding:18,display:'grid',gap:14}}>
   <h2>Configurações globais do Player Web</h2><label><input type="checkbox" checked={edit.web.autoHttps} onChange={e=>update('web','autoHttps',e.target.checked)}/> Preferir HTTPS automaticamente</label>
   <FormGrid>{Object.entries(edit.web.deliveryModes).map(([key,v])=><Field key={key} label={{api:'Catálogo/API',live:'TV ao vivo',movie:'Filmes',series:'Séries'}[key]||key}>
    <select value={v} onChange={e=>setEdit(p=>({...p,web:{...p.web,deliveryModes:{...p.web.deliveryModes,[key]:e.target.value}}}))}><option value="redirect">Redirect</option><option value="proxy">Proxy</option></select>
   </Field>)}</FormGrid><p className="muted">Proxy consome banda da sua VPS; alterações devem ser homologadas antes de afetar clientes ativos.</p>
   <div><button className="btn primary" disabled={busy}>Salvar Player Web</button></div>
  </form>}
  {tab==='costs'&&edit?.costs&&<form onSubmit={save} className="card" style={{padding:18,display:'grid',gap:14}}>
   <h2>Custos e sustentabilidade</h2><p className="muted">Projeções, não faturamento real. O tráfego delegado ao Nginx ainda pode ficar fora das medições Node.</p>
   <FormGrid>{fields.map(([key,label,scale])=><Field key={key} label={label}><input type="number" required min="0" step={scale===100?'0.01':'1'} value={edit.costs[key]/scale}
    onChange={e=>update('costs',key,Math.round(Number(e.target.value)*scale))}/></Field>)}</FormGrid>
   <p className="muted">Custo fixo previsto: {cash(edit.costs.vpsMonthlyCents+edit.costs.otherMonthlyCents+edit.costs.domainAnnualCents/12)} por mês (sem proxy).</p>
   <div><button className="btn primary" disabled={busy}>Salvar custos</button></div></form>}
 </div>;
}
