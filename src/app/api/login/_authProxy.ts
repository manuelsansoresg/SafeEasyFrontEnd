import { NextRequest, NextResponse } from "next/server";

const AUTH_PROXY_VERSION = "2026-07-14-auth-fallback-1";

type AuthProxyOptions = {
  endpoint: "/login/access-token" | "/login/refresh-token";
  headers: Record<string, string>;
  body?: string;
};

const getSetCookieHeaders = (response: Response) => {
  const headersAny = response.headers as unknown as { getSetCookie?: () => string[] };
  if (headersAny && typeof headersAny.getSetCookie === "function") return headersAny.getSetCookie();
  const raw = response.headers.get("set-cookie");
  return raw ? [raw] : [];
};

const shouldRewriteCookie = (cookie: string) => {
  const name = cookie.split("=", 1)[0]?.trim().toLowerCase() || "";
  return Boolean(
    name &&
      (name.includes("session") ||
        name.includes("auth") ||
        name.includes("token") ||
        name.includes("access") ||
        name.includes("refresh") ||
        name.includes("jwt")),
  );
};

const rewriteSetCookieHeader = (cookie: string, requestHost: string) => {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) return cookie;
  if (!shouldRewriteCookie(cookie)) return cookie;

  const sessionDomain = String(process.env.SESSION_DOMAIN || "").trim();
  const desiredDomain = sessionDomain || (requestHost.endsWith("drooopy.com") ? ".drooopy.com" : "");

  const parts = cookie
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return cookie;

  const [nameValue, ...attrs] = parts;
  const cookieName = nameValue.split("=", 1)[0]?.trim() || "";
  const isHostCookie = cookieName.toLowerCase().startsWith("__host-");
  const kept: string[] = [];
  for (const attr of attrs) {
    const [kRaw] = attr.split("=", 1);
    const k = String(kRaw || "").trim().toLowerCase();
    if (k === "path" || k === "domain" || k === "samesite" || k === "secure" || k === "httponly") continue;
    kept.push(attr);
  }

  const enforced: string[] = [...kept, "Path=/", "SameSite=Lax", "Secure", "HttpOnly"];
  if (!isHostCookie && desiredDomain) enforced.push(`Domain=${desiredDomain}`);
  return [nameValue, ...enforced].join("; ");
};

const sanitizeBaseUrl = (value: string | undefined) => {
  const trimmed = String(value || "").trim();
  const unwrapped = trimmed.replace(/^['"`]+/, "").replace(/['"`]+$/, "").trim();
  return unwrapped.replace(/\/+$/, "");
};

const isLocalHostname = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1";

const ensureAuthApiRoot = (baseUrl: string) => {
  const normalized = sanitizeBaseUrl(baseUrl);
  if (!normalized) return "";

  try {
    const url = new URL(normalized);
    const path = url.pathname.replace(/\/+$/, "");
    const shouldHaveApiPrefix =
      url.hostname === "drooopy.com" || url.hostname === "www.drooopy.com" || (!isLocalHostname(url.hostname) && process.env.NODE_ENV === "production");

    if (shouldHaveApiPrefix && path !== "/api" && !path.endsWith("/api")) {
      url.pathname = `${path}/api`.replace(/\/{2,}/g, "/");
      return url.toString().replace(/\/+$/, "");
    }
  } catch {
    return normalized;
  }

  return normalized;
};

const getBaseUrlCandidates = () => {
  const internal = ensureAuthApiRoot(process.env.API_INTERNAL_URL || "");
  const publicUrl = ensureAuthApiRoot(process.env.NEXT_PUBLIC_API_BASE_URL || "");
  const candidates = [internal, publicUrl];

  if (process.env.NODE_ENV !== "production") {
    candidates.push("http://localhost:8000", "http://127.0.0.1:8000");
  }

  candidates.push("https://drooopy.com/api");
  return Array.from(new Set(candidates.filter(Boolean)));
};

const parseResponseBody = (text: string, status: number) => {
  try {
    return text ? JSON.parse(text) : {};
  } catch (error) {
    console.error("[Auth Proxy] Error parseando JSON del backend:", error);
    return {
      error: "Invalid JSON from backend",
      raw_response: text,
      status,
    };
  }
};

const shouldTryNextCandidate = (response: Response, responseText: string, hasNext: boolean) => {
  if (!hasNext) return false;
  const contentType = response.headers.get("content-type") || "";
  const looksLikeHtml404 = response.status === 404 && (contentType.includes("text/html") || responseText.trim().startsWith("<!DOCTYPE html"));
  return looksLikeHtml404 || [502, 503, 504, 520, 521, 522, 523, 524].includes(response.status);
};

const buildResponseHeaders = (response: Response, requestHost: string, upstreamBase: string) => {
  const headers = new Headers({
    "x-auth-proxy-version": AUTH_PROXY_VERSION,
    "x-auth-proxy-upstream": upstreamBase,
  });

  const setCookies = getSetCookieHeaders(response);
  for (const cookie of setCookies) {
    headers.append("set-cookie", rewriteSetCookieHeader(cookie, requestHost));
  }

  return headers;
};

export async function proxyAuthPost(request: NextRequest, options: AuthProxyOptions) {
  const baseUrlCandidates = getBaseUrlCandidates();
  let lastErrorMessage = "No upstream response";

  for (let i = 0; i < baseUrlCandidates.length; i++) {
    const baseUrl = baseUrlCandidates[i]!;
    const targetUrl = `${baseUrl}${options.endpoint}`;
    const hasNext = i < baseUrlCandidates.length - 1;

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: options.headers,
        body: options.body,
        cache: "no-store",
      });
      const responseText = await response.text();

      if (shouldTryNextCandidate(response, responseText, hasNext)) {
        continue;
      }

      const data = parseResponseBody(responseText, response.status);
      return NextResponse.json(data, {
        status: response.status,
        headers: buildResponseHeaders(response, request.nextUrl.hostname, baseUrl),
      });
    } catch (error: unknown) {
      lastErrorMessage =
        error && typeof error === "object" && "message" in error && typeof (error as Record<string, unknown>).message === "string"
          ? String((error as Record<string, unknown>).message)
          : "Unknown error";

      if (!hasNext) break;
    }
  }

  return NextResponse.json(
    {
      error: "Proxy Error",
      message: lastErrorMessage,
      proxy_version: AUTH_PROXY_VERSION,
      tried: baseUrlCandidates,
    },
    { status: 502, headers: { "x-auth-proxy-version": AUTH_PROXY_VERSION, "x-auth-proxy-upstream": "" } },
  );
}
