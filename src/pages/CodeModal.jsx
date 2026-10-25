import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Field, Modal, useAction, useDebounced } from "../ui.jsx";

// Texto do servidor de um código nas tabelas. Código antigo sem servidor = o app testa os servidores da parceria por prioridade.
export const codeServerLabel = (c) => c.provider?.name || null;

function ServerSelect({ providers, value, onChange, allowNone }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {(allowNone || providers.length !== 1) && <option value="">{allowNone ? "Qualquer servidor (testa por prioridade)" : "Selecione o servidor…"}</option>}
      {providers.map((p) => <option key={p.id} value={p.id} disabled={p.status !== "active"}>{p.name} — {p.baseUrl}{p.status !== "active" ? " (desativado)" : ""}</option>)}
    </select>
  );
}

/**
 * Cria um código de parceria: escolhido (validado ao vivo e único em toda a plataforma) ou gerado.
 * Cada código aponta para UM servidor da parceria (`providers`): o cliente que usa o código é validado nesse servidor.
 */
export default function CodeModal({ checkPath, createPath, providers = [], onClose, onCreated }) {
  const run = useAction();
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [max, setMax] = useState("");
  const usable = providers.filter((p) => p.status === "active");
  const [providerId, setProviderId] = useState(usable.length === 1 ? usable[0].id : "");
  const [state, setState] = useState(null);
  const dcode = useDebounced(code.trim(), 300);

  useEffect(() => {
    if (!dcode) { setState(null); return; }
    let live = true;
    api(checkPath, { query: { code: dcode } }).then((r) => live && setState(r)).catch(() => live && setState(null));
    return () => { live = false; };
  }, [dcode, checkPath]);

  const create = async (withCode) => {
    const body = { label: label || undefined, maxActivations: max ? Number(max) : undefined, providerId, ...(withCode ? { code: code.trim() } : {}) };
    const r = await run(() => api(createPath, { method: "POST", body }), "Código criado.");
    if (r) onCreated(r.code);
  };
  // Só vale se a verificação corresponde ao texto atual (evita usar resultado de um código anterior).
  const ok = !!(state?.valid && state?.available && state.code === code.trim().toUpperCase());
  const noServer = usable.length === 0;
  const needServer = !providerId;

  return (
    <Modal title="Novo código de ativação" onClose={onClose}>
      <p className="muted">O cliente digita este código no aplicativo, junto com usuário e senha do provedor. Ele identifica a parceria e o servidor — não é um segredo.</p>
      {noServer && <p className="error">Esta parceria não tem servidor ativo. Cadastre um servidor antes de criar códigos.</p>}
      <Field label="Servidor deste código" hint="O cliente que usar este código será validado e atendido por este servidor.">
        <ServerSelect providers={providers} value={providerId} onChange={setProviderId} />
      </Field>
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
        <button className="btn" disabled={noServer || needServer} onClick={() => create(false)}>Gerar automaticamente</button>
        <button className="btn primary" disabled={noServer || needServer || !code.trim() || !ok} onClick={() => create(true)}>Usar este código</button>
      </div>
    </Modal>
  );
}

/** Edita servidor, rótulo e limite de um código existente (só afeta NOVAS ativações; quem já ativou não muda de servidor). */
export function CodeEditModal({ partnerId, code, providers = [], onClose, onSaved }) {
  const run = useAction();
  const [providerId, setProviderId] = useState(code.providerId || "");
  const [label, setLabel] = useState(code.label || "");
  const [max, setMax] = useState(code.maxActivations ?? "");
  const submit = async () => {
    const body = { providerId: providerId || null, label: label || undefined, maxActivations: max === "" ? null : Number(max) };
    if (await run(() => api(`/admin/partners/${partnerId}/codes/${code.id}`, { method: "PATCH", body }), "Código atualizado.")) onSaved();
  };
  return (
    <Modal title={`Editar código ${code.code}`} onClose={onClose}>
      <Field label="Servidor" hint="Vale para as próximas ativações. Dispositivos já ativados com este código continuam no servidor em que estão.">
        <ServerSelect providers={providers} value={providerId} onChange={setProviderId} allowNone />
      </Field>
      {!providerId && <p className="muted">Sem servidor definido, o aplicativo testa os servidores ativos da parceria na ordem de prioridade (comportamento antigo). Recomendado: escolher um servidor.</p>}
      <div className="row">
        <Field label="Rótulo"><input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
        <Field label="Máx. de ativações" hint="Vazio = sem limite"><input type="number" min="1" value={max} onChange={(e) => setMax(e.target.value)} /></Field>
      </div>
      <div className="actions"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={submit}>Salvar</button></div>
    </Modal>
  );
}
