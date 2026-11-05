import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Modal, Field, useUi } from "../ui.jsx";
export default function PlatformDefaultsModal({ section, onClose, onSaved }) {
  const [form, setForm] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const { toast } = useUi();
  const load = async () => { try { const result = await api("/admin/platform-settings"); setForm(result[section]); setError(""); } catch (e) { setError(e.message); } };
  useEffect(() => { load(); }, [section]);
  const save = async event => {
    event.preventDefault(); if (busy || !form) return;
    setBusy(true); setError("");
    try { await api(`/admin/platform-settings/${section}`, { method: "PUT", body: form }); toast("Configurações gerais salvas."); onSaved?.(); onClose(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <Modal title={section === "trial" ? "Teste gratuito para novos dispositivos" : "Configurações gerais do PlayerWeb"} onClose={() => !busy && onClose()}>
    {error && <p className="error" role="alert">{error} {!form && <button className="btn" onClick={load}>Tentar novamente</button>}</p>}
    {!form ? <p className="muted">Carregando configurações…</p> : <form onSubmit={save}>
      {section === "trial" ? <>
        <label className="partner-invite-check"><input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} /><span>Conceder licença gratuita a cada novo dispositivo</span></label>
        <Field label="Duração do teste (dias)"><input type="number" min="1" max="365" required value={form.days} onChange={e => setForm({ ...form, days: e.target.value === "" ? "" : Number(e.target.value) })} /></Field>
        <p className="muted">Uma concessão por MAC, contada a partir do primeiro cadastro. O prazo vale para novos dispositivos; testes já concedidos mantêm o vencimento. O usuário adiciona a própria lista de conteúdo.</p>
      </> : <>
        <label className="partner-invite-check"><input type="checkbox" checked={form.autoHttps} onChange={e => setForm({ ...form, autoHttps: e.target.checked })} /><span>Usar HTTPS automaticamente nas URLs do parceiro</span></label>
        <p className="muted">Vale para todos os acessos do PlayerWeb por parceria. Converte HTTP para HTTPS, mantendo portas personalizadas. O provedor precisa oferecer HTTPS com certificado válido.</p>
        <h4>Entrega padrão para novos acessos</h4>
        {[["api","Catálogo"],["live","TV ao vivo"],["movie","Filmes"],["series","Séries"]].map(([key,label]) => <Field key={key} label={label}><select value={form.deliveryModes[key]} onChange={e => setForm({ ...form, deliveryModes: { ...form.deliveryModes, [key]: e.target.value } })}><option value="proxy">Proxy</option><option value="redirect">Redirecionamento</option></select></Field>)}
        <p className="muted">Os modos são usados nos novos acessos e ao restaurar a entrega padrão. As escolhas de entrega já personalizadas permanecem.</p>
      </>}
      <div className="actions"><button type="button" className="btn" disabled={busy} onClick={onClose}>Cancelar</button><button className="btn primary" disabled={busy}>{busy ? "Salvando…" : "Salvar configurações"}</button></div>
    </form>}
  </Modal>;
}
