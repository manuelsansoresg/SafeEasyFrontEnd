import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

const REFRESH_INTERVAL = 20 * 60 * 1000; // 20 minutes (token expires in 30)

function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
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
  const { token, refreshToken, setToken, logout } = useAuthStore();

  const refreshTokens = async () => {
    if (!token || !refreshToken) return;

    try {
      const response = await fetch('/api/login/refresh-token', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${refreshToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          setToken(data.access_token, data.refresh_token ?? null);
        } else {
          logout();
        }
      } else {
        logout();
      }
    } catch {
      // Don't logout on network error, just retry later
      console.warn('Token refresh failed, will retry');
    }
  };

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
  }, [token, refreshToken]);

  // Refresh when user becomes active (returns to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && token && refreshToken && isTokenExpired(token)) {
        refreshTokens();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [token, refreshToken]);
}
