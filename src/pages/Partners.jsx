import PartnerDetailModal from "./PartnerDetailModal.jsx";
import DeletionDialog from "../DeletionDialog.jsx";
import { useEffect, useRef, useState } from "react";
import AdminDeleteModal from "./AdminDeleteModal.jsx";
import PartnerPreRegistrations from "./PartnerPreRegistrations.jsx";
import { offlineDuration } from "../presence-time.js";
import { api, getAuth } from "../api.js";
import { ClientsPanel } from "./Clients.jsx";
import { UsersPanel } from "./Users.jsx";
import CodeModal, { CodeEditModal } from "./CodeModal.jsx";
import { StockAdmin } from "./Stock.jsx";
import ServicePlan from "./ServicePlan.jsx";
import { Badge, DeliveryBadge, accessStatus, Empty, Field, LoadError, Modal, Pager, Table, dateInput, fmtDate, fmtDateTime, fmtMoney, spDateToIso, toCents, useAction, useDebounced, useList, useLoad, useUi, RowMenu } from "../ui.jsx";

// Mesmo texto gravado pelo back-end no autocadastro de revendedor (ver reseller-signup.service.js).
const PENDING_REASON = "Aguardando aprovação do cadastro";
export const isPending = (p) => p.status === "suspended" && p.statusReason === PENDING_REASON;

const MODELS = { none: "Sem mensalidade", fixed: "Mensalidade fixa", per_device: "Por dispositivo ativo", tiered: "Por faixa de dispositivos" };

const KIND_LABEL = { content: "Parceiro (conteúdo)", reseller: "Revenda", both: "Parceiro e revenda" };

// Parceiro = provedor de conteúdo (servidores IPTV + códigos). Revenda = quem compra licenças, tem estoque e atende clientes por MAC.
// "both" aparece nas duas telas, com uma etiqueta avisando que também pertence à outra.
const SCOPES = {
  content: {
    title: "Gerenciar parceiros", sub: "Cadastre parceiros e defina mensalidade, DNS, ativações e contrato de serviços em um único formulário.",
    kinds: ["content", "both"], defaultKind: "content", newLabel: "Novo parceiro", noun: "parceiro", saved: "Parceiro salvo.",
    search: "Buscar por empresa, responsável, e-mail ou identificador", also: "também é revenda", billing: "Mensalidade",
  },
  reseller: {
    title: "Revendas", sub: "Quem compra licenças, mantém estoque e atende os clientes finais por MAC.",
    kinds: ["reseller", "both"], defaultKind: "reseller", newLabel: "Nova revenda", noun: "revenda", saved: "Revenda salva.",
    search: "Buscar revenda por nome ou identificador", also: "também é parceiro", billing: "Cobrança",
  },
};

function PartnersList({ scope, onChanged }) {
  const cfg = SCOPES[scope];
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const list = useList("/admin/partners", { q: "", status: "", kind: scope, pageSize: 50 });
  const [liveIds, setLiveIds] = useState(null);
  // Horário de desconexão recebido em tempo real; não requer leitura no banco.
  const [disconnectedAt, setDisconnectedAt] = useState({});
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const refresh = () => api("/admin/partners/presence/live").then((v) => setLiveIds(new Set(v.onlinePartnerIds))).catch(() => {});
    const change = (ev) => {
      if (ev?.detail?.type === "partner-presence") {
        const { partnerId, online, lastDisconnectedAt } = ev.detail;
        if (partnerId) {
          setDisconnectedAt((prev) => {
            if (online) {
              if (!(partnerId in prev)) return prev;
              const next = { ...prev };
              delete next[partnerId];
              return next;
            }
            // Limita o histórico temporário no navegador; os demais tempos vêm do banco.
            const next = { ...prev, [partnerId]: lastDisconnectedAt || new Date().toISOString() };
            const keys = Object.keys(next);
            for (const id of keys.slice(0, Math.max(0, keys.length - 2000))) delete next[id];
            return next;
          });
        }
        setClock(Date.now());
        setLiveIds((old) => {
          if (!old) { refresh(); return old; }
          const copy = new Set(old);
          if (ev.detail.online) copy.add(ev.detail.partnerId); else copy.delete(ev.detail.partnerId);
          return copy;
        });
      } else refresh();
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener("realtime-change", change);
    window.addEventListener("realtime-ready", change);
    return () => { clearInterval(timer); window.removeEventListener("realtime-change", change); window.removeEventListener("realtime-ready", change); };
  }, []);
  const [inviteRevision, setInviteRevision] = useState(0);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [editingPartner, setEditingPartner] = useState(null);
  useEffect(() => { list.filter({ q: dq }); /* eslint-disable-next-line */ }, [dq]);
  useEffect(() => { const timer = setInterval(() => list.reload(), 60_000); return () => clearInterval(timer); }, [list.reload]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) list.reload(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [list.reload]);
  const rows = list.data.filter((p) => cfg.kinds.includes(p.kind));
  // A lista contém apenas a revisão da foto, nunca 50 imagens base64 no JSON.
  // Carrega em lote as fotos que ainda não estão em cache e reutiliza em atualizações
  // automáticas da lista. A mesma lógica funciona para parceiros e revendas.
  const [avatarCache, setAvatarCache] = useState(() => new Map());
  const requestedAvatars = useRef(new Set());
  useEffect(() => {
    const missing = list.data.filter((p) => {
      const key = p.avatarVersion && `${p.id}:${p.avatarVersion}`;
      return key && !avatarCache.has(key) && !requestedAvatars.current.has(key);
    });
    if (!missing.length) return;
    const keys = missing.map((p) => `${p.id}:${p.avatarVersion}`);
    keys.forEach((key) => requestedAvatars.current.add(key));
    // A API aceita no máximo 50 IDs por solicitação (pageSize da lista = 50).
    api("/admin/partners/avatars", { method: "POST", body: { ids: missing.map(p => p.id) } })
      .then((result) => {
        const available = new Map((result.data || []).map((item) => [`${item.partnerId}:${item.avatarVersion}`, item.avatarData]));
        setAvatarCache((previous) => {
          const next = new Map(previous);
          for (const key of keys) next.set(key, available.get(key) || null);
          // Limita a memória durante navegação por muitas páginas.
          while (next.size > 100) next.delete(next.keys().next().value);
          return next;
        });
      })
      .catch(() => { /* A lista continua utilizável com iniciais se houver falha de rede. */ })
      .finally(() => keys.forEach((key) => requestedAvatars.current.delete(key)));
  }, [list.data, avatarCache]);
  const changed = () => { list.reload(); setInviteRevision(value => value + 1); onChanged?.(); };
  const count = (fn) => rows.filter(fn).length;
  const pending = count(isPending);
  return (
    <>
      <div className="page-head">
        <div><h2>{cfg.title}</h2><p className="muted page-sub">{cfg.sub}</p></div>
        <button className="btn primary" onClick={() => setCreating(true)}>+ {cfg.newLabel}</button>
      </div>
      {rows.length > 0 && (
        <div className="mini-stats">
          <div><strong>{list.meta?.total ?? rows.length}</strong><span>cadastrados</span></div>
          <div><strong>{count((p) => p.effectiveStatus === "active")}</strong><span>ativos nesta página</span></div>
          <div><strong>{rows.filter((p) => liveIds ? liveIds.has(p.id) : p.online).length}</strong><span>online agora (na página)</span></div>
          {pending > 0 && <div className="warn"><strong>{pending}</strong><span>aguardando aprovação nesta página</span></div>}
          <div><strong>{count((p) => ["suspended", "blocked"].includes(p.effectiveStatus) && !isPending(p))}</strong><span>suspensos ou bloqueados nesta página</span></div>
        </div>
      )}
      {scope === "content" && <PartnerPreRegistrations onOpenPartner={setOpenId} onRefresh={list.reload} refreshKey={inviteRevision} />}
      <div className="toolbar">
        <button type="button" className="btn" onClick={list.reload} disabled={list.loading}>Atualizar lista</button>
        <input placeholder={cfg.search} value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={list.params.status} onChange={(e) => list.filter({ status: e.target.value })}>
          <option value="">Todos os status</option><option value="pending">Aguardando aprovação</option><option value="active">Ativos</option><option value="expired">Expirados</option><option value="suspended">Suspensos</option><option value="blocked">Bloqueados</option><option value="cancelled">Cancelados</option>
        </select>
      </div>
      <Table>
        <thead><tr><th>{scope === "reseller" ? "Revenda" : "Parceiro"}</th><th>Status</th><th>Portal</th><th>{cfg.billing}</th><th>Dispositivos</th><th>Término</th><th>Ações</th></tr></thead>
        <tbody>{rows.map((p) => (
          <tr key={p.id} className="click" onClick={() => setOpenId(p.id)}>
            <td><div className="partner-list-identity">
              <PartnerAvatar name={p.name} avatarData={p.avatarVersion ? avatarCache.get(`${p.id}:${p.avatarVersion}`) : null} />
              <div className="partner-list-name"><strong>{p.name}</strong><div className="muted">{p.slug}{p.kind === "both" && <span className="kind both">{cfg.also}</span>}</div></div>
            </div></td>
            <td>{isPending(p) ? <Badge status="pending" label="Novo cadastro" /> : <Badge status={p.effectiveStatus} />}</td>
            <td>
              <PortalPresence
                online={liveIds ? liveIds.has(p.id) : p.online}
                lastActivityAt={p.lastPortalActivityAt}
                disconnectedAt={disconnectedAt[p.id]}
                now={clock}
              />
            </td>
            <td>{scope === "content" ? fmtMoney(p.monthlyFeeCents || 0) : MODELS[p.billingModel]}</td><td>{p.deviceCount}{p.deviceLimit != null ? `/${p.deviceLimit}` : ""}</td><td>{fmtDate(p.endsAt)}</td>
            <td><div className="partner-direct-actions">
              <button type="button" className="btn sm primary" onClick={event => { event.stopPropagation(); setEditingPartner(p); }}>Editar</button>
              <button type="button" className="btn sm" onClick={event => { event.stopPropagation(); setOpenId(p.id); }}>Gerenciar</button>
            </div></td>
          </tr>))}</tbody>
      </Table>
      <Empty loading={list.loading} error={list.error} count={rows.length} />
      {list.meta?.totalPages > 1 && <Pager meta={list.meta} onPage={list.setPage} />}
      {creating && <PartnerForm scope={scope} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); changed(); }} />}
      {editingPartner && <PartnerForm partner={editingPartner} scope={scope} onClose={() => setEditingPartner(null)} onSaved={() => { setEditingPartner(null); changed(); }} />}
      {openId && <PartnerDetailModal id={openId} role="superadmin" basePath="/admin/partners" onClose={() => setOpenId(null)} onChanged={changed} renderEditForm={({partner,onClose,onSaved}) => <PartnerForm partner={partner} scope={partner.kind === "content" ? "content" : "reseller"} onClose={onClose} onSaved={onSaved}/>} />}
    </>
  );
}

function PartnerAvatar({ name, avatarData }) {
  const initials = String(name || "?").trim().split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]).join("").toLocaleUpperCase("pt-BR") || "?";
  return <span className="partner-list-avatar" aria-hidden="true">
    {avatarData ? <img src={avatarData} alt="" loading="lazy" decoding="async" /> : <span>{initials}</span>}
  </span>;
}

function PortalPresence({ online, lastActivityAt, disconnectedAt, now }) {
  // Em caso de reconexão perdida, a última atividade persistida pode ser mais nova que o evento local.
  const eventTime = disconnectedAt ? new Date(disconnectedAt).getTime() : 0;
  const activityTime = lastActivityAt ? new Date(lastActivityAt).getTime() : 0;
  const since = disconnectedAt && eventTime >= activityTime ? disconnectedAt : lastActivityAt;
  const duration = offlineDuration(since, now);
  const tooltip = online
    ? "Conectado ao portal agora"
    : disconnectedAt
      ? `Desconectado em: ${fmtDateTime(disconnectedAt)}`
      : lastActivityAt
        ? `Tempo aproximado desde a última atividade: ${fmtDateTime(lastActivityAt)}`
        : "Nenhuma atividade registrada para esta conta";
  return (
    <span className="partner-portal-presence" title={tooltip}>
      <span className={`partner-portal-dot ${online ? "connected" : "disconnected"}`} aria-hidden="true" />
      <span className="partner-portal-info">
        <strong>{online ? "Online" : "Offline"}</strong>
        {!online && <small>{duration || "Sem atividade registrada"}</small>}
      </span>
    </span>
  );
}

export default function Partners(props) { return <PartnersList scope="content" {...props} />; }
export function Resellers(props) { return <PartnersList scope="reseller" {...props} />; }

// Faixas: uma por linha, "limite:valor" (ex.: 50:200,00). Sem limite: "*:900,00".
const tiersToText = (t = []) => t.map((x) => `${x.upTo ?? "*"}:${(x.amountCents / 100).toFixed(2).replace(".", ",")}`).join("\n");
const textToTiers = (s) => s.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
  const [a, b] = l.split(":");
  return { upTo: a.trim() === "*" ? null : Number(a), amountCents: toCents(b ?? "") };
});

function PartnerForm({ partner, scope, onClose, onSaved }) {
  const run = useAction();
  const edit = !!partner;
  const [f, setF] = useState({
    name: partner?.name || "", slug: partner?.slug || "", contactName: partner?.contactName || "", contactEmail: partner?.contactEmail || "", contactPhone: partner?.contactPhone || "",
    startsAt: dateInput(partner?.startsAt) || dateInput(new Date()), endsAt: dateInput(partner?.endsAt) || dateInput(new Date(new Date().setMonth(new Date().getMonth() + (scope === "content" ? 1 : 12)))),
    billingModel: partner?.billingModel || (scope === "reseller" ? "none" : "fixed"), monthly: partner ? String(partner.monthlyFeeCents / 100) : "", perDevice: partner ? String(partner.perDeviceCents / 100) : "",
    minFee: partner ? String(partner.minFeeCents / 100) : "", tiers: tiersToText(partner?.tiers), deviceLimit: partner?.deviceLimit ?? "",
    dueDay: partner?.dueDay || 10, graceDays: partner?.graceDays ?? 5, suspendPolicy: partner?.suspendPolicy || "auto_after_grace", kind: partner?.kind || SCOPES[scope].defaultKind,
    portalName: "", portalEmail: "", portalPassword: "",
    activationLimit: partner?.deviceLimit == null ? "" : String(partner.deviceLimit),
    unlimitedActivations: partner?.deviceLimit == null,
    dnsLimit: "0", // 0 = sem limite, definido pela DeltaTV
    licensePolicy: "partner_only",
  });
  const set = (k) => (e) => setF(previous => ({ ...previous, [k]: e.target.value }));
  const [contractLoaded,setContractLoaded] = useState(!edit || scope !== 'content');
  const [contractError,setContractError] = useState('');
  const [legacyContractMode,setLegacyContractMode] = useState('');
  const [convertLegacy,setConvertLegacy] = useState(false);
  // A edição sempre lê o contrato efetivo, nunca presume que o limite de
  // dispositivos da listagem equivale ao contrato de conteúdo.
  useEffect(() => {
    if(!edit || scope !== 'content') return;
    let live=true;
    Promise.all([api(`/admin/partners/${partner.id}/commercial`),api(`/admin/partners/${partner.id}/service-plan`)])
      .then(([commercial, plan]) => {
        if(!live)return;
        const terms=commercial.terms||{};
        if(!['fixed_limited','fixed_unlimited'].includes(terms.mode))setLegacyContractMode(terms.mode||'legacy');
        const selectedLimit=terms.mode==='fixed_limited' ? terms.activationLimit : null;
        const dns=plan.overrides?.maxServersOverride ?? plan.features?.maxServers ?? 0;
        setF(old=>({...old,
          activationLimit:selectedLimit===null?'':String(selectedLimit),
          unlimitedActivations:selectedLimit===null,
          dnsLimit:String(dns),
          licensePolicy:terms.licensePolicy || 'partner_only',
          monthly:String((terms.fixedFeeCents ?? partner.monthlyFeeCents ?? 0)/100),
        }));
        setContractLoaded(true);
      }).catch(err=>{if(live)setContractError(err.message||'Não foi possível carregar o contrato.');});
    return()=>{live=false};
  },[edit,scope,partner?.id]);
  const { toast } = useUi();
  const submit = async () => {
    if(scope==='content' && !contractLoaded) return toast(contractError||'Carregando contrato de serviço.', 'bad');
    if(scope==='content') {
      const fee=toCents(f.monthly||'0');
      const max=f.unlimitedActivations?null:Number(f.activationLimit);
      const dns=Number(f.dnsLimit);
      if(fee===null || fee<0 || (!f.unlimitedActivations && (!String(f.activationLimit).trim() || !Number.isInteger(max)||max<0)) ||
        !String(f.dnsLimit).trim() || !Number.isInteger(dns)||dns<0) return toast('Confira mensalidade, DNS e limite de ativações.', 'bad');
      if(!f.name.trim() || !f.slug.trim()) return toast('Informe empresa e identificador.', 'bad');
      if(!edit && f.portalEmail && (!f.portalPassword || f.portalPassword.length<12)) return toast('A senha inicial deve ter pelo menos 12 caracteres.', 'bad');
      const input={
        name:f.name.trim(),slug:f.slug.trim(),contactName:f.contactName||null,contactEmail:f.contactEmail||null,contactPhone:f.contactPhone||null,
        startsAt:spDateToIso(f.startsAt),endsAt:spDateToIso(f.endsAt,true),
        ...(edit && legacyContractMode && !convertLegacy ? {} : {
          billingModel:'fixed',monthlyFeeCents:fee,deviceLimit:max,kind:edit?partner.kind:'content',
          dueDay:Number(f.dueDay),graceDays:Number(f.graceDays),suspendPolicy:f.suspendPolicy,
          serviceContract:{activationLimit:max,dnsLimit:dns,licensePolicy:f.licensePolicy},
        }),
      };
      if(!edit && f.portalEmail) input.portalUser={name:f.portalName||f.name,email:f.portalEmail,password:f.portalPassword};
      const result=await run(()=>api(edit?`/admin/partners/${partner.id}`:'/admin/partners',
        {method:edit?'PATCH':'POST',body:input}),edit?'Contrato e cadastro atualizados.':'Parceiro criado com contrato de serviço.');
      if(result)onSaved(result);
      return;
    }

    const money = { monthlyFeeCents: toCents(f.monthly || 0), perDeviceCents: toCents(f.perDevice || 0), minFeeCents: toCents(f.minFee || 0) };
    const tiers = f.billingModel === "tiered" ? textToTiers(f.tiers) : [];
    if (Object.values(money).includes(null) || tiers.some((t) => t.amountCents === null || Number.isNaN(t.upTo))) {
      return toast("Há um valor inválido em R$ (ou nas faixas). Use números, ex.: 200,00.", "bad");
    }
    const body = {
      name: f.name, contactName: f.contactName || null, contactEmail: f.contactEmail || null, contactPhone: f.contactPhone || null, billingModel: f.billingModel,
      ...money,
      tiers, deviceLimit: f.deviceLimit === "" ? null : Number(f.deviceLimit),
      dueDay: Number(f.dueDay), graceDays: Number(f.graceDays), suspendPolicy: f.suspendPolicy, kind: f.kind,
    };
    if (edit) {
      // Envia APENAS campos modificados. Um parceiro com Pacote de Serviço possui
      // contrato técnico ativo: reenviar preços/modelo antigos na mesma requisição
      // provoca conflito e impede editar até telefone ou nome.
      const updates = {};
      for (const field of ["name", "contactName", "contactEmail", "contactPhone", "billingModel", "deviceLimit", "dueDay", "graceDays", "suspendPolicy", "kind"]) {
        const next = body[field];
        const previous = partner[field] ?? (next === null ? null : undefined);
        if (next !== previous) updates[field] = next;
      }
      for (const field of ["monthlyFeeCents", "perDeviceCents", "minFeeCents"]) {
        if (body[field] !== Number(partner[field] ?? 0)) updates[field] = body[field];
      }
      if (f.billingModel === "tiered" && f.tiers !== tiersToText(partner.tiers)) updates.tiers = tiers;
      if (f.slug !== partner.slug) updates.slug = f.slug;
      if (f.startsAt !== dateInput(partner.startsAt)) updates.startsAt = spDateToIso(f.startsAt);
      if (f.endsAt !== dateInput(partner.endsAt)) updates.endsAt = spDateToIso(f.endsAt, true);
      if (!Object.keys(updates).length) return toast("Nenhuma alteração para salvar.");
      for (const key of Object.keys(body)) delete body[key];
      Object.assign(body, updates);
    } else {
      Object.assign(body, { slug: f.slug, startsAt: spDateToIso(f.startsAt), endsAt: spDateToIso(f.endsAt, true) });
      if (f.portalEmail) body.portalUser = { name: f.portalName || f.name, email: f.portalEmail, password: f.portalPassword };
    }
    const r = await run(() => api(edit ? `/admin/partners/${partner.id}` : "/admin/partners", { method: edit ? "PATCH" : "POST", body }), SCOPES[scope].saved);
    if (r) onSaved(r);
  };
  if(scope==='content') return <Modal title={edit?'Editar parceiro e contrato':'Novo parceiro'} onClose={onClose} wide>
    <p className="muted">Informe os dados da empresa e o contrato. As configurações menos frequentes estão em opções avançadas.</p>
    {contractError&&<p className="alert" role="alert">{contractError}</p>}
    {!contractLoaded?<p role="status">Carregando contrato…</p>:<>
      <h3>Dados do parceiro</h3>
      <div className="row"><Field label="Empresa / parceiro"><input required value={f.name} onChange={set('name')}/></Field>
      <Field label="Identificador"><input required value={f.slug} onChange={set('slug')}/></Field></div>
      <div className="row"><Field label="Responsável"><input value={f.contactName} onChange={set('contactName')}/></Field>
      <Field label="E-mail do contato"><input type="email" value={f.contactEmail} onChange={set('contactEmail')}/></Field></div>
      <Field label="Telefone"><input value={f.contactPhone} onChange={set('contactPhone')}/></Field>
      <h3>Contrato de serviços</h3>
      {edit&&legacyContractMode&&<div className="notice">
        Contrato antigo: {legacyContractMode==='credits'?'pré-pago por créditos':'regras legadas'}.
        {legacyContractMode==='credits'
          ? ' Para preservar créditos, este formulário salva apenas os dados cadastrais. A migração exige conciliar o saldo antigo.'
          : ' Para manter as regras antigas, deixe a conversão desmarcada.'}
        {legacyContractMode!=='credits'&&<label style={{display:'flex',alignItems:'center',gap:8,marginTop:10}}>
          <input type="checkbox" checked={convertLegacy} onChange={e=>setConvertLegacy(e.target.checked)}/>
          Migrar esta conta para contrato mensal com os limites informados
        </label>}
      </div>}
      {(!edit || !legacyContractMode || convertLegacy) && <>
      <div className="row"><Field label="Mensalidade negociada (R$)" hint="R$ 0,00 para parceiro gratuito"><input inputMode="decimal" value={f.monthly} onChange={set('monthly')}/></Field>
      <Field label="Limite de DNS por código" hint="0 = sem limite"><input type="number" min="0" step="1" value={f.dnsLimit} onChange={set('dnsLimit')}/></Field></div>
      <label className="row" style={{alignItems:'center',gap:10,marginBottom:10}}><input type="checkbox" checked={f.unlimitedActivations} onChange={e=>setF(old=>({...old,unlimitedActivations:e.target.checked}))}/> Ativações ilimitadas</label>
      {!f.unlimitedActivations&&<Field label="Limite de ativações"><input type="number" min="0" step="1" value={f.activationLimit} onChange={set('activationLimit')}/></Field>}
      <div className="row"><Field label="Início"><input type="date" value={f.startsAt} onChange={set('startsAt')}/></Field>
      <Field label="Vencimento"><input type="date" value={f.endsAt} onChange={set('endsAt')}/></Field></div>
      <details className="partner-contract-advanced"><summary>Opções avançadas de cobrança e vencimento</summary>
        <p className="muted">Normalmente não precisa alterar. Padrão: cobrança no dia {f.dueDay}, com {f.graceDays} dia(s) de tolerância.</p>
        <div className="row"><Field label="Dia de cobrança"><input type="number" min="1" max="28" value={f.dueDay} onChange={set('dueDay')}/></Field>
        <Field label="Tolerância (dias)"><input type="number" min="0" max="90" value={f.graceDays} onChange={set('graceDays')}/></Field></div>
        <Field label="Quando a parceria vencer"><select value={f.licensePolicy} onChange={set('licensePolicy')}>
          <option value="partner_only">Bloquear também as ativações dependentes</option>
          <option value="standard">Manter a política padrão das licenças independentes</option>
        </select></Field>
      </details>
      </>}
      {!edit&&<><h3>Acesso ao Painel do Parceiro (opcional)</h3>
        <div className="row"><Field label="Nome do usuário"><input value={f.portalName} onChange={set('portalName')}/></Field>
        <Field label="E-mail de login"><input type="email" value={f.portalEmail} onChange={set('portalEmail')}/></Field></div>
        {f.portalEmail&&<Field label="Senha inicial (mínimo 12 caracteres)"><input type="password" minLength="12" value={f.portalPassword} onChange={set('portalPassword')}/></Field>}
      </>}
      <div className="actions"><button type="button" className="btn" onClick={onClose}>Cancelar</button>
      <button type="button" className="btn primary" onClick={submit}>{edit?'Salvar alterações':'Criar parceiro'}</button></div>
    </>}
  </Modal>;
  return (
    <Modal title={edit ? `Editar ${SCOPES[scope].noun}` : SCOPES[scope].newLabel} onClose={onClose} wide>
      {edit && scope === "content" && <div className="notice">Dados cadastrais são editados aqui. Para ajustar recursos e permissão de revenda, use <b>Gerenciar → Plano e permissões</b>. Isso evita alterações conflitantes no contrato.</div>}
      <div className="row"><Field label="Nome / empresa"><input value={f.name} onChange={set("name")} /></Field><Field label="Identificador (slug)" hint="minúsculas, números e hífens"><input value={f.slug} onChange={set("slug")} /></Field></div>
      <div className="row"><Field label="Contato"><input value={f.contactName} onChange={set("contactName")} /></Field><Field label="E-mail do contato"><input value={f.contactEmail} onChange={set("contactEmail")} /></Field></div>
      <Field label="Telefone do contato"><input value={f.contactPhone} onChange={set("contactPhone")} /></Field>
      <div className="row"><Field label="Início da parceria"><input type="date" value={f.startsAt} onChange={set("startsAt")} /></Field><Field label="Término da parceria"><input type="date" value={f.endsAt} onChange={set("endsAt")} /></Field></div>
      <div className="row">
        <Field label="Modelo de cobrança" hint={f.billingModel === "none" ? "Sem mensalidade: nenhuma cobrança é gerada. Indicado para revendedor que só compra licenças." : undefined}><select value={f.billingModel} onChange={set("billingModel")}>{Object.entries(MODELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Limite de dispositivos" hint="Vazio = ilimitado"><input type="number" min="0" value={f.deviceLimit} onChange={set("deviceLimit")} /></Field>
      </div>
      {f.billingModel === "fixed" && <Field label="Mensalidade (R$)"><input value={f.monthly} onChange={set("monthly")} /></Field>}
      {f.billingModel === "per_device" && <div className="row"><Field label="Valor por dispositivo (R$)"><input value={f.perDevice} onChange={set("perDevice")} /></Field><Field label="Mínimo mensal (R$)"><input value={f.minFee} onChange={set("minFee")} /></Field></div>}
      {f.billingModel === "tiered" && <Field label="Faixas" hint='Uma por linha: "até quantos dispositivos:valor". Última faixa sem limite: "*:valor"'><textarea rows={4} value={f.tiers} onChange={set("tiers")} placeholder={"50:200,00\n200:500,00\n*:900,00"} /></Field>}
      {f.billingModel !== "none" && <div className="row">
        <Field label="Dia de vencimento (1–28)"><input type="number" min="1" max="28" value={f.dueDay} onChange={set("dueDay")} /></Field>
        <Field label="Tolerância (dias)"><input type="number" min="0" value={f.graceDays} onChange={set("graceDays")} /></Field>
      </div>}
      <Field label="Tipo de cadastro" hint="Revenda e 'Parceiro e revenda' têm estoque, clientes e podem editar dispositivos por MAC no portal; tudo fica auditado. Mudar o tipo move o cadastro para a outra tela."><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value, ...(!edit && e.target.value === "reseller" && f.billingModel === "fixed" ? { billingModel: "none" } : {}) })}><option value="content">{KIND_LABEL.content}</option><option value="reseller">{KIND_LABEL.reseller}</option><option value="both">{KIND_LABEL.both}</option></select></Field>
      {f.billingModel !== "none" && <Field label="Política de inadimplência"><select value={f.suspendPolicy} onChange={set("suspendPolicy")}><option value="auto_after_grace">Suspender automaticamente após a tolerância</option><option value="manual">Somente manual</option></select></Field>}
      {!edit && <><h3>Acesso ao portal (opcional)</h3><div className="row"><Field label="Nome"><input value={f.portalName} onChange={set("portalName")} /></Field><Field label="E-mail"><input value={f.portalEmail} onChange={set("portalEmail")} /></Field></div><Field label="Senha inicial (mín. 12 caracteres)"><input type="password" value={f.portalPassword} onChange={set("portalPassword")} /></Field></>}
      <div className="actions"><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={submit}>Salvar</button></div>
    </Modal>
  );
}

