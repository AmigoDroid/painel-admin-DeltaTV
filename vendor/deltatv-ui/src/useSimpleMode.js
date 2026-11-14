import { useEffect, useState } from "react";

/** Somente preferência visual deste navegador: não guarda dados pessoais nem altera permissões. */
export function useSimpleMode(area) {
  const key = `deltatv-visual-mode-${area}-v2`;
  const [simple, setSimple] = useState(() => {
    try { return window.localStorage.getItem(key) === "simple"; }
    catch { return false; }
  });
  useEffect(() => {
    try { window.localStorage.setItem(key, simple ? "simple" : "complete"); }
    catch { /* Navegação funciona mesmo com armazenamento local desativado. */ }
  }, [key, simple]);
  return [simple, setSimple];
}
