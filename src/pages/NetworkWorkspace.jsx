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
const blankPlan=()=>({name:"",description:"",audience:"content",monthlyPrice:"0.00",maxServers:"5",noDnsLimit:false,activationLimit:"100",noActivationLimit:false,validityDays:"30",
  autoFailover:true,autoPriority:false,emailAlerts:false,detailedHistory:false});
const blankAccount=kind=>({name:'',email:'',password:'',kind,planKey:''});
const blankInvite=()=>({email:'',planKey:'',sendEmail:false});
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
 const [tab,setTab]=useState(()=>central || permissions.has('network:partners:read') ? 'partners' :
   permissions.has('network:resellers:read') ? 'resellers' :
   permissions.has('network:plans:read') ? 'plans' : 'partners');
 const [overview,setOverview]=useState(null),[plans,setPlans]=useState([]),[partners,setPartners]=useState([]);
 const [selected,setSelected]=useState(null);
 const [planForm,setPlanForm]=useState(null),[accountForm,setAccountForm]=useState(null),[editingAccount,setEditingAccount]=useState(null);
 const [newUser,setNewUser]=useState(null);
 const [paymentReference,setPaymentReference]=useState(''),[confirmingPayment,setConfirmingPayment]=useState(false);
 const [inviteForm,setInviteForm]=useState(null),[inviteResult,setInviteResult]=useState(null),
  [invitations,setInvitations]=useState([]);
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
   if(permits('network:partners:write'))jobs.push(request('invitations').then(v=>{if(requestGeneration.current===generation)setInvitations(v.data||[]);}));
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
  const p=selected.partner;
  setEditingAccount({id:p.id,name:p.name,kind:p.kind,planKey:selected.plan?.tier||''});
 };
 const issueInvite=async()=>{
   if(!inviteForm?.email||!inviteForm.planKey)return setError('Informe o e-mail e o plano do convite.');
   setBusy(true);setError('');setSuccess('');setInviteResult(null);
   try{
    const result=await request('invitations',{method:'POST',body:inviteForm});
    setInviteResult(result);setInviteForm(null);
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
 const savePartner=async()=>{
   const f=editingAccount||accountForm,edit=Boolean(editingAccount);
   if(!f.planKey)return setError('Escolha o plano para aplicar os benefícios e o preço automaticamente.');
   const body=edit?{name:f.name,planKey:f.planKey}:{name:f.name,email:f.email,password:f.password,
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
    {plan&&<div className="card" style={{padding:14,background:'var(--surface-muted,var(--surface,transparent))'}}>
      <strong>{plan.name}</strong><p style={{margin:'8px 0'}}>{currency(plan.monthlyPriceCents)} / mês · {plan.validityDays??30} dias iniciais</p>
      <p className="muted">DNS: {formatLimit(plan.maxServers)} · Ativações: {formatLimit(plan.activationLimit)} · {plan.autoFailover?'Failover incluso':'Sem failover'} · {plan.emailAlerts?'Alertas por e-mail':'Sem alertas'}</p>
    </div>}
    <div className="actions"><button className="btn" type="button" onClick={()=>{setAccountForm(null);setEditingAccount(null)}}>Cancelar</button>
     <button className="btn primary" type="button" disabled={busy||!f.name.trim()||!f.planKey||(!edit&&(!f.email.includes('@')||f.password.length<12))}
       onClick={savePartner}>{busy?'Salvando...':edit?'Aplicar plano':'Criar conta'}</button></div>
   </section>;
 };
 return <div className="workspace-admin-page" style={{display:"grid",gap:18}}>
  <div className="page-head"><h2>{central?"Administração das redes":"Minha rede"}</h2><p className="muted">Parceiros, revendas, planos e usuários da sua rede. Os dados de outras administrações não ficam disponíveis.</p></div>
  {central&&<div className="card" style={{padding:16}}>{field("Admin responsável pela rede",<select value={adminId} onChange={e=>{requestGeneration.current++;setAdminId(e.target.value);setPage(1);setQ("");setPartners([]);setPlans([]);setPageMeta(null);setOverview(null);setSelected(null);}}><option value="">Selecione uma rede</option><option value="deltatv">DeltaTV — rede principal</option>{admins.map(a=><option key={a.id} value={a.id}>{a.name} — {a.email}</option>)}</select>)}</div>}
  {!central && permissions.size === 0 && <div className="card" role="status" style={{padding:20,display:"grid",gap:8}}>
    <h3>Permissões de administração ainda não configuradas</h3>
    <p>Seu usuário é Admin, mas a DeltaTV ainda não liberou funções para sua rede. Solicite que a DeltaTV acesse Usuários, edite sua conta e selecione as permissões necessárias.</p>
    <p className="muted">A sua conta operacional de Parceiro/Revenda pode continuar ativa separadamente. Nenhum dado foi excluído por esta mensagem.</p>
  </div>}
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
       <div className="row">{field('Ativações',<><input type="number" min="0" disabled={planForm.noActivationLimit} value={planForm.activationLimit} onChange={e=>setPlanForm({...planForm,activationLimit:e.target.value})}/><label><input type="checkbox" checked={planForm.noActivationLimit} onChange={e=>setPlanForm({...planForm,noActivationLimit:e.target.checked})}/> Sem limite</label></>)}
         {field('Validade inicial do acesso (dias)',<input type="number" min="1" max="3660" value={planForm.validityDays} onChange={e=>setPlanForm({...planForm,validityDays:e.target.value})}/>)}</div>
       <div className="row">{[["autoFailover","Failover automático"],["autoPriority","Prioridade automática"],["emailAlerts","Alertas por e-mail"],["detailedHistory","Histórico detalhado"]].map(([key,label])=><label key={key}><input type="checkbox" checked={planForm[key]} onChange={e=>setPlanForm({...planForm,[key]:e.target.checked})}/> {label}</label>)}</div>
       <div className="actions"><button className="btn" onClick={()=>setPlanForm(null)}>Cancelar</button><button className="btn primary" disabled={busy||!planForm.name} onClick={savePlan}>Salvar plano</button></div>
     </div>}
     <div className="card" style={{padding:16}}><h3>Planos desta rede</h3>
       {plans.length?<table className="table"><thead><tr><th>Plano</th><th>Tipo</th><th>Preço mensal</th><th>DNS</th><th>Ativações</th><th>Validade</th><th>Gerenciar</th></tr></thead><tbody>{plans.map(p=><tr key={p.key}><td>{p.name}</td><td>{p.audience}</td><td>{currency(p.monthlyPriceCents)}</td><td>{p.maxServers??"Sem limite"}</td><td>{p.activationLimit??"Sem limite"}</td><td>{p.validityDays??30} dias</td><td>{permits("network:plans:write")&&<button className="btn sm" onClick={()=>setPlanForm({key:p.key,name:p.name,description:p.description,audience:p.audience,monthlyPrice:(p.monthlyPriceCents/100).toFixed(2),maxServers:String(p.maxServers??""),noDnsLimit:p.maxServers==null,activationLimit:String(p.activationLimit??''),noActivationLimit:p.activationLimit==null,validityDays:String(p.validityDays??30),autoFailover:p.autoFailover,autoPriority:p.autoPriority,emailAlerts:p.emailAlerts,detailedHistory:p.detailedHistory})}>Editar</button>}</td></tr>)}</tbody></table>:<p className="muted">Nenhum plano criado nesta rede.</p>}
     </div>
   </>}
   {tab!=="plans"&&permits(initialTab)&&<>
     {!editingAccount&&!accountForm&&permits(tab==="resellers"?"network:resellers:write":"network:partners:write")&&<div className="actions">
       <button className="btn primary" onClick={()=>{setAccountForm(blankAccount(tab==="resellers"?"reseller":"content"));setInviteForm(null);setSelected(null);}}>Novo {tab==="resellers"?"revendedor":"parceiro"}</button>
       {tab==='partners'&&<button className="btn" onClick={()=>{setInviteForm(blankInvite());setAccountForm(null);setEditingAccount(null);setInviteResult(null);}}>Enviar convite</button>}
     </div>}
     {tab==='partners'&&inviteForm&&<div className="card" style={{padding:20,maxWidth:640,display:'grid',gap:12}}>
       <h3>Convidar parceiro</h3><p className="muted">Escolha o plano e informe o e-mail. O convidado cria a conta e entra automaticamente na sua rede, com os recursos do plano.</p>
       {field('E-mail do destinatário',<input type="email" value={inviteForm.email} onChange={e=>setInviteForm({...inviteForm,email:e.target.value})}/>)}
       {field('Plano do convite',<select value={inviteForm.planKey} onChange={e=>setInviteForm({...inviteForm,planKey:e.target.value})}>
        <option value="">Escolha o plano</option>{planOptions('content').map(p=><option key={p.key} value={p.key}>{p.name} · {currency(p.monthlyPriceCents)}</option>)}</select>)}
       {inviteForm.planKey&&<p className="muted">O convite aplica o preço, DNS, ativações e a validade do plano. Um plano gratuito custa R$ 0,00.</p>}
       <label><input type="checkbox" checked={inviteForm.sendEmail} onChange={e=>setInviteForm({...inviteForm,sendEmail:e.target.checked})}/> Enviar por e-mail (requer SMTP configurado)</label>
       <div className="actions"><button className="btn" onClick={()=>setInviteForm(null)}>Cancelar</button><button className="btn primary" disabled={busy||!inviteForm.planKey||!inviteForm.email.includes('@')} onClick={issueInvite}>Gerar convite</button></div>
     </div>}
     {tab==='partners'&&inviteResult?.url&&<div className="card" role="status" style={{padding:16,maxWidth:640}}>
       <strong>Convite criado</strong>{inviteResult.warning&&<p className="muted">{inviteResult.warning}</p>}
       <label className="field">Link de cadastro<input readOnly value={inviteResult.url} onFocus={e=>e.target.select()}/></label>
       <button className="btn primary" onClick={()=>navigator.clipboard?.writeText(inviteResult.url).then(()=>setSuccess('Link copiado.')).catch(()=>setError('Selecione e copie o link manualmente.'))}>Copiar link</button>
       <p className="muted">Válido por 72 horas e utilizável uma vez.</p>
     </div>}
     {tab==='partners'&&invitations.length>0&&<details className="card" style={{padding:14}}><summary>Convites emitidos ({invitations.length})</summary>
       <div style={{display:'grid',gap:8,marginTop:12}}>{invitations.map(inv=><div className="row" key={inv.id} style={{justifyContent:'space-between',flexWrap:'wrap'}}>
         <span>{inv.email} · {plans.find(p=>p.key===inv.planKey)?.name||'Plano'} · {inv.acceptedAt?'Concluído':inv.revokedAt?'Revogado':new Date(inv.expiresAt)<new Date()?'Expirado':'Pendente'}</span>
         {!inv.acceptedAt&&!inv.revokedAt&&<button className="btn sm" disabled={busy} onClick={()=>act(()=>request(`invitations/${inv.id}/revoke`,{method:'POST'}),'Convite revogado.')}>Revogar</button>}
       </div>)}</div></details>}
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
         {selected.partner.statusReason==='awaiting_payment'&&permits('network:billing:write')&&permits('network:partners:write')&&
         <button className="btn primary" disabled={busy} onClick={()=>setConfirmingPayment(v=>!v)}>Confirmar recebimento</button>}
         {permits("network:members:write")&&<button className="btn" onClick={()=>setNewUser({name:"",email:"",password:""})}>Adicionar usuário</button>}
       </div>
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
