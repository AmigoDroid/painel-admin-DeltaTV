import React, { useCallback, useEffect, useState } from 'react';
import { api, downloadRokuZip, uploadRokuImage } from '../api.js';
import RokuSimulator from '../components/RokuSimulator.jsx';

const ROOT='/admin/white-label';
const defaults={template:'classic',brandName:'Meu aplicativo',tagline:'Seu entretenimento em um só lugar.',
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
      setCfg(d.draft||{...defaults,brandName:appName});setVersion(d.version||0);
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
    <div className="adm-wl-cols">
      <div>
        <label>Modelo de interface<select value={cfg.template} onChange={e=>{
          const val=e.target.value;setCfg(c=>({...c,template:val,...templates[val]}));setDirty(true);
        }}><option value="classic">Clássico</option><option value="cinema">Cinema</option><option value="compact">Compacto</option><option value="minimal">Minimalista</option><option value="mosaic">Mosaico</option><option value="library">Biblioteca</option></select></label>
        <label>Nome na TV<input maxLength="45" value={cfg.brandName} onChange={e=>edit('brandName',e.target.value)}/></label>
        <label>Título da Home<input maxLength="90" value={cfg.heroTitle} onChange={e=>edit('heroTitle',e.target.value)}/></label>
        <label>Mensagem<input maxLength="110" value={cfg.tagline} onChange={e=>edit('tagline',e.target.value)}/></label>
        <label>Logotipo HTTPS (para visual na TV)<input type="url" value={cfg.logoUrl} onChange={e=>edit('logoUrl',e.target.value)}/></label>
        <label>Banner HTTPS<input type="url" value={cfg.heroUrl} onChange={e=>edit('heroUrl',e.target.value)}/></label>
      </div>
      <div>
        {[["primaryColor","Destaque"],["backgroundColor","Fundo"],["panelColor","Painéis"],["textColor","Texto"]].map(([key,label])=><label key={key}>{label}
          <input aria-label={label} type="color" value={cfg[key]} onChange={e=>edit(key,e.target.value)}/></label>)}
        <div style={{padding:20,borderRadius:12,background:cfg.backgroundColor,color:cfg.textColor,border:`2px solid ${cfg.primaryColor}`}}>
          <div style={{color:cfg.primaryColor,fontWeight:700}}>PRÉVIA DE IDENTIDADE</div>
          <h3 style={{color:cfg.textColor}}>{cfg.brandName||appName}</h3><p style={{color:cfg.textColor}}>{cfg.heroTitle}</p>
          <div style={{padding:14,background:cfg.panelColor,borderRadius:9,color:cfg.textColor}}>{cfg.tagline}</div>
        </div>
      </div>
    </div>
    <div className="adm-wl-box" style={{marginTop:20,minWidth:0}}>
      <h4>Simulador de interface Roku</h4><p className="muted">Prévia navegável com dados fictícios. Escolha Login, Home, Filmes, Séries ou TV ao vivo. A disposição pode variar no aparelho Roku real.</p>
      <RokuSimulator config={cfg}/>
    </div>
    <div className="adm-wl-actions"><button className="btn" disabled={busy||!dirty} onClick={save}>Salvar rascunho</button>
      <button className="btn primary" disabled={busy||!cfg.brandName.trim()||!cfg.heroTitle.trim()} onClick={publish}>Publicar visual</button></div>
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
    {error&&<p className="adm-wl-error" role="alert">{error}</p>}{notice&&<p className="adm-wl-ok" role="status">{notice}</p>}
  </section>;
}
