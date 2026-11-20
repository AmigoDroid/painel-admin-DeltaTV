import {useCallback,useEffect,useState} from 'react';
import {api} from '../api.js';
import {formatBRL,toCents} from '@deltatv/ui/money';
import PortalUsageAdmin from './PortalUsage.jsx';
const money=formatBRL;
const date=s=>s?new Date(s).toLocaleDateString('pt-BR'):'—';
const Panel=({title,sub,children})=><section className="panel" style={{padding:20,display:'grid',gap:14,minWidth:0}}><header><h2>{title}</h2>{sub&&<p className="muted">{sub}</p>}</header>{children}</section>;
const Line=({label,children})=><label style={{display:'grid',gap:6,fontSize:14}}>{label}{children}</label>;
const Layout=({children})=><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,240px),1fr))',gap:12}}>{children}</div>;
const permissions=[['canSell','Vender acesso ao painel'],['canCreateSubmasters','Cadastrar Submasters'],['canViewFinance','Consultar financeiro'],['canManageGateways','Configurar gateways']];
export default function PortalSales(){
 const [tab,setTab]=useState('masters'),[overview,setOverview]=useState(null),[packages,setPackages]=useState([]),[candidates,setCandidates]=useState([]),[tree,setTree]=useState([]),[receivables,setReceivables]=useState([]),[prices,setPrices]=useState([]),[invites,setInvites]=useState([]),[tickets,setTickets]=useState([]),[detail,setDetail]=useState(null);
 const [master,setMaster]=useState({partnerId:'',parentPartnerId:''}),[reply,setReply]=useState('');
 const [newMaster,setNewMaster]=useState({accountMode:'new',partnerId:'',companyName:'',name:'',email:'',password:'',
  planCode:'',activations:'',activationUnlimited:false,
  permissions:{canSell:true,canCreateSubmasters:false,canTransferStock:false,canViewFinance:false,canManageGateways:false},
  free:true,months:'12',price:'',paymentMode:'default'});
 const [priceEdit,setPriceEdit]=useState({sellerId:'',planCode:'',unitPrice:'',reason:''});
 const [loading,setLoading]=useState(false),[err,setErr]=useState(''),[notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{
  const jobs=[['overview',api('/admin/portal-sales')],['packages',api('/admin/portal-sales/packages')],['candidates',api('/admin/portal-sales/candidates')],['tree',api('/admin/portal-sales/tree')],['receivables',api('/admin/portal-sales/receivables')],['prices',api('/admin/portal-sales/negotiated-prices')],['invites',api('/admin/portal-sales/invitations')],['tickets',api('/admin/portal-sales/support/tickets')]];
  const answers=await Promise.allSettled(jobs.map(x=>x[1]));
  const failed=[];for(let i=0;i<jobs.length;i++){
   const [key]=jobs[i],a=answers[i];if(a.status!=='fulfilled'){failed.push(key);continue;}
   const result=a.value;
   ({overview:setOverview,packages:x=>setPackages(x.items||[]),candidates:setCandidates,tree:x=>setTree(x.items||[]),receivables:x=>setReceivables(x.items||[]),prices:x=>setPrices(x.items||[]),invites:x=>setInvites(x.items||[]),tickets:x=>setTickets(x.items||[])})[key](result);
  }if(failed.length)setErr(`Não foi possível carregar: ${failed.join(', ')}. Verifique as migrações e permissões.`);
 },[]);
 useEffect(()=>{void refresh();},[refresh]);
 const act=async(url,method,body)=>{setLoading(true);setErr('');setNotice('');try{const result=await api(url,{method,body});setNotice('Operação salva e auditada.');await refresh();return result;}catch(e){setErr(e.message||'Erro de operação.');return null;}finally{setLoading(false);}};
 const roots=(overview?.sellers||[]).filter(s=>!s.parent_partner_id);
 const pending=receivables.filter(x=>x.status==='pending');
 const tabs=[['masters','Masters e rede'],['receivables','Recebimentos de Masters'],['support','Central de Atendimento'],['usage','Infraestrutura']];
 return <div style={{display:'grid',gap:16,maxWidth:1200}}>
  <header><h1>Rede comercial do Painel do Parceiro</h1><p className="muted">Cadastre Masters, escolha o pacote, defina permissões e decida se haverá cobrança. Não há estoque de acessos.</p><a href="#service-packages" className="btn">Gerenciar Pacotes de Serviço</a></header>
  <nav aria-label="Gestão comercial" style={{display:'flex',flexWrap:'wrap',gap:8}}>{tabs.map(([id,label])=><button key={id} type="button" className={tab===id?'btn primary':'btn'} onClick={()=>setTab(id)}>{label}</button>)}</nav>
  {err&&<p className="alert" role="alert">{err}</p>}{notice&&<p className="notice" role="status">{notice}</p>}
  {tab==='masters'&&<>
   {!packages.some(p=>p.active&&p.service_tier)&&<div className="notice" role="status">Para começar, cadastre um Pacote de Serviço. <button type="button" className="outline" onClick={()=>{window.location.hash='service-packages';}}>Criar pacote</button></div>}
   <Panel title="Cadastrar Master" sub="Escolha o pacote, ajuste as ativações e as permissões. Sem precisar criar a conta em outra tela.">
    <form style={{display:'grid',gap:16}} onSubmit={async e=>{e.preventDefault();if(!newMaster.free&&toCents(newMaster.price)==null){setErr('Informe um preço válido em reais.');return;}const result=await act('/admin/portal-sales/masters/quick','POST',{
     account:newMaster.accountMode==='existing'?{mode:'existing',partnerId:newMaster.partnerId}:{mode:'new',companyName:newMaster.companyName,
       name:newMaster.name,email:newMaster.email,password:newMaster.password},
     planCode:newMaster.planCode,activationLimit:newMaster.activationUnlimited?null:Number(newMaster.activations),
     permissions:newMaster.permissions,free:newMaster.free,quantityMonths:Number(newMaster.months),
     ...(!newMaster.free?{agreedPriceCents:toCents(newMaster.price),paymentMode:newMaster.paymentMode}:{})
    });if(result){setNotice(result.free?'Master cadastrado sem cobrança. Pacote e permissões liberados.':'Cadastro criado. O acesso aguarda confirmação do pagamento.');
      setNewMaster(prev=>({...prev,companyName:'',name:'',email:'',password:'',partnerId:''}));}}}>
     <div style={{display:'grid',gap:10}}>
      <strong>1. Quem receberá o acesso?</strong>
      <div style={{display:'flex',flexWrap:'wrap',gap:16}}>
       <label><input type="radio" name="masterAccountMode" checked={newMaster.accountMode==='new'} onChange={()=>setNewMaster({...newMaster,accountMode:'new'})}/> Criar conta nova</label>
       <label><input type="radio" name="masterAccountMode" checked={newMaster.accountMode==='existing'} onChange={()=>setNewMaster({...newMaster,accountMode:'existing'})}/> Conta existente</label>
      </div>
      {newMaster.accountMode==='new'?<Layout>
       <Line label="Empresa / Nome do parceiro"><input required minLength={2} maxLength={160} autoComplete="organization" value={newMaster.companyName} onChange={e=>setNewMaster({...newMaster,companyName:e.target.value})}/></Line>
       <Line label="Responsável"><input required minLength={2} maxLength={160} autoComplete="name" value={newMaster.name} onChange={e=>setNewMaster({...newMaster,name:e.target.value})}/></Line>
       <Line label="E-mail de acesso"><input required type="email" autoComplete="email" value={newMaster.email} onChange={e=>setNewMaster({...newMaster,email:e.target.value})}/></Line>
       <Line label="Senha inicial (10 caracteres ou mais)"><input required type="password" minLength={10} maxLength={128} autoComplete="new-password" value={newMaster.password} onChange={e=>setNewMaster({...newMaster,password:e.target.value})}/></Line>
      </Layout>:<Line label="Parceiro existente"><select required value={newMaster.partnerId} onChange={e=>setNewMaster({...newMaster,partnerId:e.target.value})}>
       <option value="">Selecione</option>{candidates.filter(x=>!x.seller_role&&x.status==='active').map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
      </select></Line>}
     </div>
     <div style={{display:'grid',gap:10}}>
      <strong>2. Pacote de Serviço e ativações</strong>
      <Layout>
       <Line label="Pacote de Serviço"><select required value={newMaster.planCode} onChange={e=>{const pkg=packages.find(p=>p.code===e.target.value);
         setNewMaster({...newMaster,planCode:e.target.value,activationUnlimited:pkg?.activation_limit==null,
           activations:pkg?.activation_limit==null?'':String(pkg.activation_limit),price:pkg?String(Number(pkg.wholesale_cents)/100):''});}}>
        <option value="">Escolha o pacote</option>{packages.filter(p=>p.active&&p.service_tier).map(p=><option key={p.code} value={p.code}>{p.name}</option>)}
       </select></Line>
       <Line label="Limite de ativações"><input type="number" min="0" max="2000000000" disabled={!newMaster.planCode||newMaster.activationUnlimited}
         required={!newMaster.activationUnlimited} value={newMaster.activations} onChange={e=>setNewMaster({...newMaster,activations:e.target.value})}/>
        <span><input type="checkbox" disabled={!newMaster.planCode||packages.find(p=>p.code===newMaster.planCode)?.activation_limit!==null}
          checked={newMaster.activationUnlimited} onChange={e=>setNewMaster({...newMaster,activationUnlimited:e.target.checked})}/> Ilimitadas (se permitido pelo pacote)</span>
       </Line>
      </Layout>
      {packages.find(p=>p.code===newMaster.planCode)&&<p className="muted">DNS: {packages.find(p=>p.code===newMaster.planCode).max_dns===null?'ilimitados':`${packages.find(p=>p.code===newMaster.planCode).max_dns} por código`}. Os demais benefícios serão aplicados automaticamente.</p>}
     </div>
     <div style={{display:'grid',gap:10}}>
      <strong>3. Permissões</strong>
      <Layout>{permissions.map(([key,label])=><label key={key}>
       <input type="checkbox" checked={newMaster.permissions[key]} onChange={e=>setNewMaster({...newMaster,permissions:{...newMaster.permissions,[key]:e.target.checked}})}/> {label}
      </label>)}</Layout>
      <p className="muted">O Master poderá configurar seus Submasters somente quando autorizado. A API também valida essas permissões.</p>
     </div>
     <div style={{display:'grid',gap:10}}>
      <strong>4. Cobrança</strong>
      <div style={{display:'flex',flexWrap:'wrap',gap:16}}>
       <label><input type="radio" name="masterCharge" checked={newMaster.free} onChange={()=>setNewMaster({...newMaster,free:true})}/> Sem cobrança — concessão DeltaTV</label>
       <label><input type="radio" name="masterCharge" checked={!newMaster.free} onChange={()=>setNewMaster({...newMaster,free:false})}/> Cobrar pelo acesso</label>
      </div>
      {!newMaster.free&&<Layout>
       <Line label="Valor negociado por mês (R$)"><input required min="0.01" step="0.01" type="number" value={newMaster.price} onChange={e=>setNewMaster({...newMaster,price:e.target.value})}/></Line>
       <Line label="Pagamento"><select value={newMaster.paymentMode} onChange={e=>setNewMaster({...newMaster,paymentMode:e.target.value})}>
        <option value="default">Gateway padrão DeltaTV</option><option value="manual">Pix externo — confirmação DeltaTV</option>
       </select></Line>
      </Layout>}
      <Line label={newMaster.free?'Validade gratuita (meses)':'Meses contratados'}><input type="number" min="1" max="120" required value={newMaster.months} onChange={e=>setNewMaster({...newMaster,months:e.target.value})}/></Line>
      {newMaster.free?<p className="muted">Somente a DeltaTV pode conceder acesso gratuito. O pacote de serviço será ativado diretamente.</p>
       :<p className="muted">Pedido: {money(toCents(newMaster.price)*Number(newMaster.months||0))}. A conta nova só poderá entrar após o pagamento ser confirmado.</p>}
     </div>
     <button className="btn primary" disabled={loading||!newMaster.planCode||(newMaster.accountMode==='existing'?!newMaster.partnerId:!newMaster.email||newMaster.password.length<10)}>
      {loading?'Salvando...':newMaster.free?'Cadastrar Master sem cobrança':'Cadastrar Master e gerar cobrança'}
     </button>
    </form>
   </Panel>
   <details><summary style={{cursor:'pointer',fontWeight:600,padding:12}}>Gerenciar Masters e Submasters cadastrados</summary>
   <Panel title="Rede de Masters e Submasters" sub="A DeltaTV visualiza todos os níveis. Abra um integrante para alterar suas permissões individualmente.">
    <div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th>Integrante</th><th>Posição</th><th>Clientes diretos</th><th>Permissões</th></tr></thead><tbody>{tree.map(s=><tr key={s.partner_id}><td><span style={{paddingLeft:Math.min(s.depth,12)*14}}>{s.depth?'↳ ':''}{s.name}</span></td><td>{s.role==='master'?'Master':'Submaster'}</td><td>{s.direct_customers}</td><td><button className="outline" type="button" onClick={async()=>{try{const result=await api('/admin/portal-sales');setOverview(result);setMaster(m=>({...m,partnerId:s.partner_id}));}catch(e){setErr(e.message)}}}>Ver rede</button></td></tr>)}</tbody></table></div>
    <p className="muted">Gerenciar as permissões diretas:</p>
    <Line label="Master / Submaster"><select value={master.partnerId} onChange={e=>setMaster({...master,partnerId:e.target.value})}><option value="">Selecionar</option>{(overview?.sellers||[]).map(s=><option key={s.partner_id} value={s.partner_id}>{s.name}{s.public_partner_number?` · ID ${s.public_partner_number}`:''}</option>)}</select></Line>
    {overview?.sellers?.find(s=>s.partner_id===master.partnerId)&&<Layout>{permissions.map(([key,label])=>{const s=overview.sellers.find(s=>s.partner_id===master.partnerId);const column=({canSell:'can_sell',canCreateSubmasters:'can_create_submasters',canTransferStock:'can_transfer_stock',canViewFinance:'can_view_finance',canManageGateways:'can_manage_gateways'})[key];return <label key={key}><input type="checkbox" checked={Boolean(s[column])} disabled={loading} onChange={e=>{void act(`/admin/portal-sales/sellers/${master.partnerId}/permissions`,'PATCH',{[key]:e.target.checked});}}/> {label}</label>})}</Layout>}
   </Panel>
   </details>
   <details><summary style={{cursor:'pointer',fontWeight:600,padding:12}}>Consultar convites comerciais</summary>
   <Panel title="Convites comerciais" sub="A DeltaTV pode cancelar convites ainda não aceitos.">
    <div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th>Master</th><th>Convidado</th><th>Pacote</th><th>Tipo</th><th>Estado</th><th></th></tr></thead><tbody>{invites.map(x=><tr key={x.id}><td>{x.seller_name}</td><td>{x.invited_email}</td><td>{x.plan_code}</td><td>{x.invite_type}</td><td>{x.status}</td><td>{x.status==='pending'&&<button disabled={loading} className="outline" onClick={()=>{if(window.confirm('Cancelar convite pendente?'))void act(`/admin/portal-sales/invitations/${x.id}/revoke`,'POST',{});}}>Cancelar</button>}</td></tr>)}</tbody></table></div>
   </Panel>
   </details>
  </>}
  {tab==='receivables'&&<>
   <Layout><div className="stat"><small>Recebimentos confirmados neste mês</small><strong>{money(overview?.finance?.received_this_month_cents)}</strong></div><div className="stat"><small>Pendente de recebimento</small><strong>{money(overview?.finance?.pending_cents)}</strong></div><div className="stat"><small>Masters de primeiro nível</small><strong>{roots.length}</strong></div></Layout>
   <details><summary style={{cursor:'pointer',fontWeight:600,padding:12}}>Preços individuais negociados</summary>
   <Panel title="Preços negociados com Masters" sub="Cada Master de primeiro nível pode ter seu próprio preço de compra. A alteração valerá somente para pedidos futuros.">
    <form style={{display:'grid',gap:12}} onSubmit={e=>{e.preventDefault();if(toCents(priceEdit.unitPrice)==null){setErr('Informe um preço válido em reais.');return;}void act('/admin/portal-sales/negotiated-prices','PUT',{
      sellerId:priceEdit.sellerId,planCode:priceEdit.planCode,unitPriceCents:toCents(priceEdit.unitPrice),reason:priceEdit.reason});}}>
     <Layout><Line label="Master"><select required value={priceEdit.sellerId} onChange={e=>setPriceEdit({...priceEdit,sellerId:e.target.value})}><option value="">Selecionar</option>{roots.map(r=><option value={r.partner_id} key={r.partner_id}>{r.name}</option>)}</select></Line>
      <Line label="Pacote de Serviço"><select required value={priceEdit.planCode} onChange={e=>setPriceEdit({...priceEdit,planCode:e.target.value})}><option value="">Selecionar</option>{packages.filter(p=>p.service_tier).map(p=><option key={p.code} value={p.code}>{p.name}</option>)}</select></Line>
      <Line label="Preço acordado/mês (R$)"><input type="number" min="0.01" step="0.01" required value={priceEdit.unitPrice} onChange={e=>setPriceEdit({...priceEdit,unitPrice:e.target.value})}/></Line>
      <Line label="Motivo da negociação"><input minLength={8} maxLength={500} required value={priceEdit.reason} onChange={e=>setPriceEdit({...priceEdit,reason:e.target.value})}/></Line></Layout>
     <button className="btn primary" disabled={loading}>Salvar preço negociado</button>
    </form>
    <div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th>Master</th><th>Pacote</th><th>Preço de compra</th></tr></thead><tbody>{prices.map(p=><tr key={`${p.seller_partner_id}-${p.plan_code}`}><td>{p.master_name}</td><td>{p.package_name}</td><td>{money(p.unit_price_cents)}</td></tr>)}</tbody></table></div>
   </Panel>
   </details>
   <Panel title="Recebimentos de Masters" sub="Cobranças do próprio acesso ao painel; pagamentos pelo gateway ou Pix externo, inclusive histórico anterior. Comprovante sozinho não aprova o pedido.">
    <div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th>Master</th><th>Pacote</th><th>Vigência (meses)</th><th>Valor</th><th>Pagamento</th><th>Estado</th><th>Ação</th></tr></thead><tbody>{receivables.map(o=><tr key={o.id}><td>{o.master_name}</td><td>{o.package_name}</td><td>{o.quantity_months}</td><td>{money(o.total_cents)}</td><td>{o.payment_gateway||'manual'}</td><td>{o.status==='paid'?'Confirmado':o.status==='pending'?'Pendente':o.status}</td><td>{o.status==='pending'&&<>{o.payment_gateway!=='manual'&&<button disabled={loading} className="outline" onClick={()=>void act(`/admin/portal-sales/orders/${o.id}/checkout`,'POST',{})}>Gerar checkout</button>}{o.payment_gateway==='manual'&&<button type="button" className="outline" onClick={()=>{const ref=window.prompt('Referência bancária da transação (mín. 6 caracteres):');if(ref?.length>=6&&window.confirm(`Você conferiu ${money(o.total_cents)} na sua conta?`))void act(`/admin/portal-sales/orders/${o.id}/settle`,'POST',{settlementRef:ref,method:'pix_manual_confirmed'});}}>Confirmar Pix externo</button>}</>}{o.checkout_url&&<a target="_blank" rel="noreferrer" href={o.checkout_url}>Pagar</a>}</td></tr>)}</tbody></table></div>{!receivables.length&&<p className="muted">Nenhuma cobrança criada.</p>}
   </Panel>
  </>}
  {tab==='support'&&<Panel title="DeltaTV — Central de Atendimento" sub="Visualização de todos os chamados recebidos, inclusive aqueles tratados por Masters.">
   <div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th>Protocolo</th><th>Cliente</th><th>Assunto</th><th>Atendente</th><th>Situação</th></tr></thead><tbody>{tickets.map(t=><tr key={t.id} onClick={async()=>{try{setDetail(await api(`/admin/portal-sales/support/tickets/${t.id}`));}catch(e){setErr(e.message)}}} style={{cursor:'pointer'}}><td>#{t.protocol}</td><td>{t.creator_name}</td><td>{t.subject}</td><td>{t.assigned_name||'DeltaTV'}</td><td>{t.status}</td></tr>)}</tbody></table></div>
   {detail&&<div style={{display:'grid',gap:8}}><h3>Chamado #{detail.ticket.protocol}</h3>{detail.messages.map(m=><div className="notice" key={m.id}>{m.internal&&<b>Nota interna · </b>}{m.body}</div>)}<textarea rows="3" value={reply} onChange={e=>setReply(e.target.value)} placeholder="Resposta ao chamado"/><button className="btn primary" disabled={!reply.trim()||loading} onClick={async()=>{const ok=await act(`/admin/portal-sales/support/tickets/${detail.ticket.id}/reply`,'POST',{body:reply,internal:false,status:'in_progress'});if(ok){setReply('');setDetail(await api(`/admin/portal-sales/support/tickets/${detail.ticket.id}`));}}}>Responder</button></div>}
  </Panel>}
  {tab==='usage'&&<PortalUsageAdmin/>}
 </div>;
}
