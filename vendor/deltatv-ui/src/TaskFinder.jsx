import { useEffect, useId, useMemo, useRef, useState } from "react";
import { enqueueTaskIntent } from "./task-intent.js";
import "./task-finder.css";

import { matchTasks } from "./task-search.js";
export { normalizeTask, matchTasks } from "./task-search.js";
export default function TaskFinder({ tasks, onNavigate, title = "O que você precisa fazer?" }) {
  const id = useId().replace(/:/g, "");
  const inputId = `${id}-task-input`, listId = `${id}-task-list`;
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);
  const inputRef = useRef(null), wrapperRef = useRef(null);
  const available = useMemo(() => matchTasks(tasks, query).slice(0, 12), [tasks, query]);
  useEffect(() => setFocusIndex(0), [query]);
  useEffect(() => {
    const key = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setExpanded(true); inputRef.current?.focus();
      }
      if (e.key === "Escape" && wrapperRef.current?.contains(document.activeElement)) {
        setExpanded(false); inputRef.current?.focus();
      }
    };
    const outside = e => { if (!wrapperRef.current?.contains(e.target)) setExpanded(false); };
    window.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("keydown", key); document.removeEventListener("pointerdown", outside); };
  }, []);
  function choose(task) {
    enqueueTaskIntent(task);
    setExpanded(false); setQuery("");
    onNavigate(task.route, task);
  }
  return <div ref={wrapperRef} className="task-finder">
    <label className="task-finder-label" htmlFor={inputId}>{title}</label>
    <div className="task-finder-input-wrap"><span aria-hidden="true">⌕</span>
      <input ref={inputRef} id={inputId} type="search" role="combobox" aria-autocomplete="list"
        aria-expanded={expanded} aria-controls={expanded ? listId : undefined}
        aria-activedescendant={expanded && available.length ? `${id}-result-${focusIndex}` : undefined}
        autoComplete="off" value={query} placeholder="Ex.: cadastrar cliente, TV offline, Pix..."
        onFocus={() => setExpanded(true)} onChange={e => { setQuery(e.target.value); setExpanded(true); }}
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); setExpanded(true); setFocusIndex(i => Math.min(i + 1, Math.max(0, available.length - 1))); }
          if (e.key === "ArrowUp") { e.preventDefault(); setFocusIndex(i => Math.max(i - 1, 0)); }
          if (e.key === "Enter" && expanded && available[focusIndex]) { e.preventDefault(); choose(available[focusIndex]); }
        }}/><kbd>Ctrl K</kbd>
    </div>
    {expanded && <div className="task-finder-results" id={listId} role="listbox" aria-label="Ações encontradas">
      {available.length ? available.map((task, index) => <button key={`${task.route}-${task.actionId || task.label}`} id={`${id}-result-${index}`} role="option"
        aria-selected={focusIndex === index} type="button" className={index === focusIndex ? "selected" : ""}
        onMouseEnter={() => setFocusIndex(index)} onClick={() => choose(task)}><strong>{task.label}</strong><small>{task.description}</small></button>)
        : <p role="status">Nenhuma ação encontrada. Tente outro termo ou abra a Central de Ajuda.</p>}
    </div>}
  </div>;
}
