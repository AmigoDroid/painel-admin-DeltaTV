import {useCallback,useEffect,useState} from 'react';
import {api} from '../api.js';
const brl=v=>v==null?'Não configurado':Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const g=v=>Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:3})+' GB';
const monthNow=()=>new Date().toISOString().slice(0,7);
const label=({live:'TV ao vivo',hls:'Segmentos HLS',movie:'Filmes',series:'Séries',api:'Catálogo/API',epg:'Guia/EPG'});
const Card=({name,value,details})=><div className="stat"><small>{name}</small><strong>{value}</strong><span>{details}</span></div>;
export default function PortalUsageAdmin(){
 const [month,setMonth]=useState(monthNow),[data,setData]=useState(null),[trend,setTrend]=useState([]),[devices,setDevices]=useState([]);
 const [settings,setSettings]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[note,setNote]=useState('');
 const load=useCallback(async()=>{setLoading(true);setError('');try{
  const query={month};const [report,days,top]=await Promise.all([
   api('/admin/portal-sales/usage',{query}),api('/admin/portal-sales/usage/daily',{query}),api('/admin/portal-sales/usage/devices',{query})]);
  setData(report);setTrend(days.items||[]);setDevices(top.items||[]);
  setSettings(s=>s||report.settings&&{
   monthlyNodeGbBudget:report.settings.monthly_node_gb_budget,masterMonthlyNodeGbBudget:report.settings.master_monthly_node_gb_budget,
   cpuPercent:report.settings.cpu_percent,memoryPercent:report.settings.memory_percent,
   storagePercent:report.settings.storage_percent,retentionDays:report.settings.retention_days});
 }catch(ex){setError(ex.message)}finally{setLoading(false)}},[month]);
 useEffect(()=>{void load()},[load]);
 const save=async e=>{e.preventDefault();setError('');setNote('');setLoading(true);try{
  await api('/admin/portal-sales/usage/settings',{method:'PUT',body:Object.fromEntries(Object.entries(settings).map(([key,value])=>[key,Number(value)]))});
  setNote('Limites de alerta atualizados. Nenhum usuário foi bloqueado automaticamente.');await load();
 }catch(ex){setError(ex.message)}finally{setLoading(false)}};
 const peak=Math.max(1,...trend.map(v=>v.nodeGb));
 return <section className="panel" style={{padding:18,display:'grid',gap:14}}>
  <header><h2>Etapa 4 — consumo e infraestrutura</h2><p className="muted">Custos da <strong>venda do Painel do Parceiro</strong>. Medição de saída HTTP do Node no PlayerWeb, atribuída ao Parceiro e à rede Master/Submaster por contrato.</p></header>
  <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end'}}>
   <label style={{display:'grid',gap:4}}>Mês (UTC)<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>
   <button type="button" disabled={loading} onClick={()=>void load()}>{loading?'Atualizando…':'Atualizar medições'}</button>
   <small className="muted">Última consolidação: {data?.meter?.lastSuccess?new Date(data.meter.lastSuccess).toLocaleString('pt-BR'):'ainda não registrada'}</small>
  </div>
  {error&&<p role="alert" style={{color:'var(--bad,#c43d3d)'}}>{error}</p>}{note&&<p role="status" className="notice">{note}</p>}
  {data&&<>
   <div className="notice"><strong>Atenção à precisão:</strong> bytes enviados pelo Nginx via X-Accel <strong>não são medidos</strong> por esta coleta Node. Redirects não são consumo de mídia na VPS. O custo em reais é uma estimativa pelo valor por GB configurado; o custo fixo por Master é rateado pelas contas vinculadas. Não representam a cobrança da hospedagem nem lucro líquido.</div>
   <div className="stats" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(155px,1fr))',gap:10}}>
    <Card name="Tráfego Node medido" value={g(data.totals.nodeGb)} details="Saída HTTP; incluindo HLS"/>
    <Card name="Requisições delegadas ao Nginx" value={Number(data.totals.nginxUnmeteredRequests).toLocaleString('pt-BR')} details="Bytes não disponíveis"/>
    <Card name="Redirects" value={Number(data.totals.redirectRequests).toLocaleString('pt-BR')} details="Origem atende diretamente"/>
    <Card name="Custo variável calculável" value={brl(data.finance.measuredNodeCostCents)} details="Só tráfego Node medido"/>
    <Card name="Custo fixo mensal configurado" value={brl(data.finance.fixedMonthlyCents)} details="VPS + domínio/12 + extras"/>
    <Card name="Tráfego sem rede comercial" value={g(data.totals.unattributedNodeGb)} details="Legados/sem contrato"/>
   </div>
   {data.host&&<div className="stats" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10}}>
    <Card name="CPU host (amostra)" value={data.host.cpuPercent==null?'Aguardando':`${data.host.cpuPercent}%`} details="Não é média mensal"/>
    <Card name="Memória host" value={`${data.host.memoryPercent??'—'}%`} details="MemAvailable do Linux"/>
    <Card name="Armazenamento" value={`${data.host.storagePercent??'—'}%`} details="Disco do servidor"/>
    <Card name="Saída de rede do host" value={data.host.network?.sendBytesPerSecond==null?'Aguardando':`${(data.host.network.sendBytesPerSecond*8/1e6).toFixed(2)} Mbps`} details="Inclui todo o host, não só PlayerWeb"/>
    <Card name="Entrada de rede do host" value={data.host.network?.receiveBytesPerSecond==null?'Aguardando':`${(data.host.network.receiveBytesPerSecond*8/1e6).toFixed(2)} Mbps`} details="Amostra instantânea de rede"/>
    <Card name="Streams Node ativos" value={data.host.nodeActiveStreams??'—'} details="Instância atual, não toda a rede"/>
   </div>}
   <div style={{display:'grid',gap:8}}><h3>Alertas da infraestrutura</h3>
    {(data.alerts||[]).length?data.alerts.map((a,i)=><p key={`${a.code}-${i}`} role={a.severity==='warning'?'alert':'status'} className="notice" style={{margin:0}}><strong>{a.severity==='warning'?'Atenção: ':'Informação: '}</strong>{a.message}</p>):<p className="muted">Nenhum limite configurado foi ultrapassado no período consultado.</p>}
   </div>
   <div style={{display:'grid',gap:7}}><h3>Evolução diária — saída Node</h3>
    <div style={{display:'flex',alignItems:'end',gap:3,height:105,overflowX:'auto',padding:'8px 0',borderBottom:'1px solid var(--border,#aaa)'}}>
     {trend.map(d=><div key={d.day} title={`${d.day}: ${g(d.nodeGb)}${d.nginxUnmetered?' (com Nginx não medido)':''}`} style={{minWidth:12,flex:1,maxWidth:45,height:`${Math.max(4,100*d.nodeGb/peak)}%`,background:'var(--accent,#7653c6)',borderRadius:'4px 4px 0 0'}}/>)}
     {!trend.length&&<small className="muted">Sem dados medidos ainda.</small>}
    </div><small className="muted">Barras mostram GB de saída Node por dia; não representam tráfego do Nginx. Data de referência em UTC.</small>
   </div>
   <div><h3>Consumo por rede Master</h3><div style={{overflowX:'auto'}}><table style={{width:'100%'}}><thead><tr><th>Master raiz</th><th>Parceiros medidos</th><th>Node GB</th><th>Nginx sem medição</th><th>Visualizadores estimados agora</th><th>Custo Node estimado</th><th>Rateio fixo estimado</th><th>Custo parcial estimado</th></tr></thead><tbody>
    {(data.byMaster||[]).map(x=><tr key={x.rootPartnerId}><td>{x.name}</td><td>{x.partnerCount}</td><td>{g(x.nodeGb)}</td><td>{x.nginxUnmeteredRequests} requisições</td><td>{x.activeViewersLocal}</td><td>{brl(x.measuredNodeCostCents)}</td><td>{brl(x.allocatedFixedCostCents)}</td><td>{brl(x.partialEstimatedTotalCents)}</td></tr>)}
   </tbody></table></div>{!data.byMaster?.length&&<p className="muted">Nenhuma rede com tráfego atribuível neste mês.</p>}</div>
   <details><summary>Detalhamento por tipo de mídia e dispositivos</summary>
    <div style={{display:'grid',gap:10,marginTop:12}}>
     <div className="stats">{(data.byKind||[]).map(x=><Card key={x.kind} name={label[x.kind]||x.kind} value={g(x.nodeGb)} details="Somente Node"/>)}</div>
     <div style={{overflowX:'auto'}}><table><thead><tr><th>Parceiro proprietário</th><th>Dispositivo (UUID)</th><th>Node GB</th><th>Requisições Nginx sem medição</th></tr></thead><tbody>{devices.map(x=><tr key={`${x.partnerId}:${x.deviceId}`}><td>{x.partnerId}</td><td><code>{x.deviceId}</code></td><td>{g(x.nodeGb)}</td><td>{x.nginxUnmeteredRequests}</td></tr>)}</tbody></table></div>
     <p className="muted">O identificador é técnico; não há token de reprodução, MAC, IP ou credenciais no relatório. Os 50 dispositivos principais são exibidos.</p>
    </div></details>
   <details><summary>Configurar limites dos alertas</summary>
    {settings&&<form onSubmit={save} style={{display:'grid',gap:10,marginTop:12}}><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:10}}>
     {[
      ['monthlyNodeGbBudget','Limite mensal global de Node (GB)'],['masterMonthlyNodeGbBudget','Limite mensal por Master (GB)'],
      ['cpuPercent','Alerta de CPU (%)'],['memoryPercent','Alerta de memória (%)'],['storagePercent','Alerta de disco (%)'],['retentionDays','Retenção da telemetria (dias)'],
     ].map(([key,title])=><label key={key} style={{display:'grid',gap:4}}>{title}<input required type="number" min={key==='retentionDays'?7:key.endsWith('Percent')?1:0} max={key==='retentionDays'?365:key.endsWith('Percent')?100:10000000} value={settings[key]} onChange={e=>setSettings({...settings,[key]:e.target.value})}/></label>)}
    </div><small className="muted">0 GB desativa o alerta de orçamento. Alertas são informativos e não suspendem parceiros nem bloqueiam stream. Esta etapa não envia e-mail ou WebSocket de alerta.</small><button className="btn primary" disabled={loading}>Salvar limites</button></form>}
   </details>
   {data.meter?.underMemoryPressure&&<p className="notice" role="alert">Fila de medição teve pressão de memória: parte dos agregados foi consolidada por parceiro, não por dispositivo.</p>}
  </>}
 </section>;
}
