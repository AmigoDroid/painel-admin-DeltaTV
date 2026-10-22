import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Field, Modal, useAction, useDebounced } from "../ui.jsx";

/**
 * Cria um código de parceria: escolhido (validado ao vivo e único em toda a plataforma) ou gerado.
 * `base` = "/admin/partners" (com :id) ou "/partner" (portal do parceiro).
 */
export default function CodeModal({ checkPath, createPath, onClose, onCreated }) {
  const run = useAction();
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [max, setMax] = useState("");
  const [state, setState] = useState(null);
  const dcode = useDebounced(code.trim(), 300);

  useEffect(() => {
    if (!dcode) { setState(null); return; }
    let live = true;
    api(checkPath, { query: { code: dcode } }).then((r) => live && setState(r)).catch(() => live && setState(null));
    return () => { live = false; };
  }, [dcode, checkPath]);

  const create = async (withCode) => {
    const body = { label: label || undefined, maxActivations: max ? Number(max) : undefined, ...(withCode ? { code: code.trim() } : {}) };
    const r = await run(() => api(createPath, { method: "POST", body }), "Código criado.");
    if (r) onCreated(r.code);
  };
  // Só vale se a verificação corresponde ao texto atual (evita usar resultado de um código anterior).
  const ok = !!(state?.valid && state?.available && state.code === code.trim().toUpperCase());

  return (
    <Modal title="Novo código de ativação" onClose={onClose}>
      <p className="muted">O cliente digita este código no aplicativo, junto com usuário e senha do provedor. Ele identifica a parceria e o servidor — não é um segredo.</p>
      <Field label="Código (4 a 12 letras ou números)" hint={state ? undefined : "Deixe vazio para gerar automaticamente"}>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex.: 4343" maxLength={12} autoComplete="off" />
      </Field>
      {state && <p className={state.valid && state.available ? "" : "error"} style={state.valid && state.available ? { color: "var(--ok)" } : undefined}>{state.message}</p>}
      <div className="row">
        <Field label="Rótulo (opcional)"><input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
        <Field label="Máx. de ativações" hint="Vazio = sem limite por código"><input type="number" min="1" value={max} onChange={(e) => setMax(e.target.value)} /></Field>
      </div>
      <div className="actions">
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn" onClick={() => create(false)}>Gerar automaticamente</button>
        <button className="btn primary" disabled={!code.trim() || !ok} onClick={() => create(true)}>Usar este código</button>
      </div>
    </Modal>
  );
}
