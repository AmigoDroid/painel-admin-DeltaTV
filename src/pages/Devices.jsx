import { useBulkRemoval } from "../../shared/useBulkRemoval.jsx";
import { Modal } from "../ui.jsx";
import { useEffect, useState } from "react";
import { api, getAuth } from "../api.js";
import { Badge, OnlineBadge, PlatformBadge, Empty, Pager, Table, useDebounced, useList, useUi, RowMenu } from "../ui.jsx";
import CredentialsModal from "./CredentialsModal.jsx";
import DeviceListsModal from "./DeviceListsModal.jsx";
import DeviceRecordModal from "./DeviceRecordModal.jsx";
import AdminDeleteModal from "./AdminDeleteModal.jsx";

const REFRESH_MS = 60000; // fallback quando o WebSocket não informa mudanças; evita refazer a lista a cada 20 s

export default function Devices({ onChanged, scoped = false }) {
  const { toast } = useUi();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const apiRoot = scoped ? "/admin/workspace/devices" : "/admin/devices";
  const canWrite = !scoped || (getAuth()?.user?.delegatedPermissions || []).includes("network:devices:write");
  const list = useList(`${apiRoot}/by-mac`, { q: "", status: "", online: "", showRemoved: "false" });
  const [selection, setSelection] = useState([]);
  const [bulkAction, setBulkAction] = useState(null);
  const [scopedAction, setScopedAction] = useState(null);
  const [record, setRecord] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [viewing, setViewing] = useState(null); // linha do MAC cujas listas estão abertas (sem precisar da chave da TV)
  const isSuper = getAuth()?.user?.role === "superadmin";
  const bulk = useBulkRemoval({
    Modal, rows: list.data, scope: JSON.stringify(list.params), loading: list.loading,
    id: d => d.deviceId, label: d => d.mac, eligible: () => isSuper,
    description: "Exclusão global exclusiva do Superadmin: remove o aparelho, suas ativações, sessões e acessos Web de todos os parceiros.",
    requireReason: true, confirmationWord: "EXCLUIR", allowForce: true,
    bulkRemove: (items, reason, force) => api("/admin/devices/registrations/bulk-delete", {method:"POST",body:{ids:items.map(d=>d.deviceId),reason,force,confirmation:"EXCLUIR"}}),
    preview: async d => {
      const info = await api(`/admin/devices/registrations/${d.deviceId}/deletion-preview`);
      if (info.mac !== d.mac) throw new Error("O MAC mudou. Atualize a lista.");
      return `${info.activations} ativação(ões) · ${info.webAccesses} acesso(s) Web`;
    },
    remove: async d => {
      const result = await api(`/admin/devices/registrations/${d.deviceId}`, { method: "DELETE", body: { confirmMac: d.mac } });
      if (!result?.deleted) throw new Error("Exclusão sem confirmação do servidor.");
    },
    refresh: async () => { await list.reload(); onChanged?.(); },
  });
  const [adding, setAdding] = useState(null); // linha do MAC que vai receber outro parceiro (ou ter o acesso do parceiro atualizado)
  useEffect(() => { list.filter({ q: dq }); /* eslint-disable-next-line */ }, [dq]);
  useEffect(() => { setSelection([]); }, [JSON.stringify(list.params)]);

  // Atualização automática da presença: pausa com a aba escondida ou com janela aberta (não atrapalha quem está editando).
  const busy = registering || viewing || adding || record || deleting || scopedAction || bulkAction;
  useEffect(() => {
    if (busy) return undefined;
    const t = setInterval(() => { if (!document.hidden && !list.loading) list.reload({ passive: true }); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [busy, list.reload, list.loading]);


  return (
    <>
      <div className="page-head"><h2>Dispositivos</h2>{canWrite && <button className="btn primary" onClick={() => setRegistering(true)}>Cadastrar dispositivo</button>}</div>
      <p className="muted">Um aparelho por MAC. Abra a ficha para consultar suas listas, remoções e alterações.{scoped ? " Somente vínculos da sua rede; MACs de outras redes são preservados." : ""}</p>
      <div className="toolbar">
        <input aria-label="Pesquisar dispositivo por MAC" placeholder="Pesquisar por MAC" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={list.params.status} onChange={(e) => list.filter({ status: e.target.value })}>
          <option value="">Vínculos atuais</option><option value="active">Com vínculo ativo</option><option value="trial">Período de teste</option><option value="expired">Expirado</option><option value="blocked">Somente bloqueados</option><option value="revoked">Somente removidos</option>{!scoped && <option value="unlinked">Sem vínculo</option>}
        </select>
        <label><input type="checkbox" checked={list.params.showRemoved === "true"} onChange={e => list.filter({ showRemoved: String(e.target.checked) })} /> Mostrar removidos</label>
        <select value={list.params.online} onChange={(e) => list.filter({ online: e.target.value })} aria-label="Conexão">
          <option value="">Online e offline</option><option value="true">Só online</option><option value="false">Só offline</option>
        </select>
      </div>
      {isSuper && bulk.toolbar}
      {scoped && canWrite && <div className="bulk-tools"><label><input type="checkbox" checked={list.data.length > 0 && selection.length === list.data.length} onChange={e=>setSelection(e.target.checked ? list.data.map(d=>d.deviceId) : [])}/> Selecionar página</label>
        {selection.length > 0 && ["block","unblock","revoke","restore","delete"].map(action=><button key={action} className={`btn sm ${action==="delete"?"danger":""}`} onClick={()=>setBulkAction(action)}>{({block:"Bloquear",unblock:"Desbloquear",revoke:"Desvincular",restore:"Restaurar",delete:"Excluir"})[action]} ({selection.length})</button>)}</div>}
      <div className="device-list delta-tv-list"><Table><thead><tr><th>MAC / aparelho</th><th>Tipo</th><th>Conexão</th><th>Assistindo / IP</th><th>Listas atuais</th><th>Parceiros</th><th>Situação dos vínculos</th><th /><th className="mobile-details-header">Informações</th></tr></thead>
        <tbody>{list.data.map(device => <tr key={device.deviceId}>
          <td>{isSuper && bulk.checkbox(device)}{scoped && canWrite && <input type="checkbox" aria-label={`Selecionar ${device.mac}`} checked={selection.includes(device.deviceId)} onChange={e=>setSelection(prev=>e.target.checked?[...prev,device.deviceId]:prev.filter(id=>id!==device.deviceId))}/>}<button type="button" className="device-mac-link mono" onClick={() => setRecord({ device, tab: "summary" })}>{device.mac}</button></td>
          <td><PlatformBadge platform={device.platform} /></td><td><OnlineBadge online={device.online} lastSeenAt={device.lastSeenAt} /></td>
          <td><strong>{device.live?.playback?.title || '—'}</strong><div className="muted">{device.live?.online ? `IP: ${device.live.ip || 'indisponível'}` : 'Sem telemetria atual'}</div></td>
          <td><strong>{device.currentCount}</strong><div className="muted">{device.removedCount > 0 ? `${device.removedCount} removida(s)` : ""}</div></td>
          <td>{device.partners?.join(" · ") || "—"}</td>
          <td>{device.status === "unlinked" ? <span className="badge muted">Sem vínculo</span> : <Badge status={device.status} label={({ active: "Com vínculo ativo", trial: "Período de teste", expired: "Expirado", blocked: "Vínculos bloqueados", revoked: "Vínculos removidos" })[device.status]} />}
            {device.blockedCount > 0 && device.activeCount > 0 && <div className="muted">{device.blockedCount} bloqueada(s)</div>}</td>
          <td className="actions"><RowMenu items={[
            { label: "Abrir ficha do dispositivo", onClick: () => setRecord({ device, tab: "summary" }) },
            { label: "Histórico de alterações", onClick: () => setRecord({ device, tab: "history" }) },
            { label: "Adicionar / configurar listas", hidden: !canWrite, onClick: () => setViewing(device) },
            { label: "Adicionar parceiro", hidden: !canWrite, onClick: () => setAdding(device) },
            ...((scoped && canWrite) ? [
              { label: "Bloquear vínculos da minha rede", hidden: device.activeCount === 0, onClick:()=>setScopedAction({device,action:"block"}) },
              { label: "Desbloquear vínculos da minha rede", hidden: device.blockedCount === 0, onClick:()=>setScopedAction({device,action:"unblock"}) },
              { label: "Desvincular da minha rede", hidden: device.currentCount === 0, onClick:()=>setScopedAction({device,action:"revoke"}) },
              { label: "Restaurar vínculo removido", hidden: device.restorableCount === 0, onClick:()=>setScopedAction({device,action:"restore"}) },
              { label: "Excluir meus vínculos neste aparelho", danger:true, onClick:()=>setScopedAction({device,action:"delete"}) },
            ] : []),
            { label: "Excluir aparelho e todos os vínculos", hidden: !isSuper, danger: true, onClick: () => setDeleting({ type: "device", id: device.deviceId }) },
          ]} /></td>
          <td className="mobile-device-details" data-label="Informações"><details><summary>Mais informações da TV</summary>
            <div>Tipo: <PlatformBadge platform={device.platform}/></div>
            <div>Reprodução: {device.live?.playback?.title || 'Sem telemetria atual'}</div>
            <div>IP: {device.live?.online ? device.live.ip || 'indisponível' : 'offline'}</div>
            <div>Parceiros: {device.partners?.join(' · ') || '—'}</div>
          </details></td>
        </tr>)}</tbody></Table></div>
      <Empty loading={list.loading} error={list.error} count={list.data.length} />
      <Pager meta={list.meta} onPage={list.setPage} />
      {scoped && canWrite && registering && <ScopedDeviceConfig title="Cadastrar dispositivo" apiRoot={apiRoot} onClose={()=>setRegistering(false)} onDone={()=>{setRegistering(false);list.reload();onChanged?.();}} />}
      {!scoped && registering && (
        <CredentialsModal
          title="Cadastrar dispositivo" askMac submitLabel="Cadastrar"
          intro="Informe o MAC e os dados de acesso. Se o MAC já tiver lista, o parceiro informado é adicionado e as outras listas continuam."
          onSubmit={(body) => api("/admin/devices/register", { method: "POST", body })}
          onClose={() => setRegistering(false)}
          onDone={(r) => { setRegistering(false); toast(`${r.mac} cadastrado${r.listName ? ` na lista “${r.listName}”` : ""}.`); list.reload(); onChanged?.(); }}
        />
      )}
      {scoped && canWrite && adding && <ScopedDeviceConfig title={`Adicionar parceiro a ${adding.mac}`} device={adding} apiRoot={apiRoot} onClose={()=>setAdding(null)} onDone={()=>{setAdding(null);list.reload();onChanged?.();}} />}
      {!scoped && adding && (
        <CredentialsModal
          title="Adicionar parceiro ao MAC" mac={adding.mac} submitLabel="Salvar parceiro"
          intro="Um MAC pode ter vários parceiros. Se o código for de um parceiro que ainda não está neste MAC, ele é adicionado e as outras listas continuam. Se já estiver, o acesso dele é atualizado. A alteração fica registrada em seu nome."
          onSubmit={(body) => api(`/admin/devices/registrations/${adding.deviceId}/configuration`, { method: "POST", body: { mode: "partner", confirm: true, ...body } })}
          onClose={() => setAdding(null)}
          onDone={() => { setAdding(null); toast("Parceiro salvo neste MAC."); list.reload(); onChanged?.(); }}
        />
      )}
      {viewing && (
        <DeviceListsModal device={viewing} scoped={scoped} canWrite={canWrite} onClose={() => setViewing(null)} onChanged={() => { list.reload(); onChanged?.(); }} />
      )}
      {deleting && <AdminDeleteModal type={deleting.type} id={deleting.id} onClose={() => setDeleting(null)} onDone={() => { setDeleting(null); list.reload(); onChanged?.(); }} />}
      {record && <DeviceRecordModal device={record.device} scoped={scoped} canWrite={canWrite} initialTab={record.tab}
        onClose={() => setRecord(null)} onChanged={() => { list.reload(); onChanged?.(); }}
        onManage={() => { if(canWrite){setRecord(null);setViewing(record.device);} }} />}
      {scopedAction && <ScopedDeviceAction apiRoot={apiRoot} action={scopedAction.action} device={scopedAction.device} onClose={()=>setScopedAction(null)} onDone={()=>{setScopedAction(null);list.reload();onChanged?.();}}/>}
      {bulkAction && <ScopedDeviceAction apiRoot={apiRoot} action={bulkAction} ids={selection} onClose={()=>setBulkAction(null)} onDone={()=>{setBulkAction(null);setSelection([]);list.reload();onChanged?.();}}/>}

    </>
  );
}


// Os formulários são os mesmos do painel para parceiros; estas chamadas usam
// SOMENTE /admin/workspace e a API valida o código pertencente ao Admin logado.
function ScopedDeviceConfig({title, device, apiRoot, onClose, onDone}) {
  const {toast}=useUi();
  const [mac,setMac]=useState("");
  const [code,setCode]=useState(""),[username,setUsername]=useState(""),[password,setPassword]=useState("");
  const [error,setError]=useState(""),[busy,setBusy]=useState(false);
  const save=async()=>{
    if(busy)return;
    setBusy(true);setError("");
    try{
      if(device)await api(`${apiRoot}/registrations/${device.deviceId}/configuration`,{
        method:"POST",body:{mode:"partner",confirm:true,code,username,password}});
      else await api(`${apiRoot}/register`,{method:"POST",body:{mac,code,username,password}});
      toast("Parceiro configurado nesta TV.");onDone?.();
    }catch(e){setError(e.message||"Não foi possível configurar a TV.");}
    finally{setBusy(false);}
  };
  return <Modal title={title} onClose={onClose}>
    <p className="muted">Informe um código pertencente à sua própria rede. Outras parcerias neste MAC não serão alteradas.</p>
    {!device && <label className="field">MAC da TV<input autoComplete="off" value={mac} onChange={e=>setMac(e.target.value)} placeholder="AA:BB:CC:DD:EE:FF"/></label>}
    <label className="field">Código da parceria<input autoComplete="off" value={code} onChange={e=>setCode(e.target.value)}/></label>
    <label className="field">Usuário do provedor<input autoComplete="off" value={username} onChange={e=>setUsername(e.target.value)}/></label>
    <label className="field">Senha do provedor<input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {error&&<p role="alert" className="notice error">{error}</p>}
    <div className="actions"><button className="btn" onClick={onClose} disabled={busy}>Cancelar</button><button className="btn primary" onClick={save} disabled={busy||(!device&&!mac)||!code||!username||!password}>{busy?"Salvando…":"Salvar"}</button></div>
  </Modal>;
}

function ScopedDeviceAction({apiRoot,action,device,ids,onClose,onDone}){
  const {toast}=useUi();
  const [reason,setReason]=useState(""),[confirmMac,setConfirmMac]=useState(""),[confirmWord,setConfirmWord]=useState("");
  const [error,setError]=useState(""),[busy,setBusy]=useState(false),[preview,setPreview]=useState(null);
  useEffect(()=>{if(action!=="delete"||!device)return;
    let alive=true;api(`${apiRoot}/registrations/${device.deviceId}/deletion-preview`).then(info=>{if(alive)setPreview(info);}).catch(e=>{if(alive)setError(e.message);});
    return()=>{alive=false;};
  },[apiRoot,action,device?.deviceId]);
  const title=({block:"Bloquear",unblock:"Desbloquear",revoke:"Desvincular",restore:"Restaurar",delete:"Excluir"})[action];
  const needsReason=action==="delete"||action==="block";
  const valid=(!needsReason||reason.trim().length>=3)&&(action!=="delete"||(device?confirmMac===device.mac:confirmWord==="EXCLUIR"));
  const execute=async()=>{
    if(!valid||busy)return;
    setBusy(true);setError("");
    try{
      const result=device?await api(`${apiRoot}/registrations/${device.deviceId}${action==="delete"?"":`/${action}`}`,{
        method:action==="delete"?"DELETE":"POST",
        body:{reason:reason.trim(),...(action==="delete"?{confirmMac:device.mac}:{})},
      }):await api(`${apiRoot}/bulk-action`,{method:"POST",body:{ids,action,reason:reason.trim(),...(action==="delete"?{confirmation:"EXCLUIR"}:{})}});
      if(result.failed>0){setError(`${result.succeeded} concluído(s), ${result.failed} falha(s). ${result.results.filter(r=>!r.ok).map(r=>r.message||r.code).join(" · ")}`);return;}
      toast(`${title}: ${result.succeeded} vínculo(s) atualizado(s).`);onDone?.();
    }catch(e){setError(e.message||"Falha ao executar operação.");}
    finally{setBusy(false);}
  };
  return <Modal title={`${title} ${device?device.mac:`${ids.length} aparelho(s)`}`} onClose={onClose}>
    <p>{action==="delete"?"Apenas vínculos da SUA rede serão excluídos. O MAC físico e os vínculos de outras redes são preservados. Esta exclusão é definitiva; restauração é aplicável somente a vínculos revogados, quando ainda recuperáveis.":"A operação afeta somente as ativações da sua rede. Na desvinculação feita por este Admin, as credenciais criptografadas ficam preservadas apenas para restauração. Vínculos antigos sem credenciais precisam de reconfiguração."}</p>
    {preview&&<p className="muted">Vínculos da rede neste MAC: {preview.activations}</p>}
    <label className="field">Motivo {needsReason?"(obrigatório)":"(opcional)"}<textarea rows={2} value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}/></label>
    {action==="delete"&&(device?<label className="field">Confirme o MAC<input value={confirmMac} onChange={e=>setConfirmMac(e.target.value)} placeholder={device.mac}/></label>:<label className="field">Digite EXCLUIR<input value={confirmWord} onChange={e=>setConfirmWord(e.target.value)}/></label>)}
    {error&&<p role="alert" className="notice error">{error}</p>}
    <div className="actions"><button className="btn" onClick={onClose} disabled={busy}>Cancelar</button><button className={`btn ${action==="delete"?"danger":"primary"}`} disabled={busy||!valid} onClick={execute}>{busy?"Processando…":`Confirmar ${title.toLowerCase()}`}</button></div>
  </Modal>;
}
