import {useEffect,useState} from "react";
import {api} from "../api.js";
import {fmtMoney,toCents} from "../ui.jsx";

const OPTIONS=[
 ["legacy","Legado · manter as regras anteriores"],
 ["credits","Pré-pago · consumo de créditos por ativação"],
 ["fixed_unlimited","Mensalidade fixa · ativações ilimitadas"],
 ["fixed_limited","Mensalidade fixa · limite de ativações"],
];
export default function ContentContract({partnerId}){
 const [data,setData]=useState(null),[form,setForm]=useState(null),[error,setError]=useState(""),[info,setInfo]=useState(""),[busy,setBusy]=useState(false),[delta,setDelta]=useState(""),[note,setNote]=useState("");
 const load=async()=>{try{const r=await api(`/admin/partners/${partnerId}/commercial`);setData(r);setForm({
  ...r.terms,fixedFeeReais:(r.terms.fixedFeeCents/100).toFixed(2),activationLimit:r.terms.activationLimit??""});setError("")}catch(e){setError(e.message)}};
 useEffect(()=>{void load()},[partnerId]);
 const save=async e=>{e.preventDefault();if(!form)return;
  const fixedFeeCents=toCents(form.fixedFeeReais);if(fixedFeeCents==null)return setError("Informe o valor mensal válido.");
  const activationLimit=form.mode==="fixed_limited"?Number(form.activationLimit):null;
  if(form.mode==="fixed_limited"&&(!Number.isInteger(activationLimit)||activationLimit<0||!String(form.activationLimit).trim()))return setError("Informe o limite de ativações.");
  if(form.licensePolicy==="partner_only"&&!window.confirm("Quando o parceiro perder o vínculo/for bloqueado, as ativações dependentes não terão acesso. Licenças independentes não serão removidas. Confirmar?"))return;
  setBusy(true);setInfo("");setError("");try{await api(`/admin/partners/${partnerId}/commercial`,{method:"PUT",body:{
   mode:form.mode,fixedFeeCents,activationLimit,licensePolicy:form.licensePolicy,
   creditsPerActivation:Number(form.creditsPerActivation),autoPriority:form.autoPriority,allowWebIssuance:!!form.allowWebIssuance}});setInfo("Condições salvas e auditadas.");await load()}catch(e){setError(e.message)}finally{setBusy(false)};
 };
 const adjust=async e=>{e.preventDefault();if(!window.confirm(`Ajustar a carteira em ${delta} crédito(s)?`))return;
  setBusy(true);setInfo("");setError("");try{await api(`/admin/partners/${partnerId}/commercial/credits`,{method:"POST",body:{delta:Number(delta),note}});setInfo("Créditos ajustados. Consulte também o extrato da carteira.");setDelta("");setNote("");await load()}catch(e){setError(e.message)}finally{setBusy(false)};
 };
 if(!form)return <p>{error||"Carregando contrato…"}</p>;
 return <section style={{display:"grid",gap:18,minWidth:0}}>
  <p className="muted">Contrato comercial de conteúdo. Mudanças em limites não removem ativações existentes; afetam novas ativações. A modalidade legado preserva o comportamento anterior.</p>
  <div className="grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,180px),1fr))",gap:10}}>
   {[ ["Ativações atuais",data?.activeDevices], ["Saldo livre de créditos",data?.creditBalance],["Créditos alocados",data?.allocatedCredits],["Créditos usados",data?.spentCredits] ].map(([k,v])=><div className="panel" style={{padding:14}} key={k}><div className="muted">{k}</div><strong style={{fontSize:24}}>{v??"—"}</strong></div>)}
  </div>
  <form onSubmit={save} style={{display:"grid",gap:14}}>
   <label>Modalidade comercial<select value={form.mode} onChange={e=>setForm({...form,mode:e.target.value})}>{OPTIONS.map(([v,l])=><option value={v} key={v}>{l}</option>)}</select></label>
   {form.mode.startsWith("fixed_")&&<label>Mensalidade fixa (R$)<input value={form.fixedFeeReais} onChange={e=>setForm({...form,fixedFeeReais:e.target.value})} inputMode="decimal" placeholder="149,90"/></label>}
   {form.mode==="fixed_limited"&&<label>Máximo de ativações vivas<input type="number" min="0" value={form.activationLimit} onChange={e=>setForm({...form,activationLimit:e.target.value})}/></label>}
   {form.mode==="credits"&&<label>Créditos consumidos por nova ativação<input type="number" min="1" max="100" value={form.creditsPerActivation} onChange={e=>setForm({...form,creditsPerActivation:e.target.value})}/></label>}
   <label>Política de licença<select value={form.licensePolicy} onChange={e=>setForm({...form,licensePolicy:e.target.value})}>
    <option value="standard">Padrão · manter licenças independentes</option><option value="partner_only">Dependente da parceria · acesso condicionado ao parceiro</option></select></label>
   <label style={{display:"flex",gap:10,alignItems:"center"}}><input type="checkbox" checked={!!form.autoPriority} onChange={e=>setForm({...form,autoPriority:e.target.checked})}/> Prioridade automática por latência/saúde</label>
   <label style={{display:"flex",gap:10,alignItems:"center"}}><input type="checkbox" checked={!!form.allowWebIssuance} onChange={e=>setForm({...form,allowWebIssuance:e.target.checked})}/> Permitir que revendas emitam Player Web usando códigos autorizados deste parceiro</label>
   <div className="muted">A habilitação também exige ativação explícita por código no portal do parceiro. Nenhuma revenda é vinculada obrigatoriamente.</div>
   <div className="muted">Nas modalidades fixas, o valor mensal é aplicado ao faturamento já existente. Em créditos, o faturamento mensal é desligado para evitar duplicidade.</div>
   <button className="btn primary" disabled={busy}>Salvar condições comerciais</button>
  </form>
  <form onSubmit={adjust} className="panel" style={{padding:16,display:"grid",gap:12}}>
   <h3>Créditos do parceiro</h3><p className="muted">Apenas a administração pode criar ou reduzir créditos da carteira. O parceiro distribui o saldo entre seus códigos.</p>
   <label>Quantidade (+ conceder / − retirar)<input required type="number" min="-1000000" max="1000000" step="1" value={delta} onChange={e=>setDelta(e.target.value)}/></label>
   <label>Motivo do ajuste<input required minLength="3" maxLength="300" value={note} onChange={e=>setNote(e.target.value)}/></label>
   <button className="btn" disabled={busy||!Number(delta)}>Aplicar ajuste</button>
  </form>
  {info&&<p style={{color:"var(--ok,#48b688)"}}>{info}</p>}{error&&<p style={{color:"var(--bad,#e55)"}}>{error}</p>}
 </section>;
}
