import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { Field, Modal, Pager, fmtDateTime, useUi } from "../ui.jsx";

const STATUS = { draft: "Aguardando envio", invited: "Convite enviado", completed: "Aguardando configuração", cancelled: "Cancelado" };
export default function PartnerPreRegistrations({ onOpenPartner, onRefresh, refreshKey }) {
  const { toast, confirm } = useUi();
  const [managerOpen, setManagerOpen] = useState(false);
  const [view, setView] = useState("pending");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState(null);
  const [summary, setSummary] = useState({ pending: 0, history: 0, ready: 0 });
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    setLoading(true);
    try {
      const r = await api("/admin/partners/pre-registrations", { query: { view, page, pageSize: 8 } });
      if (current === sequence.current) {
        if (page > (r.meta?.totalPages || 1)) { setPage(r.meta?.totalPages || 1); return; }
        setItems(r.data || []); setMeta(r.meta); setSummary(r.summary); setError("");
      }
    } catch (e) { if (current === sequence.current) setError(e.message); }
    finally { if (current === sequence.current) setLoading(false); }
  }, [view, page]);
  useEffect(() => {
    load();
    const refresh = (event) => {
      const message = event?.detail;
      if (document.hidden || (event?.type === "realtime-change" &&
        (message?.type !== "changed" || !["partners", "data"].includes(message.topic)))) return;
      load();
    };
    const timer = setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("realtime-change", refresh);
    window.addEventListener("realtime-ready", refresh);
    return () => {
      ++sequence.current;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("realtime-change", refresh);
      window.removeEventListener("realtime-ready", refresh);
    };
  }, [load, refreshKey]);
  const submit = async (event) => {
    event.preventDefault(); if (busy) return;
    setBusy(true);
    try {
      const r = await api("/admin/partners/pre-registrations", { method: "POST", body: { name: name.trim(), email: email.trim().toLowerCase(), sendEmail } });
      toast(r.warning || (r.emailSent ? "Pré-cadastro salvo. Convite enviado por e-mail." : "Pré-cadastro salvo, sem enviar e-mail."), r.warning ? "bad" : "ok");
      setOpen(false); setName(""); setEmail(""); setSendEmail(false);
      setView("pending"); setPage(1); setManagerOpen(true);
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
  const finish = async (item) => {
    if (busy) return; setBusy(true);
    try {
      await api(`/admin/partners/pre-registrations/${item.id}/finish`, { method: "POST" });
      toast("Configuração concluída. O parceiro continua disponível na lista de parceiros.");
      await load(); onRefresh?.();
    } catch (e) { toast(e.message, "bad"); }
    finally { setBusy(false); }
  };
  const openPartner = (id) => { setManagerOpen(false); onOpenPartner(id); };
  return <section className="partner-onboarding">
    <div className="partner-onboarding-copy">
      <strong>Convites e pré-cadastros <span className="badge info">{summary.pending}</span></strong>
      <span className="muted">{loading && !meta ? "Carregando pendências…" : summary.pending
        ? `${summary.pending} pendente(s) · ${summary.ready} aguardando configuração`
        : "Nenhum pré-cadastro pendente"}</span>
      {error && <span className="error" role="alert">{error}</span>}
    </div>
    <div className="partner-onboarding-actions">
      <button className="btn" type="button" onClick={() => { setView("pending"); setPage(1); setManagerOpen(true); load(); }}>Gerenciar convites</button>
      <button className="btn" type="button" onClick={() => setOpen(true)}>+ Pré-cadastro</button>
    </div>
    {managerOpen && <Modal title="Convites e pré-cadastros" onClose={() => setManagerOpen(false)} wide>
      <p className="muted">Após salvar as condições ou o contrato, a parceria sai das pendências e permanece na lista de parceiros.</p>
      <div className="partner-invite-header">
        <div className="tabs" role="tablist" aria-label="Situação dos pré-cadastros">
          <button type="button" role="tab" aria-selected={view === "pending"} className={`tab ${view === "pending" ? "active" : ""}`} onClick={() => { setView("pending"); setPage(1); }}>Pendentes ({summary.pending})</button>
          <button type="button" role="tab" aria-selected={view === "history"} className={`tab ${view === "history" ? "active" : ""}`} onClick={() => { setView("history"); setPage(1); }}>Histórico ({summary.history})</button>
        </div>
        <button className="btn" type="button" disabled={loading} onClick={() => { load(); onRefresh?.(); }}>Atualizar</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="partner-invite-scroll" aria-busy={loading}>
      {loading ? <p className="muted">Carregando convites…</p> : items.length ? <div className="partner-invite-list">
        {items.map((item) => {
          const expired = item.status === "invited" && item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now();
          return <div className="partner-invite-item" key={item.id}>
            <div className="partner-invite-person"><strong>{item.name}</strong><span>{item.email}</span>
              <small>{item.configuredAt ? `Configurado em ${fmtDateTime(item.configuredAt)}` : `Criado em ${fmtDateTime(item.createdAt)}`}</small>
            </div>
            <div className="partner-invite-side">
              <span className={`badge ${item.configuredAt ? "ok" : item.status === "cancelled" ? "muted" : item.status === "completed" || expired ? "warn" : "info"}`}>{item.configuredAt ? "Configurado" : expired ? "Convite expirado" : STATUS[item.status] || item.status}</span>
              {item.status === "completed" && item.completedPartnerId && <div className="partner-invite-actions">
                <button type="button" className="btn primary" onClick={() => openPartner(item.completedPartnerId)}>{item.configuredAt ? "Abrir parceria" : "Configurar parceria"}</button>
                {!item.configuredAt && <button type="button" className="btn" disabled={busy} onClick={() => finish(item)}>Concluir configuração</button>}
              </div>}
              {!["completed", "cancelled"].includes(item.status) && <div className="partner-invite-actions">
                <button type="button" className="btn" disabled={busy} onClick={() => send(item)}>{item.emailSentAt ? "Reenviar" : "Enviar convite"}</button>
                <button type="button" className="btn" disabled={busy} onClick={() => cancel(item)}>Cancelar</button>
              </div>}
            </div>
          </div>;
        })}
      </div> : <div className="partner-invite-empty"><strong>{view === "pending" ? "Tudo em dia" : "Histórico vazio"}</strong><p className="muted">{view === "pending" ? "Nenhum convite ou configuração pendente. Os parceiros configurados estão na lista principal." : "Os pré-cadastros configurados e cancelados aparecerão aqui."}</p></div>}
      </div>
      {!loading && meta?.totalPages > 1 && <Pager meta={meta} onPage={setPage} />}
    </Modal>}
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
