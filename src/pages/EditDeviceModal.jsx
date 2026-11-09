import { useState } from "react";
import { api } from "../api.js";
import { Field, Modal, useAction } from "../ui.jsx";

/**
 * Edição de um dispositivo (ativação) pelo SUPERADMIN: modo de entrega (automático / redirect / proxy)
 * e lista própria (nome, novo link M3U ou remoção). O backend exige a permissão; aqui só apresentamos.
 * O link completo nunca é exibido de volta: deixe em branco para manter o atual.
 */
export default function EditDeviceModal({ device, onClose, onDone }) {
  const run = useAction();
  const [mode, setMode] = useState(device.deliveryModeOverride ? device.deliveryMode : "auto");
  const [applyMode, setApplyMode] = useState(false);
  const [name, setName] = useState(device.listName || "");
  const [url, setUrl] = useState("");
  const [removeList, setRemoveList] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const body = {};
    const currentMode = device.deliveryModeOverride ? device.deliveryMode : "auto";
    if (applyMode || mode !== currentMode) body.deliveryMode = mode === "auto" ? null : mode;
    if (removeList) body.removeList = true;
    else {
      if (url.trim()) body.playlistUrl = url.trim();
      if (device.hasOwnList || url.trim()) {
        if (name.trim() && name.trim() !== (device.listName || "")) body.playlistName = name.trim();
      }
    }
    if (!Object.keys(body).length) return onClose();
    setBusy(true);
    const r = await run(() => api(`/admin/devices/activations/${device.id}`, { method: "PATCH", body }), "Dispositivo atualizado.");
    setBusy(false);
    if (r) onDone(r);
  };

  return (
    <Modal title="Editar dispositivo" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="muted">A alteração fica registrada em seu nome e vale na próxima abertura do app (até 1 minuto).</p>
        <Field label="MAC do aparelho"><input className="mono" value={device.mac || ""} readOnly tabIndex={-1} /></Field>
        <Field label="Entrega" hint="Automático: lista própria = redirect; parceria = modo do provedor. Redirect: o app fala direto com o provedor. Proxy: o servidor serve o conteúdo.">
          <select value={mode} onChange={(e) => { setMode(e.target.value); setApplyMode(true); }}>
            <option value="auto">Automático</option>
            <option value="redirect">Redirect (302)</option>
            <option value="proxy">Proxy completo (catálogo e mídia)</option>
          </select>
        </Field>
        {device.deliveryProtected && <p className="muted">A proteção global do servidor está ativa: todos os tipos passam pelo proxy.</p>}
        <label className="check"><input type="checkbox" checked={applyMode} onChange={e => setApplyMode(e.target.checked)} /> Aplicar este modo a todos os tipos, removendo exceções anteriores</label>
        <p className="muted">O proxy permite intermediar clientes IPv6 e origens IPv4 quando o aparelho suporta IPv6. Consome banda da VPS. Redirect depende da conexão direta com o provedor.</p>
        <>
          <Field label="Nome da lista própria"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={160} disabled={removeList} /></Field>
          <Field label="Novo link da lista (M3U)" hint="Se houver uma lista de parceria, esta lista própria terá prioridade. Deixe vazio para manter a configuração atual.">
            <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" autoComplete="off" spellCheck={false} disabled={removeList} placeholder="https://servidor/get.php?username=…&password=…" />
          </Field>
          {device.hasOwnList && (
            <label className="check"><input type="checkbox" checked={removeList} onChange={(e) => setRemoveList(e.target.checked)} /> Remover a lista própria (mantém a ativação e eventuais parcerias)</label>
          )}
        </>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    </Modal>
  );
}
