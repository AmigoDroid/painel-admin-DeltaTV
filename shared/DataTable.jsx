import { useMemo, useState } from "react";
/** Accessible local sorting/pagination, or server sorting when onSort is supplied. */
export default function DataTable({
  rows = [],
  columns,
  loading = false,
  error = "",
  empty = "Nenhum registro encontrado.",
  pageSize = 10,
  onRetry,
  server = false,
  onSort,
}) {
  const [sort, setSort] = useState({ key: "", dir: "asc" }),
    [page, setPage] = useState(1),
    [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    let result = [...rows];
    if (!server && query)
      result = result.filter((row) =>
        columns.some((c) =>
          String(c.value ? c.value(row) : (row[c.key] ?? ""))
            .toLocaleLowerCase("pt-BR")
            .includes(query.toLocaleLowerCase("pt-BR")),
        ),
      );
    if (!server && sort.key) {
      const column = columns.find((c) => c.key === sort.key);
      result.sort((a, b) => {
        const x = column?.value ? column.value(a) : a[sort.key],
          y = column?.value ? column.value(b) : b[sort.key];
        const v =
          typeof x === "number" && typeof y === "number"
            ? x - y
            : String(x ?? "").localeCompare(String(y ?? ""), "pt-BR", {
                numeric: true,
              });
        return sort.dir === "asc" ? v : -v;
      });
    }
    return result;
  }, [rows, columns, sort, query, server]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)),
    current = Math.min(page, pages),
    visible = server
      ? filtered
      : filtered.slice((current - 1) * pageSize, current * pageSize);
  const order = (column) => {
    const next = {
      key: column.key,
      dir: sort.key === column.key && sort.dir === "asc" ? "desc" : "asc",
    };
    setSort(next);
    onSort?.(next);
  };
  return (
    <div className="control-table" aria-busy={loading}>
      {!server && (
        <label className="control-search">
          Pesquisar nesta lista
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
      )}
      {error && (
        <div className="error" role="alert">
          {error}{" "}
          {onRetry && (
            <button type="button" className="btn sm" onClick={onRetry}>
              Tentar novamente
            </button>
          )}
        </div>
      )}
      {loading && <p role="status">Carregando registros…</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  aria-sort={
                    sort.key === c.key
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {c.sortable !== false ? (
                    <button
                      type="button"
                      className="table-sort"
                      onClick={() => order(c)}
                    >
                      {c.label}{" "}
                      {sort.key === c.key
                        ? sort.dir === "asc"
                          ? "↑"
                          : "↓"
                        : "↕"}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr key={row.id || i}>
                {columns.map((c) => (
                  <td key={c.key} data-label={c.label}>
                    {c.render
                      ? c.render(row)
                      : c.value
                        ? c.value(row)
                        : String(row[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && !error && !visible.length && (
        <p className="muted" role="status">
          {empty}
        </p>
      )}
      {!server && (
        <div className="pager">
          <span>
            {filtered.length} registros · Página {current} de {pages}
          </span>
          <div>
            <button
              className="btn sm"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              Anterior
            </button>
            <button
              className="btn sm"
              disabled={current >= pages}
              onClick={() => setPage(current + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
