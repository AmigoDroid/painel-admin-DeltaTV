import PartnerPicker from "../PartnerPicker.jsx";
import { useEffect, useState } from "react";
import { api, getAuth } from "../api.js";
import { Badge, Empty, Field, Modal, PasswordInput, Pager, Table, fmtDateTime, useAction, useDebounced, useList, RowMenu } from "../ui.jsx";

/**
 * Usuários da plataforma. superadmin gerencia todos; admin gerencia só os usuários do portal de revendas/parceiros
 * (o backend impõe essa regra; aqui o formulário apenas não oferece o que seria recusado).
 * `partnerId` fixo = aba dentro do detalhe de uma revenda.
 */
const ROLE = { superadmin: "Superadmin", admin: "Admin", support: "Suporte", partner: "Portal do parceiro" };

const isLocked = (u) => !!u.lockedUntil && new Date(u.lockedUntil) > new Date();

/** Sessões abertas de um usuário: encerra uma ou todas sem alterar a conta. */
function SessionsModal({ user, me, onClose }) {
  const run = useAction();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const load = async () => {
    try { setRows((await api(`/admin/users/${user.id}/sessions`)).data); setError(""); }
    catch (e) { setError(e.message); setRows([]); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user.id]);
  const revokeOne = async (s) => {
    if (!window.confirm("Encerrar esta sessão?")) return;
    if (await run(() => api(`/admin/users/${user.id}/sessions/${s.id}`, { method: "DELETE" }), "Sessão encerrada.")) void load();
  };
  const revokeAll = async () => {
    if (!window.confirm(`Encerrar TODAS as sessões de ${user.email}?${user.id === me?.id ? " Isso também desconecta você." : ""}`)) return;
    if (await run(() => api(`/admin/users/${user.id}/sessions`, { method: "DELETE" }), "Todas as sessões foram encerradas.")) void load();
  };
  return (
    <Modal title={`Sessões de ${user.name}`} onClose={onClose}>
      {error && <p className="error">{error}</p>}
      {rows === null && <p className="muted">Carregando…</p>}
      {rows && !error && rows.length === 0 && <p className="muted">Nenhuma sessão aberta.</p>}
      {rows && rows.length > 0 && (
        <Table>
          <thead><tr><th>Início</th><th>IP</th><th>Dispositivo / navegador</th><th>Expira</th><th /></tr></thead>
          <tbody>{rows.map((s) => (
            <tr key={s.id}>
              <td>{fmtDateTime(s.createdAt)}{s.current && <span className="muted"> (esta)</span>}</td><td>{s.ip || "—"}</td>
              <td title={s.userAgent || ""}>{(s.userAgent || "—").slice(0, 60)}</td><td>{fmtDateTime(s.expiresAt)}</td>
              <td className="actions"><button className="btn" onClick={() => revokeOne(s)}>Encerrar</button></td>
            </tr>))}</tbody>
        </Table>
      )}
      <div className="actions"><button className="btn" onClick={onClose}>Fechar</button>
        <button className="btn danger" disabled={!rows || rows.length === 0} onClick={revokeAll}>Encerrar todas</button></div>
    </Modal>
  );
}

export function UsersPanel({ partnerId: fixedPartnerId }) {
  const me = getAuth()?.user;
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const list = useList("/admin/users", { q: "", role: "", status: "", partnerId: fixedPartnerId || "" });
  const [form, setForm] = useState(null);
  const [sessionsOf, setSessionsOf] = useState(null);
  const sendResetAction = useAction();
  const unlockAction = useAction();
  useEffect(() => { list.filter({ q: dq }); /* eslint-disable-next-line */ }, [dq]);
  const full = me?.role === "superadmin";

  return (
    <>
      <div className="toolbar">
        <input placeholder="Buscar por nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
        {full && !fixedPartnerId && <select value={list.params.role} onChange={(e) => list.filter({ role: e.target.value })}><option value="">Todas as funções</option>{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
        <select value={list.params.status} onChange={(e) => list.filter({ status: e.target.value })}><option value="">Todos os status</option><option value="active">Ativos</option><option value="disabled">Desativados</option></select>
        <button className="btn primary" onClick={() => setForm({})}>Novo usuário</button>
      </div>
      <Table>
        <thead><tr><th>Nome</th><th>E-mail</th><th>Função</th>{!fixedPartnerId && <th>Revenda / parceiro</th>}<th>Status</th><th>Criado em</th><th /></tr></thead>
        <tbody>{list.data.map((u) => (
          <tr key={u.id}>
            <td>{u.name}{u.id === me?.id && <span className="muted"> (você)</span>}</td><td>{u.email}</td><td>{ROLE[u.role] || u.role}</td>
            {!fixedPartnerId && <td>{u.partnerName || "—"}</td>}
            <td><Badge status={u.status === "active" ? "active" : "disabled"} label={u.status === "active" ? "Ativo" : "Desativado"} />{isLocked(u) && <> <Badge status="blocked" label={`Login bloqueado até ${fmtDateTime(u.lockedUntil)}`} /></>}</td>
            <td>{fmtDateTime(u.createdAt)}</td>
            <td className="actions">
              <RowMenu items={[
                { label: "Editar", onClick: () => setForm({ user: u }) },
                { label: "Sessões abertas", onClick: () => setSessionsOf(u) },
                ...(isLocked(u) ? [{ label: "Desbloquear login", onClick: async () => {
                  if (await unlockAction(() => api(`/admin/users/${u.id}/unlock`, { method: "POST" }), "Login desbloqueado.")) list.reload();
                } }] : []),
                ...(u.status === "active" ? [{ label: "Enviar link de redefinição de senha", onClick: () => {
                  if (window.confirm(`Enviar um link de redefinição para ${u.email}? O link expira em 30 minutos.`)) {
                    void sendResetAction(() => api(`/admin/users/${u.id}/send-password-reset`, { method: "POST" }), "Link enviado para o e-mail cadastrado.");
                  }
                } }] : []),
              ]} />
            </td>
          </tr>))}</tbody>
      </Table>
      <Empty loading={list.loading} error={list.error} count={list.data.length} />
      <Pager meta={list.meta} onPage={list.setPage} />
      {sessionsOf && <SessionsModal user={sessionsOf} me={me} onClose={() => setSessionsOf(null)} />}
      {form && <UserForm {...form} me={me} full={full} fixedPartnerId={fixedPartnerId} onClose={() => setForm(null)} onSaved={() => { setForm(null); list.reload(); }} />}
    </>
  );
}

function UserForm({ user, me, full, fixedPartnerId, onClose, onSaved }) {
  const run = useAction();
  const edit = !!user;
  const self = user?.id === me?.id;
  const [f, setF] = useState({
    name: user?.name || "", email: user?.email || "", role: user?.role || (full && !fixedPartnerId ? "admin" : "partner"),
    partnerId: user?.partnerId || fixedPartnerId || "", status: user?.status || "active", password: "",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const isPartner = f.role === "partner";
  const roleLocked = !full || !!fixedPartnerId || self;
  const submit = async () => {
    const body = { name: f.name, email: f.email, role: f.role, partnerId: isPartner ? f.partnerId : null, status: f.status };
    if (f.password) body.password = f.password;
    if (!edit) { body.password = f.password; if (!isPartner) delete body.partnerId; if (isPartner && !body.partnerId) return; delete body.status; }
    const r = await run(() => api(edit ? `/admin/users/${user.id}` : "/admin/users", { method: edit ? "PATCH" : "POST", body }), "Usuário salvo.");
    if (r) onSaved();
  };
  return (
    <Modal title={edit ? "Editar usuário" : "Novo usuário"} onClose={onClose}>
      <div className="row"><Field label="Nome"><input value={f.name} onChange={set("name")} /></Field><Field label="E-mail"><input type="email" value={f.email} onChange={set("email")} /></Field></div>
      <div className="row">
        <Field label="Função" hint={self ? "Você não pode alterar a própria função." : undefined}>
          <select value={f.role} onChange={set("role")} disabled={roleLocked}>{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </Field>
        {isPartner && !fixedPartnerId && (
          <Field label="Revenda / parceiro"><PartnerPicker value={f.partnerId} onChange={(v) => setF((f) => ({ ...f, partnerId: v }))} /></Field>
        )}
      </div>
      {edit && <Field label="Status" hint={self ? "Você não pode desativar a própria conta." : "Desativar encerra as sessões abertas do usuário."}><select value={f.status} onChange={set("status")} disabled={self}><option value="active">Ativo</option><option value="disabled">Desativado</option></select></Field>}
      <Field label={edit ? "Nova senha (deixe vazio para manter)" : "Senha inicial (mín. 12 caracteres)"} hint={edit ? "Ao trocar senha, função, revenda ou e-mail, as sessões abertas do usuário são encerradas." : undefined}>
        <PasswordInput value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      </Field>
      <div className="actions"><button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={!f.name || !f.email || (!edit && f.password.length < 12) || (isPartner && !f.partnerId)} onClick={submit}>Salvar</button></div>
    </Modal>
  );
}

export default function Users() {
  return (
    <>
      <div className="page-head"><h2>Usuários</h2></div>
      <UsersPanel />
    </>
  );
}
