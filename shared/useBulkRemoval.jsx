import { useEffect, useRef, useState } from "react";
import "./bulk-removal.css";

// Selection belongs to the current result page. A confirmed batch uses a fixed snapshot.
export function useBulkRemoval({ rows, scope, loading, id, label, eligible = () => true,
  description, requireReason = false, preview, remove, refresh, Modal }) {
  const [active, setActive] = useState(false);
  const [ids, setIds] = useState([]);
  const [reason, setReason] = useState("");
  const [review, setReview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [report, setReport] = useState(null);
  const lock = useRef(false);
  const alive = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  useEffect(() => { setIds([]); setActive(false); setReport(null); }, [scope]);
  const available = rows.filter(eligible);
  const selected = available.filter(row => ids.includes(id(row)));
  const all = selected.length > 0 && selected.length === available.length;

  async function openReview() {
    if (lock.current || loading || !selected.length) return;
    lock.current = true;
    setProcessing(true);
    setReport(null);
    const items = [];
    for (const row of selected) {
      if (!alive.current) return;
      try {
        items.push({ row, detail: preview ? await preview(row) : "" });
      } catch (error) {
        items.push({ row, error: error.message || "Falha ao consultar o item." });
      }
    }
    if (!alive.current) return;
    setReason("");
    setReview(items);
    setProcessing(false);
    lock.current = false;
  }

  async function execute() {
    if (lock.current || !review || (requireReason && reason.trim().length < 3)) return;
    lock.current = true;
    setProcessing(true);
    const failures = [];
    let done = 0;
    for (const item of review) {
      if (!alive.current) return;
      try {
        if (item.error) throw new Error(item.error);
        await remove(item.row, reason.trim());
        done++;
      } catch (error) {
        failures.push({ row: item.row, message: error.message || "Falha na remoção." });
      }
    }
    if (!alive.current) return;
    setReview(null);
    setReport({ done, failures });
    setIds(failures.map(f => id(f.row)));
    setActive(failures.length > 0);
    try { await refresh(); }
    finally { lock.current = false; if (alive.current) setProcessing(false); }
  }

  const checkbox = row => active && <input type="checkbox" className="bulk-pick"
    aria-label={`Selecionar ${label(row)}`} disabled={!eligible(row) || processing || loading}
    checked={eligible(row) && ids.includes(id(row))}
    onChange={e => {
      const checked = e.target.checked;
      setIds(prev => checked ? [...prev, id(row)] : prev.filter(value => value !== id(row)));
    }}/>;

  const toolbar = <>
    <div className="bulk-tools">
      <button type="button" className="btn sm" disabled={processing || (!active && !available.length)}
        onClick={() => { setIds([]); setActive(!active); setReport(null); }}>{active ? "Cancelar seleção" : "Selecionar itens"}</button>
      {active && <>
        <button type="button" className="btn sm" disabled={processing || loading || !available.length}
          onClick={() => setIds(all ? [] : available.map(id))}>{all ? "Desmarcar página" : "Selecionar página"}</button>
        <button type="button" className="btn danger sm" disabled={!selected.length || loading || processing} onClick={openReview}>
          {processing ? "Processando…" : `Remover selecionados (${selected.length})`}</button>
      </>}
    </div>
    {report && <div role="status" className="bulk-report"><strong>{report.done} remoção(ões) confirmada(s).</strong>
      {report.failures.map(f => <div key={id(f.row)}>{label(f.row)} · {f.message}</div>)}</div>}
    {review && <Modal title="Revisar remoção" onClose={() => { if (!lock.current) setReview(null); }}>
      <p>{description}</p><ul className="bulk-review">{review.map(item => <li key={id(item.row)}>
        <strong>{label(item.row)}</strong>{(item.detail || item.error) && <span>{item.error || item.detail}</span>}
      </li>)}</ul>
      {requireReason && <label>Motivo do desvínculo<input required minLength={3} maxLength={500} value={reason} disabled={processing} onChange={e => setReason(e.target.value)}/></label>}
      <div className="actions"><button type="button" className="btn" disabled={processing} onClick={() => setReview(null)}>Cancelar</button>
        <button type="button" className="btn danger" disabled={processing || (requireReason && reason.trim().length < 3) || review.every(item => item.error)} onClick={execute}>
          {processing ? "Removendo…" : `Confirmar remoção (${review.filter(item => !item.error).length})`}</button></div>
    </Modal>}
  </>;
  return { checkbox, toolbar };
}
