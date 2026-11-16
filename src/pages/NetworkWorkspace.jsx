import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {api,getAuth} from "../api.js";
import {addMonthsClamped} from "../workspace-dates.js";

// Administração de rede isolada: nenhum componente desta tela usa APIs globais
// como /admin/partners, /admin/dashboard ou /admin/service-plans.
const LABELS={
 "network:dashboard:read":"Visão geral",
 "network:partners:read":"Ver parceiros", "network:partners:write":"Cadastrar/editar parceiros",
 "network:resellers:read":"Ver revendas", "network:resellers:write":"Cadastrar/editar revendas",
 "network:plans:read":"Consultar planos", "network:plans:write":"Criar e editar planos",
 "network:members:read":"Consultar usuários", "network:members:write":"Cadastrar usuários do portal",
 "network:resources:read":"Ver códigos e DNS", "network:resources:write":"Editar códigos e DNS",
 "network:devices:read":"Ver dispositivos", "network:billing:read":"Ver faturas", "network:billing:write":"Emitir faturas",
};
const currency=cents=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format((Number(cents)||0)/100);
const toCents=value=>Math.round(Number(String(value).replace(",","."))*100);
const nextMonth=()=>addMonthsClamped();
const blankPlan=()=>({name:"",description:"",audience:"content",monthlyPrice:"0,00",maxServers:"5",noDnsLimit:false,
  autoFailover:true,autoPriority:false,emailAlerts:false,detailedHistory:false});
const blankAccount=kind=>({name:"",slug:"",kind,planKey:"",monthlyFee:"0,00",activationLimit:"100",noActivationLimit:false,
  dnsLimit:"5",noDnsLimit:false,endsAt:nextMonth(),contactName:"",contactEmail:"",contactPhone:"",portalName:"",portalEmail:"",portalPassword:""});
const permsOf=user=>new Set(user?.permissions||[]);
const field=(name,child)=><label className="field" style={{display:"grid",gap:5}}><span>{name}</span>{child}</label>;
function ErrorMessage({message}){return message?<div className="notice error" role="alert">{message}</div>:null;}
function StatusMessage({message}){return message?<div className="notice" role="status">{message}</div>:null;}
const between=(min,max)=>value=>Number.isInteger(Number(value))&&Number(value)>=min&&Number(value)<=max;

export default function NetworkWorkspace(){
 const viewer=useMemo(()=>getAuth()?.user,[]);
 const central=viewer?.role==="superadmin";
 const permissions=permsOf(viewer);
 const permits=key=>central||permissions.has(key);
 const [admins,setAdmins]=useState([]);
 const [adminId,setAdminId]=useState(()=>central?sessionStorage.getItem("deltatv-selected-admin")||"":"");
 const [tab,setTab]=useState("partners");
 const [overview,setOverview]=useState(null),[plans,setPlans]=useState([]),[partners,setPartners]=useState([]);
 const [selected,setSelected]=useState(null);
 const [planForm,setPlanForm]=useState(null),[accountForm,setAccountForm]=useState(null),[editingAccount,setEditingAccount]=useState(null);
 const [newUser,setNewUser]=useState(null);
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
   if(permits("network:plans:read"))jobs.push(request("plans").then(v=>{if(requestGeneration.current===generation)setPlans(v.data||[]);}));
   if(permits("network:partners:read")||permits("network:resellers:read"))
     jobs.push(request("partners",{query:{pageSize:20,page,q:search,kind:tab==="plans"?undefined:tab==="resellers"?"reseller":"content"}})
       .then(v=>{if(requestGeneration.current===generation){setPartners(v.data||[]);setPageMeta(v.meta||null);}}));
   const failures=await Promise.allSettled(jobs);
   const first=failures.find(x=>x.status==="rejected");if(first&&requestGeneration.current===generation)setError(first.reason?.message||"Falha ao carregar a rede.");
 },[available,request,page,search,tab,viewer?.id,viewer?.role,viewer?.permissions]);
 useEffect(()=>{void reload();return()=>{requestGeneration.current++;};},[reload]);
 const act=async(action,notice)=>{
   setBusy(true);setError("");setSuccess("");
   try{await action();setSuccess(notice);await reload();return true;}
   catch(err){setError(err?.message||"A operação não pôde ser concluída.");return false;}
   finally{setBusy(false);}
 };
 const initialTab=tab==="plans"?"network:plans:read":tab==="resellers"?"network:resellers:read":"network:partners:read";
 const visibleAccounts=partners.filter(p=>(tab==="resellers"?["reseller","both"].includes(p.kind):["content","both"].includes(p.kind)));
 const openPartner=async p=>{
   const generation=requestGeneration.current;
   setError("");try{const d=await request(`partners/${p.id}`);if(requestGeneration.current===generation)setSelected(d);}
   catch(e){if(requestGeneration.current===generation)setError(e.message);}
 };
 const editPartner=()=>{
   if(!selected)return;
   const p=selected.partner,t=selected.contract,s=selected.plan;
   setEditingAccount({id:p.id,kind:p.kind,name:p.name,planKey:s?.tier||"",monthlyFee:(p.monthlyFeeCents/100).toFixed(2),
    activationLimit:String(t?.activationLimit??p.deviceLimit??100),noActivationLimit:(t?.activationLimit??p.deviceLimit)===null,
    dnsLimit:String(s?.maxServersOverride??5),noDnsLimit:s?.maxServersOverride===0,
    endsAt:new Date(p.endsAt).toISOString().slice(0,10),contactName:p.contactName||"",
    contactEmail:p.contactEmail||"",contactPhone:p.contactPhone||""});
 };
 const savePlan=async()=>{
   const f=planForm;const parsed=toCents(f.monthlyPrice);
   if(!Number.isInteger(parsed)||parsed<0)return setError("Informe um preço válido.");
   const body={name:f.name,description:f.description,audience:f.audience,monthlyPriceCents:parsed,
    maxServers:f.noDnsLimit?null:Number(f.maxServers),autoFailover:f.autoFailover,autoPriority:f.autoPriority,
    emailAlerts:f.emailAlerts,detailedHistory:f.detailedHistory};
   const ok=await act(()=>request(f.key?`plans/${f.key}`:"plans",{method:f.key?"PUT":"POST",body}),"Plano salvo para esta rede.");
   if(ok)setPlanForm(null);
 };
 const savePartner=async()=>{
   const f=editingAccount||accountForm, edit=Boolean(editingAccount);
   const paid=toCents(f.monthlyFee);
   if(!Number.isInteger(paid)||paid<0)return setError("Informe uma mensalidade válida.");
   const common={name:f.name,planKey:f.planKey,monthlyFeeCents:paid,
     activationLimit:f.noActivationLimit?null:Number(f.activationLimit),dnsLimit:f.noDnsLimit?0:Number(f.dnsLimit),
     endsAt:`${f.endsAt}T23:59:59.000Z`,contactName:f.contactName||"",contactEmail:f.contactEmail||undefined,
     contactPhone:f.contactPhone||""};
   const body=edit?common:{...common,slug:f.slug,kind:f.kind,
     portalUser:{name:f.portalName,email:f.portalEmail,password:f.portalPassword}};
   if(!edit&&!between(0,100000000)(paid))return setError("Preço inválido.");
   const ok=await act(()=>request(edit?`partners/${f.id}`:"partners",{method:edit?"PATCH":"POST",body}),
     edit?"Contrato e conta atualizados.":"Conta criada na sua rede, com acesso próprio ao portal.");
   if(ok){setAccountForm(null);setEditingAccount(null);setSelected(null);}
 };
 const renderAccountForm=(f,set,edit=false)=><div className="card" style={{display:"grid",gap:12,padding:20}}>
   <h3>{edit?"Editar parceiro e contrato":f.kind==="reseller"?"Nova revenda":"Novo parceiro"}</h3>
   <div className="row">{field("Empresa",<input value={f.name} onChange={e=>set({...f,name:e.target.value})}/>)}
     {!edit&&field("Identificador",<input placeholder="empresa-exemplo" value={f.slug} onChange={e=>set({...f,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"")})}/>)}</div>
   <div className="row">
    {field("Plano da sua rede",<select value={f.planKey} onChange={e=>{const p=plans.find(x=>x.key===e.target.value);set({...f,planKey:e.target.value,
      monthlyFee:p? (p.monthlyPriceCents/100).toFixed(2):f.monthlyFee,dnsLimit:p?.maxServers!=null?String(p.maxServers):f.dnsLimit,noDnsLimit:p?.maxServers==null});}}><option value="">Selecione um plano</option>{plans.filter(p=>p.active && (p.audience===f.kind||p.audience==="both")).map(p=><option key={p.key} value={p.key}>{p.name}</option>)}</select>)}
    {field("Mensalidade (R$)",<input type="number" min="0" step="0.01" value={f.monthlyFee} onChange={e=>set({...f,monthlyFee:e.target.value})}/>)}
   </div>
   <div className="row">
     {field("Ativações",<><input type="number" min="0" disabled={f.noActivationLimit} value={f.activationLimit} onChange={e=>set({...f,activationLimit:e.target.value})}/><label><input type="checkbox" checked={f.noActivationLimit} onChange={e=>set({...f,noActivationLimit:e.target.checked})}/> Sem limite</label></>)}
     {field("DNS por código",<><input type="number" min="1" disabled={f.noDnsLimit} value={f.dnsLimit} onChange={e=>set({...f,dnsLimit:e.target.value})}/><label><input type="checkbox" checked={f.noDnsLimit} onChange={e=>set({...f,noDnsLimit:e.target.checked})}/> Sem limite</label></>)}
     {field("Vencimento",<input type="date" value={f.endsAt} onChange={e=>set({...f,endsAt:e.target.value})}/>)}
   </div>
   <div className="row">{field("Responsável",<input value={f.contactName} onChange={e=>set({...f,contactName:e.target.value})}/>)}
      {field("E-mail de contato",<input type="email" value={f.contactEmail} onChange={e=>set({...f,contactEmail:e.target.value})}/>)}
      {field("Telefone",<input value={f.contactPhone} onChange={e=>set({...f,contactPhone:e.target.value})}/>)}</div>
   {!edit&&<><h4>Login do painel {f.kind==="reseller"?"da Revenda":"do Parceiro"}</h4><div className="row">
      {field("Nome do usuário",<input value={f.portalName} onChange={e=>set({...f,portalName:e.target.value})}/>)}
      {field("E-mail de acesso",<input type="email" value={f.portalEmail} onChange={e=>set({...f,portalEmail:e.target.value})}/>)}
      {field("Senha inicial (mín. 12 caracteres)",<input type="password" value={f.portalPassword} onChange={e=>set({...f,portalPassword:e.target.value})}/>)}
   </div></>}
   <div className="actions"><button className="btn" onClick={()=>{setAccountForm(null);setEditingAccount(null)}}>Cancelar</button>
     <button className="btn primary" disabled={busy||!f.name||!f.planKey||(!edit&&(!f.slug||!f.portalEmail||f.portalPassword.length<12))} onClick={savePartner}>{busy?"Salvando...":"Salvar"}</button></div>
 </div>;
 return <div className="workspace-admin-page" style={{display:"grid",gap:18}}>
  <div className="page-head"><h2>{central?"Administração das redes":"Minha rede"}</h2><p className="muted">Parceiros, revendas, planos e usuários da sua rede. Os dados de outras administrações não ficam disponíveis.</p></div>
  {central&&<div className="card" style={{padding:16}}>{field("Admin responsável pela rede",<select value={adminId} onChange={e=>{requestGeneration.current++;setAdminId(e.target.value);setPage(1);setQ("");setPartners([]);setPlans([]);setPageMeta(null);setOverview(null);setSelected(null);}}><option value="">Selecione um Admin</option>{admins.map(a=><option key={a.id} value={a.id}>{a.name} — {a.email}</option>)}</select>)}</div>}
  {!available?<p className="muted">Selecione um Admin para abrir os cadastros de sua rede.</p>:<>
   {overview&&<div className="grid cards" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
     {[{label:"Parceiros",value:overview.partners},{label:"Revendas",value:overview.resellers},{label:"Planos",value:overview.plans}].map(x=><div className="card" key={x.label} style={{padding:16}}><small>{x.label}</small><h2>{x.value}</h2></div>)}
   </div>}
   <ErrorMessage message={error}/><StatusMessage message={success}/>
   <div className="toolbar" style={{display:"flex",flexWrap:"wrap",gap:8}}>
     {[["partners","Parceiros","network:partners:read"],["resellers","Revendas","network:resellers:read"],["plans","Planos e recursos","network:plans:read"]]
       .filter(x=>permits(x[2])).map(([key,name])=><button key={key} className={`btn ${tab===key?"primary":""}`} onClick={()=>{setTab(key);setPage(1);setSelected(null);setEditingAccount(null);setPlanForm(null);}}>{name}</button>)}
     <button className="btn" onClick={()=>void reload()}>Atualizar</button>
   </div>
   {tab==="plans"&&permits("network:plans:read")&&<>
     {permits("network:plans:write")&&<div><button className="btn primary" onClick={()=>setPlanForm(blankPlan())}>Novo plano</button></div>}
     {planForm&&<div className="card" style={{display:"grid",gap:12,padding:20}}>
       <h3>{planForm.key?"Editar plano":"Novo plano"}</h3>
       <div className="row">{field("Nome",<input value={planForm.name} onChange={e=>setPlanForm({...planForm,name:e.target.value})}/>)}
       {field("Tipo",<select value={planForm.audience} onChange={e=>setPlanForm({...planForm,audience:e.target.value})}><option value="content">Parceiro</option><option value="reseller">Revenda</option><option value="both">Ambos</option></select>)}
       {field("Mensalidade (R$)",<input type="number" min="0" step="0.01" value={planForm.monthlyPrice} onChange={e=>setPlanForm({...planForm,monthlyPrice:e.target.value})}/>)}</div>
       {field("Descrição",<input value={planForm.description} onChange={e=>setPlanForm({...planForm,description:e.target.value})}/>)}
       <div className="row">{field("DNS por código",<><input type="number" min="1" disabled={planForm.noDnsLimit} value={planForm.maxServers} onChange={e=>setPlanForm({...planForm,maxServers:e.target.value})}/><label><input type="checkbox" checked={planForm.noDnsLimit} onChange={e=>setPlanForm({...planForm,noDnsLimit:e.target.checked})}/> Sem limite</label></>)}</div>
       <div className="row">{[["autoFailover","Failover automático"],["autoPriority","Prioridade automática"],["emailAlerts","Alertas por e-mail"],["detailedHistory","Histórico detalhado"]].map(([key,label])=><label key={key}><input type="checkbox" checked={planForm[key]} onChange={e=>setPlanForm({...planForm,[key]:e.target.checked})}/> {label}</label>)}</div>
       <div className="actions"><button className="btn" onClick={()=>setPlanForm(null)}>Cancelar</button><button className="btn primary" disabled={busy||!planForm.name} onClick={savePlan}>Salvar plano</button></div>
     </div>}
     <div className="card" style={{padding:16}}><h3>Planos desta rede</h3>
       {plans.length?<table className="table"><thead><tr><th>Plano</th><th>Tipo</th><th>Preço mensal</th><th>DNS</th><th>Gerenciar</th></tr></thead><tbody>{plans.map(p=><tr key={p.key}><td>{p.name}</td><td>{p.audience}</td><td>{currency(p.monthlyPriceCents)}</td><td>{p.maxServers??"Sem limite"}</td><td>{permits("network:plans:write")&&<button className="btn sm" onClick={()=>setPlanForm({key:p.key,name:p.name,description:p.description,audience:p.audience,monthlyPrice:(p.monthlyPriceCents/100).toFixed(2),maxServers:String(p.maxServers??""),noDnsLimit:p.maxServers==null,autoFailover:p.autoFailover,autoPriority:p.autoPriority,emailAlerts:p.emailAlerts,detailedHistory:p.detailedHistory})}>Editar</button>}</td></tr>)}</tbody></table>:<p className="muted">Nenhum plano criado nesta rede.</p>}
     </div>
   </>}
   {tab!=="plans"&&permits(initialTab)&&<>
     {!editingAccount&&!accountForm&&permits(tab==="resellers"?"network:resellers:write":"network:partners:write")&&<div><button className="btn primary" onClick={()=>{setAccountForm(blankAccount(tab==="resellers"?"reseller":"content"));setSelected(null);}}>Novo {tab==="resellers"?"revendedor":"parceiro"}</button></div>}
     {accountForm&&renderAccountForm(accountForm,setAccountForm)}
     {editingAccount&&renderAccountForm(editingAccount,setEditingAccount,true)}
     <div className="card" style={{padding:16}}>
       <div className="row" style={{justifyContent:"space-between",alignItems:"center"}}><h3>{tab==="resellers"?"Minhas revendas":"Meus parceiros"}</h3><input aria-label="Buscar contas nesta rede" placeholder="Buscar nesta rede" value={q} onChange={e=>setQ(e.target.value)}/></div>
       {visibleAccounts.length?<table className="table"><thead><tr><th>Empresa</th><th>Mensalidade</th><th>Vencimento</th><th>Status</th><th>Ações</th></tr></thead><tbody>{visibleAccounts.map(p=><tr key={p.id}><td>{p.name}</td><td>{currency(p.monthlyFeeCents)}</td><td>{new Date(p.endsAt).toLocaleDateString("pt-BR")}</td><td>{p.status}</td><td><button className="btn sm" onClick={()=>openPartner(p)}>Gerenciar</button></td></tr>)}</tbody></table>:<p className="muted">Nenhuma conta corresponde à pesquisa nesta rede.</p>}
       {pageMeta&&<nav className="row" aria-label="Páginas de contas" style={{justifyContent:"space-between",marginTop:12,flexWrap:"wrap"}}>
         <span className="muted">{pageMeta.total} conta(s) · página {pageMeta.page} de {Math.max(1,pageMeta.totalPages)}</span>
         <div className="actions"><button className="btn sm" disabled={page<=1||busy} onClick={()=>setPage(x=>Math.max(1,x-1))}>Anterior</button>
         <button className="btn sm" disabled={page>=pageMeta.totalPages||busy} onClick={()=>setPage(x=>x+1)}>Próxima</button></div>
       </nav>}
     </div>
     {selected&&<div className="card" style={{padding:20,display:"grid",gap:12}}>
       <h3>{selected.partner.name}</h3>
       <p>Plano: {plans.find(p=>p.key===selected.plan?.tier)?.name||selected.plan?.tier||"Não definido"} · Ativações: {selected.contract?.activationLimit??"Sem limite"}</p>
       <div className="actions"><button className="btn" onClick={()=>setSelected(null)}>Fechar</button>
         {permits(selected.partner.kind==="reseller"?"network:resellers:write":"network:partners:write")&&<button className="btn primary" onClick={editPartner}>Editar contrato</button>}
         {permits("network:members:write")&&<button className="btn" onClick={()=>setNewUser({name:"",email:"",password:""})}>Adicionar usuário</button>}
       </div>
       {selected.users?.length>0&&<><h4>Usuários do painel</h4>{selected.users.map(u=><div key={u.id} className="row" style={{justifyContent:"space-between"}}><span>{u.name} · {u.email} · {u.status}</span>{permits("network:members:write")&&<button className="btn sm" onClick={()=>void act(()=>request(`partners/${selected.partner.id}/users/${u.id}`,{method:"PATCH",body:{status:u.status==="active"?"disabled":"active"}}),"Acesso atualizado.").then(()=>openPartner(selected.partner))}>{u.status==="active"?"Desativar":"Ativar"}</button>}</div>)}</>}
       {(permits("network:resources:read")||permits("network:devices:read")||permits("network:billing:read"))&&
          <NetworkResources key={selected.partner.id} account={selected.partner} request={request} permits={permits}/>}
       {newUser&&<div style={{display:"grid",gap:8}}><h4>Novo usuário do portal</h4><div className="row">{field("Nome",<input value={newUser.name} onChange={e=>setNewUser({...newUser,name:e.target.value})}/>)}{field("E-mail",<input type="email" value={newUser.email} onChange={e=>setNewUser({...newUser,email:e.target.value})}/>)}{field("Senha",<input type="password" value={newUser.password} onChange={e=>setNewUser({...newUser,password:e.target.value})}/>)}</div><div className="actions"><button className="btn" onClick={()=>setNewUser(null)}>Cancelar</button><button className="btn primary" disabled={busy||newUser.password.length<12} onClick={async()=>{const ok=await act(()=>request(`partners/${selected.partner.id}/users`,{method:"POST",body:newUser}),"Usuário criado.");if(ok){setNewUser(null);openPartner(selected.partner);}}}>Salvar usuário</button></div></div>}
     </div>}
   </>}
  </>}
 </div>;
}

// Recursos operacionais sempre associados à conta selecionada e ao Admin titular.
// Nenhuma chamada dessa seção usa endpoints globais da DeltaTV.
function NetworkResources({account,request,permits}){
 const [area,setArea]=useState("resources"),[dns,setDns]=useState([]),[codes,setCodes]=useState([]),
   [devices,setDevices]=useState([]),[invoices,setInvoices]=useState([]),
   [providerForm,setProviderForm]=useState(null),[codeForm,setCodeForm]=useState(null),
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
    {dns.length?dns.map(item=><div className="row" key={item.id} style={{justifyContent:"space-between"}}><span>{item.name} · {item.baseUrl} · {item.status}</span></div>):<p className="muted">Nenhum servidor cadastrado.</p>}
    {permits("network:resources:write")&&<>
      {!providerForm?<button className="btn sm" onClick={()=>setProviderForm({name:"",baseUrl:"",deliveryMode:"redirect"})}>Adicionar DNS</button>:
      <div className="card" style={{padding:12,display:"grid",gap:10}}><h5>Novo DNS</h5>
       {field("Nome",<input value={providerForm.name} onChange={e=>setProviderForm({...providerForm,name:e.target.value})}/>)}
       {field("Endereço do servidor",<input placeholder="https://exemplo.com" value={providerForm.baseUrl} onChange={e=>setProviderForm({...providerForm,baseUrl:e.target.value})}/>)}
       {field("Entrega",<select value={providerForm.deliveryMode} onChange={e=>setProviderForm({...providerForm,deliveryMode:e.target.value})}><option value="redirect">Redirect</option><option value="proxy">Proxy</option></select>)}
       <div className="actions"><button className="btn" onClick={()=>setProviderForm(null)}>Cancelar</button>
         <button className="btn primary" disabled={saving||!providerForm.name||!providerForm.baseUrl} onClick={async()=>{if(await submit("providers",providerForm))setProviderForm(null);}}>Salvar DNS</button></div>
      </div>}
    </>}
    <h5>Códigos — {codes.length}</h5>
    {account.kind==="reseller"&&<p className="muted">Para emitir códigos de Revenda, use o fluxo de licenças das TVs autorizado pela DeltaTV. Esta tela não emite licenças.</p>}
    {codes.map(c=><div className="row" key={c.id} style={{justifyContent:"space-between"}}><span>{c.code} · {c.label||"Sem nome"}</span></div>)}
    {permits("network:resources:write") && account.kind!=="reseller" && <>
       {!codeForm?<button className="btn sm" onClick={()=>setCodeForm({code:"",label:"",providerId:""})}>Criar código de ativação</button>:
       <div className="card" style={{padding:12,display:"grid",gap:10}}><h5>Novo código</h5>
         {field("Código (opcional, gera automático)",<input value={codeForm.code} onChange={e=>setCodeForm({...codeForm,code:e.target.value})}/>)}
         {field("Descrição",<input value={codeForm.label} onChange={e=>setCodeForm({...codeForm,label:e.target.value})}/>)}
         {field("DNS principal",<select value={codeForm.providerId} onChange={e=>setCodeForm({...codeForm,providerId:e.target.value})}><option value="">Automático</option>{dns.map(d=><option value={d.id} key={d.id}>{d.name}</option>)}</select>)}
         <div className="actions"><button className="btn" onClick={()=>setCodeForm(null)}>Cancelar</button>
         <button className="btn primary" disabled={saving} onClick={async()=>{const b={label:codeForm.label||undefined,providerId:codeForm.providerId||undefined,code:codeForm.code||undefined};if(await submit("codes",b))setCodeForm(null);}}>Criar</button></div>
       </div>}
    </>}
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
