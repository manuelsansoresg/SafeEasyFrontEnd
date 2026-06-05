import { useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { refreshAccessToken } from '@/lib/authRefresh';

const REFRESH_INTERVAL = 20 * 60 * 1000; // 20 minutes (token expires in 30)

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
    const expiry = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    // Refresh if less than 5 minutes remaining
    return (expiry - now) < (5 * 60 * 1000);
  } catch {
    return true;
  }
}

export function useTokenRefresh() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { token, refreshToken, logout } = useAuthStore();

  const refreshTokens = useCallback(async () => {
    const currentToken = useAuthStore.getState().token;
    const currentRefreshToken = useAuthStore.getState().refreshToken;

    if (!currentToken || !currentRefreshToken) return;

    try {
      const refreshed = await refreshAccessToken(currentRefreshToken);
      if (!refreshed) {
        logout();
      }
    } catch {
      // Don't logout on network error, just retry later
      console.warn('Token refresh failed, will retry');
    }
  }, [logout]);

  useEffect(() => {
    // Check on mount if token needs refresh
    if (token && refreshToken && isTokenExpired(token)) {
      refreshTokens();
    }

    // Set up interval for periodic refresh
    if (!token || !refreshToken) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(refreshTokens, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [refreshTokens, token, refreshToken]);

  // Refresh when user becomes active (returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && token && refreshToken && isTokenExpired(token)) {
        refreshTokens();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshTokens, token, refreshToken]);
}
