import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './emergency-dns.css';

const DEFAULT_MESSAGE = 'Atualizando servidor. A transmissão será retomada automaticamente.';
const DURATIONS = [5, 10, 15, 30, 60, 120, 180, 360];
const displayDuration = minutes => minutes < 60 ? `${minutes} minutos` : `${minutes / 60} hora${minutes === 60 ? '' : 's'}`;
const displayDate = date => date ? new Date(date).toLocaleString('pt-BR') : '—';

/** UI única usada pelos três projetos Vite; escopo e autorização continuam no backend. */
export default function EmergencyDns({ api, base }) {
  const [target, setTarget] = useState('codes');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [codes, setCodes] = useState([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState('existing');
  const [providerId, setProviderId] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [name, setName] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [notify, setNotify] = useState(true);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [confirm, setConfirm] = useState(null);

  const refresh = useCallback(async () => {
    if (!base) return;
    setLoading(true);
    try {
      const result = await api(base, { query: { page, search: query } });
      const servers = Array.isArray(result.servers) ? result.servers : [];
      setData(result);
      setProviderId(old => servers.some(server => server.id === old && server.status === 'active')
        ? old : servers.find(server => server.status === 'active')?.id || '');
      // Preservar seleções feitas em outras páginas; o backend valida o escopo na escrita.
      setError('');
    } catch (err) {
      setError(err.message || 'Não foi possível carregar as configurações de DNS.');
    } finally {
      setLoading(false);
    }
  }, [api, base, page, query]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); setQuery(search.trim()); }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!confirm) return undefined;
    const close = event => { if (event.key === 'Escape' && !busy) setConfirm(null); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [confirm, busy]);

  const activeServers = useMemo(() => (data?.servers || []).filter(server => server.status === 'active'), [data]);
  const eligibleCodes = data?.codes || [];
  const active = data?.active || [];
  const progress = data?.progress || [];
  const visibleCodes = eligibleCodes; // A busca e a paginação são feitas no backend.
  const allVisibleSelected = visibleCodes.length > 0 && visibleCodes.every(code => codes.includes(code.id));
  const canApply = !loading && !busy && codes.length > 0 && (mode === 'existing'
    ? !!providerId : /^https?:\/\/\S+/i.test(baseUrl.trim()) && (!name.trim() || name.trim().length >= 2));

  const toggle = id => setCodes(old => old.includes(id) ? old.filter(value => value !== id) : [...old, id]);
  const toggleVisible = () => setCodes(old => allVisibleSelected
    ? old.filter(id => !visibleCodes.some(code => code.id === id))
    : [...new Set([...old, ...visibleCodes.map(code => code.id)])]);

  const batchCodes = items => Array.from({length:Math.ceil(items.length / 500)},(_,index)=>items.slice(index*500,(index+1)*500));
  const submit = async () => {
    if (!canApply) return;
    setConfirm(null);
    setBusy(true); setError(''); setNotice('');
    let processed=0;
    try {
      for(const chunk of batchCodes(codes)) {
        const payload = {
          codeIds: chunk, minutes: Number(minutes), notify,
          message: notify ? message : undefined,
          ...(mode === 'existing' ? { providerId } : { baseUrl: baseUrl.trim(), name: name.trim() || undefined }),
        };
        const result = await api(base, { method: 'POST', body: payload });
        processed += result.codeCount;
      }
      setNotice(`Prioridade enviada para ${processed} código(s). TVs offline recebem a configuração ao retornar, enquanto vigente.`);
      setCodes([]);
      await refresh();
    } catch (err) {
      setError(`${processed} código(s) processados antes do erro: ${err.message || 'não foi possível concluir todos os lotes'}. Confira o estado antes de repetir.`);
      await refresh();
    } finally { setBusy(false); }
  };
  const stop = async () => {
    if (!codes.length || busy) return;
    setConfirm(null);
    setBusy(true); setError(''); setNotice('');
    let ended=0;
    try {
      for(const chunk of batchCodes(codes)) {
        const result = await api(base, { method: 'DELETE', body: { codeIds: chunk } });
        ended+=result.ended;
      }
      setNotice(`Prioridade emergencial encerrada em ${ended} código(s).`);
      setCodes([]);
      await refresh();
    } catch (err) {
      setError(`${ended} prioridade(s) encerradas antes do erro: ${err.message || 'falha ao concluir todos os lotes'}. Confira antes de repetir.`);
      await refresh();
    } finally { setBusy(false); }
  };

  if (target === 'device') return <DeviceDns api={api} base={base} onBack={() => setTarget('codes')} />;

  return <section className="dns-emergency" aria-label="Troca emergencial de DNS">
    <header className="dns-hero">
      <div>
        <span className="dns-eyebrow">REDE · CONTROLE DE SERVIDORES</span>
        <h2>Troca emergencial de DNS</h2>
        <p>Escolha um servidor e os códigos afetados. A prioridade é temporária, sem desativar a proteção do failover.</p>
      </div>
      <span className="dns-hero-mark" aria-hidden="true">↗</span>
    </header>

    <nav className="dns-switcher" aria-label="Tipo de operação">
      <button type="button" className="dns-switcher-button is-active" aria-pressed="true">Vários códigos</button>
      <button type="button" className="dns-switcher-button" aria-pressed="false" onClick={() => setTarget('device')}>Uma TV específica</button>
    </nav>

    {error && <div className="dns-feedback is-error" role="alert">{error}</div>}
    {notice && <div className="dns-feedback is-success" role="status">{notice}</div>}

    <div className="dns-stats" aria-label="Resumo dos recursos">
      <div><span>DNS disponíveis</span><strong>{loading && !data ? '…' : activeServers.length}</strong></div>
      <div><span>Códigos disponíveis</span><strong>{loading && !data ? '…' : (data?.totalCodes ?? eligibleCodes.length)}</strong></div>
      <div><span>Prioridades ativas</span><strong>{loading && !data ? '…' : active.length}</strong></div>
    </div>

    {!data && loading ? <div className="dns-panel dns-loading" role="status">Carregando servidores e códigos…</div> :
      <div className="dns-layout">
        <div className="dns-main-column">
          <section className="dns-panel">
            <div className="dns-section-title"><span className="dns-step">01</span><div><h3>Servidor de destino</h3><p>Escolha uma DNS existente ou informe uma nova URL.</p></div></div>
            <div className="dns-options" role="radiogroup" aria-label="Origem da DNS">
              <label className={`dns-option ${mode === 'existing' ? 'is-selected' : ''}`}>
                <input type="radio" name="dns-origin" value="existing" checked={mode === 'existing'} onChange={() => setMode('existing')} />
                <span><strong>DNS cadastrada</strong><small>Usar um servidor da sua rede</small></span>
              </label>
              <label className={`dns-option ${mode === 'new' ? 'is-selected' : ''}`}>
                <input type="radio" name="dns-origin" value="new" checked={mode === 'new'} onChange={() => setMode('new')} />
                <span><strong>Nova DNS</strong><small>Validar e cadastrar pela URL</small></span>
              </label>
            </div>
            {mode === 'existing' ? <label className="dns-field">Servidor
              <select value={providerId} onChange={e => setProviderId(e.target.value)} disabled={busy || !activeServers.length}>
                <option value="">Selecione um servidor</option>
                {activeServers.map(server => <option key={server.id} value={server.id}>{server.name} — {server.baseUrl}</option>)}
              </select>
              {!activeServers.length && <small>Nenhuma DNS ativa cadastrada. Use a opção “Nova DNS”.</small>}
            </label> : <div className="dns-field-grid">
              <label className="dns-field">Endereço da nova DNS
                <input type="url" placeholder="https://dns.exemplo.com" maxLength={500} value={baseUrl} onChange={e => setBaseUrl(e.target.value)} />
                <small>A URL será verificada antes da alteração dos códigos.</small>
              </label>
              <label className="dns-field">Nome (opcional)
                <input type="text" minLength={2} maxLength={120} placeholder="Ex.: Servidor reserva" value={name} onChange={e => setName(e.target.value)} />
                {name.trim().length === 1 && <small>Informe pelo menos dois caracteres ou deixe em branco.</small>}
              </label>
            </div>}
            <label className="dns-field dns-duration">Prazo da prioridade
              <select value={minutes} onChange={e => setMinutes(Number(e.target.value))} disabled={busy}>
                {DURATIONS.map(value => <option key={value} value={value}>{displayDuration(value)}</option>)}
              </select>
              <small>Depois do prazo, o resolvedor volta ao comportamento normal permitido pelo plano.</small>
            </label>
          </section>

          <section className="dns-panel">
            <div className="dns-section-title"><span className="dns-step">02</span><div><h3>Quais códigos serão afetados?</h3><p>Somente os selecionados receberão a prioridade de DNS.</p></div></div>
            <div className="dns-code-toolbar">
              <label className="dns-search"><span className="dns-visually-hidden">Buscar códigos</span>
                <input type="search" placeholder="Buscar código ou identificação…" value={search} onChange={e => setSearch(e.target.value)} />
              </label>
              <button type="button" className="dns-link-button" disabled={!visibleCodes.length || busy} onClick={toggleVisible}>
                {allVisibleSelected ? 'Desmarcar visíveis' : 'Selecionar visíveis'}
              </button>
            </div>
            <div className="dns-code-meta"><span>{visibleCodes.length} nesta página de {data?.totalCodes ?? visibleCodes.length}</span><strong>{codes.length} selecionados</strong></div>
            <div className="dns-code-list" aria-label="Lista de códigos">
              {visibleCodes.map(code => {
                const override = active.find(item => item.codeId === code.id);
                const stat = progress.find(item => item.codeId === code.id);
                return <label className={`dns-code ${codes.includes(code.id) ? 'is-checked' : ''}`} key={code.id}>
                  <input type="checkbox" checked={codes.includes(code.id)} onChange={() => toggle(code.id)} disabled={busy} />
                  <span className="dns-code-content"><strong>{code.code}</strong>{code.label && <small>{code.label}</small>}
                    {override && <small className="dns-active-detail">Até {displayDate(override.expiresAt)}{stat ? ` · Rotas: ${stat.updated}/${stat.total}` : ''}</small>}
                  </span>
                  {override && <span className="dns-status-tag">Em prioridade</span>}
                </label>;
              })}
              {!visibleCodes.length && <div className="dns-empty">Nenhum código encontrado.</div>}
            </div>
            <div className="dns-code-meta" aria-label="Paginação de códigos">
              <button type="button" className="dns-button dns-secondary" disabled={busy || loading || page === 1} onClick={() => setPage(old => old-1)}>Anterior</button>
              <span>Página {page} de {Math.max(1,Math.ceil((data?.totalCodes || 0)/(data?.pageSize || 100)))}</span>
              <button type="button" className="dns-button dns-secondary" disabled={busy || loading || !data?.hasMore} onClick={() => setPage(old => old+1)}>Próxima</button>
            </div>
          </section>
        </div>

        <aside className="dns-side-column">
          <section className="dns-panel">
            <div className="dns-section-title"><span className="dns-step">03</span><div><h3>Aviso nas TVs</h3><p>Informe o cliente durante a troca.</p></div></div>
            <label className="dns-toggle"><input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} disabled={busy} /><span><strong>Mostrar notificação</strong><small>Mensagem enviada junto com o comando</small></span></label>
            {notify && <label className="dns-field">Mensagem para os clientes
              <textarea rows={4} value={message} maxLength={300} onChange={e => setMessage(e.target.value)} disabled={busy} />
              <small className="dns-count">{message.length}/300 caracteres</small>
            </label>}
          </section>
          <section className="dns-panel dns-summary">
            <h3>Resumo da operação</h3>
            <dl><div><dt>Códigos</dt><dd>{codes.length}</dd></div><div><dt>Duração</dt><dd>{displayDuration(minutes)}</dd></div><div><dt>Mensagem na TV</dt><dd>{notify ? 'Sim' : 'Não'}</dd></div></dl>
            <p>O failover continua disponível quando autorizado. Se a DNS escolhida cair, o sistema pode tentar uma alternativa.</p>
            <button type="button" className="dns-button dns-primary" disabled={!canApply} onClick={() => setConfirm('apply')}>
              {busy ? 'Enviando…' : 'Iniciar troca emergencial'}
            </button>
            <button type="button" className="dns-button dns-secondary" disabled={busy || !codes.length} onClick={() => setConfirm('stop')}>
              Encerrar prioridade dos selecionados ({codes.length})
            </button>
            <button type="button" className="dns-link-button dns-refresh" disabled={busy || loading} onClick={() => void refresh()}>
              {loading ? 'Atualizando…' : 'Atualizar informações'}
            </button>
          </section>
        </aside>
      </div>
    }

    <p className="dns-footnote">A contagem de rotas indica escolhas do servidor, não confirma reprodução. Se o limite estiver cheio, a nova DNS terá prioridade temporária sem remover as associações antigas.</p>

    {confirm && <div className="dns-confirm-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setConfirm(null); }}>
      <div className="dns-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="dns-confirm-title">
        <span className="dns-eyebrow">CONFIRMAÇÃO</span>
        <h3 id="dns-confirm-title">{confirm === 'apply' ? 'Iniciar troca de DNS?' : 'Encerrar prioridade emergencial?'}</h3>
        <p>{confirm === 'apply'
          ? `A alteração terá prioridade por ${displayDuration(minutes)} em ${codes.length} código(s). Algumas TVs podem reiniciar o vídeo.`
          : `A prioridade dos ${codes.length} código(s) selecionados será encerrada (quando estiver ativa). O resolvedor voltará à seleção normal.`}</p>
        <div className="dns-confirm-actions">
          <button type="button" className="dns-button dns-secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancelar</button>
          <button type="button" className={`dns-button ${confirm === 'apply' ? 'dns-primary' : 'dns-danger'}`} disabled={busy} onClick={() => void (confirm === 'apply' ? submit() : stop())} autoFocus>
            {confirm === 'apply' ? 'Confirmar e enviar' : 'Sim, encerrar'}
          </button>
        </div>
      </div>
    </div>}
  </section>;
}

/** Troca individual: usa exatamente as mesmas regras e API já existentes. */
export function DeviceDns({ api, base, onBack, initialMac = '' }) {
  const [mac, setMac] = useState(initialMac);
  const [data, setData] = useState(null);
  const [providerId, setProviderId] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [notify, setNotify] = useState(true);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState(null);
  const requestId = useRef(0);

  const load = useCallback(async macToFind => {
    const request = ++requestId.current;
    setBusy(true); setError(''); setNotice(''); setData(null);
    try {
      const result = await api(`${base}/device`, { query: { mac: macToFind.trim() } });
      if (request !== requestId.current) return;
      setData(result);
      const activeServers = (result.servers || []).filter(server => server.status === 'active');
      setProviderId(activeServers.some(server => server.id === result.active?.providerId)
        ? result.active.providerId : activeServers[0]?.id || '');
    } catch (err) {
      if (request === requestId.current) setError(err.message || 'TV não encontrada. Confira o MAC.');
    } finally {
      if (request === requestId.current) setBusy(false);
    }
  }, [api, base]);

  useEffect(() => {
    if (initialMac) void load(initialMac);
    return () => { requestId.current += 1; };
  }, [initialMac, load]);
  useEffect(() => {
    if (!confirm) return undefined;
    const close = event => { if (event.key === 'Escape' && !busy) setConfirm(null); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [confirm, busy]);

  const save = async () => {
    if (!data?.device || !providerId || busy) return;
    setConfirm(null); setBusy(true); setError(''); setNotice('');
    try {
      const result = await api(`${base}/device/${data.device.id}`, { method: 'POST', body: {
        providerId, minutes, notify, message: notify ? message : undefined,
      } });
      setData(old => ({ ...old, active: { providerId, expiresAt: result.expiresAt } }));
      setNotice(`Ordem enviada somente para ${data.device.mac}. Prioridade até ${displayDate(result.expiresAt)}.`);
    } catch (err) {
      setError(err.message || 'Não foi possível alterar a DNS desta TV.');
    } finally {
      setBusy(false);
    }
  };
  const stop = async () => {
    if (!data?.active || busy) return;
    setConfirm(null); setBusy(true); setError(''); setNotice('');
    try {
      await api(`${base}/device/${data.device.id}`, { method: 'DELETE' });
      setData(old => ({ ...old, active: null }));
      setNotice('Prioridade individual encerrada. A TV volta à seleção normal.');
    } catch (err) {
      setError(err.message || 'Não foi possível desfazer a alteração.');
    } finally {
      setBusy(false);
    }
  };

  return <section className="dns-emergency dns-device" aria-label="Trocar DNS de uma TV">
    <header className="dns-hero dns-device-hero">
      <div><span className="dns-eyebrow">CONTROLE POR DISPOSITIVO</span><h2>Trocar DNS desta TV</h2><p>A mudança será aplicada somente ao MAC selecionado, sem alterar as outras TVs do código.</p></div>
      <span className="dns-hero-mark" aria-hidden="true">↗</span>
    </header>
    {onBack && <button type="button" className="dns-link-button dns-back" onClick={onBack}>← Voltar</button>}
    <section className="dns-panel">
      <div className="dns-section-title"><span className="dns-step">01</span><div><h3>Localizar dispositivo</h3><p>Informe o MAC da TV que receberá a alteração.</p></div></div>
      <form className="dns-device-search" onSubmit={event => { event.preventDefault(); void load(mac); }}>
        <label className="dns-field">MAC da TV
          <input type="text" placeholder="AA:BB:CC:DD:EE:FF" value={mac} maxLength={24} required
            onChange={event => { setMac(event.target.value); setData(null); setNotice(''); requestId.current += 1; setBusy(false); }} />
        </label>
        <button type="submit" className="dns-button dns-primary" disabled={busy || !mac.trim()}>{busy ? 'Buscando…' : 'Localizar TV'}</button>
      </form>
    </section>
    {error && <div className="dns-feedback is-error" role="alert">{error}</div>}
    {notice && <div className="dns-feedback is-success" role="status">{notice}</div>}
    {data && <div className="dns-device-grid">
      <section className="dns-panel">
        <div className="dns-section-title"><span className="dns-step">02</span><div><h3>Configurar a troca</h3><p>Escolha uma DNS autorizada para o código.</p></div></div>
        <div className="dns-device-identity"><span>Dispositivo encontrado</span><strong>{data.device.mac}</strong><small>Código {data.device.code}</small></div>
        {data.active && <div className="dns-feedback is-info">Prioridade vigente até {displayDate(data.active.expiresAt)}</div>}
        <label className="dns-field">Servidor de destino
          <select value={providerId} onChange={event => setProviderId(event.target.value)} disabled={busy || !(data.servers || []).some(server => server.status === 'active')}>
            <option value="">Selecione a DNS</option>
            {(data.servers || []).filter(server => server.status === 'active').map(server => <option key={server.id} value={server.id}>{server.name} — {server.baseUrl}</option>)}
          </select>
          {!(data.servers || []).some(server => server.status === 'active') && <small>Não existem DNS ativas autorizadas. Cadastre a DNS em Meus DNS e associe ao código antes.</small>}
        </label>
        <label className="dns-field">Duração da prioridade
          <select value={minutes} onChange={event => setMinutes(Number(event.target.value))} disabled={busy}>
            {DURATIONS.map(value => <option key={value} value={value}>{displayDuration(value)}</option>)}
          </select>
        </label>
      </section>
      <section className="dns-panel">
        <div className="dns-section-title"><span className="dns-step">03</span><div><h3>Comunicação com a TV</h3><p>Personalize o aviso ao cliente.</p></div></div>
        <label className="dns-toggle"><input type="checkbox" checked={notify} onChange={event => setNotify(event.target.checked)} disabled={busy} /><span><strong>Mostrar notificação</strong><small>Enviada durante a mudança de servidor</small></span></label>
        {notify && <label className="dns-field">Mensagem
          <textarea rows={3} maxLength={300} value={message} onChange={event => setMessage(event.target.value)} disabled={busy} />
          <small className="dns-count">{message.length}/300 caracteres</small>
        </label>}
        <p className="dns-panel-note">Se a TV estiver desconectada, receberá a configuração ainda válida quando voltar. O failover não é desligado.</p>
        <div className="dns-device-actions">
          <button type="button" className="dns-button dns-primary" disabled={busy || !providerId} onClick={() => setConfirm('apply')}>Trocar DNS desta TV</button>
          <button type="button" className="dns-button dns-secondary" disabled={busy || !data.active} onClick={() => setConfirm('stop')}>Desfazer prioridade</button>
        </div>
      </section>
    </div>}
    {!data && !busy && !error && <div className="dns-empty dns-device-empty">Localize o dispositivo para escolher o servidor de destino.</div>}
    {confirm && <div className="dns-confirm-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setConfirm(null); }}>
      <div className="dns-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="dns-device-confirm-title">
        <span className="dns-eyebrow">CONFIRMAÇÃO INDIVIDUAL</span>
        <h3 id="dns-device-confirm-title">{confirm === 'apply' ? 'Trocar DNS desta TV?' : 'Desfazer a prioridade?'}</h3>
        <p>{confirm === 'apply'
          ? `Somente a TV ${data.device.mac} receberá a prioridade por ${displayDuration(minutes)}. A reprodução poderá reiniciar.`
          : `A prioridade manual de ${data.device.mac} será encerrada.`}</p>
        <div className="dns-confirm-actions">
          <button type="button" className="dns-button dns-secondary" disabled={busy} onClick={() => setConfirm(null)}>Cancelar</button>
          <button type="button" className={`dns-button ${confirm === 'apply' ? 'dns-primary' : 'dns-danger'}`} disabled={busy} onClick={() => void (confirm === 'apply' ? save() : stop())} autoFocus>
            {confirm === 'apply' ? 'Confirmar troca' : 'Sim, desfazer'}
          </button>
        </div>
      </div>
    </div>}
  </section>;
}
