import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import './support-center.css';

const isUuid = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || '').trim());
const niceDate = v => v ? new Date(v).toLocaleString('pt-BR') : 'Não informado';
const statusTitle = { ok:'Sem problema identificado', warning:'Atenção necessária', critical:'Problema identificado', unknown:'Precisa de mais informações' };

export default function SupportCenter({ base = '/partner' }) {
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState('');
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activationId, setActivationId] = useState('');
  const [notice, setNotice] = useState('');
  const requestSequence = useRef(0);
  const admin = base === '/admin';
  const supportPath = (id) => admin ? `/admin/devices/activations/${id}/support` : `/partner/devices/${id}/support`;
  const commandPath = (id) => admin ? `/admin/devices/activations/${id}/remote` : `/partner/devices/${id}/remote`;
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const task = setTimeout(async () => {
      setListBusy(true);
      try {
        const data = await api(`${base}/clients`, { query: { q: search.trim(), page: 1, pageSize: 20 }, signal: controller.signal });
        if (alive) { setClients(data?.data || []); setListError(''); }
      } catch (e) {
        if (alive && e.name !== 'AbortError') { setClients([]); setListError(e.message || 'Não foi possível consultar clientes.'); }
      } finally { if (alive) setListBusy(false); }
    }, 350);
    return () => { alive = false; clearTimeout(task); controller.abort(); };
  }, [base, search]);
  const fetchReport = async (choice) => {
    if (!choice?.id) return;
    const sequence = ++requestSequence.current;
    setBusy(true); setError(''); setNotice(''); setSelected(choice); setResult(null);
    try {
      const endpoint = choice.type === 'client' ? `${base}/clients/${choice.id}/support` : supportPath(choice.id);
      const data = await api(endpoint);
      if (sequence === requestSequence.current) setResult(data);
    } catch(e) { if (sequence === requestSequence.current) setError(e.message || 'Falha no diagnóstico.'); }
    finally { if (sequence === requestSequence.current) setBusy(false); }
  };
  const diagnoseById = () => {
    if (!isUuid(activationId)) { setError('Informe um ID de ativação válido.'); return; }
    void fetchReport({ type: 'activation', id: activationId.trim() });
  };
  const sendCommand = async (type) => {
    const item = result?.selected || (result?.activation ? result : null);
    if (!item?.activation?.id) return;
    const label = type === 'refresh-catalog' ? 'atualizar o catálogo' : 'revalidar o acesso';
    if (!window.confirm(`Solicitar à TV que execute: ${label}? Em caso de licença bloqueada, essa verificação pode interromper a reprodução. Se ela estiver offline, o comando poderá expirar.`)) return;
    setNotice(''); setError('');
    try {
      const response = await api(commandPath(item.activation.id), { method: 'POST', body: { type } });
      setNotice(`Comando ${response?.id || ''} registrado como pendente. Isso não confirma execução na TV.`);
    } catch(e) { setError(e.message || 'Não foi possível enviar o comando.'); }
  };
  // Atalho de "Diagnosticar" nas outras telas; armazena apenas o identificador,
  // nunca dados pessoais, tokens ou o resultado da auditoria.
  useEffect(() => {
    const pending = sessionStorage.getItem('deltatv-support-open');
    if (!pending) return;
    sessionStorage.removeItem('deltatv-support-open');
    try {
      const value = JSON.parse(pending);
      if ((value.type === 'client' || value.type === 'activation') && isUuid(value.id)) void fetchReport(value);
    } catch { /* origem inválida; ignorar */ }
    // Intencional: apenas na montagem da página, não a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const current = result?.selected || (result?.activation ? result : null);
  const client = result?.client || null;
  const diagnosis = current?.diagnosis || result?.diagnosis || null;
  return <section className="delta-support">
    <div className="delta-support-heading"><div><h2>Atendimento simplificado</h2><p>Encontre o cliente, veja a causa provável e siga a orientação. Sem precisar consultar várias telas.</p></div></div>
    <div className="delta-support-step"><strong>1 · Encontre a TV ou o cliente</strong>
      <div className="delta-support-search"><input aria-label="Buscar clientes" placeholder="Nome, telefone ou MAC" value={search} onChange={e => setSearch(e.target.value)} />
        <small>{listBusy ? 'Buscando…' : `${clients.length} resultado(s) nesta página`}</small></div>
      {listError && <p className="delta-support-muted">{listError} Você ainda pode consultar uma ativação pelo ID.</p>}
      <div className="delta-support-results">{clients.map(c => <button type="button" key={`${c.partnerId || ''}:${c.clientId || c.activationId || c.mac}`} onClick={() => void fetchReport(c.clientId ? {type:'client',id:c.clientId} : {type:'activation',id:c.device?.activationId || c.activationId})} disabled={!c.clientId && !(c.device?.activationId || c.activationId)} className={selected?.id === (c.clientId || c.device?.activationId) ? 'chosen' : ''}>
          <b>{c.name || 'TV sem ficha comercial'}</b><span>{c.mac} {c.partnerName ? `· ${c.partnerName}` : ''}</span>
        </button>)}
        {!clients.length && !listBusy && !listError && <span className="delta-support-muted">Nenhum cliente encontrado. Você também pode usar o ID da ativação.</span>}
      </div>
      <details className="delta-support-advanced"><summary>Já tenho o ID da ativação</summary><div className="delta-support-search"><input value={activationId} onChange={e=>setActivationId(e.target.value)} placeholder="UUID da ativação" aria-label="ID da ativação" /><button className="delta-support-action" onClick={diagnoseById}>Diagnosticar</button></div></details>
    </div>
    <div className="delta-support-step"><div className="delta-support-between"><strong>2 · Entenda a situação</strong>{result && <button onClick={()=>void fetchReport(selected)} disabled={busy} className="delta-support-action secondary">Atualizar diagnóstico</button>}</div>
      {busy && <p role="status">Verificando licença, conexão e servidor…</p>}
      {error && <p role="alert" className="delta-support-error">{error}</p>}
      {!result && !busy && !error && <p className="delta-support-muted">Selecione um cliente para ver a ficha e o diagnóstico.</p>}
      {client && <div className="delta-support-profile"><div><small>Cliente</small><b>{client.name}</b><span>{client.mac}</span></div><div><small>Empresa</small><b>{client.partnerName || '—'}</b><span>{client.phone || 'Telefone não cadastrado'}</span></div><div><small>Vencimento do serviço</small><b>{client.dueDate || 'Não cadastrado'}</b><span>{client.daysLeft == null ? 'Sem prazo informado' : client.daysLeft < 0 ? `Vencido há ${Math.abs(client.daysLeft)} dia(s)` : client.daysLeft === 0 ? 'Vence hoje' : `Faltam ${client.daysLeft} dia(s)`}</span></div></div>}
      {result?.ambiguity && <p role="alert" className="delta-support-error">{result.ambiguity}</p>}
      {!!result?.lists?.length && <div className="delta-support-lists"><small>Listas deste cliente</small>{result.lists.map(l => <span key={l.id}>{l.name} ({l.status})</span>)}</div>}
      {diagnosis && <div className={`delta-support-diagnosis ${diagnosis.status}`}><small>{statusTitle[diagnosis.status]}</small><h3>{diagnosis.headline}</h3><p>{diagnosis.nextAction}</p></div>}
      {current && <div className="delta-support-profile"><div><small>TV</small><b>{current.device?.platform || 'Não identificada'} · {current.device?.online ? 'Com sinal recente' : 'Sem sinal recente'}</b><span>{current.device?.mac || ''}</span></div><div><small>Licença</small><b>{current.access?.allowed ? 'Autorizada' : 'Não autorizada'}</b><span>{current.access?.code || '—'} · até {niceDate(current.access?.expiresAt)}</span></div><div><small>Servidor selecionado</small><b>{current.provider?.name || 'Não identificado'}</b><span>{current.provider?.state || 'Sem sondagem recente'}</span></div><div><small>Agora na TV</small><b>{current.live?.playback?.title || 'Nenhum conteúdo informado'}</b><span>{current.live?.playback?.state || '—'}{current.live?.ip ? ` · IP observado: ${current.live.ip}` : ''}</span></div></div>}
      {!!diagnosis?.findings?.length && <details className="delta-support-advanced"><summary>Ver todas as verificações ({diagnosis.findings.length})</summary><div className="delta-support-findings">{diagnosis.findings.map(f=><div key={f.code}><b>{f.title}</b><p>{f.evidence}</p><span>{f.nextAction}</span></div>)}</div></details>}
    </div>
    <div className="delta-support-step"><strong>3 · Resolva com segurança</strong><p>As ações abaixo apenas enviam um comando autenticado à TV. Não alteram licenças nem credenciais.</p>
      <div className="delta-support-buttons"><button className="delta-support-action" disabled={!current?.activation?.id || busy} onClick={()=>void sendCommand('sync-access')}>Revalidar licença</button><button className="delta-support-action secondary" disabled={!current?.activation?.id || busy} onClick={()=>void sendCommand('refresh-catalog')}>Atualizar catálogo</button></div>
      {notice && <p role="status" className="delta-support-muted">{notice}</p>}
      <small className="delta-support-muted">Os resultados usam dados atuais; IP e título são temporários. Não registramos novo histórico de reprodução nesta página.</small>
    </div>
  </section>;
}
