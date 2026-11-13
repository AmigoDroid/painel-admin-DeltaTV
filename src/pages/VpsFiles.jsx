import { useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import "../vps-files.css";

function formatBytes(raw) {
  if (raw === null || raw === undefined) return "—";
  const value = Number(raw);
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.max(0, Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024))));
  return `${(value / 1024 ** i).toLocaleString("pt-BR", { maximumFractionDigits: i > 1 ? 2 : 0 })} ${units[i]}`;
}

function DiskCard({ disk, label }) {
  if (!disk) return <div className="vfm-disk card"><strong>{label}</strong><span className="muted">Espaço não disponível neste volume</span></div>;
  const used = Number(disk.usedBytes);
  const total = Number(disk.totalBytes);
  const pct = total ? Math.min(100, Math.max(0, (100 * used) / total)) : 0;
  return <section className="vfm-disk card">
    <div className="vfm-disk-head"><div><small className="muted">Armazenamento da VPS</small><h3>{label}</h3></div><strong>{pct.toFixed(1).replace(".", ",")}%</strong></div>
    <div className="vfm-meter" role="progressbar" aria-label="Espaço utilizado" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(pct)}><span style={{ width: `${pct}%` }} /></div>
    <div className="vfm-disk-totals"><span>{formatBytes(disk.usedBytes)} ocupados</span><span>{formatBytes(disk.availableBytes)} disponíveis</span><span>{formatBytes(disk.totalBytes)} no volume</span></div>
  </section>;
}

export default function VpsFiles() {
  const [roots, setRoots] = useState([]);
  const [activeRoot, setActiveRoot] = useState(null);
  const [relative, setRelative] = useState("");
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let live = true;
    api("/admin/system/files/roots").then((data) => {
      if (!live) return;
      const list = data.roots || [];
      setRoots(list);
      setActiveRoot((selected) => selected && list.some((r) => r.id === selected) ? selected : (list.find((r) => r.available)?.id || null));
    }).catch((err) => { if (live) setError(err.message || "Não foi possível carregar as pastas."); });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!activeRoot) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setInfo(null);
    api("/admin/system/files/browse", { query: { root: activeRoot, path: relative }, signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setInfo(data);
    }).catch((err) => {
      if (!controller.signal.aborted) setError(err.message || "Não foi possível abrir a pasta.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [activeRoot, relative, revision]);

  const selected = roots.find((r) => r.id === activeRoot);
  const crumbs = useMemo(() => relative ? relative.split("/") : [], [relative]);
  const navigate = (entry) => setRelative((prev) => prev ? `${prev}/${entry}` : entry);
  const up = () => setRelative((prev) => prev.split("/").slice(0, -1).join("/"));
  const refresh = () => setRevision((n) => n + 1);
  return <div className="vfm-page">
    <header className="vfm-intro">
      <div><h2>Arquivos e armazenamento da VPS</h2><p className="muted">Consulte o espaço ocupado por cada pasta. Explorador somente leitura, exclusivo do Superadmin.</p></div>
      <button className="btn" onClick={refresh} disabled={loading || !activeRoot}>Atualizar</button>
    </header>
    <div className="vfm-root-picker" role="group" aria-label="Pastas disponíveis">
      {roots.map((root) => <button key={root.id} type="button" disabled={!root.available} className={`btn ${root.id === activeRoot ? "primary" : ""}`} onClick={() => { setActiveRoot(root.id); setRelative(""); }} title={root.label}>{root.label}{!root.available && " (indisponível)"}</button>)}
      {roots.length === 0 && !error && <p className="muted">Nenhuma pasta foi autorizada no servidor.</p>}
    </div>
    {selected && <DiskCard disk={info?.disk || selected.disk} label={selected.label} />}
    <section className="card vfm-browser">
      <div className="vfm-toolbar">
        <nav className="vfm-breadcrumbs" aria-label="Caminho da pasta">
          <button type="button" onClick={() => setRelative("")} disabled={!relative}>{selected?.label || "Pastas"}</button>
          {crumbs.map((part, index) => <span key={`${part}-${index}`}><span aria-hidden="true">/</span><button type="button" onClick={() => setRelative(crumbs.slice(0, index + 1).join("/"))}>{part}</button></span>)}
        </nav>
        <span className="vfm-total">Pasta atual: {formatBytes(info?.folderBytes)}</span>
      </div>
      <div className="vfm-bar"><strong>Nome</strong><strong>Tipo</strong><strong>Tamanho</strong></div>
      {relative && <button className="vfm-entry vfm-up" type="button" onClick={up}><span>↩ Pasta anterior</span><span>Pasta</span><span>—</span></button>}
      {loading && <p className="vfm-message muted">Analisando o armazenamento sem interromper a API…</p>}
      {error && <p className="vfm-message vfm-error" role="alert">{error}</p>}
      {!loading && info?.entries?.map((entry) => <div className="vfm-entry" key={entry.name}>
        <div className="vfm-entry-name">
          <span aria-hidden="true">{entry.type === "directory" ? "📁" : "📄"}</span>
          {entry.type === "directory" ? <button type="button" title={`Abrir ${entry.name}`} onClick={() => navigate(entry.name)}>{entry.name}</button> : <span title={entry.name}>{entry.name}</span>}
        </div>
        <span className="muted">{entry.type === "directory" ? "Pasta" : "Arquivo"}</span>
        <strong>{formatBytes(entry.bytes)}</strong>
      </div>)}
      {!loading && info?.entries?.length === 0 && <p className="vfm-message muted">Esta pasta não possui itens visíveis.</p>}
      {info?.truncated && <p className="vfm-message muted">Lista limitada aos primeiros 300 itens. Os demais não são exibidos.</p>}
      {info?.sizesPartial && <p className="vfm-message vfm-warning">Alguns tamanhos não puderam ser calculados (pasta extensa, permissão ou outra análise em andamento). Os valores ausentes aparecem como “—”.</p>}
    </section>
    <p className="vfm-footnote muted">Os tamanhos das pastas são calculados pelo espaço alocado no disco e ficam em cache por até 2 minutos. Links simbólicos, arquivos ocultos e pastas privadas não são navegáveis. O explorador não permite baixar, alterar ou excluir arquivos.</p>
  </div>;
}
