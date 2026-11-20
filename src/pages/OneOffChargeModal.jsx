import {useEffect,useState} from 'react';
import {api} from '../api.js';
import {Modal} from '../ui.jsx';
import {toCents} from '@deltatv/ui/money';

const amountLabel=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n||0)/100);
/** Mesma ficha para Admin de rede e Superadmin. Nenhum endpoint global é chamado pelo Admin. */
export default function OneOffChargeModal({adminId=null,onClose,onCreated}) {
 const base=adminId?'/admin/finance-networks':'/admin/workspace/finance';
 const [search,setSearch]=useState(''),[partners,setPartners]=useState([]),[partnerId,setPartnerId]=useState('');
 const [description,setDescription]=useState(''),[amount,setAmount]=useState(''),[method,setMethod]=useState('automatic');
 const [quote,setQuote]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const loadPartners=async q=>{
  setPartnerId('');setQuote(null);
  setBusy(true);setError('');try{
   const r=await api('/admin/workspace/partners',{query:{...(adminId?{adminId}:{}),page:1,pageSize:50,...(q?{q}:{})}});
   setPartners(r.data||[]);
  }catch(e){setError(e.message||'Não foi possível localizar as contas.')}finally{setBusy(false)}
 };
 useEffect(()=>{void loadPartners('')},[adminId]);
 const changed=setter=>value=>{setter(value);setQuote(null)};
 const body=()=>({...(adminId?{adminId}:{}),partnerId,description:description.trim(),amountCents:toCents(amount),method});
 const preview=async()=>{
  setBusy(true);setError('');setQuote(null);
  try{const q=await api(`${base}/charges/one-off/preview`,{method:'POST',body:body()});setQuote(q)}
  catch(e){setError(e.message||'Não foi possível calcular a prévia.')}finally{setBusy(false)}
 };
 const create=async event=>{
  event.preventDefault();if(!quote)return;
  setBusy(true);setError('');try{
   await api(`${base}/charges/one-off`,{method:'POST',body:{...body(),previewFingerprint:quote.previewFingerprint}});
   onCreated?.();onClose();
  }catch(e){setQuote(null);setError(e.message||'Não foi possível emitir a cobrança. Confira a rede e o valor.')}finally{setBusy(false)}
 };
 return <Modal title="Emitir cobrança avulsa" onClose={onClose} wide>
  <form onSubmit={create} style={{display:'grid',gap:12}}>
   <p>Cobrança independente do plano, sem renovar contrato, ativar licença ou alterar créditos. O valor é definido exclusivamente pela administração.</p>
   {error&&<div role="alert" className="alert" style={{position:'sticky',top:0,zIndex:10000}}>{error}</div>}
   <label>Buscar parceiro ou revenda
    <div className="row" style={{gap:8}}><input value={search} maxLength={100} placeholder="Nome, e-mail ou código" onChange={e=>setSearch(e.target.value)}/>
     <button type="button" className="btn" disabled={busy} onClick={()=>loadPartners(search)}>Buscar</button></div>
   </label>
   <label>Destinatário<select value={partnerId} required onChange={e=>changed(setPartnerId)(e.target.value)}>
    <option value="">Selecione</option>{partners.map(x=><option key={x.id} value={x.id}>{x.name} ({x.kind==='reseller'?'Revenda':x.kind==='both'?'Parceiro/Revenda':'Parceiro'})</option>)}</select></label>
   <label>Motivo / descrição<input required minLength={5} maxLength={200} value={description} onChange={e=>changed(setDescription)(e.target.value)} placeholder="Ex.: Serviço adicional de instalação"/></label>
   <label>Valor em reais (R$)<input required inputMode="decimal" placeholder="49,90" value={amount} onChange={e=>changed(setAmount)(e.target.value)}/></label>
   <label>Forma de recebimento<select value={method} onChange={e=>changed(setMethod)(e.target.value)}>
    <option value="automatic">Automático (gateway Pix ativo da rede)</option><option value="manual">Manual (exige comprovante/referência)</option>
   </select></label>
   <button type="button" className="btn" disabled={busy||!partnerId||!description.trim()||!toCents(amount)} onClick={preview}>Conferir valor no servidor</button>
   {quote&&<div className="notice" role="status">Cobrança avulsa: <strong>{amountLabel(quote.amountCents)}</strong><p>{quote.description}</p><small>Não altera o plano ou o vencimento. Pagamento é confirmado por webhook ou conferência manual.</small></div>}
   <div className="row" style={{gap:8}}><button type="button" className="btn" onClick={onClose}>Voltar</button>
    <button className="btn primary" disabled={!quote||busy}>Emitir cobrança avulsa</button></div>
  </form>
 </Modal>;
}
