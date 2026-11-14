import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "./help-experience.css";

// Only these logical names are accepted by the backend. Never execute selectors from article text.
const PAGES = {
  content: { home: "overview", help: "help", profile: "account", servers: "servers", codes: "codes", devices: "devices", licenses: "licenses", billing: "billing", studio: "studio", apps: "white-label", notifications: "notifications" },
  reseller: { home: "inicio", help: "ajuda", profile: "conta", servers: "servidores", codes: "codigos", devices: "dispositivos", licenses: "licencas", billing: "financeiro", studio: "white-label", apps: "white-label", notifications: "notificacoes" },
};
const TARGET_NAMES = { home: "Início", help: "Central de Ajuda", profile: "Minha conta", servers: "Servidores", codes: "Códigos", devices: "Dispositivos", licenses: "Licenças", billing: "Financeiro", studio: "Estúdio Visual", apps: "Meus aplicativos", notifications: "Notificações", "add-server": "Adicionar servidor", "new-code": "Novo código", "search-device": "Buscar MAC", "context-help": "? Ajuda" };
const TARGETS = new Set(Object.keys(TARGET_NAMES));
const textLines = value => String(value || "").split(/\n+/).map(s => s.trim()).filter(Boolean);
const stepCount = article => (Array.isArray(article?.steps) ? article.steps.length : 0);
const cappedStep = (article, index) => Math.max(0, Math.min(Number(index) || 0, Math.max(0, stepCount(article) - 1)));
const percent = (article, saved) => saved?.completedAt ? 100 : saved ? Math.round(cappedStep(article, saved.stepIndex) / Math.max(1, stepCount(article)) * 100) : 0;

function StepChecklist({ article, progress, startAt }) {
  const count = stepCount(article);
  return <ol className="help16-checklist" aria-label="Etapas do guia">
    {(article.steps || []).map((s, i) => {
      const done = Boolean(progress?.completedAt || (progress && i < progress.stepIndex));
      return <li key={i} className={done ? "help16-step-done" : ""}>
        <span className="help16-checkmark" aria-hidden="true">{done ? "✓" : i + 1}</span>
        <div><strong>{s.title}</strong><p>{s.body}</p>{s.tip && <small>Confira: {s.tip}</small>}
          {s.mode === "external" && <em>Na TV Roku / no celular</em>}
        </div>
        <button type="button" onClick={() => startAt(i)} aria-label={`Abrir etapa ${i + 1}: ${s.title}`}>{done ? "Rever" : "Ver etapa"}</button>
      </li>;
    })}
    {!count && <li>Este guia não possui etapas interativas.</li>}
  </ol>;
}

function TvGuideVisual({ slug }) {
  const ownBrand = slug === "roku-white-label-login";
  const multiple = slug === "roku-delta-varias-listas";
  const problems = slug === "roku-problemas-de-conexao";
  const remote = slug === "roku-delta-controle";
  return <div className="help16-tv-preview" role="img" aria-label="Diagrama ilustrativo do caminho na televisão Roku">
    <div className="help16-tv-monitor"><div className="help16-tv-header">{ownBrand ? "SEU APLICATIVO" : "DELTA TV"}<span>ROKU</span></div>
      {multiple ? <><strong>Configurações → Conteúdo</strong><div className="help16-tv-field">Gerenciador de listas</div><div className="help16-tv-focus">▸ Adicionar lista</div><div className="help16-tv-field">Usar esta lista</div></>
      : problems ? <><strong>Verificar conexão</strong><div className="help16-tv-field">Rede e credenciais</div><div className="help16-tv-focus">▸ Mensagem do aplicativo</div><div className="help16-tv-field">Testar reprodução</div></>
      : remote || ownBrand ? <><strong>{ownBrand ? "Entre com sua conta IPTV" : "Conectar dispositivo"}</strong>{!ownBrand && <div className="help16-tv-field">Código da parceria / licença</div>}<div className="help16-tv-field">Usuário IPTV {ownBrand ? "" : "/ nome da lista"}</div><div className="help16-tv-field">Senha IPTV {ownBrand ? "" : "/ URL da playlist"}</div><div className="help16-tv-focus">▸ CONECTAR</div></>
      : <><strong>Conectar dispositivo</strong><div className="help16-tv-qr"><span aria-hidden="true">▦</span><div>QR Code na TV<br/><small>Escaneie com o celular</small></div></div><div className="help16-tv-focus">▸ CONECTAR</div></>}
    </div><small>Diagrama ilustrativo: os botões e textos podem variar entre versões. Este não é um QR Code funcional.</small>
  </div>;
}

export default function HelpExperience({screen, portal = "content", userId, onNavigate, api}) {
  const pages = PAGES[portal] || PAGES.content;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [welcome, setWelcome] = useState(false);
  const [tour, setTour] = useState(null);
  const [focusRect, setFocusRect] = useState(null);
  const [targetFound, setTargetFound] = useState(false);
  const [targetClicked, setTargetClicked] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todos");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tourCollapsed, setTourCollapsed] = useState(false);
  const [mobilePlacement, setMobilePlacement] = useState("bottom");
  const readerRef = useRef(null);
  const articles = data?.data || [];
  const progressMap = useMemo(() => Object.fromEntries((data?.progress || []).map(p => [p.articleId, p])), [data]);
  const selectedArticle = articles.find(a => a.id === selected);
  const categories = useMemo(() => ["Todos", ...new Set(articles.map(a => a.category))], [data]);
  const filtered = articles.filter(a => (category === "Todos" || category === a.category) && `${a.title} ${a.summary} ${a.category} ${a.body} ${(a.steps || []).map(s => `${s.title} ${s.body} ${s.tip || ""}`).join(" ")}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));
  const currentStep = tour?.article?.steps?.[tour.index] || null;
  const isExternalStep = currentStep?.mode === "external";
  const helpScreen = pages.help;
  const reload = useCallback(async () => { const result = await api("/partner/help"); setData(result); return result; }, [api]);

  useEffect(() => {
    let active = true;
    setLoading(true); setData(null); setTour(null); setSelected(null); setWelcome(false); setError("");
    api("/partner/help").then(result => {
      if (!active) return;
      setData(result);
      const starter = result.data?.find(a => a.isOnboarding && a.slug === "primeiros-passos") || result.data?.find(a => a.isOnboarding);
      if (!result.welcomeSeenAt && starter) setWelcome(true);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  const markWelcome = async () => {
    setWelcome(false);
    setData(d => d ? { ...d, welcomeSeenAt: d.welcomeSeenAt || new Date().toISOString() } : d);
    try { await api("/partner/help/welcome-seen", { method: "POST" }); }
    catch (e) { setError(`Não foi possível registrar boas-vindas: ${e.message}`); }
  };
  const saveProgress = async (article, index, completed = false) => {
    try {
      const value = await api(`/partner/help/${article.id}/progress`, { method: "PUT", body: { stepIndex: index, completed } });
      setData(d => d ? { ...d, progress: [...(d.progress || []).filter(p => p.articleId !== article.id), value] } : d);
      return true;
    } catch (e) { setError(`Não foi possível salvar esta etapa: ${e.message}`); return false; }
  };
  const begin = async (article, at = null) => {
    if (!article) return;
    setError(""); setWelcome(false);
    if (stepCount(article)) {
      const saved = progressMap[article.id];
      const start = at === null ? (saved?.completedAt ? 0 : saved?.stepIndex || 0) : at;
      setTour({ article, index: cappedStep(article, start) });
      setTourCollapsed(false);
      setTargetClicked(false); setFocusRect(null);
    } else {
      await saveProgress(article, 0, true);
      setSelected(article.id); onNavigate(helpScreen);
    }
  };
  const advance = async () => {
    if (!tour || busy) return;
    setBusy(true);
    const next = tour.index + 1;
    const completed = next >= stepCount(tour.article);
    const ok = await saveProgress(tour.article, completed ? tour.index : next, completed);
    if (ok) {
      if (completed) { setTour(null); setFocusRect(null); setSelected(tour.article.id); onNavigate(helpScreen); }
      else { setTour(t => ({ ...t, index: next })); setTargetClicked(false); setFocusRect(null); }
    }
    setBusy(false);
  };
  const exitTour = () => { setTour(null); setFocusRect(null); setTourCollapsed(false); setSelected(tour?.article.id || null); };

  // Ao abrir um artigo em um telefone, levá-lo para a área visível sem perder o foco do teclado.
  useEffect(() => {
    if (!selectedArticle || screen !== helpScreen) return;
    const reader = readerRef.current;
    if (!reader) return;
    reader.scrollIntoView({ behavior: "smooth", block: "start" });
    reader.focus({ preventScroll: true });
  }, [selected, screen]);

  useEffect(() => {
    if (!currentStep || currentStep.mode === "external") return;
    const logical = currentStep.screen || (pages[currentStep.target] ? currentStep.target : null);
    const destination = pages[logical];
    if (destination && destination !== screen) onNavigate(destination);
  }, [tour?.article?.id, tour?.index, screen, onNavigate]);

  useEffect(() => {
    if (!currentStep || currentStep.mode === "external" || !TARGETS.has(currentStep.target)) { setFocusRect(null); setTargetFound(false); return; }
    let element = null;
    let didScroll = false;
    let menuRequested = false;
    let raf = 0;
    const place = () => {
      // A navegação desktop pode existir no DOM, mas estar invisível no celular.
      const next = [...document.querySelectorAll(`[data-help-target="${currentStep.target}"]`)]
        .find(node => { const rect = node.getBoundingClientRect(); return rect.width >= 2 && rect.height >= 2; }) || null;
      if (!next && !menuRequested && window.innerWidth <= 800 && pages[currentStep.target]) {
        menuRequested = true;
        window.dispatchEvent(new CustomEvent("deltatv-help-open-menu"));
      }
      if (next !== element) {
        if (element) element.removeEventListener("click", acknowledge, true);
        element = next;
        if (element) element.addEventListener("click", acknowledge, true);
      }
      setTargetFound(Boolean(element));
      if (!element) { setFocusRect(null); return; }
      const r = element.getBoundingClientRect();
      // Colocar as instruções longe da opção marcada, para que ela continue tocável.
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      setMobilePlacement(r.top >= viewportHeight * 0.48 ? "top" : "bottom");
      if (!didScroll && (r.bottom > window.innerHeight - 80 || r.top < 60)) {
        didScroll = true; element.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      setFocusRect(r.width >= 2 && r.height >= 2 && r.bottom >= 0 && r.top <= window.innerHeight && r.right >= 0 && r.left <= window.innerWidth
        ? { top: Math.max(3, r.top - 6), left: Math.max(3, r.left - 6), width: r.width + 12, height: r.height + 12 }
        : null);
    };
    const acknowledge = () => setTargetClicked(true);
    const observer = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); });
    observer.observe(document.body, { childList: true, subtree: true });
    raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.visualViewport?.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { observer.disconnect(); cancelAnimationFrame(raf); window.removeEventListener("resize", place); window.visualViewport?.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); if (element) element.removeEventListener("click", acknowledge, true); };
  }, [tour?.article?.id, tour?.index, screen]);

  useEffect(() => {
    if (!tour && !welcome) return undefined;
    const esc = e => { if (e.key === "Escape") { if (tour) exitTour(); else void markWelcome(); } };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [tour, welcome]);
  useEffect(() => {
    const handler = event => {
      const logical = Object.entries(pages).find(([, route]) => route === event.detail?.screen)?.[0];
      const relevant = articles.find(a => a.steps?.some(s => s.screen === logical || s.target === logical));
      setCategory("Todos"); setSearch(""); setSelected(relevant?.id || null); onNavigate(helpScreen);
    };
    window.addEventListener("deltatv-help-context", handler);
    return () => window.removeEventListener("deltatv-help-context", handler);
  }, [helpScreen, onNavigate, data]);

  const openGuide = slug => {
    const article = articles.find(a => a.slug === slug);
    if (article) { setCategory("Todos"); setSearch(""); setSelected(article.id); onNavigate(helpScreen); }
  };
  const tvGuides = articles.filter(a => a.category === "Configurar TV");

  return <>
    {screen === helpScreen && <section className="help15-center" aria-label="Central de Ajuda">
      <div className="help15-hero"><span className="help15-overline">CENTRAL DE APRENDIZADO</span><h2>Aprenda a usar sua plataforma</h2><p>Guias detalhados, opções destacadas no painel e treinamento para conectar uma lista IPTV à TV Roku. Cada etapa feita fica marcada no seu progresso.</p><div className="help15-search"><span aria-hidden="true">⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ex.: QR Code, adicionar lista, servidores, licença" aria-label="Buscar tutoriais" /></div></div>
      {error && <p role="alert" className="help15-error">{error} <button type="button" onClick={() => { setError(""); void reload().catch(e => setError(e.message)); }}>Tentar novamente</button></p>}
      {loading ? <p>Carregando tutoriais…</p> : !data ? <p>Não foi possível carregar a Central de Ajuda.</p> : <>
        {tvGuides.length > 0 && <div className="help16-tv-banner"><div><span className="help15-overline">PASSO A PASSO PARA A TELEVISÃO</span><h3>Como colocar a lista IPTV na Roku?</h3><p>Escolha o método que aparece no seu aplicativo. O DeltaTV tem QR ou cadastro pelo controle; o aplicativo white-label usa usuário e senha.</p></div><div className="help16-tv-actions">
          {articles.some(a => a.slug === "roku-delta-qr") && <button type="button" onClick={() => openGuide("roku-delta-qr")}>Usar QR Code</button>}
          {articles.some(a => a.slug === "roku-delta-controle") && <button type="button" onClick={() => openGuide("roku-delta-controle")}>Configurar pelo controle</button>}
          {articles.some(a => a.slug === "roku-white-label-login") && <button type="button" onClick={() => openGuide("roku-white-label-login")}>App com marca própria</button>}
        </div></div>}
        <div className="help15-categories" role="group" aria-label="Filtrar tutoriais por assunto">{categories.map(c => <button key={c} type="button" className={category === c ? "active" : ""} onClick={() => { setCategory(c); setSelected(null); }}>{c}</button>)}</div>
        {selectedArticle && <article className="help15-reader" id="help15-reader" ref={readerRef} tabIndex={-1}><div className="help15-reader-title"><div><span className="help15-overline">GUIA DETALHADO</span><h3>{selectedArticle.title}</h3></div><button type="button" onClick={() => setSelected(null)} aria-label="Fechar leitura">×</button></div>
          {selectedArticle.imageUrl && <img loading="lazy" alt={`Ilustração do guia ${selectedArticle.title}`} src={selectedArticle.imageUrl} />}
          {textLines(selectedArticle.body).map((p, i) => <p key={i}>{p}</p>)}
          {selectedArticle.category === "Configurar TV" && <TvGuideVisual slug={selectedArticle.slug} />}
          {selectedArticle.videoUrl && <p><a href={selectedArticle.videoUrl} target="_blank" rel="noopener noreferrer">▶ Assistir ao vídeo do tutorial</a></p>}
          {stepCount(selectedArticle) > 0 && <><div className="help16-guide-head"><h4>Etapas do treinamento</h4><span>{percent(selectedArticle, progressMap[selectedArticle.id])}% concluído</span></div><StepChecklist article={selectedArticle} progress={progressMap[selectedArticle.id]} startAt={index => void begin(selectedArticle, index)} /><button type="button" className="help15-primary" onClick={() => void begin(selectedArticle)}>{progressMap[selectedArticle.id]?.completedAt ? "Repetir treinamento" : "Iniciar ou continuar passo a passo"}</button></>}
        </article>}
        <div className="help15-grid">{filtered.map(article => { const progress = progressMap[article.id]; return <article key={article.id} className={`help15-card ${selected === article.id ? "help15-active" : ""}`}>
          <div className="help15-kicker"><span>{article.category}</span>{progress?.completedAt && <span className="help15-done">✓ Concluído</span>}</div>
          <h3>{article.title}</h3><p>{article.summary}</p><small className="help16-step-count">{stepCount(article)} etapas de aprendizado</small>
          {progress && <div className="help15-progress" aria-label={`Progresso ${percent(article, progress)}%`}><div style={{ width: `${percent(article, progress)}%` }}/></div>}
          <div className="help15-actions"><button type="button" onClick={() => setSelected(s => s === article.id ? null : article.id)}>{selected === article.id ? "Fechar" : "Ler guia detalhado"}</button><button type="button" className="help15-primary" onClick={() => void begin(article)}>{progress && !progress.completedAt ? "Continuar" : "Iniciar"}</button></div>
        </article>; })}</div>
        {!filtered.length && <div className="help15-empty">Nenhum guia encontrado com esses filtros.</div>}
      </>}
    </section>}
    {welcome && <div className="help15-modal-cover" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="help15-welcome-title" className="help15-welcome">
      <span className="help15-overline">BEM-VINDO AO DELTATV</span><div className="help15-welcome-icon" aria-hidden="true">?</div><h2 id="help15-welcome-title">Vamos conhecer seu painel?</h2><p>O guia destaca as opções reais, explica cada ação e marca seu progresso. Também há um tutorial para instalar/configurar o aplicativo na TV.</p>
      <div className="help15-actions"><button type="button" onClick={() => void markWelcome()}>Agora não</button><button type="button" className="help15-primary" onClick={() => { const starter = articles.find(a => a.slug === "primeiros-passos") || articles.find(a => a.isOnboarding); void markWelcome(); void begin(starter); }}>Começar tour</button></div>
    </section></div>}
    {tour && currentStep && <div className="help15-tour" role="dialog" aria-modal="false" aria-label="Tutorial guiado">
      {focusRect && !isExternalStep && <div className="help15-highlight" style={focusRect} aria-hidden="true" />}
      {tourCollapsed ? <button type="button" className="help17-tour-minimized" onClick={() => setTourCollapsed(false)} aria-label="Mostrar instruções do tutorial"><span>Guia · Etapa {tour.index + 1}/{stepCount(tour.article)}</span><strong>Mostrar instruções ↑</strong></button> : <div className={`help15-tour-popover help17-tour-${mobilePlacement}`}><div className="help15-tour-progress"><span>{isExternalStep ? "📺 NA TV / CELULAR" : "◎ NO SEU PAINEL"} · ETAPA {tour.index + 1}/{stepCount(tour.article)}</span><div className="help17-tour-toolbar"><button type="button" className="help17-minimize" onClick={() => setTourCollapsed(true)} aria-label="Recolher instruções para acessar o botão destacado">Recolher</button><button type="button" onClick={exitTour} aria-label="Sair do tutorial">×</button></div></div>
        <h3>{currentStep.title}</h3><p>{currentStep.body}</p>
        {currentStep.tip && <div className="help16-tip"><strong>Como conferir:</strong> {currentStep.tip}</div>}
        {!isExternalStep && currentStep.target && <p className="help15-location">{targetClicked ? "✓ Você clicou na opção marcada" : targetFound && focusRect ? `◉ Opção destacada: ${TARGET_NAMES[currentStep.target] || "Menu"}. Clique nela para praticar.` : `◌ Opção: ${TARGET_NAMES[currentStep.target] || "Menu"}. Ela pode estar oculta pelo tamanho da tela ou pelas permissões da conta.`}</p>}
        {isExternalStep && <p className="help15-location">Esta ação acontece fora do painel. Faça na sua Roku ou no celular e depois marque a etapa como concluída.</p>}
        <ol className="help16-tour-steps" aria-label="Progresso das etapas">{tour.article.steps.map((step, i) => <li key={i} className={i < tour.index ? "done" : i === tour.index ? "current" : ""} title={step.title}>{i < tour.index ? "✓" : i + 1}</li>)}</ol>
        {error && <p role="alert" className="help15-error">{error}</p>}
        <div className="help15-actions"><button type="button" onClick={exitTour}>Sair</button>{tour.index > 0 && <button type="button" onClick={() => { setTour(t => ({ ...t, index: t.index - 1 })); setTargetClicked(false); }}>Anterior</button>}<button type="button" className="help15-primary" disabled={busy} onClick={() => void advance()}>{busy ? "Salvando…" : tour.index === stepCount(tour.article) - 1 ? "✓ Concluir treinamento" : "✓ Marcar feita e continuar"}</button></div>
      </div>}
    </div>}
  </>;
}
