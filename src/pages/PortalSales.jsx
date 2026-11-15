import {useCallback,useEffect,useState} from 'react';
import {api} from '../api.js';

const brl=n=>Number(n||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const cents=value=>{const n=Number(String(value).replace(',','.'));return Number.isFinite(n)&&n>=0?Math.round(n*100):NaN;};
const monthDate=x=>x?new Date(x).toLocaleDateString('pt-BR'):'—';
const Section=({title,description,children})=><section className="panel" style={{padding:18,display:'grid',gap:12,minWidth:0}}><div><h2>{title}</h2>{description&&<p className="muted">{description}</p>}</div>{children}</section>;
const FormField=({label,children})=><label style={{display:'grid',gap:5,minWidth:0}}>{label}{children}</label>;
const Grid=({children})=><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,185px),1fr))',gap:12}}>{children}</div>;
const Opt=({value,children})=><option value={value}>{children}</option>;
const empty='';
export default function PortalSales(){
 const [view,setView]=useState(null),[candidates,setCandidates]=useState([]),[invitations,setInvitations]=useState([]),[networkTree,setNetworkTree]=useState([]),[search,setSearch]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [plan,setPlan]=useState({code:'',name:'',wholesale:'',minimum:''});
 const [seller,setSeller]=useState({partnerId:'',parentPartnerId:''});
 const [order,setOrder]=useState({sellerPartnerId:'',planCode:'',quantityMonths:'1'});
 const [settlement,setSettlement]=useState({orderId:'',settlementRef:'',method:'pix_manual_confirmed'});
 const [contract,setContract]=useState({sellerPartnerId:'',customerPartnerId:'',planCode:'',months:'1',resale:'',monthly:'0'});
 const [exception,setException]=useState({sellerPartnerId:'',planCode:'',quantityMonths:'1',reason:''});
 const [costs,setCosts]=useState(null);
 const [contractRequestId,setContractRequestId]=useState(()=>crypto.randomUUID());
 useEffect(()=>{if(view?.forecast?.settings&&!costs){const s=view.forecast.settings;setCosts({vps:String(Number(s.vps_monthly_cents)/100),domain:String(Number(s.domain_annual_cents)/100),other:String(Number(s.other_monthly_cents)/100),proxy:String(Number(s.proxy_cost_per_gb_cents)/100),gb:String(s.forecast_proxy_gb_per_partner),margin:String(s.target_margin_bp/100),tax:String(s.tax_bp/100),reserve:String(s.reserve_bp/100)});}},[view,costs]);
 const load=useCallback(async()=>{const [a,b,c,d]=await Promise.all([api('/admin/portal-sales'),api('/admin/portal-sales/candidates',{query:{q:search}}),api('/admin/portal-sales/invitations'),api('/admin/portal-sales/tree')]);setView(a);setCandidates(b);setInvitations(c.items||[]);setNetworkTree(d.items||[]);},[search]);
 useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
 const submit=async(url,method,body)=>{
   setBusy(true);setError('');setSuccess('');
   try{await api(url,{method,body});setSuccess('Operação concluída e auditada.');await load();return true;}catch(e){setError(e.message);return false;}finally{setBusy(false)};
 };
 const sellers=view?.sellers||[],plans=view?.plans||[],pending=(view?.orders||[]).filter(o=>o.status==='pending');
 const available=candidates.filter(p=>p.status==='active');
 return <div style={{display:'grid',gap:16,maxWidth:1150}}>
  <header><h1>Venda do Painel do Parceiro</h1><p className="muted">Rede comercial independente das Revendas de TVs. Estoque = meses de acesso ao portal <strong>parceiro.deltatv.com.br</strong>.</p></header>
  <div className="notice">Pagamento de pedidos confirmado MANUALMENTE pelo Superadmin após conferência do extrato bancário. Não é confirmação automática via Pix. Mensalidades de revenda ficam registradas, sem cobrança automática nesta etapa.</div>
  {error&&<p role="alert" style={{color:'var(--bad,#d44)'}}>{error}</p>}{success&&<p role="status" style={{color:'var(--ok,#29875b)'}}>{success}</p>}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,180px),1fr))',gap:12}}>
   <div className="panel" style={{padding:16}}><small>Recebido pela plataforma neste mês</small><h2>{brl(view?.finance?.received_this_month_cents)}</h2><small className="muted">Pedidos de estoque liquidados</small></div>
   <div className="panel" style={{padding:16}}><small>Pedidos pendentes (não recebidos)</small><h2>{brl(view?.finance?.pending_cents)}</h2><small className="muted">Fora da receita</small></div>
   <div className="panel" style={{padding:16}}><small>Recebimentos menos custos projetados</small><h2>{brl(view?.finance?.estimatedCashAfterForecastCostsCents)}</h2><small className="muted">Indicador de caixa, não lucro líquido</small></div>
  </div>
  <Section title="Simulador de custo e margem da plataforma" description="Cenário estimado para definir seu preço-base. Não é medição de banda ou lucro contábil; os custos reais deverão ser apurados pela telemetria.">
   <Grid>
    <div className="stat"><small>Custo fixo estimado por mês</small><strong>{brl(view?.forecast?.monthlyFixedCents)}</strong></div>
    <div className="stat"><small>Parceiros ativos no rateio</small><strong>{view?.forecast?.activePartners??'—'}</strong></div>
    <div className="stat"><small>Custo médio estimado por parceiro</small><strong>{brl(view?.forecast?.estimatedCostPerPartnerCents)}</strong></div>
    <div className="stat"><small>Preço-base recomendado por mês</small><strong>{brl(view?.forecast?.suggestedWholesaleCents)}</strong></div>
   </Grid>
   {costs&&<form onSubmit={e=>{e.preventDefault();submit('/admin/portal-sales/costs','PUT',{vpsMonthlyCents:cents(costs.vps),domainAnnualCents:cents(costs.domain),otherMonthlyCents:cents(costs.other),proxyCostPerGbCents:cents(costs.proxy),forecastProxyGbPerPartner:Number(costs.gb),targetMarginBp:Math.round(Number(costs.margin)*100),taxBp:Math.round(Number(costs.tax)*100),reserveBp:Math.round(Number(costs.reserve)*100)});}} style={{display:'grid',gap:10}}>
    <Grid>
     {[
       ['vps','VPS mensal (R$)'],['domain','Domínio anual (R$)'],['other','Outros custos mensais (R$)'],
       ['proxy','Custo por GB de proxy (R$)'],['gb','Consumo mensal estimado (GB/parceiro)'],
       ['margin','Margem desejada (%)'],['tax','Tributos/taxas (%)'],['reserve','Reserva de expansão (%)'],
     ].map(([key,label])=><FormField key={key} label={label}><input required inputMode="decimal" value={costs[key]} onChange={e=>setCosts({...costs,[key]:e.target.value})}/></FormField>)}
    </Grid>
    <button className="btn primary" disabled={busy}>Salvar parâmetros de custo</button>
   </form>}
   <p className="muted">O custo mensal usa o total atual de contas de conteúdo ativas como rateio. O consumo de PlayerWeb proxy informado é projeção, não tráfego medido. Compare o preço recomendado com o preço-base antes de lançar um plano.</p>
  </Section>
  <Section title="Localizar contas do Painel do Parceiro" description="Escolha contas existentes; o cadastro inicial de novos clientes continua pela tela Parceiros.">
   <FormField label="Pesquisar por nome ou código"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome do parceiro"/></FormField>
   <p className="muted">{candidates.length} conta(s) encontradas. O cadastro não transforma uma conta de Revenda em parceiro.</p>
  </Section>
  <Grid>
   <Section title="1. Cadastrar Master ou Submaster" description="Sem limite de profundidade; um pai deve estar autorizado a vender.">
    <form onSubmit={e=>{e.preventDefault();submit('/admin/portal-sales/sellers','POST',{partnerId:seller.partnerId,parentPartnerId:seller.parentPartnerId||null});}} style={{display:'grid',gap:10}}>
     <FormField label="Conta de parceiro"><select required value={seller.partnerId} onChange={e=>setSeller({...seller,partnerId:e.target.value})}><Opt value={empty}>Selecionar parceiro</Opt>{available.filter(p=>!p.seller_role).map(p=><Opt key={p.id} value={p.id}>{p.name} · {p.slug}</Opt>)}</select></FormField>
     <FormField label="Master pai (opcional)"><select value={seller.parentPartnerId} onChange={e=>setSeller({...seller,parentPartnerId:e.target.value})}><Opt value={empty}>Sem pai — Master principal</Opt>{sellers.filter(s=>s.active&&s.can_sell).map(s=><Opt key={s.partner_id} value={s.partner_id}>{s.name}</Opt>)}</select></FormField>
     <button className="btn primary" disabled={busy||!seller.partnerId}>Cadastrar distribuidor</button>
    </form>
   </Section>
   <Section title="2. Planos de acesso" description="Preço-base e piso de revenda por mês de acesso; a duração é livre na compra.">
    <form onSubmit={e=>{e.preventDefault();submit('/admin/portal-sales/plans','PUT',{code:plan.code,name:plan.name,wholesaleCents:cents(plan.wholesale),minResaleCents:cents(plan.minimum),active:true});}} style={{display:'grid',gap:10}}>
     <FormField label="Identificador"><input required pattern="[a-z][a-z0-9_-]{1,31}" placeholder="painel_pro" value={plan.code} onChange={e=>setPlan({...plan,code:e.target.value})}/></FormField>
     <FormField label="Nome"><input required value={plan.name} onChange={e=>setPlan({...plan,name:e.target.value})}/></FormField>
     <FormField label="Preço-base por mês (R$)"><input required inputMode="decimal" value={plan.wholesale} onChange={e=>setPlan({...plan,wholesale:e.target.value})}/></FormField>
     <FormField label="Piso de revenda (R$)"><input required inputMode="decimal" value={plan.minimum} onChange={e=>setPlan({...plan,minimum:e.target.value})}/></FormField>
     <button className="btn primary" disabled={busy}>Salvar plano</button>
    </form>
   </Section>
   <Section title="3. Pedido de estoque pré-pago" description="Criar pedido não libera estoque. A liberação exige confirmação bancária pelo Superadmin (já implementada).">
    <form onSubmit={e=>{e.preventDefault();submit('/admin/portal-sales/orders','POST',{sellerPartnerId:order.sellerPartnerId,planCode:order.planCode,quantityMonths:Number(order.quantityMonths)});}} style={{display:'grid',gap:10}}>
     <FormField label="Master ou Submaster"><select required value={order.sellerPartnerId} onChange={e=>setOrder({...order,sellerPartnerId:e.target.value})}><Opt value={empty}>Selecionar</Opt>{sellers.filter(s=>s.active).map(s=><Opt key={s.partner_id} value={s.partner_id}>{s.name}</Opt>)}</select></FormField>
     <FormField label="Plano"><select required value={order.planCode} onChange={e=>setOrder({...order,planCode:e.target.value})}><Opt value={empty}>Selecionar</Opt>{plans.filter(p=>p.active).map(p=><Opt key={p.code} value={p.code}>{p.name} — {brl(p.wholesale_cents)}/mês</Opt>)}</select></FormField>
     <FormField label="Quantidade de meses"><input type="number" required min="1" max="100000" value={order.quantityMonths} onChange={e=>setOrder({...order,quantityMonths:e.target.value})}/></FormField>
     <button className="btn primary" disabled={busy}>Gerar pedido pendente</button>
    </form>
   </Section>
   <Section title="4. Confirmar recebimento" description="Somente depois de conferir o pagamento na conta bancária. Referência não pode ser reutilizada.">
    <form onSubmit={e=>{e.preventDefault();const found=pending.find(p=>p.id===settlement.orderId);if(!found)return;if(!window.confirm(`Você conferiu o recebimento de ${brl(found.total_cents)} no banco? Esta confirmação libera estoque.`))return;submit(`/admin/portal-sales/orders/${settlement.orderId}/settle`,'POST',{settlementRef:settlement.settlementRef,method:settlement.method});}} style={{display:'grid',gap:10}}>
     <FormField label="Pedido pendente"><select required value={settlement.orderId} onChange={e=>setSettlement({...settlement,orderId:e.target.value})}><Opt value={empty}>Selecionar</Opt>{pending.map(o=><Opt key={o.id} value={o.id}>{o.seller_name} — {brl(o.total_cents)} ({o.quantity_months} meses)</Opt>)}</select></FormField>
     <FormField label="Referência do pagamento"><input required minLength="6" maxLength="120" value={settlement.settlementRef} onChange={e=>setSettlement({...settlement,settlementRef:e.target.value})} placeholder="ID da transação/extrato"/></FormField>
     <FormField label="Forma de conferência"><select value={settlement.method} onChange={e=>setSettlement({...settlement,method:e.target.value})}><Opt value="pix_manual_confirmed">Pix conferido manualmente</Opt><Opt value="bank_manual_confirmed">Transferência bancária</Opt><Opt value="cash_manual_confirmed">Dinheiro recebido</Opt></select></FormField>
     <button className="btn primary" disabled={busy||!pending.length}>Confirmar e liberar meses</button>
    </form>
   </Section>
  </Grid>
  <Section title="5. Ativar acesso de cliente existente" description="Para contas legadas o primeiro vínculo exige Superadmin. Novos clientes podem ser cadastrados diretamente pelos Masters via convite com estoque reservado.">
   <form onSubmit={async e=>{e.preventDefault();const ok=await submit('/admin/portal-sales/contracts','POST',{sellerPartnerId:contract.sellerPartnerId,customerPartnerId:contract.customerPartnerId,planCode:contract.planCode,months:Number(contract.months),unitResaleCents:cents(contract.resale),monthlyFeeCents:cents(contract.monthly),requestId:contractRequestId});if(ok)setContractRequestId(crypto.randomUUID());}} style={{display:'grid',gap:12}}>
    <Grid>
     <FormField label="Vendedor"><select required value={contract.sellerPartnerId} onChange={e=>setContract({...contract,sellerPartnerId:e.target.value})}><Opt value={empty}>Selecionar</Opt>{sellers.filter(s=>s.active).map(s=><Opt key={s.partner_id} value={s.partner_id}>{s.name}</Opt>)}</select></FormField>
     <FormField label="Cliente do Painel do Parceiro"><select required value={contract.customerPartnerId} onChange={e=>setContract({...contract,customerPartnerId:e.target.value})}><Opt value={empty}>Selecionar</Opt>{available.filter(p=>!p.contract_seller_id||p.contract_seller_id===contract.sellerPartnerId).map(p=><Opt key={p.id} value={p.id}>{p.name}</Opt>)}</select></FormField>
     <FormField label="Plano"><select required value={contract.planCode} onChange={e=>setContract({...contract,planCode:e.target.value})}><Opt value={empty}>Selecionar</Opt>{plans.filter(p=>p.active).map(p=><Opt key={p.code} value={p.code}>{p.name}</Opt>)}</select></FormField>
     <FormField label="Meses de acesso"><input type="number" required min="1" max="120" value={contract.months} onChange={e=>setContract({...contract,months:e.target.value})}/></FormField>
     <FormField label="Preço declarado de revenda (R$/mês)"><input required inputMode="decimal" value={contract.resale} onChange={e=>setContract({...contract,resale:e.target.value})}/></FormField>
     <FormField label="Mensalidade adicional declarada (R$)"><input inputMode="decimal" value={contract.monthly} onChange={e=>setContract({...contract,monthly:e.target.value})}/></FormField>
    </Grid>
    <p className="muted">O valor comercial informado não comprova que o Master recebeu dinheiro do cliente. Mensalidade adicional não é cobrada automaticamente. Prazo antigo de parceiro legado não é reduzido.</p>
    <button className="btn primary" disabled={busy||!contract.customerPartnerId}>Vincular contrato utilizando estoque</button>
   </form>
  </Section>
  <Section title="Árvore comercial completa" description="Visão consolidada de Masters e Submasters. Cada vendedor só pode consultar os próprios descendentes.">
   <div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th>Distribuidor</th><th>Papel</th><th>Estoque</th><th>Clientes diretos</th></tr></thead><tbody>{networkTree.map(n=><tr key={n.partner_id}><td><span style={{paddingLeft:Math.min(n.depth,12)*12}}>{n.depth?'↳ ':''}{n.name}</span></td><td>{n.role}</td><td>{n.available_months}</td><td>{n.direct_customers}</td></tr>)}</tbody></table></div>
  </Section>
  <Section title="Rede autorizada e estoque disponível">
   <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th>Parceiro</th><th>Papel</th><th>Meses em estoque</th><th>Pode vender</th><th>Ativo</th></tr></thead><tbody>{sellers.map(s=><tr key={s.partner_id}><td>{s.name}</td><td>{s.role==='master'?'Master':'Submaster'}</td><td>{s.stock_months}</td><td><input type="checkbox" checked={s.can_sell} disabled={busy} aria-label={`Permitir vendas de ${s.name}`} onChange={e=>submit(`/admin/portal-sales/sellers/${s.partner_id}`,'PATCH',{canSell:e.target.checked})}/></td><td><input type="checkbox" checked={s.active} disabled={busy} aria-label={`Ativar ${s.name}`} onChange={e=>submit(`/admin/portal-sales/sellers/${s.partner_id}`,'PATCH',{active:e.target.checked})}/></td></tr>)}</tbody></table></div>
   {!sellers.length&&<p className="muted">Cadastre o primeiro Master para começar.</p>}
  </Section>
  <Section title="Convites comerciais — toda a rede" description="Acompanhe reservas de meses, cadastros automáticos e convites pendentes. Você pode revogar convites de qualquer Master e devolver o estoque reservado.">
   <Grid>
    <div className="stat"><small>Pendentes</small><strong>{view?.invitationSummary?.pending??0}</strong></div>
    <div className="stat"><small>Meses reservados</small><strong>{view?.invitationSummary?.reserved_months??0}</strong></div>
    <div className="stat"><small>Cadastros concluídos</small><strong>{view?.invitationSummary?.accepted??0}</strong></div>
   </Grid>
   <div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th>Master responsável</th><th>Convidado</th><th>Tipo</th><th>Meses</th><th>Estado</th><th>Criado</th><th>Ação</th></tr></thead><tbody>{invitations.map(i=><tr key={i.id}>
    <td>{i.seller_name}</td><td>{i.invited_name}<br/><small>{i.invited_email}</small></td><td>{i.invite_type==='submaster'?'Submaster':'Parceiro'}</td><td>{i.months}</td>
    <td>{({pending:'Reservado',accepted:'Aceito',revoked:'Revogado',expired:'Expirado'})[i.status]||i.status}</td><td>{monthDate(i.created_at)}</td>
    <td>{i.status==='pending'&&<button disabled={busy} onClick={()=>{if(window.confirm('Revogar o convite e devolver o estoque ao Master?'))submit(`/admin/portal-sales/invitations/${i.id}/revoke`,'POST',{});}}>Revogar</button>}</td>
   </tr>)}</tbody></table></div>
   <small className="muted">Os registros são paginados por amostragem (últimos 200). Convites expirados são devolvidos ao estoque na próxima consulta comercial do vendedor.</small>
  </Section>
  <Section title="Contratos ativos da rede">
   <div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th>Cliente</th><th>Vendedor</th><th>Plano</th><th>Vencimento</th><th>Meses pagos</th></tr></thead><tbody>{(view?.contracts||[]).map(c=><tr key={c.id}><td>{c.customer_name}</td><td>{c.seller_name}</td><td>{c.plan_code}</td><td>{monthDate(c.expires_at)}</td><td>{c.months_paid}</td></tr>)}</tbody></table></div>
  </Section>
  <details className="panel" style={{padding:18}}><summary>Exceção financeira — concessão exclusiva do Superadmin</summary><p className="muted">Cria meses de acesso SEM recebimento. Use apenas quando necessário e justifique. Fica registrado permanentemente na auditoria.</p>
   <form style={{display:'grid',gap:10,marginTop:14}} onSubmit={e=>{e.preventDefault();if(!window.confirm('Conceder estoque SEM PAGAMENTO? Operação será auditada como exceção do Superadmin.'))return;submit('/admin/portal-sales/exceptions','POST',{sellerPartnerId:exception.sellerPartnerId,planCode:exception.planCode,quantityMonths:Number(exception.quantityMonths),reason:exception.reason});}}>
    <FormField label="Distribuidor"><select required value={exception.sellerPartnerId} onChange={e=>setException({...exception,sellerPartnerId:e.target.value})}><Opt value="">Selecionar</Opt>{sellers.map(s=><Opt key={s.partner_id} value={s.partner_id}>{s.name}</Opt>)}</select></FormField>
    <FormField label="Plano"><select required value={exception.planCode} onChange={e=>setException({...exception,planCode:e.target.value})}><Opt value="">Selecionar</Opt>{plans.map(p=><Opt key={p.code} value={p.code}>{p.name}</Opt>)}</select></FormField>
    <FormField label="Meses"><input type="number" min="1" max="100000" value={exception.quantityMonths} onChange={e=>setException({...exception,quantityMonths:e.target.value})}/></FormField>
    <FormField label="Justificativa"><textarea required minLength="10" maxLength="500" value={exception.reason} onChange={e=>setException({...exception,reason:e.target.value})}/></FormField>
    <button className="btn" disabled={busy}>Registrar exceção e liberar</button>
   </form>
  </details>
 </div>;
}
