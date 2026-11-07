import React, { useCallback, useEffect, useState } from 'react';
import { api, downloadRokuZip, uploadRokuImage } from '../api.js';
import StudioWorkspace from '../StudioWorkspace.jsx';
import {normalizeAppearance, updateAppearanceScreen, SCREEN_DEFAULTS} from '../appearance-screen-settings.js';

const ROOT='/admin/white-label';
const defaults={screens:SCREEN_DEFAULTS,template:'classic',brandName:'Meu aplicativo',tagline:'Seu entretenimento em um só lugar.',
  heroTitle:'Bem-vindo',logoUrl:'',heroUrl:'',primaryColor:'#6B47E6',backgroundColor:'#090B14',
  panelColor:'#101321',textColor:'#FFFFFF'};
const ASSETS=[['logo','Logo 180×180 ou 400×400'],['icon_hd','Ícone HD 336×210'],
 ['icon_sd','Ícone SD 246×140'],['splash_hd','Splash HD 1280×720'],['splash_fhd','Splash FHD 1920×1080'],
 ['banner','Banner 1020×314']];
const templates={
  classic:{primaryColor:'#6B47E6',backgroundColor:'#090B14',panelColor:'#101321',textColor:'#FFFFFF'},
  cinema:{primaryColor:'#E7A94B',backgroundColor:'#090B10',panelColor:'#17191F',textColor:'#FFFFFF'},
  compact:{primaryColor:'#25B6A6',backgroundColor:'#081519',panelColor:'#10252B',textColor:'#F5FCFC'},
  minimal:{primaryColor:'#D4A45C',backgroundColor:'#11161B',panelColor:'#1B2229',textColor:'#F7F5EE'},
  mosaic:{primaryColor:'#EC734F',backgroundColor:'#151316',panelColor:'#29232A',textColor:'#FFF6F0'},
  library:{primaryColor:'#93CBAA',backgroundColor:'#0D1615',panelColor:'#1A2B26',textColor:'#F3FBF6'}
};
export default function RokuBuildManager({ appId, appName, appearanceEnabled }) {
  const [cfg,setCfg]=useState({...defaults,brandName:appName||defaults.brandName});
  const [version,setVersion]=useState(0),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false);
  const [notice,setNotice]=useState(''),[error,setError]=useState('');
  const [assets,setAssets]=useState({});
  const [rokuBuildVersion,setRokuBuildVersion]=useState(1);
  const load=useCallback(async()=>{
    if(!appId)return;
    try{const d=await api(`${ROOT}/${appId}/appearance`);
      setCfg(normalizeAppearance(d.draft||{...defaults,brandName:appName}));setVersion(d.version||0);
      setDirty(false);setError('');}
    catch(e){setError(e.message);}
  },[appId,appName]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    let valid=true;
    if(appId) api(`${ROOT}/${appId}/roku-assets`).then(d=>{if(valid)setAssets(d.assets||{});}).catch(()=>{});
    return()=>{valid=false;};
  },[appId]);
  const sendAsset=(kind,file)=>operation(async()=>{
    if(!file)return;
    await uploadRokuImage(`${ROOT}/${appId}/roku-assets/${kind}`,file);
    const d=await api(`${ROOT}/${appId}/roku-assets`);setAssets(d.assets||{});
    setNotice('Imagem enviada e vinculada ao aplicativo.');
  });

  const edit=(key,value)=>{setCfg(c=>({...c,[key]:value}));setDirty(true);setNotice('');};
  const editScreen=(screen,key,value)=>{setCfg(c=>{
    const next=updateAppearanceScreen(c,screen,key,value);
    if(screen==='home'&&key==='heading')next.heroTitle=value;
    if(screen==='home'&&key==='subtitle')next.tagline=value;
    return next;
  });setDirty(true);setNotice('');};
  const chooseTemplate=val=>{setCfg(c=>({...c,template:val,...templates[val]}));setDirty(true);setNotice('');};
  const operation=async fn=>{
    setBusy(true);setError('');setNotice('');
    try{await fn();}catch(e){setError(e.message||'Falha ao preparar canal.');}
    finally{setBusy(false);}
  };
  const save=()=>operation(async()=>{
    await api(`${ROOT}/${appId}/appearance/draft`,{method:'PUT',body:cfg});
    setDirty(false);setNotice('Rascunho salvo. Publique para gerar o pacote premium.');
  });
  const publish=()=>operation(async()=>{
    await api(`${ROOT}/${appId}/appearance/draft`,{method:'PUT',body:cfg});
    const x=await api(`${ROOT}/${appId}/appearance/publish`,{method:'POST'});
    setVersion(x.version);setDirty(false);setNotice(`Visual publicado na versão ${x.version}.`);
  });
  const download=edition=>operation(async()=>{
    if(dirty && !window.confirm('Existem alterações não publicadas. Exportar a última versão publicada?')) return;
    await downloadRokuZip(`${ROOT}/${appId}/roku-export?edition=${edition}&buildVersion=${rokuBuildVersion}`,`roku-${appName.replace(/[^a-z0-9_-]/gi,'-')}-${edition}.zip`);
    setNotice('ZIP Roku preparado. Agora teste no dispositivo e assine o .pkg com sua chave Roku.');
  });
  return <section className="adm-wl-box" aria-label="Gerador de canais Roku" style={{marginTop:20}}>
    <div className="page-head"><div><h3>Estúdio e Gerador Roku</h3><p className="muted">Personalize a identidade do canal e exporte um pacote exclusivo para assinatura.</p></div>
      <span>Publicação visual: {version||'não publicada'}</span></div>
    {!appearanceEnabled && <p className="adm-wl-error">O Estúdio Visual está desabilitado. Você pode preparar o tema, mas precisa habilitá-lo para entregá-lo às TVs.</p>}
    <StudioWorkspace config={cfg} onField={edit} onScreenField={editScreen} onTemplate={chooseTemplate}
      onSave={save} onPublish={publish} dirty={dirty} busy={busy} version={version}
      error={error} notice={notice} actionsDisabled={!cfg.heroTitle.trim()}>
    <div className="adm-wl-box" style={{marginTop:15}}><h4>Ícones, splash e banner para a loja Roku</h4>
      <p className="muted">PNG nas dimensões exatas; imagens cadastradas substituem os modelos automáticos nos ZIPs Premium.</p>
      <div className="adm-wl-cols">{ASSETS.map(([key,label])=><label key={key}>{label}
        <small className="muted">{assets[key]?.present?'Arquivo pronto':'Usando arte automática'}</small>
        <input type="file" accept="image/png" disabled={busy} onChange={e=>{void sendAsset(key,e.target.files?.[0]);e.target.value='';}}/>
      </label>)}</div>
    </div>
    <label>Número da build Roku <input type="number" min="1" max="99999" value={rokuBuildVersion} onChange={e=>setRokuBuildVersion(e.target.valueAsNumber||1)} /></label>
    <div className="adm-wl-cols" style={{marginTop:15}}>
      <div className="adm-wl-entry"><b>Pacote Econômico</b><small>O visual é atualizado pelo Estúdio. Usa identidade gráfica padrão na instalação.</small>
        <button className="btn" disabled={busy} onClick={()=>download('economy')}>Baixar ZIP Econômico</button></div>
      <div className="adm-wl-entry"><b>Aplicativo próprio — Premium</b><small>Inclui nome, ícones e splash gerados para este cliente, mais o tema publicado como padrão offline.</small>
        <button className="btn primary" disabled={busy||!version} onClick={()=>download('dedicated')}>Gerar ZIP Premium</button></div>
    </div>
    <p className="muted" style={{marginTop:10}}>Exportação não é assinatura: é preciso instalar o ZIP no Roku de desenvolvimento, criar/usar chave própria, gerar o .pkg e submeter à certificação. Ícones automáticos servem de ponto de partida; substitua por arte profissional quando necessário.</p>
    </StudioWorkspace>
  </section>;
}
