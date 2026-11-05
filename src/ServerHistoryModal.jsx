import { useEffect, useState } from "react";
import { api } from "./api.js";
import { Modal, Pager, Table, fmtDateTime, useLoad } from "./ui.jsx";
const STATES = { healthy: "Saudável", slow: "Lento", suspect: "Instável", down: "Indisponível", unknown: "Sem medição", disabled: "Desativado" };
const host = value => { try { return new URL(value).host; } catch { return value || "—"; } };
export default function ServerHistoryModal({ server, onClose }) {
  const [page, setPage] = useState(1), [status, setStatus] = useState("");
  const { data, error, reload } = useLoad(() => api(`/admin/server-monitor/${server.id}/history`, { query: { page, pageSize: 20, status } }), [server.id, page, status]);
  useEffect(() => { if (data?.meta && page > data.meta.totalPages) setPage(data.meta.totalPages); }, [data, page]);
  return <Modal title={`Histórico detalhado · ${server.name}`} onClose={onClose} wide>
    <p><strong>{data?.provider.partnerName || server.partnerName || "Parceria"}</strong> · {host(data?.provider.baseUrl || server.baseUrl)}</p>
    <p className="muted">Mudanças de estado registradas pelo monitor, com data, latência e motivo. O histórico segue a retenção atual de 30 dias; cada verificação individual não gera uma linha.</p>
    <div className="toolbar">
      <select aria-label="Filtrar histórico por estado" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
        <option value="">Todos os estados</option>{Object.entries(STATES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <button type="button" className="btn" onClick={reload}>Atualizar histórico</button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {!data ? !error && <p className="muted">Carregando histórico…</p> : <>
      <Table><thead><tr><th>Data e hora</th><th>Estado</th><th>Latência</th><th>Detalhes</th></tr></thead><tbody>
        {data.data.map(event => <tr key={event.id}><td>{fmtDateTime(event.occurredAt)}</td><td><span className={`srv-state srv-state-${event.state}`}>{STATES[event.state] || event.state}</span></td><td>{event.latencyMs == null ? "—" : `${event.latencyMs} ms`}</td><td>{event.note || "—"}</td></tr>)}
      </tbody></Table>
      {!data.data.length && <p className="muted">Nenhuma mudança de estado registrada para este servidor neste filtro.</p>}
      {data.meta.totalPages > 1 && <Pager meta={data.meta} onPage={setPage} />}
    </>}
  </Modal>;
}
