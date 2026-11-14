/** Valor digitado em reais; vazio ou inválido devolve null. */
export function toCents(input) {
  let text = String(input ?? "").trim().replace(/^R\$\s*/, "").replace(/\s/g, "");
  if (!text) return null;
  if (text.includes(",")) {
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(text)) return null;
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  } else if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}
export const moneyInput = cents => cents == null ? "" : (Number(cents) / 100).toFixed(2).replace(".", ",");

/** Exibe centavos do backend, sem converter valores por conta própria na interface. */
export const formatBRL = cents => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(cents||0)/100);
