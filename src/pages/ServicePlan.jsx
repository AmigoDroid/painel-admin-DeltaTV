import {useEffect,useState} from "react";
import {api,getAuth} from "../api.js";
const FIELDS=[
 ["autoFailoverOverride","Troca automática para outra URL"],
 ["autoPriorityOverride","Priorizar servidores por desempenho"],
 ["emailAlertsOverride","Alertas de falha por e-mail"],
 ["detailedHistoryOverride","Histórico detalhado de servidores"],
];

export default function ServicePlan({partnerId}){
 const [plan,setPlan]=useState(null),[form,setForm]=useState(null),[catalog,setCatalog]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[done,setDone]=useState("");
 const allowed=getAuth()?.user?.role==="superadmin";
 const load=async()=>{try{const [p,options]=await Promise.all([
  api(`/admin/partners/${partnerId}/service-plan`),api("/admin/service-plans")]);
  setPlan(p);setForm({tier:p.tier,...p.overrides});setCatalog(options.data||[]);setError("")
 }catch(e){setError(e.message)}};
 useEffect(()=>{void load()},[partnerId]);
 const set=(key,value)=>setForm(s=>({...s,[key]:value}));
 const save=async(e)=>{e.preventDefault();if(!allowed)return;
  if(form.maxServersOverride === "") {setError("Informe um limite positivo ou escolha Sem limite.");return;}
  setBusy(true);setDone("");setError("");try{
  const p=await api(`/admin/partners/${partnerId}/service-plan`,{method:"PUT",body:form});setPlan(p);setForm({tier:p.tier,...p.overrides});setDone("Plano atualizado e auditado.");
 }catch(e){setError(e.message)}finally{setBusy(false)}};
 return <section style={{display:"grid",gap:16,minWidth:0}}><p className="muted">Recursos técnicos por plano. Mensalidade, créditos e limites de licenças são negociados separadamente no contrato. Um downgrade não remove URLs existentes automaticamente.</p>
 {error&&<p style={{color:"var(--bad,#df5763)"}} role="alert">{error}</p>}
 {!form?<p>Carregando plano…</p>:<>
 <div className="mini-stats"><div><strong>{plan?.planName || plan?.tier}</strong><span>Plano atual</span></div><div><strong>{plan?.features.maxServers == null ? "Ilimitadas" : plan.features.maxServers}</strong><span>URLs por código</span></div><div><strong>{plan?.features.autoFailover?"Sim":"Não"}</strong><span>Failover</span></div></div>
 <form onSubmit={save} style={{display:"grid",gap:14}}>
 <label>Plano de recursos<select value={form.tier} disabled={!allowed||busy} onChange={e=>set("tier",e.target.value)}>{catalog.filter(c=>c.active||c.key===form.tier).map(c=><option value={c.key} key={c.key}>{c.name}{!c.active?" (inativo)":""}</option>)}</select></label>
 <p className="muted">Exceções individuais: “Padrão do plano” aplica as regras do nível escolhido; outros valores permitem negociação específica.</p>
 <label>Limite de URLs por código<select disabled={!allowed||busy}
   value={form.maxServersOverride == null ? "default" : form.maxServersOverride === 0 ? "unlimited" : "custom"}
   onChange={e=>set("maxServersOverride",e.target.value==="default"?null:e.target.value==="unlimited"?0:(plan?.features.maxServers || 1))}>
   <option value="default">Padrão do plano</option><option value="unlimited">Sem limite</option><option value="custom">Limite personalizado</option>
 </select></label>
 {form.maxServersOverride !== null && form.maxServersOverride !== undefined && form.maxServersOverride !== 0 && <label>Quantidade máxima<input type="number" min="1" step="1" required disabled={!allowed||busy}
   value={form.maxServersOverride} onChange={e=>set("maxServersOverride",e.target.value===""?"":Number(e.target.value))}/></label>}
 {FIELDS.map(([field,name])=><label key={field}>{name}<select disabled={!allowed||busy} value={form[field]===null||form[field]===undefined?"default":String(form[field])} onChange={e=>set(field,e.target.value==="default"?null:e.target.value==="true")}>
 <option value="default">Padrão do plano</option><option value="true">Permitir</option><option value="false">Desativar</option>
 </select></label>)}
 <div className="panel" style={{padding:14}}><strong>Recursos efetivos atuais</strong><p className="muted">{plan?.features.maxServers == null ? "URLs ilimitadas" : `${plan.features.maxServers} URLs`} por código · Failover {plan?.features.autoFailover?"ativo":"desligado"} · Prioridade {plan?.features.autoPriority?"automática":"manual"} · Alertas {plan?.features.emailAlerts?"ativos":"desligados"}</p></div>
 {allowed?<button className="btn primary" disabled={busy}>{busy?"Salvando…":"Salvar plano e exceções"}</button>:<p className="muted">Apenas o Superadmin pode modificar planos de serviço.</p>}
 </form>{done&&<p style={{color:"var(--ok,#29a980)"}} role="status">{done}</p>}
 </>}</section>;
}
