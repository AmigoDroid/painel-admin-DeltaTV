import {useState} from 'react';
import {api} from '../api.js';
import {Modal,PasswordInput} from '../ui.jsx';
export default function CredentialsModal({path,onClose}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const reveal=async()=>{setBusy(true);try{setData(await api(path,{method:'POST',body:{}}));setError('')}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <Modal title="Credenciais da lista" onClose={onClose}><p>Esta consulta registra seu usuário na auditoria.</p>{error&&<p className="error">{error}</p>}{data?<><p>MAC: {data.mac}</p><label>Usuário<input readOnly value={data.username}/></label><label>Senha<PasswordInput readOnly value={data.password}/></label></>:<button className="btn" disabled={busy} onClick={reveal}>{busy?'Consultando…':'Consultar credenciais'}</button>}<button className="btn" onClick={onClose}>Fechar</button></Modal>
}
