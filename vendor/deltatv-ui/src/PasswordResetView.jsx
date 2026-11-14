import {useId,useState} from 'react';
/** Reset UI shared across profiles; auth endpoints are injected by each host panel. */
export function ForgotPasswordView({requestReset,accountType='conta',initialEmail='',onBack=()=>window.location.assign('/')}){
 const [email,setEmail]=useState(initialEmail),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 const id=useId();
 const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{await requestReset(email);setDone(true);}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <main className="reset-page"><section className="reset-card"><div className="reset-logo">D</div><h1>Esqueceu a senha?</h1>
   {done?<><p className="reset-note" role="status">Se existir uma conta de {accountType} com esse e-mail, enviaremos um link para criar outra senha. Confira também o spam.</p><p className="reset-note">O link expira em 30 minutos.</p></>
   :<form onSubmit={submit}><p>Informe seu e-mail de acesso para receber o link de redefinição.</p><label htmlFor={id}>E-mail cadastrado</label><input id={id} type="email" autoComplete="email" required maxLength={200} value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com"/>{error&&<p role="alert" className="reset-error">{error}</p>}<button className="reset-primary" disabled={busy}>{busy?'Enviando…':'Enviar link'}</button></form>}
   <button type="button" className="reset-back" onClick={onBack}>Voltar ao login</button>
 </section></main>;
}
export function ResetPasswordView({completeReset,token,onBack=()=>window.location.assign('/')}){
 const [password,setPassword]=useState(''),[repeat,setRepeat]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
 const passwordId=useId(),confirmId=useId();
 const submit=async e=>{e.preventDefault();setError('');if(password!==repeat){setError('As duas senhas precisam ser iguais.');return;}setBusy(true);try{await completeReset(token,password);setPassword('');setRepeat('');setDone(true)}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <main className="reset-page"><section className="reset-card"><div className="reset-logo">D</div><h1>Redefinir senha</h1>
  {done?<p role="status" className="reset-note">Senha alterada com sucesso. Suas sessões anteriores foram encerradas. Entre novamente com a nova senha.</p>:!token?<p role="alert" className="reset-error">Link incompleto. Solicite uma nova redefinição de senha.</p>:<form onSubmit={submit}><p>Crie uma senha com no mínimo 12 caracteres. Este link só pode ser utilizado uma vez.</p><label htmlFor={passwordId}>Nova senha</label><input id={passwordId} type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/><label htmlFor={confirmId}>Confirme a nova senha</label><input id={confirmId} type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={repeat} onChange={e=>setRepeat(e.target.value)}/>{error&&<p role="alert" className="reset-error">{error}</p>}<button className="reset-primary" disabled={busy}>{busy?'Salvando…':'Salvar nova senha'}</button></form>}
  <button type="button" className="reset-back" onClick={onBack}>Ir para o login</button>
 </section></main>;
}
