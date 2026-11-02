import { useEffect, useState } from "react";
import { api, getAuth } from "../api.js";
import { Empty, Field, LoadError, Modal, Pager, Table, fmtMoney, toCents, useDebounced } from "../ui.jsx";
import ContentContract from "./ContentContract.jsx";
import ServicePlan from "./ServicePlan.jsx";
import "./plans-pricing.css";

const BILLING_NAMES = { none: "Sem mensalidade", fixed: "Mensalidade fixa", per_device: "Por dispositivo", tiered: "Por faixa" };
const CONTRACT_NAMES = { legacy: "Regras anteriores", credits: "Pré-pago por créditos", fixed_unlimited: "Valor fixo · ilimitado", fixed_limited: "Valor fixo · limitado" };
const money = (n) => fmtMoney(n ?? 0);

function contractPrice(p) {
  if (p.contractMode && p.contractMode !== "legacy") {
    if (p.contractMode === "credits") return `${p.creditsPerActivation ?? 1} crédito(s)/ativação`;
    if (p.contractMode.startsWith("fixed_")) return `${money(p.fixedFeeCents)} / mês`;
  }
  if (p.billingModel === "fixed") return `${money(p.monthlyFeeCents)} / mês`;
  if (p.billingModel === "per_device") return `${money(p.perDeviceCents)} / dispositivo (mín. ${money(p.minFeeCents)})`;
  if (p.billingModel === "tiered") return "Por faixa · consulte as condições";
  return "Sem mensalidade";
}

function ResellerBillingEditor({ partner, onSaved }) {
  const [model, setModel] = useState(partner.billingModel);
  const [monthly, setMonthly] = useState((partner.monthlyFeeCents / 100).toFixed(2).replace(".", ","));
  const [perDevice, setPerDevice] = useState((partner.perDeviceCents / 100).toFixed(2).replace(".", ","));
  const [minimum, setMinimum] = useState((partner.minFeeCents / 100).toFixed(2).replace(".", ","));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const save = async (event) => {
    event.preventDefault();
    const amounts = [monthly, perDevice, minimum].map(toCents);
    if (amounts.some((v) => v == null || v < 0)) return setErr("Confira os valores em reais.");
    setBusy(true); setErr(""); setNotice("");
    try {
      await api(`/admin/partners/${partner.id}`, { method: "PATCH", body: {
        billingModel: model, monthlyFeeCents: amounts[0], perDeviceCents: amounts[1], minFeeCents: amounts[2],
      } });
      setNotice("Valores da revenda salvos com sucesso.");
      onSaved();
    } catch (error) { setErr(error.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={save} className="pricing-editor">
      <p className="muted">Condições de faturamento da revenda. Os planos técnicos são configurados na aba ao lado.</p>
      <Field label="Modelo de cobrança"><select value={model} onChange={(e) => setModel(e.target.value)}>
        <option value="none">Sem mensalidade</option><option value="fixed">Mensalidade fixa</option><option value="per_device">Por dispositivo</option>
        <option value="tiered" disabled={model !== "tiered"}>Por faixas (edite em Revendas)</option>
      </select></Field>
      {model === "fixed" && <Field label="Valor mensal (R$)"><input inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} required /></Field>}
      {model === "per_device" && <div className="pricing-form-grid">
        <Field label="Por dispositivo (R$)"><input inputMode="decimal" value={perDevice} onChange={(e) => setPerDevice(e.target.value)} required /></Field>
        <Field label="Mínimo mensal (R$)"><input inputMode="decimal" value={minimum} onChange={(e) => setMinimum(e.target.value)} required /></Field>
      </div>}
      {model === "tiered" && <p className="muted">A cobrança por faixas continua configurável em Revendas → Editar condições.</p>}
      {err && <p className="error" role="alert">{err}</p>}{notice && <p role="status" className="pricing-success">{notice}</p>}
      <button className="btn primary" disabled={busy || model === "tiered"} type="submit">{busy ? "Salvando…" : "Salvar valores"}</button>
    </form>
  );
}

function ContractModal({ partner, onClose, reload }) {
  const [tab, setTab] = useState("commercial");
  const content = partner.kind !== "reseller";
  return <Modal wide title={`Condições · ${partner.name}`} onClose={onClose}>
    <div className="tabs" role="tablist" aria-label="Detalhes do contrato">
      <button type="button" className={`tab ${tab === "commercial" ? "active" : ""}`} onClick={() => setTab("commercial")}>{content ? "Contrato e valores" : "Cobrança da revenda"}</button>
      <button type="button" className={`tab ${tab === "technical" ? "active" : ""}`} onClick={() => setTab("technical")}>Plano técnico e recursos</button>
    </div>
    {tab === "commercial" && (content ? <ContentContract partnerId={partner.id} /> : <ResellerBillingEditor key={partner.id} partner={partner} onSaved={reload} />)}
    {tab === "technical" && <ServicePlan partnerId={partner.id} />}
  </Modal>;
}

function ContractList() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(null);
  const debounced = useDebounced(query);
  useEffect(() => setPage(1), [debounced, kind]);
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    api("/admin/partners/contract-overview", { query: { q: debounced, kind, page, pageSize: 20 } })
      .then((value) => { if (!ignore) { setResult(value); setError(""); } })
      .catch((err) => { if (!ignore) { setError(err.message); setResult(null); } })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [debounced, kind, page, revision]);
  const reload = () => setRevision((r) => r + 1);
  return <>
    <p className="muted">Valores negociados por cadastro, sem carregar todos os parceiros de uma vez. Use <strong>Gerenciar</strong> para mudar o contrato e os recursos.</p>
    <div className="toolbar">
      <input aria-label="Buscar contratos" placeholder="Buscar parceiro ou revenda por nome ou código" value={query} onChange={(e) => setQuery(e.target.value)} />
      <select aria-label="Tipo de cadastro" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Todos</option><option value="content">Parceiros de conteúdo</option><option value="reseller">Revendas</option></select>
      <button className="btn" type="button" onClick={reload} disabled={loading}>Atualizar</button>
    </div>
    {error && <LoadError error={error} onRetry={reload} />}
    {result && <>
      <div className="pricing-count"><strong>{result.meta.total}</strong> cadastros encontrados</div>
      <Table><thead><tr><th>Cadastro</th><th>Plano de recursos</th><th>Modalidade</th><th>Valor negociado</th><th>Limite contratado</th><th>Ações</th></tr></thead>
      <tbody>{result.data.map((p) => <tr key={p.id}>
        <td><strong>{p.name}</strong><div className="muted">{p.slug} · {p.kind === "reseller" ? "Revenda" : p.kind === "both" ? "Parceiro + revenda" : "Parceiro"}</div></td>
        <td><strong>{p.tierName || p.tier}</strong><div className="muted">{p.features.maxServers} URL(s)/código</div></td>
        <td>{p.contractMode && p.contractMode !== "legacy" ? CONTRACT_NAMES[p.contractMode] : BILLING_NAMES[p.billingModel] || "—"}</td>
        <td><strong>{contractPrice(p)}</strong></td>
        <td>{p.contractMode === "fixed_limited" ? `${p.activationLimit ?? "—"} ativações` : p.contractMode === "fixed_unlimited" ? "Ilimitadas" : p.deviceLimit != null ? `${p.deviceLimit} dispositivos` : "Conforme contrato"}</td>
        <td className="actions"><button type="button" className="btn sm" onClick={() => setSelected(p)}>Gerenciar</button></td>
      </tr>)}</tbody></Table>
      <Empty loading={loading} count={result.data.length} />
      {result.meta.totalPages > 1 && <Pager meta={result.meta} onPage={setPage} />}
    </>}
    {selected && <ContractModal partner={selected} onClose={() => { setSelected(null); reload(); }} reload={reload} />}
  </>;
}

const blankPlan = () => ({key:"",name:"",description:"",audience:"content",monthlyPriceCents:null,
  maxServers:1,autoFailover:false,autoPriority:false,emailAlerts:false,detailedHistory:false,
  sortOrder:100,active:true});
function CatalogEditor({plan,onClose,onSaved}) {
  const isNew = !plan?.key;
  const [data,setData]=useState(plan||blankPlan());
  const [price,setPrice]=useState(data.monthlyPriceCents == null ? "" : (data.monthlyPriceCents/100).toFixed(2).replace(".",","));
  const [error,setError]=useState(""),[busy,setBusy]=useState(false);
  const set=(k,v)=>setData(d=>({...d,[k]:v,...(k==="autoFailover"&&!v?{autoPriority:false}:{})}));
  const submit=async(e)=>{e.preventDefault();setError("");
    const cents = price.trim() ? toCents(price) : null;
    if(price.trim() && (cents == null || cents>100000000)) return setError("Informe um preço válido em reais.");
    setBusy(true);
    try {
      const payload={name:data.name.trim(),description:data.description.trim(),audience:data.audience,
        monthlyPriceCents:cents,maxServers:Number(data.maxServers),autoFailover:!!data.autoFailover,
        autoPriority:!!data.autoPriority,emailAlerts:!!data.emailAlerts,detailedHistory:!!data.detailedHistory,
        sortOrder:Number(data.sortOrder)};
      if(isNew) await api("/admin/service-plans",{method:"POST",body:{key:data.key.trim(),...payload}});
      else await api(`/admin/service-plans/${encodeURIComponent(plan.key)}`,{method:"PUT",body:{...payload,active:!!data.active}});
      onSaved();onClose();
    }catch(err){setError(err.message)}finally{setBusy(false)};
  };
  return <Modal wide title={isNew?"Criar plano de recursos":`Editar plano · ${plan.name}`} onClose={onClose}>
    <form className="pricing-editor" onSubmit={submit}>
      <p className="muted">Os recursos são aplicados pelo backend. O preço de referência não altera automaticamente os contratos existentes.</p>
      <div className="pricing-form-grid">
        <Field label="Identificador interno"><input required maxLength={32} disabled={!isNew} pattern="[a-z][a-z0-9_]{2,31}" value={data.key} onChange={e=>set("key",e.target.value.toLowerCase())} placeholder="ex.: parceiro_gold" /></Field>
        <Field label="Nome do plano"><input required minLength={3} maxLength={120} value={data.name} onChange={e=>set("name",e.target.value)} /></Field>
      </div>
      <Field label="Descrição"><textarea maxLength={500} rows={2} value={data.description} onChange={e=>set("description",e.target.value)}/></Field>
      <div className="pricing-form-grid">
        <Field label="Disponível para"><select value={data.audience} onChange={e=>set("audience",e.target.value)}><option value="content">Parceiros de conteúdo</option><option value="reseller">Revendas</option><option value="both">Ambos</option></select></Field>
        <Field label="Preço mensal de referência (R$)"><input inputMode="decimal" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Opcional; ex.: 99,90"/></Field>
        <Field label="Máximo de URLs por código"><input type="number" min="1" max="8" required value={data.maxServers} onChange={e=>set("maxServers",e.target.value)}/></Field>
        <Field label="Ordem de exibição"><input type="number" min="0" max="9999" required value={data.sortOrder} onChange={e=>set("sortOrder",e.target.value)}/></Field>
      </div>
      <div className="pricing-feature-options">
        {[["autoFailover","Failover automático"],["autoPriority","Prioridade por desempenho"],["emailAlerts","Alertas por e-mail"],["detailedHistory","Histórico detalhado"]].map(([id,label])=><label key={id} className="pricing-check"><input type="checkbox" checked={!!data[id]} disabled={id==="autoPriority"&&!data.autoFailover} onChange={e=>set(id,e.target.checked)}/>{label}</label>)}
        {!isNew&&!plan.system&&<label className="pricing-check"><input type="checkbox" checked={!!data.active} onChange={e=>set("active",e.target.checked)}/> Plano disponível para novas atribuições</label>}
      </div>
      {error&&<p className="error" role="alert">{error}</p>}
      <div className="actions"><button className="btn" type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="btn primary" type="submit" disabled={busy}>{busy?"Salvando…":"Salvar plano"}</button></div>
    </form>
  </Modal>;
}
function CatalogPlans(){
  const [plans,setPlans]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [editing,setEditing]=useState(null),[deleting,setDeleting]=useState(null),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
  const reload=()=>setRevision(r=>r+1);
  useEffect(()=>{let ignore=false;setLoading(true);
    api("/admin/service-plans").then(r=>{if(!ignore){setPlans(r.data||[]);setError("")}})
      .catch(e=>{if(!ignore)setError(e.message)}).finally(()=>{if(!ignore)setLoading(false)});
    return()=>{ignore=true};
  },[revision]);
  const remove=async()=>{setBusy(true);setError("");try{
    await api(`/admin/service-plans/${encodeURIComponent(deleting.key)}`,{method:"DELETE"});setDeleting(null);reload();
  }catch(e){setError(e.message);setDeleting(null)}finally{setBusy(false)}};
  return <>
    <div className="pricing-info">Crie, personalize, duplique ou exclua planos técnicos. O valor é uma <strong>referência comercial</strong>; contratos e cobranças atuais continuam negociados individualmente.</div>
    <div className="toolbar"><button className="btn primary" type="button" onClick={()=>setEditing(blankPlan())}>+ Criar novo plano</button><button className="btn" type="button" disabled={loading} onClick={reload}>Atualizar</button></div>
    {error&&<p className="error" role="alert">{error}</p>}
    {loading&&<p className="muted">Carregando planos…</p>}
    <div className="pricing-tier-grid">{plans.map(p=><article key={p.key} className="pricing-tier card">
      <div className="pricing-tier-label">{p.system?"Plano padrão":p.active?"Personalizado":"Desativado"}</div>
      <h3>{p.name}</h3>
      <p className="muted">{p.description||"Sem descrição"}</p>
      <div className="pricing-tier-big">{p.maxServers} {p.maxServers===1?"URL":"URLs"}</div>
      <dl>
        <div><dt>Preço de referência</dt><dd>{p.monthlyPriceCents==null?"Negociável":`${money(p.monthlyPriceCents)} / mês`}</dd></div>
        <div><dt>Disponível para</dt><dd>{p.audience==="content"?"Parceiros":p.audience==="reseller"?"Revendas":"Ambos"}</dd></div>
        <div><dt>Failover</dt><dd>{p.autoFailover?"Sim":"Não"}</dd></div>
        <div><dt>Prioridade automática</dt><dd>{p.autoPriority?"Sim":"Não"}</dd></div>
        <div><dt>Alertas por e-mail</dt><dd>{p.emailAlerts?"Sim":"Não"}</dd></div>
        <div><dt>Histórico detalhado</dt><dd>{p.detailedHistory?"Sim":"Não"}</dd></div>
        <div><dt>Cadastros vinculados</dt><dd>{p.assignedCount}</dd></div>
      </dl>
      <div className="pricing-plan-actions">
        <button className="btn sm primary" type="button" onClick={()=>setEditing(p)}>Editar</button>
        <button className="btn sm" type="button" onClick={()=>setEditing({...p,key:"",name:`${p.name} · Cópia`,system:false,active:true})}>Duplicar</button>
        {!p.system&&<button className="btn sm" type="button" onClick={()=>setDeleting(p)}>Excluir</button>}
      </div>
    </article>)}</div>
    {!loading&&!plans.length&&<p className="muted">Nenhum plano cadastrado.</p>}
    {editing&&<CatalogEditor key={editing.key||editing.name} plan={editing} onClose={()=>setEditing(null)} onSaved={reload}/>}
    {deleting&&<Modal title="Excluir plano" onClose={()=>setDeleting(null)}>
      <p>Excluir <strong>{deleting.name}</strong> permanentemente?</p>
      <p className="muted">{deleting.assignedCount?`Este plano possui ${deleting.assignedCount} cadastro(s) vinculado(s). Reatribua os parceiros antes de excluir. Você pode desativá-lo na edição.`:"Esta ação não poderá ser desfeita."}</p>
      <div className="actions"><button className="btn" onClick={()=>setDeleting(null)}>Cancelar</button><button className="btn primary" disabled={busy||deleting.assignedCount>0} onClick={remove}>Confirmar exclusão</button></div>
    </Modal>}
  </>;
}

function LicensePrices() {
  const [prices, setPrices] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [revision, setRevision] = useState(0);
  const load = () => setRevision((r) => r + 1);
  useEffect(() => { let ignore = false;
    api("/admin/pix/prices").then((r) => { if (!ignore) { setPrices(r.data); setError(""); } })
      .catch((e) => { if (!ignore) setError(e.message); });
    return () => { ignore = true; };
  }, [revision]);
  const [busy, setBusy] = useState(false);
  const save = async (event) => {
    event.preventDefault();
    const months = Number(editing.months), cents = toCents(editing.price);
    if (!Number.isInteger(months) || months < 1 || months > 120 || cents == null || cents <= 0) return setError("Duração ou preço inválido.");
    setBusy(true); setError("");
    try { await api("/admin/pix/prices", { method: "PUT", body: { months, priceCents: cents, active: !!editing.active, partnerId: null } }); setEditing(null); load(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <>
    <p className="muted">Tabela geral de preços por licença. São os valores unitários vendidos por Pix às revendas que não possuem preços individuais negociados.</p>
    <div className="toolbar"><button className="btn primary" onClick={() => setEditing({ months: "", price: "", active: true, isNew: true })}>+ Adicionar preço</button><button className="btn" onClick={load}>Atualizar</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    <Table><thead><tr><th>Duração</th><th>Preço unitário</th><th>À venda</th><th>Ações</th></tr></thead><tbody>
      {(prices || []).map((p) => <tr key={p.id}><td>{p.months} {p.months === 1 ? "mês" : "meses"}</td><td><strong>{money(p.priceCents)}</strong></td><td>{p.active ? "Sim" : "Não"}</td><td><button className="btn sm" onClick={() => setEditing({ months: String(p.months), price: (p.priceCents / 100).toFixed(2).replace(".", ","), active: p.active, isNew: false })}>Editar</button></td></tr>)}
    </tbody></Table>
    <Empty loading={!prices && !error} count={prices?.length || 0} />
    <div className="pricing-info">Preços individuais por revenda continuam disponíveis em <strong>Financeiro → Pix → Preços das licenças</strong>, onde também é possível remover valores.</div>
    {editing && <Modal title={editing.isNew ? "Novo preço de licença" : "Editar preço de licença"} onClose={() => setEditing(null)}>
      <form className="pricing-editor" onSubmit={save}>
        <Field label="Duração (meses)"><input type="number" min="1" max="120" required disabled={!editing.isNew} value={editing.months} onChange={(e) => setEditing({ ...editing, months: e.target.value })}/></Field>
        <Field label="Preço (R$)"><input inputMode="decimal" required value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })}/></Field>
        <label className="pricing-check"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })}/> Disponível à venda por Pix</label>
        <div className="actions"><button className="btn" type="button" onClick={() => setEditing(null)}>Cancelar</button><button type="submit" disabled={busy} className="btn primary">{busy ? "Salvando…" : "Salvar preço"}</button></div>
      </form>
    </Modal>}
  </>;
}

export default function PlansAndPricing() {
  const [tab, setTab] = useState("contracts");
  if (getAuth()?.user?.role !== "superadmin") return <p className="error">Esta área é exclusiva do Superadmin.</p>;
  return <div className="pricing-page">
    <div className="page-head"><div><h2>Planos e valores</h2><p className="muted page-sub">Uma visão central dos recursos, contratos de parceiros e preços das licenças.</p></div></div>
    <div className="tabs pricing-tabs" role="tablist" aria-label="Planos e valores">
      {[["contracts", "Contratos e mensalidades"], ["tiers", "Planos de recursos"], ["prices", "Preços das licenças"]].map(([id, label]) =>
        <button key={id} type="button" className={`tab ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{label}</button>)}
    </div>
    {tab === "contracts" && <ContractList />}
    {tab === "tiers" && <CatalogPlans />}
    {tab === "prices" && <LicensePrices />}
  </div>;
}
