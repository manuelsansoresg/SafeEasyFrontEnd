import { NextRequest, NextResponse } from 'next/server';

const getSetCookieHeaders = (response: Response) => {
  const headersAny = response.headers as unknown as { getSetCookie?: () => string[] };
  if (headersAny && typeof headersAny.getSetCookie === "function") return headersAny.getSetCookie();
  const raw = response.headers.get("set-cookie");
  return raw ? [raw] : [];
};

const shouldRewriteCookie = (cookie: string) => {
  const name = cookie.split("=", 1)[0]?.trim().toLowerCase() || "";
  if (!name) return false;
  return (
    name.includes("session") ||
    name.includes("auth") ||
    name.includes("token") ||
    name.includes("access") ||
    name.includes("refresh") ||
    name.includes("jwt")
  );
};

const rewriteSetCookieHeader = (cookie: string, requestHost: string) => {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) return cookie;
  if (!shouldRewriteCookie(cookie)) return cookie;

  const sessionDomain = String(process.env.SESSION_DOMAIN || "").trim();
  const desiredDomain = sessionDomain || (requestHost.endsWith("drooopy.com") ? ".drooopy.com" : "");

  const parts = cookie.split(";").map((p) => p.trim()).filter(Boolean);
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

export async function POST(request: NextRequest) {
  try {
    const baseUrl =
      sanitizeBaseUrl(process.env.API_INTERNAL_URL) ||
      sanitizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL) ||
      'https://drooopy.com/api';
    const targetUrl = `${baseUrl}/login/access-token`;

    // Leer el cuerpo de la petición
    const contentType = request.headers.get('content-type') || 'application/x-www-form-urlencoded';
    const bodyText = await request.text();

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'accept': 'application/json',
      },
      body: bodyText,
    });

    const responseText = await response.text();
    let data;
    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
        console.error('[API Proxy] Error parseando JSON del backend:', e);
        data = { 
            error: 'Invalid JSON from backend', 
            raw_response: responseText,
            status: response.status
        };
    }

    const headers = new Headers();
    const setCookies = getSetCookieHeaders(response);
    if (setCookies.length) {
      for (const c of setCookies) {
        headers.append("set-cookie", rewriteSetCookieHeader(c, request.nextUrl.hostname));
      }
    }
    return NextResponse.json(data, { status: response.status, headers });

  } catch (error: unknown) {
    console.error('[API Proxy] Error CRÍTICO en el proxy:', error);
    const message =
      error && typeof error === "object" && "message" in error && typeof (error as Record<string, unknown>).message === "string"
        ? String((error as Record<string, unknown>).message)
        : "Unknown error";
    return NextResponse.json(
      { 
        error: 'Internal Server Error (Proxy)', 
        message,
        details: String(error)
      }, 
      { status: 500 }
    );
  }
}
