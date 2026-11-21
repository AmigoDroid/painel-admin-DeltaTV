import { useCallback, useEffect, useState } from 'react';

/** Mesmo formulário de emergência nos portais; a API impõe o escopo no servidor. */
export default function EmergencyDns({api,base}) {
  const [data,setData]=useState(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [codes,setCodes]=useState([]);
  const [mode,setMode]=useState('existing');
  const [providerId,setProviderId]=useState('');
  const [baseUrl,setBaseUrl]=useState('');
  const [name,setName]=useState('');
  const [minutes,setMinutes]=useState(30);
  const [notify,setNotify]=useState(true);
  const [message,setMessage]=useState('Atualizando servidor. A transmissão será retomada automaticamente.');
  const [confirm,setConfirm]=useState(false);
  const refresh=useCallback(async()=>{
    if(!base)return;
    setLoading(true);
    try {
      const result=await api(base);
      setData(result);
      setProviderId(old=>result.servers.some(s=>s.id===old&&s.status==='active')?old:result.servers.find(s=>s.status==='active')?.id||'');
      setCodes(old=>old.filter(id=>result.codes.some(c=>c.id===id)));
      setError('');
    }catch(e){setError(e.message);}finally{setLoading(false);}
  },[api,base]);
  useEffect(()=>{setData(null);setCodes([]);void refresh();},[refresh]);
  const activeServers=data?.servers.filter(s=>s.status==='active')||[];
  const eligibleCodes=data?.codes||[];
  const selectedCodes=eligibleCodes.filter(c=>codes.includes(c.id));
  const toggle=id=>setCodes(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
  const submit=async()=>{
    setConfirm(false);setBusy(true);setNotice('');setError('');
    try {
      const payload={codeIds:codes,minutes:Number(minutes),notify,message:notify?message:undefined,
        ...(mode==='existing'?{providerId}:{baseUrl:baseUrl.trim(),name:name.trim()||undefined})};
      const result=await api(base,{method:'POST',body:payload});
      setNotice(`Ordem enviada para ${result.codeCount} código(s). Prioridade até ${new Date(result.expiresAt).toLocaleString('pt-BR')}. TVs offline atualizarão na conexão.`);
      await refresh();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const stop=async()=>{
    if(!codes.length || !window.confirm(`Encerrar a prioridade emergencial de ${codes.length} código(s)?`))return;
    setBusy(true);setError('');setNotice('');
    try {const result=await api(base,{method:'DELETE',body:{codeIds:codes}});
      setNotice(`Prioridade emergencial encerrada em ${result.ended} código(s). O balanceamento normal foi retomado.`);
      await refresh();
    }catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const card={border:'1px solid var(--border, #39414c)',borderRadius:14,padding:18,display:'grid',gap:14,maxWidth:850,background:'var(--surface, transparent)'};
  const label={display:'grid',gap:6};
  return <section style={card} aria-label="Troca emergencial de DNS">
    <header><h2 style={{margin:'0 0 6px'}}>Troca emergencial de DNS</h2><p style={{margin:0,opacity:.8}}>Prioridade temporária por código. O failover continua protegendo as TVs quando a DNS escolhida falhar.</p></header>
    {error&&<p role="alert" style={{color:'#dc4e4e',margin:0}}>{error}</p>}
    {notice&&<p role="status" style={{margin:0}}>{notice}</p>}
    {!data&&loading?<p>Carregando DNS e códigos...</p>:<>
      <fieldset style={{border:0,padding:0,margin:0,display:'grid',gap:8}}>
        <legend style={{fontWeight:650}}>DNS de destino</legend>
        <label><input type="radio" checked={mode==='existing'} onChange={()=>setMode('existing')}/> DNS cadastrada</label>
        <label><input type="radio" checked={mode==='new'} onChange={()=>setMode('new')}/> Nova DNS pelo link (cadastro automático após validação)</label>
      </fieldset>
      {mode==='existing'?<label style={label}>Servidor
        <select value={providerId} onChange={e=>setProviderId(e.target.value)} required>
          <option value="">Selecione a DNS</option>
          {activeServers.map(p=><option key={p.id} value={p.id}>{p.name} — {p.baseUrl}</option>)}
        </select>
      </label>:<><label style={label}>URL da nova DNS
        <input type="url" placeholder="https://dns.exemplo.com" value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} maxLength={500} required/>
      </label><label style={label}>Nome do servidor (opcional)
        <input value={name} onChange={e=>setName(e.target.value)} maxLength={120}/>
      </label></>}
      <label style={label}>Tempo de prioridade emergencial
        <select value={minutes} onChange={e=>setMinutes(Number(e.target.value))}>
          {[5,10,15,30,60,120,180,360].map(t=><option key={t} value={t}>{t<60?`${t} minutos`:`${t/60} hora${t===60?'':'s'}`}</option>)}
        </select>
      </label>
      <div><strong>Códigos afetados ({codes.length})</strong>
        <p style={{margin:'3px 0 10px',opacity:.75}}>Somente os códigos marcados receberão a nova prioridade.</p>
        <label><input type="checkbox" checked={!!eligibleCodes.length&&codes.length===eligibleCodes.length} onChange={e=>setCodes(e.target.checked?eligibleCodes.map(x=>x.id):[])}/> Todos os códigos desta parceria</label>
        <div style={{maxHeight:240,overflowY:'auto',display:'grid',gap:6,padding:'8px 0'}}>
          {eligibleCodes.map(c=><label key={c.id} style={{display:'flex',gap:8,alignItems:'center'}}>
            <input type="checkbox" checked={codes.includes(c.id)} onChange={()=>toggle(c.id)}/>
            <span><strong>{c.code}</strong> {c.label||''}</span>
            {data.active.some(x=>x.codeId===c.id)&&<small style={{opacity:.75}}>
              Prioridade até {new Date(data.active.find(x=>x.codeId===c.id).expiresAt).toLocaleTimeString('pt-BR')}
              {data.progress?.some(p=>p.codeId===c.id)&&` · Rotas na DNS: ${data.progress.find(p=>p.codeId===c.id).updated}/${data.progress.find(p=>p.codeId===c.id).total}`}
            </small>}
          </label>)}
          {!eligibleCodes.length&&<p>Nenhum código ativo disponível.</p>}
        </div>
      </div>
      <label><input type="checkbox" checked={notify} onChange={e=>setNotify(e.target.checked)}/> Mostrar aviso na TV</label>
      {notify&&<label style={label}>Mensagem para os clientes
        <textarea rows={3} value={message} maxLength={300} onChange={e=>setMessage(e.target.value)}/>
      </label>}
      <small>Após o prazo, a seleção automática volta a decidir pela saúde e latência. A DNS cadastrada continua disponível no pool; se ele já estiver no limite, a última origem autorizada pode ser substituída para abrir vaga. O contador mede rotas resolvidas pela API, não confirma a reprodução do vídeo.</small>
      <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
        <button type="button" disabled={loading||busy||!codes.length||(mode==='existing'?!providerId:!/^https?:\/\//i.test(baseUrl.trim()))} onClick={()=>setConfirm(true)}>Mudar DNS nas TVs selecionadas</button>
        <button type="button" disabled={busy||!selectedCodes.some(c=>data.active.some(x=>x.codeId===c.id))} onClick={()=>void stop()}>Encerrar prioridade</button>
        <button type="button" disabled={busy} onClick={()=>void refresh()}>Atualizar</button>
      </div>
    </>}
    {confirm&&<div role="presentation" style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',zIndex:10000,display:'grid',placeItems:'center',padding:16}} onClick={()=>setConfirm(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="dns-confirm-title" style={{...card,width:'min(100%,480px)',background:'var(--surface,#202632)',color:'var(--text,#fff)'}} onClick={e=>e.stopPropagation()}>
        <h3 id="dns-confirm-title">Confirmar mudança emergencial?</h3>
        <p>Enviar uma nova prioridade por <strong>{minutes} minutos</strong> para <strong>{codes.length} código(s)</strong>. A TV poderá reiniciar o vídeo para aplicar o novo servidor. O failover permanece ligado.</p>
        <div style={{display:'flex',gap:8}}><button type="button" onClick={()=>void submit()}>Confirmar envio</button><button type="button" onClick={()=>setConfirm(false)}>Cancelar</button></div>
      </div>
    </div>}
  </section>;
}
