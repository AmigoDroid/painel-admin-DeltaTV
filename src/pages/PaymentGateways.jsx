import {useState} from 'react';
import Pix from './Pix.jsx';
/** Histórico Pix preservado sem recriar configuração de gateway nem webhook. */
export default function PaymentGateways(){
 const [expanded,setExpanded]=useState(false);
 return <div style={{display:'grid',gap:16}}>
  <header><h1>Recebimentos e cobranças</h1><p className="muted">A configuração dos gateways e webhooks foi centralizada em <strong>Administração → Configurações Globais</strong>.</p></header>
  <section className="card" style={{padding:18,display:'grid',gap:12}}><h2>Gerenciar gateways</h2>
   <p className="muted">Mercado Pago, InfinitePay, gateway padrão, webhooks, teste grátis, Player Web e custos ficam na central.</p>
   <div><a className="btn primary" href="#global-config">Abrir Configurações Globais</a></div>
  </section>
  <section className="card" style={{padding:18}}><button className="btn" type="button" onClick={()=>setExpanded(!expanded)}>{expanded?'Ocultar cobranças Pix legadas':'Consultar cobranças Pix legadas'}</button>
  {expanded&&<div style={{marginTop:14}}><Pix/></div>}</section>
 </div>;
}
