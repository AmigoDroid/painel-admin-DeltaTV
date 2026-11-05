import { useEffect, useState } from "react";
import { api, getAuth } from "../api.js";
import { Badge, DeliveryBadge, Modal, Pager, Table, fmtDateTime, accessStatus, useAction, useLoad, useUi } from "../ui.jsx";
import EditDeviceModal from "./EditDeviceModal.jsx";
import AdminDeleteModal from "./AdminDeleteModal.jsx";

const EVENTS = {
  "device.trial.granted": "Teste gratuito concedido", "device.trial.replaced": "Teste substituído por licença paga",
  "activation.create": "Ativação criada", "activation.block": "Lista bloqueada", "activation.unblock": "Lista desbloqueada",
  "activation.revoke": "Ativação removida", "activation.restore": "Ativação restaurada", "activation.delete.admin": "Ativação excluída definitivamente",
  "device.configuration.confirm": "Lista adicionada ou configurada", "device.configuration.cancel": "Configuração cancelada",
  "device.admin.edit": "Configuração editada", "device.list.remove": "Lista removida", "device.register.admin": "Dispositivo cadastrado pelo painel",
  "device.playlist.configure": "Lista configurada", "device.playlist.by_url": "Lista enviada por link", "device.playlist.by_url_pending": "Lista aguardando licença",
  "license.transfer.in": "Licença recebida por transferência", "license.transfer.out": "Licença transferida para outro MAC",
  "device.key.issue": "Chave de acesso emitida", "device.delete.admin": "Aparelho excluído", "device.delete": "Cadastro removido",
  "web_access.create": "Player Web criado", "web_access.update": "Player Web configurado", "web_access.login": "Acesso ao Player Web",
};
const STATUS = { active: "Ativo", blocked: "Bloqueado", revoked: "Removido" };
const labelOf = a => a.listName || a.partner?.name || (a.license?.isTrial ? "Teste gratuito" : a.license ? `Licença ••••${a.license.codeLast4}` : "Lista própria");
const detailOf = event => [event.metadata?.reason, event.metadata?.days ? `Teste de ${event.metadata.days} dias` : null, event.metadata?.from && event.metadata?.to
  ? `${STATUS[event.metadata.from] || event.metadata.from} → ${STATUS[event.metadata.to] || event.metadata.to}` : null,
  event.metadata?.listName, event.metadata?.webAutoHttps !== undefined ? `HTTPS automático: ${event.metadata.webAutoHttps ? "ativado" : "desativado"}` : null].filter(Boolean).join(" · ");

export default function DeviceRecordModal({ device, initialTab = "lists", onClose, onChanged, onManage }) {
  const [tab, setTab] = useState(initialTab);
  const [eventPage, setEventPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { confirm } = useUi();
  const run = useAction();
  const isSuper = getAuth()?.user?.role === "superadmin";
  const { data, error, reload } = useLoad(() => api("/admin/devices/history", { query: { mac: device.mac, page: eventPage, pageSize: 20 } }), [device.mac, eventPage]);
  useEffect(() => { if (data?.eventsMeta && eventPage > data.eventsMeta.totalPages) setEventPage(data.eventsMeta.totalPages); }, [data, eventPage]);
  const changed = () => { reload(); onChanged?.(); };
  const act = async (activation, action) => {
    const options = {
      block: { title: "Bloquear lista", message: `Bloquear apenas “${labelOf(activation)}” do MAC ${device.mac}?`, reason: "required", danger: true },
      unblock: { title: "Desbloquear lista", message: `Desbloquear “${labelOf(activation)}” do MAC ${device.mac}?` },
      revoke: { title: "Remover ativação", message: `Remover apenas “${labelOf(activation)}” do MAC ${device.mac}? As outras listas continuam.`, reason: "optional", danger: true },
      restore: { title: "Restaurar ativação", message: `Restaurar “${labelOf(activation)}” do MAC ${device.mac}?` },
    };
    const answer = await confirm(options[action]);
    if (answer && await run(() => api(`/admin/devices/activations/${activation.id}/${action}`, { method: "POST", body: { reason: answer.reason } }), "Vínculo atualizado.")) changed();
  };
  const all = data?.activations || [];
  const current = all.filter(a => a.status !== "revoked"), removed = all.filter(a => a.status === "revoked");
  const rows = tab === "removed" ? removed : current;
  return <Modal title={`Dispositivo ${device.mac}`} onClose={onClose} wide>
    <div className="device-record-head"><p className="muted">Listas e histórico deste MAC. Cada ação de vínculo afeta somente a lista indicada.</p>
      <button type="button" className="btn primary" onClick={onManage}>Adicionar / configurar listas</button></div>
    <div className="tabs">
      <button type="button" className={`tab ${tab === "lists" ? "active" : ""}`} onClick={() => setTab("lists")}>Listas atuais ({current.length})</button>
      <button type="button" className={`tab ${tab === "removed" ? "active" : ""}`} onClick={() => setTab("removed")}>Removidas ({removed.length})</button>
      <button type="button" className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>Histórico ({data?.eventsMeta?.total ?? 0})</button>
    </div>
    {error && <p className="error" role="alert">{error} <button type="button" className="btn" onClick={reload}>Tentar novamente</button></p>}
    {!data ? <p className="muted">Carregando ficha…</p> : tab === "history" ? <>
      <Table><thead><tr><th>Quando</th><th>Alteração</th><th>Responsável</th><th>Resultado</th></tr></thead><tbody>
        {data.events.map(event => <tr key={event.id}><td>{fmtDateTime(event.createdAt)}</td>
          <td>{EVENTS[event.action] || event.action}<div className="muted">{detailOf(event)}</div></td>
          <td>{event.actorName}<div className="muted">{event.metadata?.actorPartnerName || ""}</div></td><td><Badge status={event.result} /></td></tr>)}
      </tbody></Table>
      {!data.events.length && <p className="muted">Nenhuma alteração registrada para este MAC.</p>}
      {data.eventsMeta?.totalPages > 1 && <Pager meta={data.eventsMeta} onPage={setEventPage} />}
    </> : <>
      <Table><thead><tr><th>Lista / vínculo</th><th>Situação</th><th>Entrega</th><th>Ativação</th><th>Remoção</th><th>Ações</th></tr></thead><tbody>
        {rows.map(a => <tr key={a.id}><td><strong>{labelOf(a)}</strong>{a.license?.isTrial && <div><span className="badge info">Teste gratuito</span></div>}<div className="muted">{a.provider?.name || ""}{a.grantedLicense ? ` · Licença ••••${a.grantedLicense.codeLast4}` : ""}</div></td>
          <td><Badge status={accessStatus(a)} /><div className="muted">{a.statusReason || (a.access?.allowed === false ? a.access.message : "")}</div></td>
          <td><DeliveryBadge mode={a.deliveryMode} fixed={a.deliveryModeFixed} /></td><td>{fmtDateTime(a.activatedAt)}</td><td>{fmtDateTime(a.revokedAt)}</td>
          <td><div className="device-record-actions">
            {isSuper && <button className="btn" onClick={() => setEditing(a)}>Editar</button>}
            {a.status === "active" && <button className="btn" onClick={() => act(a, "block")}>Bloquear</button>}
            {a.status === "blocked" && <button className="btn" onClick={() => act(a, "unblock")}>Desbloquear</button>}
            {a.status === "revoked" && isSuper && <button className="btn" onClick={() => act(a, "restore")}>Restaurar</button>}
            {a.status !== "revoked" && <button className="btn danger" onClick={() => act(a, "revoke")}>Remover</button>}
            {isSuper && <button className="btn danger" onClick={() => setDeleting(a)}>Excluir vínculo definitivamente</button>}
          </div></td></tr>)}
      </tbody></Table>
      {!rows.length && <p className="muted">{tab === "removed" ? "Nenhum vínculo removido." : "Nenhuma lista atual. Use Adicionar / configurar listas para vincular este aparelho."}</p>}
    </>}
    {editing && <EditDeviceModal device={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); changed(); }} />}
    {deleting && <AdminDeleteModal type="activation" id={deleting.id} onClose={() => setDeleting(null)} onDone={() => { setDeleting(null); changed(); }} />}
  </Modal>;
}
