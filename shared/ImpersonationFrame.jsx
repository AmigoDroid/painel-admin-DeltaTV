import { useEffect, useState } from "react";
export default function ImpersonationFrame({
  children,
  getAuth,
  acceptSession,
  endImpersonation,
  adminUrl,
}) {
  const [auth, setAuth] = useState(getAuth()),
    [now, setNow] = useState(Date.now()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const update = () => setAuth(getAuth());
    window.addEventListener("auth-changed", update);
    return () => window.removeEventListener("auth-changed", update);
  }, [getAuth]);
  useEffect(() => {
    if (!window.opener || !adminUrl) return;
    let origin;
    try {
      origin = new URL(adminUrl).origin;
    } catch {
      return;
    }
    const receive = (event) => {
      if (
        event.origin !== origin ||
        event.source !== window.opener ||
        event.data?.type !== "deltatv-impersonation-session"
      )
        return;
      const session = event.data.session;
      if (session?.user?.role !== "partner" || !session?.impersonation?.id)
        return;
      acceptSession(session);
      window.opener.postMessage(
        { type: "deltatv-impersonation-accepted" },
        origin,
      );
    };
    window.addEventListener("message", receive);
    window.opener.postMessage({ type: "deltatv-impersonation-ready" }, origin);
    return () => window.removeEventListener("message", receive);
  }, [adminUrl, acceptSession]);
  useEffect(() => {
    if (!auth?.impersonation) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [auth?.impersonation?.id]);
  const end = async () => {
    setBusy(true);
    setError("");
    try {
      await endImpersonation();
      if (window.opener && !window.opener.closed) window.opener.focus();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const remaining = auth?.impersonation
    ? Math.max(
        0,
        Math.ceil((new Date(auth.impersonation.expiresAt) - now) / 60000),
      )
    : 0;
  return (
    <>
      {auth?.impersonation && (
        <aside className="impersonation-banner" role="status">
          <div>
            <strong>Impersonação ativa · {auth.user.name}</strong>
            <span>
              Acesso iniciado por {auth.impersonation.actorName}. Expira em{" "}
              {remaining} min. Ações auditadas.
            </span>
            {error && <span role="alert">{error}</span>}
          </div>
          <button disabled={busy} onClick={end}>
            {busy ? "Encerrando…" : "Sair da impersonação"}
          </button>
        </aside>
      )}
      {children}
    </>
  );
}
