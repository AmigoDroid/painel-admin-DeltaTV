import { api } from "./api.js";

/** LEGADO: componentes novos devem usar PartnerPicker (busca remota paginada). */
export async function loadPartnerOptions(query = {}) {
  const first = await api("/admin/partners", { query: { ...query, page: 1, pageSize: 100 } });
  const items = [...(first.data ?? [])];
  const totalPages = Number(first.meta?.totalPages ?? 1);
  for (let page = 2; page <= totalPages; page++) {
    const result = await api("/admin/partners", { query: { ...query, page, pageSize: 100 } });
    items.push(...(result.data ?? []));
  }
  return { ...first, data: items };
}
