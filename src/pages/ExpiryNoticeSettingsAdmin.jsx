import { useEffect, useState } from 'react';
import { api } from '../api.js';

const initial = {
  enabled: false, daysBefore: 3, messageMode: 'service',
  customBefore: 'Seu acesso vence em {prazo}.', customToday: 'Seu acesso vence hoje.',
};
const preview = (form, days) => {
  if (form.messageMode === 'custom') {
    return (days === 0 ? form.customToday : form.customBefore)
      .replace(/\{prazo\}/g, `${days} ${days === 1 ? 'dia' : 'dias'}`)
      .replace(/\{dias\}/g, String(days)).replace(/\{data\}/g, '15/11/2026');
  }
  const plural = form.messageMode === 'channels';
  if (days === 0) return plural ? 'Seus canais vencem hoje.' : 'Seu serviço vence hoje.';
  return `${plural ? 'Seus canais vencem' : 'Seu serviço vence'} em ${days} ${days === 1 ? 'dia' : 'dias'}.`;
};

/** Uma regra por revenda, sem precisar configurar cada cliente individualmente. */
export default function ExpiryNoticeSettingsAdmin({ partnerId, canWrite = false }) {
  const [form, setForm] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const set = (key, value) => setForm(s => ({ ...s, [key]: value }));
  useEffect(() => {
    setLoading(true); setMessage(''); setError(''); setForm(initial);
    let alive = true;
    api(`/admin/clients/expiry-notice-settings/${partnerId}`)
      .then(v => { if (alive) setForm({ ...initial, ...v }); })
      .catch(e => { if (alive) setError(e.message || 'Falha ao carregar configuração.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [partnerId]);
  const submit = async (event) => {
    event.preventDefault();
    if (!canWrite) return;
    setError(''); setMessage(''); setSaving(true);
    try {
      const saved = await api(`/admin/clients/expiry-notice-settings/${partnerId}`, { method: 'PUT', body: form });
      setForm({ ...initial, ...saved });
      setMessage('Regra atualizada. O portal da parceria ou revenda verá as mesmas preferências.');
    } catch (e) { setError(e.message || 'Falha ao salvar a regra.'); }
    finally { setSaving(false); }
  };
  return (
    <section className="card" style={{ marginBottom: 18 }} aria-label="Avisos de vencimento nas TVs">
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>Avisos de vencimento na TV</h3>
          <p className="muted" style={{ margin: '5px 0 0' }}>Uma regra para todos os clientes desta parceria ou revenda. O aviso usa o vencimento da ficha do cliente, não o da licença DeltaTV.</p>
        </div>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      {message && <p role="status" style={{ color: 'var(--ok, #22865d)' }}>{message}</p>}
      {loading ? <p className="muted">Carregando preferências…</p> : (
        <form onSubmit={submit} style={{ marginTop: 14 }}>
          <fieldset disabled={!canWrite || saving} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
            <input type="checkbox" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} />
            <strong>Exibir avisos de vencimento nas TVs</strong>
          </label>
          <div className="row" style={{ gap: 15 }}>
            <label className="field" style={{ flex: '1 1 180px' }}>
              <span>Começar a avisar com quantos dias de antecedência?</span>
              <input type="number" min="1" max="30" step="1" value={form.daysBefore}
                onChange={e => set('daysBefore', Math.min(30, Math.max(1, Number(e.target.value) || 1)))} />
            </label>
            <label className="field" style={{ flex: '2 1 200px' }}>
              <span>Texto do aviso</span>
              <select value={form.messageMode} onChange={e => set('messageMode', e.target.value)}>
                <option value="service">Padrão: Serviço</option>
                <option value="channels">Padrão: Canais</option>
                <option value="custom">Personalizado por revenda</option>
              </select>
            </label>
          </div>
          {form.messageMode === 'custom' && (
            <div className="row" style={{ gap: 15, marginTop: 10 }}>
              <label className="field" style={{ flex: '1 1 220px' }}>
                <span>Mensagem antes do vencimento</span>
                <input type="text" required maxLength={180} value={form.customBefore}
                  onChange={e => set('customBefore', e.target.value)} />
              </label>
              <label className="field" style={{ flex: '1 1 220px' }}>
                <span>Mensagem no dia do vencimento</span>
                <input type="text" required maxLength={180} value={form.customToday}
                  onChange={e => set('customToday', e.target.value)} />
              </label>
              <p className="muted" style={{ width: '100%', fontSize: 12 }}>
                Variáveis disponíveis: {'{prazo}'} (3 dias/1 dia), {'{dias}'} (número) e {'{data}'} (data do vencimento).
              </p>
            </div>
          )}
          <div style={{ margin: '14px 0', padding: 14, border: '1px solid var(--border, #444)', borderRadius: 8 }}>
            <strong>Prévia no aplicativo</strong>
            <p style={{ margin: '8px 0' }}>{preview(form, Math.min(form.daysBefore, 3))}</p>
            <p className="muted" style={{ margin: 0 }}>No dia: {preview(form, 0)}</p>
          </div>
          {canWrite
            ? <div className="actions"><button type="submit" className="btn primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar configurações desta empresa'}</button></div>
            : <p className="muted">Seu perfil tem acesso somente à leitura dessas configurações.</p>}
          <p className="muted" style={{ fontSize: 12 }}>A regra é compartilhada com o portal da empresa selecionada e aplica-se exclusivamente aos clientes vinculados a ela. Avisos não interrompem a reprodução. TVs antigas sem suporte continuam funcionando normalmente.</p>
          </fieldset>
        </form>
      )}
    </section>
  );
}
