import { getAuth } from "./api.js";
const API = import.meta.env.VITE_API_URL || "http://localhost:3000";
// O painel pode montar antes de o WebSocket ser inicializado (React effects).
// Guardar a intenção fora da conexão evita perder a assinatura da tela.
let systemMetricsWanted = false;
let setActiveSubscription = null;
export function setSystemMetricsSubscription(enabled) {
  systemMetricsWanted = enabled === true;
  setActiveSubscription?.();
}
// Socket autenticado por mensagem (nunca por query string ou localStorage compartilhado).
export function connectRealtime() {
  let socket, retry, beat, startup, stopped = false, delay = 1000;
  let isReady = false;
  const notifyStatus = (connected) => window.dispatchEvent(new CustomEvent("realtime-status", { detail: { connected } }));
  const subscribeSystemMetrics = () => {
    if (isReady && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "system-metrics-subscribe", enabled: systemMetricsWanted }));
  };
  setActiveSubscription = subscribeSystemMetrics;
  function closeSocket() { isReady = false; notifyStatus(false); clearInterval(beat); if (socket) { socket.onclose = null; socket.close(); socket = null; } }
  function connect() {
    if (stopped || !getAuth()?.accessToken) return;
    const url = new URL("/ws", API); url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    try { socket = new WebSocket(url); } catch (err) { console.warn("[realtime] Falha ao abrir WebSocket:", err); retry = setTimeout(connect, delay); return; }
    socket.onopen = () => socket.send(JSON.stringify({ type: "auth", token: getAuth()?.accessToken }));
    socket.onmessage = (e) => {
      let msg; try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === "ready") {
        isReady = true;
        notifyStatus(true);
        if (systemMetricsWanted) socket.send(JSON.stringify({ type: "system-metrics-subscribe", enabled: true }));
        delay = 1000;
        window.dispatchEvent(new CustomEvent("realtime-ready", { detail: msg }));
        clearInterval(beat);
        beat = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "heartbeat" }));
        }, 25000);
      } else if (msg.type === "system-metrics") {
        window.dispatchEvent(new CustomEvent("system-metrics", { detail: msg.metrics }));
      } else if (msg.type === "changed" || msg.type === "partner-presence" || msg.type === "device-presence") {
        window.dispatchEvent(new CustomEvent("realtime-change", { detail: msg }));
      }
    };
    socket.onclose = () => {
      isReady = false; notifyStatus(false);
      clearInterval(beat);
      if (!stopped && getAuth()?.accessToken) {
        retry = setTimeout(connect, delay + Math.random() * 300);
        delay = Math.min(delay * 2, 30000);
      }
    };
    socket.onerror = () => socket?.close();
  }
  function scheduleConnect() { clearTimeout(startup); startup = setTimeout(() => { startup = null; connect(); }, 0); }
  function authChanged() { clearTimeout(retry); clearTimeout(startup); closeSocket(); delay = 1000; scheduleConnect(); }
  window.addEventListener("auth-changed", authChanged);
  scheduleConnect();
  return () => { stopped = true; clearTimeout(startup); clearTimeout(retry); closeSocket(); window.removeEventListener("auth-changed", authChanged); if (setActiveSubscription === subscribeSystemMetrics) setActiveSubscription = null; };
}
