import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { Field, Modal, fmtDateTime, useUi } from "../ui.jsx";

const STATUS = { draft: "Aguardando envio", invited: "Convite enviado", completed: "Cadastro concluído", cancelled: "Cancelado" };
export default function PartnerPreRegistrations() {
  const { toast, confirm } = useUi();
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const load = useCallback(async () => {
    try { const r = await api("/admin/partners/pre-registrations"); setItems(r.data || []); setError(""); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const submit = async (event) => {
    event.preventDefault(); if (busy) return;
    setBusy(true);
    try {
      const r = await api("/admin/partners/pre-registrations", { method: "POST", body: { name: name.trim(), email: email.trim().toLowerCase(), sendEmail } });
      toast(r.warning || (r.emailSent ? "Pré-cadastro salvo. Convite enviado por e-mail." : "Pré-cadastro salvo, sem enviar e-mail."), r.warning ? "bad" : "ok");
      setOpen(false); setName(""); setEmail(""); setSendEmail(false);
      await load();
    } catch (e) { toast(e.message, "bad"); }
    finally { setBusy(false); }
  };
  const send = async (item) => {
    if (busy) return; setBusy(true);
    try {
      await api(`/admin/partners/pre-registrations/${item.id}/send`, { method: "POST" });
      toast(`Convite enviado para ${item.email}.`); await load();
    } catch (e) { toast(e.message, "bad"); }
    finally { setBusy(false); }
  };
  const cancel = async (item) => {
    const ok = await confirm({ title: "Cancelar pré-cadastro", message: `Cancelar o convite de ${item.name}? O link enviado deixará de funcionar.`, danger: true });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/admin/partners/pre-registrations/${item.id}/cancel`, { method: "POST" });
      toast("Pré-cadastro cancelado."); await load();
    } catch (e) { toast(e.message, "bad"); }
    finally { setBusy(false); }
  };
  return <section className="partner-invite-section">
    <div className="partner-invite-header">
      <div><h3>Pré-cadastro de parceiros</h3><p className="muted">Envie um convite para que o parceiro defina a própria senha. Sem criar uma conta antes da confirmação.</p></div>
      <button className="btn primary" type="button" onClick={() => setOpen(true)}>+ Pré-cadastro</button>
    </div>
    {error && <p className="muted" role="alert">{error} <button type="button" className="btn" onClick={load}>Tentar novamente</button></p>}
    {loading ? <p className="muted">Carregando convites…</p> : items.length ? <div className="partner-invite-list">
      {items.map((item) => {
        const expired = item.status === "invited" && item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now();
        return <div className="partner-invite-item" key={item.id}>
          <div className="partner-invite-person"><strong>{item.name}</strong><span>{item.email}</span><small>Criado em {fmtDateTime(item.createdAt)}{item.emailSentAt ? ` · E-mail enviado ${fmtDateTime(item.emailSentAt)}` : ""}</small></div>
          <div className="partner-invite-side">
            <span className={`badge ${item.status === "completed" ? "ok" : item.status === "cancelled" ? "muted" : expired ? "warn" : "info"}`}>{expired ? "Convite expirado" : STATUS[item.status] || item.status}</span>
            {!["completed", "cancelled"].includes(item.status) && <div className="partner-invite-actions">
              <button type="button" className="btn" disabled={busy} onClick={() => send(item)}>{item.emailSentAt ? "Reenviar" : "Enviar convite"}</button>
              <button type="button" className="btn" disabled={busy} onClick={() => cancel(item)}>Cancelar</button>
            </div>}
          </div>
        </div>;
      })}
    </div> : <p className="muted">Nenhum pré-cadastro realizado.</p>}
    {open && <Modal title="Pré-cadastrar parceiro" onClose={() => !busy && setOpen(false)}>
      <form onSubmit={submit}>
        <Field label="Nome do responsável"><input autoFocus required minLength={2} maxLength={160} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" /></Field>
        <Field label="E-mail"><input type="email" required maxLength={200} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="parceiro@empresa.com.br" /></Field>
        <label className="partner-invite-check"><input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} /> <span>Enviar e-mail agora para o parceiro concluir o cadastro</span></label>
        <p className="muted">O convite dura 72 horas. O parceiro informará o nome da empresa e criará a senha. O contrato e os códigos serão configurados depois pelo administrador.</p>
        <div className="actions"><button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>Cancelar</button><button type="submit" className="btn primary" disabled={busy}>{busy ? "Salvando…" : "Criar pré-cadastro"}</button></div>
      </form>
    </Modal>}
  </section>;
}
