import {useEffect,useState} from 'react';
import {api} from '../api.js';
import {Field,useAction} from '../ui.jsx';
export default function CodeManagement({partnerId,code,providers,onSaved}){
 const run=useAction(),base=`/admin/partners/${partnerId}/codes/${code.id}`;
 const [data,setData]=useState(null),[selected,setSelected]=useState([]),[quantity,setQuantity]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=()=>api(base+'/management').then(r=>{setData(r);setSelected(r.serverIds);setError('')}).catch(e=>setError(e.message));
 useEffect(()=>{load()},[base]);
 const act=async(path,method,body)=>{setBusy(true);try{if(await run(()=>api(base+path,{method,body}),'Operação concluída.')){await load();onSaved()}}finally{setBusy(false)}};
 return <section><h3>Administração do código</h3>{error&&<p className="error">{error}</p>}{data&&<>
 <details><summary>URLs alternativas e failover</summary><p className="muted">Selecione as URLs autorizadas. A primeira selecionada será a principal. Os limites do plano contratado continuam valendo.</p>
 {providers.map(p=><label key={p.id} style={{display:'block',padding:8}}><input type="checkbox" disabled={busy||p.status!=='active'&&!selected.includes(p.id)} checked={selected.includes(p.id)} onChange={e=>setSelected(e.target.checked?[...selected,p.id]:selected.filter(id=>id!==p.id))}/> {p.name} — {p.baseUrl}{selected[0]===p.id?' · principal':''}</label>)}
 <button className="btn" disabled={busy||!selected.length||code.status!=='active'} onClick={()=>act('/servers','PUT',{serverIds:selected})}>Salvar URLs</button></details>
 <details><summary>Créditos reservados por código</summary><p>Reservados: {data.credits.allocated} · Usados: {data.credits.spent} · Disponíveis: {data.credits.available}</p><Field label="Quantidade" hint="Valor positivo reserva créditos da carteira; negativo devolve créditos não utilizados."><input type="number" value={quantity} onChange={e=>setQuantity(e.target.value)}/></Field><button className="btn" disabled={busy||!Number.isInteger(Number(quantity))||!Number(quantity)} onClick={()=>act('/credits','POST',{quantity:Number(quantity)})}>Aplicar movimentação</button></details>
 {code.status==='revoked'&&<div><p>Salve primeiro um vencimento válido e confira se a parceria está ativa.</p><button className="btn" disabled={busy} onClick={()=>act('/restore','POST',{})}>Restaurar código</button></div>}
 </>}</section>
}
