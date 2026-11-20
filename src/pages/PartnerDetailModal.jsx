import { useEffect, useState } from "react";
import ServerHistoryModal from "../ServerHistoryModal.jsx";
import DeletionDialog from "../DeletionDialog.jsx";
import AdminDeleteModal from "./AdminDeleteModal.jsx";
import { api } from "../api.js";
import { ClientsPanel } from "./Clients.jsx";
import { UsersPanel } from "./Users.jsx";
import CodeModal, { CodeEditModal } from "./CodeModal.jsx";
import { StockAdmin } from "./Stock.jsx";
import ServicePlan from "./ServicePlan.jsx";
import { Badge, DeliveryBadge, accessStatus, Field, LoadError, Modal, Pager, Table, fmtDate, fmtDateTime, fmtMoney, useAction, useLoad, useUi, RowMenu } from "../ui.jsx";

const KIND_LABEL = { content: "Parceiro (conteúdo)", reseller: "Revenda", both: "Parceiro e revenda" };
const isPending = (p) => p?.pending || (p?.status === "suspended" && p?.statusReason === "Aguardando aprovação do cadastro");
/** Códigos excluídos (arquivados) da parceria: só o superadmin vê e restaura. */
function DeletedCodes({ partnerId, run, confirm, onRestored }) {
  const [rows, setRows] = useState(null);
  const load = () => api(`/admin/partners/${partnerId}/codes/deleted`).then((r) => setRows(r.data || [])).catch(() => setRows([]));
  useEffect(() => { load(); }, [partnerId]);
  if (!rows?.length) return null;
  const restore = async (c) => {
    if (!(await confirm({ title: `Restaurar código ${c.code}`, message: "O código volta a aceitar novas ativações. Se o servidor dele foi excluído, ele volta sem servidor fixo. Créditos devolvidos na exclusão não são reservados de novo.", danger: false }))) return;
    if (await run(() => api(`/admin/partners/${partnerId}/codes/${c.id}/restore`, { method: "POST" }), "Código restaurado.")) { load(); onRestored(); }
  };
  return <details style={{ marginTop: 16 }}><summary>Códigos excluídos ({rows.length})</summary>
    <Table><thead><tr><th>Código</th><th>Rótulo</th><th>Excluído em</th><th /></tr></thead><tbody>
      {rows.map((c) => <tr key={c.id}><td><strong>{c.code}</strong></td><td>{c.label || "—"}</td><td>{new Date(c.deletedAt).toLocaleString("pt-BR")}</td>
        <td className="actions"><button className="btn" onClick={() => restore(c)}>Restaurar</button></td></tr>)}
    </tbody></Table></details>;
}

export default function PartnerDetailModal({ id, onClose, onChanged = () => {}, basePath = "/admin/partners", role = "superadmin", permits = () => false, query = {}, renderEditForm, initialTab = null, partnerName = "Parceiro", initialEdit = false }) {
  const { confirm, toast } = useUi();
  const run = useAction();
  const [tab, setTab] = useState(initialTab);
  const [devices, setDevices] = useState([]);
  const [devicesPage, setDevicesPage] = useState(1);
  const [devicesMeta, setDevicesMeta] = useState(null);
  const [devicesError, setDevicesError] = useState("");
  const [newCode, setNewCode] = useState(false);
  const [editCode, setEditCode] = useState(null);
  const [provForm, setProvForm] = useState(null);
  const [historyServer, setHistoryServer] = useState(null);
  const [editing, setEditing] = useState(initialEdit);
  const [deleting, setDeleting] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [deleteItem,setDeleteItem] = useState(null);
  const [transferring, setTransferring] = useState(null);
  const scoped = role === "admin";
  const scopedCan = (permission) => !scoped || permits(permission);
  const accountRead = (p) => (p?.kind === "reseller" ? "network:resellers:read" : "network:partners:read");
  const accountWrite = (p) => (p?.kind === "reseller" ? "network:resellers:write" : "network:partners:write");
  const accountDelete = (p) => (p?.kind === "reseller" ? "network:resellers:delete" : "network:partners:delete");
  const canAccountWrite = (p) => scopedCan(accountWrite(p)) && (p?.kind !== "both" || scopedCan("network:resellers:write"));
  const canAccountDelete = (p) => scopedCan(accountDelete(p)) && (p?.kind !== "both" || scopedCan("network:resellers:delete"));
  const endpoint = (suffix = "") => `${basePath}/${id}${suffix}`;
  const call = (suffix = "", opts = {}) => api(endpoint(suffix), { ...opts, query: { ...query, ...(opts.query || {}) } });
  // Adapter restrito: não consulta endpoints globais ao abrir a ficha do Admin.
  const { data: p, error, reload: load, setData: setP } = useLoad(async () => {
    if (!scoped) return call();
    const detail = await call();
    const partner = detail.partner;
    const [codes, providers, invoices] = await Promise.all([
      scopedCan("network:resources:read") ? call("/codes").then(r => r.data || []) : [],
      scopedCan("network:resources:read") ? call("/providers").then(r => r.data || []) : [],
      scopedCan("network:billing:read") ? call("/invoices").then(r => r.data || []) : [],
    ]);
    return { ...partner, ...(!detail.contract ? {} : { deviceLimit: detail.contract.activationLimit ?? partner.deviceLimit }),
      codes, providers, invoices, users: detail.users || [], plan: detail.plan, contract: detail.contract };
  }, [id, basePath, role, query.adminId]);
  const loadDevices = () => (!scopedCan("network:devices:read") ? Promise.resolve() : call("/devices", { query: { page: devicesPage, pageSize: 50 } }))
    .then((r) => { if(r){setDevices(r.data || []);setDevicesMeta(r.meta);} }).catch((err) => setDevicesError(err.message));
  useEffect(() => { loadDevices(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [id, devicesPage]);
  if (!p) return <Modal title={partnerName} onClose={onClose} wide>{error ? <LoadError error={error} onRetry={load} /> : <p className="muted">Carregando…</p>}</Modal>;

  const what = p.kind === "content" ? "parceria" : "revenda";
  const tabList = [
    ...(!scoped && p.kind !== "content" ? [["stock", "Estoque de licenças"]] : []),
    ...(!scoped ? [["clients", "Clientes e avisos"]] : []),
    ...(!scoped && p.kind === "reseller" ? [["service-plan", "Plano de recursos"]] : []),
    ...(scopedCan("network:resources:read") ? [["codes", "Códigos"], ["providers", "Servidores IPTV"]] : []),
    ...(scopedCan("network:devices:read") ? [["devices", "Dispositivos"]] : []),
    ...(scoped ? (scopedCan("network:billing:read") ? [["invoices", "Mensalidades"]] : []) : (p.billingModel !== "none" || p.invoices.length ? [["invoices", "Mensalidades"]] : [])),
    ...(!scoped || scopedCan("network:members:read") ? [["users", "Usuários do portal"]] : []),
  ];
  const cur = tabList.some(([key])=>key === tab) ? tab : (tabList[0]?.[0] || "overview");
  const act = async (action, o) => {
    const c = await confirm(o);
    if (!c) return;
    const r = await run(() => call(`/${action}`, { method: "POST", body: { reason: c.reason } }), "Operação concluída.");
    if (r) { setP({ ...p, ...r }); load(); onChanged(); }
  };
  const delProvider=(pr)=>setDeleteItem({kind:'provider',item:pr,url:`${basePath}/${id}/providers/${pr.id}`});
  const revokeCode = async (c) => {
    if (!(await confirm({ title: "Revogar código", message: "Impede novas ativações com este código. Dispositivos já ativados continuam vinculados à parceria.", danger: true }))) return;
    if (await run(() => call(`/codes/${c.id}/revoke`, { method: "POST" }), "Código revogado.")) load();
  };
  const device = async (a, action, o) => {
    const c = await confirm(o);
    if (!c) return;
    if (await run(() => api(scoped ? `/admin/workspace/devices/activations/${a.id}/${action}` : `/admin/devices/activations/${a.id}/${action}`, { method: "POST", body: { reason: c.reason }, query }), "Dispositivo atualizado.")) { loadDevices(); load(); }
  };
  const renewOneMonth=async()=>{
    if(!(await confirm({title:"Renovar acesso por 1 mês",message:`Prorrogar em um mês o acesso de ${p.name} e seus dispositivos? Esta ação administrativa NÃO confirma nem cobra pagamento automaticamente.`,confirmLabel:"Renovar +1 mês"})))return;
    const result=await run(()=>call("/renew-month",{method:"POST"}),"Vigência prorrogada em um mês.");
    if(result){setP(result);load();onChanged();}
  };
  const generate = async () => {
    const now = new Date();
    const competence = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
    const r = await run(() => call("/invoices", { method: "POST", body: { competence } }));
    if (r) { toast(r.created ? `Cobrança de ${competence} gerada.` : r.skipped ? "Sem mensalidade a cobrar neste cadastro; nenhuma cobrança foi gerada." : `A cobrança de ${competence} já existia; nada foi criado.`); load(); }
  };

  return (
    <Modal title={p.name} onClose={onClose} wide>
      <dl className="kv">
        <dt>Status</dt><dd><Badge status={isPending(p) ? "pending" : p.effectiveStatus} label={isPending(p) ? "Novo cadastro" : undefined} /> {p.statusReason && <span className="muted">— {p.statusReason}</span>}</dd>
        <dt>Contato</dt><dd>{[p.contactName, p.contactEmail, p.contactPhone].filter(Boolean).join(" · ") || "—"}</dd>
        <dt>Identificador</dt><dd>{p.slug}</dd><dt>Vigência</dt><dd>{fmtDate(p.startsAt)} → {fmtDate(p.endsAt)}</dd>
        <dt>Tipo</dt><dd><span className={`kind ${p.kind}`}>{KIND_LABEL[p.kind] || p.kind}</span></dd>
        {(!scoped || p.monthlyFeeCents != null) && <><dt>Mensalidade</dt><dd>{p.billingModel === "none" ? "Sem cobrança" : fmtMoney(p.monthlyFeeCents || 0)}{p.dueDay != null ? ` · vence dia ${p.dueDay}` : ""}{p.graceDays != null ? ` · tolerância ${p.graceDays} dia(s)` : ""}</dd></>}
        {(!scoped || p.deviceLimit !== undefined || p.deviceCount !== undefined) && <><dt>Dispositivos</dt><dd>{p.deviceCount ?? "—"}{p.deviceLimit != null ? ` de ${p.deviceLimit}` : " (sem limite)"}</dd></>}
      </dl>
      <div className="actions left">
        {canAccountWrite(p) && <button className="btn primary" onClick={() => setEditing(true)}>Editar parceiro e contrato</button>}
        {role === "superadmin" && p.kind !== "reseller" && <button className="btn" onClick={renewOneMonth}>Renovar +1 mês</button>}
        {canAccountDelete(p) && <button className="btn danger" onClick={() => setDeleting(true)}>Excluir revenda / parceiro</button>}
        {scoped && p.statusReason === "awaiting_payment" && scopedCan("network:billing:write") && canAccountWrite(p) && <button className="btn primary" onClick={() => setConfirmingPayment(true)}>Confirmar recebimento</button>}
        {canAccountWrite(p) && p.status === "active" && <button className="btn" onClick={() => act("suspend", { title: `Suspender ${what}`, message: "Todos os dispositivos vinculados perdem o acesso até a reativação.", reason: "required", danger: true, confirmLabel: "Suspender" })}>Suspender</button>}
        {canAccountWrite(p) && ["active", "suspended"].includes(p.status) && <button className="btn danger" onClick={() => act("block", { title: `Bloquear ${what}`, message: "Todos os dispositivos da parceria perdem o acesso, independentemente do código usado.", reason: "required", danger: true, confirmLabel: "Bloquear" })}>Bloquear</button>}
        {canAccountWrite(p) && (!scoped || p.statusReason !== "awaiting_payment") && (["suspended", "blocked"].includes(p.status) || (role === "superadmin" && p.status === "cancelled")) && <button className="btn primary" onClick={() => act("reactivate", isPending(p) ? { title: "Aprovar cadastro", message: "O revendedor poderá usar o portal imediatamente.", confirmLabel: "Aprovar" } : { title: `Reativar ${what}`, message: "Os dispositivos elegíveis recuperam o acesso." })}>{isPending(p) ? "Aprovar cadastro" : "Reativar"}</button>}
        {canAccountWrite(p) && p.status !== "cancelled" && <button className="btn danger" onClick={() => act("cancel", { title: `Cancelar ${what}`, message: "Os dispositivos perdem o acesso. Só a DeltaTV pode reativar depois.", reason: "required", danger: true })}>Cancelar</button>}
      </div>
      {deleteItem && <DeletionDialog scoped={scoped} query={query} kind={deleteItem.kind} item={deleteItem.item} url={deleteItem.url} onClose={()=>setDeleteItem(null)} onDeleted={()=>{setDeleteItem(null);load();onChanged()}}/>}
      <div className="tabs">{tabList.map(([k, n]) => <button key={k} className={`tab ${cur === k ? "active" : ""}`} onClick={() => setTab(k)}>{n}</button>)}</div>
      {cur === "service-plan" && <ServicePlan partnerId={id} />}
      {cur === "codes" && <>
        {scopedCan("network:resources:write") && (!scoped || p.kind !== "reseller") && <div className="actions left"><button className="btn primary" onClick={() => setNewCode(true)}>Novo código</button></div>}
        <Table><thead><tr><th>Código</th><th>Servidor</th><th>Rótulo</th>{p.kind !== "content" && <th>Licença do estoque</th>}<th>Status</th><th>Ativações (usadas/limite)</th><th>Expira</th><th /></tr></thead><tbody>
          {p.codes.map((c) => <tr key={c.id}><td><strong>{c.code}</strong></td><td>{c.provider ? <>{c.provider.name}{c.provider.status !== "active" && <> <Badge status="disabled" label="Desativado" /></>}<div className="muted">{c.provider.baseUrl}</div></> : c.status === "active" ? <span className="muted" title="Código antigo: o app testa os servidores da parceria por prioridade. Edite para escolher um servidor.">Qualquer servidor ⚠</span> : "—"}</td><td>{c.label || "—"}</td>{p.kind !== "content" && <td>{c.licenseMonths ? <>{c.licenseMonths} {c.licenseMonths === 1 ? "mês" : "meses"} · <span style={c.stockAvailable === 0 ? { color: "var(--bad)" } : undefined}>{c.stockAvailable} em estoque</span></> : <span className="muted" title="Sem licença: este código não consome estoque.">—</span>}</td>}<td><Badge status={c.status === "active" ? "active" : "revoked"} label={c.status === "active" ? "Ativo" : "Revogado"} /></td><td>{c.activationCount ?? 0} / {c.maxActivations ?? "∞"}</td><td>{fmtDate(c.expiresAt)}</td>
            <td className="actions">
              <RowMenu items={[
                { label: "Configurar código", hidden: !scopedCan("network:resources:write") || (c.status !== "active" && role !== "superadmin"), onClick: () => setEditCode(c) },
                { label: "Revogar", hidden: !scopedCan("network:resources:write") || c.status !== "active", danger: true, onClick: () => revokeCode(c) },
                { label: "Excluir", hidden:!scopedCan("network:resources:write"),danger:true,onClick:()=>setDeleteItem({kind:"code",item:c,url:endpoint(`/codes/${c.id}`)}) },
              ]} />
            </td></tr>)}
        </tbody></Table>
        {role === "superadmin" && <DeletedCodes partnerId={id} run={run} confirm={confirm} onRestored={() => { load(); onChanged(); }} />}</>}
      {cur === "providers" && <>
        <p className="muted">Servidores do provedor desta parceria. O cliente digita código, usuário e senha; o servidor monta a URL da playlist e a valida antes de ativar. Cada código aponta para um servidor (veja a coluna “Códigos”): quem usa o código é validado e atendido por ele. Só códigos antigos sem servidor testam todos, do menor para o maior número de prioridade. O modo de entrega vale para todos os dispositivos ligados ao servidor e muda em até alguns segundos.</p>
        {scopedCan("network:resources:write") && <div className="actions left"><button className="btn primary" onClick={() => setProvForm({})}>Adicionar servidor</button></div>}
        <Table><thead><tr><th>Nome</th><th>URL base</th><th>Códigos</th><th>Entrega</th><th>Prior.</th><th>Status</th><th /></tr></thead><tbody>
          {p.providers.map((pr) => <tr key={pr.id}><td>{pr.name}</td><td>{pr.baseUrl}</td><td>{p.codes.filter((c) => c.providerId === pr.id && c.status === "active").map((c) => c.code).join(", ") || "—"}</td><td>{pr.deliveryMode === "proxy" ? "Proxy" : "Redirecionamento"}</td><td>{pr.priority}</td><td><Badge status={pr.status} /></td>
            <td className="actions">
              <RowMenu items={[
                { label: "Editar", hidden: !scopedCan("network:resources:write"), onClick: () => setProvForm(pr) },
                { label: "Histórico detalhado", hidden: role !== "superadmin", onClick: () => setHistoryServer({ ...pr, partnerName: p.name }) },
                { label: "Excluir", hidden: !scopedCan("network:resources:write"), danger: true, onClick: () => delProvider(pr) },
              ]} />
            </td></tr>)}
        </tbody></Table></>}
      {cur === "stock" && p.kind !== "content" && <StockAdmin partnerId={id} />}
      {cur === "clients" && <ClientsPanel partnerId={id} />}
      {cur === "users" && (!scoped ? <UsersPanel partnerId={id} /> : <UsersPanel scoped users={p.users} call={call} permits={permits} reload={load} />)}
      {cur === "devices" && <>{devicesError && <p className="error" role="alert">{devicesError}</p>}<Table><thead><tr><th>MAC</th><th>Servidor</th><th>Entrega</th><th>Status</th><th>Ativado em</th><th /></tr></thead><tbody>
        {devices.map((a) => <tr key={a.id}><td>{a.mac}</td><td>{a.provider?.name || "—"}</td><td><DeliveryBadge mode={a.deliveryMode} fixed={a.deliveryModeFixed} /></td><td><Badge status={accessStatus(a)} /></td><td>{fmtDateTime(a.activatedAt)}</td><td className="actions">
              <RowMenu items={[
                { label: "Transferir licença para outro MAC", hidden: role !== "superadmin" || !a.grantedLicense?.id || a.status !== "active", onClick: () => setTransferring(a) },
                { label: "Bloquear", hidden: !scopedCan("network:devices:write") || a.status !== "active", onClick: () => device(a, "block", { title: "Bloquear dispositivo", message: a.mac, reason: "required", danger: true }) },
                { label: "Desbloquear", hidden: !scopedCan("network:devices:write") || a.status !== "blocked", onClick: () => device(a, "unblock", { title: "Desbloquear", message: a.mac }) },
                { label: "Restaurar", hidden: !(a.status === "revoked" && role === "superadmin"), onClick: () => device(a, "restore", { title: "Restaurar ativação", message: a.mac }) },
                { label: "Remover", hidden: !scopedCan("network:devices:write") || a.status === "revoked", danger: true, onClick: () => device(a, "revoke", { title: "Remover ativação", message: a.mac, danger: true }) },
              ]} />
            </td></tr>)}</tbody></Table></>}
      {cur === "devices" && devicesMeta?.totalPages > 1 && <Pager meta={devicesMeta} onPage={setDevicesPage} />}
      {cur === "invoices" && <>
        {scopedCan("network:billing:write") && <div className="actions left"><button className="btn" onClick={generate}>Gerar cobrança do mês encerrado</button></div>}
        <Table><thead><tr><th>Competência</th><th>Dispositivos</th><th>Valor</th><th>Pago</th><th>Vencimento</th><th>Status</th></tr></thead><tbody>
          {p.invoices.map((i) => <tr key={i.id}><td>{i.competence}</td><td>{i.deviceCount}</td><td>{fmtMoney(i.amountCents)}</td><td>{fmtMoney(i.paidCents)}</td><td>{fmtDate(i.dueDate)}</td><td><Badge status={i.status} /></td></tr>)}
        </tbody></Table></>}
      {newCode && <CodeModal scoped={scoped} query={query} checkPath={scoped ? null : "/admin/partners/codes/check"} createPath={endpoint("/codes")} balancesPath={scoped ? null : endpoint("/stock")} kind={p.kind} providers={p.providers} onClose={() => setNewCode(false)} onCreated={() => { setNewCode(false); load(); }} />}
      {editCode && <CodeEditModal basePath={basePath} scoped={scoped} query={query} partnerId={id} code={editCode} kind={p.kind} providers={p.providers} onClose={() => setEditCode(null)} onSaved={() => { setEditCode(null); load(); }} />}
      {transferring && <AdminLicenseTransferModal activation={transferring} onClose={() => setTransferring(null)} onDone={() => { setTransferring(null); loadDevices(); load(); }} />}
      {historyServer && <ServerHistoryModal server={historyServer} onClose={() => setHistoryServer(null)} />}
      {provForm && <ProviderForm basePath={basePath} query={query} partnerId={id} provider={provForm.id ? provForm : null} onClose={() => setProvForm(null)} onSaved={() => { setProvForm(null); load(); }} />}
      {confirmingPayment && <WorkspacePaymentModal partner={p} call={call} onClose={()=>setConfirmingPayment(false)} onSaved={()=>{setConfirmingPayment(false);load();onChanged();}}/>}
      {deleting && (!scoped ? <AdminDeleteModal type="partner" id={id} onClose={() => setDeleting(false)} onDone={() => { setDeleting(false); onClose(); onChanged?.(); }} /> : <WorkspaceArchiveModal partner={p} call={call} onClose={() => setDeleting(false)} onDone={() => { setDeleting(false); onClose(); onChanged?.(); }} />)}
      {editing && (scoped ? <WorkspaceContractModal partner={p} call={call} query={query} permits={permits} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); onChanged(); }}/> : renderEditForm?.({partner:p, onClose:()=>setEditing(false), onSaved:()=>{setEditing(false);load();onChanged();}}))}
    </Modal>
  );
}

const DEFAULT_TEMPLATE = "/get.php?username={username}&password={password}&type=m3u_plus&output=m3u8";

function ProviderForm({ basePath = "/admin/partners", query = {}, partnerId, provider, onClose, onSaved }) {
  const run = useAction();
  const edit = !!provider;
  const [f, setF] = useState({
    name: provider?.name || "", baseUrl: provider?.baseUrl || "", playlistTemplate: provider?.playlistTemplate || DEFAULT_TEMPLATE,
    deliveryMode: provider?.deliveryMode || "redirect", priority: provider?.priority ?? 0, status: provider?.status || "active",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    const body = { ...f, priority: Number(f.priority) };
    const r = await run(() => api(edit ? `${basePath}/${partnerId}/providers/${provider.id}` : `${basePath}/${partnerId}/providers`, { method: edit ? "PATCH" : "POST", body, query }), "Servidor salvo.");
    if (r) onSaved();
  };
  return (
    <Modal title={edit ? "Editar servidor" : "Novo servidor do provedor"} onClose={onClose}>
      <Field label="Nome"><input value={f.name} onChange={set("name")} placeholder="Servidor principal" /></Field>
      <Field label="URL base" hint="Apenas o endereço, ex.: http://valkiire.net (endereços internos são bloqueados)"><input value={f.baseUrl} onChange={set("baseUrl")} placeholder="http://valkiire.net" /></Field>
      <Field label="Caminho da playlist" hint="Use {username} e {password} (aceita também {usuario} e {senha}). Padrão Xtream: type=m3u_plus&output=m3u8"><textarea rows={2} value={f.playlistTemplate} onChange={set("playlistTemplate")} /></Field>
      <div className="row">
        <Field label="Entrega" hint="Proxy: seu servidor serve o conteúdo e o app nunca vê a URL nem a senha do provedor (consome sua banda). Redirecionamento: o app recebe as credenciais reais e fala direto com o provedor (não usa sua banda)."><select value={f.deliveryMode} onChange={set("deliveryMode")}><option value="redirect">Redirecionamento (302)</option><option value="proxy">Proxy</option></select></Field>
        <Field label="Prioridade" hint="Menor = tentado primeiro"><input type="number" min="0" value={f.priority} onChange={set("priority")} /></Field>
      </div>
      <Field label="Status"><select value={f.status} onChange={set("status")}><option value="active">Ativo</option><option value="disabled">Desativado</option></select></Field>
      <div className="actions"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!f.name || !f.baseUrl} onClick={submit}>Salvar</button></div>
    </Modal>
  );
}

function AdminLicenseTransferModal({ activation, onClose, onDone }) {
  const run = useAction();
  const [toMac, setToMac] = useState("");
  const [reason, setReason] = useState("");
  const submit = async () => {
    if (reason.trim().length < 5 || toMac.trim().length < 11) return;
    const result = await run(() => api(`/admin/devices/activations/${activation.id}/transfer-license`, {
      method: "POST", body: { toMac: toMac.trim(), reason: reason.trim() },
    }), "Licença transferida sem alteração do vencimento.");
    if (result) onDone();
  };
  return <Modal title="Transferir licença para outro MAC" onClose={onClose}>
    <p className="muted">Origem: {activation.mac}. O dispositivo de destino deve estar cadastrado, sem outra lista ativa desta revenda. O prazo de validade é preservado.</p>
    <Field label="MAC de destino"><input value={toMac} onChange={(e) => setToMac(e.target.value)} placeholder="AA:BB:CC:DD:EE:FF" /></Field>
    <Field label="Justificativa"><textarea value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    <div className="actions"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={submit} disabled={toMac.trim().length < 11 || reason.trim().length < 5}>Transferir licença</button></div>
  </Modal>;
}

/** Subdiálogo de edição contratual: nunca recebe campos globais ou ownerAdminId. */
function WorkspaceContractModal({partner,call,query,permits,onClose,onSaved}) {
  const [plans,setPlans]=useState([]);
  const [plansError,setPlansError]=useState("");
  const canReadPlans=permits("network:plans:read");
  useEffect(()=>{
    if(!canReadPlans)return;
    let active=true;
    api("/admin/workspace/plans",{query}).then(r=>{
      if(active)setPlans((r.data||[]).filter(plan=>plan.active!==false && (plan.audience===partner.kind||plan.audience==="both"||partner.kind==="both")));
    }).catch(e=>{if(active)setPlansError(e.message||"Falha ao consultar planos.")});
    return ()=>{active=false};
  },[partner.id,canReadPlans,query?.adminId]);
  const run = useAction();
  const [form,setForm] = useState({name:partner.name||"",contactName:partner.contactName||"",
    contactEmail:partner.contactEmail||"",contactPhone:partner.contactPhone||"",
    endsAt:partner.endsAt ? new Date(partner.endsAt).toISOString().slice(0,10) : "",planKey:partner.plan?.tier||""});
  const change=(key)=>(event)=>setForm(v=>({...v,[key]:event.target.value}));
  const save=async()=>{
    const body={name:form.name,contactName:form.contactName||null,contactEmail:form.contactEmail||null,
      contactPhone:form.contactPhone||null,...(form.endsAt?{endsAt:new Date(`${form.endsAt}T12:00:00Z`).toISOString()}:{}),
      ...(canReadPlans && form.planKey && form.planKey !== (partner.plan?.tier||"") ? {planKey:form.planKey} : {})};
    if(await run(()=>call("",{method:"PATCH",body}),"Contrato atualizado."))onSaved();
  };
  return <Modal title="Editar parceiro e contrato" onClose={onClose} wide>
    <Field label="Empresa"><input value={form.name} onChange={change("name")}/></Field>
    <Field label="Contato"><input value={form.contactName} onChange={change("contactName")}/></Field>
    <Field label="E-mail"><input type="email" value={form.contactEmail} onChange={change("contactEmail")}/></Field>
    <Field label="Telefone"><input value={form.contactPhone} onChange={change("contactPhone")}/></Field>
    <Field label="Fim da vigência"><input type="date" value={form.endsAt} onChange={change("endsAt")}/></Field>
    {canReadPlans&&<Field label="Plano de serviço da rede"><select value={form.planKey} onChange={change("planKey")}>
      <option value="">Plano atual / sem alteração</option>
      {form.planKey&&!plans.some(p=>p.key===form.planKey)&&<option value={form.planKey}>Plano atual (legado)</option>}
      {plans.map(p=><option key={p.key} value={p.key}>{p.name} · {fmtMoney(p.monthlyPriceCents)} / mês · {p.activationLimit??"∞"} dispositivos</option>)}
    </select></Field>}
    {plansError&&<p className="error" role="alert">{plansError}</p>}
    <p className="muted">Mensalidade e limites acompanham o plano autorizado da própria rede. Trocar para plano pago exige confirmação financeira antes da ativação.</p>
    <div className="actions"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!form.name.trim()} onClick={save}>Salvar contrato</button></div>
  </Modal>;
}

function WorkspaceArchiveModal({partner,call,onClose,onDone}){
 const run=useAction();
 const [reason,setReason]=useState("");
 const {data:preview,error}=useLoad(()=>call("/delete-preview"),[partner.id]);
 const submit=async()=>{if(await run(()=>call("/archive",{method:"POST",body:{reason:reason.trim()}}),"Conta movida à lixeira da rede."))onDone();};
 return <Modal title={`Excluir ${partner.name} da rede`} onClose={onClose}>
   <p>A conta será arquivada. Os vínculos financeiros e de outras redes serão preservados.</p>
   {error&&<LoadError error={error} />}
   {preview&&<p className="muted">Impacto: {preview.users} usuário(s), {preview.codes} código(s), {preview.activations} ativação(ões), {preview.providers} DNS.</p>}
   <Field label="Motivo (opcional)"><textarea rows={3} value={reason} maxLength={400} onChange={e=>setReason(e.target.value)}/></Field>
   <div className="actions"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn danger" disabled={!preview} onClick={submit}>Arquivar conta</button></div>
 </Modal>;
}

function WorkspacePaymentModal({partner,call,onClose,onSaved}) {
 const run=useAction();const [reference,setReference]=useState("");
 const confirm=async()=>{if(await run(()=>call("/confirm-payment",{method:"POST",body:{reference:reference.trim()}}),"Pagamento confirmado."))onSaved();};
 return <Modal title={`Confirmar recebimento — ${partner.name}`} onClose={onClose}>
   <p>Confirme o recebimento real no banco antes de liberar recursos pagos.</p>
   <Field label="Referência do pagamento"><input value={reference} onChange={e=>setReference(e.target.value)} placeholder="ID Pix / referência bancária"/></Field>
   <div className="actions"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={reference.trim().length<3} onClick={confirm}>Confirmar e ativar</button></div>
 </Modal>;
}
