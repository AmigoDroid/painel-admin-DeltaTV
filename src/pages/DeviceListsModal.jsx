import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Modal, useAction, useUi } from "../ui.jsx";
import ConfigureForm from "./ConfigureForm.jsx";
import DeviceLists, { removeMessage, saveMessage } from "./DeviceLists.jsx";

/**
 * Listas de um dispositivo (MAC) vistas pelo PAINEL: quem já está logado como administrador não precisa da
 * chave de 6 dígitos da TV. A autorização é do backend (/admin/devices/registrations/:id...), a cada chamada.
 * O login por chave (DeviceAccess) continua existindo, mas só para quem NÃO tem conta no painel.
 */
export default function DeviceListsModal({ device, onClose, onChanged, scoped = false, canWrite = true }) {
  const { confirm } = useUi();
  const run = useAction();
  const [state, setState] = useState(null);
  const [attribution, setAttribution] = useState(null);
  const apiRoot = scoped ? "/admin/workspace/devices" : "/admin/devices";
  const base = `${apiRoot}/registrations/${device.deviceId}`;

  const load = async () => {
    const d = await run(() => api(base));
    if (d && d !== true) setState(d);
    const attrs = await run(() => api(`${base}/attribution`));
    if (attrs && attrs !== true) setAttribution(attrs);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [device.deviceId]);

  const submit = async (configuration) => {
    const c = await confirm({
      title: "Adicionar ou atualizar lista",
      confirmLabel: configuration.mode === "partner" ? "Salvar parceiro" : "Salvar lista",
      message: saveMessage(configuration, device.mac),
    });
    if (!c) return false;
    if (await run(() => api(`${base}/configuration`, { method: "POST", body: configuration }), "Lista salva.")) { await load(); onChanged?.(); }
    return true;
  };

  // Com várias listas no MAC o servidor exige `activationId`: cada botão Remover aponta para a lista dele.
  const remove = async (list) => {
    const c = await confirm({ title: "Remover lista", danger: true, reason: "required", confirmLabel: "Remover", message: removeMessage(list, device.mac) });
    if (!c) return;
    const r = await run(() => api(`${base}/remove-list`, { method: "POST", body: { reason: c.reason, activationId: list.activationId } }), "Lista removida.");
    if (r && r !== true && r.removed === false) await run(async () => { throw new Error(r.message || "Nada a remover."); });
    if (r) { await load(); onChanged?.(); }
  };

  const revoke = async list => {
    const c = await confirm({title:"Desvincular ativação",danger:true,reason:"optional",confirmLabel:"Desvincular",
      message:`O MAC ${device.mac} continuará cadastrado. A ativação selecionada ficará revogada.`});
    if (!c) return;
    const r = await run(() => api(`${apiRoot}/activations/${list.activationId}/revoke`,{method:"POST",body:{reason:c.reason}}),"Ativação desvinculada.");
    if (r) { await load(); onChanged?.(); }
  };
  const deleteLink = async list => {
    const typed=window.prompt(`Para excluir apenas esta ativação do MAC ${device.mac}, digite o MAC:`);
    if (typed !== device.mac) return;
    const reason=window.prompt("Motivo obrigatório (mínimo 3 caracteres):");
    if (!reason || reason.trim().length < 3) return;
    const r=await run(() => api(`${apiRoot}/activations/${list.activationId}`,{method:"DELETE",body:{confirmMac:typed,reason}}),"Vínculo excluído.");
    if (r) { await load(); onChanged?.(); }
  };

  return (
    <Modal title={`Listas de ${device.mac}`} onClose={onClose} wide>
      {!state ? <p className="muted">Carregando…</p> : (
        <>
          <DeviceLists device={state} onRemove={scoped || !canWrite ? undefined : remove} onRevoke={canWrite ? revoke : undefined} onDelete={canWrite ? deleteLink : undefined} />
          <h4>Quem ativou e configurou</h4>
          {attribution?.activations?.map(item => (
            <section className="card" key={item.activationId} style={{padding:14, marginBottom:12, overflowWrap:"anywhere"}}>
              <strong>{item.listName || `Ativação ${item.activationId.slice(0,8)}`}</strong>
              <div>Ativou: <strong>{item.activatedBy?.name || "Não identificado no histórico"}</strong></div>
              <div>Adicionou/alterou a lista: <strong>{item.listAddedBy?.name || "Não identificado no histórico"}</strong></div>
              <div>Última alteração: <strong>{item.lastChangedBy?.name || "Sem registro"}</strong></div>
              <div className="muted">{item.listAddedBy?.at ? new Date(item.listAddedBy.at).toLocaleString("pt-BR") : "Sem data de autoria registrada"}</div>
            </section>
          ))}
          {canWrite && !scoped && <ConfigureForm device={state} onSubmit={submit} />}
          {scoped && canWrite && <ScopedPartnerForm onSubmit={async body=>{const success=await run(()=>api(`${base}/configuration`,{method:"POST",body:{mode:"partner",confirm:true,...body}}),"Parceria configurada.");if(success){await load();onChanged?.();}}} />}
        </>
      )}
    </Modal>
  );
}

function ScopedPartnerForm({onSubmit}) {
  const [code,setCode]=useState(""),[username,setUsername]=useState(""),[password,setPassword]=useState("");
  return <section className="card" style={{padding:14,display:"grid",gap:10}}>
    <h4>Adicionar / atualizar parceria da minha rede</h4>
    <p className="muted">Somente códigos pertencentes à sua rede são aceitos. Não é possível configurar uma licença global desta tela.</p>
    <label>Código<input value={code} onChange={e=>setCode(e.target.value)} /></label>
    <label>Usuário<input value={username} onChange={e=>setUsername(e.target.value)} /></label>
    <label>Senha<input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} /></label>
    <button type="button" className="btn primary" disabled={!code||!username||!password} onClick={()=>onSubmit({code,username,password})}>Salvar parceiro</button>
  </section>;
}
