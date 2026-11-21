import {useEffect,useState} from 'react';
import EmergencyDns from '@deltatv/ui/EmergencyDns';
import {api,getAuth} from './api.js';

export default function EmergencyDnsPage(){
  const delegated=getAuth()?.user?.role==='admin';
  const [query,setQuery]=useState('');
  const [list,setList]=useState([]);
  const [partner,setPartner]=useState('');
  const [error,setError]=useState('');
  const search=async()=>{
    try {
      const path=delegated?'/admin/workspace/partners':'/admin/partners';
      const result=await api(path,{query:{q:query.trim(),page:1,pageSize:100}});
      const partners=(result.data||result.rows||[]).filter(p=>p.status!=='deleted');
      setList(partners);setPartner(v=>partners.some(x=>x.id===v)?v:'');setError('');
    }catch(e){setError(e.message);}
  };
  useEffect(()=>{void search();},[]);
  const base=partner?(delegated?`/admin/workspace/partners/${partner}/emergency-dns`:`/admin/partners/${partner}/emergency-dns`):'';
  return <div style={{display:'grid',gap:18}}>
    <div><h2>Troca emergencial de DNS</h2><p>Selecione uma parceria antes de enviar a mudança. Administradores delegados só podem operar sua própria rede.</p></div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <input aria-label="Buscar parceiro" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome do parceiro" onKeyDown={e=>{if(e.key==='Enter')void search();}}/>
      <button onClick={()=>void search()}>Buscar</button>
      <select aria-label="Escolher parceria" value={partner} onChange={e=>setPartner(e.target.value)}>
        <option value="">Selecione uma parceria</option>
        {list.map(p=><option key={p.id} value={p.id}>{p.name} ({p.kind})</option>)}
      </select>
    </div>
    {error&&<p role="alert">{error}</p>}
    {base&&<EmergencyDns key={base} api={api} base={base}/>}
  </div>;
}
