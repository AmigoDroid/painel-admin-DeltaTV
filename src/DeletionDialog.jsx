import { useEffect, useState } from 'react';
import { api } from './api.js';
import './deletion-dialog.css';

/** Exclusão operacional, com diagnóstico ANTES da confirmação e escopo validado no backend. */
export default function DeletionDialog({kind,item,url,onClose,onDeleted}) {
  const [preview,setPreview]=useState(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [confirmation,setConfirmation]=useState('');
  const [replacementProviderId,setReplacement]=useState('');
  const [force,setForce]=useState(false);
  const [reason,setReason]=useState('');
  const expected=kind==='code'?item.code:item.name;
  useEffect(()=>{
    let alive=true;
    setLoading(true);
    api(`${url}/deletion-preview`).then(p=>{if(alive)setPreview(p)}).catch(e=>{if(alive)setError(e.message)}).finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[url]);
  const deleteNow=async e=>{
    e.preventDefault();
    if(confirmation!==expected || saving) return;
    setSaving(true);setError('');
    try{
      const body={confirmation,reason:reason.trim(),...(kind==='provider'?{replacementProviderId:replacementProviderId||null,force}: {})};
      await api(url,{method:'DELETE',body});
      onDeleted();
    }catch(e){setError(e.message)}finally{setSaving(false)}
  };
  return <div className="delta-delete-overlay" data-release="DELTA-DELETE-20261115-01" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <form role="dialog" aria-modal="true" aria-labelledby="delta-delete-title" className="delta-delete-dialog" onSubmit={deleteNow}>
      <div className="delta-delete-head"><h2 id="delta-delete-title">Excluir {kind==='code'?'código':'servidor'}</h2><button type="button" onClick={onClose} aria-label="Fechar">×</button></div>
      <p><strong>{expected}</strong> será retirado das listas e deixará de receber novas ativações. O histórico será preservado para auditoria.</p>
      {loading?<p>Verificando dependências…</p>:preview&&<div className="delta-delete-impact">
        {kind==='code'?<><b>Impacto do código</b><p>{preview.liveActivations} ativação(ões) vigente(s), {preview.financialCharges} lançamento(s) financeiro(s), {preview.pools} vínculo(s) com servidores.</p></>:
          <><b>Impacto do servidor</b><p>{preview.liveActivations} TV(s) em uso, {preview.codes} código(s) e {preview.pools} associação(ões) a pools.</p>
          <label>Servidor substituto (recomendado)
            <select value={replacementProviderId} onChange={e=>{setReplacement(e.target.value);setForce(false)}}>
              <option value="">Sem substituto automático</option>
              {(preview.alternatives||[]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          {preview.liveActivations>0&&!replacementProviderId&&<label className="delta-delete-force"><input type="checkbox" checked={force} onChange={e=>setForce(e.target.checked)}/> Autorizo a retirada sem substituto. Sei que TVs podem perder o conteúdo.</label>}</>}
        {preview.warning&&<p className="delta-delete-warning">{preview.warning}</p>}
      </div>}
      {error&&<p className="delta-delete-error" role="alert">{error}</p>}
      <label>Motivo (para auditoria)<textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={400} rows={2} placeholder="Motivo da remoção"/></label>
      <label>Digite <strong>{expected}</strong> para confirmar<input value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" aria-label="Confirmação de exclusão"/></label>
      <div className="delta-delete-actions"><button type="button" onClick={onClose}>Cancelar</button><button className="delta-delete-danger" type="submit" disabled={loading||saving||!preview||confirmation!==expected||(kind==='provider'&&preview.liveActivations>0&&!replacementProviderId&&!force)}>{saving?'Excluindo…':'Confirmar exclusão'}</button></div>
    </form>
  </div>;
}
