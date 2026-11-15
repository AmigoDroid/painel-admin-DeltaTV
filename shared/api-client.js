/** One transport for all management panels. Access credentials are scoped to this tab. */
export class ApiError extends Error {
  constructor(status, data) {
    super(
      data?.message ||
        {
          403: "Você não tem permissão para esta operação.",
          500: "O servidor está indisponível. Tente novamente.",
        }[status] ||
        "Não foi possível concluir a operação.",
    );
    this.status = status;
    this.code = data?.code;
    this.details = data?.details;
    this.requestId = data?.requestId;
  }
}
export function createApiClient({
  baseUrl,
  key,
  audience,
  // Login normal: persiste entre abas e reinícios do navegador (até o refresh token vencer no servidor).
  storage = globalThis.localStorage,
  // Impersonação: vale só para a aba que a abriu e nunca é gravada no armazenamento persistente.
  tabStorage = globalThis.sessionStorage,
  timeoutMs = 30000,
}) {
  let auth = null,
    refreshing = null;
  const read = (store) => {
    try {
      return JSON.parse(store?.getItem(key) || "null");
    } catch {
      return null; // storage unavailable/corrupted
    }
  };
  const write = (store, value) => {
    try {
      if (!store) return false;
      store.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false; // storage disabled or full: caller falls back
    }
  };
  const remove = (store) => {
    try {
      store?.removeItem(key);
    } catch {}
  };
  const clearTaskIntent = () => {
    try {
      tabStorage?.removeItem("deltatv.task-intent.v1");
    } catch {}
  };
  const notify = () => globalThis.window?.dispatchEvent(new Event("auth-changed"));

  {
    const stored = read(storage),
      tab = read(tabStorage);
    if (tab?.impersonation) auth = tab;
    else {
      auth = stored || tab || null;
      // Sessões criadas antes desta versão ficavam só na aba: promove para o armazenamento persistente.
      if (tab && (stored || write(storage, tab))) remove(tabStorage);
    }
  }
  const getAuth = () => auth;
  const save = (value) => {
    const wasImpersonating = !!auth?.impersonation;
    auth = value;
    if (value?.impersonation) write(tabStorage, value);
    else {
      remove(tabStorage);
      if (value) {
        // Se o armazenamento persistente estiver bloqueado, mantém ao menos na aba.
        if (!write(storage, value)) write(tabStorage, value);
      } else if (!wasImpersonating) remove(storage);
    }
    if (!value) clearTaskIntent();
    notify();
  };
  // Outra aba entrou, renovou ou saiu: acompanha para não usar um refresh token já rotacionado.
  globalThis.window?.addEventListener?.("storage", (event) => {
    if (auth?.impersonation) return;
    if (event.storageArea && event.storageArea !== storage) return;
    if (event.key !== null && event.key !== key) return;
    auth = read(storage);
    if (!auth) clearTaskIntent();
    notify();
  });
  async function raw(
    path,
    { method = "GET", body, query, token, signal, timeout = timeoutMs } = {},
  ) {
    if (!path.startsWith("/") || path.startsWith("//"))
      throw new TypeError("Caminho de API inválido.");
    const url = new URL(`${baseUrl}/api/v1${path}`);
    Object.entries(query || {}).forEach(([k, v]) => {
      if (v !== "" && v != null) url.searchParams.set(k, String(v));
    });
    const deadline = AbortSignal.timeout(timeout);
    const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
    try {
      const res = await fetch(url, {
        method,
        signal: combined,
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body != null ? JSON.stringify(body) : undefined,
      });
      let data = null;
      if (res.status !== 204) {
        try {
          data = await res.json();
        } catch (error) {
          if (combined.aborted) throw error;
          if (res.ok)
            throw new ApiError(502, {
              code: "INVALID_RESPONSE",
              message:
                "O servidor enviou uma resposta inválida. Tente novamente.",
            });
        }
        if (res.ok && (data === null || typeof data !== "object"))
          throw new ApiError(502, {
            code: "INVALID_RESPONSE",
            message: "O servidor enviou uma resposta inválida.",
          });
      }
      if (!res.ok) throw new ApiError(res.status, data);
      return data;
    } catch (error) {
      if (signal?.aborted)
        throw new DOMException("Requisição cancelada.", "AbortError");
      if (deadline.aborted)
        throw new ApiError(0, {
          code: "TIMEOUT",
          message:
            "O servidor demorou para responder. Verifique o histórico antes de repetir uma ação.",
        });
      if (error instanceof ApiError) throw error;
      throw new ApiError(0, {
        code: "NETWORK",
        message:
          "Não foi possível conectar ao servidor. Verifique a conexão e tente novamente.",
      });
    }
  }
  async function rotate() {
    const current = auth;
    if (!current?.refreshToken) {
      if (current?.impersonation) restorePrevious();
      throw new ApiError(401, {
        code: "INVALID_TOKEN",
        message: "Sessão encerrada. Entre novamente.",
      });
    }
    // O refresh token é de uso único. Se outra aba já renovou, adota a sessão dela em vez de
    // reenviar um token queimado (o que derrubaria o login nas duas abas).
    const adoptFromOtherTab = () => {
      if (current.impersonation) return false;
      const shared = read(storage);
      if (
        !shared?.refreshToken ||
        shared.refreshToken === current.refreshToken ||
        shared.user?.id !== current.user?.id
      )
        return false;
      if (auth === current) {
        auth = shared;
        notify();
      }
      return true;
    };
    const run = async () => {
      if (adoptFromOtherTab()) return;
      try {
        const data = await raw("/auth/refresh", {
          method: "POST",
          body: { refreshToken: current.refreshToken },
        });
        if (auth === current) save(data);
      } catch (error) {
        if (error.status === 401) {
          if (adoptFromOtherTab()) return;
          if (auth === current) save(null);
        }
        throw error;
      }
    };
    // Web Locks serializa a renovação entre abas do mesmo navegador (quando disponível).
    const locks = globalThis.navigator?.locks;
    return locks?.request ? locks.request(`auth-refresh:${key}`, run) : run();
  }
  const refresh = () =>
    (refreshing ??= rotate().finally(() => {
      refreshing = null;
    }));
  async function ensureAccessToken() {
    let exp = 0;
    try {
      exp = JSON.parse(
        atob(
          auth?.accessToken
            ?.split(".")[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/"),
        ),
      ).exp;
    } catch {}
    if (!auth?.accessToken) return null;
    if (!Number.isFinite(exp) || exp * 1000 <= Date.now() + 30000)
      await refresh();
    return auth?.accessToken || null;
  }
  async function api(path, opts = {}, retry = true) {
    const current = auth,
      token = current?.accessToken;
    try {
      return await raw(path, { ...opts, token });
    } catch (error) {
      if (
        error.status === 401 &&
        error.code === "INVALID_TOKEN" &&
        retry &&
        auth === current &&
        auth?.refreshToken
      ) {
        await refresh();
        if (!auth?.accessToken) throw error;
        return api(path, opts, false);
      }
      if (
        error.status === 401 &&
        error.code === "INVALID_TOKEN" &&
        retry &&
        auth?.accessToken &&
        auth !== current &&
        auth.user?.id === current?.user?.id
      )
        return api(path, opts, false);
      if (
        error.status === 401 &&
        error.code === "INVALID_TOKEN" &&
        auth === current
      ) {
        if (current?.impersonation) restorePrevious();
        else save(null);
      }
      throw error;
    }
  }
  async function login(email, password) {
    const result = await raw("/auth/login", {
      method: "POST",
      body: { email, password, audience },
    });
    save(result);
  }
  function restorePrevious() {
    // A impersonação vive só na aba; o login real continua no armazenamento persistente.
    remove(tabStorage);
    auth = read(storage);
    if (!auth) clearTaskIntent();
    notify();
  }
  async function endImpersonation() {
    const current = auth;
    if (current?.impersonation) {
      try {
        await raw("/auth/impersonation/end", {
          method: "POST",
          token: current.accessToken,
        });
      } catch (error) {
        if (![401, 403].includes(error.status)) throw error;
      }
    }
    restorePrevious();
  }
  async function logout() {
    if (auth?.impersonation) return endImpersonation();
    const token = auth?.refreshToken;
    save(null);
    if (token)
      await raw("/auth/logout", {
        method: "POST",
        body: { refreshToken: token },
      }).catch(() => {});
  }
  const updateAuthUser = (user) => {
    if (auth?.user && user?.id === auth.user.id)
      save({ ...auth, user: { ...auth.user, ...user } });
  };
  const acceptSession = (value) => {
    if (!value?.accessToken || !value?.user?.id)
      throw new TypeError("Sessão inválida.");
    save(value);
  };
  return {
    getAuth,
    save,
    raw,
    api,
    login,
    logout,
    refresh,
    ensureAccessToken,
    updateAuthUser,
    acceptSession,
    endImpersonation,
  };
}
