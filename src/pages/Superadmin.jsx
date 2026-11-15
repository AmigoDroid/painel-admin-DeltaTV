import { useEffect, useRef, useState } from "react";
import { api, getAuth, logout } from "../api.js";
import {
  Badge,
  Field,
  Modal,
  Pager,
  Empty,
  useAction,
  useDebounced,
  useList,
  useLoad,
  useUi,
  fmtMoney,
  fmtDateTime,
  dateInput,
  spDateToIso,
} from "../ui.jsx";
import PartnerPicker from "../PartnerPicker.jsx";
import DataTable from "../../shared/DataTable.jsx";
import TvMessages from "../TvMessages.jsx";
import "./superadmin.css";
const BASE = "/admin/control";
const permissionLabel = (value) => {
  const area = {
    partner: "Portal",
    dashboard: "Visão geral",
    clients: "Clientes",
    licenses: "Licenças",
    devices: "Dispositivos",
    codes: "Códigos",
    providers: "Provedores",
    commerce: "Comércio",
    network: "Rede",
    billing: "Financeiro",
    pix: "Pix",
    credits: "Créditos",
    "web-access": "Player Web",
    web: "Player Web",
    help: "Ajuda",
    notifications: "Notificações",
    downloads: "Downloads",
    "white-label": "Aplicativos",
    support: "Atendimento",
    monitor: "Monitoramento",
    account: "Conta",
    stock: "Estoque",
    sources: "Fontes",
    users: "Usuários",
    "partner-users": "Usuários do portal",
    audit: "Auditoria",
    messages: "Mensagens",
  };
  const parts = value.split(":");
  return parts
    .map(
      (x) =>
        area[x] ||
        { read: "Consultar", write: "Alterar", manage: "Gerenciar" }[x] ||
        x,
    )
    .join(" · ");
};

const TABS = [
  ["overview", "Visão global"],
  ["licenses", "Licenças e testes"],
  ["sessions", "Sessões"],
  ["roles", "Papéis e permissões"],
  ["messages", "Avisos para TVs"],
  ["settings", "Configurações"],
  ["backup", "Backup e importação"],
];
const saveFile = (name, content, type = "application/json") => {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const csv = (rows) =>
  "\uFEFF" +
  rows
    .map((row) =>
      row
        .map(
          (x) =>
            '"' +
            String(x ?? "")
              .replace(/^[\t\r\n]|^\s*[=+\-@]/, "'$&")
              .replaceAll('"', '""') +
            '"',
        )
        .join(";"),
    )
    .join("\r\n");
export function ImpersonateDialog({ user, onClose }) {
  const [portal, setPortal] = useState("partner"),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const open = async (e) => {
    e.preventDefault();
    const configured =
      portal === "partner"
        ? import.meta.env.VITE_RESELLER_URL
        : import.meta.env.VITE_PARTNER_URL;
    const url =
      configured ||
      (import.meta.env.DEV
        ? `http://localhost:${portal === "partner" ? 5175 : 5176}`
        : "");
    let origin;
    try {
      const u = new URL(url);
      if (
        !["http:", "https:"].includes(u.protocol) ||
        (import.meta.env.PROD && u.protocol !== "https:")
      )
        throw Error();
      origin = u.origin;
    } catch {
      setError(
        "Configure VITE_RESELLER_URL e VITE_PARTNER_URL com as origens dos portais.",
      );
      return;
    }
    const target = window.open("about:blank", "_blank");
    if (!target) {
      setError("Permita abrir uma nova aba para iniciar a impersonação.");
      return;
    }
    setBusy(true);
    setError("");
    let grant;
    try {
      grant = await api(BASE + "/impersonations", {
        method: "POST",
        body: { targetUserId: user.id, portal, reason },
      });
      const timer = setTimeout(() => {
        window.removeEventListener("message", ready);
        setBusy(false);
        setError(
          "O portal não respondeu. Encerre a impersonação na lista de sessões ou tente novamente.",
        );
        api(BASE + `/impersonations/${grant.impersonation.id}`, {
          method: "DELETE",
          body: { reason: "Falha no recebimento pelo portal" },
        }).catch(() => {});
        target.close();
      }, 15000);
      function ready(event) {
        if (event.source !== target || event.origin !== origin) return;
        if (event.data?.type === "deltatv-impersonation-ready")
          target.postMessage(
            { type: "deltatv-impersonation-session", session: grant },
            origin,
          );
        if (event.data?.type === "deltatv-impersonation-accepted") {
          clearTimeout(timer);
          window.removeEventListener("message", ready);
          onClose();
        }
      }
      window.addEventListener("message", ready);
      target.location.href = url;
    } catch (e) {
      target.close();
      setError(e.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Entrar como ${user.name}`}
      onClose={busy ? () => {} : onClose}
    >
      <form onSubmit={open}>
        <p>
          A nova aba terá as permissões desta conta por até 15 minutos. As ações
          identificarão você na auditoria.
        </p>
        <Field label="Portal">
          <select value={portal} onChange={(e) => setPortal(e.target.value)}>
            <option value="partner">Revenda</option>
            <option value="content_partner">Parceiro de conteúdo</option>
          </select>
        </Field>
        <Field label="Motivo do acesso">
          <textarea
            required
            minLength={5}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? "Abrindo portal…" : "Entrar como esta conta"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function UserRoleDialog({ user, onClose, onSaved }) {
  const { data, error } = useLoad(() => api(BASE + "/roles"), []),
    [roleId, setRoleId] = useState(user.permissionRoleId || ""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false);
  const run = useAction();
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await run(
      () =>
        api(BASE + `/users/${user.id}/role`, {
          method: "PUT",
          body: { roleId: roleId || null, reason },
        }),
      "Permissões atualizadas. Sessões encerradas.",
    );
    setBusy(false);
    if (ok) onSaved();
  };
  return (
    <Modal title={`Permissões de ${user.name}`} onClose={onClose}>
      <form onSubmit={save}>
        {error && <p className="error">{error}</p>}
        <Field label="Papel personalizado">
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">Permissões padrão da função</option>
            {data?.data
              ?.filter((r) => r.baseRole === user.role)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Motivo">
          <textarea
            required
            minLength={5}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <button className="btn primary" disabled={!data || busy}>
          Salvar e encerrar sessões
        </button>
      </form>
    </Modal>
  );
}
export function DeleteUserDialog({ user, onClose, onSaved }) {
  const [text, setText] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false);
  const run = useAction();
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ok = await run(
      () =>
        api(BASE + `/users/${user.id}`, {
          method: "DELETE",
          body: { reason, confirmation: text },
        }),
      "Conta excluída e sessões encerradas.",
    );
    setBusy(false);
    if (ok) onSaved();
  };
  return (
    <Modal title={`Excluir usuário ${user.name}`} onClose={onClose}>
      <form onSubmit={save}>
        <p>
          A conta perde acesso. Seu identificador e histórico permanecem na
          auditoria.
        </p>
        <Field label="Motivo">
          <textarea
            required
            minLength={5}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <Field label="Digite EXCLUIR USUÁRIO">
          <input
            required
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        <button
          className="btn danger"
          disabled={busy || text !== "EXCLUIR USUÁRIO"}
        >
          Excluir usuário
        </button>
      </form>
    </Modal>
  );
}
function Overview() {
  const [from, setFrom] = useState(() =>
      dateInput(new Date(Date.now() - 30 * 86400000)),
    ),
    [to, setTo] = useState(() => dateInput(new Date())),
    [partnerId, setPartnerId] = useState(""),
    [filters, setFilters] = useState(null);
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const load = async (query) => {
    setLoading(true);
    setError("");
    try {
      setData(await api(BASE + "/reports", { query }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const query = {
      from: spDateToIso(from),
      to: new Date(
        new Date(spDateToIso(to)).getTime() + 86400000,
      ).toISOString(),
      partnerId,
    };
    setFilters(query);
    load(query);
  }, []);
  const apply = (e) => {
    e.preventDefault();
    const query = {
      from: spDateToIso(from),
      to: new Date(
        new Date(spDateToIso(to)).getTime() + 86400000,
      ).toISOString(),
      partnerId,
    };
    setFilters(query);
    load(query);
  };
  const exportCsv = () =>
    saveFile(
      "relatorio-financeiro.csv",
      csv([
        ["Início", data.period.from],
        ["Fim exclusivo", data.period.to],
        ["Receita confirmada (centavos)", data.finance.revenueCents],
        ["Clientes", data.clients.total],
        ["Clientes em atraso", data.clients.overdue],
        [],
        ["Dia", "Receita em centavos", "Pagamentos"],
        ...data.daily.map((d) => [d.day, d.revenueCents, d.payments]),
        [],
        ["Revenda/parceiro", "Receita em centavos"],
        ...data.top.map((x) => [x.name || "Plataforma", x.revenueCents]),
      ]),
      "text/csv;charset=utf-8",
    );
  return (
    <section className="control-report">
      <form className="control-filters" onSubmit={apply}>
        <Field label="De">
          <input
            type="date"
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="Até">
          <input
            type="date"
            required
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <Field label="Revenda/parceiro e descendentes">
          <PartnerPicker value={partnerId} onChange={setPartnerId} />
        </Field>
        <button className="btn primary" disabled={loading}>
          Aplicar período
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
          <button className="btn" onClick={() => load(filters)}>
            Tentar novamente
          </button>
        </p>
      )}
      {loading && <p role="status">Atualizando indicadores…</p>}
      {data && (
        <>
          <div className="control-kpis">
            {[
              [
                "Recebimentos da plataforma",
                fmtMoney(data.finance.revenueCents),
              ],
              [
                "Recebimentos da rede",
                fmtMoney(data.finance.networkRevenueCents),
              ],
              ["Clientes ativos (TVs)", data.clients.active],
              ["Clientes cadastrados", data.clients.total],
              ["Licenças ativas", data.licenses.active],
              ["Vencem em 7 dias", data.licenses.expiring],
              ["Clientes em atraso", data.clients.overdue],
              ["Testes ativos", data.licenses.trials],
            ].map(([label, value]) => (
              <article key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <div className="control-chart-grid">
            <Chart
              title="Receita por dia"
              rows={data.daily}
              value="revenueCents"
              money
            />
            <Chart
              title="Novos clientes por dia"
              rows={data.growth}
              value="created"
            />
          </div>
          <p className="muted">{data.notes}</p>
          <div className="toolbar">
            <button className="btn" onClick={exportCsv}>
              Exportar relatório CSV
            </button>
            <button className="btn" onClick={() => window.print()}>
              Imprimir / salvar PDF
            </button>
          </div>
          <h3>Top revendas e parceiros no período</h3>
          <DataTable
            rows={data.top}
            columns={[
              {
                key: "name",
                label: "Conta",
                value: (x) => x.name || "Plataforma",
              },
              {
                key: "revenueCents",
                label: "Receita",
                value: (x) => Number(x.revenueCents),
                render: (x) => fmtMoney(x.revenueCents),
              },
            ]}
          />
        </>
      )}
    </section>
  );
}
function Chart({ title, rows, value, money = false }) {
  const max = Math.max(1, ...rows.map((x) => Number(x[value])));
  return (
    <article className="control-chart">
      <h3>{title}</h3>
      {!rows.length ? (
        <p className="muted">Nenhum movimento no período.</p>
      ) : (
        <div className="control-bars" role="img" aria-label={title}>
          {rows.map((x) => (
            <div
              className="control-bar"
              key={x.day}
              title={`${x.day}: ${money ? fmtMoney(x[value]) : x[value]}`}
            >
              <span>{money ? fmtMoney(x[value]) : x[value]}</span>
              <i
                style={{
                  height: `${Math.max(2, (Number(x[value]) / max) * 130)}px`,
                }}
              />
              <small>{x.day.slice(5).split("-").reverse().join("/")}</small>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}
function Licenses() {
  const [q, setQ] = useState(""),
    dq = useDebounced(q),
    list = useList("/admin/licenses", {
      q: "",
      status: "",
      isTrial: "",
      expiringInDays: "",
      sortBy: "createdAt",
      sortDir: "DESC",
    }),
    [batch, setBatch] = useState(false),
    [editing, setEditing] = useState(null),
    [exportStatus, setExportStatus] = useState("all");
  const run = useAction(),
    { confirm } = useUi();
  useEffect(() => list.filter({ q: dq }), [dq]);
  const change = async (row, action) => {
    const c = await confirm({
      title: {
        suspend: "Suspender licença",
        reactivate: "Reativar licença",
        cancel: "Cancelar licença",
        renew: "Renovar licença",
      }[action],
      message: `Licença …${row.codeLast4}. Os dispositivos vinculados serão afetados.`,
      danger: action === "cancel",
      reason: "required",
    });
    if (
      c &&
      (await run(
        () =>
          api(`/admin/licenses/${row.id}/${action}`, {
            method: "POST",
            body: { reason: c.reason },
          }),
        "Licença atualizada.",
      ))
    )
      list.reload();
  };
  const exportAll = async () => {
    const result = await run(() =>
      api(BASE + "/licenses/export", { query: { status: exportStatus } }),
    );
    if (result)
      saveFile(result.filename, result.content, "text/csv;charset=utf-8");
  };
  return (
    <section>
      <div className="toolbar">
        <input
          type="search"
          aria-label="Buscar licença"
          placeholder="Cliente, e-mail ou final do código"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Estado da licença"
          value={list.params.status}
          onChange={(e) => list.filter({ status: e.target.value })}
        >
          <option value="">Todos os estados</option>
          {[
            ["active", "Ativas"],
            ["expired", "Vencidas"],
            ["suspended", "Suspensas"],
            ["blocked", "Bloqueadas"],
            ["cancelled", "Canceladas"],
            ["pending", "Aguardando ativação"],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={list.params.isTrial === "true"}
            onChange={(e) =>
              list.filter({ isTrial: e.target.checked ? "true" : "" })
            }
          />{" "}
          Somente testes
        </label>
        <label>
          <input
            type="checkbox"
            checked={!!list.params.expiringInDays}
            onChange={(e) =>
              list.filter({ expiringInDays: e.target.checked ? 7 : "" })
            }
          />{" "}
          A vencer em 7 dias
        </label>
        <button className="btn primary" onClick={() => setBatch(true)}>
          Gerar lote / teste
        </button>
      </div>
      <DataTable
        server
        rows={list.data}
        loading={list.loading}
        error={list.error}
        onRetry={list.reload}
        onSort={({ key, dir }) =>
          list.filter({ sortBy: key, sortDir: dir.toUpperCase() })
        }
        columns={[
          {
            key: "codeLast4",
            label: "Licença",
            render: (l) => (
              <code>
                …{l.codeLast4}
                {l.isTrial ? " · Teste" : ""}
              </code>
            ),
          },
          {
            key: "customer",
            label: "Cliente",
            sortable: false,
            value: (l) => l.Customer?.name || "Sem cliente",
          },
          {
            key: "status",
            label: "Status",
            render: (l) => <Badge status={l.effectiveStatus || l.status} />,
          },
          {
            key: "expiresAt",
            label: "Vencimento",
            render: (l) => fmtDateTime(l.expiresAt),
          },
          {
            key: "actions",
            label: "Ações",
            sortable: false,
            render: (l) => (
              <div className="control-row-actions">
                <button className="btn sm" onClick={() => setEditing(l)}>
                  Ajustar / transferir
                </button>
                <button className="btn sm" onClick={() => change(l, "renew")}>
                  Renovar
                </button>
                {l.status === "active" && (
                  <button
                    className="btn sm"
                    onClick={() => change(l, "suspend")}
                  >
                    Suspender
                  </button>
                )}
                {["suspended", "blocked", "cancelled"].includes(l.status) && (
                  <button
                    className="btn sm"
                    onClick={() => change(l, "reactivate")}
                  >
                    Reativar
                  </button>
                )}
                {l.status !== "cancelled" && (
                  <button
                    className="btn sm danger"
                    onClick={() => change(l, "cancel")}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />
      <Pager meta={list.meta} onPage={list.setPage} />
      <div className="toolbar">
        <select
          aria-label="Filtro da exportação"
          value={exportStatus}
          onChange={(e) => setExportStatus(e.target.value)}
        >
          {[
            ["all", "Todas"],
            ["active", "Ativas"],
            ["expired", "Vencidas"],
            ["expiring", "A vencer"],
            ["suspended", "Suspensas"],
            ["trial", "Testes"],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button className="btn" onClick={exportAll}>
          Exportar todas deste filtro (CSV)
        </button>
      </div>
      {batch && (
        <Batch onClose={() => setBatch(false)} onSaved={() => list.reload()} />
      )}{" "}
      {editing && (
        <AdjustLicense
          license={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      )}
    </section>
  );
}
function AdjustLicense({ license, onClose, onSaved }) {
  const [mode, setMode] = useState("date"),
    [date, setDate] = useState(dateInput(license.expiresAt)),
    [delta, setDelta] = useState(1),
    [owner, setOwner] = useState(license.ownerPartnerId || ""),
    [max, setMax] = useState(license.maxDevices),
    [sessions, setSessions] = useState(license.maxSessionsPerActivation ?? ""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false);
  const run = useAction(),
    { confirm } = useUi();
  const submit = async (e) => {
    e.preventDefault();
    const changes = {
      reason,
      maxDevices: Number(max),
      maxSessionsPerActivation: sessions === "" ? null : Number(sessions),
      ...(owner !== (license.ownerPartnerId || "")
        ? { ownerPartnerId: owner || null }
        : {}),
    };
    if (mode === "date" && date !== dateInput(license.expiresAt))
      changes.expiresAt = spDateToIso(date, true);
    if (mode === "days") changes.deltaDays = Number(delta);
    const c = await confirm({
      title: "Confirmar ajuste da licença",
      message:
        "A validade, o limite e o titular escolhidos serão aplicados aos vínculos elegíveis desta licença.",
      danger: Number(delta) < 0 || owner !== (license.ownerPartnerId || ""),
    });
    if (!c) return;
    setBusy(true);
    const ok = await run(
      () =>
        api(BASE + `/licenses/${license.id}`, {
          method: "PATCH",
          body: changes,
        }),
      "Ajuste registrado.",
    );
    setBusy(false);
    if (ok) onSaved();
  };
  return (
    <Modal title={`Ajustar licença …${license.codeLast4}`} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Como alterar a validade">
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="date">Definir vencimento</option>
            <option value="days">Somar / retirar dias</option>
          </select>
        </Field>
        {mode === "date" ? (
          <Field label="Válida até, no horário de Brasília">
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        ) : (
          <Field label="Dias (negativo reduz)">
            <input
              required
              type="number"
              min={-3650}
              max={3650}
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
            />
          </Field>
        )}
        <Field label="Titular da licença (vazio: plataforma)">
          <PartnerPicker value={owner} onChange={setOwner} />
        </Field>
        <Field label="Limite de dispositivos">
          <input
            required
            type="number"
            min={1}
            max={50}
            value={max}
            onChange={(e) => setMax(e.target.value)}
          />
        </Field>
        <Field label="Sessões autenticadas por dispositivo (vazio: padrão global)">
          <input
            type="number"
            min={1}
            max={20}
            value={sessions}
            onChange={(e) => setSessions(e.target.value)}
          />
        </Field>
        <Field label="Motivo">
          <textarea
            required
            minLength={5}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <p className="muted">
          Licenças ligadas a códigos de conteúdo exigem transferência de
          ativação com reconfiguração do provedor.
        </p>
        <button className="btn primary" disabled={busy}>
          Salvar ajuste
        </button>
      </form>
    </Modal>
  );
}
function Batch({ onClose, onSaved }) {
  const { data, error } = useLoad(() => api("/admin/licenses/plans"), []),
    [planId, setPlanId] = useState(""),
    [count, setCount] = useState(1),
    [trial, setTrial] = useState(false),
    [hours, setHours] = useState(24),
    [owner, setOwner] = useState(""),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState(null);
  const run = useAction(),
    key = useRef(crypto.randomUUID());
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const result = await run(
      () =>
        api(BASE + "/licenses/batch", {
          method: "POST",
          body: {
            planId,
            count: Number(count),
            ownerPartnerId: owner || null,
            ...(trial ? { trialHours: Number(hours) } : {}),
            idempotencyKey: key.current,
            reason,
          },
        }),
      "Lote criado.",
    );
    setBusy(false);
    if (result) {
      setResult(result.data);
      onSaved();
    }
  };
  return (
    <Modal title="Gerar licenças em lote" onClose={onClose}>
      {result ? (
        <>
          <p>
            Guarde os códigos agora. A mesma solicitação pode ser recuperada com
            sua chave de operação.
          </p>
          <pre className="secret">{result.map((x) => x.code).join("\n")}</pre>
          <button
            className="btn primary"
            onClick={() =>
              saveFile(
                "licencas-geradas.csv",
                csv([
                  ["Licença", "Código", "Vencimento", "Teste"],
                  ...result.map((x) => [x.id, x.code, x.expiresAt, x.isTrial]),
                ]),
                "text/csv;charset=utf-8",
              )
            }
          >
            Baixar códigos CSV
          </button>
        </>
      ) : (
        <form onSubmit={submit}>
          {error && <p className="error">{error}</p>}
          <Field label="Plano">
            <select
              required
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
            >
              <option value="">Selecione</option>
              {data?.data
                ?.filter((x) => x.active)
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Quantidade">
            <input
              required
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </Field>
          <Field label="Revenda/parceiro titular">
            <PartnerPicker value={owner} onChange={setOwner} />
          </Field>
          <label>
            <input
              type="checkbox"
              checked={trial}
              onChange={(e) => setTrial(e.target.checked)}
            />{" "}
            Gerar testes com duração em horas
          </label>
          {trial && (
            <Field label="Duração do teste (horas)">
              <input
                required
                type="number"
                min={1}
                max={8760}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </Field>
          )}
          <Field label="Motivo">
            <textarea
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <button className="btn primary" disabled={busy || !data}>
            {busy ? "Gerando…" : "Gerar licenças"}
          </button>
        </form>
      )}
    </Modal>
  );
}
function Sessions() {
  const [q, setQ] = useState(""),
    dq = useDebounced(q),
    list = useList(BASE + "/sessions", { q: "" }),
    grants = useLoad(() => api(BASE + "/impersonations"), []);
  const run = useAction(),
    { confirm } = useUi();
  useEffect(() => list.filter({ q: dq }), [dq]);
  const revoke = async (s) => {
    const c = await confirm({
      title: s.current ? "Encerrar sua sessão atual?" : "Encerrar sessão",
      message: `Conta: ${s.name}. O acesso deste navegador será invalidado.`,
      danger: true,
      reason: "required",
    });
    if (
      c &&
      (await run(
        () =>
          api(BASE + `/sessions/${s.id}/revoke`, {
            method: "POST",
            body: { reason: c.reason },
          }),
        "Sessão encerrada.",
      ))
    ) {
      if (s.current) logout();
      else list.reload();
    }
  };
  const end = async (g) => {
    const c = await confirm({
      title: "Encerrar impersonação",
      message: "O portal deixará de aceitar esta sessão de suporte.",
      danger: true,
      reason: "required",
    });
    if (
      c &&
      (await run(
        () =>
          api(BASE + `/impersonations/${g.id}`, {
            method: "DELETE",
            body: { reason: c.reason },
          }),
        "Impersonação encerrada.",
      ))
    )
      grants.reload();
  };
  return (
    <section>
      <div className="toolbar">
        <input
          type="search"
          aria-label="Buscar sessões"
          placeholder="Nome ou e-mail"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="btn"
          onClick={() => {
            list.reload();
            grants.reload();
          }}
        >
          Atualizar
        </button>
      </div>
      <DataTable
        server
        rows={list.data}
        loading={list.loading}
        error={list.error}
        columns={[
          {
            key: "name",
            label: "Usuário",
            sortable: false,
            render: (s) => (
              <>
                {s.name}
                {s.current ? " · Sua sessão" : ""}
                <small className="control-muted">{s.email}</small>
              </>
            ),
          },
          { key: "ip", label: "IP", sortable: false },
          {
            key: "createdAt",
            label: "Início",
            sortable: false,
            render: (s) => fmtDateTime(s.createdAt),
          },
          { key: "userAgent", label: "Navegador", sortable: false },
          {
            key: "actions",
            label: "Ações",
            sortable: false,
            render: (s) => (
              <button className="btn sm danger" onClick={() => revoke(s)}>
                Encerrar
              </button>
            ),
          },
        ]}
      />
      <Pager meta={list.meta} onPage={list.setPage} />
      <h3>Impersonações ativas</h3>
      <DataTable
        rows={grants.data?.data || []}
        loading={!grants.data && !grants.error}
        error={grants.error}
        columns={[
          { key: "actorId", label: "DeltaTV" },
          { key: "targetId", label: "Conta acessada" },
          {
            key: "expiresAt",
            label: "Expira em",
            render: (g) => fmtDateTime(g.expiresAt),
          },
          {
            key: "actions",
            label: "Ações",
            sortable: false,
            render: (g) => (
              <button className="btn sm danger" onClick={() => end(g)}>
                Encerrar impersonação
              </button>
            ),
          },
        ]}
      />
    </section>
  );
}
function Roles() {
  const list = useLoad(() => api(BASE + "/roles"), []),
    catalog = useLoad(() => api(BASE + "/permissions"), []),
    [form, setForm] = useState(null);
  const run = useAction(),
    { confirm } = useUi();
  const remove = async (role) => {
    const c = await confirm({
      title: `Excluir ${role.name}?`,
      message:
        "Papéis atribuídos a usuários precisam ser removidos das contas antes da exclusão.",
      danger: true,
      reason: "required",
    });
    if (
      c &&
      (await run(
        () =>
          api(BASE + `/roles/${role.id}`, {
            method: "DELETE",
            body: { reason: c.reason },
          }),
        "Papel excluído.",
      ))
    )
      list.reload();
  };
  return (
    <section>
      <p>
        Crie papéis a partir de uma função existente. As permissões podem ser
        restringidas por área e ação. A DeltaTV mantém acesso integral.
      </p>
      <button
        className="btn primary"
        onClick={() =>
          setForm({ name: "", baseRole: "support", permissions: [] })
        }
      >
        Criar papel
      </button>
      <DataTable
        rows={list.data?.data || []}
        loading={!list.data && !list.error}
        error={list.error}
        columns={[
          { key: "name", label: "Papel" },
          {
            key: "baseRole",
            label: "Função base",
            render: (x) =>
              ({
                support: "Suporte",
                admin: "Administrador",
                partner: "Revenda / parceiro",
              })[x.baseRole],
          },
          {
            key: "permissions",
            label: "Permissões",
            value: (x) => x.permissions.length,
          },
          {
            key: "actions",
            label: "Ações",
            sortable: false,
            render: (x) => (
              <div className="actions">
                <button className="btn sm" onClick={() => setForm(x)}>
                  Editar
                </button>
                <button className="btn sm danger" onClick={() => remove(x)}>
                  Excluir
                </button>
              </div>
            ),
          },
        ]}
      />
      {form && (
        <RoleForm
          role={form}
          catalog={catalog.data?.roles || {}}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            list.reload();
          }}
        />
      )}
    </section>
  );
}
function RoleForm({ role, catalog, onClose, onSaved }) {
  const [f, setF] = useState({ ...role, reason: "" }),
    [busy, setBusy] = useState(false);
  const run = useAction();
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { id, createdAt, updatedAt, ...body } = f;
    const ok = await run(
      () =>
        api(BASE + "/roles" + (id ? "/" + id : ""), {
          method: id ? "PATCH" : "POST",
          body,
        }),
      "Papel salvo.",
    );
    setBusy(false);
    if (ok) onSaved();
  };
  return (
    <Modal title={role.id ? "Editar papel" : "Criar papel"} onClose={onClose}>
      <form onSubmit={save}>
        <Field label="Nome">
          <input
            required
            minLength={2}
            maxLength={80}
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
        </Field>
        <Field label="Função base">
          <select
            value={f.baseRole}
            onChange={(e) =>
              setF({ ...f, baseRole: e.target.value, permissions: [] })
            }
          >
            {[
              ["support", "Suporte"],
              ["admin", "Administrador"],
              ["partner", "Revenda / parceiro"],
            ].map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="control-permissions">
          <legend>Permitir ações</legend>
          {(catalog[f.baseRole] || []).map((p) => (
            <label key={p}>
              <input
                type="checkbox"
                checked={f.permissions.includes(p)}
                onChange={(e) =>
                  setF({
                    ...f,
                    permissions: e.target.checked
                      ? [...f.permissions, p]
                      : f.permissions.filter((x) => x !== p),
                  })
                }
              />
              {permissionLabel(p)}
            </label>
          ))}
        </fieldset>
        <Field label="Motivo">
          <textarea
            required
            minLength={5}
            maxLength={500}
            value={f.reason}
            onChange={(e) => setF({ ...f, reason: e.target.value })}
          />
        </Field>
        <button className="btn primary" disabled={busy}>
          Salvar papel
        </button>
      </form>
    </Modal>
  );
}
function Settings() {
  const load = useLoad(() => api(BASE + "/settings"), []),
    [f, setF] = useState(null),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false);
  const run = useAction(),
    { confirm } = useUi();
  useEffect(() => {
    if (load.data)
      setF({
        ...load.data,
        integrations: load.data.integrations.map((x) => ({
          name: x.name,
          enabled: x.enabled,
          secret: "",
        })),
      });
  }, [load.data]);
  const submit = async (e) => {
    e.preventDefault();
    const c = await confirm({
      title: "Aplicar configurações globais",
      message: f.maintenance
        ? "A manutenção impedirá novas ativações e alterações nos portais. A administração e os webhooks continuam acessíveis."
        : "Os textos e a marca serão atualizados nos painéis.",
      danger: f.maintenance,
    });
    if (!c) return;
    setBusy(true);
    const ok = await run(
      () => api(BASE + "/settings", { method: "PUT", body: { ...f, reason } }),
      "Configurações salvas.",
    );
    setBusy(false);
    if (ok) {
      setReason("");
      load.reload();
    }
  };
  return (
    <section>
      {load.error && <p className="error">{load.error}</p>}
      {!f ? (
        <p role="status">Carregando configurações…</p>
      ) : (
        <form className="control-form" onSubmit={submit}>
          <label>
            <input
              type="checkbox"
              checked={f.maintenance}
              onChange={(e) => setF({ ...f, maintenance: e.target.checked })}
            />{" "}
            Ativar manutenção
          </label>
          <Field label="Aviso da manutenção">
            <textarea
              required
              minLength={5}
              maxLength={500}
              value={f.maintenanceMessage}
              onChange={(e) =>
                setF({ ...f, maintenanceMessage: e.target.value })
              }
            />
          </Field>
          <div className="row">
            <Field label="Nome da plataforma">
              <input
                required
                minLength={2}
                maxLength={80}
                value={f.brand.name}
                onChange={(e) =>
                  setF({ ...f, brand: { ...f.brand, name: e.target.value } })
                }
              />
            </Field>
            <Field label="Cor principal">
              <input
                type="color"
                value={f.brand.primaryColor}
                onChange={(e) =>
                  setF({
                    ...f,
                    brand: { ...f.brand, primaryColor: e.target.value },
                  })
                }
              />
            </Field>
          </div>
          <Field label="Logo (URL HTTPS)">
            <input
              type="url"
              value={f.brand.logoUrl}
              onChange={(e) =>
                setF({ ...f, brand: { ...f.brand, logoUrl: e.target.value } })
              }
            />
          </Field>
          <Field label="Termos e textos legais">
            <textarea
              rows={6}
              maxLength={20000}
              value={f.terms}
              onChange={(e) => setF({ ...f, terms: e.target.value })}
            />
          </Field>
          <h3>Credenciais de integração</h3>
          <p className="muted">
            Os segredos são cifrados e nunca voltam ao navegador. Para
            configurar Pix, use o identificador mercadopago e um JSON com
            accessToken e webhookSecret no segredo. A configuração habilitada
            substitui as variáveis de ambiente; desmarcar Habilitada desliga o
            Pix. As demais integrações ficam no cofre para conectores futuros.
          </p>
          {f.integrations.map((x, i) => (
            <div className="control-integration" key={i}>
              <Field label="Identificador">
                <input
                  required
                  pattern="[a-z][a-z0-9_-]{1,39}"
                  value={x.name}
                  onChange={(e) =>
                    setF({
                      ...f,
                      integrations: f.integrations.map((v, j) =>
                        i === j ? { ...v, name: e.target.value } : v,
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Novo segredo (vazio mantém)">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={x.secret}
                  onChange={(e) =>
                    setF({
                      ...f,
                      integrations: f.integrations.map((v, j) =>
                        i === j ? { ...v, secret: e.target.value } : v,
                      ),
                    })
                  }
                />
              </Field>
              <label>
                <input
                  type="checkbox"
                  checked={x.enabled}
                  onChange={(e) =>
                    setF({
                      ...f,
                      integrations: f.integrations.map((v, j) =>
                        i === j ? { ...v, enabled: e.target.checked } : v,
                      ),
                    })
                  }
                />{" "}
                Habilitada
              </label>
              <button
                type="button"
                className="btn danger"
                onClick={() =>
                  setF({
                    ...f,
                    integrations: f.integrations.filter((_, j) => i !== j),
                  })
                }
              >
                Remover ao salvar
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn"
            disabled={f.integrations.length >= 10}
            onClick={() =>
              setF({
                ...f,
                integrations: [
                  ...f.integrations,
                  { name: "", enabled: false, secret: "" },
                ],
              })
            }
          >
            Adicionar integração
          </button>
          <Field label="Motivo da alteração">
            <textarea
              required
              minLength={5}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <button className="btn primary" disabled={busy}>
            Salvar configurações
          </button>
        </form>
      )}
    </section>
  );
}
function Backup() {
  const [password, setPassword] = useState(""),
    [reason, setReason] = useState(""),
    [backup, setBackup] = useState(null),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false),
    [phrase, setPhrase] = useState(""),
    [confirmation, setConfirmation] = useState(false);
  const run = useAction();
  const exportData = async () => {
    setBusy(true);
    const r = await run(
      () =>
        api(BASE + "/data/export", {
          method: "POST",
          timeout: 120000,
          body: { password, reason },
        }),
      "Backup preparado.",
    );
    setBusy(false);
    if (r) saveFile(r.filename, JSON.stringify(r.backup));
  };
  const inspect = async () => {
    setBusy(true);
    const r = await run(() =>
      api(BASE + "/data/import/preview", {
        method: "POST",
        timeout: 120000,
        body: { password, backup },
      }),
    );
    setBusy(false);
    if (r) setPreview(r);
  };
  const apply = async () => {
    setBusy(true);
    const r = await run(
      () =>
        api(BASE + "/data/import/apply", {
          method: "POST",
          timeout: 120000,
          body: {
            password,
            backup,
            expectedHash: preview.hash,
            reason,
            confirmation: phrase,
          },
        }),
      "Dados importados. Revise as contas desativadas.",
    );
    setBusy(false);
    if (r) {
      setConfirmation(false);
      setPreview(null);
      setBackup(null);
      setPassword("");
    }
  };
  const pick = async (e) => {
    setPreview(null);
    setBackup(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 29 * 1024 * 1024) {
      await run(() =>
        Promise.reject(Error("Selecione um backup de até 29 MB.")),
      );
      return;
    }
    await run(async () => {
      const value = JSON.parse(await file.text());
      setBackup(value);
      return true;
    });
  };
  return (
    <section className="control-form">
      <p>
        Backup lógico cifrado com senha, com limite de 50 mil registros e 20 MB
        antes da compressão. Para bases maiores, use o procedimento com{" "}
        <code>pg_dump</code> documentado na entrega.
      </p>
      <Field label="Senha do arquivo (mínimo 16 caracteres)">
        <input
          type="password"
          autoComplete="new-password"
          minLength={16}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setPreview(null);
          }}
        />
      </Field>
      <Field label="Motivo da operação">
        <textarea
          minLength={5}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <button
        className="btn primary"
        disabled={busy || password.length < 16 || reason.trim().length < 5}
        onClick={exportData}
      >
        {busy ? "Processando…" : "Exportar backup cifrado"}
      </button>
      <hr />
      <h3>Importar dados</h3>
      <p>
        A importação mescla registros por chave primária. Exige o mesmo esquema
        e as mesmas chaves de cifragem e de códigos do servidor. A manutenção
        deve estar ativa.
      </p>
      <Field label="Arquivo de backup">
        <input type="file" accept=".json" onChange={pick} />
      </Field>
      <button
        className="btn"
        disabled={!backup || password.length < 16 || busy}
        onClick={inspect}
      >
        Validar e mostrar prévia
      </button>
      {preview && (
        <>
          <p>{preview.notice}</p>
          <DataTable
            rows={preview.tables.map((x) => ({ ...x, id: x.table }))}
            columns={[
              { key: "table", label: "Tabela" },
              { key: "records", label: "Registros" },
              {
                key: "imported",
                label: "Tratamento",
                render: (x) =>
                  x.imported ? "Mesclar" : "Preservar no servidor",
              },
            ]}
          />
          <button
            className="btn danger"
            disabled={busy || reason.trim().length < 5}
            onClick={() => setConfirmation(true)}
          >
            Revisar confirmação da importação
          </button>
        </>
      )}
      {confirmation && (
        <Modal
          title="Confirmar importação de dados"
          onClose={() => setConfirmation(false)}
        >
          <p>
            Registros existentes poderão ser alterados. As contas importadas
            ficarão desativadas. Sua conta, as sessões e a auditoria atual serão
            preservadas.
          </p>
          <Field label="Digite IMPORTAR BACKUP">
            <input value={phrase} onChange={(e) => setPhrase(e.target.value)} />
          </Field>
          <button
            className="btn danger"
            disabled={phrase !== "IMPORTAR BACKUP" || busy}
            onClick={apply}
          >
            Importar os dados revisados
          </button>
        </Modal>
      )}
    </section>
  );
}
export default function Superadmin() {
  const [tab, setTab] = useState("overview");
  if (getAuth()?.user?.role !== "superadmin")
    return <p role="alert">Acesso exclusivo da DeltaTV.</p>;
  const Current = {
    overview: Overview,
    licenses: Licenses,
    sessions: Sessions,
    roles: Roles,
    messages: TvMessages,
    settings: Settings,
    backup: Backup,
  }[tab];
  return (
    <div className="control-root">
      <div className="control-hero">
        <div>
          <small>ADMINISTRAÇÃO DA PLATAFORMA</small>
          <h2>Central DeltaTV</h2>
          <p>Operação global, controle de acesso e histórico das alterações.</p>
        </div>
        <span className="badge info">Acesso integral · ações auditadas</span>
      </div>
      <nav className="control-tabs" aria-label="Áreas da DeltaTV">
        {TABS.map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-current={tab === id ? "page" : undefined}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="control-body">
        <Current key={tab} />
      </div>
    </div>
  );
}
