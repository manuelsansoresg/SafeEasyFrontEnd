import { useAuthStore } from "@/store/useAuthStore";
import { refreshAccessToken, stripBearer } from "@/lib/authRefresh";

export type FetchOptions = RequestInit & {
  headers?: Record<string, string>;
  retryOnAuthFailure?: boolean;
};

function decodeJwtPayload(token: string) {
  const payload = token.split(".")[1];
  if (!payload) return null;
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  return JSON.parse(atob(padded));
}

function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const payload = decodeJwtPayload(token);
    if (!payload?.exp) return true;
    const expiry = payload.exp * 1000;
    const now = Date.now();
    return (expiry - now) < (2 * 60 * 1000); // Expired or less than 2 minutes
  } catch {
    return true;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export const fetchWithAuth = async (url: string, options: FetchOptions = {}) => {
  const { retryOnAuthFailure = true, ...requestOptions } = options;
  const getAuthToken = () => useAuthStore.getState().token;
  const getRefreshToken = () => useAuthStore.getState().refreshToken;
  const logout = () => useAuthStore.getState().logout();

  const readPersistedAuth = (): { token: string | null; refreshToken: string | null } | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("auth-storage");
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) return null;
      const state = isRecord(parsed.state) ? parsed.state : parsed;
      const token = typeof state.token === "string" ? state.token : null;
      const refreshToken = typeof state.refreshToken === "string" ? state.refreshToken : null;
      return { token, refreshToken };
    } catch {
      return null;
    }
  };

  const persisted = readPersistedAuth();
  let token = getAuthToken() || persisted?.token || null;
  let refreshToken = getRefreshToken() || persisted?.refreshToken || null;

  // Proactively refresh if token is expired or about to expire
  if (token && refreshToken && isTokenExpired(token)) {
    try {
      const refreshed = await refreshAccessToken(refreshToken);
      if (refreshed) {
        token = refreshed.accessToken;
        refreshToken = refreshed.refreshToken;
      }
    } catch (e) {
      console.warn("Proactive token refresh failed:", e);
    }
  }
  
  const getHeaders = (t: string | null) => {
    const headers: Record<string, string> = { ...requestOptions.headers };
    const hasAuthHeader = Object.keys(headers).some((k) => k.toLowerCase() === "authorization");
    const cleaned = stripBearer(t);
    if (cleaned && !hasAuthHeader) headers["Authorization"] = `Bearer ${cleaned}`;
    if (!headers['Content-Type'] && typeof requestOptions.body === 'string') {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
  };

  let response = await fetch(url, {
    ...requestOptions,
    headers: getHeaders(token),
  });

  const shouldAttemptRefresh = retryOnAuthFailure && response.status === 401;
  const initialStatus = response.status;

  if (shouldAttemptRefresh) {
    try {
      if (process.env.NODE_ENV === "development") console.log(`[fetchWithAuth] Refreshing token after 401. Has RefreshToken: ${!!refreshToken}`);

      const refreshed = await refreshAccessToken(refreshToken);
      if (refreshed) {
        response = await fetch(url, {
          ...requestOptions,
          headers: getHeaders(refreshed.accessToken),
        });

        const retryIsAuthError = response.status === 401 || response.status === 403;
        if (retryIsAuthError) {
          // Check for ACCOUNT_PENDING_DELETION in 403 responses
          if (response.status === 403) {
            try {
              const errorBody = await response.clone().json();
              if (errorBody?.error_code === "ACCOUNT_PENDING_DELETION") {
                console.warn("Account pending deletion detected. Redirecting to login.");
                logout();
                if (typeof window !== "undefined") {
                  window.location.href = "/login";
                }
                return response;
              }
            } catch {
              // Not JSON, proceed with normal logout
            }
          }
          console.warn("Retried request failed with auth error after 401. Logging out.");
          logout();
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
        }
      } else {
        console.warn("Token refresh failed.");
        if (initialStatus === 401) {
          logout();
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
        }
      }
    } catch (e) {
      console.error("Token refresh failed exception", e);
    }
  }

  return response;
};
