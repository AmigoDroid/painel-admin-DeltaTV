import { useEffect, useRef, useState } from "react";
import "./workspace-dashboard.css";

/** Um ambiente de trabalho por domínio. Somente a navegação é compartilhada;
 * operações e autorização permanecem nos módulos e APIs originais. */
export default function WorkArea({area,route,go,back,allowed,renderPage,renderIcon}) {
  const entries = area.items.filter(item => allowed(item.page));
  const active = entries.find(item => item.id === route);
  const [menuOpen,setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  const sidebar = useRef(null);
  const main = useRef(null);
  const previous = useRef(route);
  const select = id => {setMenuOpen(false);go(id);};
  useEffect(() => {
    setMenuOpen(false);
    if(previous.current !== route) {
      window.scrollTo(0,0);
      if(window.matchMedia('(max-width:860px)').matches) main.current?.focus();
      previous.current = route;
    }
  },[route]);
  useEffect(() => {
    if(!menuOpen) return;
    const was = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = [...sidebar.current.querySelectorAll('button:not([disabled])')];
    focusable[0]?.focus();
    const handle = event => {
      if(event.key === 'Escape') {setMenuOpen(false);menuButton.current?.focus();}
      if(event.key === 'Tab' && focusable.length) {
        const first = focusable[0], last = focusable[focusable.length-1];
        if(event.shiftKey && document.activeElement === first){event.preventDefault();last.focus();}
        else if(!event.shiftKey && document.activeElement === last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',handle);
    return () => {document.body.style.overflow=was;document.removeEventListener('keydown',handle);};
  },[menuOpen]);
  const heading = active?.label || 'Visão geral';
  return <div className="dw-dashboard">
    {menuOpen && <button type="button" className="dw-scrim" aria-label="Fechar menu da área" onClick={()=>{setMenuOpen(false);menuButton.current?.focus();}} />}
    <aside ref={sidebar} className={'dw-sidebar'+(menuOpen?' dw-sidebar-open':'')} aria-label={'Menu de '+area.label} id="dw-menu">
      <div className="dw-brand"><span className="dw-brand-mark" aria-hidden="true">Δ</span><div><strong>DeltaTV</strong><small>{area.label}</small></div></div>
      <button type="button" className="dw-exit" onClick={back}>← Voltar ao painel principal</button>
      <span className="dw-nav-caption">ÁREA DE TRABALHO</span>
      <nav className="dw-nav" aria-label={'Seções de '+area.label}>
        <button type="button" aria-current={!active?'page':undefined} className={'dw-nav-item'+(!active?' dw-current':'')} onClick={()=>select(area.id)}><span className="dw-nav-symbol">⌂</span><span>Visão geral</span></button>
        {entries.map(item=><button type="button" key={item.id} aria-current={active?.id===item.id?'page':undefined} className={'dw-nav-item'+(active?.id===item.id?' dw-current':'')} onClick={()=>select(item.id)}><span className="dw-nav-symbol">{renderIcon?.(item)}</span><span>{item.label}</span></button>)}
      </nav>
      <div className="dw-sidebar-foot">Operações disponíveis conforme sua conta. Permissões validadas pelo servidor.</div>
    </aside>
    <div className="dw-main">
      <header className="dw-topbar"><div className="dw-topbar-left"><button ref={menuButton} type="button" className="dw-menu-toggle" aria-label="Abrir menu da área" aria-controls="dw-menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(true)}>☰</button><div className="dw-crumb"><button type="button" onClick={back}>Painel</button><span aria-hidden="true">/</span><button type="button" onClick={()=>select(area.id)}>{area.label}</button><span aria-hidden="true">/</span><strong>{heading}</strong></div></div><button type="button" className="dw-top-exit" onClick={back}>Sair da área</button></header>
      <main ref={main} tabIndex={-1} className="dw-content" id="dw-content">
        {!active ? <>
          <section className="dw-hero"><div><span className="dw-kicker">CENTRAL DE TRABALHO</span><h1>{area.label}</h1><p>{area.description}</p><button type="button" className="dw-primary" onClick={()=>select(entries[0]?.id||area.id)} disabled={!entries.length}>Começar agora <span aria-hidden="true">→</span></button></div><div className="dw-hero-symbol" aria-hidden="true">{renderIcon?.({icon:area.icon})}</div></section>
          <div className="dw-group-heading"><div><span className="dw-kicker">FUNÇÕES DESTA ÁREA</span><h2>O que você deseja fazer?</h2><p>Escolha uma tarefa. Você continuará neste dashboard até voltar ao painel principal.</p></div><span className="dw-count">{entries.length} funções</span></div>
          <div className="dw-cards">{entries.map((item,i)=><button type="button" className="dw-card" key={item.id} onClick={()=>select(item.id)}><span className="dw-card-icon">{renderIcon?.(item)}</span><span className="dw-card-body"><strong>{item.label}</strong><small>{item.description}</small></span><span className="dw-card-arrow" aria-hidden="true">↗</span></button>)}</div>
          {!entries.length && <div className="dw-empty">Nenhuma função disponível para seu perfil nesta área.</div>}
        </> : <>
          <header className="dw-page-head"><div><span className="dw-kicker">{area.label.toUpperCase()}</span><h1>{active.label}</h1><p>{active.description}</p></div><button type="button" className="dw-overview" onClick={()=>select(area.id)}>Todas as funções</button></header>
          <div className="dw-real-page">{renderPage(active)}</div>
        </>}
      </main>
    </div>
  </div>;
}
