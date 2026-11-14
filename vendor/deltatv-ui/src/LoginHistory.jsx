import { useState } from "react";

import { useEffect } from "react";
export default function LoginHistory({api}) {
  const [items, setItems] = useState([]), [meta, setMeta] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1), [outcome, setOutcome] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { let active = true; setBusy(true); api("/auth/history", { query: { page, limit: 25, outcome } })
    .then((v) => { if (active) { setItems(v.data); setMeta(v.meta); setError(""); } })
    .catch((e) => { if (active) setError(e.message); }).finally(() => { if (active) setBusy(false); }); return () => { active = false; }; }, [page, outcome]);
  return <><div className="page-head"><h2>Histórico de login</h2></div><p className="muted">Acessos de administradores e revendas. Horário local do navegador. Informações de dispositivo aproximadas.</p>
  <div className="toolbar"><select value={outcome} onChange={(e) => { setOutcome(e.target.value); setPage(1); }}><option value="">Todos os resultados</option><option value="success">Sucesso</option><option value="failure">Falha</option></select><span>{meta.total} registros</span></div>
  {error && <p role="alert">{error}</p>}{busy && <p>Carregando…</p>}
  <div className="login-history-grid">{items.map(x => <article key={x.id} className="card login-history-card">
  <div className="login-history-top"><strong>{x.userEmail || "Conta não identificada"}</strong><span className={x.outcome === "success" ? "login-ok" : "login-fail"}>{x.outcome === "success" ? "Acesso permitido" : "Tentativa negada"}</span></div>
  <div className="login-history-details"><div><small>Data e hora</small><b>{new Date(x.createdAt).toLocaleString("pt-BR")}</b></div><div><small>IP</small><b>{x.ip || "—"}</b></div><div><small>Provedor</small><b>{x.isp || "Não identificado"}</b></div><div><small>Dispositivo</small><b>{x.device || "—"}</b></div><div><small>Sistema</small><b>{x.os || "—"}</b></div><div><small>Navegador</small><b>{x.browser || "—"}</b></div><div><small>Local aproximado</small><b>{[x.city,x.region,x.country].filter(Boolean).join(", ") || "—"}</b></div>{x.reason && <div><small>Motivo</small><b>{x.reason}</b></div>}</div>
  </article>)}</div>
  <div className="toolbar"><button className="btn" disabled={page <= 1} onClick={() => setPage(v => v - 1)}>Anterior</button><span>Página {page} de {Math.max(1,meta.pages)}</span><button className="btn" disabled={page >= meta.pages} onClick={() => setPage(v => v + 1)}>Próxima</button></div></>;
}
