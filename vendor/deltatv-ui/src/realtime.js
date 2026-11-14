
// Socket autenticado por mensagem (nunca por query string ou localStorage compartilhado).
export function connectRealtime({getAuth,ensureAccessToken,apiUrl}) {
  const API=apiUrl;
  let socket, retry, beat, startup, stopped = false, delay = 1000, generation = 0;
  function closeSocket() { generation++; clearInterval(beat); if (socket) { socket.onclose = null; socket.close(); socket = null; } }
  async function connect() {
    if (stopped || !getAuth()?.accessToken) return;
    const attempt = generation;
    try { await ensureAccessToken(); }
    catch {
      if (!stopped && attempt === generation && getAuth()?.accessToken) {
        retry = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 30000);
      }
      return;
    }
    if (stopped || attempt !== generation || !getAuth()?.accessToken) return;
    const url = new URL("/ws", API); url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    try { socket = new WebSocket(url); } catch (err) { console.warn("[realtime] Falha ao abrir WebSocket:", err); retry = setTimeout(connect, delay); return; }
    socket.onopen = () => socket.send(JSON.stringify({ type: "auth", token: getAuth()?.accessToken }));
    socket.onmessage = (e) => {
      let msg; try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === "ready") {
        delay = 1000;
        window.dispatchEvent(new CustomEvent("realtime-ready", { detail: msg }));
        clearInterval(beat);
        beat = setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "heartbeat" }));
        }, 25000);
      } else if (msg.type === "changed" || msg.type === "partner-presence" || msg.type === "notification") {
        window.dispatchEvent(new CustomEvent("realtime-change", { detail: msg }));
      }
    };
    socket.onclose = () => {
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
  return () => { stopped = true; clearTimeout(startup); clearTimeout(retry); closeSocket(); window.removeEventListener("auth-changed", authChanged); };
}
