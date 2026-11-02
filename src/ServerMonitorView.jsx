import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import "./server-monitor.css";

const STATES = [
  { key: "total", label: "Total", icon: "◉" },
  { key: "healthy", label: "Saudáveis", icon: "●" },
  { key: "suspect", label: "Instáveis", icon: "◐" },
  { key: "down", label: "Indisponíveis", icon: "●" },
  { key: "unknown", label: "Sem medição", icon: "○" },
  { key: "disabled", label: "Desativados", icon: "—" },
];
const STATUS = { healthy: "Saudável", suspect: "Instável / lento", down: "Indisponível", unknown: "Sem medição recente", disabled: "Desativado" };
const date = (value) => value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Nunca";
const host = (value) => { try { return new URL(value).host; } catch { return "Endereço indisponível"; } };

export default function ServerMonitorView({ scope = "admin" }) {
  const endpoint = scope === "admin" ? "/admin/server-monitor" : "/partner/server-monitor";
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const requestSeq = useRef(0);
  const busy = useRef(false);
  useEffect(() => { const timer = setTimeout(() => { setQuery(typed.trim()); setPage(1); }, 400); return () => clearTimeout(timer); }, [typed]);
  const refresh = useCallback(async (silent = false) => {
    // Requisição leve, sem sondar nenhuma URL remota. Descartar resposta antiga após troca de filtros.
    if (busy.current && silent) return;
    const sequence = ++requestSeq.current;
    busy.current = true;
    if (!silent) setLoading(true);
    try {
      const next = await api(endpoint, { query: { ...(query ? { q: query } : {}), ...(status ? { status } : {}), page, pageSize: 20 } });
      if (sequence === requestSeq.current) { setData(next); setError(""); }
    } catch (e) { if (sequence === requestSeq.current) setError(e.message || "Falha ao consultar os servidores."); }
    finally { busy.current = false; if (sequence === requestSeq.current) setLoading(false); }
  }, [endpoint, query, status, page]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    let timer;
    const schedule = (event) => {
      if (document.hidden) return;
      if (event?.type === "realtime-change" && event.detail?.topic !== "server-health" && event.detail?.topic !== "data") return;
      clearTimeout(timer); timer = setTimeout(() => refresh(true), 400);
    };
    const interval = setInterval(() => { if (!document.hidden) refresh(true); }, 60000);
    window.addEventListener("realtime-change", schedule);
    window.addEventListener("realtime-ready", schedule);
    window.addEventListener("visibilitychange", schedule);
    return () => { clearInterval(interval); clearTimeout(timer); window.removeEventListener("realtime-change", schedule); window.removeEventListener("realtime-ready", schedule); window.removeEventListener("visibilitychange", schedule); };
  }, [refresh]);
  const summary = data?.summary || {};
  return (
    <div className="srv-monitor">
      <section className="srv-hero">
        <div><div className="srv-eyebrow"><span className="srv-pulse" /> SAÚDE DA INFRAESTRUTURA</div>
          <h2>Monitoramento de servidores</h2>
          <p>{scope === "admin" ? "Acompanhe as origens de todas as parcerias e identifique quedas e lentidão." : "Acompanhe a disponibilidade dos servidores cadastrados na sua parceria."}</p>
        </div>
        <button type="button" className="btn srv-refresh" disabled={loading} onClick={() => refresh(false)} aria-label="Atualizar monitoramento">↻ {loading ? "Carregando…" : "Atualizar"}</button>
      </section>
      {data && !data.monitorEnabled && <div className="srv-notice" role="status">⚠ O monitor automático está desligado no backend. Os servidores não são testados ao abrir esta página. O administrador deve ativar <code>PROVIDER_MONITOR_ENABLED=true</code> após a homologação.</div>}
      <section className="srv-summary" aria-label="Resumo da saúde dos servidores">
        {STATES.map((s) => <button type="button" key={s.key} className={`srv-metric srv-${s.key} ${status === (s.key === "total" ? "" : s.key) ? "selected" : ""}`} onClick={() => { setStatus(s.key === "total" ? "" : s.key); setPage(1); }} aria-pressed={status === (s.key === "total" ? "" : s.key)}>
          <span className="srv-metric-label">{s.label}<span aria-hidden="true">{s.icon}</span></span>
          <strong>{data ? (summary[s.key] ?? 0).toLocaleString("pt-BR") : "—"}</strong>
        </button>)}
      </section>
      <section className="srv-list" aria-label="Lista de servidores">
        <div className="srv-toolbar">
          <div><h3>Servidores</h3><p>Atualização automática por evento e sincronização periódica.</p></div>
          <div className="srv-filters">
            <label className="srv-search"><span>⌕</span><input type="search" placeholder={scope === "admin" ? "Buscar servidor ou parceiro" : "Buscar servidor ou URL"} value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Pesquisar servidores" /></label>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filtrar por estado">
              <option value="">Todos os estados</option>
              {STATES.slice(1).map((s) => <option value={s.key} key={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>
        {error && <div role="alert" className="srv-error">{error} <button className="btn sm" onClick={() => refresh(false)}>Tentar novamente</button></div>}
        {!data && loading ? <p className="srv-empty">Carregando servidores…</p> : !data?.rows?.length ? <p className="srv-empty">Nenhum servidor encontrado para este filtro.</p> : <div className="srv-grid" aria-busy={loading}>
          {data.rows.map((server) => <article className="srv-item" key={server.id}>
            <div className="srv-item-head">
              <div className="srv-item-title"><span className="srv-server-icon">▣</span><div><h4 title={server.name}>{server.name}</h4>{scope === "admin" && <div className="srv-owner">{server.partnerName || "Parceria não identificada"}</div>}</div></div>
              <span className={`srv-state srv-state-${server.healthStatus}`}>{STATUS[server.healthStatus] || "Indefinido"}</span>
            </div>
            <p className="srv-host" title={host(server.baseUrl)}>{host(server.baseUrl)}</p>
            <div className="srv-item-metrics">
              <div><span>Resposta HTTP</span><strong>{server.healthStatus === "unknown" || server.healthStatus === "disabled" || server.latencyMs == null ? "—" : `${server.latencyMs} ms`}</strong></div>
              <div><span>Prioridade manual</span><strong>{server.priority ?? "—"}</strong></div>
            </div>
            <div className="srv-item-footer"><div><span>Última verificação</span><strong>{date(server.lastCheckedAt)}</strong></div><div><span>Último sucesso</span><strong>{date(server.lastGoodAt)}</strong></div></div>
            {server.healthStatus === "down" || server.healthStatus === "suspect" ? <div className="srv-incident">{server.lastError || "Resposta fora do limite configurado."}</div> : null}
          </article>)}
        </div>}
        <div className="srv-bottom">
          <span className="srv-footnote">{data ? `${data.count.toLocaleString("pt-BR")} servidor(es) no filtro · Página ${data.page} de ${data.pages}` : ""}</span>
          <div className="srv-pagination"><button className="btn sm" disabled={!data || page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</button><button className="btn sm" disabled={!data || page >= data.pages || loading} onClick={() => setPage((p) => p + 1)}>Próxima</button></div>
        </div>
      </section>
      <p className="srv-footnote srv-note">A latência é medida da VPS até a API HTTP do servidor, não da TV. A indicação de saúde não garante que todos os canais estejam reproduzindo.</p>
    </div>
  );
}
