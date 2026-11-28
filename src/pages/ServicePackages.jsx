import {useCallback,useEffect,useState} from 'react';
import {ContractList,LicensePrices} from './PlansAndPricing.jsx';
import {api} from '../api.js';
import {formatBRL} from '@deltatv/ui/money';
import {Modal} from '../ui.jsx';
import './service-packages.css';

const empty=()=>({code:'',name:'',audience:'content',validityDays:30,monthlyPriceCents:null,canResellPanel:false,canCreateSubmasters:false,canViewFinance:false,canManageGateways:false,hiddenFromNetwork:false,wholesaleCents:100,minResaleCents:100,active:true,
 maxDns:1,activationLimit:100,maxApps:0,autoFailover:true,autoPriority:false,emailAlerts:true,detailedHistory:false});
const money=formatBRL;
const codeFor=name=>name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').replace(/^([0-9])/,'p_$1').slice(0,30);
const toForm=p=>({code:p.code,name:p.name,audience:p.audience,validityDays:p.validity_days,monthlyPriceCents:p.monthly_price_cents,
 canResellPanel:p.can_resell_panel,canCreateSubmasters:p.can_create_submasters,canViewFinance:p.can_view_finance,canManageGateways:p.can_manage_gateways,hiddenFromNetwork:p.hidden_from_network,wholesaleCents:Number(p.wholesale_cents),minResaleCents:Number(p.min_resale_cents),active:p.active,
 maxDns:p.max_dns===null?null:Number(p.max_dns),activationLimit:p.activation_limit===null?null:Number(p.activation_limit),maxApps:Number(p.max_apps??0),
 autoFailover:!!p.auto_failover,autoPriority:!!p.auto_priority,emailAlerts:!!p.email_alerts,detailedHistory:!!p.detailed_history});
const FormRow=({label,children})=><label style={{display:'grid',gap:6}}><strong>{label}</strong>{children}</label>;
const Columns=({children})=><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,215px),1fr))',gap:12}}>{children}</div>;

export default function ServicePackages(){
 const [tab,setTab]=useState('packages');
 const [items,setItems]=useState([]),[form,setForm]=useState(empty),[original,setOriginal]=useState(null),[editing,setEditing]=useState(false);
 const [partners,setPartners]=useState([]),[selectedPartner,setSelectedPartner]=useState(''),[selectedPackage,setSelectedPackage]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{
  const result=await api('/admin/service-packages');setItems(result.items||[]);
  try{const r=await api('/admin/portal-sales/candidates');setPartners(Array.isArray(r)?r:r.items||r.data||[]);}catch{setPartners([]);}
 },[]);
 useEffect(()=>{refresh().catch(e=>setError(e.message));},[refresh]);
 const run=async(fn)=>{setError('');setNotice('');setBusy(true);try{await fn();await refresh();setNotice('Alteração salva e auditada.');return true;}catch(e){setError(e.message||'Não foi possível concluir.');return false;}finally{setBusy(false);}};
 const set=(field,value)=>setForm(p=>({...p,[field]:value,...(field==='autoFailover'&&!value?{autoPriority:false}:{})}));
 const save=async e=>{e.preventDefault();if(form.minResaleCents<form.wholesaleCents)return setError('O preço mínimo precisa ser igual ou maior que o preço de aquisição.');
  if(original&&original!==form.code)return setError('O identificador interno não pode ser modificado. Duplique o pacote.');
  const saved=await run(()=>api(`/admin/service-packages${original?`/${encodeURIComponent(original)}`:''}`,{method:original?'PUT':'POST',body:form}));
  if(saved){setEditing(false);setOriginal(null);setForm(empty());}};
 const edit=p=>{setError('');setForm(toForm(p));setOriginal(p.code);setEditing(true);};
 const newPackage=()=>{setError('');setForm(empty());setOriginal(null);setEditing(true);};
 const duplicate=async p=>{const name=window.prompt('Nome do novo pacote:',`${p.name} · Cópia`);if(!name?.trim())return;
  const code=codeFor(name);if(!code)return setError('Nome inválido.');
  await run(()=>api(`/admin/service-packages/${encodeURIComponent(p.code)}/duplicate`,{method:'POST',body:{newCode:code,newName:name.trim()}}));};
 const setActive=async p=>{if(!window.confirm(`${p.active?'Desativar':'Ativar'} o pacote ${p.name}? Os contratos atuais serão preservados.`))return;
  await run(()=>api(`/admin/service-packages/${encodeURIComponent(p.code)}/state`,{method:'PATCH',body:{active:!p.active}}));};
 const assign=async e=>{e.preventDefault();if(!selectedPartner||!selectedPackage)return;
  if(!window.confirm('Atribuir este pacote ao parceiro? A operação não apagará DNS nem ativações existentes.'))return;
  await run(()=>api(`/admin/service-packages/partners/${selectedPartner}`,{method:'PUT',body:{code:selectedPackage}}));};
 return <div className="service-packages-page">
  <header className="sp-heading">
   <div><span className="sp-eyebrow">DeltaTV · Gestão de recursos</span><h1>Pacotes de Serviço</h1>
    <p className="muted">Os recursos mudam para os parceiros que herdam o pacote. Exceções individuais e valores negociados permanecem preservados.</p></div>
   {tab==="packages"&&<button type="button" className="btn primary" onClick={newPackage}>+ Novo pacote</button>}
  </header>
  <div className="tabs">{[["packages","Pacotes"],["contracts","Contratos atuais"],["prices","Preços das licenças de TV"]].map(([id,label])=><button key={id} type="button" className={tab===id?"tab active":"tab"} onClick={()=>setTab(id)}>{label}</button>)}</div>
  {tab==="contracts"?<ContractList/>:tab==="prices"?<LicensePrices/>:<>
  {notice&&<div className="notice" role="status">{notice}</div>}
  {error&&!editing&&<div className="alert" role="alert">{error}</div>}
  <section className="card sp-section">
   <div className="sp-section-heading"><div><h2>Pacotes disponíveis</h2><p className="muted">Edite recursos e benefícios em uma janela. A alteração vale para quem herda o pacote.</p></div>
    <span className="sp-counter">{items.length} {items.length===1?'pacote':'pacotes'}</span></div>
   <div className="sp-list">{items.map(p=><article key={p.code} className="sp-package">
    <div className="sp-package-header"><div><strong>{p.name}</strong><small className="muted">Versão {p.revision} · {p.assigned_count} atribuições</small></div>
      <span className={`sp-status ${p.active?'active':''}`}>{p.active?'Ativo':'Desativado'}</span></div>
    <div className="sp-package-metrics">
     <span><small>DNS / código</small><b>{p.max_dns===null?'Ilimitados':p.max_dns}</b></span>
     <span><small>Ativações</small><b>{p.activation_limit===null?'Ilimitadas':p.activation_limit}</b></span>
     <span><small>Apps próprios</small><b>{p.max_apps??0}</b></span>
    </div>
    <div className="sp-package-bottom"><small className="muted">Mensalidade: {p.monthly_price_cents==null?"A definir":money(p.monthly_price_cents)+" / mês"}</small>
     <div className="sp-actions"><button type="button" className="btn sm primary" onClick={()=>edit(p)}>Editar plano</button>
      <button type="button" className="btn sm" onClick={()=>void duplicate(p)}>Duplicar</button>
      <button type="button" className="btn sm" onClick={()=>void setActive(p)}>{p.active?'Desativar':'Ativar'}</button></div></div>
   </article>)}</div>
   {!items.length&&<div className="sp-empty">Nenhum Pacote de Serviço cadastrado. <button type="button" className="btn primary" onClick={newPackage}>Criar primeiro pacote</button></div>}
  </section>
  <section className="card sp-section">
   <div className="sp-section-heading"><div><h2>Atribuir pacote ao parceiro</h2>
    <p className="muted">Somente recursos técnicos são aplicados; preços negociados e histórico financeiro não são substituídos.</p></div></div>
   <form onSubmit={assign} className="sp-assign"><Columns>
    <FormRow label="Parceiro"><select required value={selectedPartner} onChange={e=>setSelectedPartner(e.target.value)}><option value="">Selecionar parceiro</option>
      {partners.map(p=><option key={p.id||p.partner_id} value={p.id||p.partner_id}>{p.name}</option>)}</select></FormRow>
    <FormRow label="Pacote"><select required value={selectedPackage} onChange={e=>setSelectedPackage(e.target.value)}><option value="">Selecionar pacote</option>{items.filter(p=>p.active&&p.audience!=="reseller").map(p=><option key={p.code} value={p.code}>{p.name}</option>)}</select></FormRow>
   </Columns><button type="submit" className="btn primary" disabled={busy}>Atribuir pacote</button></form>
  </section>
  </>}
  {editing&&<Modal wide title={original?`Editar pacote · ${form.name}`:'Criar Pacote de Serviço'} onClose={()=>{if(!busy){setEditing(false);setError('');}}}>
   <form className="sp-editor" onSubmit={save}>
    <p className="muted sp-editor-intro">Defina o comportamento do sistema para os parceiros vinculados. O backend protege recursos em uso antes de permitir reduções.</p>
    <div className="sp-editor-section"><h4><span>01</span> Identidade do pacote</h4>
     <Columns>
      <FormRow label="Nome do pacote"><input required minLength="2" maxLength="120" autoFocus value={form.name} onChange={e=>{
       const name=e.target.value;setForm(v=>({...v,name,...(!original?{code:codeFor(name)}:{})}));}}/></FormRow>
      <FormRow label="Identificador interno"><input required disabled={!!original} pattern="[a-z][a-z0-9_-]{1,31}" value={form.code} onChange={e=>set('code',e.target.value)}/></FormRow>
     </Columns>
    </div>
    <div className="sp-editor-section"><h4><span>02</span> Limites e capacidade</h4>
     <Columns>
      <FormRow label="DNS por código"><label className="sp-check"><input type="checkbox" checked={form.maxDns===null} onChange={e=>set('maxDns',e.target.checked?null:1)}/> Sem limite</label>
       {form.maxDns!==null&&<input required type="number" min="1" max="2000000" value={form.maxDns} onChange={e=>set('maxDns',Number(e.target.value))}/>}</FormRow>
      <FormRow label="Ativações"><label className="sp-check"><input type="checkbox" checked={form.activationLimit===null} onChange={e=>set('activationLimit',e.target.checked?null:100)}/> Sem limite</label>
       {form.activationLimit!==null&&<input required type="number" min="0" max="2000000000" value={form.activationLimit} onChange={e=>set('activationLimit',Number(e.target.value))}/>}</FormRow>
      <FormRow label="Apps próprios incluídos"><input required type="number" min="0" max="50" step="1" value={form.maxApps} onChange={e=>set('maxApps',e.target.value===''?0:Number(e.target.value))}/></FormRow>
     </Columns>
    </div>
    <div className="sp-editor-section"><h4><span>03</span> Recursos automáticos</h4>
     <div className="sp-editor-toggles">{[["autoFailover","Failover automático","Troca DNS quando o provedor falha"],["autoPriority","Melhor desempenho","Prioriza rotas com menor latência"],["emailAlerts","Alertas por e-mail","Avisos de indisponibilidade"],["detailedHistory","Histórico detalhado","Relatórios detalhados de eventos"]].map(([key,name,description])=>
      <label className="sp-toggle" key={key}><input type="checkbox" checked={form[key]} disabled={key==='autoPriority'&&!form.autoFailover} onChange={e=>set(key,e.target.checked)}/>
       <span><strong>{name}</strong><small>{description}</small></span></label>)}</div>
    </div>
    <div className="sp-editor-section"><h4><span>04</span> Referências comerciais</h4>
     <Columns>
      <FormRow label="Mensalidade do parceiro (R$)"><input type="number" min="0" max="1000000" step="0.01" placeholder="A definir" value={form.monthlyPriceCents==null?'':form.monthlyPriceCents/100} onChange={e=>set('monthlyPriceCents',e.target.value===''?null:Math.round(Number(e.target.value)*100))}/></FormRow>
      <FormRow label="Público"><select disabled={!!original} value={form.audience} onChange={e=>set('audience',e.target.value)}><option value="content">Parceiros</option><option value="reseller">Revendas</option><option value="both">Ambos</option></select></FormRow>
      <FormRow label="Validade inicial (dias)"><input required type="number" min="1" max="3660" value={form.validityDays} onChange={e=>set('validityDays',Number(e.target.value))}/></FormRow>
      <FormRow label="Preço base (R$ / mês)"><input required type="number" min="0" step="0.01" value={form.wholesaleCents/100} onChange={e=>set('wholesaleCents',Math.round(Number(e.target.value)*100))}/></FormRow>
      <FormRow label="Piso de revenda (R$ / mês)"><input required type="number" min="0" step="0.01" value={form.minResaleCents/100} onChange={e=>set('minResaleCents',Math.round(Number(e.target.value)*100))}/></FormRow>
     </Columns><small className="muted">A edição não reajusta automaticamente os contratos financeiros já negociados.</small>
    </div>
    <fieldset><legend>Disponibilidade e permissões</legend>{[["hiddenFromNetwork","Ocultar nas ofertas da rede"],["canResellPanel","Revender o painel"],["canCreateSubmasters","Criar Submasters"],["canViewFinance","Consultar financeiro"],["canManageGateways","Configurar gateways"]].map(([key,label])=><label className="sp-check" key={key}><input type="checkbox" checked={form[key]} onChange={e=>set(key,e.target.checked)}/>{label}</label>)}</fieldset>
    {error&&<p className="alert" role="alert">{error}</p>}
    <footer className="sp-editor-footer"><button type="button" className="btn" disabled={busy} onClick={()=>{setEditing(false);setError('');}}>Cancelar</button>
      <button type="submit" className="btn primary" disabled={busy}>{busy?'Salvando…':original?'Salvar alterações':'Criar pacote'}</button></footer>
   </form>
  </Modal>}
 </div>;
}
