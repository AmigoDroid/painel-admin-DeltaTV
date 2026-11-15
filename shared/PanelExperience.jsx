import { createContext, useContext, useEffect, useState } from "react";
import "./panel-theme.css";
const Context = createContext({ brand: { name: "DeltaTV", logoUrl: "" } });
const KEY = "deltatv.theme.v1";
const initialTheme = () => {
  try {
    return localStorage.getItem(KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
};
export function PlatformBrand() {
  const { brand } = useContext(Context);
  return (
    <span className="platform-brand">
      {brand.logoUrl && <img src={brand.logoUrl} alt="" />}
      {brand.name}
    </span>
  );
}
export function Breadcrumb({ panel, current, onHome }) {
  return (
    <nav className="panel-breadcrumb" aria-label="Caminho da página">
      <button type="button" onClick={onHome}>
        {panel === "admin"
          ? "Administração"
          : panel === "revenda"
            ? "Revenda"
            : "Parceiro"}
      </button>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{current}</span>
    </nav>
  );
}
export default function PanelExperience({ children, api, panel }) {
  const [theme, setTheme] = useState(initialTheme),
    [config, setConfig] = useState({
      brand: { name: "DeltaTV", logoUrl: "", primaryColor: "#7768f6" },
    });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const load = () =>
      api("/platform", { signal: controller.signal })
        .then((value) => {
          if (active) setConfig(value);
        })
        .catch(() => {});
    load();
    const onChange = (e) => {
      if (["settings", "control"].includes(e.detail?.topic)) load();
    };
    window.addEventListener("realtime-change", onChange);
    return () => {
      active = false;
      controller.abort();
      window.removeEventListener("realtime-change", onChange);
    };
  }, [api]);
  useEffect(() => {
    const root = document.documentElement,
      color = config.brand.primaryColor;
    document.title = `${config.brand.name} · ${{ admin: "Administração", revenda: "Revenda", parceiro: "Parceiro" }[panel]}`;
    for (const key of ["--brand", "--accent", "--p-accent"])
      root.style.setProperty(key, color);
  }, [config.brand, panel]);
  return (
    <Context.Provider value={config}>
      {config.maintenance && (
        <div className="platform-maintenance" role="status">
          {config.maintenanceMessage}
        </div>
      )}
      {children}
      <div className="panel-dock">
        <button
          type="button"
          title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
          aria-label={
            theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"
          }
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        >
          <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
          <span className="theme-button-text">
            {theme === "dark" ? "Tema claro" : "Tema escuro"}
          </span>
        </button>
      </div>
    </Context.Provider>
  );
}
