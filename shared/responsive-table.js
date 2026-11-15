/** Atribui títulos acessíveis às células no React, sem MutationObserver nem varredura do DOM. */
export function labelResponsiveTable(
  children,
  { Children, isValidElement, cloneElement },
) {
  const elements = Children.toArray(children);
  const head = elements.find((el) => isValidElement(el) && el.type === "thead");
  const rows = head ? Children.toArray(head.props.children) : [];
  const headerRow = rows
    .filter((row) => isValidElement(row) && row.type === "tr")
    .at(-1);
  const labels = headerRow
    ? Children.toArray(headerRow.props.children)
        .filter((cell) => isValidElement(cell) && cell.type === "th")
        .map((cell) => plainText(cell.props.children) || "Ações")
    : [];
  if (!labels.length) return children;
  return Children.map(children, (node) => {
    if (!isValidElement(node) || node.type !== "tbody") return node;
    const body = Children.map(node.props.children, (row) => {
      if (!isValidElement(row) || row.type !== "tr") return row;
      let column = 0;
      const cells = Children.map(row.props.children, (cell) => {
        if (!isValidElement(cell) || cell.type !== "td") return cell;
        const span = Math.max(1, Number(cell.props.colSpan || 1));
        const label = labels[column] || "Detalhes";
        column += span;
        if (span !== 1 || cell.props["data-label"]) return cell;
        return cloneElement(cell, { "data-label": label });
      });
      return cloneElement(row, undefined, cells);
    });
    return cloneElement(node, undefined, body);
  });
}
function plainText(node) {
  if (typeof node === "string" || typeof node === "number")
    return String(node).trim();
  if (Array.isArray(node)) return node.map(plainText).join(" ").trim();
  if (node && typeof node === "object" && node.props)
    return plainText(node.props.children);
  return "";
}
