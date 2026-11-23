import React, { useCallback, useEffect, useState } from 'react';

export default function PartnerUnlinkedApps({ api }) {
  const [result, setResult] = useState({ data: [], meta: {} });
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const refresh = useCallback(() => api('/partner/devices/unlinked', { query: { page, pageSize: 20, ...(q ? { q } : {}) } }).then(setResult).catch(e => setError(e.message)), [api, page, q]);
  useEffect(() => { void refresh(); }, [refresh]);
  const link = async event => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await api(`/partner/devices/unlinked/${selected.id}/link`, { method: 'POST', body: credentials });
      setCredentials({ username: '', password: '' }); setSelected(null);
      setNotice('TV vinculada. A lista ficará disponível na próxima atualização do aplicativo.');
      await refresh();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <section style={{ display: 'grid', gap: 14, minWidth: 0 }}>
    <h2>TVs sem vínculo</h2>
    <p className="muted">Somente aparelhos dos aplicativos que pertencem à sua parceria.</p>
    {error && <p className="error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <label>Pesquisar por MAC<input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="MAC do aparelho" /></label>
    <div style={{ overflowX: 'auto' }} tabIndex={0} aria-label="Lista de TVs sem vínculo">
      <table><thead><tr><th>MAC</th><th>App</th><th>Online</th><th>Primeiro registro</th><th>Histórico</th><th>Ação</th></tr></thead><tbody>
        {(result.data || []).map(device => <tr key={device.id}><td>{device.mac}</td><td>{device.app}</td>
          <td>{device.online ? 'Sim' : 'Não'}</td><td>{device.firstSeenAt ? new Date(device.firstSeenAt).toLocaleString('pt-BR') : '-'}</td>
          <td>{device.previouslyLinked ? 'Já teve lista' : 'Novo'}</td>
          <td><button type="button" className="btn sm" onClick={() => { setSelected(device); setCredentials({ username: '', password: '' }); setError(''); }}>Vincular TV</button></td></tr>)}
      </tbody></table>
    </div>
    {!result.data?.length && <p className="muted">Nenhuma TV aguardando vínculo.</p>}
    <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><button type="button" className="btn" disabled={!result.meta?.totalPages || page >= result.meta.totalPages} onClick={() => setPage(page + 1)}>Próxima</button></div>
    {selected && <div className="overlay" role="presentation"><form onSubmit={link} className="modal" role="dialog" aria-modal="true" aria-label="Vincular TV" style={{ display: 'grid', gap: 12, padding: 20 }}>
      <h3>Vincular TV</h3><p>{selected.mac} · {selected.app}</p>
      <label>Usuário<input required maxLength={128} autoComplete="off" value={credentials.username} onChange={e => setCredentials({ ...credentials, username: e.target.value })}/></label>
      <label>Senha<input required type="password" maxLength={128} autoComplete="off" value={credentials.password} onChange={e => setCredentials({ ...credentials, password: e.target.value })}/></label>
      <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn" onClick={() => { setCredentials({ username: '', password: '' }); setSelected(null); }} disabled={busy}>Cancelar</button>
        <button type="submit" className="btn primary" disabled={busy}>{busy ? 'Vinculando…' : 'Vincular'}</button></div>
    </form></div>}
  </section>;
}
