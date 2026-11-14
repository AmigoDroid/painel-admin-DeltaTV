import React, { useEffect, useState } from "react";

import "./profile.css";

const WHEN = value => value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
const DEFAULT_PREFS = { showUnreadBanner: true, showNotificationBadge: true };
const TABS = [
  ["dados", "Dados pessoais"], ["seguranca", "Segurança"], ["sessoes", "Sessões ativas"],
  ["historico", "Histórico"], ["preferencias", "Notificações"],
];
const field = (name, props = {}) => <input id={props.id || name} name={name} {...props} />;
const message = (text, isError = false) => text && <p className={`profile-feedback ${isError ? "profile-error" : "profile-success"}`} role={isError ? "alert" : "status"}>{text}</p>;

function imageData(file) {
  return new Promise((resolve, reject) => {
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 6 * 1024 * 1024) {
      reject(new Error("Selecione uma foto JPG, PNG ou WebP de até 6 MB.")); return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Não foi possível preparar a imagem.")); return; }
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 256, 256);
      const side = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
      for (const quality of [0.8, 0.65, 0.5, 0.35]) {
        const value = canvas.toDataURL("image/jpeg", quality);
        if (value.length < 125000) { resolve(value); return; }
      }
      reject(new Error("A foto ficou muito grande. Tente outra imagem."));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível abrir a imagem.")); };
    img.src = url;
  });
}

function PaginatedRecords({ endpoint, render, title, api }) {
  const [page, setPage] = useState(1), [payload, setPayload] = useState(null), [error, setError] = useState(""), [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    api(endpoint, { query: { page, limit: 10 } }).then(data => { if (live) { setPayload(data); setError(""); } })
      .catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [endpoint, page, tick]);
  const meta = payload?.meta || { page, pages: 1 };
  return <section className="profile-card"><div className="profile-section-header"><h3>{title}</h3><button type="button" className="profile-button ghost" onClick={() => setTick(v => v + 1)}>Atualizar</button></div>
    {message(error, true)}<div className="profile-records">{(payload?.data || []).map(render)}{payload && !payload.data?.length && <p className="profile-hint">Nenhum registro encontrado.</p>}</div>
    <div className="profile-pager"><button type="button" className="profile-button ghost" disabled={page <= 1} onClick={() => setPage(v => v - 1)}>Anterior</button><span>Página {page} de {Math.max(1, meta.pages || 1)}</span><button type="button" className="profile-button ghost" disabled={page >= (meta.pages || 1)} onClick={() => setPage(v => v + 1)}>Próxima</button></div>
  </section>;
}

export default function ProfilePage({ variant = "revenda", api, logout, updateAuthUser = () => {} }) {
  const [account, setAccount] = useState(null), [tab, setTab] = useState("dados"), [form, setForm] = useState({ name: "", phone: "" });
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const [pwd, setPwd] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [emailForm, setEmailForm] = useState({ email: "", currentPassword: "" });
  const [sessionsTick, setSessionsTick] = useState(0);
  const [sessionPage, setSessionPage] = useState(1), [sessions, setSessions] = useState(null), [sessionError, setSessionError] = useState("");
  const [preferences, setPreferences] = useState(DEFAULT_PREFS);
  const notify = (next) => window.dispatchEvent(new CustomEvent("profile-updated", { detail: next }));
  const load = async () => {
    const data = await api("/auth/profile");
    setAccount(data); setForm({ name: data.user.name || "", phone: data.profile.phone || "" });
    setEmailForm({ email: data.user.email || "", currentPassword: "" });
    setPreferences({ showUnreadBanner: data.profile.showUnreadBanner, showNotificationBadge: data.profile.showNotificationBadge });
    notify(data);
  };
  useEffect(() => { let live = true; api("/auth/profile").then(data => { if (!live) return;
    setAccount(data); setForm({ name: data.user.name || "", phone: data.profile.phone || "" });
    setEmailForm({ email: data.user.email || "", currentPassword: "" });
    setPreferences({ showUnreadBanner: data.profile.showUnreadBanner, showNotificationBadge: data.profile.showNotificationBadge });
    notify(data);
  }).catch(e => { if (live) setError(e.message); }); return () => { live = false; }; }, []);
  useEffect(() => {
    if (tab !== "sessoes") return;
    let live = true;
    api("/auth/profile/sessions", { query: { page: sessionPage, limit: 10 } }).then(data => { if (live) { setSessions(data); setSessionError(""); } }).catch(e => { if (live) setSessionError(e.message); });
    return () => { live = false; };
  }, [tab, sessionPage, sessionsTick]);
  const run = async (action, ok) => { setBusy(true); setError(""); setSuccess(""); try { await action(); if (ok) setSuccess(ok); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const submitProfile = e => { e.preventDefault(); void run(async () => {
    const data = await api("/auth/profile", { method: "PATCH", body: { name: form.name.trim(), phone: form.phone.trim() || null } });
    updateAuthUser(data.user); await load();
  }, "Dados pessoais atualizados."); };
  const submitEmail = e => { e.preventDefault(); void run(async () => {
    const result = await api("/auth/profile/email", { method: "POST", body: emailForm });
    if (result.reauthenticationRequired) { await logout(); location.reload(); return; }
    setEmailForm(s => ({ ...s, currentPassword: "" }));
  }, "E-mail confirmado. Se alterado, entre novamente com o novo endereço."); };
  const submitPassword = e => { e.preventDefault(); if (pwd.newPassword !== pwd.confirmPassword) { setError("A confirmação não coincide com a nova senha."); return; }
    void run(async () => { await api("/auth/change-password", { method: "POST", body: { currentPassword: pwd.currentPassword, newPassword: pwd.newPassword } }); await logout(); location.reload(); }, "Senha alterada."); };
  const sendReset = () => void run(() => api("/auth/password-reset/send-self", { method: "POST" }), "Link de redefinição enviado para o e-mail cadastrado.");
  const updateAvatar = file => { if (!file) return; void run(async () => {
    const avatarData = await imageData(file);
    await api("/auth/profile/avatar", { method: "PATCH", body: { avatarData } });
    await load();
  }, "Foto do perfil atualizada."); };
  const removeAvatar = () => void run(async () => { await api("/auth/profile/avatar", { method: "PATCH", body: { avatarData: null } }); await load(); }, "Foto removida.");
  const updatePreferences = () => void run(async () => { await api("/auth/profile/preferences", { method: "PATCH", body: preferences });
    const refreshed = { ...account, profile: { ...account.profile, ...preferences } }; setAccount(refreshed); notify(refreshed);
  }, "Preferências de exibição salvas.");
  const revokeSession = id => { if (!confirm("Desconectar esta sessão?")) return; void run(async () => {
    const result = await api(`/auth/profile/sessions/${id}`, { method: "DELETE" });
    if (result.currentSessionRevoked) { await logout(); location.reload(); return; }
    setSessionsTick(v => v + 1);
  }, "Sessão encerrada."); };
  const revokeOthers = () => { if (!confirm("Desconectar todos os outros aparelhos?")) return; void run(async () => {
    await api("/auth/profile/sessions/revoke-others", { method: "POST" }); setSessionPage(1); setSessionsTick(v => v + 1);
  }, "Outras sessões encerradas."); };
  if (!account) return <div className="profile-card" role="status">{error || "Carregando perfil…"}</div>;
  const { user, partner, profile } = account;
  return <div className="profile-root">
    <div className="profile-hero"><span className="profile-avatar big">{profile.avatarData ? <img src={profile.avatarData} alt="Sua foto de perfil" /> : (user.name?.[0] || "D").toUpperCase()}</span>
      <div className="profile-hero-details"><strong>{user.name}</strong><span>{user.email}</span><small>{partner.name} · {variant === "admin" ? "Administração" : variant === "parceiro" ? "Parceiro de conteúdo" : "Revenda"}</small></div>
      <span className="profile-state">{partner.status === "active" ? "Conta ativa" : partner.status}</span>
    </div>
    <nav className="profile-tabs" aria-label="Áreas do perfil">{TABS.map(([id, text]) => <button type="button" key={id} className={tab === id ? "selected" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => { setTab(id); setError(""); setSuccess(""); }}>{text}</button>)}</nav>
    {message(error, true)}{message(success)}
    {tab === "dados" && <div className="profile-grid">
      <form className="profile-card" onSubmit={submitProfile}><h3>Informações pessoais</h3><p className="profile-hint">Dados pessoais desta conta de acesso. As condições comerciais são gerenciadas separadamente.</p>
        <label htmlFor="profile-name">Nome completo</label>{field("name", { id: "profile-name", maxLength: 160, minLength: 2, required: true, value: form.name, onChange: e => setForm(v => ({ ...v, name: e.target.value })) })}
        <label htmlFor="profile-phone">Telefone de contato</label>{field("phone", { id: "profile-phone", type: "tel", maxLength: 40, value: form.phone, onChange: e => setForm(v => ({ ...v, phone: e.target.value })) })}
        <label htmlFor="profile-email-current">E-mail da conta</label>{field("email", { id: "profile-email-current", type: "email", disabled: true, value: user.email, readOnly: true })}
        <button className="profile-button primary" disabled={busy}>Salvar dados</button></form>
      <section className="profile-card"><h3>Foto de perfil</h3><div className="profile-photo-row"><span className="profile-avatar preview">{profile.avatarData ? <img src={profile.avatarData} alt="Foto atual" /> : (user.name?.[0] || "D").toUpperCase()}</span><p className="profile-hint">A foto é reduzida para 256 × 256 pixels. Formatos JPG, PNG e WebP.</p></div>
        <label className="profile-button ghost filepick">Escolher foto<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { void updateAvatar(e.target.files?.[0]); e.target.value = ""; }} /></label>
        {profile.avatarData && <button type="button" className="profile-button ghost" disabled={busy} onClick={removeAvatar}>Remover foto</button>}
        <h3 className="profile-spaced">Informações da parceria</h3><div className="profile-info"><span>Parceria</span><b>{partner.name}</b><span>Tipo</span><b>{({ reseller: "Revenda", content: "Parceiro", both: "Revenda e parceiro" })[partner.kind] || partner.kind}</b><span>Plano / cobrança</span><b>{partner.billingModel || "—"}</b><span>Válida até</span><b>{WHEN(partner.endsAt)}</b></div>
      </section></div>}
    {tab === "seguranca" && <div className="profile-grid">
      <form className="profile-card" onSubmit={submitPassword}><h3>Alterar minha senha</h3><p className="profile-hint">Por segurança, todas as sessões serão encerradas após a mudança.</p>
        <label htmlFor="profile-current">Senha atual</label>{field("currentPassword", { id: "profile-current", type: "password", autoComplete: "current-password", maxLength: 128, required: true, value: pwd.currentPassword, onChange: e => setPwd(v => ({ ...v, currentPassword: e.target.value })) })}
        <label htmlFor="profile-new">Nova senha</label>{field("newPassword", { id: "profile-new", type: "password", autoComplete: "new-password", minLength: 12, maxLength: 128, required: true, value: pwd.newPassword, onChange: e => setPwd(v => ({ ...v, newPassword: e.target.value })) })}
        <label htmlFor="profile-confirm">Confirmar nova senha</label>{field("confirmPassword", { id: "profile-confirm", type: "password", autoComplete: "new-password", minLength: 12, maxLength: 128, required: true, value: pwd.confirmPassword, onChange: e => setPwd(v => ({ ...v, confirmPassword: e.target.value })) })}
        <button className="profile-button primary" disabled={busy}>Alterar senha</button><div className="profile-divider"/><h4>Redefinição por e-mail</h4><p className="profile-hint">Um link de uso único será enviado para seu e-mail cadastrado.</p><button type="button" className="profile-button ghost" disabled={busy} onClick={sendReset}>Enviar link de redefinição</button>
      </form>
      <form className="profile-card" onSubmit={submitEmail}><h3>Alterar e-mail de acesso</h3><p className="profile-hint">Informe a senha atual para confirmar. Ao trocar o endereço, você precisará entrar novamente.</p>
        <label htmlFor="profile-new-email">Novo e-mail</label>{field("email", { id: "profile-new-email", type: "email", maxLength: 200, autoComplete: "email", required: true, value: emailForm.email, onChange: e => setEmailForm(v => ({ ...v, email: e.target.value })) })}
        <label htmlFor="profile-email-pass">Senha atual</label>{field("emailPassword", { id: "profile-email-pass", type: "password", maxLength: 128, required: true, autoComplete: "current-password", value: emailForm.currentPassword, onChange: e => setEmailForm(v => ({ ...v, currentPassword: e.target.value })) })}
        <button className="profile-button primary" disabled={busy}>Confirmar e-mail</button><div className="profile-divider"/><h4>Último login</h4><p>{WHEN(user.lastLoginAt)}</p></form>
    </div>}
    {tab === "sessoes" && <section className="profile-card"><div className="profile-section-header"><div><h3>Dispositivos conectados</h3><p className="profile-hint">Encerre sessões que você não reconhece. A sessão atual é identificada automaticamente nos logins novos.</p></div><button className="profile-button danger" disabled={busy} type="button" onClick={revokeOthers}>Desconectar outros</button></div>
      {message(sessionError, true)}<div className="profile-records">{(sessions?.data || []).map(s => <div className="profile-record" key={s.id}><div><strong>{s.current ? "Este aparelho" : "Outro aparelho"}</strong><small>{s.userAgent || "Navegador não informado"}</small><small>IP {s.ip || "—"} · Iniciada em {WHEN(s.createdAt)}</small></div><button type="button" className="profile-button danger" disabled={busy} onClick={() => revokeSession(s.id)}>Desconectar</button></div>)}{sessions && !sessions.data.length && <p className="profile-hint">Não há sessões ativas registradas.</p>}</div>
      <div className="profile-pager"><button className="profile-button ghost" type="button" disabled={sessionPage <= 1} onClick={() => setSessionPage(v => v - 1)}>Anterior</button><span>Página {sessionPage} de {Math.max(1, sessions?.meta?.pages || 1)}</span><button className="profile-button ghost" type="button" disabled={sessionPage >= (sessions?.meta?.pages || 1)} onClick={() => setSessionPage(v => v + 1)}>Próxima</button></div></section>}
    {tab === "historico" && <div className="profile-grid"><PaginatedRecords api={api} endpoint="/auth/profile/history" title="Acessos à conta" render={v => <div className="profile-record" key={v.id}><div><strong>{v.outcome === "success" ? "Login autorizado" : "Tentativa negada"}</strong><small>{WHEN(v.createdAt)} · {v.ip || "IP indisponível"}</small><small>{[v.browser, v.os, v.device].filter(Boolean).join(" · ") || "Dispositivo não identificado"}</small></div></div>} /><PaginatedRecords api={api} endpoint="/auth/profile/activity" title="Alterações e auditoria" render={v => <div className="profile-record" key={v.id}><div><strong>{v.action.replace(/[_\.]/g, " ")}</strong><small>{WHEN(v.createdAt)} · {v.result === "success" ? "Concluída" : v.result}</small></div></div>} /></div>}
    {tab === "preferencias" && <section className="profile-card profile-narrow"><h3>Preferências de notificações</h3><p className="profile-hint">Estas opções controlam apenas os avisos visuais no painel. Os comunicados administrativos continuam disponíveis na área Notificações.</p>
      <label className="profile-toggle"><input type="checkbox" checked={preferences.showUnreadBanner} onChange={e => setPreferences(v => ({ ...v, showUnreadBanner: e.target.checked }))}/><span><strong>Mostrar aviso de mensagens não lidas</strong><small>Exibe uma faixa de destaque quando houver novos comunicados.</small></span></label>
      <label className="profile-toggle"><input type="checkbox" checked={preferences.showNotificationBadge} onChange={e => setPreferences(v => ({ ...v, showNotificationBadge: e.target.checked }))}/><span><strong>Mostrar contador de notificações</strong><small>Mostra o número de comunicados pendentes no menu.</small></span></label>
      <button className="profile-button primary" type="button" disabled={busy} onClick={updatePreferences}>Salvar preferências</button></section>}
  </div>;
}
