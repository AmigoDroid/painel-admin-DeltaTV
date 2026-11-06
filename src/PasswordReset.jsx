import React, { useState } from "react";
import { completePasswordReset, requestPasswordReset } from "./api.js";

/** Formulários públicos; nunca persistem o token em localStorage. */
export function ForgotPassword({ initialEmail = "", onBack = () => { window.location.assign("/"); } }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try { await requestPasswordReset(email); setDone(true); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <main className="reset-page"><section className="reset-card">
    <div className="reset-logo">D</div><h1>Esqueceu a senha?</h1>
    {done ? <><p className="reset-note" role="status">Se existir uma conta de parceiro com esse e-mail, enviaremos um link para criar outra senha. Confira também a pasta de spam.</p><p className="reset-note">O link expira em 30 minutos.</p></>
      : <form onSubmit={submit}><p>Informe seu e-mail de acesso ao painel do parceiro para receber o link de redefinição.</p><label htmlFor="reset-email">E-mail cadastrado</label><input id="reset-email" type="email" autoComplete="email" required maxLength={200} value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
        {error && <p role="alert" className="reset-error">{error}</p>}
        <button className="reset-primary" disabled={busy}>{busy ? "Enviando…" : "Enviar link de redefinição"}</button>
      </form>}
    <button type="button" className="reset-back" onClick={onBack}>Voltar ao login</button>
  </section></main>;
}

export function ResetPassword({ token, onBack = () => { window.location.assign("/"); } }) {
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault(); setError("");
    if (password !== repeat) { setError("As duas senhas precisam ser iguais."); return; }
    setBusy(true);
    try { await completePasswordReset(token, password); setPassword(""); setRepeat(""); setDone(true); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <main className="reset-page"><section className="reset-card">
    <div className="reset-logo">D</div><h1>Redefinir senha</h1>
    {done ? <p role="status" className="reset-note">Senha alterada com sucesso. Todas as sessões anteriores foram encerradas. Entre novamente usando sua nova senha.</p>
      : !token ? <p role="alert" className="reset-error">Link incompleto. Solicite uma nova redefinição de senha.</p>
        : <form onSubmit={submit}><p>Crie uma senha com no mínimo 12 caracteres. Este link só pode ser utilizado uma vez.</p>
          <label htmlFor="new-password">Nova senha</label><input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/>
          <label htmlFor="confirm-password">Confirme a nova senha</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={repeat} onChange={e=>setRepeat(e.target.value)}/>
          {error && <p role="alert" className="reset-error">{error}</p>}
          <button className="reset-primary" disabled={busy}>{busy ? "Salvando…" : "Salvar nova senha"}</button>
        </form>}
    <button type="button" className="reset-back" onClick={onBack}>Ir para o login</button>
  </section></main>;
}
