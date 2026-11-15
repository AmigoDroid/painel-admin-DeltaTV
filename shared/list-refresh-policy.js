/**
 * Invalidação de listas por domínio. O WebSocket não transmite registros: só sinaliza a área alterada.
 * Eventos de presença/monitoramento não devem recarregar catálogos comerciais.
 */
const ALIASES = Object.freeze({
  devices: ["devices", "activations", "licenses", "stock", "session", "mac"],
  clients: ["clients", "devices", "activations", "mac"],
  invoices: ["invoices", "billing", "pix", "payments"],
  billing: ["invoices", "billing", "pix", "payments"],
  codes: ["codes", "stock", "network"],
  providers: ["providers", "provider-monitor"],
  partners: ["partners", "network", "providers"],
  licenses: ["licenses", "stock", "devices", "activations"],
  stock: ["stock", "licenses", "network"],
  commerce: ["commerce"],
  credits: ["credits", "network"],
  network: ["network", "partners", "master-pix"],
  downloads: ["downloads", "app-downloads"],
  "app-downloads": ["downloads", "app-downloads"],
  "server-monitor": ["server-health", "server-quality", "provider-monitor"],
});

export function shouldRefreshList(path, message) {
  if (message?.type !== "changed") return false;
  const topic = String(message.topic || "").trim();
  if (topic === "data") return true;
  if (!topic) return false;
  const pieces = String(path || "")
    .split("/")
    .filter(Boolean);
  const section = pieces[1] || "";
  return (ALIASES[section] || [section]).includes(topic);
}

/** Evita polling em background e atualizações de interfaces que o usuário não está vendo. */
export function canBackgroundRefresh({
  hidden,
  inFlight,
  now,
  lastStarted,
  minIntervalMs = 3000,
}) {
  return !hidden && !inFlight && now - lastStarted >= minIntervalMs;
}
