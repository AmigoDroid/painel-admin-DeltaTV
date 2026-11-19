import { useDeviceBulkActions } from "../../shared/useDeviceBulkActions.jsx";
import { Modal } from "../ui.jsx";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {api,getAuth} from "../api.js";
import {addMonthsClamped} from "../workspace-dates.js";

// Administração de rede isolada: nenhum componente desta tela usa APIs globais
// como /admin/partners, /admin/dashboard ou /admin/service-plans.
const LABELS={
 "network:dashboard:read":"Visão geral",
 "network:partners:read":"Ver parceiros", "network:partners:write":"Cadastrar/editar parceiros", "network:partners:delete":"Excluir parceiros",
 "network:resellers:read":"Ver revendas", "network:resellers:write":"Cadastrar/editar revendas", "network:resellers:delete":"Excluir revendas",
 "network:plans:read":"Consultar planos", "network:plans:write":"Criar, editar e excluir planos",
 "network:members:read":"Consultar usuários", "network:members:write":"Cadastrar usuários do portal",
 "network:resources:read":"Ver códigos e DNS", "network:resources:write":"Editar códigos e DNS",
 "network:devices:read":"Ver dispositivos", "network:devices:write":"Gerenciar ativações de TVs", "network:billing:read":"Ver faturas", "network:billing:write":"Emitir faturas",
 "network:audit:read":"Consultar auditoria da rede",
};
const currency=cents=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((Number(cents)||0)/100);
const toCents=value=>Math.round(Number(String(value).replace(",","."))*100);
const nextMonth=()=>addMonthsClamped();
const blankPlan=()=>({name:"",description:"",audience:"content",monthlyPrice:"0.00",maxServers:"5",noDnsLimit:false,activationLimit:"100",noActivationLimit:false,validityDays:"30",
  autoFailover:true,autoPriority:false,emailAlerts:false,detailedHistory:false});
const blankAccount=kind=>({name:'',email:'',password:'',kind,planKey:''});
const blankInvite=(kind='content')=>({mode:'link',kind,email:'',planKey:'',label:'',sendEmail:false,maxUses:10,validityDays:7});
const permsOf=user=>new Set(user?.permissions||[]);
const field=(name,child)=><label className="field" style={{display:"grid",gap:5}}><span>{name}</span>{child}</label>;
function ErrorMessage({message}){return message?<div className="notice error" role="alert">{message}</div>:null;}
function StatusMessage({message}){return message?<div className="notice" role="status">{message}</div>:null;}
const between=(min,max)=>value=>Number.isInteger(Number(value))&&Number(value)>=min&&Number(value)<=max;

const SECTION_TABS = Object.freeze({
  partners:"partners",resellers:"resellers",plans:"plans",invitations:"partners",devices:"partners",
  resources:"partners",billing:"partners",members:"partners",
});
const SECTION_NAMES = Object.freeze({
  dashboard:"Visão geral",workspace:"Minha rede",partners:"Parceiros",resellers:"Revendas",
  plans:"Planos e recursos",invitations:"Links de convite",resources:"DNS e códigos",devices:"TVs e dispositivos",
  billing:"Financeiro da rede",members:"Usuários dos portais",audit:"Auditoria da rede",
});
export default function NetworkWorkspace({section="workspace", onNavigate}){
 const viewer=useMemo(()=>getAuth()?.user,[]);
 const central=viewer?.role==="superadmin";
 const permissions=permsOf(viewer);
 const permits=key=>central||permissions.has(key);
 const [admins,setAdmins]=useState([]);
 const [adminId,setAdminId]=useState(()=>central?sessionStorage.getItem("deltatv-selected-admin")||"":"");
 const [tab,setTab]=useState(()=>SECTION_TABS[section] || (
   central || permissions.has('network:partners:read') ? 'partners' :
   permissions.has('network:resellers:read') ? 'resellers' :
   permissions.has('network:plans:read') ? 'plans' : 'partners'));
 const [overview,setOverview]=useState(null),[plans,setPlans]=useState([]),[partners,setPartners]=useState([]),[invitePlans,setInvitePlans]=useState([]),[auditRows,setAuditRows]=useState([]);
 // Em Admins delegados, "Minha rede" é apenas um resumo. Parceiros,
 // Revendas e Planos abrem diretamente pelo menu lateral do App.
 // A DeltaTV mantém a navegação interna de inspeção de redes já existentes.
 const showWorkspaceManager=central || section!=="workspace";
 const scopedSection=section !== "workspace" && section !== "dashboard";
 const selectedArea=section === "devices" ? "devices" : section === "billing" ? "billing" : "resources";
 const [selected,setSelected]=useState(null);
 const [deletingPlan,setDeletingPlan]=useState(null),[planDeletePreview,setPlanDeletePreview]=useState(null),[planDeleteReason,setPlanDeleteReason]=useState(""),
 [planForm,setPlanForm]=useState(null),[accountForm,setAccountForm]=useState(null),[editingAccount,setEditingAccount]=useState(null);
 const [newUser,setNewUser]=useState(null),[editUser,setEditUser]=useState(null),[deleteUser,setDeleteUser]=useState(null),[userDeleteReason,setUserDeleteReason]=useState("");
 const [deletePreview,setDeletePreview]=useState(null),[deleteReason,setDeleteReason]=useState('');
 const [paymentReference,setPaymentReference]=useState(''),[confirmingPayment,setConfirmingPayment]=useState(false);
 const [inviteForm,setInviteForm]=useState(null),[inviteResult,setInviteResult]=useState(null),
  [invitations,setInvitations]=useState([]),[invitePage,setInvitePage]=useState(1),[inviteMeta,setInviteMeta]=useState(null),
  [registrations,setRegistrations]=useState(null),[editingInvite,setEditingInvite]=useState(null);
 const [q,setQ]=useState(""),[search,setSearch]=useState(""),[page,setPage]=useState(1),[pageMeta,setPageMeta]=useState(null),
   [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 const requestGeneration=useRef(0);
 const request=useCallback((path,params={})=>api(`/admin/workspace/${path}`,{
   ...params, query:{...(params.query||{}),...(central?{adminId}: {})},
 }),[adminId,central]);
 const available=central?Boolean(adminId):true;
 useEffect(()=>{if(!central)return;api("/admin/workspace/admins").then(v=>setAdmins(v.data||[])).catch(e=>setError(e.message));},[central]);
 useEffect(()=>{if(central&&adminId)sessionStorage.setItem("deltatv-selected-admin",adminId);},[central,adminId]);
 useEffect(()=>{const timer=setTimeout(()=>{setSearch(q.trim());setPage(1);},300);return()=>clearTimeout(timer);},[q]);
 const reload=useCallback(async()=>{
   const generation=++requestGeneration.current;
   if(!available){setOverview(null);setPlans([]);setPartners([]);setPageMeta(null);return;}
   setError("");
   const jobs=[];
   if(permits("network:dashboard:read"))jobs.push(request("summary").then(v=>{if(requestGeneration.current===generation)setOverview(v);}));
   if(section==="audit"&&permits("network:audit:read"))jobs.push(request("audit").then(v=>{if(requestGeneration.current===generation)setAuditRows(v.data||[]);}));
   if(showWorkspaceManager&&permits("network:plans:read"))jobs.push(request("plans").then(v=>{if(requestGeneration.current===generation)setPlans(v.data||[]);}));
   if(showWorkspaceManager&&(permits('network:partners:write')||permits('network:resellers:write'))){
     jobs.push(request('invitations',{query:{page:invitePage,pageSize:20}}).then(v=>{if(requestGeneration.current===generation){setInvitations(v.data||[]);setInviteMeta(v.meta||null);}}));
     jobs.push(request('invitations/plans').then(v=>{if(requestGeneration.current===generation)setInvitePlans(v.data||[]);}));
   }
   if(showWorkspaceManager&&(permits("network:partners:read")||permits("network:resellers:read")||
      permits("network:devices:read")||permits("network:resources:read")||
      permits("network:billing:read")||permits("network:members:read")))
     jobs.push(request("partners",{query:{pageSize:20,page,q:search,kind:tab==="plans"?undefined:tab==="resellers"?"reseller":scopedSection&&tab==="partners"&&section!=="partners"?undefined:"content"}})
       .then(v=>{if(requestGeneration.current===generation){setPartners(v.data||[]);setPageMeta(v.meta||null);}}));
   const failures=await Promise.allSettled(jobs);
   const first=failures.find(x=>x.status==="rejected");if(first&&requestGeneration.current===generation)setError(first.reason?.message||"Falha ao carregar a rede.");
 },[available,request,page,search,tab,section,showWorkspaceManager,invitePage,viewer?.id,viewer?.role,viewer?.permissions]);
 useEffect(()=>{void reload();return()=>{requestGeneration.current++;};},[reload]);
 const act=async(action,notice)=>{
   setBusy(true);setError("");setSuccess("");
   try{await action();setSuccess(notice);await reload();return true;}
   catch(err){setError(err?.message||"A operação não pôde ser concluída.");return false;}
   finally{setBusy(false);}
 };
 const initialTab=tab==="plans"?"network:plans:read":tab==="resellers"?"network:resellers:read":"network:partners:read";
 const sectionPermission=section==="audit"?"network:audit:read":section==="invitations"?"network:partners:write":section==="devices"?"network:devices:read":section==="resources"?"network:resources:read":
   section==="billing"?"network:billing:read":section==="members"?"network:members:read":initialTab;
 const canBrowse=permits(sectionPermission)||(section==='invitations'&&permits('network:resellers:write'));
 const visibleAccounts=partners.filter(p=>(tab==="resellers"?["reseller","both"].includes(p.kind):
   (section==="devices"||section==="resources"||section==="billing"||section==="members") ? true : ["content","both"].includes(p.kind)));
 const openPartner=async p=>{
   const generation=requestGeneration.current;
   setDeletePreview(null);setDeleteReason('');
   setError("");try{const d=await request(`partners/${p.id}`);if(requestGeneration.current===generation)setSelected(d);}
   catch(e){if(requestGeneration.current===generation)setError(e.message);}
 };
 const editPartner=()=>{
  if(!selected)return;
  const p=selected.partner;
  setEditingAccount({id:p.id,name:p.name,kind:p.kind,planKey:selected.plan?.tier||'',
   contactName:p.contactName||'',contactEmail:p.contactEmail||'',contactPhone:p.contactPhone||'',
   status:p.status,endsAt:p.endsAt?new Date(p.endsAt).toISOString().slice(0,10):''});
 };
 const issueInvite=async()=>{
   if(!inviteForm?.planKey || (inviteForm.mode==='email'&&!inviteForm.email.trim()))return setError('Escolha um plano e informe o e-mail apenas para convite pessoal.');
   setBusy(true);setError('');setSuccess('');setInviteResult(null);setRegistrations(null);
   try{
    const {mode,...fields}=inviteForm;
    const body={...fields,email:mode==='email'?fields.email:undefined,sendEmail:mode==='email'&&fields.sendEmail,
     maxUses:mode==='email'?1:fields.maxUses};
    const result=await request('invitations',{method:'POST',body});
    setInviteResult(result);setInviteForm(null);setInvitePage(1);
    setSuccess(result.warning||'Convite criado. Copie o link e compartilhe com o cliente.');
    await reload();
   }catch(e){setError(e.message||'Falha ao emitir convite.');}
   finally{setBusy(false);}
 };
 const savePlan=async()=>{
   const f=planForm;const parsed=toCents(f.monthlyPrice);
   if(!Number.isInteger(parsed)||parsed<0)return setError("Informe um preço válido.");
   const body={name:f.name,description:f.description,audience:f.audience,monthlyPriceCents:parsed,
    maxServers:f.noDnsLimit?null:Number(f.maxServers),
    activationLimit:f.noActivationLimit?null:Number(f.activationLimit),
    validityDays:Number(f.validityDays),autoFailover:f.autoFailover,autoPriority:f.autoPriority,
    emailAlerts:f.emailAlerts,detailedHistory:f.detailedHistory};
   const ok=await act(()=>request(f.key?`plans/${f.key}`:"plans",{method:f.key?"PUT":"POST",body}),"Plano salvo para esta rede.");
   if(ok)setPlanForm(null);
 };
 const previewPlanDeletion=async plan=>{
   setError("");setPlanDeletePreview(null);setPlanDeleteReason("");setDeletingPlan(plan);
   try{setPlanDeletePreview(await request(`plans/${plan.key}/deletion-preview`));}
   catch(e){setDeletingPlan(null);setError(e?.message||"Falha ao consultar vínculos do plano.");}
 };
 const confirmPlanDeletion=async()=>{
   if(!deletingPlan||!planDeletePreview)return;
   const ok=await act(()=>request(`plans/${deletingPlan.key}`,{method:"DELETE",body:{reason:planDeleteReason.trim()}}),"Plano excluído da gestão desta rede.");
   if(ok){setDeletingPlan(null);setPlanDeletePreview(null);setPlanForm(null);}
 };
 const savePartner=async()=>{
   const f=editingAccount||accountForm,edit=Boolean(editingAccount);
   if(!edit&&!f.planKey)return setError('Escolha o plano para aplicar os benefícios e o preço automaticamente.');
   const body=edit?{name:f.name,...(f.planKey?{planKey:f.planKey}:{}),
    contactName:f.contactName||null,contactEmail:f.contactEmail||null,contactPhone:f.contactPhone||null,
    status:f.status,...(f.endsAt?{endsAt:new Date(`${f.endsAt}T12:00:00Z`).toISOString()}:{}),
   }:{name:f.name,email:f.email,password:f.password,
     kind:f.kind,planKey:f.planKey};
   const ok=await act(()=>request(edit?`partners/${f.id}`:'partners',{method:edit?'PATCH':'POST',body}),
     edit?'Conta atualizada conforme o plano.':'Conta criada nesta rede, com os recursos definidos pelo plano.');
   if(ok){setAccountForm(null);setEditingAccount(null);setSelected(null);}
 };
 const planOptions=kind=>plans.filter(p=>p.active&&(p.audience===kind||p.audience==='both'));
 const formatLimit=value=>value==null?'Sem limite':String(value);
 const renderAccountForm=(f,set,edit=false)=>{
   const plan=plans.find(p=>p.key===f.planKey);
   return <section className="card" style={{display:'grid',gap:14,padding:20,maxWidth:680}}>
    <div><h3>{edit?'Editar conta':'Novo '+(f.kind==='reseller'?'revendedor':'parceiro')}</h3>
    <p className="muted">Basta identificar a conta e escolher o plano. Sem cadastro duplicado nem campos de limites repetidos.</p></div>
    {field('Nome',<input autoComplete="name" value={f.name} onChange={e=>set({...f,name:e.target.value})}/>)}
    {!edit&&field('E-mail',<input type="email" autoComplete="email" value={f.email} onChange={e=>set({...f,email:e.target.value})}/>)}
    {!edit&&field('Senha (mínimo de 12 caracteres)',<input type="password" autoComplete="new-password" value={f.password} onChange={e=>set({...f,password:e.target.value})}/>)}
    {field('Plano da conta',<select value={f.planKey} onChange={e=>set({...f,planKey:e.target.value})}>
      <option value="">Escolha o plano</option>{edit&&f.planKey&&!plans.some(p=>p.key===f.planKey)&&<option value={f.planKey}>Plano atual (legado)</option>}
      {planOptions(f.kind).map(p=><option key={p.key} value={p.key}>{p.name} · {currency(p.monthlyPriceCents)}</option>)}
    </select>)}
    {edit&&<div style={{display:'grid',gap:10}}>
      <h4>Contato e situação da conta</h4>
      <div className="row">{field('Responsável',<input value={f.contactName} onChange={e=>set({...f,contactName:e.target.value})}/>)}
        {field('E-mail de contato',<input type="email" value={f.contactEmail} onChange={e=>set({...f,contactEmail:e.target.value})}/>)}</div>
      <div className="row">{field('Telefone',<input value={f.contactPhone} onChange={e=>set({...f,contactPhone:e.target.value})}/>)}
        {field('Vencimento',<input type="date" value={f.endsAt} onChange={e=>set({...f,endsAt:e.target.value})}/>)}</div>
      {field('Situação',<select value={f.status} onChange={e=>set({...f,status:e.target.value})}>
        <option value="active">Ativo</option><option value="suspended">Suspenso</option><option value="blocked">Bloqueado</option>
      </select>)}
      <p className="muted">Plano pago pendente só pode ser ativado após confirmação de pagamento. Alterações e histórico ficam vinculados à sua rede.</p>
    </div>}
    {plan&&<div className="card" style={{padding:14,background:'var(--surface-muted,var(--surface,transparent))'}}>
      <strong>{plan.name}</strong><p style={{margin:'8px 0'}}>{currency(plan.monthlyPriceCents)} / mês · {plan.validityDays??30} dias iniciais</p>
      <p className="muted">DNS: {formatLimit(plan.maxServers)} · Ativações: {formatLimit(plan.activationLimit)} · {plan.autoFailover?'Failover incluso':'Sem failover'} · {plan.emailAlerts?'Alertas por e-mail':'Sem alertas'}</p>
    </div>}
    <div className="actions"><button className="btn" type="button" onClick={()=>{setAccountForm(null);setEditingAccount(null)}}>Cancelar</button>
     <button className="btn primary" type="button" disabled={busy||!f.name.trim()||(!edit&&(!f.planKey||!f.email.includes('@')||f.password.length<12))}
       onClick={savePartner}>{busy?'Salvando...':edit?'Aplicar plano':'Criar conta'}</button></div>
   </section>;
 };
 return <div className="workspace-admin-page" style={{display:"grid",gap:18}}>
  <div className="page-head"><h2>{central?"Administração das redes":SECTION_NAMES[section]||"Minha rede"}</h2>
    <p className="muted">{section==="dashboard"?"Acompanhe os números e acesse as ferramentas liberadas para sua rede.":
       section==="devices"||section==="resources"||section==="billing"||section==="members"?
         "Selecione uma conta da sua rede para acessar os dados e ações autorizados.":
         "Todos os registros nesta página pertencem à sua rede. Os dados da DeltaTV e de outros Admins ficam separados."}</p></div>
  {central&&<div className="card" style={{padding:16}}>{field("Admin responsável pela rede",<select value={adminId} onChange={e=>{requestGeneration.current++;setAdminId(e.target.value);setPage(1);setQ("");setPartners([]);setPlans([]);setInvitations([]);setInvitePage(1);setInviteMeta(null);setInvitePlans([]);setRegistrations(null);setInviteResult(null);setInviteForm(null);setPageMeta(null);setOverview(null);setSelected(null);}}><option value="">Selecione uma rede</option><option value="deltatv">DeltaTV — rede principal</option>{admins.map(a=><option key={a.id} value={a.id}>{a.name} — {a.email}</option>)}</select>)}</div>}
  {!central && permissions.size === 0 && <div className="card" role="status" style={{padding:20,display:"grid",gap:8}}>
    <h3>Permissões de administração ainda não configuradas</h3>
    <p>Seu usuário é Admin, mas a DeltaTV ainda não liberou funções para sua rede. Solicite que a DeltaTV acesse Usuários, edite sua conta e selecione as permissões necessárias.</p>
    <p className="muted">A sua conta operacional de Parceiro/Revenda pode continuar ativa separadamente. Nenhum dado foi excluído por esta mensagem.</p>
  </div>}
  {!available?<p className="muted">Selecione um Admin para abrir os cadastros de sua rede.</p>:<>
   {section==="audit"&&permits("network:audit:read")&&<section className="card" style={{padding:20}}><h3>Histórico de ações na rede</h3>
     <p className="muted">Eventos relacionados às contas da sua rede. Auditoria global da plataforma permanece exclusiva da DeltaTV.</p>
     {auditRows.length?<div style={{display:"grid",gap:8}}>{auditRows.map(row=><div key={row.id} className="row" style={{justifyContent:"space-between",borderBottom:"1px solid var(--border,#334155)",paddingBottom:8}}>
       <span>{row.partnerName} · {row.action} · {row.result}</span><time>{new Date(row.createdAt).toLocaleString("pt-BR")}</time>
     </div>)}</div>:<p className="muted">Nenhum evento recente na sua rede.</p>}
   </section>}
   {overview&&<div className="grid cards" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
     {[{label:"Parceiros",value:overview.partners},{label:"Revendas",value:overview.resellers},{label:"Planos",value:overview.plans}].map(x=><div className="card" key={x.label} style={{padding:16}}><small>{x.label}</small><h2>{x.value}</h2></div>)}
   </div>}
   <ErrorMessage message={error}/><StatusMessage message={success}/>
   {section === "workspace" && !central && <div className="card" style={{padding:20,display:"grid",gap:8}}>
     <h3>Resumo da minha rede</h3>
     <p className="muted">As contas e os planos são gerenciados diretamente no menu lateral: Gerenciar parceiros, Revendas e Planos e recursos.</p>
     {!permits("network:dashboard:read") && <p className="muted">As métricas de visão geral dependem da permissão de consulta concedida pela DeltaTV.</p>}
   </div>}
   {section === "dashboard" && <div className="card" style={{padding:20,display:"grid",gap:12}}>
     <h3>Gerenciar sua rede</h3><p className="muted">Abra diretamente a ferramenta desejada. Somente opções autorizadas pela DeltaTV aparecem.</p>
     <div className="actions" style={{flexWrap:"wrap"}}>{[
       ["partners","Parceiros","network:partners:read"],["resellers","Revendas","network:resellers:read"],
       ["pricing","Planos e recursos","network:plans:read"],["sources","DNS e códigos","network:resources:read"],
       ["devices","Dispositivos","network:devices:read"],["billing","Financeiro","network:billing:read"],
       ["users","Usuários","network:members:read"],
     ].filter(x=>permits(x[2])).map(([page,label])=><button type="button" className="btn" key={page} onClick={()=>onNavigate?.(page)}>{label}</button>)}</div>
   </div>}
   {section !== "dashboard" && section!=="audit" && showWorkspaceManager && <div className="toolbar" style={{display:"flex",flexWrap:"wrap",gap:8}}>
     {section === "workspace" && central && [["partners","Parceiros","network:partners:read"],["resellers","Revendas","network:resellers:read"],["plans","Planos e recursos","network:plans:read"]]
       .filter(x=>permits(x[2])).map(([key,name])=><button key={key} className={`btn ${tab===key?"primary":""}`} onClick={()=>{setTab(key);setPage(1);setSelected(null);setEditingAccount(null);setPlanForm(null);}}>{name}</button>)}
     <button className="btn" onClick={()=>void reload()}>Atualizar</button>
   </div>}
   {section !== "dashboard" && section!=="audit" && showWorkspaceManager && tab==="plans"&&permits("network:plans:read")&&<>
     {permits("network:plans:write")&&<div><button className="btn primary" onClick={()=>setPlanForm(blankPlan())}>Novo plano</button></div>}
     {planForm&&<div className="card" style={{display:"grid",gap:12,padding:20}}>
       <h3>{planForm.key?"Editar plano":"Novo plano"}</h3>
       <div className="row">{field("Nome",<input value={planForm.name} onChange={e=>setPlanForm({...planForm,name:e.target.value})}/>)}
       {field("Tipo",<select value={planForm.audience} onChange={e=>setPlanForm({...planForm,audience:e.target.value})}><option value="content">Parceiro</option><option value="reseller">Revenda</option><option value="both">Ambos</option></select>)}
       {field("Mensalidade (R$)",<input type="number" min="0" step="0.01" value={planForm.monthlyPrice} onChange={e=>setPlanForm({...planForm,monthlyPrice:e.target.value})}/>)}</div>
       {field("Descrição",<input value={planForm.description} onChange={e=>setPlanForm({...planForm,description:e.target.value})}/>)}
       <div className="row">{field("DNS por código",<><input type="number" min="1" disabled={planForm.noDnsLimit} value={planForm.maxServers} onChange={e=>setPlanForm({...planForm,maxServers:e.target.value})}/><label><input type="checkbox" checked={planForm.noDnsLimit} onChange={e=>setPlanForm({...planForm,noDnsLimit:e.target.checked})}/> Sem limite</label></>)}</div>
       <div className="row">{field('Ativações',<><input type="number" min="0" disabled={planForm.noActivationLimit} value={planForm.activationLimit} onChange={e=>setPlanForm({...planForm,activationLimit:e.target.value})}/><label><input type="checkbox" checked={planForm.noActivationLimit} onChange={e=>setPlanForm({...planForm,noActivationLimit:e.target.checked})}/> Sem limite</label></>)}
         {field('Validade inicial do acesso (dias)',<input type="number" min="1" max="3660" value={planForm.validityDays} onChange={e=>setPlanForm({...planForm,validityDays:e.target.value})}/>)}</div>
       <div className="row">{[["autoFailover","Failover automático"],["autoPriority","Prioridade automática"],["emailAlerts","Alertas por e-mail"],["detailedHistory","Histórico detalhado"]].map(([key,label])=><label key={key}><input type="checkbox" checked={planForm[key]} onChange={e=>setPlanForm({...planForm,[key]:e.target.checked})}/> {label}</label>)}</div>
       <div className="actions"><button className="btn" onClick={()=>setPlanForm(null)}>Cancelar</button><button className="btn primary" disabled={busy||!planForm.name} onClick={savePlan}>Salvar plano</button></div>
     </div>}
     <div className="card" style={{padding:16}}><h3>Planos desta rede</h3>
       {plans.length?<table className="table"><thead><tr><th>Plano</th><th>Tipo</th><th>Preço mensal</th><th>DNS</th><th>Ativações</th><th>Validade</th><th>Gerenciar</th></tr></thead><tbody>{plans.map(p=><tr key={p.key}><td>{p.name}</td><td>{p.audience}</td><td>{currency(p.monthlyPriceCents)}</td><td>{p.maxServers??"Sem limite"}</td><td>{p.activationLimit??"Sem limite"}</td><td>{p.validityDays??30} dias · {p.active?"Ativo":"Inativo"}</td><td>{permits("network:plans:write")&&<div className="actions"><button className="btn sm" onClick={()=>setPlanForm({key:p.key,name:p.name,description:p.description,audience:p.audience,monthlyPrice:(p.monthlyPriceCents/100).toFixed(2),maxServers:String(p.maxServers??""),noDnsLimit:p.maxServers==null,activationLimit:String(p.activationLimit??''),noActivationLimit:p.activationLimit==null,validityDays:String(p.validityDays??30),autoFailover:p.autoFailover,autoPriority:p.autoPriority,emailAlerts:p.emailAlerts,detailedHistory:p.detailedHistory})}>Editar</button><button className="btn sm" disabled={busy} onClick={()=>void act(()=>request(`plans/${p.key}`,{method:"PUT",body:{active:!p.active}}),p.active?"Plano desativado.":"Plano reativado.")}>{p.active?"Desativar":"Reativar"}</button><button className="btn sm" disabled={busy} onClick={()=>void previewPlanDeletion(p)}>Excluir</button></div>}</td></tr>)}</tbody></table>:<p className="muted">Nenhum plano criado nesta rede.</p>}
     </div>
   </>}
   {deletingPlan&&<div className="card" role="dialog" aria-modal="true" aria-label="Excluir plano" style={{padding:20,display:"grid",gap:12}}>
     <h3>Excluir plano: {deletingPlan.name}</h3>
     {planDeletePreview?<><p>{planDeletePreview.warning}</p><p>Contas vinculadas: {planDeletePreview.accounts} · Convites históricos: {planDeletePreview.invitations}</p></>:<p>Consultando os vínculos...</p>}
     {field("Motivo da exclusão (opcional)",<input value={planDeleteReason} onChange={e=>setPlanDeleteReason(e.target.value)} placeholder="Opcional"/>)}
     <div className="actions"><button className="btn" onClick={()=>{setDeletingPlan(null);setPlanDeletePreview(null);}}>Cancelar</button>
       <button className="btn danger" disabled={busy||!planDeletePreview} onClick={()=>void confirmPlanDeletion()}>Confirmar exclusão</button></div>
   </div>}
   {section !== "dashboard" && section!=="audit" && showWorkspaceManager && tab!=="plans"&&canBrowse&&<>
     {(section==="workspace"||section==="partners"||section==="resellers")&&!editingAccount&&!accountForm&&permits(tab==="resellers"?"network:resellers:write":"network:partners:write")&&<div className="actions">
       <button className="btn primary" onClick={()=>{setAccountForm(blankAccount(tab==="resellers"?"reseller":"content"));setInviteForm(null);setSelected(null);}}>Novo {tab==="resellers"?"revendedor":"parceiro"}</button>
       {tab==='partners'&&<button className="btn" onClick={()=>{onNavigate?.('invitations');setInviteForm(blankInvite());setAccountForm(null);setEditingAccount(null);setInviteResult(null);}}>Gerar link de convite</button>}
     </div>}
     {(section==="invitations" || section==="workspace" || section==="partners")&&tab==='partners'&&(permits('network:partners:write')||permits('network:resellers:write'))&&<section className="card network-invite-panel" style={{padding:20,display:'grid',gap:12}}>
       <div><h3>Links de convite por plano</h3><p className="muted">Escolha o plano e gere um link para compartilhar por WhatsApp ou onde preferir. O cliente se cadastra na sua rede; o plano determina preço, DNS, ativações e prazo.</p></div>
       {!inviteForm&&<button type="button" className="btn primary" onClick={()=>{setInviteForm(blankInvite(permits('network:partners:write')?'content':'reseller'));setInviteResult(null);}}>Novo link de convite</button>}
       {inviteForm&&<>
         {field('Tipo de convite',<select value={inviteForm.mode} onChange={e=>setInviteForm({...inviteForm,mode:e.target.value,maxUses:e.target.value==='email'?1:10})}>
           <option value="link">Link para compartilhar</option><option value="email">Convite pessoal por e-mail</option>
         </select>)}
         {field('Tipo de conta',<select value={inviteForm.kind} onChange={e=>setInviteForm({...inviteForm,kind:e.target.value,planKey:''})}>
           {permits('network:partners:write')&&<option value="content">Parceiro</option>}
           {permits('network:resellers:write')&&<option value="reseller">Revenda</option>}
         </select>)}
         {field('Plano do link',<select value={inviteForm.planKey} onChange={e=>setInviteForm({...inviteForm,planKey:e.target.value})}>
           <option value="">Escolha o plano</option>{invitePlans.filter(p=>p.audience==='both'||p.audience===inviteForm.kind).map(p=><option key={p.key} value={p.key}>{p.name} · {currency(p.monthlyPriceCents)}</option>)}
         </select>)}
         {field('Identificação (opcional)',<input maxLength={120} placeholder="Ex.: Divulgação em grupos" value={inviteForm.label} onChange={e=>setInviteForm({...inviteForm,label:e.target.value})}/>)}
         {inviteForm.mode==='email'&&<>{field('E-mail da pessoa',<input type="email" value={inviteForm.email} onChange={e=>setInviteForm({...inviteForm,email:e.target.value})}/>)}
           <label><input type="checkbox" checked={inviteForm.sendEmail} onChange={e=>setInviteForm({...inviteForm,sendEmail:e.target.checked})}/> Enviar e-mail automaticamente (requer SMTP)</label></>}
         <div className="row">{field('Validade do link',<select value={inviteForm.validityDays} onChange={e=>setInviteForm({...inviteForm,validityDays:Number(e.target.value)})}>
           <option value={1}>1 dia</option><option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option>
         </select>)}
         {inviteForm.mode==='link'&&field('Quantidade de cadastros',<select value={inviteForm.maxUses===null?'unlimited':String(inviteForm.maxUses)} onChange={e=>setInviteForm({...inviteForm,maxUses:e.target.value==='unlimited'?null:Number(e.target.value)})}>
           {[1,5,10,25,100].map(n=><option key={n} value={n}>{n} {n===1?'cadastro':'cadastros'}</option>)}<option value="unlimited">Sem limite de usos</option>
         </select>)}</div>
         <p className="muted">Link gratuito: ativação imediata. Plano pago: conta criada, mas acesso bloqueado até a confirmação do pagamento. O link não altera o valor definido no plano.</p>
         <div className="actions"><button className="btn" onClick={()=>setInviteForm(null)}>Cancelar</button><button className="btn primary" disabled={busy||!inviteForm.planKey||(inviteForm.mode==='email'&&!inviteForm.email.includes('@'))} onClick={issueInvite}>{busy?'Gerando…':'Gerar link'}</button></div>
       </>}
       {inviteResult?.url&&<div className="card" role="status" style={{padding:16,display:'grid',gap:8}}>
         <strong>Link gerado — copie e compartilhe</strong>{inviteResult.warning&&<p className="muted">{inviteResult.warning}</p>}
         <label className="field">Link de cadastro<input readOnly value={inviteResult.url} onFocus={e=>e.target.select()}/></label>
         <button className="btn primary" onClick={()=>{if(!navigator.clipboard){setError('Selecione e copie o link manualmente.');return;}navigator.clipboard.writeText(inviteResult.url).then(()=>setSuccess('Link copiado.')).catch(()=>setError('Selecione e copie manualmente.'));}}>Copiar link</button>
         <p className="muted">Guarde o link: por segurança, o token completo só é exibido agora. É possível gerar outros links para planos diferentes.</p>
       </div>}
       {<div className="network-invite-list"><div className="network-invite-header"><h4>Links gerados ({inviteMeta?.total ?? invitations.length})</h4><span className="muted">Controle dos convites emitidos para sua rede</span></div>{invitations.length===0&&<p className="muted">Nenhum link emitido nesta rede.</p>}
         {invitations.map(inv=><div key={inv.id} className="network-invite-row">
           <span className="network-invite-summary">{inv.kind==='reseller'?'Revenda':'Parceiro'} · {inv.label||inv.email||'Link compartilhável'} · {invitePlans.find(p=>p.key===inv.planKey)?.name||inv.planKey} · {inv.useCount||0} uso(s){inv.maxUses==null?' / ilimitado':` / ${inv.maxUses}`} · {inv.revokedAt?'Revogado':inv.remainingUses===0||new Date(inv.expiresAt)<new Date()?'Encerrado':'Ativo'}</span>
           <span className="actions network-invite-actions"><button className="btn sm" onClick={async()=>{try{const r=await request(`invitations/${inv.id}/registrations`);setRegistrations({id:inv.id,label:inv.label||inv.email||'Link compartilhável',data:r.data||[],meta:r.meta||null});}catch(e){setError(e.message);}}}>Ver cadastros</button>
           <button className="btn sm" disabled={busy||Boolean(inv.revokedAt)} onClick={()=>setEditingInvite({id:inv.id,label:inv.label||'',maxUses:inv.maxUses,validityDays:7,useCount:inv.useCount||0,email:inv.email})}>Editar</button>
           <button className="btn sm" disabled={busy||Boolean(inv.revokedAt)||inv.remainingUses===0||new Date(inv.expiresAt)<=new Date()} onClick={async()=>{if(!window.confirm('Gerar outro endereço? O link anterior deixará de funcionar imediatamente.'))return;setBusy(true);try{const r=await request(`invitations/${inv.id}/rotate`,{method:'POST'});setInviteResult({url:r.url});setSuccess('Link substituído. Copie o novo endereço abaixo.');await reload();}catch(e){setError(e.message)}finally{setBusy(false)}}}>Novo endereço</button>
           <button className="btn sm" disabled={busy} onClick={async()=>{if(!window.confirm('Apagar este link? Ele será revogado imediatamente e os cadastros já efetuados serão preservados.'))return;await act(()=>request(`invitations/${inv.id}`,{method:'DELETE'}),'Convite excluído.');}}>Apagar</button>
           {!inv.revokedAt&&inv.remainingUses!==0&&new Date(inv.expiresAt)>new Date()&&<button className="btn sm" disabled={busy} onClick={()=>act(()=>request(`invitations/${inv.id}/revoke`,{method:'POST'}),'Link revogado.')}>Revogar</button>}</span>
         </div>)}</div>}
       {editingInvite&&<div className="card" style={{padding:16,display:'grid',gap:10}}><h4>Editar convite</h4>
         {field('Identificação',<input maxLength={120} value={editingInvite.label} onChange={e=>setEditingInvite({...editingInvite,label:e.target.value})}/>)}
         {field('Prorrogar validade a partir de hoje (dias)',<input type="number" min="1" max="90" value={editingInvite.validityDays} onChange={e=>setEditingInvite({...editingInvite,validityDays:Number(e.target.value)})}/>)}
         {field('Total de cadastros permitido',<select disabled={Boolean(editingInvite.email)} value={editingInvite.maxUses===null?'unlimited':String(editingInvite.maxUses)} onChange={e=>setEditingInvite({...editingInvite,maxUses:e.target.value==='unlimited'?null:Number(e.target.value)})}>{[1,5,10,25,100,1000].filter(n=>n>=editingInvite.useCount).map(n=><option key={n} value={n}>{n}</option>)}<option value="unlimited">Ilimitado</option></select>)}
         <p className="muted">O plano e o destinatário permanecem vinculados ao convite original. Alterações não modificam cadastros concluídos.</p>
         <div className="actions"><button className="btn" onClick={()=>setEditingInvite(null)}>Cancelar</button><button className="btn primary" disabled={busy||!Number.isInteger(editingInvite.validityDays)||editingInvite.validityDays<1||editingInvite.validityDays>90} onClick={async()=>{const f=editingInvite;const ok=await act(()=>request(`invitations/${f.id}`,{method:'PATCH',body:{label:f.label,validityDays:f.validityDays,maxUses:f.maxUses}}),'Convite atualizado.');if(ok)setEditingInvite(null)}}>Salvar alterações</button></div>
       </div>}
       {registrations&&<div className="card" style={{padding:14,display:'grid',gap:8}}><div className="row" style={{justifyContent:'space-between'}}>
         <h4>Cadastros: {registrations.label}</h4><button className="btn sm" onClick={()=>setRegistrations(null)}>Fechar</button></div>
         {registrations.data.length?registrations.data.map(row=><div className="row" key={row.partnerId||row.email+row.createdAt} style={{justifyContent:'space-between'}}>
           <span>{row.email}</span><span className="muted">{new Date(row.createdAt).toLocaleDateString('pt-BR')}</span>
         </div>):<p className="muted">Ninguém utilizou este link ainda.</p>}
         {registrations.meta&&registrations.meta.totalPages>1&&<div className="row" style={{justifyContent:'space-between'}}>
           <span className="muted">{registrations.meta.total} cadastrados · página {registrations.meta.page}/{registrations.meta.totalPages}</span>
           <span className="actions"><button className="btn sm" disabled={registrations.meta.page<=1} onClick={async()=>{try{const r=await request(`invitations/${registrations.id}/registrations`,{query:{page:registrations.meta.page-1}});setRegistrations(v=>({...v,data:r.data||[],meta:r.meta}));}catch(e){setError(e.message);}}}>Anterior</button>
           <button className="btn sm" disabled={registrations.meta.page>=registrations.meta.totalPages} onClick={async()=>{try{const r=await request(`invitations/${registrations.id}/registrations`,{query:{page:registrations.meta.page+1}});setRegistrations(v=>({...v,data:r.data||[],meta:r.meta}));}catch(e){setError(e.message);}}}>Próxima</button></span>
         </div>}
       </div>}
       {inviteMeta&&inviteMeta.totalPages>1&&<nav className="row" aria-label="Páginas dos convites" style={{justifyContent:'space-between'}}>
         <span className="muted">{inviteMeta.total} links · página {inviteMeta.page} de {inviteMeta.totalPages}</span>
         <div className="actions"><button className="btn sm" disabled={invitePage<=1||busy} onClick={()=>setInvitePage(p=>Math.max(1,p-1))}>Anterior</button>
           <button className="btn sm" disabled={invitePage>=inviteMeta.totalPages||busy} onClick={()=>setInvitePage(p=>p+1)}>Próxima</button></div>
       </nav>}
     </section>}
     {accountForm&&renderAccountForm(accountForm,setAccountForm)}
     {editingAccount&&renderAccountForm(editingAccount,setEditingAccount,true)}
     {section==="devices"&&permits("network:devices:read")&&<NetworkDevices accounts={visibleAccounts} request={request} permits={permits} accountPage={page} accountMeta={pageMeta} setAccountPage={setPage} accountQuery={q} setAccountQuery={setQ}/>}
     {section!=="invitations"&&section!=="devices"&&<div className="card network-partner-panel" style={{padding:16}}>
       <div className="row" style={{justifyContent:"space-between",alignItems:"center"}}><h3>{section==="devices"||section==="resources"||section==="billing"||section==="members"?"Contas da minha rede":tab==="resellers"?"Minhas revendas":"Meus parceiros"}</h3><input aria-label="Buscar contas nesta rede" placeholder="Buscar nesta rede" value={q} onChange={e=>setQ(e.target.value)}/></div>
       {visibleAccounts.length?<div className="network-partner-table-scroll"><table className="table network-partner-table"><thead><tr><th>Empresa</th><th>Mensalidade</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead><tbody>{visibleAccounts.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.monthlyFeeCents == null ? "—" : currency(p.monthlyFeeCents)}</td><td>{p.endsAt ? new Date(p.endsAt).toLocaleDateString("pt-BR") : "—"}</td><td>{p.status}</td><td><button className="btn sm" onClick={()=>openPartner(p)}>Gerenciar</button></td></tr>)}</tbody></table></div>:<p className="muted">Nenhuma conta corresponde à pesquisa nesta rede.</p>}
       {pageMeta&&<nav className="row" aria-label="Páginas de contas" style={{justifyContent:"space-between",marginTop:12,flexWrap:"wrap"}}>
         <span className="muted">{pageMeta.total} conta(s) · página {pageMeta.page} de {Math.max(1,pageMeta.totalPages)}</span>
         <div className="actions"><button className="btn sm" disabled={page<=1||busy} onClick={()=>setPage(x=>Math.max(1,x-1))}>Anterior</button>
         <button className="btn sm" disabled={page>=pageMeta.totalPages||busy} onClick={()=>setPage(x=>x+1)}>Próxima</button></div>
       </nav>}
     </div>}
     {section!=="devices"&&selected&&<div className="card" style={{padding:20,display:"grid",gap:12}}>
       <h3>{selected.partner.name}</h3>
       {(selected.plan || selected.contract) && <p>Plano: {plans.find(p=>p.key===selected.plan?.tier)?.name||selected.plan?.tier||"Não informado"} · Ativações: {selected.contract?.activationLimit ?? "Sem limite"}</p>}
       <div className="actions"><button className="btn" onClick={()=>setSelected(null)}>Fechar</button>
         {permits(selected.partner.kind==="reseller"?"network:resellers:write":"network:partners:write")&&<button className="btn primary" onClick={editPartner}>Editar contrato</button>}
         {selected.partner.statusReason==='awaiting_payment'&&permits('network:billing:write')&&permits(selected.partner.kind==='reseller'?'network:resellers:write':'network:partners:write')&&
         <button className="btn primary" disabled={busy} onClick={()=>setConfirmingPayment(v=>!v)}>Confirmar recebimento</button>}
         {permits(selected.partner.kind==='reseller'?'network:resellers:delete':'network:partners:delete')&&<button type="button" className="btn" onClick={async()=>{try{setDeletePreview(await request(`partners/${selected.partner.id}/delete-preview`));setDeleteReason('');}catch(e){setError(e.message);}}}>Excluir parceiro ou revenda</button>}
         {permits("network:members:write")&&<button className="btn" onClick={()=>setNewUser({name:"",email:"",password:""})}>Adicionar usuário</button>}
       </div>
       {deletePreview&&<section className="card" role="group" aria-label="Confirmar exclusão" style={{padding:18,border:'1px solid var(--danger,#c2414e)',display:'grid',gap:10,maxWidth:650}}>
         <h4>Excluir {selected.partner.name} desta rede</h4>
         <p>Esta operação revoga logins, códigos e acessos, e move a conta para a lixeira. Não remove recibos ou registros financeiros obrigatórios, nem dados de outras redes.</p>
         <p className="muted">Impacto: {deletePreview.users} usuário(s), {deletePreview.codes} código(s), {deletePreview.activations} ativação(ões), {deletePreview.providers} DNS.</p>
         {field('Motivo da exclusão (opcional)',<textarea rows={2} value={deleteReason} onChange={e=>setDeleteReason(e.target.value)}/>)}
         <div className="actions"><button className="btn" onClick={()=>setDeletePreview(null)}>Cancelar</button>
           <button className="btn" disabled={busy} onClick={async()=>{const ok=await act(()=>request(`partners/${selected.partner.id}/archive`,{method:'POST',body:{reason:deleteReason.trim()}}),'Conta excluída da operação e acessos revogados.');if(ok){setSelected(null);setDeletePreview(null);}}}>Confirmar exclusão</button></div>
       </section>}
       {confirmingPayment&&selected.partner.statusReason==='awaiting_payment'&&<div className="card" style={{padding:14,display:'grid',gap:10,maxWidth:520}}>
         <strong>Confirmação financeira</strong>
         <p className="muted">Confirme o recebimento real antes de liberar os recursos pagos. O comprovante sozinho não confirma a transação.</p>
         {field('Referência do pagamento recebido',<input placeholder="ID Pix ou identificação bancária" value={paymentReference} onChange={e=>setPaymentReference(e.target.value)}/>)}
         <div className="actions"><button className="btn" onClick={()=>setConfirmingPayment(false)}>Cancelar</button>
           <button className="btn primary" disabled={busy||paymentReference.trim().length<3} onClick={async()=>{
             const ok=await act(()=>request(`partners/${selected.partner.id}/confirm-payment`,{method:'POST',body:{reference:paymentReference.trim()}}),'Recebimento registrado. Acesso ativado.');
             if(ok){setPaymentReference('');setConfirmingPayment(false);setSelected(null);}
           }}>Confirmar e ativar</button></div>
       </div>}
       {selected.users?.length>0&&<><h4>Usuários do painel</h4>{selected.users.map(u=><div key={u.id} className="row" style={{justifyContent:"space-between",flexWrap:"wrap",gap:8}}><span>{u.name} · {u.email} · {u.status}</span>{permits("network:members:write")&&<div className="actions">
         <button className="btn sm" onClick={()=>setEditUser({id:u.id,name:u.name,email:u.email,password:"",status:u.status})}>Editar</button>
         <button className="btn sm" onClick={()=>void act(()=>request(`partners/${selected.partner.id}/users/${u.id}`,{method:"PATCH",body:{status:u.status==="active"?"disabled":"active"}}),"Acesso atualizado.").then(()=>openPartner(selected.partner))}>{u.status==="active"?"Desativar":"Ativar"}</button>
         <button className="btn sm" onClick={()=>{setDeleteUser(u);setUserDeleteReason("");}}>Excluir</button></div>}</div>)}
         {editUser&&<section className="card" style={{padding:14,display:"grid",gap:10}}><h4>Editar usuário</h4>
          {field("Nome",<input value={editUser.name} onChange={e=>setEditUser({...editUser,name:e.target.value})}/>)}
          {field("E-mail",<input type="email" value={editUser.email} onChange={e=>setEditUser({...editUser,email:e.target.value})}/>)}
          {field("Nova senha (deixe em branco para manter)",<input type="password" value={editUser.password} onChange={e=>setEditUser({...editUser,password:e.target.value})}/>)}
          <div className="actions"><button className="btn" onClick={()=>setEditUser(null)}>Cancelar</button><button className="btn primary" disabled={busy||!editUser.name.trim()||!editUser.email.includes("@")||(editUser.password.length>0&&editUser.password.length<12)} onClick={async()=>{const {id,name,email,password}=editUser;const ok=await act(()=>request(`partners/${selected.partner.id}/users/${id}`,{method:"PATCH",body:{name,email,...(password?{password}:{})}}),"Usuário atualizado.");if(ok){setEditUser(null);await openPartner(selected.partner);}}}>Salvar</button></div>
         </section>}
         {deleteUser&&<section className="card" style={{padding:14,display:"grid",gap:10}}><h4>Excluir usuário {deleteUser.email}</h4>
          <p className="muted">O acesso será desativado e o registro arquivado para auditoria, sem apagar histórico financeiro.</p>
          {field("Motivo da exclusão (opcional)",<textarea value={userDeleteReason} onChange={e=>setUserDeleteReason(e.target.value)}/>)}
          <div className="actions"><button className="btn" onClick={()=>setDeleteUser(null)}>Cancelar</button><button className="btn" disabled={busy} onClick={async()=>{const ok=await act(()=>request(`partners/${selected.partner.id}/users/${deleteUser.id}`,{method:"DELETE",body:{reason:userDeleteReason.trim()}}),"Usuário arquivado.");if(ok){setDeleteUser(null);await openPartner(selected.partner);}}}>Confirmar exclusão</button></div>
         </section>}
        </>}
       {(permits("network:resources:read")||permits("network:devices:read")||permits("network:billing:read"))&&
          <NetworkResources key={`${selected.partner.id}-${section}`} account={selected.partner} request={request} permits={permits} initialArea={selectedArea}/>}
       {newUser&&<div style={{display:"grid",gap:8}}><h4>Novo usuário do portal</h4><div className="row">{field("Nome",<input value={newUser.name} onChange={e=>setNewUser({...newUser,name:e.target.value})}/>)}{field("E-mail",<input type="email" value={newUser.email} onChange={e=>setNewUser({...newUser,email:e.target.value})}/>)}{field("Senha",<input type="password" value={newUser.password} onChange={e=>setNewUser({...newUser,password:e.target.value})}/>)}</div><div className="actions"><button className="btn" onClick={()=>setNewUser(null)}>Cancelar</button><button className="btn primary" disabled={busy||newUser.password.length<12} onClick={async()=>{const ok=await act(()=>request(`partners/${selected.partner.id}/users`,{method:"POST",body:newUser}),"Usuário criado.");if(ok){setNewUser(null);openPartner(selected.partner);}}}>Salvar usuário</button></div></div>}
     </div>}
   </>}
  </>}
 </div>;
}


// Lista operacional de TVs: nunca confundir contas comerciais com dispositivos físicos.
// A API exige ownership da conta e filtra as ativações pelo partnerId real.
function NetworkDevices({accounts,request,permits,accountPage,accountMeta,setAccountPage,accountQuery,setAccountQuery}){
 const [accountId,setAccountId]=useState("");
 const [devices,setDevices]=useState([]),[meta,setMeta]=useState(null);
 const [q,setQ]=useState(""),[status,setStatus]=useState(""),[page,setPage]=useState(1);
 const [showRemoved,setShowRemoved]=useState(false),[hiddenIds,setHiddenIds]=useState([]);
 const [loading,setLoading]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const [pending,setPending]=useState(null),[reason,setReason]=useState(""),[confirmMac,setConfirmMac]=useState("");
 const generation=useRef(0);
 useEffect(()=>{if(accountId&&!accounts.some(item=>item.id===accountId))setAccountId("");},[accounts,accountId]);
 useEffect(()=>{setPage(1);setDevices([]);setMeta(null);setPending(null);setHiddenIds([]);},[accountId,q,status,showRemoved]);
 const load=useCallback(async()=>{
  const n=++generation.current;
  if(!accountId){setDevices([]);setMeta(null);setLoading(false);return;}
  setLoading(true);setError("");
  try{
   const response=await request(`partners/${accountId}/devices`,{query:{page,pageSize:20,q:q||undefined,status:status||undefined,showRemoved:String(showRemoved)}});
   if(n!==generation.current)return;
   const items=response.data||[];
   setDevices(items);setMeta(response.meta||null);
  }catch(e){if(n===generation.current){setError(e.message||"Falha ao consultar TVs.");setDevices([]);setMeta(null);}}
  finally{if(n===generation.current)setLoading(false);}
 },[accountId,page,q,status,showRemoved,request]);
 useEffect(()=>{void load();return()=>{generation.current++;};},[load]);
 const shown=devices.filter(d=>!hiddenIds.includes(d.id));
 const bulk=useDeviceBulkActions({
  Modal, rows:shown,scope:JSON.stringify([accountId,q,page,status,showRemoved]),loading:loading||!accountId,
  request:(action,body)=>request(`partners/${accountId}/devices/bulk-${action}`,{method:"POST",body}),
  refresh:load,onOptimistic:ids=>setHiddenIds(old=>[...old,...ids]),
 });
 const change=async()=>{
  if(!pending)return;
  setLoading(true);setError("");setNotice("");
  try{
   if(pending.action==="delete"){
     await request(`partners/${accountId}/devices/${pending.id}`,{method:"DELETE",body:{confirmMac,reason:reason.trim()}});
   } else {
     await request(`partners/${accountId}/devices/${pending.id}/${pending.action}`,{method:"POST",body:{reason:reason.trim()}});
   }
   if(pending.action==="delete"||pending.action==="revoke")setHiddenIds(old=>[...old,pending.id]);
   setNotice("Operação registrada no histórico do dispositivo.");setPending(null);setReason("");setConfirmMac("");await load();
  }catch(e){setError(e.message||"Não foi possível atualizar o dispositivo.");}
  finally{setLoading(false);}
 };
 return <section className="card" style={{padding:20,display:"grid",gap:16}} aria-label="Gestão de TVs e dispositivos">
  <div><h3>TVs e dispositivos da rede</h3><p className="muted">Selecione a conta que possui os aparelhos. A lista mostra ativações reais, não cadastros de parceiros.</p></div>
  <div className="row" style={{flexWrap:"wrap",gap:10}}>
   {field("Buscar conta da rede",<input value={accountQuery} onChange={e=>setAccountQuery(e.target.value)} placeholder="Nome da conta"/>)}
   {field("Conta",<select value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="">Selecione o parceiro ou revenda</option>{accounts.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select>)}
   {field("Buscar MAC",<input value={q} onChange={e=>setQ(e.target.value)} placeholder="MAC do aparelho" disabled={!accountId}/>)}
   {field("Status",<select value={status} onChange={e=>setStatus(e.target.value)} disabled={!accountId}><option value="">Vínculos atuais</option><option value="active">Ativo</option><option value="blocked">Bloqueado</option><option value="revoked">Removido</option></select>)}
   <label><input type="checkbox" checked={showRemoved} disabled={!accountId} onChange={e=>setShowRemoved(e.target.checked)}/> Mostrar removidos</label>
   <button type="button" className="btn" disabled={!accountId||loading} onClick={()=>void load()}>Atualizar TVs</button>
  </div>
  {accountMeta?.totalPages>1&&<div className="row" style={{justifyContent:"space-between"}}><span className="muted">Contas: página {accountMeta.page} de {accountMeta.totalPages}</span><div className="actions"><button className="btn sm" disabled={accountPage<=1} onClick={()=>setAccountPage(p=>Math.max(1,p-1))}>Contas anteriores</button><button className="btn sm" disabled={accountPage>=accountMeta.totalPages} onClick={()=>setAccountPage(p=>p+1)}>Próximas contas</button></div></div>}
  {error&&<ErrorMessage message={error}/>} {notice&&<StatusMessage message={notice}/>}
  {!accountId?<p className="muted">Selecione uma conta para consultar seus dispositivos.</p>:<>
   {loading&&<p role="status">Atualizando dispositivos...</p>}
   <p className="muted">Desvincular mantém o dispositivo cadastrado. Excluir remove somente o vínculo da conta selecionada.</p>
   {permits("network:devices:write")&&bulk.toolbar}
   <div className="network-partner-table-scroll"><table className="table network-partner-table"><thead><tr><th>MAC / Dispositivo</th><th>Plataforma</th><th>Estado</th><th>Ações</th></tr></thead><tbody>
    {shown.map(d=><tr key={d.id}><td>{permits("network:devices:write")&&bulk.pick(d)}{d.mac||d.deviceId||"Sem identificador"}</td><td>{d.platform||d.device?.platform||"—"}</td><td>{({active:"Ativo",blocked:"Bloqueado",revoked:"Removido"})[d.status]||d.status||"—"}</td><td><div className="actions" style={{flexWrap:"wrap"}}>
     {permits("network:devices:write")&&d.status==="active"&&<button className="btn sm" type="button" onClick={()=>{setPending({id:d.id,action:"block",mac:d.mac});setReason("");}}>Bloquear</button>}
     {permits("network:devices:write")&&d.status==="blocked"&&<button className="btn sm" type="button" onClick={()=>{setPending({id:d.id,action:"unblock",mac:d.mac});setReason("");}}>Desbloquear</button>}
     {permits("network:devices:write")&&d.status!=="revoked"&&<button className="btn sm" type="button" onClick={()=>{setPending({id:d.id,action:"revoke",mac:d.mac});setReason("");}}>Desvincular</button>}
     {permits("network:devices:write")&&<button className="btn danger sm" type="button" onClick={()=>{setPending({id:d.id,action:"delete",mac:d.mac});setReason("");setConfirmMac("");}}>Excluir vínculo</button>}
    </div></td></tr>)}
   </tbody></table></div>
   {!loading&&shown.length===0&&<p className="muted">{devices.length?"Nenhum aparelho corresponde aos filtros.":"Nenhuma ativação encontrada para esta conta."}</p>}
   {meta&&<div className="row" style={{justifyContent:"space-between",flexWrap:"wrap"}}><span className="muted">{meta.total??0} ativação(ões) · página {meta.page||page} de {Math.max(1,meta.totalPages||1)}</span><div className="actions"><button className="btn sm" disabled={loading||page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Anterior</button><button className="btn sm" disabled={loading||page>=meta.totalPages} onClick={()=>setPage(p=>p+1)}>Próxima</button></div></div>}
   {pending&&<div className="card" style={{padding:16,display:"grid",gap:10}} role="group" aria-label="Confirmar ação no dispositivo">
    <h4>Confirmar {({block:"bloqueio",unblock:"desbloqueio",revoke:"desvinculação",delete:"exclusão definitiva"})[pending.action]} · {pending.mac||"Dispositivo"}</h4>
    <p className="muted">{pending.action==="revoke"?"A remoção revoga o acesso e pode apagar credenciais de configuração. Não é a exclusão permanente do registro.":"A ação modifica o acesso da TV e fica registrada na auditoria."}</p>
    {field(pending.action==="delete"?"Motivo obrigatório (mínimo 3 caracteres)":"Motivo da alteração",<textarea rows={2} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Descreva o motivo da alteração"/>)}
    {pending.action==="delete"&&field("Digite o MAC para confirmar",<input value={confirmMac} onChange={e=>setConfirmMac(e.target.value)} placeholder={pending.mac}/>)}
    <div className="actions"><button className="btn" onClick={()=>setPending(null)}>Cancelar</button><button className="btn primary" disabled={loading||(pending.action==="delete"&&(confirmMac!==pending.mac||reason.trim().length<3))} onClick={()=>void change()}>Confirmar ação</button></div>
   </div>}
  </>}
  <p className="muted">O cadastro/ativação inicial da TV usa o fluxo de licenças apropriado. Exclusão física definitiva continua exclusiva do Superadmin.</p>
 </section>;
}

// Recursos operacionais sempre associados à conta selecionada e ao Admin titular.
// Nenhuma chamada dessa seção usa endpoints globais da DeltaTV.
function NetworkResources({account,request,permits,initialArea="resources"}){
 const [area,setArea]=useState(initialArea),[dns,setDns]=useState([]),[codes,setCodes]=useState([]),
   [devices,setDevices]=useState([]),[invoices,setInvoices]=useState([]),
   [providerForm,setProviderForm]=useState(null),[codeForm,setCodeForm]=useState(null),
   [deleting,setDeleting]=useState(null),[deleteReason,setDeleteReason]=useState(""),
   [replacement,setReplacement]=useState(""),[force,setForce]=useState(false),
   [competence,setCompetence]=useState(new Date().toISOString().slice(0,7)),
   [saving,setSaving]=useState(false),[notice,setNotice]=useState("");
 const reloadResources=useCallback(async()=>{
   const base=`partners/${account.id}`;
   const tasks=[];
   if(permits("network:resources:read")){
     tasks.push(request(`${base}/providers`).then(r=>setDns(r.data||[])));
     tasks.push(request(`${base}/codes`).then(r=>setCodes(r.data||[])));
   }
   if(permits("network:devices:read"))tasks.push(request(`${base}/devices`,{query:{pageSize:30}}).then(r=>setDevices(r.data||[])));
   if(permits("network:billing:read"))tasks.push(request(`${base}/invoices`).then(r=>setInvoices(r.data||[])));
   const outcome=await Promise.allSettled(tasks);
   const bad=outcome.find(r=>r.status==="rejected");if(bad)setNotice(bad.reason?.message||"Falha ao carregar recursos.");
 },[account.id,request]);
 useEffect(()=>{void reloadResources();},[reloadResources]);
 const submit=async(path,body,method="POST")=>{
   setSaving(true);setNotice("");
   try{await request(`partners/${account.id}/${path}`,{method,body});await reloadResources();setNotice("Operação registrada.");return true;}
   catch(e){setNotice(e.message||"Não foi possível salvar.");return false;}
   finally{setSaving(false);}
 };
 const previewDeletion=async(kind,item)=>{
  setNotice("");setDeleting(null);setDeleteReason("");setReplacement("");setForce(false);
  try{
   const path=kind==="provider"?`providers/${item.id}`:`codes/${item.id}`;
   const preview=await request(`partners/${account.id}/${path}/deletion-preview`);
   setDeleting({kind,item,preview});
  }catch(e){setNotice(e.message||"Não foi possível consultar impacto da exclusão.");}
 };
 const confirmDeletion=async()=>{
  if(!deleting)return;
  const path=deleting.kind==="provider"?`providers/${deleting.item.id}`:`codes/${deleting.item.id}`;
  const body={reason:deleteReason.trim(),
   ...(deleting.kind==="provider"?{replacementProviderId:replacement||null,force}: {})};
  if(await submit(path,body,"DELETE")){setDeleting(null);setProviderForm(null);setCodeForm(null);}
 };
 return <section style={{display:"grid",gap:12,borderTop:"1px solid var(--border, #d5d5d5)",paddingTop:12}}>
  <h4>Recursos desta conta</h4>
  <div className="row" style={{gap:8,flexWrap:"wrap"}}>
   {permits("network:resources:read")&&<button className="btn sm" onClick={()=>setArea("resources")}>DNS e códigos</button>}
   {permits("network:devices:read")&&<button className="btn sm" onClick={()=>setArea("devices")}>Dispositivos</button>}
   {permits("network:billing:read")&&<button className="btn sm" onClick={()=>setArea("billing")}>Faturas</button>}
  </div>
  {notice&&<div className="notice" role="status">{notice}</div>}
  {area==="resources"&&permits("network:resources:read")&&<>
    <h5>DNS/servidores — {dns.length}</h5>
    {dns.length?dns.map(item=><div className="row" key={item.id} style={{justifyContent:"space-between",flexWrap:"wrap",gap:8}}><span>{item.name} · {item.baseUrl} · {item.status}</span>
     {permits("network:resources:write")&&<div className="actions"><button className="btn sm" onClick={()=>setProviderForm({id:item.id,name:item.name,baseUrl:item.baseUrl,deliveryMode:item.deliveryMode||"redirect",status:item.status||"active",priority:item.priority||0,playlistTemplate:item.playlistTemplate})}>Editar</button>
      <button className="btn sm" onClick={()=>void previewDeletion("provider",item)}>Excluir</button></div>}
    </div>):<p className="muted">Nenhum servidor cadastrado.</p>}
    {permits("network:resources:write")&&<>
      {!providerForm?<button className="btn sm" onClick={()=>setProviderForm({name:"",baseUrl:"",deliveryMode:"redirect"})}>Adicionar DNS</button>:
      <div className="card" style={{padding:12,display:"grid",gap:10}}><h5>{providerForm.id?"Editar DNS":"Novo DNS"}</h5>
       {field("Nome",<input value={providerForm.name} onChange={e=>setProviderForm({...providerForm,name:e.target.value})}/>)}
       {field("Endereço do servidor",<input placeholder="https://exemplo.com" value={providerForm.baseUrl} onChange={e=>setProviderForm({...providerForm,baseUrl:e.target.value})}/>)}
       {field("Entrega",<select value={providerForm.deliveryMode} onChange={e=>setProviderForm({...providerForm,deliveryMode:e.target.value})}><option value="redirect">Redirect</option><option value="proxy">Proxy</option></select>)}
       {providerForm.id&&field("Situação",<select value={providerForm.status} onChange={e=>setProviderForm({...providerForm,status:e.target.value})}><option value="active">Ativo</option><option value="disabled">Desativado</option></select>)}
       <div className="actions"><button className="btn" onClick={()=>setProviderForm(null)}>Cancelar</button>
         <button className="btn primary" disabled={saving||!providerForm.name||!providerForm.baseUrl} onClick={async()=>{const {id,...body}=providerForm;if(await submit(id?`providers/${id}`:"providers",body,id?"PATCH":"POST"))setProviderForm(null);}}>Salvar DNS</button></div>
      </div>}
    </>}
    <h5>Códigos — {codes.length}</h5>
    {account.kind==="reseller"&&<p className="muted">Para emitir códigos de Revenda, use o fluxo de licenças das TVs autorizado pela DeltaTV. Esta tela não emite licenças.</p>}
    {codes.map(c=><div className="row" key={c.id} style={{justifyContent:"space-between",flexWrap:"wrap",gap:8}}><span>{c.code} · {c.label||"Sem nome"} · {c.status||"—"}</span>
      {permits("network:resources:write")&&<div className="actions"><button className="btn sm" onClick={()=>setCodeForm({id:c.id,code:c.code,label:c.label||"",providerId:c.providerId||"",maxActivations:c.maxActivations??""})}>Editar</button>
      {c.status!=="revoked"&&<button className="btn sm" onClick={()=>void submit(`codes/${c.id}/revoke`,{},"POST")}>Revogar</button>}
      <button className="btn sm" onClick={()=>void previewDeletion("code",c)}>Excluir</button></div>}
    </div>)}
    {permits("network:resources:write") && account.kind!=="reseller" && <>
       {!codeForm?<button className="btn sm" onClick={()=>setCodeForm({code:"",label:"",providerId:""})}>Criar código de ativação</button>:
       <div className="card" style={{padding:12,display:"grid",gap:10}}><h5>{codeForm.id?"Editar código":"Novo código"}</h5>
         {!codeForm.id&&field("Código (opcional, gera automático)",<input value={codeForm.code} onChange={e=>setCodeForm({...codeForm,code:e.target.value})}/>)}
         {codeForm.id&&<p className="muted">Código: {codeForm.code} (identificador imutável)</p>}
         {field("Descrição",<input value={codeForm.label} onChange={e=>setCodeForm({...codeForm,label:e.target.value})}/>)}
         {field("DNS principal",<select value={codeForm.providerId} onChange={e=>setCodeForm({...codeForm,providerId:e.target.value})}><option value="">Automático</option>{dns.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select>)}
         <div className="actions"><button className="btn" onClick={()=>setCodeForm(null)}>Cancelar</button>
         <button className="btn primary" disabled={saving} onClick={async()=>{const b={label:codeForm.label||"",providerId:codeForm.providerId||null,...(!codeForm.id&&codeForm.code?{code:codeForm.code}:{})};if(await submit(codeForm.id?`codes/${codeForm.id}`:"codes",b,codeForm.id?"PATCH":"POST"))setCodeForm(null);}}>{codeForm.id?"Salvar alterações":"Criar"}</button></div>
       </div>}
    </>}
   {deleting&&<div className="card" style={{padding:16,display:"grid",gap:10,border:"1px solid var(--danger,#c2414e)"}} role="group" aria-label="Confirmar exclusão de recurso">
    <h5>Excluir {deleting.kind==="provider"?"servidor":"código"}: {deleting.kind==="provider"?deleting.item.name:deleting.item.code}</h5>
    <p className="muted">Exclusão operacional com auditoria. Histórico financeiro e licenças existentes são preservados.</p>
    <p>{deleting.preview.warning||"Confira os vínculos antes de continuar."}</p>
    <p className="muted">Ativações em uso: {deleting.preview.liveActivations??0} · Códigos vinculados: {deleting.preview.codes??0} · Pools: {deleting.preview.pools??0}</p>
    {deleting.kind==="provider"&&<>
      {field("Servidor substituto",<select value={replacement} onChange={e=>setReplacement(e.target.value)}><option value="">Nenhum</option>{(deleting.preview.alternatives||[]).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>)}
      {(deleting.preview.liveActivations>0&&!replacement)&&<label><input type="checkbox" checked={force} onChange={e=>setForce(e.target.checked)}/> Confirmo o risco de interrupção das TVs sem substituto.</label>}
    </>}
    {field("Motivo da exclusão (opcional)",<textarea rows={2} value={deleteReason} onChange={e=>setDeleteReason(e.target.value)}/>)}
    <div className="actions"><button className="btn" onClick={()=>setDeleting(null)}>Cancelar</button>
      <button className="btn" disabled={saving||(deleting.kind==="provider"&&deleting.preview.liveActivations>0&&!replacement&&!force)} onClick={()=>void confirmDeletion()}>Confirmar exclusão</button></div>
   </div>}
  </>}
  {area==="devices"&&permits("network:devices:read")&&<div style={{display:"grid",gap:8}}>
    <h5>Ativações recentes (até 30)</h5>
    {devices.length?devices.map(a=><div className="row" key={a.id}><span>{a.mac||a.deviceId} · {a.status} · {a.platform||"—"}</span></div>):<p className="muted">Nenhuma ativação registrada.</p>}
  </div>}
  {area==="billing"&&permits("network:billing:read")&&<div style={{display:"grid",gap:9}}>
    <h5>Faturas</h5>
    {invoices.map(i=><div key={i.id} className="row">{i.competence} · {currency(i.totalCents||i.amountCents||0)} · {i.status}</div>)}
    {!invoices.length&&<p className="muted">Nenhuma fatura registrada.</p>}
    {permits("network:billing:write")&&<div className="row">{field("Competência",<input type="month" value={competence} onChange={e=>setCompetence(e.target.value)}/>)}<button className="btn primary" disabled={saving} onClick={()=>submit("invoices",{competence})}>Emitir fatura</button></div>}
  </div>}
 </section>;
}

export {LABELS};
