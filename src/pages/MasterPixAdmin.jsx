import {useCallback,useEffect,useState} from 'react';
import {api} from '../api.js';
import { toCents } from '@deltatv/ui/money';
const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0)/100);
const centsOf = value => toCents(value);
export default function MasterPixAdmin({id}){
  const [settings,setSettings]=useState(null),[prices,setPrices]=useState([]),[orders,setOrders]=useState([]);
  const [token,setToken]=useState(''),[secret,setSecret]=useState(''),[currentPassword,setCurrentPassword]=useState(''),[form,setForm]=useState({months:'12',price:'10,00'});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const load=useCallback(async()=>{
    const [s,p,o]=await Promise.all([
      api(`/admin/network/master-pix/accounts/${id}/settings`),
      api(`/admin/network/master-pix/accounts/${id}/prices`),
      api(`/admin/network/master-pix/orders?sellerId=${encodeURIComponent(id)}`),
    ]);
    setSettings(s);setPrices(p.data||[]);setOrders(o.data||[]);
  },[id]);
  useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
  const act=async(fn,msg)=>{
    setBusy(true);setError('');setMessage('');
    try{await fn();setMessage(msg);await load();}catch(e){setError(e.message||'Erro ao salvar.');}finally{setBusy(false);}
  };
  return <div style={{border:'1px solid var(--border, #bbb)',padding:12,borderRadius:10,marginTop:12}}>
    <h4>Recebimentos Pix deste Master</h4>
    <p className="muted">O dinheiro vai para a conta Mercado Pago deste Master. O DeltaTV somente confirma o pagamento e registra a entrega das licenças.</p>
    {error&&<p className="error" role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
    <p>{settings?.configured?`Conta recebedora ${settings.merchantId} · ${settings.enabled?'ativa':'pausada'}`:'Mercado Pago ainda não configurado.'}</p>
    {settings?.pendingPayments>0&&<p className="error">{settings.pendingPayments} cobranças precisam ser concluídas antes de trocar as credenciais.</p>}
    <details><summary>Configurar a conta de recebimento (Superadmin)</summary>
      <p className="muted">As credenciais são cifradas. Nenhuma chave é exibida após o cadastro.</p>
      <div style={{display:'grid',gap:8}}><label>Access Token<input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)}/></label>
      <label>Chave do Webhook<input type="password" autoComplete="off" value={secret} onChange={e=>setSecret(e.target.value)}/></label>
      <label>Confirme sua senha do Superadmin<input type="password" autoComplete="current-password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></label>
      <button className="btn primary" disabled={busy||token.length<30||secret.length<16||currentPassword.length<8} onClick={()=>act(()=>api(`/admin/network/master-pix/accounts/${id}/settings`,{method:'PUT',body:{accessToken:token,webhookSecret:secret,currentPassword,active:true}}),'Conta de recebimento salva.')}>Validar e salvar</button></div>
    </details>
    {settings?.webhookUrl&&<label>URL do Webhook<input readOnly value={settings.webhookUrl} onFocus={e=>e.target.select()}/></label>}
    <h4>Tabela de preços Pix em reais</h4>
    <div className="row" style={{gap:8,flexWrap:'wrap',alignItems:'end'}}>
      <label>Meses<input type="number" min="1" max="120" value={form.months} onChange={e=>setForm(v=>({...v,months:e.target.value}))}/></label>
      <label>R$ por licença<input value={form.price} onChange={e=>setForm(v=>({...v,price:e.target.value}))}/></label>
      <button className="btn primary" disabled={busy||!(centsOf(form.price) > 0)} onClick={()=>act(()=>api(`/admin/network/master-pix/accounts/${id}/prices`,{method:'PUT',body:{months:Number(form.months),unitPriceCents:centsOf(form.price),active:true}}),'Preço atualizado.')}>Salvar</button>
    </div>
    <div>{prices.map(p=><span key={p.months} style={{display:'inline-block',padding:6}}>{p.months} meses: {brl(p.unitPriceCents)} ({p.active?'ativo':'pausado'})</span>)}</div>
    <details><summary>Cobranças Pix deste Master ({orders.length})</summary>
      <div className="table-wrap"><table><thead><tr><th>Revenda</th><th>Licenças</th><th>Recebimento</th><th>Estado</th><th></th></tr></thead><tbody>
        {orders.map(o=><tr key={o.id}><td>{o.buyerName}</td><td>{o.quantity} × {o.months} meses</td><td>{brl(o.totalCents)}</td><td>{o.status}</td><td><button className="btn sm" disabled={busy||o.status==='paid'} onClick={()=>act(()=>api(`/admin/network/master-pix/orders/${o.id}/recheck`,{method:'POST'}),'Conciliação solicitada.')}>Conferir no provedor</button></td></tr>)}
      </tbody></table></div>
    </details>
  </div>;
}

/** Leitura global exclusiva do Superadmin: movimentações de TODOS os níveis. */
export function MasterPixGlobal(){
  const [open,setOpen]=useState(false),[orders,setOrders]=useState(null),[error,setError]=useState(''),[filter,setFilter]=useState('');
  const load=async()=>{
    try{setError('');const r=await api(`/admin/network/master-pix/orders${filter?`?status=${encodeURIComponent(filter)}`:''}`);setOrders(r.data||[]);}
    catch(e){setError(e.message);}
  };
  return <div className="card">
    <div className="row" style={{gap:10,justifyContent:'space-between',alignItems:'center',flexWrap:'wrap'}}>
      <div><h3>Financeiro Pix de toda a rede</h3><p className="muted">Vendas em reais, recebidas diretamente pelos Masters. Não são créditos da plataforma.</p></div>
      <button className="btn" onClick={()=>{setOpen(v=>!v);if(!open)void load();}}>{open?'Fechar relatório':'Consultar vendas Pix'}</button>
    </div>
    {open&&<div>
      {error&&<p className="error">{error}</p>}
      <div className="row" style={{gap:8,alignItems:'end',flexWrap:'wrap'}}>
        <label>Estado<select value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="">Todos</option><option value="paid">Pagas</option><option value="pending">Pendentes</option><option value="review">Em análise</option><option value="cancelled">Canceladas</option>
        </select></label>
        <button className="btn" onClick={load}>Filtrar e atualizar</button>
      </div>
      {orders&&<><p className="muted">Últimas {orders.length} cobranças · valor bruto das pagas exibidas: {brl(orders.filter(x=>x.status==='paid').reduce((sum,x)=>sum+x.totalCents,0))}</p>
        <div className="table-wrap"><table><thead><tr><th>Master vendedor</th><th>Revenda compradora</th><th>Licenças</th><th>Valor bruto</th><th>Estado</th></tr></thead><tbody>
          {orders.map(x=><tr key={x.id}><td>{x.sellerName}</td><td>{x.buyerName}</td><td>{x.quantity} × {x.months} meses</td><td>{brl(x.totalCents)}</td><td>{x.status}</td></tr>)}
        </tbody></table></div>
      </>}
    </div>}
  </div>;
}
