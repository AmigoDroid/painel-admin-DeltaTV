import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import { setSystemMetricsSubscription } from "../realtime.js";
import "../vps-monitor.css";
import VpsNetwork from "./VpsNetwork.jsx";
import { mbps } from "../network-format.js";

function size(bytes) {
  if (bytes == null || !Number.isFinite(Number(bytes))) return "—";
  const gb = Number(bytes) / (1024 ** 3);
  return gb >= 0.1 ? `${gb.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} GB` : `${(Number(bytes) / (1024 ** 2)).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} MB`;
}
const percent = (used, total) => total > 0 ? Math.min(100, Math.max(0, (100 * used) / total)) : null;
const formatPercent = (n) => n == null ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
function uptime(total) {
  if (!Number.isFinite(total)) return "—";
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return [days ? `${days}d` : null, `${hours}h`, `${minutes}min`].filter(Boolean).join(" ");
}

function UsageCard({ name, value, help, usage, color = "violet", extra, icon }) {
  const safe = usage == null ? 0 : Math.max(0, Math.min(100, usage));
  return <section className={`card vps-card vps-${color}`}>
    <div className="vps-card-top"><span className="vps-icon" aria-hidden="true">{icon}</span><span className="vps-label">{name}</span></div>
    <div className="vps-number">{value}</div>
    <p className="vps-help">{help}</p>
    <div className="vps-meter" role="progressbar" aria-label={`Utilização de ${name}`} aria-valuenow={Math.round(safe)} aria-valuemin="0" aria-valuemax="100"><div style={{ width: `${safe}%` }} /></div>
    <div className="vps-card-foot"><span>{usage == null ? "Aguardando medição" : `${formatPercent(usage)} utilizado`}</span><span>{extra}</span></div>
  </section>;
}

function Trend({ values, label }) {
  const points = values.filter((v) => typeof v === "number");
  const polyline = points.length < 2 ? "" : points.map((p, i) => `${(i / (points.length - 1)) * 100},${100 - Math.min(100, Math.max(0, p))}`).join(" ");
  return <div className="card vps-trend"><div className="vps-trend-heading"><h3>{label}</h3><span>Últimos 2 minutos</span></div>
    {polyline ? <svg className="vps-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`Histórico de ${label}`}><path d="M0 25H100 M0 50H100 M0 75H100" stroke="currentColor" strokeWidth="0.4" opacity=".2"/><polyline points={polyline} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"/></svg>
      : <div className="vps-chart-empty">Coletando amostras…</div>}
  </div>;
}

export default function VpsMonitor() {
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState("");
  const [wsUpdated, setWsUpdated] = useState(0);
  const [history, setHistory] = useState([]);
  const wsLast = useRef(0);
  const restBusy = useRef(false);
  const mounted = useRef(false);
  const lastId = useRef(null);

  const push = useCallback((data, source) => {
    if (!data?.sampledAt) return;
    const at = Date.parse(data.sampledAt);
    if (!Number.isFinite(at) || (lastId.current && at < Date.parse(lastId.current))) return;
    setMetrics(data);
    setError("");
    if (source === "ws") { wsLast.current = Date.now(); setWsUpdated(wsLast.current); }
    if (lastId.current !== data.sampledAt) {
      lastId.current = data.sampledAt;
      setHistory((old) => [...old.filter(row => row.at >= at - 120000).slice(-119), { at, cpu: data.cpu?.percent, memory: percent(data.memory?.used, data.memory?.total), receiveMbps: mbps(data.network?.receiveBytesPerSecond), sendMbps: mbps(data.network?.sendBytesPerSecond) }]);
    }
  }, []);
  const refresh = useCallback(async () => {
    if (restBusy.current) return;
    restBusy.current = true;
    try {
      const data = await api("/admin/system/metrics");
      if (mounted.current) push(data, "rest");
    } catch (e) { if (mounted.current) setError(e.message || "Não foi possível obter os indicadores."); }
    finally { restBusy.current = false; }
  }, [push]);

  useEffect(() => {
    mounted.current = true;
    const subscribe = setSystemMetricsSubscription;
    const onMetrics = (e) => { if (!document.hidden) push(e.detail, "ws"); };
    const onVisibility = () => { subscribe(!document.hidden); if (!document.hidden) void refresh(); };
    window.addEventListener("system-metrics", onMetrics);
    document.addEventListener("visibilitychange", onVisibility);
    subscribe(!document.hidden);
    void refresh();
    const timer = setInterval(() => {
      if (document.hidden) return;
      // Se os eventos estiverem chegando, não criar requisições REST desnecessárias.
      if (Date.now() - wsLast.current > 13000) void refresh();
    }, 20000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      subscribe(false);
      window.removeEventListener("system-metrics", onMetrics);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [push, refresh]);

  const cpuValue = metrics?.cpu?.percent;
  const memoryUse = percent(metrics?.memory?.used, metrics?.memory?.total);
  const diskUse = percent(metrics?.storage?.used, metrics?.storage?.total);
  const swapUse = percent(metrics?.swap?.used, metrics?.swap?.total);
  const live = wsUpdated > 0 && Date.now() - wsUpdated < 15000;

  return <div className="vps-page">
    <div className="page-head vps-heading">
      <div><h2>Monitoramento da VPS</h2><p className="muted">CPU, memória, armazenamento, tráfego de rede e processo da API.</p></div>
      <div className="vps-actions"><span className={`badge ${live ? "ok" : "info"}`}>{live ? "Ao vivo · WebSocket" : "API · sincronização"}</span><button className="btn sm" type="button" onClick={refresh}>Atualizar agora</button></div>
    </div>
    {error && <div className="vps-error" role="alert">{error} {metrics && "Exibindo a última medição recebida."}</div>}
    {!metrics && !error && <div className="card" role="status">Carregando indicadores da VPS…</div>}
    {metrics && <>
      <div className="vps-overview">
        <UsageCard name="CPU" icon="▥" color={cpuValue != null && cpuValue >= 85 ? "red" : "violet"} value={formatPercent(cpuValue)} usage={cpuValue} help={`${metrics.cpu?.cores || "—"} vCPU · carga de 1 min: ${metrics.cpu?.load1 ?? "—"}`} extra="Uso do host" />
        <UsageCard name="Memória RAM" icon="▦" color={memoryUse >= 85 ? "amber" : "blue"} value={size(metrics.memory?.used)} usage={memoryUse} help={`${size(metrics.memory?.total)} instalados`} extra={`${size(metrics.memory?.available)} disponíveis`} />
        <UsageCard name="Armazenamento /" icon="◫" color={diskUse >= 90 ? "red" : "green"} value={size(metrics.storage?.used)} usage={diskUse} help={`Disco total: ${size(metrics.storage?.total)}`} extra={`${size(metrics.storage?.available)} disponíveis`} />
        <UsageCard name="Swap" icon="⇄" color={swapUse >= 70 ? "amber" : "violet"} value={size(metrics.swap?.used)} usage={swapUse} help={`Total: ${size(metrics.swap?.total)}`} extra={metrics.swap?.total ? "Memória de troca" : "Sem swap detectada"} />
      </div>
      <div className="vps-trends">
        <Trend values={history.map((v) => v.cpu)} label="Histórico de CPU" />
        <Trend values={history.map((v) => v.memory)} label="Histórico de RAM" />
      </div>
      <VpsNetwork network={metrics.network} transmission={metrics.transmission} history={history}/>
      <div className="card vps-details">
        <div><h3>Processo Node.js (API)</h3><p className="muted">Consumo do processo que executa o backend; não inclui Nginx ou PostgreSQL.</p></div>
        <div className="vps-detail-grid">
          <div><small>Memória RSS</small><strong>{size(metrics.node?.rss)}</strong></div>
          <div><small>Heap em uso</small><strong>{size(metrics.node?.heapUsed)}</strong></div>
          <div><small>Tempo ativo da API</small><strong>{uptime(metrics.node?.uptimeSeconds)}</strong></div>
          <div><small>Tempo ativo da VPS</small><strong>{uptime(metrics.uptimeSeconds)}</strong></div>
        </div>
      </div>
      <p className="vps-note">Última medição: {new Date(metrics.sampledAt).toLocaleString("pt-BR")} · Atualização WebSocket a cada 5 segundos enquanto esta página estiver aberta. CPU inicial pode levar uma amostra para aparecer. O disco representa o sistema de arquivos raiz da VPS.</p>
    </>}
  </div>;
}
