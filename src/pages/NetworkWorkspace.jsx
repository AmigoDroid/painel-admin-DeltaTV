import { Modal, Badge, RowMenu } from "../ui.jsx";
import PartnerDetailModal from "./PartnerDetailModal.jsx";
import Devices from "./Devices.jsx";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {api,getAuth} from "../api.js";
import {addMonthsClamped} from "../workspace-dates.js";
import {toCents,formatBRL} from "@deltatv/ui/money";
import {PlanTechnicalOptions,PlanVisibilityOption} from "./PlanCommonFields.jsx";

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
const currency=formatBRL;
const nextMonth=()=>addMonthsClamped();
const blankPlan=()=>({name:"",description:"",audience:"both",monthlyPrice:"0.00",maxServers:"5",noDnsLimit:false,activationLimit:"100",noActivationLimit:false,validityDays:"30",
  autoFailover:true,autoPriority:false,emailAlerts:false,detailedHistory:false,hiddenFromNetwork:false});
const blankAccount=kind=>({name:'',email:'',password:'',kind,planKey:''});
const blankInvite=(kind='content')=>({mode:'link',kind,email:'',planKey:'',label:'',sendEmail:false,maxUses:10,validityDays:7});
const permsOf=user=>new Set(user?.permissions||[]);
const field=(name,child)=><label className="field" style={{display:"grid",gap:5}}><span>{name}</span>{child}</label>;
function ErrorMessage({message}){return message?<div className="notice error" role="alert" style={{position:"fixed",top:16,right:16,zIndex:2147483647,maxWidth:"min(560px,calc(100vw - 32px))",boxShadow:"0 12px 36px #0008"}}>{message}</div>:null;}
function PartnerBadge({partner}) {return partner.pending ? <Badge status="pending" label="Novo cadastro"/> : <Badge status={partner.effectiveStatus}/>;}
function StatusMessage({message}){return message?<div className="notice" role="status">{message}</div>:null;}

const SECTION_TABS = Object.freeze({
  partners:"partners",resellers:"resellers",plans:"plans",invitations:"partners",devices:"partners",
  resources:"partners",billing:"partners",members:"partners",
});
const SECTION_NAMES = Object.freeze({
  dashboard:"Visão geral",workspace:"Minha rede",partners:"Parceiros",resellers:"Revendas",
  plans:"Planos e recursos",invitations:"Links de convite",resources:"DNS e códigos",devices:"TVs e dispositivos",
  billing:"Financeiro da rede",members:"Usuários dos portais",audit:"Auditoria da rede",trash:"Lixeira da minha rede",
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
 const [selected,setSelected]=useState(null);
 const [trashRows,setTrashRows]=useState([]),[trashMeta,setTrashMeta]=useState(null),[restoring,setRestoring]=useState(null),[restoreReason,setRestoreReason]=useState("");
 const [deletingPlan,setDeletingPlan]=useState(null),[planDeletePreview,setPlanDeletePreview]=useState(null),[planDeleteReason,setPlanDeleteReason]=useState(""),
 [planForm,setPlanForm]=useState(null),[accountForm,setAccountForm]=useState(null),[editingAccount,setEditingAccount]=useState(null);
 const [inviteForm,setInviteForm]=useState(null),[inviteResult,setInviteResult]=useState(null),
  [invitations,setInvitations]=useState([]),[invitePage,setInvitePage]=useState(1),[inviteMeta,setInviteMeta]=useState(null),
  [registrations,setRegistrations]=useState(null),[editingInvite,setEditingInvite]=useState(null);
 const [q,setQ]=useState(""),[search,setSearch]=useState(""),[partnerStatus,setPartnerStatus]=useState(""),[page,setPage]=useState(1),[pageMeta,setPageMeta]=useState(null),
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
   if(section==="trash"&&(permits("network:partners:delete")||permits("network:resellers:delete")))
     jobs.push(request("trash",{query:{page,pageSize:20,q:search}}).then(v=>{if(requestGeneration.current===generation){setTrashRows(v.data||[]);setTrashMeta(v.meta);}}));
   if(section==="audit"&&permits("network:audit:read"))jobs.push(request("audit").then(v=>{if(requestGeneration.current===generation)setAuditRows(v.data||[]);}));
   if(section!=="trash"&&showWorkspaceManager&&permits("network:plans:read"))jobs.push(request("plans").then(v=>{if(requestGeneration.current===generation)setPlans(v.data||[]);}));
   if(section!=="trash"&&showWorkspaceManager&&(permits('network:partners:write')||permits('network:resellers:write'))){
     jobs.push(request('invitations',{query:{page:invitePage,pageSize:20}}).then(v=>{if(requestGeneration.current===generation){setInvitations(v.data||[]);setInviteMeta(v.meta||null);}}));
     jobs.push(request('invitations/plans').then(v=>{if(requestGeneration.current===generation)setInvitePlans(v.data||[]);}));
   }
   if(section!=="trash"&&showWorkspaceManager&&(permits("network:partners:read")||permits("network:resellers:read")||
      permits("network:devices:read")||permits("network:resources:read")||
      permits("network:billing:read")||permits("network:members:read")))
     jobs.push(request("partners",{query:{pageSize:20,page,q:search,status:partnerStatus||undefined,kind:tab==="plans"?undefined:tab==="resellers"?"reseller":scopedSection&&tab==="partners"&&section!=="partners"?undefined:"content"}})
       .then(v=>{if(requestGeneration.current===generation){setPartners(v.data||[]);setPageMeta(v.meta||null);}}));
   const failures=await Promise.allSettled(jobs);
   const first=failures.find(x=>x.status==="rejected");if(first&&requestGeneration.current===generation)setError(first.reason?.message||"Falha ao carregar a rede.");
 },[available,request,page,search,partnerStatus,tab,section,showWorkspaceManager,invitePage,viewer?.id,viewer?.role,viewer?.permissions]);
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
 const openPartner=(p, initialEdit=false)=>{
   setError("");
   // A ficha compartilha a consulta segura com o Superadmin; evita GET duplicado.
   setSelected({partner:p,initialEdit});
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
   const body={name:f.name,description:f.description,audience:"both",monthlyPriceCents:parsed,
    maxServers:f.noDnsLimit?null:Number(f.maxServers),
    activationLimit:f.noActivationLimit?null:Number(f.activationLimit),
    validityDays:Number(f.validityDays),autoFailover:f.autoFailover,autoPriority:f.autoPriority,
    emailAlerts:f.emailAlerts,detailedHistory:f.detailedHistory,hiddenFromNetwork:!!f.hiddenFromNetwork};
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
 const planOptions=()=>plans.filter(p=>p.active);
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
  <div className="page-head"><h2>{central?"Administração das redes":section==="plans"?"Planos que ofereço":SECTION_NAMES[section]||"Minha rede"}</h2>
    <p className="muted">{section==="dashboard"?"Acompanhe os números e acesse as ferramentas liberadas para sua rede.":
       section==="devices"||section==="resources"||section==="billing"||section==="members"?
         "Selecione uma conta da sua rede para acessar os dados e ações autorizados.":
         "Todos os registros nesta página pertencem à sua rede. Os dados da DeltaTV e de outros Admins ficam separados."}</p></div>
  {central&&<div className="card" style={{padding:16}}>{field("Admin responsável pela rede",<select value={adminId} onChange={e=>{requestGeneration.current++;setAdminId(e.target.value);setPage(1);setQ("");setPartners([]);setPlans([]);setInvitations([]);setInvitePage(1);setInviteMeta(null);setInvitePlans([]);setRegistrations(null);setInviteResult(null);setInviteForm(null);setPageMeta(null);setOverview(null);setSelected(null);setPartnerStatus("");}}><option value="">Selecione uma rede</option><option value="deltatv">DeltaTV — rede principal</option>{admins.map(a=><option key={a.id} value={a.id}>{a.name} — {a.email}</option>)}</select>)}</div>}
  {!central && permissions.size === 0 && <div className="card" role="status" style={{padding:20,display:"grid",gap:8}}>
    <h3>Permissões de administração ainda não configuradas</h3>
    <p>Seu usuário é Admin, mas a DeltaTV ainda não liberou funções para sua rede. Solicite que a DeltaTV acesse Usuários, edite sua conta e selecione as permissões necessárias.</p>
    <p className="muted">A sua conta operacional de Parceiro/Revenda pode continuar ativa separadamente. Nenhum dado foi excluído por esta mensagem.</p>
  </div>}
  {!available?<p className="muted">Selecione um Admin para abrir os cadastros de sua rede.</p>:<>
   {section==="trash"&&<section className="card" style={{padding:20,display:"grid",gap:12}}>
     <h3>Contas arquivadas desta rede</h3>
     <input aria-label="Pesquisar contas arquivadas" placeholder="Pesquisar na lixeira" value={q} onChange={e=>setQ(e.target.value)}/>
     {trashRows.length?trashRows.map(item=><div className="row" key={item.id} style={{justifyContent:"space-between",flexWrap:"wrap",gap:10,borderBottom:"1px solid var(--border,#334155)",paddingBottom:12}}>
       <span><strong>{item.name}</strong> · {item.kind==="reseller"?"Revenda":"Parceiro"} · {item.statusReason||"Arquivada"}</span>
       <button className="btn sm" onClick={()=>{setRestoring(item);setRestoreReason("");}}>Restaurar</button>
     </div>):<p className="muted">Nenhuma conta arquivada nesta rede.</p>}
     {trashMeta&&trashMeta.totalPages>1&&<div className="actions">
       <button className="btn sm" disabled={page===1} onClick={()=>setPage(v=>v-1)}>Anterior</button>
       <span>Página {trashMeta.page} de {trashMeta.totalPages}</span>
       <button className="btn sm" disabled={page===trashMeta.totalPages} onClick={()=>setPage(v=>v+1)}>Próxima</button>
     </div>}
     {restoring&&<Modal title={`Restaurar ${restoring.name}`} onClose={()=>setRestoring(null)}>
       <h4>Restaurar {restoring.name}</h4><p>O estado anterior será restaurado quando houver fotografia de exclusão. O acesso pode precisar de revisão.</p>
       {field("Motivo da restauração",<textarea minLength={8} maxLength={400} value={restoreReason} onChange={e=>setRestoreReason(e.target.value)}/>)}
       <div className="actions"><button className="btn" onClick={()=>setRestoring(null)}>Cancelar</button>
        <button className="btn primary" disabled={busy||restoreReason.trim().length<8} onClick={async()=>{
          const ok=await act(()=>request(`trash/${restoring.id}/restore`,{method:"POST",body:{reason:restoreReason.trim()}}),"Conta restaurada na própria rede.");
          if(ok){setRestoring(null);setRestoreReason("");}
        }}>Confirmar restauração</button></div>
     </Modal>}
   </section>}
   {section==="audit"&&permits("network:audit:read")&&<section className="card" style={{padding:20}}><h3>Histórico de ações na rede</h3>
     <p className="muted">Eventos relacionados às contas da sua rede. Auditoria global da plataforma permanece exclusiva da DeltaTV.</p>
     {auditRows.length?<div style={{display:"grid",gap:8}}>{auditRows.map(row=><div key={row.id} className="row" style={{justifyContent:"space-between",borderBottom:"1px solid var(--border,#334155)",paddingBottom:8}}>
       <span>{row.partnerName} · {row.action} · {row.result}</span><time>{new Date(row.createdAt).toLocaleString("pt-BR")}</time>
     </div>)}</div>:<p className="muted">Nenhum evento recente na sua rede.</p>}
   </section>}
   {overview&&<div className="grid cards" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
     {[{label:"Parceiros",value:overview.partners},{label:"Revendas",value:overview.resellers},
       {label:"Parceiros ativos",value:overview.activePartners},{label:"Revendas ativas",value:overview.activeResellers},
       {label:"Expirados",value:overview.expired},{label:"Novos cadastros",value:overview.pending},
       {label:"Planos",value:overview.plans}].map(x=><div className="card" key={x.label} style={{padding:16}}><small>{x.label}</small><h2>{x.value}</h2></div>)}
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
   {section !== "dashboard" && section!=="audit" && section!=="trash" && showWorkspaceManager && <div className="toolbar" style={{display:"flex",flexWrap:"wrap",gap:8}}>
     {section === "workspace" && central && [["partners","Parceiros","network:partners:read"],["resellers","Revendas","network:resellers:read"],["plans","Planos e recursos","network:plans:read"]]
       .filter(x=>permits(x[2])).map(([key,name])=><button key={key} className={`btn ${tab===key?"primary":""}`} onClick={()=>{setTab(key);setPage(1);setSelected(null);setEditingAccount(null);setPlanForm(null);}}>{name}</button>)}
     <button className="btn" onClick={()=>void reload()}>Atualizar</button>
   </div>}
   {section !== "dashboard" && section!=="audit" && section!=="trash" && showWorkspaceManager && tab==="plans"&&permits("network:plans:read")&&<>
     {permits("network:plans:write")&&<div><button className="btn primary" onClick={()=>setPlanForm(blankPlan())}>Novo plano</button></div>}
     {planForm&&<div className="card" style={{display:"grid",gap:12,padding:20}}>
       <h3>{planForm.key?"Editar plano":"Novo plano"}</h3>
       <div className="row">{field("Nome",<input value={planForm.name} onChange={e=>setPlanForm({...planForm,name:e.target.value})}/>)}
       {field("Mensalidade (R$)",<input type="number" min="0" step="0.01" value={planForm.monthlyPrice} onChange={e=>setPlanForm({...planForm,monthlyPrice:e.target.value})}/>)}</div>
       {field("Descrição",<input value={planForm.description} onChange={e=>setPlanForm({...planForm,description:e.target.value})}/>)}
       <div className="row">{field("DNS por código",<><input type="number" min="1" disabled={planForm.noDnsLimit} value={planForm.maxServers} onChange={e=>setPlanForm({...planForm,maxServers:e.target.value})}/><label><input type="checkbox" checked={planForm.noDnsLimit} onChange={e=>setPlanForm({...planForm,noDnsLimit:e.target.checked})}/> Sem limite</label></>)}</div>
       <div className="row">{field('Ativações',<><input type="number" min="0" disabled={planForm.noActivationLimit} value={planForm.activationLimit} onChange={e=>setPlanForm({...planForm,activationLimit:e.target.value})}/><label><input type="checkbox" checked={planForm.noActivationLimit} onChange={e=>setPlanForm({...planForm,noActivationLimit:e.target.checked})}/> Sem limite</label></>)}
         {field('Validade inicial do acesso (dias)',<input type="number" min="1" max="3660" value={planForm.validityDays} onChange={e=>setPlanForm({...planForm,validityDays:e.target.value})}/>)}</div>
       <PlanTechnicalOptions className="row" plan={planForm} onChange={(key,value)=>setPlanForm({...planForm,[key]:value,...(key==="autoFailover"&&!value?{autoPriority:false}:{})})}/>
       <PlanVisibilityOption hidden={planForm.hiddenFromNetwork} onChange={value=>setPlanForm({...planForm,hiddenFromNetwork:value})}/>
       <div className="actions"><button className="btn" onClick={()=>setPlanForm(null)}>Cancelar</button><button className="btn primary" disabled={busy||!planForm.name} onClick={savePlan}>Salvar plano</button></div>
     </div>}
     <div className="card" style={{padding:16}}><h3>Planos que você oferece aos parceiros e revendas</h3><p className="muted">Este catálogo é da sua rede. O plano contratado por uma conta aparece no portal dela e não deve ser confundido com os planos de oferta.</p>
       {plans.length?<table className="table"><thead><tr><th>Plano</th><th>Preço mensal</th><th>DNS</th><th>Ativações</th><th>Validade</th><th>Gerenciar</th></tr></thead><tbody>{plans.map(p=><tr key={p.key}><td>{p.name} {p.hiddenFromNetwork&&<span className="pill">Oculto</span>}</td><td>{currency(p.monthlyPriceCents)}</td><td>{p.maxServers??"Sem limite"}</td><td>{p.activationLimit??"Sem limite"}</td><td>{p.validityDays??30} dias · {p.active?"Ativo":"Inativo"}</td><td>{permits("network:plans:write")&&<div className="actions"><button className="btn sm" onClick={()=>setPlanForm({key:p.key,name:p.name,description:p.description,audience:"both",monthlyPrice:(p.monthlyPriceCents/100).toFixed(2),maxServers:String(p.maxServers??""),noDnsLimit:p.maxServers==null,activationLimit:String(p.activationLimit??''),noActivationLimit:p.activationLimit==null,validityDays:String(p.validityDays??30),autoFailover:p.autoFailover,autoPriority:p.autoPriority,emailAlerts:p.emailAlerts,detailedHistory:p.detailedHistory,hiddenFromNetwork:!!p.hiddenFromNetwork})}>Editar</button><button className="btn sm" disabled={busy} onClick={()=>void act(()=>request(`plans/${p.key}`,{method:"PUT",body:{active:!p.active}}),p.active?"Plano desativado.":"Plano reativado.")}>{p.active?"Desativar":"Reativar"}</button><button className="btn sm" disabled={busy} onClick={()=>void previewPlanDeletion(p)}>Excluir</button></div>}</td></tr>)}</tbody></table>:<p className="muted">Nenhum plano criado nesta rede.</p>}
     </div>
   </>}
   {deletingPlan&&<Modal title="Excluir plano" onClose={()=>setDeletingPlan(null)}>
     <h3>Excluir plano: {deletingPlan.name}</h3>
     {planDeletePreview?<><p>{planDeletePreview.warning}</p><p>Contas vinculadas: {planDeletePreview.accounts} · Convites históricos: {planDeletePreview.invitations}</p></>:<p>Consultando os vínculos...</p>}
     {field("Motivo da exclusão (opcional)",<input value={planDeleteReason} onChange={e=>setPlanDeleteReason(e.target.value)} placeholder="Opcional"/>)}
     <div className="actions"><button className="btn" onClick={()=>{setDeletingPlan(null);setPlanDeletePreview(null);}}>Cancelar</button>
       <button className="btn danger" disabled={busy||!planDeletePreview} onClick={()=>void confirmPlanDeletion()}>Confirmar exclusão</button></div>
   </Modal>}
   {section !== "dashboard" && section!=="audit" && section!=="trash" && showWorkspaceManager && tab!=="plans"&&canBrowse&&<>
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
           <option value="">Escolha o plano</option>{invitePlans.map(p=><option key={p.key} value={p.key}>{p.name} · {currency(p.monthlyPriceCents)}</option>)}
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
     {accountForm&&<Modal title="Nova conta da rede" onClose={()=>setAccountForm(null)} wide>{renderAccountForm(accountForm,setAccountForm)}</Modal>}
     {editingAccount&&<Modal title="Editar conta da rede" onClose={()=>setEditingAccount(null)} wide>{renderAccountForm(editingAccount,setEditingAccount,true)}</Modal>}
     {section==="devices"&&permits("network:devices:read")&&(!central?<Devices scoped />:<p className="muted">Para gerenciar dispositivos por MAC de uma rede delegada, use a área de dispositivos da conta correspondente. Esta visão central não possui API de MAC com seleção de rede.</p>)}
     {section!=="invitations"&&section!=="devices"&&section!=="trash"&&<div className="card network-partner-panel" style={{padding:16}}>
       <div className="row" style={{justifyContent:"space-between",alignItems:"center"}}><h3>{section==="devices"||section==="resources"||section==="billing"||section==="members"?"Contas da minha rede":tab==="resellers"?"Minhas revendas":"Meus parceiros"}</h3>
        <div className="actions" style={{flexWrap:"wrap"}}>
         <input aria-label="Buscar contas nesta rede" placeholder="Buscar nesta rede" value={q} onChange={e=>setQ(e.target.value)}/>
         <select aria-label="Filtrar status das contas" value={partnerStatus} onChange={e=>{setPartnerStatus(e.target.value);setPage(1);setSelected(null);}}>
          <option value="">Todos os status</option><option value="pending">Aguardando aprovação</option>
          <option value="active">Ativos</option><option value="expired">Expirados</option>
          <option value="suspended">Suspensos</option><option value="blocked">Bloqueados</option><option value="cancelled">Cancelados</option>
         </select>
        </div></div>
       {visibleAccounts.length?<div className="network-partner-table-scroll"><table className="table network-partner-table">
         <thead><tr><th>{tab==="resellers"?"Revenda":"Parceiro"}</th><th>Status</th><th>Portal</th><th>Mensalidade</th><th>Dispositivos</th><th>Término</th><th>Ações</th></tr></thead>
         <tbody>{visibleAccounts.map(p=><tr key={p.id}>
           <td><strong>{p.name}</strong><div className="muted">{p.slug||""}</div></td>
           <td><PartnerBadge partner={p}/></td><td className="muted">—</td>
           <td>{p.monthlyFeeCents == null ? "—" : currency(p.monthlyFeeCents)}</td>
           <td>{p.deviceCount ?? (p.deviceLimit != null ? `— / ${p.deviceLimit}` : "—")}</td>
           <td>{p.endsAt ? new Date(p.endsAt).toLocaleDateString("pt-BR") : "—"}</td>
           <td className="actions"><button className="btn sm" onClick={()=>openPartner(p)}>Gerenciar</button>
             <RowMenu items={[{label:"Gerenciar",onClick:()=>openPartner(p)},
               {label:"Editar",hidden:!permits(p.kind==="reseller"?"network:resellers:write":"network:partners:write")||(p.kind==="both"&&!permits("network:resellers:write")),onClick:()=>openPartner(p,true)}]}/></td>
         </tr>)}</tbody></table></div>:<p className="muted">Nenhuma conta corresponde à pesquisa nesta rede.</p>}
       {pageMeta&&<nav className="row" aria-label="Páginas de contas" style={{justifyContent:"space-between",marginTop:12,flexWrap:"wrap"}}>
         <span className="muted">{pageMeta.total} conta(s) · página {pageMeta.page} de {Math.max(1,pageMeta.totalPages)}</span>
         <div className="actions"><button className="btn sm" disabled={page<=1||busy} onClick={()=>setPage(x=>Math.max(1,x-1))}>Anterior</button>
         <button className="btn sm" disabled={page>=pageMeta.totalPages||busy} onClick={()=>setPage(x=>x+1)}>Próxima</button></div>
       </nav>}
     </div>}
     {section!=="devices"&&section!=="trash"&&selected?.partner?.id && <PartnerDetailModal
       key={`${selected.partner.id}-${central?adminId:"network"}`}
       id={selected.partner.id} partnerName={selected.partner.name} initialEdit={selected.initialEdit}
       role="admin" basePath="/admin/workspace/partners"
       query={central?{adminId}:{}} permits={permits}
       initialTab={section==="resources"?"codes":section==="billing"?"invoices":section==="members"?"users":null}
       onClose={()=>setSelected(null)} onChanged={reload} />}
   </>}
  </>}
 </div>;
}



export { LABELS };
