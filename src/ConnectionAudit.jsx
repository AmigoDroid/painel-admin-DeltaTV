import React, { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import './ConnectionAudit.css';
const states={selected:'URL selecionada',opening:'Abrindo mídia',playing:'Reproduzindo',buffering:'Carregando vídeo',paused:'Pausado',error:'Falha',finished:'Concluído',stopped:'Parado',response:'Resposta da origem',redirect:'Redirecionamento enviado',handoff:'Entrega encaminhada ao Nginx'};
const sources={tv:'Informado pela TV',server:'Observado pelo servidor',selection:'Seleção do servidor'};
const when=v=>v?new Date(v).toLocaleString('pt-BR'):'Sem registro';
export default function ConnectionAudit({path,onClose}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[older,setOlder]=useState([]),[cursor,setCursor]=useState(null),[loading,setLoading]=useState(false),[tick,setTick]=useState(0);
 const [remote,setRemote]=useState(null),[remoteError,setRemoteError]=useState(''),[commandBusy,setCommandBusy]=useState(''),[target,setTarget]=useState('');
 const remotePath=path.replace(/\/connection-audit$/, '/remote');
 const canDisconnect=path.startsWith('/admin/');
 const close=useRef(null), alive=useRef(true);
 useEffect(()=>{alive.current=true; const previous=document.activeElement;close.current?.focus();return()=>{alive.current=false;previous?.focus?.();}},[]);
 useEffect(()=>{
  let active=true,busy=false;
  async function load(){if(busy)return;busy=true;try{const r=await api(path);if(active){setData(r);setError('');if(!older.length)setCursor(r.nextBefore);}}catch(e){if(active)setError(e.message);}finally{busy=false;}}
  load(); const timer=setInterval(()=>{if(!document.hidden)load()},15000);
  return()=>{active=false;clearInterval(timer)};
 },[path,tick,older.length]);
 useEffect(()=>{
  let alive=true;let busy=false;
  async function reload(){if(busy)return;busy=true;try{const r=await api(remotePath);if(alive){setRemote(r);setRemoteError('');setTarget(prev=>prev||r.lists?.find(x=>x.status==='active' && x.id!==r.activationId)?.id||'');}}catch(e){if(alive)setRemoteError(e.message)}finally{busy=false}}
  reload();const timer=setInterval(()=>{if(!document.hidden)reload()},10000);
  return()=>{alive=false;clearInterval(timer)};
 },[remotePath,tick]);
 async function changeAccess(action){
  const actionName=action==='block'?'bloquear':'desbloquear';
  if(!window.confirm(`Deseja ${actionName} esta lista? A ação modifica a licença imediatamente na API.`))return;
  const reason=action==='block'?window.prompt('Motivo do bloqueio (obrigatório, mínimo 3 caracteres):','Bloqueio remoto pela administração'):'';
  if(action==='block'&&(!reason||reason.trim().length<3))return;
  const base=remotePath.slice(0,-'/remote'.length);
  setCommandBusy(action);setRemoteError('');
  try{await api(`${base}/${action}`,{method:'POST',body:reason?{reason}:{}});setTick(v=>v+1)}
  catch(e){setRemoteError(e.message)}finally{setCommandBusy('')}
 }
 async function sendRemote(type){
  const names={'refresh-catalog':'atualizar o catálogo','switch-list':'trocar a lista ativa','disconnect':'desconectar a TV','sync-access':'revalidar a licença','ping':'medir a latência',diagnose:'testar a conexão com a API',failover:'solicitar outra origem verificada','show-message':'enviar um aviso ao aplicativo','set-telemetry':'ajustar a auditoria'};
  if(type==='switch-list'&&!target){setRemoteError('Selecione a lista de destino.');return}
  let extra={};
  if(type==='show-message'){
    const text=window.prompt('Mensagem para exibir na TV (3 a 180 caracteres):','');
    if(text===null)return;
    if(text.trim().length<3||text.trim().length>180){setRemoteError('A mensagem precisa ter entre 3 e 180 caracteres.');return}
    extra.note=text.trim();
  }
  if(type==='set-telemetry'){
    const text=window.prompt('Intervalo da auditoria nesta TV, em segundos (45 a 180):','90');
    if(text===null)return;
    const seconds=Number(text);
    if(!Number.isInteger(seconds)||seconds<45||seconds>180){setRemoteError('Use um valor inteiro de 45 a 180 segundos.');return}
    extra.telemetryIntervalSeconds=seconds;
  }
  if(!window.confirm(`Deseja ${names[type]} neste aparelho?`))return;
  setCommandBusy(type);setRemoteError('');
  try{await api(remotePath,{method:'POST',body:{type,...extra,...(type==='switch-list'?{targetActivationId:target}:{})}});setTick(v=>v+1)}
  catch(e){setRemoteError(e.message)}finally{setCommandBusy('')}
 }
 async function more(){setLoading(true);try{const r=await api(path,{query:cursor});if(alive.current){setOlder(v=>[...v,...r.events]);setCursor(r.nextBefore);}}catch(e){if(alive.current)setError(e.message);}finally{if(alive.current)setLoading(false);}}
 const tv=data?.latest.find(e=>e.source==='tv'), server=data?.latest.find(e=>e.source==='server'), selected=data?.latest.find(e=>e.source==='selection');
 const rows=[...new Map([...(data?.events||[]),...older].map(e=>[e.id,e])).values()];
 return <div className="connection-audit-overlay" onKeyDown={e=>{
  if(e.key==='Escape'){e.stopPropagation();onClose();}
  if(e.key==='Tab'){const f=[...e.currentTarget.querySelectorAll('button:not(:disabled),[tabindex="0"]')];const first=f[0],last=f.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}
 }}>
 <section className="connection-audit" role="dialog" aria-modal="true" aria-label="Auditoria de conexão">
 <header><div><h2>Conexão do dispositivo</h2><p>Atualização a cada 15 segundos · histórico dos últimos 7 dias</p></div><button ref={close} type="button" aria-label="Fechar auditoria" onClick={onClose}>Fechar</button></header>
 {error&&<p role="alert">{error} <button onClick={()=>setTick(x=>x+1)}>Tentar novamente</button></p>}
 {!data&&!error&&<p>Carregando diagnóstico…</p>}
 {data&&<><div className="connection-audit-cards">
 <article><small>Estado informado pelo player</small><strong>{data.playbackFresh?states[tv?.state]:'Sem confirmação recente da TV'}</strong><span>{when(tv?.created_at)}{tv?.build?` · build ${tv.build}`:''}</span><span>{tv?.error_code?`Código do player: ${tv.error_code}`:''}</span></article>
 <article><small>Última URL escolhida para a configuração</small><strong>{selected?.origin||'Sem registro'}</strong><span>{when(selected?.created_at)} · {selected?.transport||'—'}</span></article>
 <article><small>Última origem observada no proxy</small><strong>{server?.origin||'Sem registro'}</strong><span>{states[server?.state]||'Nenhuma conexão observada'}{server?.status_code?` · HTTP ${server.status_code}`:''}</span><span>{when(server?.created_at)} · {server?.transport||'—'}</span>{server?.selected_origin&&<span>Base usada nesta conexão: {server.selected_origin}</span>}</article>
 <article><small>Endereço solicitado pela TV</small><strong>{tv?.origin||'Sem registro'}</strong><span>Pode ser o gateway DeltaTV. No modo direto, o servidor não observa o redirecionamento final da origem.</span></article>
 </div>
 <section className="remote-control-box" aria-label="Controle remoto DeltaTV">
   <div className="remote-head"><strong>Central de controle remoto</strong><small>Conexão segura, comandos com confirmação e histórico</small></div>
   {remoteError&&<p role="alert" className="remote-error">{remoteError}</p>}
   {!remote?<p>Consultando conexão de controle…</p>:<>
     <div className="remote-stats">
       <div><small>Transporte atual</small><b>{{wss:'WebSocket seguro (Roku 16+)', 'https-legacy':'HTTPS compatível (Roku antigo)',offline:'Desconectado',unknown:'Não identificado'}[remote.connection?.transport]||remote.connection?.transport}</b></div>
       <div><small>RTT TV ↔ API</small><b>{remote.connection?.latencyMs!=null?`${remote.connection.latencyMs} ms`:'Aguardando medição'}</b><small>{remote.connection?.latencyMethod||'Latência de aplicação, não ICMP'}</small></div>
       <div><small>Build / controle</small><b>{remote.connection?.build||'Não informada'}</b><small>{remote.connection?.supported?'Comandos compatíveis':'Requer build 48 ou superior'}</small></div>
     </div>
     <div className="remote-actions">
       {remote.activationStatus==='active'&&<button type="button" disabled={!!commandBusy} onClick={()=>changeAccess('block')}>Bloquear lista na API</button>}
       {remote.activationStatus==='blocked'&&<button type="button" disabled={!!commandBusy} onClick={()=>changeAccess('unblock')}>Desbloquear lista na API</button>}
       <button type="button" disabled={!!commandBusy||!remote.connection?.supported} onClick={()=>sendRemote('refresh-catalog')}>Atualizar catálogo</button>
       <button type="button" disabled={!!commandBusy||!remote.connection?.supported} onClick={()=>sendRemote('ping')}>Medir ping agora</button>
       <button type="button" disabled={!!commandBusy||Number(remote.connection?.build||0)<51} onClick={()=>sendRemote('diagnose')}>Diagnóstico sob demanda</button>
       <button type="button" disabled={!!commandBusy||Number(remote.connection?.build||0)<51} onClick={()=>sendRemote('failover')}>Solicitar outra origem</button>
       <button type="button" disabled={!!commandBusy||Number(remote.connection?.build||0)<51} onClick={()=>sendRemote('show-message')}>Exibir mensagem na TV</button>
       <button type="button" disabled={!!commandBusy||Number(remote.connection?.build||0)<51} onClick={()=>sendRemote('set-telemetry')}>Ajustar intervalo</button>
       <button type="button" disabled={!!commandBusy||!remote.connection?.supported} onClick={()=>sendRemote('sync-access')}>Revalidar licença</button>
       {canDisconnect&&<button type="button" disabled={!!commandBusy||!remote.connection?.supported} onClick={()=>sendRemote('disconnect')}>Desconectar sessão</button>}
       <label>Lista de destino
         <select value={target} onChange={e=>setTarget(e.target.value)} disabled={!!commandBusy||!remote.connection?.supported}>
           <option value="">Selecione a lista</option>
           {remote.lists?.filter(l=>l.status==='active'&&l.id!==remote.activationId).map(l=><option key={l.id} value={l.id}>{l.name} ({l.id.slice(0,8)})</option>)}
         </select>
       </label>
       <button type="button" disabled={!!commandBusy||!remote.connection?.supported||!target} onClick={()=>sendRemote('switch-list')}>Trocar lista</button>
     </div>
     {remote.quality&&<div className="remote-stats" aria-label="Qualidade da origem selecionada">
       <div><small>Origem selecionada</small><b>{remote.quality.name||'Sem identificação'}</b><small>{when(remote.quality.selectedAt)}</small></div>
       <div><small>Monitor ativo</small><b>{remote.quality.healthState||'Sem medição'}</b><small>Latência VPS → origem: {remote.quality.probeLatencyMs==null?'—':`${remote.quality.probeLatencyMs} ms`}</small></div>
       <div><small>Alerta coletivo</small><b>{remote.quality.severity?`${remote.quality.severity} · ${remote.quality.affectedDevices}/${remote.quality.sampleDevices} TVs`:'Sem alerta coletivo aberto'}</b><small>Dados indicativos da URL selecionada, não do servidor final após redirect</small></div>
     </div>}
     <p className="remote-hint">Apps anteriores à build 48 continuam usando a API HTTP e podem ser bloqueados/desbloqueados pelo painel, mas não executam comandos remotos com ACK. "Entregue" não significa "executado".</p>
     <div className="remote-history"><strong>Últimos comandos</strong>
       {!remote.history?.length?<p>Nenhum comando enviado.</p>:<div className="remote-history-scroll"><table><thead><tr><th>Enviado</th><th>Comando</th><th>Estado</th><th>Confirmado</th></tr></thead><tbody>
        {remote.history.map(c=><tr key={c.id}><td>{when(c.createdAt)}</td><td>{({'refresh-catalog':'Atualizar catálogo','switch-list':'Trocar lista','disconnect':'Desconectar','sync-access':'Revalidar','ping':'Medir RTT','diagnose':'Diagnóstico','failover':'Trocar origem','show-message':'Aviso na TV','set-telemetry':'Intervalo da auditoria'})[c.type]||c.type}</td><td>{({pending:'Pendente',delivered:'Entregue, aguardando ACK',executed:'Executado',failed:'Falhou',refused:'Recusado',expired:'Expirado'})[c.status]||c.status}{c.errorCode?` · ${c.errorCode}`:''}{c.result?.rttMs!=null?` · API ${c.result.rttMs} ms`:''}{c.result?.originRttMs!=null?` · origem ${c.result.originRttMs} ms`:''}{c.result?.originHttpStatus!=null?` · HTTP ${c.result.originHttpStatus} (origem)`:''}{c.result?.networkUp===false?' · Rede desconectada':''}{c.result?.failoverAccepted===true?' · Pedido aceito (reprodução a verificar)':''}</td><td>{when(c.executedAt)}</td></tr>)}
       </tbody></table></div>}
     </div>
   </>}
 </section>
 <p>“Resposta da origem” não confirma reprodução. Sem sinal por 150 segundos, o estado é considerado antigo. A família IP do cliente depende do proxy confiável configurado na API. Uma queda total de rede impede a TV de enviar o erro naquele momento.</p>
 <div className="connection-audit-table" tabIndex="0"><table><thead><tr><th>Horário</th><th>Evidência</th><th>Resultado</th><th>Origem</th><th>Detalhes</th></tr></thead><tbody>{rows.map(e=><tr key={e.id}><td>{when(e.created_at)}</td><td>{sources[e.source]}</td><td>{states[e.state]||e.state}</td><td>{e.origin||'—'}</td><td>{[e.transport,e.client_family?`Cliente/API: IPv${e.client_family}`:null,e.upstream_family?`Origem: IPv${e.upstream_family}`:null,e.latency_ms!=null?`${e.latency_ms}ms até resposta`:null,e.status_code?`HTTP ${e.status_code}`:null,e.error_code?`Erro ${e.error_code}`:null,e.position!=null?`${e.position}s`:null].filter(Boolean).join(' · ')||'—'}</td></tr>)}</tbody></table></div>
 {!rows.length&&<p>Nenhum evento registrado. Instale a nova build na TV e abra um conteúdo para começar a coletar o diagnóstico.</p>}
 {cursor&&<button type="button" disabled={loading} onClick={more}>{loading?'Carregando…':'Ver eventos anteriores'}</button>}
 </>}
 </section></div>;
}
