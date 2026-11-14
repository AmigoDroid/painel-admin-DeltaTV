import {useEffect,useState} from 'react';
import {api} from '../api.js';
import PartnerPicker from '../PartnerPicker.jsx';
import {toCents} from '@deltatv/ui/money';
const money=c=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(c||0)/100);
const fieldStyle={width:'100%',boxSizing:'border-box',padding:10,minHeight:42};
export default function Commerce3(){
 const [plans,setPlans]=useState([]),[config,setConfig]=useState({maxTotalBps:0}),[partnerId,setPartnerId]=useState('');
 const [contracts,setContracts]=useState([]),[form,setForm]=useState({name:'',price:'',includedSlots:'100',billingMode:'prepaid',graceDays:'5',allowResell:true,allowExtra:true});
 const [planId,setPlanId]=useState(''),[sellerId,setSellerId]=useState(''),[beneficiaryId,setBeneficiaryId]=useState(''),[rate,setRate]=useState('5'),[cap,setCap]=useState('0');
 const [rules,setRules]=useState([]),[status,setStatus]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const refresh=async()=>{const [p,c]=await Promise.all([api('/admin/commerce/master-plans'),api('/admin/commerce/commission-policy')]);setPlans(p.data||[]);setConfig(c);setCap(String(c.maxTotalBps/100));};
 useEffect(()=>{refresh().catch(e=>setError(e.message));},[]);
 const run=async(fn)=>{setBusy(true);setError('');setStatus('');try{await fn();}catch(e){setError(e.message||'Não foi possível concluir a operação.');}finally{setBusy(false);}};
 const loadContract=async()=>{if(!partnerId)return;const r=await api(`/admin/commerce/master-contracts/${partnerId}`);setContracts(r.data||[]);};
 const viewRules=async()=>{const r=await api(`/admin/commerce/commission-rules/${sellerId}`);setRules(r.data||[]);};
 return <div style={{display:'grid',gap:16}}>
  <div className="card" style={{padding:20}}><h2>Planos de acesso DeltaTV 3.0</h2><p className="muted">Cadastre contratos pré-pagos, pós-pagos ou híbridos para Masters. Esta primeira camada registra os contratos comerciais, sem alterar automaticamente o acesso ao painel ou cobrar Pix.</p>
   {error&&<p role="alert" style={{color:'var(--danger,#ef4444)'}}>{error}</p>}{status&&<p role="status">{status}</p>}
  </div>
  <section className="card" style={{padding:20}}><h3>Novo plano SaaS</h3>
   <form onSubmit={e=>{e.preventDefault();run(async()=>{const cents=toCents(form.price);if(cents===null)throw Error('Informe um preço válido.');await api('/admin/commerce/master-plans',{method:'POST',body:{name:form.name,priceCents:cents,
    periodMonths:1,billingMode:form.billingMode,includedSlots:form.includedSlots===''?null:Number(form.includedSlots),allowExtra:form.allowExtra,
    allowResell:form.allowResell,overageCents:null,graceDays:Number(form.graceDays)}});await refresh();setStatus('Plano criado. Associe a um Master abaixo.');});}} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(200px,100%),1fr))',gap:12}}>
    <label>Nome do plano<input required style={fieldStyle} value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/></label>
    <label>Mensalidade R$<input required style={fieldStyle} inputMode="decimal" value={form.price} onChange={e=>setForm(v=>({...v,price:e.target.value}))} placeholder="199,00"/></label>
    <label>Faturamento<select style={fieldStyle} value={form.billingMode} onChange={e=>setForm(v=>({...v,billingMode:e.target.value}))}><option value="prepaid">Pré-pago</option><option value="postpaid">Pós-pago</option><option value="hybrid">Híbrido</option></select></label>
    <label>Ativações incluídas (vazio=ilimitado)<input style={fieldStyle} type="number" min="0" value={form.includedSlots} onChange={e=>setForm(v=>({...v,includedSlots:e.target.value}))}/></label>
    <label>Dias de tolerância<input required style={fieldStyle} type="number" min="0" max="365" value={form.graceDays} onChange={e=>setForm(v=>({...v,graceDays:e.target.value}))}/></label>
    <label><input type="checkbox" checked={form.allowResell} onChange={e=>setForm(v=>({...v,allowResell:e.target.checked}))}/> Permitir revender assinaturas</label>
    <label><input type="checkbox" checked={form.allowExtra} onChange={e=>setForm(v=>({...v,allowExtra:e.target.checked}))}/> Permitir compra adicional</label>
    <button className="btn primary" disabled={busy}>Salvar plano</button>
   </form>
   <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14}}>{plans.map(p=><span className="badge" key={p.id}>{p.name} · {money(p.priceCents)} · {p.includedSlots??'∞'} vagas · {p.billingMode}</span>)}</div>
  </section>
  <section className="card" style={{padding:20}}><h3>Contrato de um Master</h3><p className="muted">Selecione a conta pelo ID exibido em Rede de distribuição. Nenhuma cobrança ou liberação de recursos será executada só por criar a ficha.</p>
   <label>Escolher Master ou Revenda<PartnerPicker value={partnerId} onChange={id=>{setPartnerId(id);setContracts([]);}} ariaLabel="Conta comercial" emptyLabel="Selecione a conta…"/></label>
   <button type="button" className="btn" disabled={!partnerId||busy} onClick={()=>run(loadContract)}>Consultar contratos</button>
   <form style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}} onSubmit={e=>{e.preventDefault();run(async()=>{await api(`/admin/commerce/master-contracts/${partnerId}`,{method:'POST',body:{planId}});await loadContract();setStatus('Contrato criado em rascunho.');});}}>
     <select required aria-label="Escolher plano" value={planId} onChange={e=>setPlanId(e.target.value)}><option value="">Plano…</option>{plans.filter(p=>p.active).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
     <button className="btn primary" disabled={busy||!partnerId||!planId}>Associar plano à conta</button>
   </form>
   {contracts.map(c=><div key={c.id} className="card" style={{padding:12,marginTop:8}}><strong>{c.planName}</strong><p className="muted">{c.billingMode} · {c.state} · {money(c.priceCents)}</p>
    {c.state==='draft'&&<button type="button" className="btn" disabled={busy} onClick={()=>run(async()=>{
      await api(`/admin/commerce/subscriptions/${partnerId}/${c.id}/state`,{method:'POST',body:{state:'active',reason:'Aprovação comercial manual por Superadmin'}});await loadContract();setStatus('Contrato comercial aprovado. Não muda as permissões técnicas sem integração de provisionamento.');
    })}>Aprovar registro comercial</button>}</div>)}
  </section>
  <section className="card" style={{padding:20}}><h3>Comissões em créditos — rede de Masters</h3>
    <p className="muted">O teto global é 0% por padrão. Após habilitar regras, compras de licenças por créditos na rede podem distribuir comissões com débito correspondente do vendedor. Pix direto do Master ainda não integra comissões.</p>
    <form onSubmit={e=>{e.preventDefault();run(async()=>{await api('/admin/commerce/commission-policy',{method:'PUT',body:{maxTotalBps:Math.round(Number(cap)*100)}});await refresh();setStatus('Teto global atualizado.');});}} style={{display:'flex',gap:10,alignItems:'end',flexWrap:'wrap'}}>
      <label>Teto global (% do valor em créditos)<input min="0" max="100" step="0.01" type="number" style={fieldStyle} value={cap} onChange={e=>setCap(e.target.value)}/></label><button disabled={busy} className="btn primary">Atualizar teto</button>
    </form>
    <hr/>
    <form onSubmit={e=>{e.preventDefault();run(async()=>{await api(`/admin/commerce/commission-rules/${sellerId}/${beneficiaryId}`,{method:'PUT',body:{basisPoints:Math.round(Number(rate)*100)}});await viewRules();setStatus('Percentual cadastrado.');});}} style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(200px,100%),1fr))',gap:12}}>
      <label>Vendedor<PartnerPicker value={sellerId} onChange={id=>{setSellerId(id);setRules([]);}} ariaLabel="Vendedor" emptyLabel="Selecione quem vende…"/></label>
      <label>Master beneficiário<PartnerPicker value={beneficiaryId} onChange={setBeneficiaryId} ariaLabel="Master beneficiário" emptyLabel="Selecione quem recebe…"/></label>
      <label>Percentual (%)<input required min="0" max="100" step="0.01" type="number" style={fieldStyle} value={rate} onChange={e=>setRate(e.target.value)}/></label>
      <button disabled={busy||!sellerId||!beneficiaryId} className="btn primary">Salvar comissão</button>
    </form>
    <button type="button" className="btn" disabled={busy||!sellerId} onClick={()=>run(viewRules)}>Consultar regras do vendedor</button>
    {rules.map(r=><p key={r.beneficiaryPartnerId}>{r.beneficiaryPartnerId} — {(r.basisPoints/100).toFixed(2)}% ({r.active?'habilitado':'desativado'})</p>)}
    <p className="muted">O Superadmin controla o teto acumulado; Masters podem configurar comissão própria em vendas de subordinados diretos quando autorizado.</p>
  </section>
 </div>;
}
