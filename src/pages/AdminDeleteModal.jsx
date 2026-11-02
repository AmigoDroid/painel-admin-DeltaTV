import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Modal, useAction } from "../ui.jsx";

/** A prévia vem do servidor; nenhum dado de exclusão é decidido pelo frontend. */
export default function AdminDeleteModal({ type, id, onClose, onDone }) {
  const root = type === "partner" ? `/admin/partners/${id}`
    : type === "device" ? `/admin/devices/registrations/${id}`
      : `/admin/devices/activations/${id}`;
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState("");
  const [reason, setReason] = useState("");
  const [deleteClients, setDeleteClients] = useState(false);
  const [deleteDevices, setDeleteDevices] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = useAction();
  useEffect(() => {
    let alive = true;
    api(`${root}/deletion-preview`).then((v) => { if (alive) setInfo(v); }).catch((e) => { if (alive) setError(e.message || "Erro ao consultar vínculos."); });
    return () => { alive = false; };
  }, [root]);
  const key = type === "partner" ? info?.slug : info?.mac;
  const canDelete = Boolean(info && confirmed === key && !busy && (type !== "partner" || reason.trim().length >= 8));
  const submit = async () => {
    if (!canDelete) return;
    setBusy(true);
    try {
      const body = type === "partner" ? { confirmSlug: confirmed, deleteClients, deleteDevices, reason: reason.trim() }
        : { confirmMac: confirmed, reason: reason.trim() };
      const result = await run(() => api(root, { method: "DELETE", body }), "Exclusão administrativa registrada.");
      if (result?.deleted) onDone?.(result);
    } finally { setBusy(false); }
  };
  const title = type === "partner" ? "Excluir revenda / parceiro" : type === "device" ? "Excluir dispositivo completo" : "Excluir ativação definitivamente";
  return (
    <Modal title={title} onClose={onClose} wide>
      {error && <p role="alert" className="muted">{error}</p>}
      {!info && !error && <p className="muted">Verificando os vínculos e o histórico…</p>}
      {info && <>
        <div style={{ padding: 14, border: "1px solid var(--border, #6f7681)", borderRadius: 12, marginBottom: 16 }}>
          <strong>{info.name || info.mac}</strong>
          <p className="muted" style={{ marginBottom: 0 }}>
            {type === "partner" ? `Clientes: ${info.clients} · Ativações: ${info.activations} (licenças independentes da revenda: ${info.independentLicenseActivations}) · Aparelhos exclusivos: ${info.exclusiveDevices} · Códigos: ${info.codes} · Usuários: ${info.users}`
              : type === "device" ? `Todas as ativações deste aparelho: ${info.activations} · Acessos Web: ${info.webAccesses}`
                : `Status: ${info.status} · Outras ativações no aparelho: ${info.otherActivations}`}
          </p>
        </div>
        {type === "partner" ? <>
          <p><strong>Remover do sistema:</strong> o acesso da conta e todos os códigos serão desativados. O cadastro é arquivado para preservar pagamentos, saldos, faturas e auditoria.</p>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 0" }}>
            <input type="checkbox" checked={deleteClients} onChange={(e) => setDeleteClients(e.target.checked)} />
            <span><strong>Apagar também os clientes cadastrados</strong><div className="muted">{info.clients} fichas da revenda serão excluídas permanentemente.</div></span>
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 0" }}>
            <input type="checkbox" checked={deleteDevices} onChange={(e) => setDeleteDevices(e.target.checked)} />
            <span><strong>Apagar também os vínculos e dispositivos exclusivos</strong><div className="muted">{info.activations} ativações desta parceria serão excluídas. Um aparelho de outra parceria nunca será apagado.</div></span>
          </label>
          {!deleteDevices && <p className="muted">Mantendo os dispositivos: ativações ligadas à parceria perdem o acesso; licenças individuais independentes podem continuar válidas até vencer.</p>}
          {!deleteClients && <p className="muted">Mantendo os clientes: as fichas permanecem no cadastro arquivado, disponíveis para futura recuperação administrativa.</p>}
        </> : <p>
          {type === "device" ? "Todos os vínculos e sessões deste MAC serão apagados, inclusive os pertencentes a outras parcerias."
            : "Só esta ativação será apagada. As demais ativações do mesmo aparelho serão mantidas."}
          {" "}Registros financeiros e de auditoria serão preservados.
        </p>}
        <label className="field"><span>Motivo da exclusão {type === "partner" ? "(obrigatório)" : "(opcional)"}</span>
          <textarea rows={2} maxLength={400} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explique o motivo para o histórico de auditoria" />
        </label>
        <label className="field"><span>Digite <strong style={{ userSelect: "all" }}>{key}</strong> para confirmar:</span>
          <input value={confirmed} onChange={(e) => setConfirmed(e.target.value)} autoComplete="off" placeholder={key} />
        </label>
        <div className="actions" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn danger" onClick={submit} disabled={!canDelete}>{busy ? "Excluindo…" : "Confirmar exclusão"}</button>
        </div>
      </>}
    </Modal>
  );
}
