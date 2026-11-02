import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Modal, useUi } from "../ui.jsx";

/** A prévia vem do servidor; nenhum dado de exclusão é decidido pelo frontend. */
const normalizeConfirmation = (value) => String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("pt-BR");
export default function AdminDeleteModal({ type, id, onClose, onDone }) {
  const root = type === "partner" ? `/admin/partners/${id}`
    : type === "device" ? `/admin/devices/registrations/${id}`
      : `/admin/devices/activations/${id}`;
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [confirmed, setConfirmed] = useState("");
  const [reason, setReason] = useState("");
  const [deleteClients, setDeleteClients] = useState(false);
  const [deleteDevices, setDeleteDevices] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useUi();
  useEffect(() => {
    let alive = true;
    api(`${root}/deletion-preview`).then((v) => { if (alive) setInfo(v); }).catch((e) => { if (alive) setError(e.message || "Erro ao consultar vínculos."); });
    return () => { alive = false; };
  }, [root]);
  const key = type === "partner" ? info?.name : info?.mac;
  const matchesConfirmation = type === "partner"
    ? [info?.name, info?.slug].some((value) => value && normalizeConfirmation(confirmed) === normalizeConfirmation(value))
    : Boolean(key && confirmed.trim() === key);
  const missingReason = type === "partner" && reason.trim().length < 8;
  const canDelete = Boolean(info && matchesConfirmation && !missingReason && !busy);
  const submit = async () => {
    if (!canDelete) return;
    setBusy(true);
    setSubmitError("");
    try {
      const body = type === "partner" ? { confirmation: confirmed.trim(), deleteClients, deleteDevices, reason: reason.trim() }
        : { confirmMac: confirmed.trim(), reason: reason.trim() };
      const result = await api(root, { method: "DELETE", body });
      if (result?.deleted) {
        toast("Exclusão administrativa concluída.");
        onDone?.(result);
      } else {
        setSubmitError("A API não confirmou a exclusão. Confira o log do backend antes de repetir a operação.");
      }
    } catch (e) {
      setSubmitError(`${e?.message || "Não foi possível excluir."}${e?.code ? ` (${e.code})` : ""}`);
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
          <p><strong>Remover do sistema:</strong> os acessos ao portal e os códigos serão desativados. O cadastro é arquivado para preservar pagamentos, créditos, faturas e auditoria; servidores são desativados, não apagados.</p>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 0" }}>
            <input type="checkbox" checked={deleteClients} onChange={(e) => setDeleteClients(e.target.checked)} />
            <span><strong>Apagar também os clientes cadastrados</strong><div className="muted">{info.clients} fichas privadas de clientes desta revenda serão excluídas permanentemente; clientes globais, licenças e dados financeiros permanecem.</div></span>
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 0" }}>
            <input type="checkbox" checked={deleteDevices} onChange={(e) => setDeleteDevices(e.target.checked)} />
            <span><strong>Apagar também os vínculos e dispositivos exclusivos</strong><div className="muted">{info.activations} ativações vinculadas serão excluídas e até {info.exclusiveDevices} aparelhos exclusivos poderão ser removidos. Aparelhos compartilhados com terceiros serão preservados.</div></span>
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
        <label className="field"><span>{type === "partner" ? <>Para confirmar, digite o <strong>nome completo</strong> ou o <strong>identificador</strong> abaixo:</> : <>Digite o MAC abaixo para confirmar:</>}</span>
          <strong style={{ userSelect: "all", overflowWrap: "anywhere" }}>{key}</strong>
          {type === "partner" && <small className="muted">Identificador alternativo: <strong style={{ userSelect: "all" }}>{info.slug}</strong></small>}
          <input value={confirmed} onChange={(e) => { setConfirmed(e.target.value); setSubmitError(""); }} autoComplete="off" placeholder={type === "partner" ? "Nome completo ou identificador" : key} aria-invalid={Boolean(confirmed && !matchesConfirmation)} />
          {confirmed && !matchesConfirmation && <small className="muted">O texto não corresponde ao cadastro. Use o nome completo ou o identificador exibido acima.</small>}
          {missingReason && type === "partner" && <small className="muted">O motivo deve ter pelo menos 8 caracteres.</small>}
        </label>
        {submitError && <p role="alert" className="error" style={{ overflowWrap: "anywhere" }}>{submitError}</p>}
        <div className="actions" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn danger" onClick={submit} disabled={!canDelete}>{busy ? "Excluindo…" : "Confirmar exclusão"}</button>
        </div>
      </>}
    </Modal>
  );
}
