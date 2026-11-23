import React, { useCallback, useEffect, useState } from 'react';

export default function ClientApps({ api, whiteLabel, onUpgrade }) {
  const [tab, setTab] = useState('own');
  const [state, setState] = useState({ data: [], slots: { used: 0, included: 0, available: 0 } });
  const [codes, setCodes] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const [apps, ownCodes] = await Promise.all([api('/partner/apps'), api('/partner/codes')]);
    setState(apps); setCodes((ownCodes.data || []).filter(code => code.status === 'active'));
  }, [api]);
  useEffect(() => { refresh().catch(e => setError(e.message)); }, [refresh]);
  const claim = async event => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await api('/partner/apps/claim', { method: 'POST', body: form });
      setForm(null); await refresh(); setNotice('Aplicativo vinculado à sua parceria.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const change = async (app, values) => {
    setBusy(true); setError(''); setNotice('');
    try { await api(`/partner/apps/${app.id}`, { method: 'PATCH', body: values }); await refresh(); setNotice('Aplicativo atualizado.'); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <section style={{ display: 'grid', gap: 16, minWidth: 0 }}>
    <header><h2>Meus Apps</h2><p className="muted">Aplicativos próprios da sua parceria e white-label de login Xtream.</p></header>
    <div role="tablist" aria-label="Tipos de aplicativo" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <button type="button" className={tab === 'own' ? 'btn primary' : 'btn'} role="tab" aria-selected={tab === 'own'} onClick={() => setTab('own')}>Aplicativos DeltaTV</button>
      <button type="button" className={tab === 'white' ? 'btn primary' : 'btn'} role="tab" aria-selected={tab === 'white'} onClick={() => setTab('white')}>White-label (login Xtream)</button>
    </div>
    {tab === 'white' ? whiteLabel : <>
      <p role="status">Vagas: <strong>{state.slots.used} / {state.slots.included}</strong> incluídas no plano.</p>
      {error && <p role="alert" className="error">{error}</p>}{notice && <p role="status">{notice}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {state.slots.available > 0
          ? <button type="button" className="btn primary" onClick={() => setForm({ identifier: '', claimCode: '', partnerCodeId: codes.length === 1 ? codes[0].id : '' })}>Adicionar App</button>
          : <><p className="muted">Seu plano não possui vagas livres para aplicativo próprio.</p><button type="button" className="btn" onClick={onUpgrade}>Ver upgrade</button></>}
      </div>
      <div style={{ display: 'grid', gap: 12 }}>
        {state.data.map(app => <article key={app.id} className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
          <strong>{app.name} <small>({app.identifier})</small></strong>
          <p className="muted">Status: {app.status === 'active' && app.appStatus === 'active' ? 'Ativo' : 'Pausado / suspenso'} · TVs: {app.tvs} · Código: {app.partnerCode}</p>
          <label>Código para novas vinculações
            <select value={app.partnerCodeId} disabled={busy} onChange={e => change(app, { partnerCodeId: e.target.value })}>
              {codes.map(code => <option key={code.id} value={code.id}>{code.code} · {code.label || 'Sem rótulo'}</option>)}
            </select>
          </label>
          <button type="button" className="btn" disabled={busy} onClick={() => change(app, { status: app.status === 'active' ? 'paused' : 'active' })}>{app.status === 'active' ? 'Pausar' : 'Retomar'}</button>
        </article>)}
        {!state.data.length && <p className="muted">Nenhum app vinculado a esta parceria.</p>}
      </div>
      {form && <div className="overlay" role="presentation"><form onSubmit={claim} role="dialog" aria-modal="true" aria-label="Adicionar App" className="modal" style={{ display: 'grid', gap: 12, padding: 20 }}>
        <h3>Adicionar App</h3>
        <label>Identificador do app<input required maxLength={64} value={form.identifier} onChange={e => setForm({ ...form, identifier: e.target.value.trim().toLowerCase() })}/></label>
        <label>Código de vinculação<input required autoComplete="off" value={form.claimCode} onChange={e => setForm({ ...form, claimCode: e.target.value })}/></label>
        <label>Código da sua parceria<select required value={form.partnerCodeId} onChange={e => setForm({ ...form, partnerCodeId: e.target.value })}><option value="">Selecione</option>{codes.map(code => <option value={code.id} key={code.id}>{code.code}</option>)}</select></label>
        <div style={{ display: 'flex', gap: 8 }}><button type="button" className="btn" disabled={busy} onClick={() => setForm(null)}>Cancelar</button><button type="submit" className="btn primary" disabled={busy}>Vincular app</button></div>
      </form></div>}
    </>}
  </section>;
}
