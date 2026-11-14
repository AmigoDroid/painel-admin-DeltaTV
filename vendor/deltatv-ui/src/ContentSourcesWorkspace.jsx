import {useMemo, useState} from 'react';
import {readableHost, serverHealthLabel, serverHealthState, serverLastCheck, serverLastError, serverLatency, serverAvailability, serverHealthSummary} from './server-health.js';
import './content-sources.css';

/**
 * The single visual representation for content URLs and their measured health.
 * Caller injects capabilities/actions; this component NEVER probes origins or changes routing.
 */
export default function ContentSourcesWorkspace({
  sources=[], activeTab='links', onTabChange, onCreate, onEdit, onDelete,
  onHistory, onOpenCodes, onRefresh, monitoringEnabled=true, autoPriority=false,
  canEdit=true, canViewHistory=false, loading=false, error='', title='Fontes de conteúdo',
  description='Gerencie as URLs e acompanhe sua disponibilidade em um único lugar.',
  qualityContent=null, showSummary=true, children,
}) {
  const [search,setSearch]=useState('');
  const [healthFilter,setHealthFilter]=useState('all');
  const [expanded,setExpanded]=useState(null);
  const summary=useMemo(()=>serverHealthSummary(sources),[sources]);
  const rows=useMemo(()=>sources.filter(source=>{
    const q=search.trim().toLocaleLowerCase('pt-BR');
    const hit=!q || `${source.name||''} ${source.baseUrl||''}`.toLocaleLowerCase('pt-BR').includes(q);
    return hit && (healthFilter==='all' || serverHealthState(source)===healthFilter);
  }),[sources,search,healthFilter]);
  const quality=activeTab==='quality';
  const changeTab=tab=>onTabChange?.(tab);
  return <section className="dcs" aria-label={title}>
    <header className="dcs-head">
      <div className="dcs-heading"><div className="dcs-kicker">CONTEÚDO E DISPONIBILIDADE</div><h2>{title}</h2><p>{description}</p></div>
      <div className="dcs-header-actions">
        {onRefresh&&<button type="button" className="dcs-button dcs-button-quiet" disabled={loading} onClick={onRefresh}>{loading?'Atualizando…':'Atualizar dados'}</button>}
        {canEdit&&onCreate&&<button type="button" className="dcs-button dcs-button-primary" onClick={onCreate}>+ Nova URL</button>}
      </div>
    </header>
    {showSummary&&<div className="dcs-stats" aria-label="Visão geral dos links">
      <div className="dcs-stat"><span>URLs cadastradas</span><strong>{summary.total}</strong><small>Na sua área de acesso</small></div>
      <div className="dcs-stat dcs-good"><span>Saudáveis</span><strong>{summary.healthy}</strong><small>Resposta HTTP dentro do esperado</small></div>
      <div className="dcs-stat dcs-warn"><span>Requerem atenção</span><strong>{summary.slow+summary.suspect+summary.down}</strong><small>Lentas, instáveis ou indisponíveis</small></div>
      <div className="dcs-stat"><span>Sem medição</span><strong>{summary.unknown+summary.checking+summary.disabled}</strong><small>Sem diagnóstico atual disponível</small></div>
    </div>}
    <div className="dcs-workarea">
      <nav className="dcs-tabs" aria-label="Seções das fontes de conteúdo">
        <button type="button" className={!quality?'dcs-tab active':'dcs-tab'} aria-current={!quality?'page':undefined} onClick={()=>changeTab('links')}>Links cadastrados</button>
        <button type="button" className={quality?'dcs-tab active':'dcs-tab'} aria-current={quality?'page':undefined} onClick={()=>changeTab('quality')}>Qualidade dos links</button>
        {onOpenCodes&&<button type="button" className="dcs-tab dcs-tab-link" onClick={onOpenCodes}>Códigos vinculados ↗</button>}
      </nav>
      {!monitoringEnabled&&<div className="dcs-info" role="status"><strong>Monitoramento automático desativado.</strong> Você pode editar URLs, mas os indicadores podem estar desatualizados. A ativação do monitor é responsabilidade do administrador.</div>}
      {quality && qualityContent ? <div className="dcs-embedded-monitor">{qualityContent}</div> : <><div className="dcs-context">
        <p>{quality?'Medições HTTP coletadas pelo servidor. A latência é medida a partir da VPS, não da TV.':'Estas fontes podem ser associadas aos códigos de ativação. A prioridade efetiva depende das configurações do seu contrato e do estado dos servidores.'}</p>
        <div className="dcs-filterbar">
          <label className="dcs-search"><span className="dcs-visually-hidden">Buscar por nome ou endereço</span><input type="search" placeholder="Buscar nome ou endereço da URL" value={search} onChange={e=>setSearch(e.target.value)}/></label>
          <label className="dcs-filter"><span className="dcs-visually-hidden">Filtrar por qualidade</span><select value={healthFilter} onChange={e=>setHealthFilter(e.target.value)}><option value="all">Todas as situações</option><option value="healthy">Saudáveis</option><option value="slow">Lentas</option><option value="suspect">Instáveis</option><option value="down">Indisponíveis</option><option value="unknown">Sem medição</option><option value="disabled">Desativadas</option></select></label>
        </div>
      </div>
      {error&&<div className="dcs-error" role="alert">{error}</div>}
      {!sources.length ? <div className="dcs-empty"><strong>Nenhum link de conteúdo cadastrado.</strong><p>Cadastre a URL do servidor que seus códigos devem usar. Depois acompanhe a qualidade nesta mesma tela.</p>{canEdit&&onCreate&&<button type="button" className="dcs-button dcs-button-primary" onClick={onCreate}>Cadastrar primeira URL</button>}</div>
      : !rows.length ? <div className="dcs-empty"><strong>Nenhuma URL corresponde aos filtros.</strong><p>Experimente outro nome ou estado.</p><button type="button" className="dcs-button dcs-button-quiet" onClick={()=>{setSearch('');setHealthFilter('all')}}>Limpar filtros</button></div>
      : <div className="dcs-list" aria-busy={loading}>
        {rows.map(source=>{
          const state=serverHealthState(source);
          const url=readableHost(source.baseUrl);
          const lastCheck=serverLastCheck(source);
          return <article className="dcs-item" key={source.id}>
            <div className="dcs-item-head">
              <div className="dcs-source-title"><span className="dcs-source-symbol" aria-hidden="true">▣</span><div><h3>{source.name||'Servidor sem nome'}</h3><span className="dcs-host" title={source.baseUrl||''}>{url}</span></div></div>
              <span className={`dcs-status dcs-${state}`}><span className="dcs-dot"/>{serverHealthLabel(source)}</span>
            </div>
            <div className="dcs-url" title={source.baseUrl}>{source.baseUrl||'URL não informada'}</div>
            {quality?<>
              <div className="dcs-metrics"><div><span>Tempo de resposta</span><strong>{serverLatency(source)}</strong></div><div><span>Última medição</span><strong>{lastCheck?new Date(lastCheck).toLocaleString('pt-BR'):'Não realizada'}</strong></div><div><span>Disponibilidade HTTP 24h</span><strong>{serverAvailability(source,'24h')}</strong></div></div>
              <div className="dcs-availability">{['24h','7d','30d'].map(period=><div key={period}><small>{period}</small><strong>{serverAvailability(source,period)}</strong><small>{source.availability?.[period]?.samples||0} amostras</small></div>)}</div>
              {serverLastError(source)&&<div className="dcs-error-detail" role="note">{serverLastError(source)}</div>}
            </>:<div className="dcs-metrics"><div><span>Prioridade definida</span><strong>{source.priority??'—'}</strong></div><div><span>Prioridade efetiva</span><strong>{source.effectivePriority??'—'}{autoPriority?' · automática':''}</strong></div><div><span>Resposta HTTP</span><strong>{serverLatency(source)}</strong></div></div>}
            <div className="dcs-item-actions">
              {canEdit&&onEdit&&<button type="button" className="dcs-button dcs-button-quiet" onClick={()=>onEdit(source)}>Editar URL</button>}
              {!quality&&<button type="button" className="dcs-button dcs-button-ghost" aria-expanded={expanded===source.id} onClick={()=>setExpanded(expanded===source.id?null:source.id)}>{expanded===source.id?'Ocultar detalhes':'Ver qualidade'} </button>}
              {canViewHistory&&onHistory&&<button type="button" className="dcs-button dcs-button-ghost" onClick={()=>onHistory(source)}>Histórico</button>}
              {canEdit&&onDelete&&<button type="button" className="dcs-button dcs-button-danger" onClick={()=>onDelete(source)}>Excluir</button>}
            </div>
            {expanded===source.id&&!quality&&<div className="dcs-expanded"><strong>Disponibilidade HTTP:</strong> {['24h','7d','30d'].map(period=>`${period}: ${serverAvailability(source,period)}`).join(' · ')}. {lastCheck?`Último teste: ${new Date(lastCheck).toLocaleString('pt-BR')}.`:'Ainda não há medições registradas.'}</div>}
          </article>;
        })}
      </div>}</>}
    </div>
    <p className="dcs-disclaimer">A qualidade dos links representa sondagens HTTP da infraestrutura. Não garante que todos os canais e filmes estejam reproduzindo em cada aparelho.</p>
    {children}
  </section>;
}
