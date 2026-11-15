import {useCallback,useEffect,useState} from 'react';
import {api} from '../api.js';
import Pix from './Pix.jsx';

const providerLabels={infinitepay:'InfinitePay',mercadopago:'Mercado Pago',manual:'Conferência manual'};

/** Centro único de configuração e inspeção, mantendo os contratos financeiros separados. */
export default function PaymentGateways(){
  const [tab,setTab]=useState('settings');
  const [data,setData]=useState(null),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const [gateway,setGateway]=useState('manual'),[notice,setNotice]=useState('');
  const refresh=useCallback(async()=>{
    try{
      const result=await api('/admin/payment-gateways/overview');
      setData(result);setGateway(result.partnerPortal?.defaultGateway||'manual');setError('');
    }catch(e){setError(e.message||'Falha ao consultar configurações.');}
  },[]);
  useEffect(()=>{void refresh();},[refresh]);
  const save=async e=>{
    e.preventDefault();
    if(!window.confirm(`Usar ${providerLabels[gateway]||gateway} nos NOVOS pedidos de acesso ao Painel do Parceiro?`))return;
    setSaving(true);setNotice('');setError('');
    try{
      await api('/admin/portal-sales/payment-settings',{method:'PUT',body:{defaultGateway:gateway}});
      setNotice('Padrão atualizado. Pedidos anteriores e cobranças de TV não foram alterados.');
      await refresh();
    }catch(e){setError(e.message||'Não foi possível salvar o gateway.');}
    finally{setSaving(false);}
  };
  const copy=async value=>{
    try{await navigator.clipboard.writeText(value);setNotice('URL copiada.');}
    catch{setNotice('Não foi possível copiar automaticamente. Selecione o endereço para copiá-lo.');}
  };
  return <div style={{display:'grid',gap:16,maxWidth:1100}}>
    <header><h1>Gateways de Pagamento</h1><p className="muted">Um único lugar para escolher o padrão de cobrança, conferir configurações do servidor e localizar os webhooks. As chaves continuam no backend.</p></header>
    {error&&<div className="alert" role="alert">{error}</div>}
    {notice&&<div className="notice" role="status">{notice}</div>}
    <div className="tabs" role="tablist" aria-label="Gerenciamento de pagamentos">
      {[['settings','Configurações'],['webhooks','Webhooks'],['charges','Cobranças Pix']].map(([id,label])=><button type="button" role="tab" aria-selected={tab===id} className={`tab ${tab===id?'active':''}`} onClick={()=>setTab(id)} key={id}>{label}</button>)}
    </div>
    {tab==='settings'&&<>
      <section className="card" style={{padding:18,display:'grid',gap:12}}>
        <h2>Pagamento padrão — Painel do Parceiro</h2>
        <p className="muted">Esta configuração é global para <strong>novas compras de meses de acesso ao Painel do Parceiro</strong>, feitas pelos Masters. Não muda pedidos já criados ou os pagamentos de licenças de TV.</p>
        {data?.partnerPortalError&&<div role="alert" className="alert">{data.partnerPortalError.message} ({data.partnerPortalError.code})</div>}
        {data?.partnerPortal&&<form onSubmit={save} style={{display:'grid',gap:12,maxWidth:560}}>
          <label style={{display:'grid',gap:6}}>Gateway padrão
            <select value={gateway} onChange={e=>setGateway(e.target.value)}>
              {(data.partnerPortal.availableGateways||[]).map(p=><option key={p.provider} value={p.provider} disabled={!p.enabled}>{p.label}{p.enabled?'':' — faltam credenciais no servidor'}</option>)}
            </select>
          </label>
          <div className="muted" style={{display:'grid',gap:5}}>
            <span>InfinitePay: {data.partnerPortal.credentials?.infinitepayHandlePresent?'InfiniteTag configurada':'InfiniteTag ausente'} / {data.partnerPortal.credentials?.infinitepayKeyPresent?'API Key configurada':'API Key ausente'}</span>
            <span>Mercado Pago: {data.partnerPortal.credentials?.mercadoPagoConfigured?'Pronto para cobranças comerciais':'Token e/ou segredo não configurado'}</span>
          </div>
          <button className="btn primary" type="submit" disabled={saving||!data.partnerPortal.availableGateways?.some(p=>p.provider===gateway&&p.enabled)}>{saving?'Salvando…':'Salvar gateway padrão'}</button>
        </form>}
      </section>
      <section className="card" style={{padding:18,display:'grid',gap:8}}>
        <h2>Pagamentos Pix legados (TVs, créditos e faturas)</h2>
        {data?.legacyPixError&&<div className="alert" role="alert">{data.legacyPixError.message} ({data.legacyPixError.code})</div>}
        {data?.legacyPix&&<p>Provedor ativo: <strong>{data.legacyPix.enabled?(providerLabels[data.legacyPix.provider]||data.legacyPix.provider):'Desativado'}</strong>. Token: {data.legacyPix.tokenConfigured?'configurado':'ausente'}. Segredo do webhook: {data.legacyPix.webhookSecretConfigured?'configurado':'ausente'}.</p>}
        <p className="muted">Este fluxo usa configuração própria (variáveis PIX_PROVIDER/MP_* ou integração administrativa legada). A escolha comercial acima não muda esse fluxo: uma migração de provedor sem suporte no checkout causaria falhas de cobrança.</p>
        <button type="button" className="btn" onClick={()=>setTab('charges')}>Consultar cobranças Pix</button>
      </section>
      <section className="card" style={{padding:18}}>
        <h2>Recebimento dos Masters de Revenda de TV</h2>
        <p className="muted">O Mercado Pago, a InfinitePay e o Pix manual de cada vendedor são configurados individualmente no módulo de rede das TVs. As credenciais de cada vendedor não podem ser substituídas por uma configuração única da DeltaTV.</p>
      </section>
    </>}
    {tab==='webhooks'&&<>
      <section className="card" style={{padding:18,display:'grid',gap:10}}>
        <h2>Endereços dos webhooks</h2>
        <p className="muted">Os webhooks não são um gateway de pagamento. Eles avisam sobre transações; a liberação de estoque continua exigindo confirmação pelo provedor.</p>
        {data&&!data.publicHttps&&<div className="alert" role="alert">PUBLIC_BASE_URL não aponta para uma origem HTTPS pública. Confira o .env e o proxy antes de receber notificações.</div>}
        {!data&&<p>Carregando…</p>}
        {(data?.webhooks||[]).map(item=><div key={item.id} style={{padding:'12px 0',borderBottom:'1px solid var(--border, #ddd)',display:'grid',gap:6}}>
          <strong>{item.provider} — {item.group}</strong>
          <code style={{overflowWrap:'anywhere',fontSize:13}}>{item.url||'URL pública não configurada'}</code>
          <small className="muted">{item.authentication}{item.dynamic?' · Substituir o marcador pelo ID real do vendedor':''}</small>
          <div><button className="btn sm" disabled={!item.url||item.dynamic} type="button" onClick={()=>copy(item.url)}>Copiar URL</button></div>
        </div>)}
      </section>
      <div className="notice"><strong>Verificação de webhook:</strong> os endereços são calculados a partir da configuração da API, mas esta tela <strong>não confirma que o provedor já enviou notificações com sucesso</strong>. Faça uma cobrança real de baixo valor e valide o registro, a assinatura quando aplicável e a entrega única do estoque.</div>
    </>}
    {tab==='charges'&&<div><p className="muted">Acompanhamento das cobranças Pix legadas. Configuração do gateway do Painel do Parceiro fica na aba Configurações.</p><Pix/></div>}
  </div>;
}
