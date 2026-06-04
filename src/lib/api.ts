import { useAuthStore } from "@/store/useAuthStore";

type FetchOptions = RequestInit & {
  headers?: Record<string, string>;
};

function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiry = payload.exp * 1000;
    const now = Date.now();
    return (expiry - now) < (2 * 60 * 1000); // Expired or less than 2 minutes
  } catch {
    return true;
  }
}

export const fetchWithAuth = async (url: string, options: FetchOptions = {}) => {
  const getAuthToken = () => useAuthStore.getState().token;
  const getRefreshToken = () => useAuthStore.getState().refreshToken;
  const setTokens = (token: string, refreshToken: string | null) => useAuthStore.getState().setToken(token, refreshToken);
  const logout = () => useAuthStore.getState().logout();

  const stripBearer = (value: string | null) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return raw.replace(/^bearer\s+/i, "").trim();
  };

  const readPersistedAuth = (): { token: string | null; refreshToken: string | null } | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("auth-storage");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as any;
      const state = parsed?.state ?? parsed;
      const token = typeof state?.token === "string" ? state.token : null;
      const refreshToken = typeof state?.refreshToken === "string" ? state.refreshToken : null;
      return { token, refreshToken };
    } catch {
      return null;
    }
  };

  const persisted = readPersistedAuth();
  let token = getAuthToken() || persisted?.token || null;
  const refreshToken = getRefreshToken() || persisted?.refreshToken || null;

  // Proactively refresh if token is expired or about to expire
  if (token && refreshToken && isTokenExpired(token)) {
    try {
      const cleanedRefreshToken = stripBearer(refreshToken);
      const refreshResponse = await fetch('/api/login/refresh-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanedRefreshToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        if (refreshData.access_token) {
          token = refreshData.access_token;
          setTokens(token, refreshData.refresh_token ?? refreshToken);
        }
      }
    } catch (e) {
      console.warn("Proactive token refresh failed:", e);
    }
  }
  
  const getHeaders = (t: string | null) => {
    const headers: Record<string, string> = { ...options.headers };
    const hasAuthHeader = Object.keys(headers).some((k) => k.toLowerCase() === "authorization");
    const cleaned = stripBearer(t);
    if (cleaned && !hasAuthHeader) headers["Authorization"] = `Bearer ${cleaned}`;
    if (!headers['Content-Type'] && typeof options.body === 'string') {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
  };

  let response = await fetch(url, {
    ...options,
    headers: getHeaders(token),
  });

  const shouldAttemptRefresh = response.status === 401;
  const initialStatus = response.status;

  if (shouldAttemptRefresh) {
    try {
      const cleanedRefreshToken = stripBearer(refreshToken);

      console.log(`[fetchWithAuth] Refreshing token after 401. Has RefreshToken: ${!!refreshToken}`);

      const refreshResponse = await fetch('/api/login/refresh-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanedRefreshToken}`, 
          'Content-Type': 'application/json'
        }
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        const newToken = refreshData.access_token;
        const newRefreshToken = refreshData.refresh_token ?? null;
        
        if (newToken) {
            setTokens(newToken, newRefreshToken);
            
            response = await fetch(url, {
              ...options,
              headers: getHeaders(newToken),
            });

            const retryIsAuthError = response.status === 401 || response.status === 403;
            if (retryIsAuthError) {
              console.warn("Retried request failed with auth error after 401. Logging out.");
              logout();
              if (typeof window !== "undefined") {
                window.location.href = "/login";
              }
            }
        } else {
            throw new Error("No access_token in refresh response");
        }
      } else {
        console.warn("Token refresh failed with status:", refreshResponse.status);
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
