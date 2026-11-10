import React, { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import './ConnectionAudit.css';
const states={selected:'URL selecionada',opening:'Abrindo mídia',playing:'Reproduzindo',buffering:'Carregando vídeo',paused:'Pausado',error:'Falha',finished:'Concluído',stopped:'Parado',response:'Resposta da origem',redirect:'Redirecionamento enviado',handoff:'Entrega encaminhada ao Nginx'};
const sources={tv:'Informado pela TV',server:'Observado pelo servidor',selection:'Seleção do servidor'};
const when=v=>v?new Date(v).toLocaleString('pt-BR'):'Sem registro';
export default function ConnectionAudit({path,onClose}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[older,setOlder]=useState([]),[cursor,setCursor]=useState(null),[loading,setLoading]=useState(false),[tick,setTick]=useState(0);
 const close=useRef(null), alive=useRef(true);
 useEffect(()=>{alive.current=true; const previous=document.activeElement;close.current?.focus();return()=>{alive.current=false;previous?.focus?.();}},[]);
 useEffect(()=>{
  let active=true,busy=false;
  async function load(){if(busy)return;busy=true;try{const r=await api(path);if(active){setData(r);setError('');if(!older.length)setCursor(r.nextBefore);}}catch(e){if(active)setError(e.message);}finally{busy=false;}}
  load(); const timer=setInterval(()=>{if(!document.hidden)load()},15000);
  return()=>{active=false;clearInterval(timer)};
 },[path,tick,older.length]);
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
 <p>“Resposta da origem” não confirma reprodução. Sem sinal por 90 segundos, o estado é considerado antigo. A família IP do cliente depende do proxy confiável configurado na API. Uma queda total de rede impede a TV de enviar o erro naquele momento.</p>
 <div className="connection-audit-table" tabIndex="0"><table><thead><tr><th>Horário</th><th>Evidência</th><th>Resultado</th><th>Origem</th><th>Detalhes</th></tr></thead><tbody>{rows.map(e=><tr key={e.id}><td>{when(e.created_at)}</td><td>{sources[e.source]}</td><td>{states[e.state]||e.state}</td><td>{e.origin||'—'}</td><td>{[e.transport,e.client_family?`Cliente/API: IPv${e.client_family}`:null,e.upstream_family?`Origem: IPv${e.upstream_family}`:null,e.latency_ms!=null?`${e.latency_ms}ms até resposta`:null,e.status_code?`HTTP ${e.status_code}`:null,e.error_code?`Erro ${e.error_code}`:null,e.position!=null?`${e.position}s`:null].filter(Boolean).join(' · ')||'—'}</td></tr>)}</tbody></table></div>
 {!rows.length&&<p>Nenhum evento registrado. Instale a nova build na TV e abra um conteúdo para começar a coletar o diagnóstico.</p>}
 {cursor&&<button type="button" disabled={loading} onClick={more}>{loading?'Carregando…':'Ver eventos anteriores'}</button>}
 </>}
 </section></div>;
}
