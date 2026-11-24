import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

export default function ClientApps() {
  const [apps, setApps] = useState([]);
  const defaultTheme = { background: '#02030A', panel: '#070D24', primary: '#1F4BFF', text: '#F2F6FF', muted: '#A9BCD6' };
  const [newApp, setNewApp] = useState({ identifier: '', name: '', status: 'active', logoUrl: '', theme: defaultTheme });
  const [brand, setBrand] = useState(null);
  const [assign, setAssign] = useState(null);
  const [code, setCode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [partnerQuery, setPartnerQuery] = useState('');
  const [partnerOptions, setPartnerOptions] = useState([]);
  const [codeOptions, setCodeOptions] = useState([]);
  const refresh = useCallback(() => api('/admin/client-apps').then(r => setApps(r.data || [])).catch(e => setError(e.message)), []);
  // Atribuição sem digitar UUID: busca o parceiro pelo nome e escolhe o código numa lista.
  useEffect(() => {
    if (!assign) return undefined;
    const timer = setTimeout(() => {
      const q = partnerQuery.trim();
      api(`/admin/partners?pageSize=30&status=active${q ? `&q=${encodeURIComponent(q)}` : ''}`)
        .then(r => setPartnerOptions(r.data || [])).catch(() => setPartnerOptions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [assign, partnerQuery]);
  useEffect(() => {
    if (!assign?.partnerId) { setCodeOptions([]); return; }
    api(`/admin/partners/${assign.partnerId}/codes`)
      .then(r => setCodeOptions((r.data || []).filter(c => c.status === 'active')))
      .catch(() => setCodeOptions([]));
  }, [assign?.partnerId]);
  useEffect(() => { void refresh(); }, [refresh]);
  const run = async (work, notice) => {
    setBusy(true); setError(''); setMessage('');
    try { const r = await work(); await refresh(); setMessage(notice); return r; }
    catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  };
  const create = async e => { e.preventDefault(); const r = await run(() => api('/admin/client-apps', { method: 'POST', body: { ...newApp, logoUrl: newApp.logoUrl || null } }), 'Aplicativo cadastrado.');
    if (r) setNewApp({ identifier: '', name: '', status: 'active', logoUrl: '', theme: defaultTheme }); };
  const newClaim = async app => { const r = await run(() => api(`/admin/client-apps/${app.id}/claim-code`, { method: 'POST', body: { expiresMinutes: 1440 } }), 'Código de vinculação emitido. Copie agora.');
    if (r) setCode({ identifier: app.identifier, value: r.claimCode, expiresAt: r.expiresAt }); };
  const applyAssign = async e => { e.preventDefault(); const r = await run(() => api(`/admin/client-apps/${assign.id}/assign`, { method: 'POST', body: { partnerId: assign.partnerId, partnerCodeId: assign.partnerCodeId } }), 'Aplicativo atribuído.');
    if (r) setAssign(null); };
  return <section style={{ display: 'grid', gap: 16, minWidth: 0 }}>
    <h2>Apps da plataforma</h2><p className="muted">Aplicativo Roku próprio de um parceiro (ex.: Dream Player). Siga os 3 passos abaixo.</p>
    <ol className="card" aria-label="Como cadastrar um app para um parceiro" style={{ padding: '16px 16px 16px 36px', display: 'grid', gap: 10, margin: 0 }}>
      <li><strong>Cadastre o app</strong> no formulário abaixo. O <em>identificador</em> precisa ser <strong>exatamente igual</strong> ao valor de <code>DeltaAppId()</code> no arquivo <code>source/Config.brs</code> do app Roku (ex.: <code>dreamplayer</code>). Se for diferente, as TVs recebem “Aplicativo indisponível”.</li>
      <li><strong>Entregue o app ao parceiro</strong>, de um destes dois jeitos: <strong>(a) Atribuir a parceiro</strong> — você escolhe o parceiro e o código dele na lista (direto, 1 clique); ou <strong>(b) Gerar código de vinculação</strong> — você envia o identificador e o código ao parceiro, que cola em <em>Meus Apps → Adicionar App</em> no painel dele. O parceiro precisa ter uma vaga de app no plano.</li>
      <li><strong>Pronto.</strong> As TVs que instalarem o app informam usuário e senha do provedor e entram pelo código do parceiro. O app só fala com o servidor por <strong>WebSocket</strong>; HTTP é usado apenas para catálogo e para Roku antigo.</li>
    </ol>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}
    <form className="card" style={{ padding: 16, display: 'grid', gap: 12 }} onSubmit={create}>
      <h3>Cadastrar aplicativo</h3>
      <label>Identificador (igual ao DeltaAppId() do app Roku)<input required placeholder="dreamplayer" pattern="[a-z0-9][a-z0-9._-]{1,63}" maxLength={64} value={newApp.identifier} onChange={e => setNewApp({ ...newApp, identifier: e.target.value.toLowerCase() })} /><small className="muted">Só letras minúsculas, números, ponto, hífen e sublinhado. Não use “roku” nem “delta-tv-roku” (reservados). Não pode ser alterado depois.</small></label>
      <label>Nome<input required maxLength={120} value={newApp.name} onChange={e => setNewApp({ ...newApp, name: e.target.value })} /></label>
      <label>URL HTTPS da logo (página pública)<input type="url" placeholder="https://…/logo.png" value={newApp.logoUrl} onChange={e => setNewApp({ ...newApp, logoUrl: e.target.value })} /></label>
      <fieldset><legend>Cores da página pública</legend><div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {Object.entries(newApp.theme).map(([key, value]) => <label key={key} style={{ minWidth: 100 }}>{key}<input type="color" value={value} onChange={e => setNewApp({ ...newApp, theme: { ...newApp.theme, [key]: e.target.value } })} /></label>)}
      </div></fieldset>
      <button type="submit" className="btn primary" disabled={busy}>Cadastrar</button>
    </form>
    <div style={{ display: 'grid', gap: 12 }}>
      {apps.map(app => <article className="card" key={app.id} style={{ padding: 16, display: 'grid', gap: 10 }}>
        <strong>{app.name} · {app.identifier}</strong>
        <p className="muted">{app.status === 'active' ? 'Ativo' : 'Suspenso'} · {app.PartnerApp ? `Em uso por ${app.PartnerApp.Partner?.name || 'parceiro'}` : 'Aguardando parceiro (use “Atribuir a parceiro” ou gere um código de vinculação)'}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" className="btn" disabled={busy} onClick={() => setBrand({ id: app.id, name: app.name, logoUrl: app.logoUrl || '', theme: app.theme || defaultTheme })}>Editar identidade visual</button>
          <button type="button" className="btn" disabled={busy} onClick={() => run(() => api(`/admin/client-apps/${app.id}`, { method: 'PATCH', body: { status: app.status === 'active' ? 'suspended' : 'active' } }), 'Status atualizado.')}>{app.status === 'active' ? 'Suspender' : 'Reativar'}</button>
          {!app.PartnerApp && <button type="button" className="btn" disabled={busy} onClick={() => newClaim(app)}>Gerar código de vinculação</button>}
          {!app.PartnerApp && <button type="button" className="btn" disabled={busy} onClick={() => { setPartnerQuery(''); setAssign({ id: app.id, partnerId: '', partnerCodeId: '' }); }}>Atribuir a parceiro</button>}
          {app.PartnerApp && <button type="button" className="btn" disabled={busy} onClick={() => { if (window.confirm('Desvincular app? Só será permitido se não houver TVs cadastradas.')) run(() => api(`/admin/client-apps/${app.id}/assign`, { method: 'DELETE' }), 'Vínculo removido.'); }}>Desvincular</button>}
        </div>
      </article>)}
    </div>
    {brand && <div className="overlay"><form className="modal" role="dialog" aria-modal="true" aria-label="Editar identidade visual" onSubmit={async e => {
      e.preventDefault(); const result = await run(() => api(`/admin/client-apps/${brand.id}`, { method: 'PATCH', body: { name: brand.name, logoUrl: brand.logoUrl || null, theme: brand.theme } }), 'Identidade visual atualizada.');
      if (result) setBrand(null);
    }} style={{ padding: 20, display: 'grid', gap: 12 }}>
      <h3>Identidade visual pública</h3>
      <label>Nome<input required maxLength={120} value={brand.name} onChange={e => setBrand({ ...brand, name: e.target.value })} /></label>
      <label>URL HTTPS da logo<input type="url" value={brand.logoUrl} onChange={e => setBrand({ ...brand, logoUrl: e.target.value })} /></label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {Object.entries(brand.theme).map(([key, value]) => <label key={key}>{key}<input type="color" value={value} onChange={e => setBrand({ ...brand, theme: { ...brand.theme, [key]: e.target.value } })} /></label>)}
      </div>
      <button type="button" className="btn" onClick={() => setBrand(null)}>Cancelar</button>
      <button type="submit" className="btn primary" disabled={busy}>Salvar identidade</button>
    </form></div>}
    {code && <div className="overlay"><div className="modal" role="dialog" aria-modal="true" aria-label="Código de vinculação" style={{ padding: 20, display: 'grid', gap: 12 }}>
      <h3>Código de vinculação de {code.identifier}</h3><p>Este código aparece apenas uma vez. Válido até {new Date(code.expiresAt).toLocaleString('pt-BR')}.</p>
      <code style={{ overflowWrap: 'anywhere' }}>{code.value}</code><button type="button" className="btn" onClick={() => navigator.clipboard.writeText(code.value)}>Copiar código</button>
      <button className="btn primary" onClick={() => setCode(null)}>Fechar</button></div></div>}
    {assign && <div className="overlay"><form className="modal" role="dialog" aria-modal="true" aria-label="Atribuir aplicativo" onSubmit={applyAssign} style={{ padding: 20, display: 'grid', gap: 12 }}>
      <h3>Atribuir a parceiro</h3><p className="muted">Escolha o parceiro e o código dele que receberá as TVs deste app. O servidor confere a posse do código e as vagas do plano.</p>
      <label>Buscar parceiro<input placeholder="Digite parte do nome" value={partnerQuery} onChange={e => setPartnerQuery(e.target.value)} /></label>
      <label>Parceiro<select required value={assign.partnerId} onChange={e => setAssign({ ...assign, partnerId: e.target.value, partnerCodeId: '' })}>
        <option value="">Selecione</option>{partnerOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label>Código do parceiro<select required disabled={!assign.partnerId} value={assign.partnerCodeId} onChange={e => setAssign({ ...assign, partnerCodeId: e.target.value })}>
        <option value="">{assign.partnerId ? (codeOptions.length ? 'Selecione' : 'Este parceiro não tem código ativo') : 'Escolha o parceiro primeiro'}</option>
        {codeOptions.map(c => <option key={c.id} value={c.id}>{c.code}{c.label ? ` · ${c.label}` : ''}</option>)}</select></label>
      <button type="button" className="btn" onClick={() => setAssign(null)}>Cancelar</button><button type="submit" className="btn primary" disabled={busy || !assign.partnerCodeId}>Atribuir</button></form></div>}
  </section>;
}
