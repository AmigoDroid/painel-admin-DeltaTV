import { useEffect, useState } from "react";
import { api, getAuth, login, logout } from "./api.js";
import { UiProvider, Field, useAction } from "./ui.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Licenses from "./pages/Licenses.jsx";
import Partners from "./pages/Partners.jsx";
import Devices from "./pages/Devices.jsx";
import Unlinked from "./pages/Unlinked.jsx";
import Sources from "./pages/Sources.jsx";
import Billing from "./pages/Billing.jsx";
import Pix from "./pages/Pix.jsx";
import Audit from "./pages/Audit.jsx";
import DeviceAccess from "./pages/DeviceAccess.jsx";
import Clients from "./pages/Clients.jsx";
import Users from "./pages/Users.jsx";

const PAGES = {
  dashboard: ["Visão geral", Dashboard], licenses: ["Licenças", Licenses], partners: ["Parceiros", Partners], clients: ["Clientes", Clients],
  devices: ["Dispositivos", Devices], unlinked: ["Sem vínculo", Unlinked], sources: ["Fontes", Sources], billing: ["Financeiro", Billing], pix: ["Pix", Pix], users: ["Usuários", Users], audit: ["Auditoria", Audit],
};

function Login({ onDeviceAccess }) {
  const run = useAction();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    await run(() => login(email, password));
    setBusy(false);
  };
  return (
    <div className="login card">
      <h2 style={{ marginBottom: 16 }}>Plataforma de licenciamento</h2>
      <form onSubmit={submit}>
        <Field label="E-mail"><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="Senha"><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        <button className="btn primary" style={{ width: "100%" }} disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
      </form>
      <p style={{ marginTop: 16, textAlign: "center" }}><button className="btn sm" onClick={onDeviceAccess}>Acessar com a chave da TV</button></p>
    </div>
  );
}

function Shell({ user }) {
  // Itens do menu são conveniência: cada rota é protegida por permissão no backend.
  const hidden = (k) => (user.role === "support" && k === "audit") || (k === "users" && user.role !== "superadmin");
  const menu = Object.entries(PAGES).filter(([k]) => !hidden(k));
  const allowed = (h) => menu.some(([k]) => k === h);
  const fromHash = () => (allowed(location.hash.slice(1)) ? location.hash.slice(1) : "dashboard");
  const [page, setPage] = useState(fromHash);
  useEffect(() => { if (location.hash.slice(1) !== page) location.hash = page; }, [page]);
  // Botão voltar/avançar do navegador e links #pagina: sincroniza a tela com o endereço (e barra páginas sem permissão).
  useEffect(() => {
    const onHash = () => setPage(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.role]);
  const Current = PAGES[page][1];

  // Contador de dispositivos aguardando vínculo (selo no menu). Falhar aqui nunca atrapalha o painel.
  const [unlinked, setUnlinked] = useState(null);
  const refreshUnlinked = () => api("/admin/devices/unlinked", { query: { pageSize: 1 } }).then((r) => setUnlinked(r.meta.total)).catch(() => {});
  useEffect(() => {
    refreshUnlinked();
    const t = setInterval(() => { if (!document.hidden) refreshUnlinked(); }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Licenciamento IPTV</div>
        {menu.map(([k, [label]]) => (
          <button key={k} className={`nav ${page === k ? "active" : ""}`} onClick={() => setPage(k)}>
            {label}{k === "unlinked" && unlinked > 0 && <span className="count" aria-label={`${unlinked} aguardando`}>{unlinked > 99 ? "99+" : unlinked}</span>}
          </button>
        ))}
        <div className="user">{user.name}<br />{user.email}<br /><button className="btn sm" style={{ marginTop: 8 }} onClick={logout}>Sair</button></div>
      </aside>
      <main className="content"><Current onChanged={refreshUnlinked} /></main>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(getAuth());
  useEffect(() => {
    const h = () => setAuth(getAuth());
    window.addEventListener("auth-changed", h);
    return () => window.removeEventListener("auth-changed", h);
  }, []);
  // Login de dispositivo (MAC + chave da TV): sessão própria, limitada a um dispositivo; independente do login do painel.
  const [deviceMode, setDeviceMode] = useState(() => location.hash === "#dispositivo");
  const toDevice = (on) => { setDeviceMode(on); location.hash = on ? "dispositivo" : ""; };
  return (
    <UiProvider>
      {auth?.user && auth.user.role !== "partner" ? <Shell user={auth.user} /> : deviceMode ? <DeviceAccess onBack={() => toDevice(false)} /> : <Login onDeviceAccess={() => toDevice(true)} />}
    </UiProvider>
  );
}
