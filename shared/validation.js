export const digits = (value) => String(value ?? "").replace(/\D/g, "");
export function validDocument(value) {
  const text = digits(value);
  if (![11, 14].includes(text.length) || /^(\d)\1+$/.test(text)) return false;
  const calculate = (base, weights) => {
    const rest =
      base.split("").reduce((sum, d, i) => sum + Number(d) * weights[i], 0) %
      11;
    return rest < 2 ? 0 : 11 - rest;
  };
  if (text.length === 11) {
    const first = calculate(text.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]),
      second = calculate(
        text.slice(0, 9) + first,
        [11, 10, 9, 8, 7, 6, 5, 4, 3, 2],
      );
    return text.endsWith(String(first) + second);
  }
  const first = calculate(
      text.slice(0, 12),
      [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    ),
    second = calculate(
      text.slice(0, 12) + first,
      [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    );
  return text.endsWith(String(first) + second);
}
export function maskValue(kind, value) {
  if (kind === "mac") {
    const hex = String(value)
      .replace(/[^0-9a-f]/gi, "")
      .slice(0, 12)
      .toUpperCase();
    return hex.match(/.{1,2}/g)?.join(":") || "";
  }
  if (kind === "document") {
    const d = digits(value).slice(0, 14);
    return d.length <= 11
      ? d
          .replace(/^(\d{3})(\d)/, "$1.$2")
          .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
          .replace(/\.(\d{3})(\d)/, ".$1-$2")
      : d
          .replace(/^(\d{2})(\d)/, "$1.$2")
          .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
          .replace(/\.(\d{3})(\d)/, ".$1/$2")
          .replace(/(\d{4})(\d)/, "$1-$2");
  }
  if (kind === "phone") {
    let d = digits(value).slice(0, 15),
      prefix = "";
    if (d.startsWith("55") && d.length > 11) {
      prefix = "+55 ";
      d = d.slice(2);
    }
    if (d.length > 11) return "+" + d;
    if (d.length > 2) d = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (digits(d).length >= 10) d = d.replace(/(\d{4,5})(\d{4})$/, "$1-$2");
    return prefix + d;
  }
  return value;
}
export function validateValue(kind, value) {
  if (!String(value ?? "").trim()) return "";
  if (kind === "phone") {
    const n = digits(value).length;
    return n >= 8 && n <= 15 ? "" : "Informe um telefone com 8 a 15 dígitos.";
  }
  if (kind === "document")
    return validDocument(value) ? "" : "CPF ou CNPJ inválido.";
  if (kind === "mac")
    return /^[A-F\d]{2}(?::[A-F\d]{2}){5}$/i.test(value)
      ? ""
      : "Informe os 12 caracteres do MAC.";
  if (kind === "email")
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      ? ""
      : "Informe um e-mail válido.";
  return "";
}
