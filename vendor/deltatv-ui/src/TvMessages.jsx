import { useEffect, useRef, useState } from 'react';
import './workspace.css';
const date = value => new Date(value).toLocaleString('pt-BR');
export default function TvMessages({ api, showLead = true }) {
 const [audience,setAudience]=useState('selected'),[selected,setSelected]=useState({});
 const [q,setQ]=useState(''),[page,setPage]=useState(1),[recipients,setRecipients]=useState({data:[],total:0});
 const [title,setTitle]=useState(''),[message,setMessage]=useState(''),[days,setDays]=useState(7);
 const [history,setHistory]=useState([]),[historyPage,setHistoryPage]=useState(1),[preview,setPreview]=useState(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [cancelId,setCancelId]=useState(null);
 const request=useRef(null),running=useRef(false);
 const refresh=()=>api('/tv-messages',{query:{page:historyPage}}).then(r=>setHistory(r.data));
 useEffect(()=>{let live=true;api('/tv-messages',{query:{page:historyPage}}).then(r=>{if(live)setHistory(r.data)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[historyPage]);
 useEffect(()=>{let live=true;setLoading(true);const timer=setTimeout(()=>api('/tv-messages/recipients',{query:{q,page}}).then(r=>{if(live)setRecipients(r)}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)}),250);return()=>{live=false;clearTimeout(timer)}},[q,page]);
 const change=(fn)=>{fn();setPreview(null);request.current=null;setNotice('')};
 const payload=()=>({audience,deviceIds:audience==='all'?[]:Object.keys(selected)});
 async function review(e) {
  e.preventDefault();if(running.current)return;running.current=true;setBusy(true);setError('');setNotice('');
  try {const p=await api('/tv-messages/preview',{method:'POST',body:payload()});if(!p.total)throw Error('Nenhuma TV disponível.');setPreview(p);request.current??=crypto.randomUUID()}catch(e){setError(e.message)}finally{setBusy(false);running.current=false}
 }
 async function send() {
  if(running.current||!preview)return;running.current=true;setBusy(true);setError('');
  try {
   const result=await api('/tv-messages',{method:'POST',body:{...payload(),title,message,expiresInDays:days,requestId:request.current}});
   setNotice(`Mensagem registrada para ${result.total} TV(s). Elas receberão ao consultar a API, até o vencimento.`);
   setPreview(null);setTitle('');setMessage('');setSelected({});request.current=null;
   try {await refresh()}catch{setError('Envio concluído. Não foi possível atualizar o histórico; use Atualizar.')}
  }catch(e){setError(e.message)}finally{setBusy(false);running.current=false}
 }
 async function cancel() {
  if(running.current||!cancelId)return;running.current=true;setBusy(true);setError('');
  try {await api(`/tv-messages/${cancelId}/cancel`,{method:'POST'});setCancelId(null);setNotice('Entrega interrompida. Mensagens já vistas não podem ser retiradas.');await refresh()}catch(e){setError(e.message)}finally{setBusy(false);running.current=false}
 }
 return <div className="dt-workspace">
  {showLead && <div className="dt-lead"><div><span className="dt-eyebrow">ATENDIMENTO</span><h2>Mensagens para TVs</h2><p>Um comunicado, uma entrega por aparelho. Selecione as TVs, revise e envie.</p></div><span className="dt-chip">Carteira autorizada</span></div>}
  <p className="dt-note">As TVs precisam de uma versão do aplicativo compatível com mensagens. “Lida” significa que o cliente confirmou a mensagem no aparelho.</p>
  {error&&<div className="dt-error" role="alert">{error}</div>}{notice&&<div className="dt-success" role="status">{notice}</div>}
  <form onSubmit={review} className="dt-compose"><fieldset disabled={busy||!!preview}>
   <section className="dt-card"><h3>1. Escolha os destinatários</h3><div className="dt-options">
    <label><input type="radio" name="audience" checked={audience==='selected'} onChange={()=>change(()=>setAudience('selected'))}/> Selecionar TVs</label>
    <label><input type="radio" name="audience" checked={audience==='all'} onChange={()=>change(()=>setAudience('all'))}/> Todos os meus clientes</label>
   </div>{audience==='all'?<p>Todas as TVs autorizadas da sua carteira no momento do envio. Para o superadmin, inclui toda a plataforma.</p>:<>
    <label className="dt-field">Buscar TV pelo MAC ou nome da lista<input value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} placeholder="Ex.: 00:11:22 ou Sala"/></label>
    <div className="dt-recipient-list" aria-busy={loading}>{loading?<p role="status">Buscando TVs…</p>:recipients.data.length?recipients.data.map(d=><label key={d.id} className="dt-recipient"><input type="checkbox" checked={!!selected[d.id]} onChange={e=>change(()=>setSelected(old=>{const next={...old};if(e.target.checked)next[d.id]=d;else delete next[d.id];return next}))}/><span><b>{d.name||'TV sem nome'}</b><small>{d.mac}</small></span></label>):<p>Nenhuma TV encontrada.</p>}</div>
    <div className="dt-toolbar"><span>{Object.keys(selected).length} selecionada(s) · {recipients.total} encontrada(s)</span><button type="button" disabled={page===1||loading} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page}</span><button type="button" disabled={page*20>=recipients.total||loading} onClick={()=>setPage(p=>p+1)}>Próxima</button><button type="button" onClick={()=>change(()=>setSelected({}))}>Limpar seleção</button></div>
    {Object.keys(selected).length>0&&<details><summary>Conferir seleção de todas as páginas</summary><div className="dt-recipient-list">{Object.values(selected).map(d=><div className="dt-toolbar" key={d.id}><span>{d.name||'TV'} · {d.mac}</span><button type="button" onClick={()=>change(()=>setSelected(old=>{const n={...old};delete n[d.id];return n}))}>Remover</button></div>)}</div></details>}
   </>}</section>
   <section className="dt-card"><h3>2. Escreva a mensagem</h3><label className="dt-field">Título<input required minLength={3} maxLength={100} value={title} onChange={e=>change(()=>setTitle(e.target.value))}/></label><label className="dt-field">Mensagem<textarea required minLength={3} maxLength={1200} rows={5} value={message} onChange={e=>change(()=>setMessage(e.target.value))}/><small>{message.length}/1200 caracteres · Texto simples</small></label><label className="dt-field">Disponível por<select value={days} onChange={e=>change(()=>setDays(Number(e.target.value)))}>{[1,3,7,15,30].map(n=><option key={n} value={n}>{n} dia(s)</option>)}</select></label><button className="dt-primary" disabled={busy||(audience==='selected'&&!Object.keys(selected).length)||Object.keys(selected).length>500}>{busy?'Aguarde…':'Revisar envio'}</button>{Object.keys(selected).length>500&&<p role="alert">Selecione até 500 TVs por envio, ou use todos os clientes.</p>}</section>
  </fieldset></form>
  {preview&&<section className="dt-card dt-review" aria-label="Revisão do envio"><h3>3. Confirme o envio para {preview.total} TV(s)</h3><p>Disponível por {days} dia(s). {audience==='all'&&'A carteira será conferida novamente ao enviar.'}</p><div className="dt-tv-preview"><small>DELTA TV · MENSAGEM</small><h3>{title}</h3><p>{message}</p><span>OK · Entendi</span></div><div className="dt-toolbar"><button className="dt-primary" disabled={busy} onClick={send}>{busy?'Enviando…':'Confirmar envio'}</button><button disabled={busy} onClick={()=>setPreview(null)}>Voltar e editar</button></div></section>}
  <section className="dt-card"><div className="dt-toolbar"><h3>Histórico de envios</h3><button type="button" onClick={()=>refresh().catch(e=>setError(e.message))}>Atualizar</button></div>{!history.length?<p>Nenhum envio nesta página.</p>:history.map(c=><article className="dt-history" key={c.id}><div><h4>{c.title}</h4><p>{c.message}</p><small>{date(c.created_at)} · Válida até {date(c.expires_at)}</small></div><div><b>{c.read} / {c.total} lidas</b><p>{c.cancelled_at?'Cancelada':new Date(c.expires_at)<new Date()?'Expirada':'Disponível'}</p>{!c.cancelled_at&&new Date(c.expires_at)>new Date()&&<button disabled={busy} onClick={()=>setCancelId(c.id)}>Cancelar entrega</button>}</div></article>)}<div className="dt-toolbar"><button disabled={historyPage===1} onClick={()=>setHistoryPage(p=>p-1)}>Anterior</button><span>Página {historyPage}</span><button disabled={history.length<20} onClick={()=>setHistoryPage(p=>p+1)}>Próxima</button></div></section>
  {cancelId&&<section className="dt-card dt-review" role="alert"><h3>Interromper este comunicado?</h3><p>As TVs deixarão de receber esta mensagem. Quem já leu não será afetado.</p><div className="dt-toolbar"><button disabled={busy} onClick={cancel}>Confirmar cancelamento</button><button disabled={busy} onClick={()=>setCancelId(null)}>Manter mensagem</button></div></section>}
 </div>
}
