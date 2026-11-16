import {useCallback,useEffect,useState} from 'react';
import {api} from '../api.js';

/** Centralized service package view for DeltaTV. Legacy contracts are shown as
 * historical fallback, not as a second editor for new package settings. */
export default function PartnerPackage({partnerId,onSaved=()=>{}}){
 const [current,setCurrent]=useState(null),[packages,setPackages]=useState([]),[code,setCode]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState('');
 const load=useCallback(async()=>{
  const [a,b]=await Promise.all([api(`/admin/service-packages/partners/${partnerId}`),api('/admin/service-packages')]);
  setCurrent(a);setCode(a?.code||'');setPackages(b.items||[]);
 },[partnerId]);
 useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
 const pkg=current?.package;
 return <section className="panel" style={{padding:18,display:'grid',gap:14}}>
  <header><h3>Pacote de Serviço</h3><p className="muted">A configuração única dos DNS, das ativações e dos benefícios deste parceiro.</p></header>
  {error&&<p role="alert" className="error">{error}</p>}{note&&<p role="status">{note}</p>}
  {pkg?<div style={{display:'grid',gap:6}}>
   <b>{current.currentName||pkg.name||current.code}</b>
   <span>{pkg.maxDns===null?'DNS ilimitados':`${pkg.maxDns} DNS por código`} · {pkg.activationLimit===null?'Ativações ilimitadas':`${pkg.activationLimit} ativações`}</span>
   <small>Failover: {pkg.autoFailover?'Sim':'Não'} · Prioridade automática: {pkg.autoPriority?'Sim':'Não'} · Alertas: {pkg.emailAlerts?'Sim':'Não'}</small>
  </div>:<p className="muted">Conta legada: ainda não possui um Pacote de Serviço atribuído nesta central. Os recursos atuais continuam preservados.</p>}
  <form onSubmit={async e=>{e.preventDefault();if(!code||busy||!window.confirm('Aplicar o pacote à conta? Verifique os limites existentes.'))return;
   setBusy(true);setError('');setNote('');try{
    await api(`/admin/service-packages/partners/${partnerId}`,{method:'PUT',body:{code}});
    await load();onSaved();setNote('Pacote aplicado e registrado.');
   }catch(err){setError(err.message||'Não foi possível aplicar o pacote.');}finally{setBusy(false);}}} style={{display:'grid',gap:10}}>
   <label style={{display:'grid',gap:6}}>Alterar Pacote de Serviço
    <select required value={code} onChange={e=>setCode(e.target.value)}>
     <option value="">Escolha um pacote</option>{packages.filter(p=>p.active||p.code===current?.code).map(p=><option key={p.code} value={p.code}>{p.name}</option>)}
    </select>
   </label>
   <button className="btn primary" type="submit" disabled={busy||!code}>{busy?'Aplicando…':'Aplicar pacote'}</button>
  </form>
  <a className="btn" href="#service-packages">Criar ou editar Pacotes de Serviço</a>
 </section>;
}
