import React, { useState } from 'react';
import RokuSimulator from '@deltatv/ui/RokuSimulator';
import { STUDIO_FIELDS, STUDIO_SCREENS, TEMPLATE_CHOICES, normalizeAppearance } from '@deltatv/ui/appearance';
import '@deltatv/ui/studio-workspace.css';

function contrastRatio(a,b){
  const lum=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((x,y,i)=>x+y*[.2126,.7152,.0722][i],0);
  const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
const COLORS = [['primaryColor','Destaque'],['backgroundColor','Fundo'],['panelColor','Cartões e menu'],['textColor','Texto']];
export default function StudioWorkspace({config, onField, onScreenField, onTemplate, onSave, onPublish,
    dirty, busy, version, actionsDisabled=false, children, notice, error}) {
  const [screen,setScreen] = useState('home');
  const value = normalizeAppearance(config);
  const activeScreen = screen === 'general' ? 'home' : screen;
  const fields = STUDIO_FIELDS[screen] || [];
  const screenValue = value.screens[screen] || {};
  const lowContrast=contrastRatio(value.textColor||'#FFFFFF',value.backgroundColor||'#090B14')<4.5 || contrastRatio(value.textColor||'#FFFFFF',value.panelColor||'#101321')<4.5;
  return <div className="sw-root">
    <header className="sw-toolbar">
      <div className="sw-toolbar-title"><strong>Editor Visual Roku</strong><span>Selecione uma tela e edite com a prévia ao lado.</span></div>
      <div className="sw-toolbar-actions"><span className="sw-state">{dirty?'● Alterações não salvas':`✓ Versão ${version || 'não publicada'}`}</span>
        <button type="button" className="outline" disabled={busy||!dirty} onClick={onSave}>Salvar</button>
        <button type="button" className="primary" disabled={busy||actionsDisabled||!value.brandName?.trim()} onClick={onPublish}>{busy?'Processando…':'Publicar'}</button>
      </div>
    </header>
    {(error||notice)&&<div className={error?'sw-error':'sw-success'} role={error?'alert':'status'}>{error||notice}</div>}
    <div className="sw-layout">
      <section className="sw-settings" aria-label="Configurações visuais">
        <div className="sw-screen-tabs" role="tablist" aria-label="Escolher tela para editar">
          {STUDIO_SCREENS.map(([id,label])=><button type="button" role="tab" aria-selected={screen===id} key={id} className={screen===id?'sw-active':''} onClick={()=>{setScreen(id);}}>{label}</button>)}
        </div>
        <div className="sw-scroll-content">
          {screen==='general' ? <>
            <label className="sw-field">Modelo visual<select aria-label="Modelo visual" value={value.template||'classic'} onChange={e=>onTemplate(e.target.value)}>
              {TEMPLATE_CHOICES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
            <label className="sw-field">Nome do aplicativo<input maxLength={45} value={value.brandName||''} onChange={e=>onField('brandName',e.target.value)}/></label>
            <label className="sw-field">URL HTTPS do logo<input type="url" placeholder="https://.../logo.png" value={value.logoUrl||''} onChange={e=>onField('logoUrl',e.target.value)}/></label>
            <label className="sw-field">URL HTTPS do banner<input type="url" placeholder="https://.../banner.png" value={value.heroUrl||''} onChange={e=>onField('heroUrl',e.target.value)}/></label>
            <p className="sw-help">O logo e banner devem ser públicos e usar HTTPS. Ícone e splash da loja são enviados na seção Exportação.</p>
            <h4>Paleta do aplicativo</h4>
            <div className="sw-colors">{COLORS.map(([key,label])=><label key={key}>{label}<span><input type="color" aria-label={label} value={value[key]||'#FFFFFF'} onChange={e=>onField(key,e.target.value)}/><code>{value[key]}</code></span></label>)}</div>
            {lowContrast&&<p className="sw-error" role="alert">Baixo contraste: ajuste as cores para facilitar a leitura na TV antes de publicar.</p>}
          </> : <>
            <p className="sw-section-note">Os textos desta tela mudam imediatamente no simulador e são salvos no tema do aplicativo.</p>
            <div className="sw-field-list">{fields.map(([key,label,max])=><label className="sw-field" key={key}>{label}
              <input aria-label={`${label} — ${STUDIO_SCREENS.find(([id])=>id===screen)?.[1]}`} maxLength={max}
                value={screenValue[key]||''} onChange={e=>onScreenField(screen,key,e.target.value)}/></label>)}</div>
            {screen==='home'&&<div className="sw-options">
              <label><input type="checkbox" checked={!!screenValue.showBanner} onChange={e=>onScreenField('home','showBanner',e.target.checked)}/> Exibir banner da Home</label>
              <label><input type="checkbox" checked={!!screenValue.showFeatured} onChange={e=>onScreenField('home','showFeatured',e.target.checked)}/> Exibir destaques</label>
            </div>}
          </>}
        </div>
      </section>
      <section className="sw-preview" aria-label="Prévia da tela em edição">
        <div className="sw-preview-top"><div><strong>Simulador</strong><small>Prévia ao vivo — dados fictícios</small></div>
          <span>{STUDIO_SCREENS.find(([id])=>id===activeScreen)?.[1]}</span></div>
        <RokuSimulator config={value} screen={activeScreen} onScreenChange={setScreen}/>
        <p className="sw-disclaimer">O simulador representa a interface; teste o ZIP também em uma Roku física.</p>
      </section>
    </div>
    {children&&<details className="sw-export"><summary><strong>Imagens e exportação do aplicativo Roku</strong><small>Configurações avançadas · abra apenas quando precisar gerar uma build</small></summary><div className="sw-export-body">{children}</div></details>}
  </div>;
}
