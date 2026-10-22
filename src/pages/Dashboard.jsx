import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Badge, Table, fmtDate, fmtDateTime, fmtMoney } from "../ui.jsx";

const Stat = ({ label, value, hint, href, attention }) => {
  const body = <><small>{label}</small><strong>{value}</strong>{hint && <span>{hint}</span>}</>;
  return href ? <a className={`card stat link ${attention ? "attention" : ""}`} href={href}>{body}</a> : <div className="card stat">{body}</div>;
};

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/admin/dashboard").then(setD).catch((e) => setError(e.message)); }, []);
  if (error) return <p className="error">{error}</p>;
  if (!d) return <p className="muted">Carregando…</p>;
  return (
    <>
      <div className="page-head"><h2>Visão geral</h2></div>
      <div className="grid cards">
        <Stat label="Licenças ativas" value={d.licenses.active} hint={`${d.licenses.expired} expiradas · ${d.licenses.suspended} suspensas · ${d.licenses.blocked} bloqueadas`} />
        <Stat label="Dispositivos ativados" value={d.devices.active} hint={`${d.devices.blocked} bloqueados`} />
        <Stat label="Sem vínculo" value={d.devices.unlinked ?? 0} hint={d.devices.unlinked ? "Aguardando configuração →" : "Nenhum aguardando"} href="#unlinked" attention={d.devices.unlinked > 0} />
        <Stat label="Parceiros ativos" value={d.partners.active} hint={`${d.partners.suspended} suspensos/bloqueados`} />
        <Stat label="Receita recorrente prevista" value={fmtMoney(d.billing.mrrCents)} hint={`Recebido no mês: ${fmtMoney(d.billing.receivedThisMonthCents)}`} />
        <Stat label="Cobranças pendentes" value={d.billing.pending.count} hint={`${fmtMoney(d.billing.pending.amountCents)} · ${d.billing.pending.overdueCount} vencida(s)`} />
      </div>
      <div className="grid two">
        <div className="card"><h3>Alertas de vencimento</h3>
          <h4 className="muted">Licenças que vencem em 7 dias</h4>
          <ul className="plain">{d.alerts.expiringLicenses.map((l) => <li key={l.id}><span>••••{l.codeLast4}</span><span>{fmtDate(l.expiresAt)}</span></li>)}{!d.alerts.expiringLicenses.length && <li className="muted">Nenhuma</li>}</ul>
          <h4 className="muted">Parcerias que terminam em 15 dias</h4>
          <ul className="plain">{d.alerts.endingPartners.map((p) => <li key={p.id}><span>{p.name}</span><span>{fmtDate(p.endsAt)}</span></li>)}{!d.alerts.endingPartners.length && <li className="muted">Nenhuma</li>}</ul>
          <h4 className="muted">Cobranças vencidas</h4>
          <ul className="plain">{d.alerts.overdueInvoices.map((i) => <li key={i.id}><span>{i.Partner?.name} · {i.competence}</span><span>{fmtMoney(i.amountCents - i.paidCents)} · {fmtDate(i.dueDate)}</span></li>)}{!d.alerts.overdueInvoices.length && <li className="muted">Nenhuma</li>}</ul>
        </div>
        <div className="card"><h3>Eventos de bloqueio e reativação</h3>
          <ul className="plain">{d.events.map((e) => <li key={e.id}><span>{e.action}</span><span className="muted">{fmtDateTime(e.createdAt)}</span></li>)}{!d.events.length && <li className="muted">Nenhum evento</li>}</ul>
        </div>
      </div>
      <h3 style={{ margin: "18px 0 10px" }}>Ativações recentes</h3>
      <Table><thead><tr><th>MAC</th><th>Origem</th><th>Status</th><th>Quando</th></tr></thead>
        <tbody>{d.recentActivations.map((a) => <tr key={a.id}><td className="mono">{a.mac || "—"}</td><td>{a.licenseId ? "Licença individual" : "Parceria"}</td><td><Badge status={a.status} /></td><td>{fmtDateTime(a.activatedAt)}</td></tr>)}</tbody></Table>
    </>
  );
}
