import { useEffect, useMemo, useRef, useState } from "react";
import "./device-license-activation.css";

const normalizeMac = (value) => {
  const h = String(value || "")
    .toUpperCase()
    .replace(/[^0-9A-F]/g, "");
  return h.length === 12 ? h.match(/.{2}/g).join(":") : null;
};
const niceDate = (value) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : "Não informado";
const monthsName = (m) => `${m} ${Number(m) === 1 ? "mês" : "meses"}`;
const durationList = [1, 2, 3, 6, 12, 24, 36, 60, 120];
const newKey = () => crypto.randomUUID();

/** Operação por licença, jamais dependente de plano comercial ou vaga. */
export default function DeviceLicenseActivation({
  api,
  role = "reseller",
  onActivated,
}) {
  const admin = role === "admin";
  const [macInput, setMacInput] = useState(() => {
    const value = sessionStorage.getItem("deltatv-activation-mac") || "";
    sessionStorage.removeItem("deltatv-activation-mac");
    return value;
  });
  const mac = useMemo(() => normalizeMac(macInput), [macInput]);
  const [lookup, setLookup] = useState({ state: "empty" });
  const [stock, setStock] = useState([]);
  const [allowedDirect, setAllowedDirect] = useState(admin);
  const [method, setMethod] = useState(admin ? "direct" : "stock");
  const [months, setMonths] = useState("1");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const operationKey = useRef(null);
  const operationIntent = useRef("");

  const refreshCapabilities = async () => {
    if (admin) return;
    const [inventory, authorization] = await Promise.allSettled([
      api("/partner/stock", { query: { page: 1, pageSize: 1 } }),
      api("/partner/network/self-issuance"),
    ]);
    if (inventory.status === "fulfilled")
      setStock((inventory.value.balances || []).filter((v) => v.quantity > 0));
    if (authorization.status === "fulfilled")
      setAllowedDirect(
        authorization.value.enabled === true &&
          authorization.value.eligible === true,
      );
  };
  useEffect(() => {
    refreshCapabilities();
  }, [admin]);
  useEffect(() => {
    setConfirming(false);
    setNotice(null);
  }, [mac, method, months]);

  // HTTP é a fonte da verdade; WebSocket sinaliza que precisamos reconsultar.
  useEffect(() => {
    if (!mac) {
      setLookup({ state: "empty" });
      return;
    }
    let canceled = false,
      request = 0;
    let timer;
    const fetchDevice = async () => {
      const current = ++request;
      setLookup({ state: "loading" });
      try {
        const data = await api(
          admin ? "/admin/licenses/device-lookup" : "/partner/mac/lookup",
          { method: "POST", body: { mac } },
        );
        if (!canceled && current === request)
          setLookup({ state: "found", data });
      } catch (e) {
        if (!canceled && current === request)
          setLookup({
            state: e.status === 404 ? "missing" : "error",
            text: e.message,
          });
      }
    };
    const refresh = (event) => {
      if (
        event.type === "realtime-change" &&
        !["devices", "activations", "data", "device-presence"].includes(
          event.detail?.topic,
        )
      )
        return;
      clearTimeout(timer);
      timer = setTimeout(
        fetchDevice,
        event.type === "realtime-change" ? 250 : 400,
      );
    };
    timer = setTimeout(fetchDevice, 400);
    window.addEventListener("realtime-change", refresh);
    window.addEventListener("realtime-ready", refresh);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible")
        refresh({ type: "realtime-ready" });
    }, 30000);
    return () => {
      canceled = true;
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener("realtime-change", refresh);
      window.removeEventListener("realtime-ready", refresh);
    };
  }, [mac, admin, api]);

  const sources = admin
    ? ["direct", "code"]
    : [
        ...(stock.length ? ["stock"] : []),
        ...(allowedDirect ? ["direct"] : []),
        "code",
      ];
  const effectiveMethod = sources.includes(method) ? method : sources[0];
  const availableStock = stock.filter((s) => s.quantity > 0);
  const selectedMonths = Number(months);
  const effectiveMonths =
    effectiveMethod === "stock" &&
    availableStock.length &&
    !availableStock.some((s) => Number(s.months) === selectedMonths)
      ? Number(availableStock[0].months)
      : selectedMonths;
  const stockAvailable = availableStock.some(
    (s) => Number(s.months) === effectiveMonths,
  );
  const ready =
    lookup.state === "found" &&
    !busy &&
    (effectiveMethod === "code"
      ? code.trim().length >= 8
      : effectiveMethod === "direct"
        ? allowedDirect &&
          Number.isInteger(effectiveMonths) &&
          effectiveMonths >= 1 &&
          effectiveMonths <= 120
        : stockAvailable);
  const actionText =
    effectiveMethod === "direct"
      ? "Emitir e ativar licença"
      : effectiveMethod === "code"
        ? "Ativar com código"
        : "Aplicar licença do estoque";

  const submit = async (event) => {
    event.preventDefault();
    if (!ready) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    setNotice(null);
    const intent = `${mac}|${effectiveMethod}|${effectiveMonths}|${effectiveMethod === "code" ? code.trim() : ""}`;
    if (intent !== operationIntent.current || !operationKey.current) {
      operationIntent.current = intent;
      operationKey.current = newKey();
    }
    try {
      const path = admin
        ? effectiveMethod === "direct"
          ? "/admin/licenses/direct-activation"
          : "/admin/licenses/activate-with-code"
        : effectiveMethod === "direct"
          ? "/partner/license-activation/direct"
          : effectiveMethod === "code"
            ? "/partner/license-activation/code"
            : "/partner/stock/apply";
      const body =
        effectiveMethod === "code"
          ? { mac, code: code.trim() }
          : effectiveMethod === "direct"
            ? {
                mac,
                months: effectiveMonths,
                idempotencyKey: operationKey.current,
              }
            : { mac, months: effectiveMonths };
      const result = await api(path, { method: "POST", body });
      setNotice({
        success: true,
        text: `${result.action === "renew" ? "Licença renovada" : "Licença ativada"} para ${mac}. ${result.expiresAt ? `Válida até ${niceDate(result.expiresAt)}.` : ""}`,
        result,
      });
      setConfirming(false);
      operationKey.current = null;
      operationIntent.current = "";
      setCode("");
      window.dispatchEvent(new Event("stock-changed"));
      refreshCapabilities();
      onActivated?.(result);
    } catch (error) {
      setNotice({
        success: false,
        text:
          error.message ||
          "Não foi possível ativar a licença. Tente novamente.",
      });
      setConfirming(false); // retry direto usa a mesma chave para não somar o prazo duas vezes
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dla-page">
      <header className="dla-heading">
        <span className="dla-eyebrow">LICENCIAMENTO DE DISPOSITIVOS</span>
        <h2>Ativar TV com licença</h2>
        <p>
          Informe o MAC e escolha a licença. Não é necessário cadastrar um plano
          comercial para ativar uma TV.
        </p>
      </header>
      <div className="dla-layout">
        <section className="dla-card" aria-label="Ativação de licença">
          <form onSubmit={submit}>
            <div className="dla-step">
              <span>1</span>
              <div>
                <h3>Identifique a TV</h3>
                <p>Use o MAC mostrado no aplicativo DeltaTV.</p>
              </div>
            </div>
            <label className="dla-field">
              Endereço MAC
              <input
                autoComplete="off"
                value={macInput}
                placeholder="AA:BB:CC:DD:EE:FF"
                spellCheck={false}
                onChange={(e) => setMacInput(e.target.value)}
                aria-describedby="dla-state"
              />
            </label>
            <div
              id="dla-state"
              className={`dla-state is-${lookup.state}`}
              role="status"
              aria-live="polite"
            >
              {lookup.state === "empty" &&
                "Digite o MAC completo para consultar a TV."}
              {lookup.state === "loading" && "Consultando o dispositivo…"}
              {lookup.state === "found" &&
                `TV localizada: ${lookup.data?.mac || mac}. ${lookup.data?.online === true ? "Online." : "Confira a situação abaixo."}`}
              {lookup.state === "missing" &&
                "TV não cadastrada. Abra o aplicativo na TV para registrá-la primeiro."}
              {lookup.state === "error" &&
                (lookup.text || "Falha ao consultar a TV.")}
            </div>
            <div className="dla-step">
              <span>2</span>
              <div>
                <h3>Escolha a licença</h3>
                <p>Ativação e renovação utilizam o mesmo formulário.</p>
              </div>
            </div>
            <div
              className="dla-methods"
              role="radiogroup"
              aria-label="Origem da licença"
            >
              {sources.map((source) => (
                <label
                  key={source}
                  className={`dla-method ${effectiveMethod === source ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="license-source"
                    value={source}
                    checked={effectiveMethod === source}
                    onChange={() => setMethod(source)}
                  />
                  <span>
                    {source === "stock"
                      ? "Do meu estoque"
                      : source === "code"
                        ? "Código de licença"
                        : "Emitir na hora"}
                  </span>
                </label>
              ))}
            </div>
            {effectiveMethod === "code" ? (
              <label className="dla-field">
                Código da licença
                <input
                  type="text"
                  autoComplete="off"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setNotice(null);
                    setConfirming(false);
                  }}
                  placeholder="Cole o código de licença"
                  maxLength={180}
                />
              </label>
            ) : (
              <label className="dla-field">
                Duração da licença
                <select
                  value={
                    effectiveMethod === "stock" && !stockAvailable
                      ? ""
                      : String(effectiveMonths)
                  }
                  onChange={(e) => setMonths(e.target.value)}
                >
                  {effectiveMethod === "stock" ? (
                    <>
                      <option value="" disabled>
                        Escolha uma licença disponível
                      </option>
                      {availableStock.map((s) => (
                        <option key={s.months} value={s.months}>
                          {monthsName(s.months)} — {s.quantity} disponível(is)
                        </option>
                      ))}
                    </>
                  ) : (
                    durationList.map((m) => (
                      <option key={m} value={m}>
                        {monthsName(m)}
                      </option>
                    ))
                  )}
                </select>
              </label>
            )}
            {effectiveMethod === "stock" && !stockAvailable && (
              <p className="dla-hint">
                Sem unidades no estoque. Use um código de licença ou solicite
                licenças ao responsável.
              </p>
            )}
            {effectiveMethod === "direct" && (
              <p className="dla-hint">
                A licença será emitida e ativada diretamente nesta TV. O estoque
                não será modificado. Operação auditada.
              </p>
            )}
            {confirming && ready && (
              <div
                className="dla-confirm"
                role="group"
                aria-label="Confirmar ativação"
              >
                <strong>Confirme a operação</strong>
                <p>
                  MAC: <b>{mac}</b> ·{" "}
                  {effectiveMethod === "code"
                    ? "Código informado"
                    : monthsName(effectiveMonths)}{" "}
                  · {actionText}.
                </p>
                <p>
                  A operação pode iniciar uma licença ou somar prazo à licença
                  existente.
                </p>
                <button
                  type="button"
                  className="dla-secondary"
                  onClick={() => setConfirming(false)}
                >
                  Voltar
                </button>
              </div>
            )}
            {notice && (
              <div
                role={notice.success ? "status" : "alert"}
                className={`dla-result ${notice.success ? "success" : "error"}`}
              >
                {notice.text}
              </div>
            )}
            <button
              type="submit"
              disabled={!ready || busy}
              className="dla-submit"
            >
              {busy
                ? "Ativando…"
                : confirming
                  ? "Confirmar ativação"
                  : actionText}
            </button>
          </form>
        </section>
        <aside className="dla-context" aria-label="Detalhes do dispositivo">
          <h3>Situação da TV</h3>
          <dl>
            <div>
              <dt>MAC</dt>
              <dd>{mac || "Aguardando"}</dd>
            </div>
            <div>
              <dt>Cadastro</dt>
              <dd>
                {lookup.state === "found"
                  ? "Encontrado"
                  : lookup.state === "missing"
                    ? "Não encontrado"
                    : "Aguardando consulta"}
              </dd>
            </div>
            {lookup.state === "found" && (
              <>
                <div>
                  <dt>Plataforma</dt>
                  <dd>{lookup.data?.platform || "Não informada"}</dd>
                </div>
                <div>
                  <dt>Licença / acesso</dt>
                  <dd>{lookup.data?.status || "Verifique no painel"}</dd>
                </div>
                <div>
                  <dt>Último contato</dt>
                  <dd>
                    {lookup.data?.lastSeenAt
                      ? niceDate(lookup.data.lastSeenAt)
                      : "Não informado"}
                  </dd>
                </div>
              </>
            )}
          </dl>
          <div className="dla-explainer">
            <b>Como funciona</b>
            <p>
              O MAC localiza o aparelho. A licença é quem autoriza o acesso.
              Planos comerciais do cliente são gerenciados separadamente.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
