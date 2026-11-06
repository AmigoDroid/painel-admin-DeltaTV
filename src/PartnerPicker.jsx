import { useEffect, useState } from "react";
import { api } from "./api.js";

/**
 * Busca parceiros no servidor, de 20 em 20, sem baixar toda a base.
 * A opção já escolhida continua visível mesmo que esteja em outra página.
 */
export default function PartnerPicker({ value = "", onChange, kind, emptyLabel = "Selecione…", disabled = false,
  excludedId = "", ariaLabel = "Parceiro" }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timeout);
  }, [search]);
  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    api("/admin/partners", { query: { q: query, kind, page, pageSize: 20 }, signal: ctrl.signal })
      .then((r) => { if (!ctrl.signal.aborted) { setItems(r.data || []); setMeta(r.meta || { page, totalPages: 1 }); setError(""); } })
      .catch((e) => { if (!ctrl.signal.aborted) { setItems([]); setError(e.message); } })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [kind, page, query]);
  useEffect(() => {
    if (!value) { setSelected(null); return; }
    const current = items.find((p) => p.id === value);
    if (current) { setSelected(current); return; }
    const ctrl = new AbortController();
    api(`/admin/partners/${value}`, { signal: ctrl.signal }).then((p) => {
      if (!ctrl.signal.aborted) setSelected(p);
    }).catch(() => {});
    return () => ctrl.abort();
  }, [items, value]);

  const options = items.filter((p) => p.id !== excludedId);
  if (value && !options.some((p) => p.id === value) && value !== excludedId)
    options.unshift(selected?.id === value ? selected : { id: value, name: "Parceiro selecionado (carregando…)" });

  return (
    <div style={{ display: "grid", gap: 5, minWidth: 210, width: "100%" }}>
      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
        disabled={disabled} placeholder="Buscar pelo nome ou identificador…" aria-label={`Buscar ${ariaLabel.toLowerCase()}`} />
      <select value={value} disabled={disabled || loading && options.length === 0} aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}>
        <option value="">{emptyLabel}</option>
        {options.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
        <button type="button" className="btn sm" disabled={disabled || page <= 1} onClick={() => setPage((v) => v - 1)}>Anterior</button>
        <span className="muted">{loading ? "Buscando…" : error || `Página ${page} de ${meta.totalPages || 1}`}</span>
        <button type="button" className="btn sm" disabled={disabled || page >= (meta.totalPages || 1)} onClick={() => setPage((v) => v + 1)}>Próxima</button>
      </div>
    </div>
  );
}
