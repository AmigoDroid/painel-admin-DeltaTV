import {ImpersonateDialog,UserRoleDialog,DeleteUserDialog} from "./Superadmin.jsx";
import PartnerPicker from "../PartnerPicker.jsx";
import { useEffect, useState } from "react";
import { api, getAuth } from "../api.js";
import { Badge, Empty, Field, Modal, PasswordInput, Pager, Table, fmtDateTime, useAction, useDebounced, useList, RowMenu } from "../ui.jsx";

/**
 * Usuários da plataforma. superadmin gerencia todos; admin gerencia só os usuários do portal de revendas/parceiros
 * (o backend impõe essa regra; aqui o formulário apenas não oferece o que seria recusado).
 * `partnerId` fixo = aba dentro do detalhe de uma revenda.
 */
const ROLE = { superadmin: "DeltaTV", admin: "Admin", support: "Suporte", partner: "Portal do parceiro" };
const ADMIN_RIGHTS = [
  ["network:dashboard:read","Visualizar resumo da própria rede"],
  ["network:partners:read","Ver parceiros"],["network:partners:write","Cadastrar e editar parceiros"],["network:partners:delete","Excluir parceiros da própria rede"],
  ["network:resellers:read","Ver revendas"],["network:resellers:write","Cadastrar e editar revendas"],["network:resellers:delete","Excluir revendas da própria rede"],
  ["network:plans:read","Consultar planos"],["network:plans:write","Criar, editar e excluir planos próprios"],
  ["network:members:read","Consultar usuários dos portais"],["network:members:write","Criar usuários dos próprios parceiros e revendas"],
  ["network:resources:read","Consultar códigos e DNS"],["network:resources:write","Cadastrar e editar códigos e DNS"],
  ["network:devices:read","Consultar dispositivos da rede"],["network:devices:write","Bloquear, desbloquear e remover ativações da rede"],
  ["network:gateways:read","Ver gateways próprios"],["network:gateways:write","Configurar e ativar gateways próprios"],
  ["network:billing:read","Consultar cobranças da rede"],["network:billing:write","Emitir faturas da rede"],["network:audit:read","Consultar auditoria da própria rede"],
];
const ADMIN_LIMITS = [
  ["maxPartners","Máximo de parceiros"],["maxResellers","Máximo de revendas"],
  ["maxPlans","Máximo de planos"],["maxDnsPerCode","Máximo de DNS por código"],
  ["maxActivationsPerPartner","Máximo de ativações por parceiro"],
];

export function UsersPanel(props) {
  return props.scoped ? <ScopedPortalUsers {...props} /> : <GlobalUsersPanel {...props} />;
}

function GlobalUsersPanel({ partnerId: fixedPartnerId }) {
  const me = getAuth()?.user;
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const list = useList("/admin/users", { q: "", role: "", status: "", partnerId: fixedPartnerId || "" });
  const [form, setForm] = useState(null);
  const [impersonating,setImpersonating]=useState(null),[roleUser,setRoleUser]=useState(null),[deleting,setDeleting]=useState(null);
  const [sessionsUser,setSessionsUser]=useState(null);
  const sendResetAction = useAction();
  useEffect(() => { list.filter({ q: dq }); /* eslint-disable-next-line */ }, [dq]);
  const full = me?.role === "superadmin";

  return (
    <>
      <div className="toolbar">
        <input placeholder="Buscar por nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
        {full && !fixedPartnerId && <select value={list.params.role} onChange={(e) => list.filter({ role: e.target.value })}><option value="">Todas as funções</option>{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
        <select value={list.params.status} onChange={(e) => list.filter({ status: e.target.value })}><option value="">Todos os status</option><option value="active">Ativos</option><option value="disabled">Desativados</option></select>
        <button className="btn primary" onClick={() => setForm({})}>Novo usuário</button>
      </div>
      <Table>
        <thead><tr><th>Nome</th><th>E-mail</th><th>Função</th>{!fixedPartnerId && <th>Revenda / parceiro</th>}<th>Status</th><th>Criado em</th><th /></tr></thead>
        <tbody>{list.data.map((u) => (
          <tr key={u.id}>
            <td>{u.name}{u.id === me?.id && <span className="muted"> (você)</span>}</td><td>{u.email}</td><td>{ROLE[u.role] || u.role}</td>
            {!fixedPartnerId && <td>{u.partnerName || "—"}</td>}
            <td><Badge status={u.status === "active" ? "active" : "disabled"} label={u.status === "active" ? "Ativo" : "Desativado"} /></td>
            <td>{fmtDateTime(u.createdAt)}</td>
            <td className="actions">
              <RowMenu items={[
                { label: "Editar", onClick: () => setForm({ user: u }) },
                ...(full ? [{label:"Sessões abertas",onClick:()=>setSessionsUser(u)}] : []),
                ...(full && (u.lockedUntil && new Date(u.lockedUntil)>new Date()) ? [{label:"Desbloquear login",onClick:async()=>{await sendResetAction(()=>api(`/admin/users/${u.id}/unlock`,{method:"POST"}),"Login desbloqueado.");list.reload();}}] : []),
                ...(full && u.role === "partner" && u.status === "active" ? [{label:"Entrar como",onClick:()=>setImpersonating(u)}] : []),
                ...(full && u.role === "admin" ? [{label:"Abrir rede do Admin",onClick:()=>{sessionStorage.setItem("deltatv-selected-admin",u.id);location.hash="workspace";}}] : []),
                ...(full && u.role !== "superadmin" && u.role !== "admin" ? [{label:"Papel e permissões",onClick:()=>setRoleUser(u)}] : []),
                ...(full && u.id !== me?.id ? [{label:"Excluir usuário",danger:true,onClick:()=>setDeleting(u)}] : []),
                ...(u.status === "active" ? [{ label: "Enviar link de redefinição de senha", onClick: () => {
                  if (window.confirm(`Enviar um link de redefinição para ${u.email}? O link expira em 30 minutos.`)) {
                    void sendResetAction(() => api(`/admin/users/${u.id}/send-password-reset`, { method: "POST" }), "Link enviado para o e-mail cadastrado.");
                  }
                } }] : []),
              ]} />
            </td>
          </tr>))}</tbody>
      </Table>
      <Empty loading={list.loading} error={list.error} count={list.data.length} />
      <Pager meta={list.meta} onPage={list.setPage} />
      {sessionsUser&&<UserSessionsModal user={sessionsUser} onClose={()=>setSessionsUser(null)}/>}
      {impersonating&&<ImpersonateDialog user={impersonating} onClose={()=>setImpersonating(null)}/>}
      {roleUser&&<UserRoleDialog user={roleUser} onClose={()=>setRoleUser(null)} onSaved={()=>{setRoleUser(null);list.reload()}}/>}
      {deleting&&<DeleteUserDialog user={deleting} onClose={()=>setDeleting(null)} onSaved={()=>{setDeleting(null);list.reload()}}/>}
      {form && <UserForm {...form} me={me} full={full} fixedPartnerId={fixedPartnerId} onClose={() => setForm(null)} onSaved={() => { setForm(null); list.reload(); }} />}
    </>
  );
}

function UserSessionsModal({user,onClose}) {
 const [items,setItems]=useState([]),[meta,setMeta]=useState(null),[page,setPage]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const reload=async()=>{try{const r=await api(`/admin/users/${user.id}/sessions`,{query:{page,pageSize:20}});setItems(r.data||[]);setMeta(r.meta);setError('');}catch(e){setError(e.message)}};
 useEffect(()=>{void reload()},[user.id,page]);
 const action=async(path)=>{setBusy(true);try{await api(path,{method:'DELETE'});await reload()}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <Modal title={`Sessões abertas · ${user.name}`} onClose={onClose} wide>
   {error&&<div role="alert" className="notice error">{error}</div>}
   <p className="muted">Revogar sessões encerra imediatamente o acesso correspondente.</p>
   <Table><thead><tr><th>Contexto</th><th>Endereço IP</th><th>Dispositivo</th><th>Início</th><th>Validade</th><th>Ações</th></tr></thead><tbody>{items.map(s=><tr key={s.id}>
    <td>{s.audience}</td><td>{s.ip||'—'}</td><td>{s.userAgent||'—'}</td><td>{fmtDateTime(s.createdAt)}</td><td>{fmtDateTime(s.expiresAt)}</td>
    <td><button type="button" className="btn sm" disabled={busy} onClick={()=>action(`/admin/users/${user.id}/sessions/${s.id}`)}>Encerrar</button></td></tr>)}</tbody></Table>
   {!items.length&&<p>Nenhuma sessão ativa.</p>}
   {meta?.totalPages>1&&<Pager meta={meta} onPage={setPage}/>}
   <div className="actions"><button type="button" className="btn" onClick={onClose}>Fechar</button>
     <button type="button" className="btn danger" disabled={busy||!items.length} onClick={()=>action(`/admin/users/${user.id}/sessions`)}>Encerrar todas</button></div>
 </Modal>;
}

function UserForm({ user, me, full, fixedPartnerId, onClose, onSaved }) {
  const run = useAction();
  const edit = !!user;
  const self = user?.id === me?.id;
  const [f, setF] = useState({
    name: user?.name || "", email: user?.email || "", role: user?.role || (full && !fixedPartnerId ? "admin" : "partner"),
    partnerId: user?.partnerId || fixedPartnerId || "", status: user?.status || "active", password: "",
    delegatedPermissions: user?.delegatedPermissions || [], networkLimits: user?.networkLimits || {},
  });
  const [linkCandidates,setLinkCandidates]=useState(null);
  const [linkError,setLinkError]=useState('');
  const recoverLinkedAccount=async()=>{
    if(!edit)return;
    setLinkError('');
    try {
      const response=await api(`/admin/users/${user.id}/portal-link-options`);
      const suggestions=response.data||[];
      setLinkCandidates(suggestions);
      if(suggestions.length===1)setF(prev=>({...prev,partnerId:suggestions[0].id}));
    } catch(e){setLinkError(e.message||'Não foi possível consultar os vínculos.');}
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const isPartner = f.role === "partner";
  const isAdmin = f.role === "admin";
  const roleLocked = !full || !!fixedPartnerId || self;
  const submit = async () => {
    const body = { name: f.name, email: f.email, role: f.role,
      partnerId: (isPartner || isAdmin) ? (f.partnerId || null) : null, status: f.status };
    if (f.role === "admin" && full) {
      body.delegatedPermissions = f.delegatedPermissions;
      body.networkLimits = f.networkLimits;
    }
    if (f.password) body.password = f.password;
    if (!edit) { body.password = f.password; if (!(isPartner || isAdmin)) delete body.partnerId;
      if (isPartner && !body.partnerId) return; delete body.status; }
    const r = await run(() => api(edit ? `/admin/users/${user.id}` : "/admin/users", { method: edit ? "PATCH" : "POST", body }), "Usuário salvo.");
    if (r) onSaved();
  };
  return (
    <Modal title={edit ? "Editar usuário" : "Novo usuário"} onClose={onClose}>
      <div className="row"><Field label="Nome"><input value={f.name} onChange={set("name")} /></Field><Field label="E-mail"><input type="email" value={f.email} onChange={set("email")} /></Field></div>
      <div className="row">
        <Field label="Função" hint={self ? "Você não pode alterar a própria função." : undefined}>
          <select value={f.role} onChange={set("role")} disabled={roleLocked}>{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Field>
        {(isPartner || isAdmin) && !fixedPartnerId && (
          <Field label={isAdmin ? "Conta operacional vinculada (opcional)" : "Revenda / parceiro"}>
            <PartnerPicker value={f.partnerId} onChange={(v) => setF(prev => ({ ...prev, partnerId: v }))}
              emptyLabel={isAdmin ? "Sem conta operacional vinculada" : "Selecione a conta"}/>
          </Field>
        )}
      </div>
      {full && f.role === "admin" && <section className="card" style={{padding:16,display:"grid",gap:12}}>
        <h3>Permissões deste Admin</h3>
        <div className="actions" style={{flexWrap:"wrap"}}>
          <button type="button" className="btn sm" onClick={()=>setF(v=>({...v,delegatedPermissions:ADMIN_RIGHTS.map(([key])=>key)}))}>Liberar toda a própria rede</button>
          <button type="button" className="btn sm" onClick={()=>setF(v=>({...v,delegatedPermissions:[]}))}>Remover permissões</button>
          <span className="muted">{f.delegatedPermissions.length} de {ADMIN_RIGHTS.length} autorizações</span>
        </div>
        {!f.delegatedPermissions.length && <div className="notice" role="status">Sem permissões selecionadas, o Admin verá somente uma página informativa. Marque as funções que ele poderá utilizar.</div>}
        {isAdmin && edit && !user.partnerId && <div className="card" style={{padding:10,display:"grid",gap:8}}>
          <strong>Era Parceiro ou Revenda antes de virar Admin?</strong>
          <p className="muted">A versão anterior removia o vínculo quando você trocava a função. Procure a conta original no histórico e confirme o vínculo abaixo.</p>
          <button type="button" className="btn sm" onClick={recoverLinkedAccount}>Localizar conta operacional anterior</button>
          {linkError&&<div className="notice error" role="alert">{linkError}</div>}
          {linkCandidates&&(!linkCandidates.length?<p className="muted">Nenhum vínculo histórico identificado. Use a busca de parceiros acima.</p>:
            <Field label="Contas identificadas no histórico"><select value={f.partnerId||''} onChange={set('partnerId')}>
              <option value="">Selecione a conta correta</option>
              {linkCandidates.map(item=><option key={item.id} value={item.id}>{item.name} — {item.kind}</option>)}
            </select></Field>)}
        </div>}
        {isAdmin && f.partnerId && <div className="notice" role="status">O Admin poderá entrar também nos portais operacionais da conta vinculada, com o mesmo e-mail e senha. Ao salvar, a DeltaTV transfere a gestão desta conta para a rede dele, sem transferir outros parceiros, planos ou recursos globais.</div>}
        <p className="muted">O Admin utiliza o mesmo painel da DeltaTV nas funcionalidades autorizadas, com dados limitados à sua própria rede. O acesso às APIs globais, à VPS e às configurações centrais permanece exclusivo da DeltaTV. Funcionalidades ainda sem versão isolada não serão liberadas até serem adaptadas.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(225px,1fr))",gap:10}}>
          {ADMIN_RIGHTS.map(([permission,label])=><label key={permission} style={{display:"flex",alignItems:"center",gap:8}}>
            <input type="checkbox" checked={f.delegatedPermissions.includes(permission)} onChange={e=>setF(v=>({...v,
              delegatedPermissions:e.target.checked?[...v.delegatedPermissions,permission]:v.delegatedPermissions.filter(p=>p!==permission)}))}/>{label}
          </label>)}
        </div>
        <h4>Limites desta rede</h4>
        <p className="muted">Vazio significa sem limite definido. A DeltaTV pode alterar esses valores quando quiser.</p>
        <div className="row">
          {ADMIN_LIMITS.map(([key,label])=><Field key={key} label={label}><input type="number" min="0" step="1"
            value={f.networkLimits[key]??""} placeholder="Sem limite"
            onChange={e=>setF(v=>({...v,networkLimits:{...v.networkLimits,[key]:e.target.value===""?null:Number(e.target.value)}}))}/></Field>)}
        </div>
      </section>}
      {edit && <Field label="Status" hint={self ? "Você não pode desativar a própria conta." : "Desativar encerra as sessões abertas do usuário."}><select value={f.status} onChange={set("status")} disabled={self}><option value="active">Ativo</option><option value="disabled">Desativado</option></select></Field>}
      <Field label={edit ? "Nova senha (deixe vazio para manter)" : "Senha inicial (mín. 12 caracteres)"} hint={edit ? "Ao trocar senha, função, revenda ou e-mail, as sessões abertas do usuário são encerradas." : undefined}>
        <PasswordInput value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      </Field>
      <div className="actions"><button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={!f.name || !f.email || (!edit && f.password.length < 12) || (isPartner && !f.partnerId)} onClick={submit}>Salvar</button></div>
    </Modal>
  );
}

export default function Users() {
  return (
    <>
      <div className="page-head"><h2>Usuários</h2></div>
      <UsersPanel />
    </>
  );
}

/** A mesma aba de usuários integra o modal compartilhado. Nunca usa /admin/users no modo Admin. */
function ScopedPortalUsers({users,call,permits,reload}) {
 const run=useAction(),[form,setForm]=useState(null),[error,setError]=useState("");
 const writable=permits("network:members:write");
 const save=async()=>{
   if(!form?.name?.trim()||!form.email?.includes("@") || (!form.id&&form.password.length<12) || (form.password&&form.password.length<12))return;
   const body={name:form.name.trim(),email:form.email.trim(),...(form.password?{password:form.password}:{})};
   const ok=await run(()=>call(form.id?`/users/${form.id}`:"/users",{method:form.id?"PATCH":"POST",body}),"Usuário salvo.");
   if(ok){setForm(null);reload();}
 };
 const deactivate=async user=>{if(await run(()=>call(`/users/${user.id}`,{method:"PATCH",body:{status:user.status==="active"?"disabled":"active"}}),"Acesso atualizado."))reload();};
 const remove=async()=>{if(await run(()=>call(`/users/${form.id}`,{method:"DELETE",body:{reason:form.reason||""}}),"Usuário arquivado.")){setForm(null);reload();}};
 return <>
   {writable&&<div className="actions left"><button className="btn primary" onClick={()=>setForm({name:"",email:"",password:""})}>Novo usuário do portal</button></div>}
   <Table><thead><tr><th>Nome</th><th>E-mail</th><th>Status</th><th>Ações</th></tr></thead><tbody>{users.map(user=><tr key={user.id}>
     <td>{user.name}</td><td>{user.email}</td><td><Badge status={user.status==="active"?"active":"disabled"}/></td>
     <td><RowMenu items={[{label:"Editar",hidden:!writable,onClick:()=>setForm({...user,password:""})},
       {label:user.status==="active"?"Desativar":"Ativar",hidden:!writable,onClick:()=>deactivate(user)},
       {label:"Excluir",hidden:!writable,danger:true,onClick:()=>setForm({...user,reason:"",delete:true})}]}/></td>
   </tr>)}</tbody></Table>
   {form&&<Modal title={form.delete?"Excluir usuário":form.id?"Editar usuário":"Novo usuário do portal"} onClose={()=>setForm(null)}>
     {form.delete?<><p>O acesso de {form.email} será revogado e o registro arquivado.</p><Field label="Motivo (opcional)"><textarea value={form.reason||""} onChange={e=>setForm(v=>({...v,reason:e.target.value}))}/></Field></>:
       <><Field label="Nome"><input value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/></Field>
         <Field label="E-mail"><input type="email" value={form.email} onChange={e=>setForm(v=>({...v,email:e.target.value}))}/></Field>
         <Field label={form.id?"Nova senha (vazio para manter)":"Senha (mínimo 12 caracteres)"}><input type="password" value={form.password} onChange={e=>setForm(v=>({...v,password:e.target.value}))}/></Field></>}
     {error&&<p className="error" role="alert">{error}</p>}
     <div className="actions"><button className="btn" onClick={()=>setForm(null)}>Cancelar</button>
       <button className={`btn ${form.delete?"danger":"primary"}`} disabled={!form.delete&&(!form.name?.trim()||!form.email?.includes("@")||(!form.id&&form.password.length<12)||(form.password&&form.password.length<12))} onClick={form.delete?remove:save}>Confirmar</button></div>
   </Modal>}
 </>;
}

