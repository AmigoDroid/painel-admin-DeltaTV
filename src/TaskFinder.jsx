import { useEffect, useMemo, useRef, useState } from "react";
import "./task-finder.css";

export function normalizeTask(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
}

/** Busca estritamente local. Nunca expõe rotas ou funcionalidades fora da lista autorizada. */
export function matchTasks(tasks, query) {
  const words = normalizeTask(query).split(" ").filter(Boolean);
  if (!words.length) return tasks;
  return tasks.filter(task => {
    const searchable = normalizeTask([task.label, task.description, ...(task.keywords || [])].join(" "));
    return words.every(word => searchable.includes(word));
  });
}

export default function TaskFinder({ tasks, onNavigate, title = "O que você precisa fazer?" }) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const inputRef = useRef(null);
  const available = useMemo(() => matchTasks(tasks, query).slice(0, 12), [tasks, query]);
  useEffect(() => setFocusIndex(0), [query]);
  useEffect(() => {
    const onShortcut = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setExpanded(true); inputRef.current?.focus();
      }
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);
  function choose(task) {
    setExpanded(false); setQuery("");
    onNavigate(task.route);
  }
  return <div className="task-finder">
    <label className="task-finder-label" htmlFor="task-finder-input">{title}</label>
    <div className="task-finder-input-wrap">
      <span aria-hidden="true">⌕</span>
      <input ref={inputRef} id="task-finder-input" type="search" role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls="task-finder-results" aria-activedescendant={expanded && available.length ? `task-result-${focusIndex}` : undefined} autoComplete="off" value={query} placeholder="Ex.: cadastrar cliente, TV offline, Pix..." onFocus={() => setExpanded(true)} onChange={e => {setQuery(e.target.value);setExpanded(true)}} onKeyDown={e => {
        if (e.key === "ArrowDown") {e.preventDefault();setExpanded(true);setFocusIndex(i=>Math.min(i+1, available.length-1))}
        if (e.key === "ArrowUp") {e.preventDefault();setFocusIndex(i=>Math.max(i-1,0))}
        if (e.key === "Enter" && expanded && available[focusIndex]) {e.preventDefault();choose(available[focusIndex])}
      }}/>
      <kbd>Ctrl K</kbd>
    </div>
    {expanded && <div className="task-finder-results" id="task-finder-results" role="listbox" aria-label="Ações encontradas">
      {available.length ? available.map((task,index) => <button key={`${task.route}-${task.label}`} id={`task-result-${index}`} role="option" aria-selected={focusIndex===index} type="button" className={index===focusIndex ? "selected" : ""} onMouseEnter={()=>setFocusIndex(index)} onClick={()=>choose(task)}><strong>{task.label}</strong><small>{task.description}</small></button>) : <p role="status">Nenhuma ação encontrada. Tente outro termo ou abra a Central de Ajuda.</p>}
    </div>}
  </div>;
}
