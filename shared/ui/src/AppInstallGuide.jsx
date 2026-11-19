import { useEffect, useState } from "react";
import logo from "./deltatv-brand-logo.png";
import rokuStoreArtwork from "./deltatv-roku-store.png";
import { clientInstructions, safeHttpLink, selectAndroidApp, selectRokuStore, isSamsungItem, isLgItem } from "./app-install-data.js";
import "./app-install-guide.css";

const DEVICES = [
  { id: "android", title: "Android", subtitle: "Celulares e tablets", icon: "android", status: "Disponível" },
  { id: "tvbox", title: "TV Box", subtitle: "Android TV e TV Box", icon: "tvbox", status: "Disponível" },
  { id: "roku", title: "TV Roku", subtitle: "Loja oficial de canais Roku", icon: "roku", status: "Disponível" },
  { id: "samsung", title: "Samsung", subtitle: "Smart TV Samsung", icon: "samsung", status: "Em breve" },
  { id: "lg", title: "LG", subtitle: "Smart TV LG", icon: "lg", status: "Em breve" },
];
const STEPS = {
  android: [
    "Abra esta página no celular ou tablet Android e toque em Baixar APK (quando disponível).",
    "Após o download, abra o arquivo APK e siga as instruções do Android para instalar de uma fonte confiável.",
    "Abra o DeltaTV e informe os dados de configuração fornecidos pelo responsável pelo seu acesso.",
  ],
  tvbox: [
    "Na TV Box ou Android TV, abra o aplicativo Downloader. Instale-o pela loja do aparelho, se necessário.",
    "Digite o código do Downloader exibido abaixo e confirme. Como alternativa, digite o endereço de download mostrado.",
    "Baixe e instale o APK, abra o DeltaTV e configure o acesso com os dados fornecidos pela revenda.",
  ],
  roku: [
    "Na tela inicial da TV Roku, acesse a Loja de Canais (ou Streaming Store).",
    "Use a busca e procure por DeltaTV. Selecione o aplicativo oficial nos resultados.",
    "Escolha Adicionar canal ou Instalar. Depois abra o DeltaTV e siga a configuração exibida na TV.",
  ],
};

function DeviceSymbol({ kind }) {
  if (kind === "android") return <svg viewBox="0 0 40 40" aria-hidden="true"><rect x="10" y="4" width="20" height="32" rx="5" fill="none" stroke="currentColor" strokeWidth="2"/><rect x="14" y="9" width="12" height="20" rx="2" fill="currentColor" opacity=".16"/><path d="M18 32h4" stroke="currentColor" strokeWidth="2"/></svg>;
  if (kind === "tvbox") return <svg viewBox="0 0 40 40" aria-hidden="true"><rect x="4" y="12" width="32" height="19" rx="5" stroke="currentColor" fill="none" strokeWidth="2"/><path d="m17 17 8 5-8 5z" fill="currentColor"/><circle cx="32" cy="28" r="1.3" fill="currentColor"/></svg>;
  if (kind === "roku") return <svg viewBox="0 0 40 40" aria-hidden="true"><rect x="14" y="3" width="12" height="34" rx="5" stroke="currentColor" fill="none" strokeWidth="2"/><circle cx="20" cy="13" r="4" stroke="currentColor" fill="none" strokeWidth="2"/><path d="M17 22h6M17 27h6M20 11v4M18 13h4" stroke="currentColor" strokeWidth="1.6"/></svg>;
  return <svg viewBox="0 0 40 40" aria-hidden="true"><rect x="4" y="6" width="32" height="23" rx="3" stroke="currentColor" fill="none" strokeWidth="2"/><path d="M20 29v6m-9 0h18" stroke="currentColor" strokeWidth="2"/></svg>;
}

async function copyText(text) {
  if (!navigator?.clipboard?.writeText) throw new Error("Não foi possível acessar a área de transferência.");
  await navigator.clipboard.writeText(String(text));
}

export default function AppInstallGuide({ loadDownloads }) {
  const [platform, setPlatform] = useState("tvbox");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [filter, setFilter] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = event => {
      if (event?.detail?.topic && !["downloads", "app-downloads"].includes(event.detail.topic)) return;
      setPage(1);
      setRevision(x => x + 1);
    };
    window.addEventListener("realtime-change", refresh);
    return () => window.removeEventListener("realtime-change", refresh);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    loadDownloads({ page, pageSize: 50 }).then(result => {
      if (!active) return;
      const rows = Array.isArray(result?.data) ? result.data : [];
      setItems(old => page === 1 ? rows : [...old.filter(x => !rows.some(y => y.id === x.id)), ...rows]);
      setPages(Math.max(1, Number(result?.meta?.totalPages) || 1));
      setError("");
    }).catch(err => { if (active) setError(err.message || "Falha ao consultar os downloads."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadDownloads, page, revision]);

  const android = selectAndroidApp(items);
  const roku = selectRokuStore(items);
  const selected = DEVICES.find(x => x.id === platform);
  const isSoon = platform === "samsung" || platform === "lg";
  const isAndroid = platform === "android" || platform === "tvbox";
  const main = isAndroid ? android : platform === "roku" ? roku : null;
  const mainHref = safeHttpLink(main?.downloadUrl);
  const visibleItems = items.filter(x => !isSamsungItem(x) && !isLgItem(x)).filter(x => `${x.name || ""} ${x.version || ""}`.toLocaleLowerCase("pt-BR").includes(filter.toLocaleLowerCase("pt-BR")));

  async function onCopy(value, message = "Copiado!") {
    try { await copyText(value); setFeedback(message); }
    catch { setFeedback("Não foi possível copiar automaticamente. Selecione o código ou endereço para copiá-lo."); }
  }
  return <section className="dt-guide" aria-label="Instalar DeltaTV">
    <div className="dt-guide-hero">
      <div className="dt-guide-hero-copy">
        <div className="dt-guide-eyebrow">CENTRAL DE APLICATIVOS</div>
        <h2>Delta<span>TV</span> em todos os seus dispositivos</h2>
        <p>Escolha onde deseja assistir e siga o passo a passo para baixar e instalar o aplicativo.</p>
        <div className="dt-guide-platforms"><span>Android</span><span>TV Box</span><span>Roku</span><span className="upcoming">Samsung · em breve</span><span className="upcoming">LG · em breve</span></div>
      </div>
      <div className="dt-guide-logo" aria-label="Logo do aplicativo DeltaTV"><img src={logo} alt="Logo DeltaTV"/><strong>Delta<span>TV</span></strong><small>Seu aplicativo de TV</small></div>
    </div>
    <div className="dt-guide-section-title"><div><h3>Escolha sua plataforma</h3><p>Toque no dispositivo para ver as instruções específicas.</p></div></div>
    <div className="dt-guide-devices" role="group" aria-label="Plataformas">
      {DEVICES.map(device => <button type="button" key={device.id} onClick={() => { setPlatform(device.id); setFeedback(""); }} aria-pressed={platform === device.id} className={`dt-guide-device ${platform === device.id ? "selected" : ""}`}>
        <span className="dt-guide-symbol">{device.id === "roku" ? <img className="dt-guide-roku-thumbnail" src={rokuStoreArtwork} alt="Ícone oficial do DeltaTV na Loja Roku" /> : <DeviceSymbol kind={device.icon}/>}</span><strong>{device.title}</strong><small>{device.subtitle}</small><span className={`dt-guide-tag ${device.status === "Em breve" ? "soon" : ""}`}>{device.status}</span>
      </button>)}
    </div>
    <div className="dt-guide-tutorial">
      <div className="dt-guide-tutorial-header"><div><span className="dt-guide-eyebrow">GUIA DE INSTALAÇÃO</span><h3>{selected.title}</h3><p>{isSoon ? "Esta plataforma está em preparação." : "Faça a instalação em três etapas."}</p></div><span className={`dt-guide-status ${isSoon ? "soon" : ""}`}>{selected.status}</span></div>
      {isSoon ? <div className="dt-guide-not-yet"><strong>DeltaTV para {selected.title} — em breve</strong><p>O aplicativo para {selected.title} ainda não foi lançado. Não há download disponível para esta plataforma neste momento.</p></div> : <>
        <ol className="dt-guide-steps">{STEPS[platform].map((s,i) => <li key={s}><b>{i + 1}</b><span>{s}</span></li>)}</ol>
        {isAndroid ? <div className="dt-guide-download-info">
          <div className="dt-guide-download-label"><strong>Instalação Android / TV Box</strong><small>O código e o endereço são carregados do catálogo publicado pela DeltaTV.</small></div>
          {android?.downloaderCode ? <div className="dt-guide-code"><div><small>Código do Downloader</small><strong>{android.downloaderCode}</strong></div><button type="button" onClick={() => onCopy(android.downloaderCode, "Código copiado!")}>Copiar código</button></div> : <p className="dt-guide-muted">Nenhum código do Downloader cadastrado para este aplicativo.</p>}
          {mainHref ? <div className="dt-guide-actions"><a className="dt-guide-primary" href={mainHref} target="_blank" rel="noopener noreferrer">Baixar APK / Abrir link</a><button type="button" onClick={() => onCopy(mainHref, "Link copiado!")}>{android?.hosted ? "Copiar link da VPS" : "Copiar link de download"}</button></div> : <p className="dt-guide-muted">O link direto ainda não foi cadastrado. Peça ao responsável pelo painel para publicá-lo em Aplicativos.</p>}
          {mainHref && <p className="dt-guide-link">{mainHref}</p>}
          {android && <button type="button" className="dt-guide-share" onClick={() => onCopy(clientInstructions(android), "Instruções copiadas para enviar ao cliente!")}>Copiar instruções para o cliente</button>}
        </div> : <div className="dt-guide-download-info"><div className="dt-guide-roku-identify"><img src={rokuStoreArtwork} alt="Ícone oficial do DeltaTV na Loja Roku" /><span><strong>Reconheça o DeltaTV na Loja Roku</strong><small>Este é o ícone do aplicativo publicado na loja.</small></span></div><strong>DeltaTV na loja oficial Roku</strong><p>Para instalar, pesquise o aplicativo diretamente na Loja de Canais da sua TV Roku. Não instale APK na Roku.</p>{mainHref && <div className="dt-guide-actions"><a className="dt-guide-primary" href={mainHref} target="_blank" rel="noopener noreferrer">Abrir link da Roku cadastrado</a><button type="button" onClick={() => onCopy(mainHref)}>Copiar link</button></div>}{!mainHref && <a className="dt-guide-primary dt-guide-store" href="https://channelstore.roku.com/pt-br/browse?locale=pt-br" target="_blank" rel="noopener noreferrer">Abrir Loja de Canais Roku</a>}</div>}
      </>}
    </div>
    {feedback && <p className="dt-guide-feedback" role="status">{feedback}</p>}
    <div className="dt-guide-catalog"><div className="dt-guide-section-title"><div><h3>Downloads e links cadastrados</h3><p>Consulte outros aplicativos e endereços publicados pela administração.</p></div></div>
      <label className="dt-guide-search">Pesquisar no catálogo <input type="search" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Nome ou versão"/></label>
      {error && <div className="dt-guide-error" role="alert">{error} <button type="button" onClick={() => setRevision(x => x + 1)}>Tentar novamente</button></div>}
      {!loading && !error && !items.length && <p className="dt-guide-muted">Ainda não há aplicativos ou links cadastrados. Os guias acima continuam disponíveis.</p>}
      {visibleItems.length > 0 && <div className="dt-guide-catalog-grid">{visibleItems.map(item => <article className="dt-guide-entry" key={item.id}><div className="dt-guide-entry-top"><img src={logo} alt=""/><div><strong>{item.name}</strong><small>{item.kind === "link" ? "Link útil" : "Aplicativo"}{item.version ? ` · v${item.version}` : ""}</small></div></div>{item.downloaderCode && <div className="dt-guide-entry-code"><span>Downloader: <strong>{item.downloaderCode}</strong></span><button type="button" onClick={() => onCopy(item.downloaderCode)}>Copiar</button></div>}{safeHttpLink(item.downloadUrl) ? <div className="dt-guide-actions"><a href={safeHttpLink(item.downloadUrl)} target="_blank" rel="noopener noreferrer">Abrir link</a><button type="button" onClick={() => onCopy(safeHttpLink(item.downloadUrl))}>Copiar link</button></div> : <span className="dt-guide-muted">Sem endereço válido</span>}</article>)}</div>}
      {loading && <p className="dt-guide-muted" role="status">Carregando catálogo…</p>}
      {!loading && page < pages && <button type="button" className="dt-guide-more" onClick={() => setPage(x => x + 1)}>Carregar mais aplicativos</button>}
    </div>
  </section>;
}
