import { useEffect, useState } from "react";

/** Select activation IDs, not device IDs: never delete another owner's MAC. */
export function useDeviceBulkActions({ rows, scope, loading, Modal, request, refresh, onOptimistic = () => {} }) {
  const [selected, setSelected] = useState([]);
  const [mode, setMode] = useState(null);
  const [reason, setReason] = useState("");
  const [word, setWord] = useState("");
  const [processing, setProcessing] = useState(false);
  const [report, setReport] = useState(null);
  useEffect(() => { setSelected([]); setMode(null); setReport(null); }, [scope]);
  const visible = rows.filter(r => r.status !== "revoked");
  const selectedRows = visible.filter(r => selected.includes(r.id));
  const pick = row => <input type="checkbox" aria-label={`Selecionar ${row.mac}`} disabled={processing || row.status === "revoked"}
    checked={selected.includes(row.id)} onChange={e => setSelected(old => e.target.checked ? [...old, row.id] : old.filter(id => id !== row.id))}/>;
  const run = async () => {
    if (processing || reason.trim().length < 3 || (mode === "delete" && word !== "EXCLUIR")) return;
    setProcessing(true);
    try {
      const result = await request(mode, { ids: selectedRows.map(r => r.id), reason: reason.trim(), ...(mode === "delete" ? { confirmation: "EXCLUIR" } : {}) });
      const successes = (result.results || []).filter(r => r.ok);
      onOptimistic(successes.map(r => r.id));
      setSelected((result.results || []).filter(r => !r.ok).map(r => r.id));
      setReport(result);
      setMode(null);
      await refresh();
    } catch (error) {
      setReport({ succeeded: 0, failed: selectedRows.length, results: selectedRows.map(r => ({ id: r.id, ok: false, message: error.message || "Falha no lote." })) });
      setMode(null);
    } finally { setProcessing(false); }
  };
  const toolbar = <>
    <div className="bulk-tools">
      <button type="button" className="btn sm" disabled={loading || processing} onClick={() => setSelected(selectedRows.length === visible.length ? [] : visible.map(r => r.id))}>{selectedRows.length === visible.length && visible.length ? "Desmarcar todos" : "Selecionar página"}</button>
      <button type="button" className="btn sm" disabled={!selectedRows.length || processing} onClick={() => { setMode("revoke"); setReason(""); }}>Desvincular selecionados ({selectedRows.length})</button>
      <button type="button" className="btn danger sm" disabled={!selectedRows.length || processing} onClick={() => { setMode("delete"); setReason(""); setWord(""); }}>Excluir selecionados ({selectedRows.length})</button>
    </div>
    {report && <div role="status" className="bulk-report">{report.succeeded} concluído(s), {report.failed} falha(s).
      {(report.results || []).filter(x => !x.ok).map(x => <div key={x.id}>{x.id}: {x.message}</div>)}
    </div>}
    {mode && <Modal title={mode === "delete" ? "Confirmar exclusão de vínculos" : "Confirmar desvinculação"} onClose={() => !processing && setMode(null)}>
      <p>{mode === "delete" ? "A exclusão é definitiva e remove o vínculo selecionado, sem apagar vínculos de outros donos. Licenças vigentes não podem ser excluídas." : "O dispositivo continuará cadastrado e poderá receber uma nova ativação."}</p>
      <p><strong>{selectedRows.length} ativação(ões) selecionada(s).</strong></p>
      <ul>{selectedRows.map(r => <li key={r.id}>{r.mac} · {r.status} · {r.grantedLicense?.remainingDays > 0 ? "Licença com prazo restante" : "Verificar licenças no servidor"}</li>)}</ul>
      <label>Motivo da operação (mínimo 3 caracteres)<input value={reason} minLength={3} maxLength={500} onChange={e => setReason(e.target.value)}/></label>
      {mode === "delete" && <label>Digite EXCLUIR para confirmar<input value={word} onChange={e => setWord(e.target.value)}/></label>}
      <div className="actions"><button type="button" disabled={processing} onClick={() => setMode(null)}>Cancelar</button>
        <button type="button" className="btn danger" disabled={processing || reason.trim().length < 3 || (mode === "delete" && word !== "EXCLUIR")} onClick={run}>{processing ? "Processando…" : `Confirmar ${selectedRows.length} ativação(ões)`}</button></div>
    </Modal>}
  </>;
  return { pick, toolbar };
}
