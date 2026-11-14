import { useCallback,useEffect,useState } from "react";
import { api } from "../api.js";
import "./distribution-network.css";
import MasterPixAdmin, { MasterPixGlobal } from "./MasterPixAdmin.jsx";
const emptyPolicy={canInvite:true,canSell:true,canPromote:false,maxChildren:null,maxDepth:null};
const optionalNumber=value=>value===""?null:Number(value);
const inviteDescription=(i)=>`${i.uses}/${i.maxUses==null?"sem limite":i.maxUses} cadastros · ${i.expiresAt?`vence ${new Date(i.expiresAt).toLocaleDateString("pt-BR")}`:"sem vencimento"}`;
const shareWhatsapp=(url,name)=>`https://wa.me/?text=${encodeURIComponent(`Olá! Cadastre sua revenda DeltaTV na rede de ${name}: ${url}`)}`;
const names={servers:"Servidores IPTV",codes:"Códigos de ativação",devices:"Gerenciamento de TVs",clients:"Clientes",stock:"Estoque de licenças",credits:"Créditos e compras",web:"Player Web",white_label:"Aplicativos personalizados",remote:"Controle remoto"};
export default function DistributionNetwork(){
  const [inviteUrl,setInviteUrl]=useState(""),[inviteUses,setInviteUses]=useState(""),[inviteDays,setInviteDays]=useState(""),[invites,setInvites]=useState([]);
  const [tree,setTree]=useState([]),[treePage,setTreePage]=useState(1),[treeTotal,setTreeTotal]=useState(0),[search,setSearch]=useState(""),[activeSearch,setActiveSearch]=useState(""),[selected,setSelected]=useState(""),[detail,setDetail]=useState(null),[resources,setResources]=useState(null),[parentId,setParentId]=useState(""),[policy,setPolicy]=useState(emptyPolicy),[busy,setBusy]=useState(false),[error,setError]=useState(""),[feedback,setFeedback]=useState(""),[offers,setOffers]=useState([]),[sales,setSales]=useState([]),[newPrice,setNewPrice]=useState({months:"12",priceCredits:"10"});
  const load=useCallback(()=>api(`/admin/network?page=${treePage}&pageSize=100&q=${encodeURIComponent(activeSearch)}`).then(d=>{setTree(d.data||[]);setTreeTotal(d.total||0);}),[treePage,activeSearch]);
  useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
  useEffect(()=>{
    if(!selected){setDetail(null);setResources(null);setInvites([]);setInviteUrl("");return;}
    setInviteUrl("");setInvites([]);
    Promise.all([api(`/admin/network/accounts/${selected}`),api(`/admin/network/accounts/${selected}/resources`),api(`/admin/network/accounts/${selected}/prices`),api(`/admin/network/accounts/${selected}/sales`)]).then(([d,r,p,s])=>{setDetail(d);setResources(r);setOffers(p.data||[]);setSales(s.data||[]);setPolicy(d.account?.distributionRole==="master" ? (d.policy||emptyPolicy) : {...emptyPolicy});setParentId(d.account?.parentPartnerId||"");
      if(d.account?.distributionRole==="master") api(`/admin/network/accounts/${selected}/invites`).then(r=>setInvites(r.data||[])).catch(()=>setInvites([]));}).catch(e=>setError(e.message));
  },[selected]);
  const act=async(fn,msg)=>{if(busy)return;setBusy(true);setError("");setFeedback("");try{await fn();await load();if(selected){setDetail(await api(`/admin/network/accounts/${selected}`));setResources(await api(`/admin/network/accounts/${selected}/resources`));setOffers((await api(`/admin/network/accounts/${selected}/prices`)).data||[]);}setFeedback(msg);}catch(e){setError(e.message);}finally{setBusy(false);}};
  const enable=(on)=>act(()=>api(`/admin/network/accounts/${selected}/master`,{method:"POST",body:{enabled:on,policy}}),on?"Revenda promovida a Master.":"Modo Master desativado.");
  const makeInvite=async()=>{
    if(busy||!selected)return;
    setBusy(true);setError("");setFeedback("");
    try{
      const response=await api(`/admin/network/accounts/${selected}/invites`,{method:"POST",body:{maxUses:optionalNumber(inviteUses),daysValid:optionalNumber(inviteDays)}});
      setInviteUrl(response.url);
      setInvites((await api(`/admin/network/accounts/${selected}/invites`)).data||[]);
      setFeedback("Convite criado. Copie ou compartilhe o link abaixo.");
    }catch(e){setError(e.message||"Não foi possível criar o convite.");}
    finally{setBusy(false);}
  };
  const copyInvite=async()=>{
    try{await navigator.clipboard.writeText(inviteUrl);setFeedback("Link copiado. Envie ao seu revendedor.");}
    catch{window.prompt("Copie o link para enviar:",inviteUrl);}
  };

  const promoteAndInvite=async()=>{
    if(busy||!selected)return;
    setBusy(true);setError("");setFeedback("");
    let promoted=false;
    try{
      await api(`/admin/network/accounts/${selected}/master`,{method:"POST",body:{
        enabled:true,policy:{...emptyPolicy,...policy,canInvite:true,maxChildren:policy.maxChildren===0?null:policy.maxChildren,maxDepth:policy.maxDepth}
      }});
      promoted=true;
      const response=await api(`/admin/network/accounts/${selected}/invites`,{method:"POST",body:{
        maxUses:optionalNumber(inviteUses),daysValid:optionalNumber(inviteDays)
      }});
      setInviteUrl(response.url);
      setInvites((await api(`/admin/network/accounts/${selected}/invites`)).data||[]);
      setFeedback("Master ativado! Compartilhe o link abaixo para cadastrar revendedores automaticamente.");
    }catch(e){
      setError((promoted?"A conta foi ativada como Master, mas o convite não foi criado. Use ‘Gerar convite agora’ para tentar novamente. ":"")+(e.message||"Não foi possível concluir."));
    }finally{
      // Sempre recarrega: promoção pode ter dado certo mesmo se criar o convite falhou.
      try{const d=await api(`/admin/network/accounts/${selected}`);setDetail(d);setPolicy(d.policy||emptyPolicy);await load();}
      catch(e){setError(v=>v||e.message);}
      setBusy(false);
    }
  };

  const detach=()=>act(()=>api(`/admin/network/accounts/${selected}/unlink`,{method:"POST"}),"Revenda desvinculada da rede.");
  const attach=()=>act(()=>api(`/admin/network/accounts/${selected}/link`,{method:"POST",body:{parentPartnerId:parentId}}),"Revenda vinculada ao Master.");
  return <section className="distribution-network">
    <div className="card"><h2>Rede de distribuição DeltaTV</h2><p className="muted">Promova revendas a Master, crie Submasters, defina limites e acompanhe quem pertence a cada rede. As contas antigas continuam independentes.</p><div className="row" style={{gap:12,flexWrap:"wrap"}}><b>{tree.filter(p=>p.distributionRole==="master").length} Masters</b><span>{tree.filter(p=>p.parentPartnerId).length} vínculos</span><span>{treeTotal} contas na rede · {tree.length} nesta página</span></div></div>
    <MasterPixGlobal/>
    {error&&<p className="error" role="alert">{error}</p>}{feedback&&<p style={{color:"var(--ok)"}} role="status">{feedback}</p>}
    <div className="distribution-columns">
      <div className="card"><h3>Escolha uma revenda</h3><p className="muted">Lista hierárquica: indentação representa o nível da conta.</p>
        <form className="row" onSubmit={e=>{e.preventDefault();setTreePage(1);setActiveSearch(search);}} style={{gap:8,marginBottom:8}}>
          <input type="search" aria-label="Pesquisar revenda" placeholder="Nome ou ID da revenda" value={search} onChange={e=>setSearch(e.target.value)}/>
          <button className="btn sm" type="submit">Buscar</button>
        </form><div className="distribution-list">{tree.map(p=><button type="button" key={p.id} className={`distribution-row ${selected===p.id?"active":""}`} style={{paddingLeft:12+Math.min(p.depth,10)*16}} onClick={()=>setSelected(p.id)}><span>{p.distributionRole==="master"?(p.depth?"◆ ":"★ "):"• "}{p.name}</span><small>{p.distributionRole==="master"?(p.depth?"Submaster":"Master"):"Revenda"} · {p.status}</small></button>)}</div>
      {treeTotal>100&&<div className="row" style={{gap:8,marginTop:12}}>
        <button className="btn sm" disabled={treePage<=1} onClick={()=>setTreePage(p=>p-1)}>Anterior</button>
        <span>Página {treePage} de {Math.ceil(treeTotal/100)}</span>
        <button className="btn sm" disabled={treePage*100>=treeTotal} onClick={()=>setTreePage(p=>p+1)}>Próxima</button>
      </div>}</div>
      <div className="card">{!detail?<p className="muted">Selecione uma conta para visualizar e editar as permissões.</p>:<>
        <h3>{detail.account.name}</h3>
        <div className="card" style={{padding:14,marginBottom:14,background:"var(--panel-muted,transparent)"}}>
          <strong>1. Ative o Master · 2. Gere o convite · 3. Compartilhe</strong>
          <p className="muted" style={{margin:"6px 0 12px"}}>O novo revendedor cria sua conta no link e já entra ativo nesta rede. Por padrão, o convite não limita cadastros nem possui vencimento. Só haverá limites quando forem definidos nos campos opcionais abaixo.</p>
          {detail.account.distributionRole!=="master"||!detail.policy.canInvite||detail.policy.maxChildren===0?
            <button className="btn primary" disabled={busy} onClick={promoteAndInvite}>{detail.account.distributionRole==="master"?"Habilitar convites e gerar link":"Ativar Master e gerar convite"}</button>:
            <button className="btn primary" disabled={busy} onClick={makeInvite}>Gerar convite agora</button>}
          {inviteUrl&&<div style={{display:"grid",gap:8,marginTop:12}}><input aria-label="Link de convite gerado" readOnly value={inviteUrl} onFocus={e=>e.target.select()}/>
            <div className="row" style={{gap:8,flexWrap:"wrap"}}><button className="btn primary" onClick={copyInvite}>Copiar link</button>
              <a className="btn" href={shareWhatsapp(inviteUrl,detail.account.name)} target="_blank" rel="noopener noreferrer">Compartilhar no WhatsApp</a></div></div>}
        </div>
        <p className="muted">Situação: {detail.account.role} · Nível {detail.depth} · {detail.childrenTotal??detail.children.length} revendas diretas</p>
        <h4>{detail.account.distributionRole==="master"?"Permissões do Master":"Ativar esta revenda como Master"}</h4>
        {detail.account.distributionRole!=="master"&&<p className="muted">Ao transformar esta revenda em Master, não há limite automático de revendas ou níveis. Deixe os campos vazios para manter ilimitado.</p>}<div className="distribution-flags">{[["canInvite","Criar convites e aprovar revendas"],["canSell","Definir preços e vender licenças"],["canPromote","Criar Submasters"]].map(([key,label])=><label key={key}><input type="checkbox" checked={!!policy[key]} onChange={e=>setPolicy(v=>({...v,[key]:e.target.checked}))}/>{label}</label>)}</div>
        <div className="row" style={{gap:12,flexWrap:"wrap"}}><label>Máximo de revendas (opcional)<input type="number" min="0" placeholder="Sem limite" value={policy.maxChildren??""} onChange={e=>setPolicy(v=>({...v,maxChildren:optionalNumber(e.target.value)}))}/></label><label>Máximo de níveis (opcional)<input type="number" min="1" placeholder="Sem limite" value={policy.maxDepth??""} onChange={e=>setPolicy(v=>({...v,maxDepth:optionalNumber(e.target.value)}))}/></label></div>
        <div className="row" style={{gap:8,flexWrap:"wrap"}}><button className="btn primary" disabled={busy} onClick={()=>enable(true)}>{detail.account.distributionRole==="master"?"Salvar permissões":"Transformar em Master"}</button>{detail.account.distributionRole==="master"&&<button className="btn" disabled={busy||(detail.childrenTotal??detail.children.length)>0} onClick={()=>window.confirm("Desativar a função Master dessa revenda?")&&enable(false)}>Remover função Master</button>}</div>
        <hr/><h4>Vincular a um Master existente</h4><p className="muted">A conta deve estar independente e não possuir uma sub-rede. Use apenas para vincular contas existentes.</p><div className="row" style={{alignItems:"end",gap:8,flexWrap:"wrap"}}><label>Master superior<select value={parentId} onChange={e=>setParentId(e.target.value)}><option value="">Selecione…</option>{tree.filter(p=>p.distributionRole==="master"&&p.id!==selected).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button className="btn" disabled={busy||!parentId||!!detail.account.parentPartnerId} onClick={attach}>Vincular</button>{detail.account.parentPartnerId&&<button className="btn" disabled={busy||(detail.childrenTotal??detail.children.length)>0} onClick={()=>window.confirm("Desvincular a revenda e deixá-la independente? Verifique suas compras e contratos primeiro.")&&detach()}>Desvincular</button>}</div>
        {detail.account.distributionRole==="master"&&<><hr/>
        <h4>Convidar revenda para {detail.account.name}</h4>
        <p className="muted">O novo revendedor abre o link, cria seu acesso e entra automaticamente na rede deste Master. Convites são secretos: o link completo só aparece na criação.</p>
        {!detail.policy.canInvite?<p className="error">Convites estão desativados para este Master. Marque “Criar convites e aprovar revendas” acima e salve as permissões.</p>:<>
        <div className="row" style={{gap:12,alignItems:"end",flexWrap:"wrap"}}>
          <label>Cadastros por link (opcional)<input type="number" min="1" placeholder="Sem limite" value={inviteUses} onChange={e=>setInviteUses(e.target.value)}/></label>
          <label>Validade em dias (opcional)<input type="number" min="1" placeholder="Sem vencimento" value={inviteDays} onChange={e=>setInviteDays(e.target.value)}/></label>
          <button className="btn primary" disabled={busy} onClick={makeInvite}>Gerar link de convite</button>
        </div>
        {inviteUrl&&<div style={{marginTop:12,display:"grid",gap:8}}>
          <label>Link pronto para enviar<input aria-label="Convite da revenda" value={inviteUrl} readOnly onFocus={e=>e.target.select()}/></label>
          <div className="row" style={{gap:8,flexWrap:"wrap"}}><button className="btn primary" onClick={copyInvite}>Copiar link</button>
          <a className="btn" href={shareWhatsapp(inviteUrl,detail.account.name)} target="_blank" rel="noopener noreferrer">Enviar pelo WhatsApp</a></div>
        </div>}
        {invites.length>0&&<details style={{marginTop:10}}><summary>Convites emitidos ({invites.length})</summary><ul>{invites.map(inv=><li key={inv.id}>
          {inviteDescription(inv)}
          {inv.revokedAt?" · Revogado":<button className="btn sm" disabled={busy} onClick={()=>act(()=>api(`/admin/network/accounts/${selected}/invites/${inv.id}/revoke`,{method:"POST"}),"Convite revogado.").then(()=>api(`/admin/network/accounts/${selected}/invites`).then(d=>setInvites(d.data||[])))}>Revogar</button>}
        </li>)}</ul></details>}
        </>}
        <hr/><h4>Preços do Master</h4><p className="muted">O Superadmin pode definir os preços de qualquer Master. Valores em créditos; não configura repasse bancário.</p><div className="row" style={{gap:10,alignItems:"end",flexWrap:"wrap"}}><label>Meses<input type="number" min="1" max="120" value={newPrice.months} onChange={e=>setNewPrice(v=>({...v,months:e.target.value}))}/></label><label>Créditos por licença<input type="number" min="1" value={newPrice.priceCredits} onChange={e=>setNewPrice(v=>({...v,priceCredits:e.target.value}))}/></label><button className="btn primary" disabled={busy} onClick={()=>act(()=>api(`/admin/network/accounts/${selected}/prices`,{method:"PUT",body:{months:Number(newPrice.months),priceCredits:Number(newPrice.priceCredits),active:true}}),"Preço salvo.")}>Salvar preço</button></div><div style={{marginTop:8}}>{offers.map(p=><span key={p.months} style={{display:"inline-block",padding:8}}>{p.months} mês(es): {p.priceCredits} créditos · {p.active?"Ativo":"Pausado"}</span>)}</div><h4>Vendas recentes</h4>{sales.length?<ul>{sales.slice(0,12).map(v=><li key={v.id}>{v.counterpartyName}: {v.quantity} × {v.months} meses — {v.totalCredits} créditos</li>)}</ul>:<p className="muted">Sem vendas registradas.</p>}</>}
        {detail.account.distributionRole==="master"&&<MasterPixAdmin key={selected} id={selected}/>}
        <hr/><h4>Recursos disponíveis para a conta</h4><p className="muted">O Superadmin controla o que cada revenda pode acessar. Restrições do Master superior também são respeitadas.</p>
        {resources&&Object.entries(names).map(([key,label])=><div key={key} className="distribution-resource"><span>{label}{resources.effective[key]?.enabled===false&&<small> (indisponível na rede)</small>}</span><div className="row" style={{gap:8,alignItems:"center"}}>{key==="servers"&&<label>Limite<input type="number" min="0" aria-label="Limite de servidores" defaultValue={resources.direct[key]?.limit??""} onBlur={e=>{const limit=e.target.value===""?null:Number(e.target.value);if(limit!==resources.direct[key]?.limit)act(()=>api(`/admin/network/accounts/${selected}/resources`,{method:"PUT",body:{resource:key,enabled:resources.direct[key]?.enabled!==false,limit}}),"Limite atualizado.");}} style={{width:80}}/></label>}<input aria-label={`${label} habilitado`} type="checkbox" checked={resources.direct[key]?.enabled!==false} disabled={busy} onChange={e=>act(()=>api(`/admin/network/accounts/${selected}/resources`,{method:"PUT",body:{resource:key,enabled:e.target.checked,limit:resources.direct[key]?.limit??null}}),"Recurso atualizado.")}/></div></div>)}
      </>}</div>
    </div>
  </section>;
}
