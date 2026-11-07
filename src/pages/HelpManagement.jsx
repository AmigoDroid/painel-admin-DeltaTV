import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import "./help-management.css";

const SCREENS = ["home", "help", "profile", "servers", "codes", "devices", "licenses", "billing", "studio", "apps", "notifications"];
const TARGETS = [...SCREENS, "add-server", "new-code", "search-device"];
const TARGET_LABELS = { home: "Início", help: "Central de Ajuda", profile: "Minha conta", servers: "Servidores", codes: "Códigos", devices: "Dispositivos", licenses: "Licenças", billing: "Financeiro", studio: "Estúdio Visual", apps: "Aplicativos", notifications: "Notificações", "add-server": "Botão Adicionar servidor", "new-code": "Botão Novo código", "search-device": "Campo Buscar MAC" };
const empty = () => ({ slug: "", title: "", summary: "", category: "Geral", audience: "both", body: "", imageUrl: "", videoUrl: "", steps: [], sortOrder: 0, status: "draft", isOnboarding: false });
const editable = (v) => Object.fromEntries(Object.keys(empty()).map(k => [k, v[k] ?? empty()[k]]));
const categories = { both: "Ambos", content: "Parceiros de conteúdo", reseller: "Revendas" };

export default function HelpManagement() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("");
  const load = async () => { const r = await api("/admin/help"); setItems(r.data || []); };
  useEffect(() => { let active = true; api("/admin/help").then(r => { if (active) setItems(r.data || []); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  const start = (a) => { setEditId(a?.id || null); setForm(a ? editable(a) : empty()); setError(""); setMessage(""); };
  const patch = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const payload = { ...form, slug: form.slug.trim().toLowerCase(), sortOrder: Number(form.sortOrder) || 0, imageUrl: form.imageUrl || null, videoUrl: form.videoUrl || null };
      await api(editId ? `/admin/help/${editId}` : "/admin/help", { method: editId ? "PATCH" : "POST", body: payload });
      await load(); setForm(null); setEditId(null); setMessage("Tutorial salvo. Apenas guias publicados aparecem para os clientes.");
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const changeStatus = async (article, status) => {
    setBusy(true); setError("");
    try { await api(`/admin/help/${article.id}`, { method: "PATCH", body: { status } }); await load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const remove = async (a) => {
    if (!window.confirm(`Excluir definitivamente o tutorial "${a.title}"? O progresso dos usuários nesse guia também será apagado.`)) return;
    setBusy(true); setError("");
    try { await api(`/admin/help/${a.id}`, { method: "DELETE" }); await load(); if (editId === a.id) { setForm(null); setEditId(null); } }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const setStep = (i, k, value) => setForm(f => ({ ...f, steps: f.steps.map((s, j) => j === i ? { ...s, [k]: value || undefined } : s) }));
  const filtered = items.filter(a => `${a.title} ${a.category} ${a.summary} ${a.audience}`.toLowerCase().includes(filter.toLowerCase()));
  return <section className="hm15-main">
    <div className="hm15-hero"><div><span>GESTÃO DE CONTEÚDO</span><h2>Central de Ajuda</h2><p>Crie tutoriais e destaque os controles reais nos painéis de Parceiro e Revenda. O progresso é salvo individualmente.</p></div><button className="btn primary" type="button" onClick={() => start(null)}>+ Novo tutorial</button></div>
    {error && <p className="hm15-error" role="alert">{error}</p>}{message && <p className="hm15-success" role="status">{message}</p>}
    <div className="hm15-toolbar"><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar tutoriais…" aria-label="Buscar tutoriais"/><span>{items.length} guia(s) cadastrados</span></div>
    {loading ? <div className="hm15-empty">Carregando tutoriais…</div> : <div className="hm15-items">{filtered.map(a => <article key={a.id} className="hm15-item"><div className="hm15-item-head"><div><span className="hm15-category">{a.category} · {categories[a.audience]}</span><h3>{a.title}</h3><p>{a.summary}</p></div><span className={`hm15-status hm15-${a.status}`}>{({ draft: "Rascunho", published: "Publicado", disabled: "Desativado" })[a.status]}</span></div>
      <div className="hm15-item-foot"><small>{a.steps?.length || 0} etapa(s) · {a.slug}{a.isOnboarding ? " · Boas-vindas" : ""}</small><div className="hm15-buttons"><button type="button" className="btn sm" disabled={busy} onClick={() => start(a)}>Editar</button><button type="button" className="btn sm" disabled={busy} onClick={() => changeStatus(a, a.status === "published" ? "disabled" : "published")}>{a.status === "published" ? "Desativar" : "Publicar"}</button><button type="button" className="btn sm danger" disabled={busy} onClick={() => remove(a)}>Excluir</button></div></div>
    </article>)}{!filtered.length && <div className="hm15-empty">Nenhum tutorial encontrado.</div>}</div>}
    {form && <div className="hm15-cover" role="presentation"><form className="hm15-editor" onSubmit={save} aria-label="Editor de tutorial"><div className="hm15-editor-head"><div><span>EDITOR DE TUTORIAIS</span><h2>{editId ? "Editar tutorial" : "Novo tutorial"}</h2></div><button type="button" className="btn sm" onClick={() => setForm(null)} aria-label="Fechar editor">✕</button></div>
      <div className="hm15-editor-scroll"><div className="hm15-form-grid"><label>Título<input required minLength={3} maxLength={160} value={form.title} onChange={e => patch("title", e.target.value)}/></label><label>Identificador / URL curta<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} value={form.slug} onChange={e => patch("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))}/></label><label>Categoria<input required maxLength={60} value={form.category} onChange={e => patch("category", e.target.value)}/></label><label>Público<select value={form.audience} onChange={e => patch("audience", e.target.value)}><option value="both">Ambos</option><option value="content">Parceiro de conteúdo</option><option value="reseller">Revenda</option></select></label><label>Estado<select value={form.status} onChange={e => patch("status", e.target.value)}><option value="draft">Rascunho</option><option value="published">Publicado</option><option value="disabled">Desativado</option></select></label><label>Ordem<input type="number" min={-500} max={500} value={form.sortOrder} onChange={e => patch("sortOrder", Number(e.target.value))}/></label></div>
      <label>Resumo<input value={form.summary} required minLength={5} maxLength={360} onChange={e => patch("summary", e.target.value)}/></label>
      <label>Texto do guia (parágrafos separados por linhas)<textarea rows={6} required minLength={10} maxLength={10000} value={form.body} onChange={e => patch("body", e.target.value)}/></label>
      <div className="hm15-form-grid"><label>Imagem HTTPS (opcional)<input type="url" value={form.imageUrl || ""} placeholder="https://…/imagem.png" onChange={e => patch("imageUrl", e.target.value)}/></label><label>Vídeo HTTPS (opcional)<input type="url" value={form.videoUrl || ""} placeholder="https://…/video" onChange={e => patch("videoUrl", e.target.value)}/></label></div>
      <label className="hm15-check"><input type="checkbox" checked={form.isOnboarding} onChange={e => patch("isOnboarding", e.target.checked)}/> Mostrar como tutorial de boas-vindas</label>
      <div className="hm15-steps-head"><div><h3>Passo a passo interativo</h3><p>Use somente os destinos disponíveis. O sistema posiciona os destaques automaticamente.</p></div><button type="button" className="btn" disabled={form.steps.length >= 16} onClick={() => patch("steps", [...form.steps, { title: "Nova etapa", body: "Explique aqui o que o usuário deve fazer.", target: "help", screen: "help" }])}>+ Adicionar etapa</button></div>
      {form.steps.map((s, i) => <div className="hm15-step" key={i}><div className="hm15-step-bar"><strong>Etapa {i + 1}</strong><div><button type="button" className="btn sm" disabled={i === 0} onClick={() => patch("steps", form.steps.map((x, j) => j === i - 1 ? form.steps[i] : j === i ? form.steps[i - 1] : x))}>↑</button><button type="button" className="btn sm" disabled={i === form.steps.length - 1} onClick={() => patch("steps", form.steps.map((x, j) => j === i + 1 ? form.steps[i] : j === i ? form.steps[i + 1] : x))}>↓</button><button type="button" className="btn sm danger" onClick={() => patch("steps", form.steps.filter((_, j) => j !== i))}>Remover</button></div></div><label>Título<input required maxLength={120} value={s.title} onChange={e => setStep(i, "title", e.target.value)}/></label><label>Instrução<textarea rows={2} required minLength={5} maxLength={900} value={s.body} onChange={e => setStep(i, "body", e.target.value)}/></label><div className="hm15-form-grid"><label>Tela a abrir<select value={s.screen || ""} onChange={e => setStep(i, "screen", e.target.value)}><option value="">Não navegar</option>{SCREENS.map(t => <option key={t} value={t}>{TARGET_LABELS[t]}</option>)}</select></label><label>Controle a destacar<select value={s.target || ""} onChange={e => setStep(i, "target", e.target.value)}><option value="">Sem destaque</option>{TARGETS.map(t => <option key={t} value={t}>{TARGET_LABELS[t]}</option>)}</select></label></div></div>)}
      </div><div className="hm15-editor-footer"><button type="button" className="btn" onClick={() => setForm(null)}>Cancelar</button><button type="submit" className="btn primary" disabled={busy}>{busy ? "Salvando…" : "Salvar tutorial"}</button></div>
    </form></div>}
  </section>;
}
