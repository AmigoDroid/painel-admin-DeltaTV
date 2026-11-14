/** Presentational normalization only. The backend remains authoritative for probes, routing and failover. */
export const SERVER_HEALTH_LABELS = Object.freeze({
  healthy: 'Saudável', slow: 'Lento', suspect: 'Instável', down: 'Indisponível',
  checking: 'Verificando', unknown: 'Sem medição recente', disabled: 'Desativado',
});
export const serverHealthState = (source) => {
  if (source?.status === 'disabled' || source?.healthStatus === 'disabled') return 'disabled';
  const raw = source?.healthStatus || source?.health?.state || 'unknown';
  return Object.hasOwn(SERVER_HEALTH_LABELS, raw) ? raw : 'unknown';
};
export const serverHealthLabel = (source) => SERVER_HEALTH_LABELS[serverHealthState(source)];
export const serverLatency = (source) => {
  const n = source?.latencyMs ?? source?.health?.latencyMs;
  return Number.isFinite(Number(n)) && n !== null && n !== '' && Number(n) >= 0 ? `${Math.round(Number(n))} ms` : 'Sem medição';
};
export const serverAvailability = (source, period) => {
  const sample = source?.availability?.[period];
  const percent = sample?.percent;
  return percent != null && Number.isFinite(Number(percent)) ? `${Number(percent).toLocaleString('pt-BR', {maximumFractionDigits:2})}%` : 'Sem dados';
};
export const serverLastCheck = (source) => source?.lastCheckedAt || source?.health?.lastCheckedAt || null;
export const serverLastError = (source) => source?.lastError || source?.health?.lastError || '';
export const readableHost = (value) => {
  try { const url = new URL(value); return url.host; } catch { return 'Endereço não informado'; }
};
export const serverHealthSummary = (sources = []) => {
  const output = {total: sources.length,healthy:0,slow:0,suspect:0,down:0,unknown:0,disabled:0,checking:0};
  for (const source of sources) output[serverHealthState(source)] += 1;
  return output;
};
