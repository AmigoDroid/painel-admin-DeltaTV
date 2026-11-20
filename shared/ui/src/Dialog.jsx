import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
const stack = [];
const FOCUSABLE =
  'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
/** Dialog para Admin e Revenda; preserva CSS das respectivas aplicações. */
export default function Dialog({ title, onClose, children, wide }) {
  const titleId = useId(),
    boxRef = useRef(null),
    close = useRef(onClose),
    layer = useRef(null),
    activeMarker = useRef(null);
  if (layer.current === null) layer.current = 1100 + stack.length * 20;
  close.current = onClose;
  useEffect(() => {
    const marker = Symbol("dialog"),
      previouslyFocused = document.activeElement;
    activeMarker.current = marker;
    stack.push(marker);
    const container = boxRef.current;
    const getFocusables = () =>
      Array.from(container?.querySelectorAll(FOCUSABLE) || []).filter(
        (x) => x.getClientRects().length > 0,
      );
    const first = getFocusables()[0] || container;
    first?.focus();
    const key = (e) => {
      if (stack[stack.length - 1] !== marker) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const els = getFocusables();
      if (!els.length) {
        e.preventDefault();
        container?.focus();
        return;
      }
      const firstEl = els[0],
        lastEl = els[els.length - 1],
        active = document.activeElement;
      if (e.shiftKey && (active === firstEl || !container.contains(active))) {
        e.preventDefault();
        lastEl.focus();
      } else if (
        !e.shiftKey &&
        (active === lastEl || !container.contains(active))
      ) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      const index = stack.indexOf(marker);
      if (index !== -1) stack.splice(index, 1);
      if (
        previouslyFocused?.isConnected &&
        typeof previouslyFocused.focus === "function"
      )
        previouslyFocused.focus();
    };
  }, []);
  const contents = (
    <div
      className="overlay"
      style={{ zIndex: layer.current }}
      onMouseDown={(e) => {
        if (stack.length && stack[stack.length - 1] !== activeMarker.current) return;
        if (e.target === e.currentTarget) close.current();
      }}
    >
      <div
        ref={boxRef}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header>
          <h3 id={titleId}>{title}</h3>
          <button
            type="button"
            className="icon"
            aria-label="Fechar"
            onClick={() => close.current()}
          >
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
  return typeof document === "undefined" ? contents : createPortal(contents, document.body);
}
