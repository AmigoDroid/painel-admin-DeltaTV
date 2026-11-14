import { useEffect, useState } from "react";
import { api, getAuth } from "../api.js";
import { Badge, OnlineBadge, PlatformBadge, Empty, Pager, Table, useDebounced, useList, useUi, RowMenu } from "../ui.jsx";
import CredentialsModal from "./CredentialsModal.jsx";
import DeviceListsModal from "./DeviceListsModal.jsx";
import DeviceRecordModal from "./DeviceRecordModal.jsx";
import AdminDeleteModal from "./AdminDeleteModal.jsx";

const REFRESH_MS = 20000;

export default function Devices({ onChanged }) {
  const { toast } = useUi();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const list = useList("/admin/devices/by-mac", { q: "", status: "", online: "" });
  const [record, setRecord] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [viewing, setViewing] = useState(null); // linha do MAC cujas listas estão abertas (sem precisar da chave da TV)
  const isSuper = getAuth()?.user?.role === "superadmin";
  const [adding, setAdding] = useState(null); // linha do MAC que vai receber outro parceiro (ou ter o acesso do parceiro atualizado)
  useEffect(() => { list.filter({ q: dq }); /* eslint-disable-next-line */ }, [dq]);

  // Atualização automática da presença: pausa com a aba escondida ou com janela aberta (não atrapalha quem está editando).
  const busy = registering || viewing || adding || record || deleting;
  useEffect(() => {
    if (busy) return undefined;
    const t = setInterval(() => { if (!document.hidden) list.reload(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [busy, list.reload]);


  return (
    <>
      <div className="page-head"><h2>Dispositivos</h2><button className="btn primary" onClick={() => setRegistering(true)}>Cadastrar dispositivo</button></div>
      <p className="muted">Um aparelho por MAC. Abra a ficha para consultar suas listas, remoções e alterações.</p>
      <div className="toolbar">
        <input aria-label="Pesquisar dispositivo por MAC" placeholder="Pesquisar por MAC" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={list.params.status} onChange={(e) => list.filter({ status: e.target.value })}>
          <option value="">Todos</option><option value="active">Com vínculo ativo</option><option value="blocked">Somente bloqueados</option><option value="revoked">Somente removidos</option><option value="unlinked">Sem vínculo</option>
        </select>
        <select value={list.params.online} onChange={(e) => list.filter({ online: e.target.value })} aria-label="Conexão">
          <option value="">Online e offline</option><option value="true">Só online</option><option value="false">Só offline</option>
        </select>
      </div>
      <Table><thead><tr><th>MAC / aparelho</th><th>Tipo</th><th>Conexão</th><th>Assistindo / IP</th><th>Listas atuais</th><th>Parceiros</th><th>Situação dos vínculos</th><th /></tr></thead>
        <tbody>{list.data.map(device => <tr key={device.deviceId}>
          <td><button type="button" className="device-mac-link mono" onClick={() => setRecord({ device, tab: "summary" })}>{device.mac}</button></td>
          <td><PlatformBadge platform={device.platform} /></td><td><OnlineBadge online={device.online} lastSeenAt={device.lastSeenAt} /></td>
          <td><strong>{device.live?.playback?.title || '—'}</strong><div className="muted">{device.live?.online ? `IP: ${device.live.ip || 'indisponível'}` : 'Sem telemetria atual'}</div></td>
          <td><strong>{device.currentCount}</strong><div className="muted">{device.activeCount} ativa(s){device.removedCount > 0 ? ` · ${device.removedCount} removida(s)` : ""}</div></td>
          <td>{device.partners?.join(" · ") || "—"}</td>
          <td>{device.status === "unlinked" ? <span className="badge muted">Sem vínculo</span> : <Badge status={device.status} label={device.status === "active" ? "Com vínculo ativo" : device.status === "blocked" ? "Vínculos bloqueados" : "Vínculos removidos"} />}
            {device.blockedCount > 0 && device.activeCount > 0 && <div className="muted">{device.blockedCount} bloqueada(s)</div>}</td>
          <td className="actions"><RowMenu items={[
            { label: "Abrir ficha do dispositivo", onClick: () => setRecord({ device, tab: "summary" }) },
            { label: "Histórico de alterações", onClick: () => setRecord({ device, tab: "history" }) },
            { label: "Adicionar / configurar listas", onClick: () => setViewing(device) },
            { label: "Adicionar parceiro", onClick: () => setAdding(device) },
            { label: "Excluir aparelho e todos os vínculos", hidden: !isSuper, danger: true, onClick: () => setDeleting({ type: "device", id: device.deviceId }) },
          ]} /></td>
        </tr>)}</tbody></Table>
      <Empty loading={list.loading} error={list.error} count={list.data.length} />
      <Pager meta={list.meta} onPage={list.setPage} />
      {registering && (
        <CredentialsModal
          title="Cadastrar dispositivo" askMac submitLabel="Cadastrar"
          intro="Informe o MAC e os dados de acesso. Se o MAC já tiver lista, o parceiro informado é adicionado e as outras listas continuam."
          onSubmit={(body) => api("/admin/devices/register", { method: "POST", body })}
          onClose={() => setRegistering(false)}
          onDone={(r) => { setRegistering(false); toast(`${r.mac} cadastrado${r.listName ? ` na lista “${r.listName}”` : ""}.`); list.reload(); onChanged?.(); }}
        />
      )}
      {adding && (
        <CredentialsModal
          title="Adicionar parceiro ao MAC" mac={adding.mac} submitLabel="Salvar parceiro"
          intro="Um MAC pode ter vários parceiros. Se o código for de um parceiro que ainda não está neste MAC, ele é adicionado e as outras listas continuam. Se já estiver, o acesso dele é atualizado. A alteração fica registrada em seu nome."
          onSubmit={(body) => api(`/admin/devices/registrations/${adding.deviceId}/configuration`, { method: "POST", body: { mode: "partner", confirm: true, ...body } })}
          onClose={() => setAdding(null)}
          onDone={() => { setAdding(null); toast("Parceiro salvo neste MAC."); list.reload(); onChanged?.(); }}
        />
      )}
      {viewing && (
        <DeviceListsModal device={viewing} onClose={() => setViewing(null)} onChanged={() => { list.reload(); onChanged?.(); }} />
      )}
      {deleting && <AdminDeleteModal type={deleting.type} id={deleting.id} onClose={() => setDeleting(null)} onDone={() => { setDeleting(null); list.reload(); onChanged?.(); }} />}
      {record && <DeviceRecordModal device={record.device} initialTab={record.tab}
        onClose={() => setRecord(null)} onChanged={() => { list.reload(); onChanged?.(); }}
        onManage={() => { setRecord(null); setViewing(record.device); }} />}

    </>
  );
}
