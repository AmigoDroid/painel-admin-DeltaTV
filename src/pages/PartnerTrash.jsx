import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Empty, Field, Modal, Pager, Table, fmtDateTime, useDebounced, useList, useUi } from "../ui.jsx";

const makeLabel = (kind) => ({ content: "Parceiro", reseller: "Revenda", both: "Parceiro e revenda" })[kind] || "Cadastro";
const normalize = (value) => String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("pt-BR");
const COUNTS = [
  ["users", "Usuários"], ["codes", "Códigos"], ["providers", "Servidores"],
  ["clients", "Clientes"], ["activations", "Ativações"], ["licenses", "Licenças"],
  ["webAccesses", "Acessos Player Web"], ["invoices", "Faturas"],
  ["payments", "Pagamentos"], ["pixCharges", "Cobranças Pix"],
  ["stockMovements", "Movimentos de estoque"], ["creditMovements", "Movimentos de crédito"],
];

function TrashAction({ item, onClose, onDone }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [action, setAction] = useState("restore");
  const [reason, setReason] = useState("");
  const [confirmSlug, setConfirmSlug] = useState("");
  const [phrase, setPhrase] = useState("");
  const [financialConsent, setFinancialConsent] = useState(false);
  const { toast } = useUi();
  useEffect(() => {
    let alive = true;
    api(`/admin/partners/trash/${item.id}/preview`)
      .then((value) => { if (alive) setPreview(value); })
      .catch((err) => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [item.id]);
  const purge = action === "purge";
  const confirmedName = [item.name, item.slug].some(x => x && normalize(x) === normalize(confirmSlug));
  const canSubmit = !saving && !!preview && (purge
    ? confirmedName && phrase === "EXCLUIR DEFINITIVAMENTE" && reason.trim().length >= 12 &&
      !(preview.blockers || []).length && (!preview.financialRecords || financialConsent)
    : reason.trim().length >= 8);
  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true); setError("");
    try {
      if (purge) {
        const outcome = await api(`/admin/partners/trash/${item.id}/permanent`, {
          method: "DELETE", body: { confirmSlug: confirmSlug.trim(), phrase, purgeFinancialHistory: financialConsent, reason: reason.trim() },
        });
        if (!outcome?.permanentlyDeleted) throw new Error("A API não confirmou a exclusão definitiva.");
        toast("Cadastro removido definitivamente. O e-mail e o identificador podem ser reutilizados.");
      } else {
        const outcome = await api(`/admin/partners/trash/${item.id}/restore`, { method: "POST", body: { reason: reason.trim() } });
        if (!outcome?.restored) throw new Error("A API não confirmou a restauração.");
        toast(outcome.needsManualReview ? "Cadastro restaurado bloqueado; revise usuários e códigos." : "Cadastro restaurado com estados anteriores.");
      }
      onDone();
    } catch (e) { setError(`${e.message}${e.code ? ` (${e.code})` : ""}`); }
    finally { setSaving(false); }
  };
  return <Modal title={`Lixeira · ${item.name}`} onClose={onClose} wide>
    <p className="muted">{makeLabel(item.kind)} · <strong>{item.slug}</strong></p>
    {!preview && !error && <p className="muted">Calculando dependências no servidor…</p>}
    {preview && <>
      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        <button className={`btn ${!purge ? "primary" : ""}`} onClick={() => { setAction("restore"); setError(""); }} disabled={saving}>Restaurar</button>
        <button className={`btn ${purge ? "danger" : ""}`} onClick={() => { setAction("purge"); setError(""); }} disabled={saving}>Excluir permanentemente</button>
      </div>
      {!purge ? <>
        <p>Restaurar traz o cadastro de volta às listas. Usuários e códigos são recuperados com o status anterior quando existe uma fotografia do arquivamento. Sessões antigas continuam encerradas.</p>
        {!preview.hasRestoreSnapshot && <p role="alert" className="error">Cadastro arquivado antes desta atualização: será restaurado <strong>BLOQUEADO</strong>, com acessos desativados. Revise as contas manualmente.</p>}
      </> : <>
        <p role="alert" className="error"><strong>Atenção: operação irreversível.</strong> Serão apagados usuários, fotos, senhas, códigos, dados exclusivos, licenças da revenda, histórico de cobranças e movimentações associadas. Não existe botão para desfazer.</p>
        <div className="mini-stats" style={{ marginBottom: 12 }}>
          {COUNTS.map(([key, label]) => <div key={key}><strong>{preview[key] || 0}</strong><span>{label}</span></div>)}
        </div>
        <p className="muted">{preview.sharedRecordsPreserved} {preview.retainedOutsideDatabase} Uma confirmação ou reembolso no banco não cancela automaticamente uma cobrança no provedor externo.</p>
        {preview.sharedStockReferences > 0 && <p className="muted">{preview.sharedStockReferences} movimentação(ões) de outras revendas serão preservadas com a contraparte desvinculada.</p>}
        {(preview.blockers || []).length > 0 && <div role="alert" className="error"><strong>Exclusão bloqueada:</strong><ul>{preview.blockers.map((text, i) => <li key={i}>{text}</li>)}</ul></div>}
        {preview.financialRecords > 0 && <label style={{ display: "flex", gap: 10, alignItems: "start", marginBottom: 16 }}>
          <input type="checkbox" checked={financialConsent} onChange={e => setFinancialConsent(e.target.checked)} />
          <span>Confirmo que fiz backup e estou autorizado a remover <strong>{preview.financialRecords} registros financeiros</strong>, inclusive os já pagos, após avaliar as obrigações de conservação fiscal e contábil.</span>
        </label>}
        <Field label="Digite o nome ou identificador exato para confirmar"><input autoComplete="off" value={confirmSlug} onChange={e => setConfirmSlug(e.target.value)} placeholder={item.slug} /></Field>
        <Field label="Digite EXCLUIR DEFINITIVAMENTE"><input autoComplete="off" value={phrase} onChange={e => setPhrase(e.target.value)} placeholder="EXCLUIR DEFINITIVAMENTE" /></Field>
      </>}
      <Field label={`Motivo obrigatório (mínimo de ${purge ? 12 : 8} caracteres)`}><textarea rows={2} maxLength={400} value={reason} onChange={e => setReason(e.target.value)} /></Field>
      <div className="actions"><button type="button" className="btn" onClick={onClose} disabled={saving}>Cancelar</button><button type="button" className={`btn ${purge ? "danger" : "primary"}`} onClick={submit} disabled={!canSubmit}>{saving ? "Processando…" : purge ? "Excluir definitivamente" : "Restaurar cadastro"}</button></div>
    </>}
    {error && <p className="error" role="alert">{error}</p>}
  </Modal>;
}

export default function PartnerTrash() {
  const list = useList("/admin/partners/trash", { q: "", pageSize: 20, kind: "" });
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const [selected, setSelected] = useState(null);
  useEffect(() => { list.filter({ q: dq }); /* eslint-disable-next-line */ }, [dq]);
  return <>
    <div className="page-head"><div><h2>Lixeira de parceiros e revendas</h2><p className="muted page-sub">Cadastros arquivados; restaure ou exclua definitivamente com confirmação e auditoria.</p></div></div>
    <div className="toolbar">
      <button className="btn" onClick={list.reload} disabled={list.loading}>Atualizar</button>
      <input value={q} placeholder="Buscar pelo nome, e-mail ou identificador" onChange={e => setQ(e.target.value)} />
      <select value={list.params.kind} onChange={e => list.filter({ kind: e.target.value })}>
        <option value="">Todos os tipos</option><option value="content">Parceiros</option><option value="reseller">Revendas</option>
      </select>
    </div>
    <Table><thead><tr><th>Cadastro</th><th>Tipo</th><th>Contato</th><th>Arquivado em</th><th>Restauração</th><th>Ação</th></tr></thead>
      <tbody>{list.data.map(item => <tr key={item.id}>
        <td><strong>{item.name}</strong><div className="muted">{item.slug}</div></td>
        <td>{makeLabel(item.kind)}</td><td>{item.contactEmail || "—"}</td>
        <td>{fmtDateTime(item.updatedAt)}</td>
        <td>{item.hasRestoreSnapshot ? "Estados preservados" : "Revisão manual"}</td>
        <td><button className="btn sm" onClick={() => setSelected(item)}>Gerenciar</button></td>
      </tr>)}</tbody></Table>
    <Empty loading={list.loading} error={list.error} count={list.data.length}/>
    <Pager meta={list.meta} onPage={list.setPage}/>
    {selected && <TrashAction item={selected} onClose={() => setSelected(null)} onDone={() => { setSelected(null); list.reload(); }} />}
  </>;
}
