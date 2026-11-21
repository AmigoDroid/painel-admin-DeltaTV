import {useEffect,useState} from 'react';
import EmergencyDns from '@deltatv/ui/EmergencyDns';
import {api,getAuth} from './api.js';

export default function EmergencyDnsPage(){
  const delegated=getAuth()?.user?.role==='admin';
  const [query,setQuery]=useState('');
  const [list,setList]=useState([]);
  const [partner,setPartner]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const search=async()=>{
    setLoading(true);
    try {
      const path=delegated?'/admin/workspace/partners':'/admin/partners';
      const result=await api(path,{query:{q:query.trim(),page:1,pageSize:100}});
      const partners=(result.data||result.rows||[]).filter(p=>p.status!=='deleted');
      setList(partners);setPartner(v=>partners.some(x=>x.id===v)?v:'');setError('');
    }catch(e){setError(e.message);}finally{setLoading(false);}
  };
  useEffect(()=>{void search();},[]);
  const base=partner?(delegated?`/admin/workspace/partners/${partner}/emergency-dns`:`/admin/partners/${partner}/emergency-dns`):'';
  return <div className="dns-admin-shell">
    <section className="dns-admin-picker">
      <header><h2>Escolher parceria</h2><p>Selecione a rede que receberá a operação. Administradores delegados só podem atuar na própria rede.</p></header>
      <div className="dns-admin-inputs">
        <label>Buscar parceria
          <input aria-label="Buscar parceiro" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome do parceiro" onKeyDown={e=>{if(e.key==='Enter')void search();}}/>
        </label>
        <button type="button" className="btn" disabled={loading} onClick={()=>void search()}>{loading?'Buscando…':'Buscar'}</button>
        <label>Parceria
          <select aria-label="Escolher parceria" value={partner} onChange={e=>setPartner(e.target.value)}>
            <option value="">Selecione uma parceria</option>
            {list.map(p=><option key={p.id} value={p.id}>{p.name} ({p.kind})</option>)}
          </select>
        </label>
      </div>
      {error&&<p role="alert">{error}</p>}
    </section>
    {base?<EmergencyDns key={base} api={api} base={base}/>:<div className="dns-admin-empty">Selecione uma parceria para configurar a troca de DNS.</div>}
  </div>;
}
