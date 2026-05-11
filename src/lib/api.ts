import { useAuthStore } from "@/store/useAuthStore";

type FetchOptions = RequestInit & {
  headers?: Record<string, string>;
};

export const fetchWithAuth = async (url: string, options: FetchOptions = {}) => {
  const getAuthToken = () => useAuthStore.getState().token;
  const getRefreshToken = () => useAuthStore.getState().refreshToken;
  const setAuthToken = (token: string) => useAuthStore.getState().setToken(token);
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
  const token = getAuthToken() || persisted?.token || null;
  
  const getHeaders = (t: string | null) => {
    const headers: Record<string, string> = { ...options.headers };
    const hasAuthHeader = Object.keys(headers).some((k) => k.toLowerCase() === "authorization");
    const cleaned = stripBearer(t);
    if (cleaned && !hasAuthHeader) headers["Authorization"] = `Bearer ${cleaned}`;
    // Only set Content-Type to json if body is string and it's not set
    // If body is FormData, browser sets Content-Type with boundary automatically
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
    // Try to refresh
    try {
      // Use the raw fetch here to avoid infinite recursion
      const refreshToken = getRefreshToken() || persisted?.refreshToken || null;
      const tokenToUse = refreshToken || token;
      const cleanedTokenToUse = stripBearer(tokenToUse);

      console.log(`[fetchWithAuth] Refreshing token. Has RefreshToken: ${!!refreshToken}`);

      const refreshResponse = await fetch('/api/login/refresh-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cleanedTokenToUse}`, 
          'Content-Type': 'application/json'
        }
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        const newToken = refreshData.access_token;
        
        if (newToken) {
            // Update store
            setAuthToken(newToken);
            
            // Retry original request
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
            // Refresh succeeded but no token? Weird.
            throw new Error("No access_token in refresh response");
        }
      } else {
        // Refresh failed (token too old, invalid, or route not found)
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
      // In case of network error on refresh, we might want to logout too?
      // For now, let's play safe and only logout on explicit rejection.
      // But if route is 404 (not found), refreshResponse.ok is false, so we hit the else block above.
      // If network error (fetch throws), we are here.
    }
  }

  return response;
};
