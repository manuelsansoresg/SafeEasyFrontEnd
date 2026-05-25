import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/useAuthStore';

const REFRESH_INTERVAL = 25 * 60 * 1000;

export function useTokenRefresh() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { token, refreshToken, setToken, logout } = useAuthStore();

  useEffect(() => {
    if (!token || !refreshToken) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const refreshTokens = async () => {
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
        logout();
      }
    };

    intervalRef.current = setInterval(refreshTokens, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [token, refreshToken, setToken, logout]);
}
