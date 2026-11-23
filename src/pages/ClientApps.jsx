import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

export default function ClientApps() {
  const [apps, setApps] = useState([]);
  const [newApp, setNewApp] = useState({ identifier: '', name: '', status: 'active' });
  const [assign, setAssign] = useState(null);
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const refresh = useCallback(() => api('/admin/client-apps').then(r => setApps(r.data || [])).catch(e => setError(e.message)), []);
  useEffect(() => { void refresh(); }, [refresh]);
  const run = async (work, notice) => {
    setBusy(true); setError(''); setMessage('');
    try { const r = await work(); await refresh(); setMessage(notice); return r; }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  };
  const create = async e => { e.preventDefault(); const r = await run(() => api('/admin/client-apps', { method: 'POST', body: newApp }), 'Aplicativo cadastrado.');
    if (r) setNewApp({ identifier: '', name: '', status: 'active' }); };
  const newClaim = async app => { const r = await run(() => api(`/admin/client-apps/${app.id}/claim-code`, { method: 'POST', body: { expiresMinutes: 1440 } }), 'Código de vinculação emitido. Copie agora.');
    if (r) setCode({ identifier: app.identifier, value: r.claimCode, expiresAt: r.expiresAt }); };
  const applyAssign = async e => { e.preventDefault(); const r = await run(() => api(`/admin/client-apps/${assign.id}/assign`, { method: 'POST', body: { partnerId: assign.partnerId, partnerCodeId: assign.partnerCodeId } }), 'Aplicativo atribuído.');
    if (r) setAssign(null); };
  return <section style={{ display: 'grid', gap: 16, minWidth: 0 }}>
    <h2>Apps da plataforma</h2><p className="muted">Cadastre aplicativos Roku, emita códigos de vinculação e atribua a parceiros com vagas disponíveis no plano.</p>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}
    <form className="card" style={{ padding: 16, display: 'grid', gap: 12 }} onSubmit={create}>
      <h3>Cadastrar aplicativo</h3>
      <label>Identificador<input required pattern="[a-z0-9][a-z0-9._-]{1,63}" maxLength={64} value={newApp.identifier} onChange={e => setNewApp({ ...newApp, identifier: e.target.value.toLowerCase() })} /></label>
      <label>Nome<input required maxLength={120} value={newApp.name} onChange={e => setNewApp({ ...newApp, name: e.target.value })} /></label>
      <button type="submit" className="btn primary" disabled={busy}>Cadastrar</button>
    </form>
    <div style={{ display: 'grid', gap: 12 }}>
      {apps.map(app => <article className="card" key={app.id} style={{ padding: 16, display: 'grid', gap: 10 }}>
        <strong>{app.name} · {app.identifier}</strong>
        <p className="muted">{app.status === 'active' ? 'Ativo' : 'Suspenso'} · Dono: {app.PartnerApp?.Partner?.name || 'Sem dono'}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="btn" disabled={busy} onClick={() => run(() => api(`/admin/client-apps/${app.id}`, { method: 'PATCH', body: { status: app.status === 'active' ? 'suspended' : 'active' } }), 'Status atualizado.')}>{app.status === 'active' ? 'Suspender' : 'Reativar'}</button>
          {!app.PartnerApp && <button type="button" className="btn" disabled={busy} onClick={() => newClaim(app)}>Gerar código de vinculação</button>}
          {!app.PartnerApp && <button type="button" className="btn" disabled={busy} onClick={() => setAssign({ id: app.id, partnerId: '', partnerCodeId: '' })}>Atribuir a parceiro</button>}
          {app.PartnerApp && <button type="button" className="btn" disabled={busy} onClick={() => { if (window.confirm('Desvincular app? Só será permitido se não houver TVs cadastradas.')) run(() => api(`/admin/client-apps/${app.id}/assign`, { method: 'DELETE' }), 'Vínculo removido.'); }}>Desvincular</button>}
        </div>
      </article>)}
    </div>
    {code && <div className="overlay"><div className="modal" role="dialog" aria-modal="true" aria-label="Código de vinculação" style={{ padding: 20, display: 'grid', gap: 12 }}>
      <h3>Código de vinculação de {code.identifier}</h3><p>Este código aparece apenas uma vez. Válido até {new Date(code.expiresAt).toLocaleString('pt-BR')}.</p>
      <code style={{ overflowWrap: 'anywhere' }}>{code.value}</code><button type="button" className="btn" onClick={() => navigator.clipboard.writeText(code.value)}>Copiar código</button>
      <button className="btn primary" onClick={() => setCode(null)}>Fechar</button></div></div>}
    {assign && <div className="overlay"><form className="modal" role="dialog" aria-modal="true" aria-label="Atribuir aplicativo" onSubmit={applyAssign} style={{ padding: 20, display: 'grid', gap: 12 }}>
      <h3>Atribuir a parceiro</h3><p className="muted">Informe os UUIDs reais do parceiro e do código pertencente a ele. O backend confere a posse e as vagas do plano.</p>
      <label>ID do parceiro<input required value={assign.partnerId} onChange={e => setAssign({ ...assign, partnerId: e.target.value })} /></label>
      <label>ID do código de parceiro<input required value={assign.partnerCodeId} onChange={e => setAssign({ ...assign, partnerCodeId: e.target.value })} /></label>
      <button type="button" className="btn" onClick={() => setAssign(null)}>Cancelar</button><button type="submit" className="btn primary" disabled={busy}>Atribuir</button></form></div>}
  </section>;
}
