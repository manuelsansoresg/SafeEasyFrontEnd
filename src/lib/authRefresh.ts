import { useAuthStore } from "@/store/useAuthStore";

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

let refreshPromise: Promise<AuthTokens | null> | null = null;

export function stripBearer(value: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.replace(/^bearer\s+/i, "").trim();
}

export async function refreshAccessToken(refreshToken?: string | null): Promise<AuthTokens | null> {
  const activeRefreshToken = refreshToken || useAuthStore.getState().refreshToken;
  if (!activeRefreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch("/api/login/refresh-token", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripBearer(activeRefreshToken)}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) return null;

      const data = await response.json();
      const accessToken = typeof data.access_token === "string" ? data.access_token : null;
      if (!accessToken) return null;

      const nextRefreshToken =
        typeof data.refresh_token === "string" && data.refresh_token.trim()
          ? data.refresh_token
          : activeRefreshToken;

      useAuthStore.getState().setToken(accessToken, nextRefreshToken);
      return { accessToken, refreshToken: nextRefreshToken };
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}
