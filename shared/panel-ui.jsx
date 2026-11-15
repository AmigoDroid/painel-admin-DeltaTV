import {
  shouldRefreshList,
  canBackgroundRefresh,
} from "./list-refresh-policy.js";
import { labelResponsiveTable } from "./responsive-table.js";
import SharedDialog from "./ui/src/Dialog.jsx";
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { toCents, formatBRL } from "./ui/src/money.js";
export function createPanelUi(api) {
  /* ---------- Formatação (UTC no banco; exibição em America/Sao_Paulo) ---------- */
  const fmtDate = (v) =>
    v
      ? new Date(v).toLocaleDateString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        })
      : "—";
  const fmtDateTime = (v) =>
    v
      ? new Date(v).toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          dateStyle: "short",
          timeStyle: "short",
        })
      : "—";
  /** "há 5 s", "há 3 min", "há 2 h", "há 4 d" — para a última atividade. */
  function fmtAgo(v, now = Date.now()) {
    if (!v) return "nunca";
    const s = Math.max(0, Math.round((now - new Date(v).getTime()) / 1000));
    if (s < 60) return `há ${s} s`;
    if (s < 3600) return `há ${Math.floor(s / 60)} min`;
    if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
    return `há ${Math.floor(s / 86400)} d`;
  }
  const fmtMoney = formatBRL;
  /**
   * Valor em reais digitado -> centavos. Aceita "10", "10,5", "10.50", "1.234,56", "R$ 1.234,56". Devolve null se não for número
   * (antes virava NaN -> null no JSON, e "1.234,56" não era entendido).
   */
  // Datas de calendário no fuso de São Paulo (UTC-3 fixo desde 2019), o mesmo usado na exibição (fmtDate).
  const SP_DATE = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  });
  const dateInput = (v) => (v ? SP_DATE.format(new Date(v)) : "");
  /** "2026-10-20" -> instante em São Paulo: início do dia, ou fim do dia (para "válido até"). */
  const spDateToIso = (ymd, endOfDay = false) =>
    new Date(
      `${ymd}T${endOfDay ? "23:59:59" : "00:00:00"}-03:00`,
    ).toISOString();
  /** "aabbccddeeff" / "AA-BB-..." -> "AA:BB:CC:DD:EE:FF" (ou null se não tiver 12 dígitos hexadecimais). */
  function formatMac(v) {
    const hex = String(v ?? "")
      .replace(/[^0-9A-Fa-f]/g, "")
      .toUpperCase();
    return hex.length === 12 ? hex.match(/.{2}/g).join(":") : null;
  }

  const STATUS = {
    online: ["Online", "ok"],
    offline: ["Offline", "muted"],
    active: ["Ativa", "ok"],
    pending: ["Pendente", "info"],
    expired: ["Expirada", "warn"],
    suspended: ["Suspensa", "warn"],
    blocked: ["Bloqueada", "bad"],
    cancelled: ["Cancelada", "muted"],
    revoked: ["Removida", "muted"],
    open: ["Em aberto", "info"],
    partial: ["Parcial", "warn"],
    paid: ["Paga", "ok"],
    overdue: ["Vencida", "bad"],
    success: ["Sucesso", "ok"],
    failure: ["Falha", "bad"],
    denied: ["Negado", "warn"],
    disabled: ["Desativada", "muted"],
    proxy: ["Proxy", "info"],
    redirect: ["Redirect", "muted"],
    review: ["Em conferência", "warn"],
    refunded: ["Devolvido", "muted"],
    failed: ["Falhou", "bad"],
  };
  // Status que o usuário precisa ver: a ativação pode estar "active" e o acesso negado (licença cancelada/suspensa/expirada...).
  const DENIED_AS = {
    LICENSE_CANCELLED: "cancelled",
    LICENSE_SUSPENDED: "suspended",
    LICENSE_BLOCKED: "blocked",
    LICENSE_EXPIRED: "expired",
    LICENSE_NOT_STARTED: "pending",
  };
  const accessStatus = (a) =>
    a.status !== "active" || !a.access || a.access.allowed
      ? a.status
      : (DENIED_AS[a.access.code] ?? "blocked");
  function Badge({ status, label }) {
    const [text, tone] = STATUS[status] || [status, "muted"];
    return <span className={`badge ${tone}`}>{label || text}</span>;
  }

  /**
   * Modo de entrega EFETIVO de uma ativação (campos deliveryMode/deliveryModeFixed devolvidos pelo backend):
   * "proxy" = o servidor serve o conteúdo e o app nunca vê a URL/credencial real; "redirect" = o servidor autoriza e manda o
   * app para a origem (302), que recebe as credenciais reais. "fixo" indica restrição da configuração, não o transporte.
   */
  /** Tipo do aparelho, como o servidor guarda em devices.platform (rokutv vira roku; webtv vira web). */
  const PLATFORM_LABEL = {
    roku: "Roku",
    android: "Android TV",
    tizen: "Samsung",
    webos: "LG",
    web: "Web",
  };
  /** Presença do aparelho (campos `online` e `lastSeenAt` devolvidos pelo backend). Offline mostra há quanto tempo foi visto. */
  function OnlineBadge({ online, lastSeenAt }) {
    return (
      <span
        title={
          lastSeenAt
            ? `Última atividade: ${fmtDateTime(lastSeenAt)}`
            : "Nunca deu sinal"
        }
      >
        <Badge status={online ? "online" : "offline"} />
        {!online && <div className="muted">{fmtAgo(lastSeenAt)}</div>}
      </span>
    );
  }

  function PlatformBadge({ platform }) {
    if (!platform) return <span className="muted">—</span>;
    return (
      <span className="badge info" title={`Plataforma: ${platform}`}>
        {PLATFORM_LABEL[platform] || platform}
      </span>
    );
  }

  function DeliveryBadge({ mode, fixed }) {
    if (!mode) return <span className="muted">—</span>;
    const known = mode === "proxy" || mode === "redirect";
    const detail =
      mode === "proxy"
        ? "O servidor entrega o conteúdo por proxy; o aplicativo não acessa diretamente a origem."
        : mode === "redirect"
          ? "O servidor autoriza e redireciona (302) à origem; a origem pode receber as credenciais da lista."
          : "Modo não reconhecido. Verifique as configurações e a resposta do servidor.";
    return (
      <span
        title={`${detail}${fixed ? " Configuração fixa nesta ativação." : ""}`}
      >
        {known ? (
          <Badge status={mode} />
        ) : (
          <Badge status="unknown" label={String(mode)} />
        )}
        {fixed && <span className="muted"> fixo</span>}
      </span>
    );
  }

  /* ---------- Toasts e confirmações ---------- */
  const Ctx = createContext(null);
  const useUi = () => useContext(Ctx);

  function UiProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const [dialogs, setDialogs] = useState([]);
    const dialog = dialogs[0] || null;
    const timers = useRef(new Set());
    const pendingDialogs = useRef(dialogs);
    pendingDialogs.current = dialogs;
    useEffect(
      () => () => {
        for (const timer of timers.current) clearTimeout(timer);
        for (const item of pendingDialogs.current) item.resolve(null);
      },
      [],
    );

    const toast = useCallback((message, tone = "ok") => {
      const id = Math.random();
      setToasts((t) => [...t, { id, message, tone }]);
      const timer = setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
        timers.current.delete(timer);
      }, 5000);
      timers.current.add(timer);
    }, []);

    // confirm({ title, message, danger, reason: "none" | "optional" | "required" }) -> { reason } | null
    const confirm = useCallback(
      (opts) =>
        new Promise((resolve) =>
          setDialogs((queue) => [...queue, { opts, resolve }]),
        ),
      [],
    );
    const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

    return (
      <Ctx.Provider value={value}>
        {children}
        <div className="toasts">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.tone}`}>
              {t.message}
            </div>
          ))}
        </div>
        {dialog && (
          <ConfirmDialog
            {...dialog}
            onClose={() => setDialogs((queue) => queue.slice(1))}
          />
        )}
      </Ctx.Provider>
    );
  }

  function ConfirmDialog({ opts, resolve, onClose }) {
    const [reason, setReason] = useState("");
    const need = opts.reason === "required";
    const done = (v) => {
      resolve(v);
      onClose();
    };
    return (
      <Modal title={opts.title || "Confirmar"} onClose={() => done(null)}>
        <p>{opts.message}</p>
        {opts.reason && opts.reason !== "none" && (
          <Field label={need ? "Motivo (obrigatório)" : "Motivo (opcional)"}>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        )}
        <div className="actions">
          <button className="btn" onClick={() => done(null)}>
            Cancelar
          </button>
          <button
            className={`btn ${opts.danger ? "danger" : "primary"}`}
            disabled={need && reason.trim().length < 3}
            onClick={() => done({ reason: reason.trim() || undefined })}
          >
            {opts.confirmLabel || "Confirmar"}
          </button>
        </div>
      </Modal>
    );
  }

  /* ---------- Componentes básicos ---------- */
  const Modal = SharedDialog;

  const Field = ({ label, hint, children }) => (
    <label className="field">
      <span>{label}</span>
      {isValidElement(children) &&
      ["input", "select", "textarea"].includes(children.type)
        ? cloneElement(children, {
            "aria-label": children.props["aria-label"] || label,
          })
        : children}
      {hint && <small>{hint}</small>}
    </label>
  );

  function Pager({ meta, onPage }) {
    if (!meta) return null;
    return (
      <div className="pager">
        <span>{meta.total.toLocaleString("pt-BR")} registro(s)</span>
        <div>
          <button
            className="btn"
            disabled={meta.page <= 1}
            onClick={() => onPage(meta.page - 1)}
          >
            Anterior
          </button>
          <span>
            {" "}
            Página {meta.page} de {meta.totalPages}{" "}
          </span>
          <button
            className="btn"
            disabled={meta.page >= meta.totalPages}
            onClick={() => onPage(meta.page + 1)}
          >
            Próxima
          </button>
        </div>
      </div>
    );
  }

  const textOf = (node) => {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number")
      return String(node);
    if (Array.isArray(node)) return node.map(textOf).join(" ");
    if (isValidElement(node)) {
      if (node.props.label) return String(node.props.label);
      if (node.props.status)
        return STATUS[node.props.status]?.[0] || String(node.props.status);
      return textOf(node.props.children);
    }
    return "";
  };
  const collator = new Intl.Collator("pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
  function compareVisible(a, b) {
    const date = /^(\d{2})\/(\d{2})\/(\d{4})(?:,?\s+(\d{2}):(\d{2}))?/;
    const x = date.exec(a),
      y = date.exec(b);
    if (x && y)
      return (
        Date.UTC(+x[3], +x[2] - 1, +x[1], +(x[4] || 0), +(x[5] || 0)) -
        Date.UTC(+y[3], +y[2] - 1, +y[1], +(y[4] || 0), +(y[5] || 0))
      );
    if (a.includes("R$") && b.includes("R$"))
      return (
        Number(a.replace(/[^0-9,-]/g, "").replace(",", ".")) -
        Number(b.replace(/[^0-9,-]/g, "").replace(",", "."))
      );
    return collator.compare(a, b);
  }
  function Table({ children }) {
    const [order, setOrder] = useState({ index: -1, dir: 1 });
    const labeled = Children.toArray(
      labelResponsiveTable(children, {
        Children,
        isValidElement,
        cloneElement,
      }),
    );
    const body = labeled.find((x) => isValidElement(x) && x.type === "tbody"),
      rows = body ? Children.toArray(body.props.children) : [];
    const sortable =
      rows.length > 1 &&
      rows.every((x) => isValidElement(x) && x.type === "tr");
    const value = (row, index) => {
      const cells = Children.toArray(row.props.children);
      return textOf(cells[index]?.props?.children).trim();
    };
    const rendered = labeled.map((node) => {
      if (!isValidElement(node)) return node;
      if (node.type === "tbody" && sortable && order.index >= 0) {
        const sorted = rows
          .map((row, index) => ({ row, index }))
          .sort(
            (a, b) =>
              order.dir *
                compareVisible(
                  value(a.row, order.index),
                  value(b.row, order.index),
                ) || a.index - b.index,
          );
        return cloneElement(
          node,
          {},
          sorted.map((x) => x.row),
        );
      }
      if (node.type !== "thead" || !sortable) return node;
      const heads = Children.toArray(node.props.children),
        last = heads.findLastIndex((x) => isValidElement(x) && x.type === "tr");
      return cloneElement(
        node,
        {},
        heads.map((row, i) =>
          i !== last
            ? row
            : cloneElement(
                row,
                {},
                Children.toArray(row.props.children).map((cell, index) => {
                  if (
                    !isValidElement(cell) ||
                    cell.type !== "th" ||
                    cell.props.colSpan > 1
                  )
                    return cell;
                  const label = textOf(cell.props.children).trim();
                  if (!label || /^(ações|opções)$/i.test(label)) return cell;
                  return cloneElement(
                    cell,
                    {
                      "aria-sort":
                        order.index === index
                          ? order.dir === 1
                            ? "ascending"
                            : "descending"
                          : undefined,
                    },
                    <button
                      type="button"
                      className="table-sort"
                      title={`Ordenar os registros desta página por ${label}`}
                      onClick={() =>
                        setOrder((current) => ({
                          index,
                          dir: current.index === index ? -current.dir : 1,
                        }))
                      }
                    >
                      {cell.props.children}
                      {order.index === index && (
                        <span aria-hidden="true">
                          {" "}
                          {order.dir === 1 ? "↑" : "↓"}
                        </span>
                      )}
                    </button>,
                  );
                }),
              ),
        ),
      );
    });
    return (
      <div className="table-wrap labeled-table-wrap">
        <table>{rendered}</table>
      </div>
    );
  }
  const Empty = ({ loading, error, count }) =>
    error ? (
      <p className="error">{error}</p>
    ) : loading ? (
      <p className="muted">Carregando…</p>
    ) : count === 0 ? (
      <p className="muted">Nada encontrado.</p>
    ) : null;

  /** Lista paginada com proteção contra respostas atrasadas, eventos não relacionados e sobreposição. */
  function useList(path, initial = {}) {
    const [params, setParams] = useState({ page: 1, ...initial });
    const [state, setState] = useState({
      loading: true,
      data: [],
      meta: null,
      error: "",
    });
    const seq = useRef(0);
    const request = useRef(null);
    const lastStarted = useRef(0);
    const key = JSON.stringify(params);

    const reload = useCallback(
      async ({ passive = false } = {}) => {
        // Polling e WebSocket não disputam a mesma consulta. Uma ação explícita pode renovar já.
        if (
          passive &&
          !canBackgroundRefresh({
            hidden: document.hidden,
            inFlight: Boolean(request.current),
            now: Date.now(),
            lastStarted: lastStarted.current,
          })
        )
          return;
        const my = ++seq.current;
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        lastStarted.current = Date.now();
        setState((s) => ({ ...s, loading: true, error: "" }));
        try {
          const result = await api(path, {
            query: params,
            signal: controller.signal,
          });
          if (my === seq.current && !controller.signal.aborted) {
            if (result.data != null && !Array.isArray(result.data))
              throw new Error("O servidor retornou uma lista inválida.");
            const lastPage = Math.max(
              1,
              Number(result.meta?.totalPages || params.page),
            );
            if (params.page > lastPage) {
              setParams((prev) => ({ ...prev, page: lastPage }));
              return;
            }
            setState({
              loading: false,
              data: result.data || [],
              meta: result.meta || null,
              error: "",
            });
          }
        } catch (error) {
          if (
            my === seq.current &&
            !controller.signal.aborted &&
            error?.name !== "AbortError"
          ) {
            // Manter os registros visíveis durante falha de conexão, sem saltar a rolagem do celular.
            setState((s) => ({
              ...s,
              loading: false,
              error: error?.message || "Falha ao atualizar lista.",
            }));
          }
        } finally {
          if (request.current === controller) request.current = null;
        }
        // key representa os filtros; o objeto `params` acompanha a mesma chave.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      },
      [path, key],
    );

    useEffect(() => {
      reload();
      return () => {
        ++seq.current;
        request.current?.abort();
        request.current = null;
      };
    }, [reload]);
    useEffect(() => {
      let timer;
      const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(() => reload({ passive: true }), 450);
      };
      const onChange = (event) => {
        if (shouldRefreshList(path, event?.detail)) schedule();
      };
      const onReady = () => schedule();
      // Ao retornar à aba, sincronizar sem transformar cada presença em consulta completa.
      const onVisible = () => {
        if (!document.hidden) schedule();
      };
      window.addEventListener("realtime-change", onChange);
      window.addEventListener("realtime-ready", onReady);
      document.addEventListener("visibilitychange", onVisible);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("realtime-change", onChange);
        window.removeEventListener("realtime-ready", onReady);
        document.removeEventListener("visibilitychange", onVisible);
      };
    }, [path, reload]);

    return {
      ...state,
      params,
      reload,
      filter: (patch) =>
        setParams((prev) => {
          const next = { ...prev, ...patch, page: 1 };
          return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        }),
      setPage: (page) =>
        setParams((prev) => (page === prev.page ? prev : { ...prev, page })),
    };
  }

  /** Executa uma ação com toast de sucesso/erro. */
  function useAction() {
    const { toast } = useUi();
    return useCallback(
      async (fn, okMessage) => {
        try {
          const r = await fn();
          if (okMessage) toast(okMessage);
          return r ?? true;
        } catch (e) {
          toast(e.message, "bad"); // o backend já inclui o campo na mensagem (ex.: "code: Código inválido...")
          return null;
        }
      },
      [toast],
    );
  }

  const useDebounced = (value, ms = 350) => {
    const [v, setV] = useState(value);
    useEffect(() => {
      const t = setTimeout(() => setV(value), ms);
      return () => clearTimeout(t);
    }, [value, ms]);
    return v;
  };

  // Código secreto exibido uma única vez (o banco guarda apenas o hash).
  function SecretCode({ code, onClose, title }) {
    return (
      <Modal title={title || "Código gerado"} onClose={onClose}>
        <p>
          Copie e guarde este código agora.{" "}
          <strong>Ele não será exibido novamente.</strong>
        </p>
        <pre className="secret">{code}</pre>
        <div className="actions">
          <button
            className="btn"
            onClick={() => navigator.clipboard?.writeText(code)}
          >
            Copiar
          </button>
          <button className="btn primary" onClick={onClose}>
            Concluir
          </button>
        </div>
      </Modal>
    );
  }

  // Campo de senha com "mostrar": quem digita a senha de um cliente precisa conferir o que escreveu.
  function PasswordInput({ value, onChange, ...rest }) {
    const [show, setShow] = useState(false);
    return (
      <div className="input-group">
        <input
          {...rest}
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete="new-password"
          spellCheck={false}
        />
        <button
          type="button"
          className="btn sm"
          onClick={() => setShow((v) => !v)}
          aria-pressed={show}
        >
          {show ? "Ocultar" : "Mostrar"}
        </button>
      </div>
    );
  }

  /**
   * Carrega um registro para uma janela de detalhe. Se falhar, mostra o erro e permite tentar de novo
   * (antes a janela ficava em "Carregando…" para sempre e o erro virava exceção sem tratamento).
   */
  function useLoad(fn, deps) {
    const [state, setState] = useState({ data: null, error: "" });
    const sequence = useRef(0);
    const fnRef = useRef(fn);
    fnRef.current = fn;
    const load = useCallback(async () => {
      const current = ++sequence.current;
      try {
        const data = await fnRef.current();
        if (current === sequence.current) setState({ data, error: "" });
      } catch (e) {
        if (current === sequence.current)
          setState((s) => ({ ...s, error: e.message }));
      }
    }, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
      setState({ data: null, error: "" });
      load();
      return () => {
        ++sequence.current;
      };
    }, deps);
    useEffect(() => {
      let timer;
      const onChange = (event) => {
        const msg = event?.detail;
        if (
          msg?.type === "partner-presence" ||
          msg?.type === "device-presence" ||
          msg?.topic === "server-health"
        )
          return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (!document.hidden) load();
        }, 350);
      };
      window.addEventListener("realtime-change", onChange);
      window.addEventListener("realtime-ready", onChange);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("realtime-change", onChange);
        window.removeEventListener("realtime-ready", onChange);
      };
    }, [load]);
    return {
      ...state,
      reload: load,
      setData: (data) => setState({ data, error: "" }),
    };
  }

  const LoadError = ({ error, onRetry }) => (
    <div>
      <p className="error">{error}</p>
      <button className="btn" onClick={onRetry}>
        Tentar novamente
      </button>
    </div>
  );

  /** Logo do DeltaTV: um Δ com o botão de play recortado no meio. */
  function BrandMark({ size = 28 }) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        aria-hidden="true"
        style={{ flex: "none" }}
      >
        <defs>
          <linearGradient
            id="dl-brand-g"
            x1="6"
            y1="4"
            x2="26"
            y2="28"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#8b89ff" />
            <stop offset="1" stopColor="#5a57f2" />
          </linearGradient>
        </defs>
        <path d="M16 3.5 29.5 27.5H2.5z" fill="url(#dl-brand-g)" />
        <path d="M13 15.2 20.4 19.6 13 24z" fill="#0a0c1a" />
      </svg>
    );
  }

  /** Menu de 3 pontinhos para as ações da linha (no lugar de uma fileira de botões). Itens: { label, onClick, danger, hidden, disabled, title }. */
  function RowMenu({ items, label = "Ações" }) {
    const list = items.filter((i) => i && !i.hidden);
    const [pos, setPos] = useState(null);
    const btn = useRef(null);
    const menu = useRef(null);
    const close = useCallback(() => setPos(null), []);
    useEffect(() => {
      if (!pos) return undefined;
      const onDown = (e) => {
        if (
          !menu.current?.contains(e.target) &&
          !btn.current?.contains(e.target)
        )
          close();
      };
      const onKey = (e) => {
        if (e.key === "Escape") {
          close();
          btn.current?.focus();
        }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const els = [
            ...(menu.current?.querySelectorAll("button:not(:disabled)") ?? []),
          ];
          const i = els.indexOf(document.activeElement);
          els[
            (i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length
          ]?.focus();
        }
      };
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
      window.addEventListener("scroll", close, true);
      window.addEventListener("resize", close);
      menu.current?.querySelector("button:not(:disabled)")?.focus();
      return () => {
        document.removeEventListener("mousedown", onDown);
        document.removeEventListener("keydown", onKey);
        window.removeEventListener("scroll", close, true);
        window.removeEventListener("resize", close);
      };
    }, [pos, close]);
    if (!list.length) return null;
    const toggle = () => {
      if (pos) return close();
      const r = btn.current.getBoundingClientRect();
      const narrow = window.matchMedia("(max-width: 700px)").matches;
      if (narrow) {
        setPos({ mobile: true });
        return;
      }
      const h = Math.min(list.length * 42 + 12, window.innerHeight - 24);
      const up = r.bottom + h > window.innerHeight && r.top > h;
      const width = Math.min(240, window.innerWidth - 24);
      const left = Math.max(
        12,
        Math.min(r.right - width, window.innerWidth - width - 12),
      );
      setPos({
        top: Math.max(
          12,
          up
            ? r.top - h - 4
            : Math.min(r.bottom + 4, window.innerHeight - h - 12),
        ),
        left,
      });
    };
    return (
      <>
        <button
          ref={btn}
          type="button"
          className="btn sm kebab"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={!!pos}
          title={label}
          onClick={toggle}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
        {pos &&
          createPortal(
            <>
              {pos.mobile && (
                <button
                  type="button"
                  className="rowmenu-backdrop"
                  aria-label="Fechar ações"
                  onClick={close}
                />
              )}
              <div
                ref={menu}
                role="menu"
                aria-label={label}
                className={`rowmenu${pos.mobile ? " rowmenu-mobile" : ""}`}
                style={
                  pos.mobile ? undefined : { top: pos.top, left: pos.left }
                }
              >
                {pos.mobile && (
                  <div className="rowmenu-heading">
                    {label}
                    <button
                      type="button"
                      onClick={close}
                      aria-label="Fechar menu"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {list.map((i, n) => (
                  <button
                    key={n}
                    type="button"
                    role="menuitem"
                    className={i.danger ? "danger" : ""}
                    disabled={i.disabled}
                    title={i.title}
                    onClick={() => {
                      close();
                      i.onClick?.();
                    }}
                  >
                    {i.label}
                  </button>
                ))}
              </div>
            </>,
            document.body,
          )}
      </>
    );
  }
  return {
    fmtDate,
    fmtDateTime,
    fmtAgo,
    fmtMoney,
    dateInput,
    spDateToIso,
    formatMac,
    accessStatus,
    Badge,
    PLATFORM_LABEL,
    OnlineBadge,
    PlatformBadge,
    DeliveryBadge,
    useUi,
    UiProvider,
    Modal,
    Field,
    Pager,
    Table,
    Empty,
    useList,
    useAction,
    useDebounced,
    SecretCode,
    PasswordInput,
    useLoad,
    LoadError,
    BrandMark,
    RowMenu,
    toCents,
  };
}
