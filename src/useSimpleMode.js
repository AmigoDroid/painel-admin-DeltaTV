import { useEffect, useState } from "react";

/** Somente preferência visual deste navegador: não guarda dados pessoais nem altera permissões. */
export function useSimpleMode(area) {
  const key = `deltatv-visual-mode-${area}-v1`;
  const [simple, setSimple] = useState(() => {
    try { return window.localStorage.getItem(key) !== "complete"; }
    catch { return true; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(key, simple ? "simple" : "complete"); }
    catch { /* Navegação funciona mesmo com armazenamento local desativado. */ }
  }, [key, simple]);
  return [simple, setSimple];
}
