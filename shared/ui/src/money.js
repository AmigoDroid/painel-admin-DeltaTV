/** Valor digitado em reais; vazio ou inválido devolve null. */
export function toCents(input) {
  let text = String(input ?? "")
    .trim()
    .replace(/^R\$\s*/, "")
    .replace(/\s/g, "");
  if (!text || text.length > 50) return null;
  if (text.includes(",")) {
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(text)) return null;
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, "");
  } else if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}
export const moneyInput = (cents) =>
  cents == null ? "" : (Number(cents) / 100).toFixed(2).replace(".", ",");

/** Exibe centavos do backend, sem converter valores por conta própria na interface. */
export function formatBRL(cents) {
  try {
    if (typeof cents === "number" && !Number.isSafeInteger(cents)) return "—";
    const value = BigInt(cents ?? 0),
      absolute = value < 0n ? -value : value;
    return (
      (value < 0n ? "-" : "") +
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(absolute / 100n) +
      "," +
      String(absolute % 100n).padStart(2, "0")
    );
  } catch {
    return "—";
  }
}
