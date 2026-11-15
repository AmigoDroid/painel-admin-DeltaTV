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
  storage = globalThis.sessionStorage,
  timeoutMs = 30000,
}) {
  let auth = null,
    refreshing = null;
  try {
    auth = JSON.parse(storage?.getItem(key) || "null");
  } catch {
    /* unavailable/corrupted storage */
  }
  // Legacy sessions require a new login; never migrate a persistent refresh credential.
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    /* storage can be disabled */
  }
  const getAuth = () => auth;
  const save = (value) => {
    auth = value;
    try {
      if (value) storage?.setItem(key, JSON.stringify(value));
      else storage?.removeItem(key);
    } catch {
      /* memory-only fallback */
    }
    if (!value) {
      try {
        storage?.removeItem("deltatv.task-intent.v1");
      } catch {}
    }
    globalThis.window?.dispatchEvent(new Event("auth-changed"));
  };
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
    try {
      const data = await raw("/auth/refresh", {
        method: "POST",
        body: { refreshToken: current.refreshToken },
      });
      if (auth === current) save(data);
    } catch (error) {
      if (auth === current && error.status === 401) save(null);
      throw error;
    }
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
    let previous = null;
    try {
      previous = JSON.parse(storage?.getItem(key + ":previous") || "null");
      storage?.removeItem(key + ":previous");
    } catch {}
    save(previous);
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
    if (value.impersonation && auth && !auth.impersonation) {
      try {
        storage?.setItem(key + ":previous", JSON.stringify(auth));
      } catch {}
    }
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
