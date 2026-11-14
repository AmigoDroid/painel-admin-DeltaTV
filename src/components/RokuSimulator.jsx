import React, { useEffect, useMemo, useRef, useState } from 'react';
import './roku-simulator.css';
import { SCREEN_DEFAULTS } from '@deltatv/ui/appearance';

// This is a browser-based visual/navigation prototype. It does not execute BrightScript,
// contact IPTV servers or claim to be the Roku emulator/certification environment.
export const SIM_SCREENS = Object.freeze([
  { id: 'login', title: 'Login' },
  { id: 'home', title: 'Início' },
  { id: 'live', title: 'TV ao vivo' },
  { id: 'movies', title: 'Filmes' },
  { id: 'series', title: 'Séries' },
]);
const GENRES = ['Todos', 'Aventura', 'Drama', 'Comédia', 'Documentários'];
const MOVIES = [
  ['Horizonte', 'Aventura'], ['Além do Mar', 'Drama'], ['Vida Nova', 'Comédia'],
  ['Rota do Sol', 'Documentário'], ['Cidade Lunar', 'Ficção'], ['O Encontro', 'Drama'],
  ['Veredas', 'Aventura'], ['Outra Estação', 'Drama'],
];
const SERIES = [
  ['Novos Caminhos', 'T1 · 8 episódios'], ['Universo Azul', 'T2 · 12 episódios'],
  ['As Fronteiras', 'T1 · 6 episódios'], ['Vento Norte', 'T3 · 10 episódios'],
  ['A Descoberta', 'T1 · 9 episódios'], ['Ponto de Partida', 'T2 · 7 episódios'],
  ['Pelos Ares', 'T1 · 5 episódios'], ['Entre Nós', 'T1 · 8 episódios'],
];
const CHANNELS = ['Notícias', 'Esportes', 'Cinema', 'Variedades', 'Música', 'Cultura'];
const NAV = [ ['home', 'Início'], ['live', 'TV ao vivo'], ['movies', 'Filmes'], ['series', 'Séries'] ];
const wrap = (n, max) => ((n % max) + max) % max;

export default function RokuSimulator({ config, screen: selectedScreen, onScreenChange }) {
  const [running, setRunning] = useState(false);
  const [localScreen, setLocalScreen] = useState('home');
  const screen = selectedScreen ?? localScreen;
  const copy = { ...SCREEN_DEFAULTS, ...(config.screens || {}) };
  const screenText = copy[screen] || SCREEN_DEFAULTS.home;
  const homeText = copy.home;
  const [focus, setFocus] = useState(0);
  const [detail, setDetail] = useState(null);
  const [genre, setGenre] = useState('Todos');
  const [search, setSearch] = useState('');
  const [showEmpty, setShowEmpty] = useState(false);
  const ref = useRef(null);
  const isCatalog = screen === 'movies' || screen === 'series';
  const collection = screen === 'series' ? SERIES : MOVIES;
  const items = useMemo(() => (showEmpty ? [] : collection).filter(([title, category]) =>
    (genre === 'Todos' || category.toLowerCase().includes(genre.toLowerCase())) &&
    title.toLowerCase().includes(search.trim().toLowerCase())), [collection, genre, search, showEmpty]);
  const maxFocus = screen === 'login' ? 3 : screen === 'home' ? (homeText.showFeatured ? 7 : 4) : isCatalog ? Math.max(1, items.length + 1) : (showEmpty ? 1 : CHANNELS.length);
  const chooseScreen = (next) => { setLocalScreen(next); onScreenChange?.(next); setFocus(0); setDetail(null); setSearch(''); setGenre('Todos'); };
  useEffect(() => { setFocus(0); setDetail(null); }, [config.template]);
  const run = () => { setRunning(true); setDetail(null); setFocus(0); ref.current?.focus(); };
  const stop = () => { setRunning(false); setDetail(null); };
  const select = (idx = focus) => {
    if (!running) return;
    if (detail) { setDetail(null); return; }
    if (screen === 'login') { if (idx === 2) chooseScreen('home'); else setFocus(idx + 1); return; }
    if (screen === 'home') {
      if (idx < NAV.length) chooseScreen(NAV[idx][0]);
      else setDetail(MOVIES[wrap(idx - NAV.length, MOVIES.length)][0]);
      return;
    }
    if (isCatalog) {
      if (idx === 0) { setGenre(GENRES[wrap(GENRES.indexOf(genre) + 1, GENRES.length)]); setFocus(0); }
      else if (items[idx - 1]) setDetail(items[idx - 1][0]);
    } else if (CHANNELS[idx]) setDetail(CHANNELS[idx]);
  };
  const remote = key => {
    if (!running) return;
    if (key === 'back') {
      if (detail) setDetail(null);
      else if (screen === 'login') return;
      else if (screen === 'home') chooseScreen('login');
      else chooseScreen('home');
    } else if (key === 'ok') select();
    else if (!detail) {
      const stride = screen === 'home' ? 3 : (screen === 'login' ? 1 : 4);
      const step = key === 'left' ? -1 : key === 'right' ? 1 : key === 'up' ? -stride : stride;
      setFocus(v => wrap(v + step, maxFocus));
    }
    ref.current?.focus();
  };
  const keydown = e => {
    const key = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right', Enter:'ok', Escape:'back', Backspace:'back' }[e.key];
    if (key) { e.preventDefault(); remote(key); }
  };
  const brand = config.brandName || 'Seu aplicativo';
  const labels = {home:'Início',live:homeText.liveLabel,movies:homeText.moviesLabel,series:homeText.seriesLabel};
  const tokens = { '--rs-bg':config.backgroundColor, '--rs-panel':config.panelColor,
    '--rs-accent':config.primaryColor, '--rs-fg':config.textColor };
  const target = (idx, body, extra='') => <button key={idx} type="button"
    className={`rs-target ${extra} ${running && focus === idx && !detail ? 'rs-focused' : ''}`}
    onMouseEnter={() => { if (running) setFocus(idx); }}
    onClick={() => { if (!running) return; setFocus(idx); select(idx); }}>{body}</button>;
  const badge = <span className="rs-brand"><span className="rs-brand-symbol">
    {config.logoUrl ? <img src={config.logoUrl} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /> : brand.slice(0,1).toUpperCase()}</span><b>{brand}</b></span>;
  const nav = <nav className="rs-navigation" aria-label="Navegação fictícia Roku">{NAV.map(([id,label]) =>
      <button type="button" key={id} className={`rs-nav-item ${screen === id ? 'rs-current' : ''}`}
        onClick={() => { if (running) chooseScreen(id); }}><span className="rs-nav-symbol">{["⌂", "◉", "▣", "▤"][NAV.findIndex(([key]) => key === id)]}</span><span className="rs-nav-text">{labels[id] || label}</span></button>)}</nav>;
  const posters = (data, offset=0) => data.map(([title, sub], idx) => target(idx+offset,
    <><span className={`rs-cover rs-cover-${idx % 8}`}><span className="rs-cover-mark">{String(idx+1).padStart(2,'0')}</span></span>
    <span className="rs-poster-text"><b>{title}</b><small>{sub}</small></span></>, 'rs-poster'));
  return <section className="rs-simulator" aria-label="Simulador visual de aplicativo Roku">
    <div className="rs-toolbar">
      <div className="rs-toolbar-group"><strong><span className="rs-live-dot" /> Simulador visual Roku</strong>
        <span className="rs-demo-label">Dados de demonstração — sem streaming real</span></div>
      <div className="rs-toolbar-group">
        <label className="rs-screen-picker">Tela
          <select aria-label="Escolha a tela da prévia" value={screen} onChange={e=>chooseScreen(e.target.value)}>
            {SIM_SCREENS.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        {(isCatalog||screen==='live')&&<label className="rs-empty-toggle"><input type="checkbox" checked={showEmpty} onChange={e=>setShowEmpty(e.target.checked)}/> Ver vazio</label>}
        <button type="button" className="rs-run" onClick={running?stop:run}>{running?'■ Parar':'▶ Rodar'}</button>
        <button type="button" className="rs-reset" onClick={()=>{chooseScreen('login');setRunning(true);ref.current?.focus();}}>Reiniciar</button>
      </div>
    </div>
    <div className="rs-tv-frame"><div ref={ref} tabIndex={0} onKeyDown={keydown} style={tokens}
      className={`rs-stage rs-template-${config.template} rs-screen-${screen} ${running?'rs-is-running':'rs-is-paused'}`}
      aria-label={`Prévia de ${screen}. Use setas, Enter e Esc para navegar quando estiver rodando.`}>
      {screen === 'login' ? <div className="rs-login">
        <div className="rs-login-side">{badge}<div className="rs-login-message"><span className="rs-overline">BEM-VINDO</span>
          <h3>{screenText.heading}</h3><p>{screenText.subtitle}</p></div>
          <span className="rs-login-foot">{screenText.footer}</span></div>
        <div className="rs-login-form"><span className="rs-overline">ENTRAR</span><h3>{screenText.heading}</h3><p>{screenText.subtitle}</p>
          {target(0,<>{screenText.userLabel} <span>seu usuário Xtream</span></>,'rs-input-mock')}
          {target(1,<>{screenText.passwordLabel} <span>••••••••••</span></>,'rs-input-mock')}
          {target(2,screenText.submitLabel,'rs-login-button')}
          <small>Simulação sem autenticação ou envio de senha.</small></div></div> : <>
        <aside className="rs-sidebar">{badge}<span className="rs-side-heading">NAVEGAR</span>{nav}<small>◉ Roku · Prévia</small></aside>
        <main className="rs-main">
          {screen === 'home' ? <>
            <div className="rs-home-intro"><span className="rs-overline">{config.template === 'mosaic' ? 'EXPLORAR' : config.template === 'minimal' ? 'BIBLIOTECA' : 'DESTAQUE'}</span>
              <h3>{screenText.heading}</h3><p>{screenText.subtitle}</p></div>
            {homeText.showBanner && config.template !== 'minimal' && config.template !== 'mosaic' && <div className="rs-hero" style={config.heroUrl ? {backgroundImage:`linear-gradient(90deg,var(--rs-bg),transparent),url(${JSON.stringify(config.heroUrl)})`}:undefined}>
              <span>ESCOLHAS PARA VOCÊ</span><b>{homeText.heading}</b><small>{homeText.subtitle}</small></div>}
            <div className="rs-quicknav">{NAV.map(([id,label],idx) => target(idx,<><span className="rs-nav-fig">{['⌂','◉','▣','▤'][idx]}</span><b>{labels[id] || label}</b></>,'rs-quick'))}</div>
            {homeText.showFeatured && <><div className="rs-row-title"><b>{homeText.featuredLabel}</b><span>VER TUDO</span></div>
            <div className="rs-poster-row">{posters(MOVIES.slice(0,3),4)}</div></>}
          </> : isCatalog ? <>
            <div className="rs-catalog-head"><div><span className="rs-overline">CATÁLOGO</span><h3>{screenText.heading}</h3><p>{screenText.subtitle}</p></div><span className="rs-search-pill">⌕ &nbsp;{screenText.searchLabel}</span></div>
            <div className="rs-catalog-content"><div className="rs-genres"><b>{screenText.categoriesLabel}</b>
              {target(0,<>▸ {genre}<small>OK para mudar</small></>,'rs-genre-active')}
              {GENRES.filter(g=>g!==genre).slice(0,3).map(g=><span key={g}>{g}</span>)}</div>
              <div className="rs-grid">{posters(items,1)}{items.length===0&&<p>{screenText.emptyLabel}</p>}</div></div>
          </> : <><div className="rs-catalog-head"><div><span className="rs-overline">AO VIVO</span><h3>{screenText.heading}</h3><p>{screenText.subtitle}</p></div></div>
            <div className="rs-channels">{showEmpty?<p>{screenText.emptyLabel}</p>:CHANNELS.map((c,i)=>target(i,<><span className="rs-channel-symbol">◉</span><b>{c}</b><small>Agora ao vivo</small></>,'rs-channel'))}</div></>}
        </main>
      </>}
      {detail && <div className="rs-detail"><div className="rs-detail-card"><span className="rs-overline">PRÉVIA</span><h3>{detail}</h3>
        <p>Detalhes ilustrativos. Nenhum conteúdo IPTV é reproduzido pelo simulador.</p>
        <button type="button" onClick={()=>setDetail(null)}>Voltar</button></div></div>}
      {!running && <div className="rs-paused"><b>Prévia pronta</b><small>Clique em Rodar para navegar como no controle remoto.</small>
        <button type="button" onClick={run}>▶ Rodar simulação</button></div>}
      <span className="rs-screen-watermark">PRÉVIA DEMONSTRATIVA</span>
    </div></div>
    <div className="rs-bottom">
      <div className="rs-remote" aria-label="Controle remoto virtual">
        <button type="button" disabled={!running} onClick={()=>remote('back')}>↶ Voltar</button>
        <span className="rs-dpad"><button aria-label="Seta para cima" disabled={!running} onClick={()=>remote('up')}>↑</button>
          <span><button aria-label="Seta para esquerda" disabled={!running} onClick={()=>remote('left')}>←</button>
          <button aria-label="OK" disabled={!running} onClick={()=>remote('ok')}>OK</button>
          <button aria-label="Seta para direita" disabled={!running} onClick={()=>remote('right')}>→</button></span>
          <button aria-label="Seta para baixo" disabled={!running} onClick={()=>remote('down')}>↓</button></span>
        <span className="rs-help">{running?'Use o controle acima ou clique na TV e use ↑ ↓ ← →, Enter e Esc.':'Escolha uma tela ou clique em Rodar para começar.'}</span>
      </div>
    </div>
  </section>;
}
