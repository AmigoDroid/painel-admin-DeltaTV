import {useCallback,useEffect,useState} from 'react';
import {api} from '../api.js';
import {formatBRL} from '@deltatv/ui/money';

const empty=()=>({code:'',name:'',wholesaleCents:100,minResaleCents:100,active:true,
 maxDns:1,activationLimit:100,maxApps:0,autoFailover:true,autoPriority:false,emailAlerts:true,detailedHistory:false});
const money=formatBRL;
const codeFor=name=>name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').replace(/^([0-9])/,'p_$1').slice(0,30);
const toForm=p=>({code:p.code,name:p.name,wholesaleCents:Number(p.wholesale_cents),minResaleCents:Number(p.min_resale_cents),active:p.active,
 maxDns:p.max_dns===null?null:Number(p.max_dns),activationLimit:p.activation_limit===null?null:Number(p.activation_limit),maxApps:Number(p.max_apps??0),
 autoFailover:!!p.auto_failover,autoPriority:!!p.auto_priority,emailAlerts:!!p.email_alerts,detailedHistory:!!p.detailed_history});
const FormRow=({label,children})=><label style={{display:'grid',gap:6}}><strong>{label}</strong>{children}</label>;
const Columns=({children})=><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,215px),1fr))',gap:12}}>{children}</div>;

export default function ServicePackages(){
 const [items,setItems]=useState([]),[form,setForm]=useState(empty),[original,setOriginal]=useState(null);
 const [partners,setPartners]=useState([]),[selectedPartner,setSelectedPartner]=useState(''),[selectedPackage,setSelectedPackage]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const refresh=useCallback(async()=>{
  const result=await api('/admin/service-packages');setItems(result.items||[]);
  try{const r=await api('/admin/portal-sales/candidates');setPartners(Array.isArray(r)?r:r.items||r.data||[]);}catch{setPartners([]);}
 },[]);
 useEffect(()=>{refresh().catch(e=>setError(e.message));},[refresh]);
 const run=async(fn)=>{setError('');setNotice('');setBusy(true);try{await fn();await refresh();setNotice('Alteração salva e auditada.');}catch(e){setError(e.message||'Não foi possível concluir.');}finally{setBusy(false);}};
 const set=(field,value)=>setForm(p=>({...p,[field]:value,...(field==='autoFailover'&&!value?{autoPriority:false}:{})}));
 const save=async e=>{e.preventDefault();if(form.minResaleCents<form.wholesaleCents)return setError('O preço mínimo precisa ser igual ou maior que o preço de aquisição.');
  if(original&&original!==form.code)return setError('O identificador interno não pode ser modificado. Duplique o pacote.');
  await run(()=>api(`/admin/service-packages${original?`/${encodeURIComponent(original)}`:''}`,{method:original?'PUT':'POST',body:form}));
  setOriginal(null);setForm(empty());};
 const edit=p=>{setForm(toForm(p));setOriginal(p.code);window.scrollTo({top:0,behavior:'smooth'});};
 const duplicate=async p=>{const name=window.prompt('Nome do novo pacote:',`${p.name} · Cópia`);if(!name?.trim())return;
  const code=codeFor(name);if(!code)return setError('Nome inválido.');
  await run(()=>api(`/admin/service-packages/${encodeURIComponent(p.code)}/duplicate`,{method:'POST',body:{newCode:code,newName:name.trim()}}));};
 const setActive=async p=>{if(!window.confirm(`${p.active?'Desativar':'Ativar'} o pacote ${p.name}? Os contratos atuais serão preservados.`))return;
  await run(()=>api(`/admin/service-packages/${encodeURIComponent(p.code)}/state`,{method:'PATCH',body:{active:!p.active}}));};
 const assign=async e=>{e.preventDefault();if(!selectedPartner||!selectedPackage)return;
  if(!window.confirm('Atribuir este pacote ao parceiro? A operação não apagará DNS nem ativações existentes.'))return;
  await run(()=>api(`/admin/service-packages/partners/${selectedPartner}`,{method:'PUT',body:{code:selectedPackage}}));};
 return <div style={{display:'grid',gap:18,maxWidth:1180}}>
  <header><h1>Pacotes de Serviço</h1><p className="muted">A configuração única da venda do <strong>Painel do Parceiro</strong>. Defina DNS, ativações e benefícios aqui. Estoque de TV é outro produto.</p></header>
  {error&&<div className="alert" role="alert">{error}</div>}{notice&&<div className="notice" role="status">{notice}</div>}
  <section className="card" style={{padding:20,display:'grid',gap:14}}>
   <h2>{original?`Editar ${form.name}`:'Criar Pacote de Serviço'}</h2>
   <form onSubmit={save} style={{display:'grid',gap:14}}>
    <Columns>
     <FormRow label="Nome do pacote"><input required minLength="2" maxLength="120" value={form.name} onChange={e=>{
      const name=e.target.value;setForm(v=>({...v,name,...(!original?{code:codeFor(name)}:{})}));}}/></FormRow>
     <FormRow label="Identificador (imutável)"><input required disabled={!!original} pattern="[a-z][a-z0-9_-]{1,31}" value={form.code} onChange={e=>set('code',e.target.value)}/></FormRow>
     <FormRow label="DNS permitidos por código">
      <label><input type="checkbox" checked={form.maxDns===null} onChange={e=>set('maxDns',e.target.checked?null:1)}/> Sem limite</label>
      {form.maxDns!==null&&<input required type="number" min="1" max="2000000" value={form.maxDns} onChange={e=>set('maxDns',Number(e.target.value))}/>}</FormRow>
     <FormRow label="Ativações permitidas">
      <label><input type="checkbox" checked={form.activationLimit===null} onChange={e=>set('activationLimit',e.target.checked?null:100)}/> Sem limite</label>
      {form.activationLimit!==null&&<input required type="number" min="0" max="2000000000" value={form.activationLimit} onChange={e=>set('activationLimit',Number(e.target.value))}/>}</FormRow>
     <FormRow label="Apps próprios incluídos"><input required type="number" min="0" max="50" step="1" value={form.maxApps} onChange={e=>set('maxApps',e.target.value===''?0:Number(e.target.value))}/></FormRow>
    </Columns>
    <Columns>
     {[["autoFailover","Failover automático"],["autoPriority","Prioridade por desempenho"],["emailAlerts","Alertas por e-mail"],["detailedHistory","Histórico detalhado"]].map(([key,name])=>
      <label key={key}><input type="checkbox" checked={form[key]} disabled={key==='autoPriority'&&!form.autoFailover} onChange={e=>set(key,e.target.checked)}/> {name}</label>)}
    </Columns>
    <details><summary style={{cursor:'pointer',fontWeight:600}}>Preços de referência e regras comerciais</summary>
     <Columns>
      <FormRow label="Preço base (R$ / mês)"><input type="number" min="0.01" step="0.01" value={form.wholesaleCents/100} onChange={e=>set('wholesaleCents',Math.round(Number(e.target.value)*100))}/></FormRow>
      <FormRow label="Piso de revenda (R$ / mês)"><input type="number" min="0.01" step="0.01" value={form.minResaleCents/100} onChange={e=>set('minResaleCents',Math.round(Number(e.target.value)*100))}/></FormRow>
     </Columns><p className="muted">Os preços efetivamente negociados podem ser diferentes. Concessões gratuitas são registradas apenas pela DeltaTV.</p>
    </details>
    <div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button className="btn primary" disabled={busy}>{busy?'Salvando…':'Salvar pacote'}</button>
      <button type="button" className="btn" onClick={()=>{setOriginal(null);setForm(empty());}}>Novo pacote</button></div>
   </form>
  </section>
  <section className="card" style={{padding:18,display:'grid',gap:12}}>
   <h2>Pacotes disponíveis</h2>
   <Columns>{items.map(p=><article key={p.code} className="card" style={{padding:16,display:'grid',gap:8}}>
    <strong>{p.name}</strong><small className="muted">Versão {p.revision} · {p.active?'Disponível':'Desativado'} · {p.assigned_count} atribuições</small>
    <span>{p.max_dns===null?'DNS ilimitados':`${p.max_dns} DNS/código`} · {p.activation_limit===null?'Ativações ilimitadas':`${p.activation_limit} ativações`} · {p.max_apps??0} app(s) próprio(s)</span>
    <small>Preço base: {money(p.wholesale_cents)} por mês</small>
    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}><button type="button" className="btn sm" onClick={()=>edit(p)}>Editar</button>
    <button type="button" className="btn sm" onClick={()=>void duplicate(p)}>Duplicar</button>
    <button type="button" className="btn sm" onClick={()=>void setActive(p)}>{p.active?'Desativar':'Ativar'}</button></div>
   </article>)}</Columns>
   {!items.length&&<p className="muted">Nenhum Pacote de Serviço cadastrado. Cadastre o primeiro acima.</p>}
  </section>
  <section className="card" style={{padding:18,display:'grid',gap:12}}>
   <h2>Atribuir pacote a um parceiro existente</h2>
   <p className="muted">Operação independente de cobrança. Registra uma atribuição auditada, sem apagar servidores e ativações. Cadastros novos de Master são feitos em Rede comercial.</p>
   <form onSubmit={assign} style={{display:'grid',gap:12}}><Columns>
    <FormRow label="Parceiro"><select required value={selectedPartner} onChange={e=>setSelectedPartner(e.target.value)}><option value="">Selecionar parceiro</option>
      {partners.map(p=><option key={p.id||p.partner_id} value={p.id||p.partner_id}>{p.name}</option>)}</select></FormRow>
    <FormRow label="Pacote"><select required value={selectedPackage} onChange={e=>setSelectedPackage(e.target.value)}><option value="">Selecionar pacote</option>{items.filter(p=>p.active).map(p=><option key={p.code} value={p.code}>{p.name}</option>)}</select></FormRow>
   </Columns><div><button type="submit" className="btn primary" disabled={busy}>Atribuir pacote</button></div></form>
  </section>
 </div>;
}
