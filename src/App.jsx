import TaskFinder from "./TaskFinder.jsx";
import { TASKS } from "./task-directory.js";
import { connectRealtime } from "./realtime.js";
import { useEffect, useRef, useState } from "react";
import { api, getAuth, login, logout } from "./api.js";
import { UiProvider, Field, useAction, BrandMark } from "./ui.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import { OperationCenter, CENTER_CONFIG } from "./OperationCenter.jsx";
import { useSimpleMode } from "./useSimpleMode.js";
import { EasyPageGuide } from "./EasyStart.jsx";
import "./easy-start.css";
import ServerMonitor from "./pages/ServerMonitor.jsx";
import VpsMonitor from "./pages/VpsMonitor.jsx";
import VpsFiles from "./pages/VpsFiles.jsx";
import PlansAndPricing from "./pages/PlansAndPricing.jsx";
import Licenses from "./pages/Licenses.jsx";
import Partners, { Resellers } from "./pages/Partners.jsx";
import PartnerTrash from "./pages/PartnerTrash.jsx";
import Devices from "./pages/Devices.jsx";
import Unlinked from "./pages/Unlinked.jsx";
import Sources from "./pages/Sources.jsx";
import Billing from "./pages/Billing.jsx";
import Pix from "./pages/Pix.jsx";
import Credits from "./pages/Credits.jsx";
import DistributionNetwork from "./pages/DistributionNetwork.jsx";
import Audit from "./pages/Audit.jsx";
import DeviceAccess from "./pages/DeviceAccess.jsx";
import Clients from "./pages/Clients.jsx";
import SupportCenter from "./pages/SupportCenter.jsx";
import Users from "./pages/Users.jsx";
import LoginHistory from "./pages/LoginHistory.jsx";
import Mail from "./pages/Mail.jsx";
import Notifications from "./pages/Notifications.jsx";
import WebAccessPage from "./pages/WebAccess.jsx";
import Downloads from "./pages/Downloads.jsx";
import WhiteLabel from "./pages/WhiteLabel.jsx";
import HelpManagement from "./pages/HelpManagement.jsx";

const WebAccess = () => <WebAccessPage admin />;

const PAGES = {
  pagamentos: ["Pagamentos", () => null], dispositivos: ["Dispositivos", () => null], licenciamento: ["Licenças", () => null], ativacao: ["Ativar aplicativo", () => null], conta: ["Minha conta", () => null],
  dashboard: ["Visão geral", Dashboard], vpsmonitor: ["Servidor / VPS", VpsMonitor], vpsfiles: ["Arquivos da VPS", VpsFiles],
  webaccess: ["Player Web", WebAccess], whiteLabel: ["Aplicativos white-label", WhiteLabel],
  licenses: ["Licenças das TVs", Licenses], devices: ["TVs e dispositivos", Devices], unlinked: ["TVs sem configuração", Unlinked],
  partners: ["Parceiros", Partners], servermonitor: ["Monitoramento", ServerMonitor], sources: ["Fontes de conteúdo", Sources],
  resellers: ["Revendas", Resellers], network: ["Rede de distribuição", DistributionNetwork], support: ["Resolver problema da TV", () => <SupportCenter base="/admin" />], trash: ["Lixeira", PartnerTrash], clients: ["Clientes", Clients], credits: ["Créditos", Credits], downloads: ["Downloads e links", Downloads],
  billing: ["Financeiro", Billing], pix: ["Pix", Pix], pricing: ["Planos e valores", PlansAndPricing],
  help: ["Central de Ajuda", HelpManagement], users: ["Usuários", Users], loginhistory: ["Histórico de login", LoginHistory], notifications: ["Notificações", Notifications], mail: ["E-mails", Mail], audit: ["Auditoria", Audit],
};

// Menu por área: quem é de conteúdo (Parceiros) fica separado de quem vende licença (Revendas e seus clientes).
const GROUPS = [
  { label: null, items: ["dashboard"] },
  { label: "Centrais de trabalho", items: ["pagamentos", "dispositivos", "licenciamento", "ativacao", "conta"] },
  { label: "Comercial e parceiros", items: ["partners", "resellers", "network", "servermonitor", "sources"] },
  { label: "Ferramentas avançadas", items: ["licenses", "unlinked", "webaccess", "devices", "clients", "support", "credits", "billing", "pix", "pricing", "downloads", "whiteLabel"] },
  { label: "Administração", items: ["vpsmonitor", "vpsfiles", "trash", "help", "users", "loginhistory", "notifications", "mail", "audit"] },
];

// Ícones do menu (traço simples, herdam a cor do texto).
const ICONS = {
  pagamentos: <><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 11h18M8 16h3"/></>,
  dispositivos: <><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/></>,
  licenciamento: <><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9"/></>,
  ativacao: <><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 12l2 2 4-5"/></>,
  conta: <><circle cx="12" cy="8" r="4"/><path d="M4 21c1-8 15-8 16 0"/></>,
  dashboard: <><rect x="3" y="3" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="2" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="2" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" /></>,
  vpsmonitor: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h4m3 0h3M7 17h10"/></>,
  vpsfiles: <><path d="M3 6h6l2 2h10v12H3z"/><path d="M3 10h18"/></>,
  licenses: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3M14 9l2 2" /></>,
  partners: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.8a3.5 3.5 0 010 6.4M18.5 14.8c1.7.7 2.8 2.3 3 5.2" /></>,
  servermonitor: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6 14h3l2-5 3 8 2-4h2"/></>,
  network: <><circle cx="12" cy="5" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="M12 7v5M5 16l7-4 7 4"/></>,
  resellers: <><path d="M4 9l1.5-5h13L20 9" /><path d="M4 9a2.5 2.5 0 005 0 2.5 2.5 0 005 0 2.5 2.5 0 005 0" /><path d="M5 12v8h14v-8M10 20v-5h4v5" /></>,
  clients: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" /></>,
  support: <><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6M7 10h6M10 7v6"/></>,
  devices: <><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  unlinked: <><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /><path d="M4 4l16 16" /></>,
  sources: <><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
  billing: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10.5h18M7 15h3" /></>,
  pricing: <><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 13h7M7 17h5"/></>,
  pix: <><path d="M12 2.8l9.2 9.2-9.2 9.2L2.8 12z" /><path d="M12 8l4 4-4 4-4-4z" /></>,
  credits: <><circle cx="12" cy="12" r="9" /><path d="M14.8 9.3c-.5-.9-1.5-1.3-2.8-1.3-1.7 0-2.8.8-2.8 2 0 3 5.6 1.2 5.6 4.2 0 1.2-1.1 2-2.8 2-1.3 0-2.4-.5-2.9-1.4M12 6.5V8m0 8v1.5" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" /></>,
  users: <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z" />,
  loginhistory: <><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></>,
  notifications: <><path d="M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  downloads: <><path d="M12 3v12M7 10.5l5 5 5-5" /><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></>,
  help: <><path d="M4 5h7a3 3 0 0 1 3 3v12a3 3 0 0 0-3-3H4zM20 5h-4a3 3 0 0 0-3 3v12a3 3 0 0 1 3-3h4z"/></>,
  whiteLabel: <><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/></>,
  webaccess: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  audit: <><path d="M8 3h8v3H8z" /><path d="M6 5H5a1 1 0 00-1 1v14a1 1 0 001 1h14a1 1 0 001-1V6a1 1 0 00-1-1h-1M8 12h8M8 16h5" /></>,
};
const NavIcon = ({ k }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[k]}</svg>
);

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
    <div className="auth">
      <div className="login card">
        <div className="auth-brand"><BrandMark size={44} /><div><strong>DeltaTV</strong><span>Painel de licenciamento</span></div></div>
        <h2>Entrar</h2>
        <p className="muted auth-sub">Use o e-mail e a senha da sua conta.</p>
        <form onSubmit={submit}>
          <Field label="E-mail"><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Field label="Senha"><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
          <button className="btn primary block" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
        </form>
        <div className="auth-alt"><button className="btn sm" onClick={onDeviceAccess}>Acessar com a chave da TV</button></div>
      </div>
    </div>
  );
}

/** Perfil no canto superior direito: avatar + nome; ao clicar abre e-mail e "Sair". */
function UserMenu({ user, onAccount }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  const initial = (user.name || user.email || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="usermenu" ref={ref}>
      <button type="button" className="usermenu-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="avatar" aria-hidden="true">{initial}</span>
        <span className="usermenu-name">{user.name || user.email}</span>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="usermenu-pop" role="menu">
          <div className="who"><strong>{user.name}</strong><span>{user.email}</span></div>
          <button type="button" className="btn sm" role="menuitem" onClick={() => {setOpen(false);onAccount();}}>Minha conta</button>
          <button type="button" className="btn sm" role="menuitem" onClick={logout}>Sair</button>
        </div>
      )}
    </div>
  );
}

const SIMPLE_ADMIN = new Set(["pagamentos", "dispositivos", "licenciamento", "ativacao", "conta", "dashboard", "support", "clients", "devices", "resellers", "network", "licenses", "billing", "servermonitor", "help"]);
function Shell({ user }) {
  const [simpleMode, setSimpleMode] = useSimpleMode("admin");
  // Itens do menu são conveniência: cada rota é protegida por permissão no backend.
  const hidden = (k) => ((k === "network") && user.role !== "superadmin") || ((k === "whiteLabel" || k === "help") && user.role !== "superadmin") || ((k === "vpsmonitor" || k === "vpsfiles" || k === "pricing" || k === "trash") && user.role !== "superadmin") || (user.role === "support" && k === "audit") || ((k === "users" || k === "loginhistory" || k === "mail" || k === "notifications") && user.role !== "superadmin");
  const menu = Object.entries(PAGES).filter(([k]) => !hidden(k));
  const allowed = (h) => menu.some(([k]) => k === h);
  const fromHash = () => (allowed(location.hash.slice(1)) ? location.hash.slice(1) : "dashboard");
  const [page, setPage] = useState(fromHash);
  const [open, setOpen] = useState(false); // gaveta do menu em tela pequena
  useEffect(() => { if (location.hash.slice(1) !== page) location.hash = page; }, [page]);
  // Botão voltar/avançar do navegador e links #pagina: sincroniza a tela com o endereço (e barra páginas sem permissão).
  useEffect(() => {
    const onHash = () => setPage(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.role]);
  // Tabelas responsivas: reaproveita os títulos das colunas sem alterar os dados nem os componentes.
  useEffect(() => {
    const labelTables = () => {
      document.querySelectorAll(".table-wrap table").forEach((table) => {
        const headers = Array.from(table.querySelectorAll("thead tr:last-child th")).map((th) => th.textContent.trim());
        if (!headers.length) return;
        table.querySelectorAll("tbody tr").forEach((tr) => {
          const cells = Array.from(tr.children).filter((el) => el.matches("td"));
          if (cells.length !== headers.length) return; // não inventar rótulos em linhas combinadas
          cells.forEach((td, i) => {
            const label = headers[i] || (td.classList.contains("actions") ? "Ações" : "Detalhe");
            if (td.dataset.label !== label) td.dataset.label = label;
          });
        });
      });
    };
    labelTables();
    const observer = new MutationObserver(labelTables);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);
  const Current = PAGES[page][1];
  const isCenter = Object.prototype.hasOwnProperty.call(CENTER_CONFIG, page);
  const go = (k) => { setPage(k); setOpen(false); window.scrollTo(0, 0); };
  // Esc fecha a gaveta; ao voltar para tela grande ela não fica "aberta" escondida.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Selos do menu: dispositivos aguardando vínculo e cadastros de revenda aguardando aprovação. Falhar aqui nunca atrapalha o painel.
  const [badges, setBadges] = useState({});
  const refreshCounts = () => {
    api("/admin/devices/unlinked", { query: { pageSize: 1 } }).then((r) => setBadges((b) => ({ ...b, unlinked: r.meta.total }))).catch(() => {});
    api("/admin/partners", { query: { status: "pending", pageSize: 1 } }).then((r) => setBadges((b) => ({ ...b, resellers: r.meta.total }))).catch(() => {});
  };
  useEffect(() => {
    refreshCounts();
    const t = setInterval(() => { if (!document.hidden) refreshCounts(); }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="layout">
      <aside className={`sidebar ${open ? "open" : ""}`} id="menu-principal">
        <div className="brand"><BrandMark size={32} /><div><strong>DeltaTV</strong><span>Administração</span></div><button type="button" className="sidebar-close" aria-label="Fechar menu" onClick={() => setOpen(false)}>×</button></div>
        <button type="button" className="easy-mode-button" aria-pressed={!simpleMode} onClick={() => setSimpleMode((s) => !s)}>{simpleMode ? "⚙ Ver todas as opções" : "✓ Voltar ao modo simples"}</button>
        <nav className="nav-scroll" aria-label="Menu principal">
          {GROUPS.map((g) => {
            const items = g.items.filter((k) => allowed(k) && (!simpleMode || SIMPLE_ADMIN.has(k) || page === k));
            if (!items.length) return null;
            return (
              <div className="nav-group" key={g.label || "top"}>
                {g.label && <div className="nav-heading">{g.label}</div>}
                {items.map((k) => (
                  <button key={k} className={`nav ${page === k ? "active" : ""}`} onClick={() => go(k)}>
                    <span className="nav__label"><NavIcon k={k} />{PAGES[k][0]}</span>
                    {badges[k] > 0 && <span className="count" aria-label={`${badges[k]} aguardando`}>{badges[k] > 99 ? "99+" : badges[k]}</span>}
                  </button>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <div className="topbar">
          <button type="button" className="icon menu-btn" aria-label="Abrir menu" aria-controls="menu-principal" aria-expanded={open} onClick={() => setOpen(true)}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <strong className="topbar-title">{PAGES[page][0]}</strong>
          {badges.unlinked > 0 || badges.resellers > 0 ? <span className="count" aria-label="Itens aguardando">{(badges.unlinked || 0) + (badges.resellers || 0)}</span> : null}
          <button type="button" className="easy-mode-button" aria-pressed={!simpleMode} onClick={() => setSimpleMode((s) => !s)}>{simpleMode ? "Modo simples · mostrar tudo" : "Modo completo · simplificar"}</button>
          <UserMenu user={user} onAccount={() => go("conta")} />
        </div>
        <main className="content">
          <TaskFinder tasks={TASKS.filter(task => allowed(task.route))} onNavigate={go} />
          {simpleMode && page !== "dashboard" && <EasyPageGuide role="admin" page={page} onBack={() => go("dashboard")} />}
          {isCenter ? <OperationCenter section={page} onNavigate={go} allowed={allowed} /> : <Current onChanged={refreshCounts} />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => connectRealtime(), []);
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
