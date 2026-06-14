import { NextRequest, NextResponse } from 'next/server';

const PROXY_VERSION = "2026-04-15-body-replay-2";

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

const rewriteSetCookieHeader = (cookie: string, requestHost: string, mode: "all" | "auth") => {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) return cookie;
  if (mode === "auth" && !shouldRewriteCookie(cookie)) return cookie;

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
    if (k === "path" || k === "domain" || k === "samesite" || k === "secure") continue;
    kept.push(attr);
  }

  const enforced: string[] = [...kept, "Path=/", "SameSite=Lax", "Secure"];
  if (!isHostCookie && desiredDomain) enforced.push(`Domain=${desiredDomain}`);
  enforced.push("HttpOnly");

  return [nameValue, ...enforced].join("; ");
};

const applyRewrittenSetCookies = (
  headers: Headers,
  upstream: Response,
  requestHost: string,
  mode: "all" | "auth"
) => {
  const setCookies = getSetCookieHeaders(upstream);
  if (setCookies.length === 0) return;
  const kept: string[] = [];
  const existing = headers.get("set-cookie");
  if (existing) kept.push(existing);
  headers.delete("set-cookie");
  for (const c of setCookies) {
    const rewritten = rewriteSetCookieHeader(c, requestHost, mode);
    if (rewritten) headers.append("set-cookie", rewritten);
  }
  for (const k of kept) headers.append("set-cookie", k);
};

const sanitizeBaseUrl = (value: string | undefined) => {
  const trimmed = String(value || "").trim();
  const unwrapped = trimmed.replace(/^['"`]+/, "").replace(/['"`]+$/, "").trim();
  return unwrapped.replace(/\/+$/, "");
};

const ensureApiRootPath = (baseUrl: string, isProd: boolean) => {
  const normalized = sanitizeBaseUrl(baseUrl);
  if (!normalized) return normalized;
  // Solo agregar /api en producción (Cloudflare lo maneja)
  // En local, el backend no tiene prefijo /api
  if (isProd && !normalized.endsWith("/api")) return `${normalized}/api`;
  return normalized;
};

const isLocalHostname = (hostname: string) => {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname === "::1";
};

const getBaseUrlCandidates = () => {
  const internal = sanitizeBaseUrl(process.env.API_INTERNAL_URL);
  const publicUrl = sanitizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
  const isProd = process.env.NODE_ENV === "production";
  const isLocalPublic =
    publicUrl.includes("localhost") ||
    publicUrl.includes("127.0.0.1") ||
    publicUrl.includes("0.0.0.0");
  const candidates: string[] = [];

  if (internal) {
    candidates.push(ensureApiRootPath(internal, isProd));
  }

  if (publicUrl && !publicUrl.startsWith("/") && (!isProd || !isLocalPublic)) {
    candidates.push(ensureApiRootPath(publicUrl, isProd));
  }

  if (!isProd) {
    // Local: backend no tiene prefijo /api
    candidates.push("http://localhost:8000", "http://127.0.0.1:8000");
    if (publicUrl && !publicUrl.startsWith("/") && isLocalPublic) candidates.unshift(ensureApiRootPath(publicUrl, isProd));
  }

  candidates.push("https://drooopy.com/api");

  return Array.from(new Set(candidates));
};

async function handler(request: NextRequest) {
  // Use pathname directly to avoid params ambiguity
  const pathname = request.nextUrl.pathname;
  if (process.env.NODE_ENV === "development") console.log(`[Generic Proxy] Received request: ${pathname}`);
  
  // Remove /api prefix
  let relativePath = pathname.replace(/^\/api/, '');
  
  // Remove /backend prefix if present (common misconfiguration or legacy rewrite artifact)
  if (relativePath.startsWith('/backend')) {
      relativePath = relativePath.replace(/^\/backend/, '');
  }
  
  // Ensure relativePath starts with / if it's not empty
  if (relativePath && !relativePath.startsWith('/')) {
      relativePath = '/' + relativePath;
  }

  // Next.js trailingSlash: true ensures all paths have trailing slashes
  // We need to remove trailing slashes from resource endpoints before forwarding to backend
  if (relativePath) {
      const segments = relativePath.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1] || '';
      
      // Resource/action endpoints that should NOT have trailing slashes
      const resourceEndpoints = [
          'me', 'has-role', 'map-location', 'stats', 'business-hours', 
          'carousel', 'certificates', 'header-video', 'ratings', 'views', 
          'earnings', 'availability', 'location', 'mp-status', 
          'active-delivery', 'deliveries', 'payouts', 'manual', 
          'offers', 'current', 'accept', 'reject', 'cancel', 
          'mark-picked-up', 'status', 'history', 'payment-info', 
          'receipt', 'refresh-preference', 'refunds', 'approve', 
          'mark-refunded', 'verify-code', 'delivery-code', 'complete', 
          'mark-ready', 'customer-pickup', 'courier-pickup', 
          'start-checkout', 'shipping-quote', 'add', 'update', 
          'clear', 'item', 'read', 'claim', 'close', 'mark-read', 
          'resolve', 'unassigned', 'connect', 'disconnect', 'callback', 
          'events', 'purchase', 'payments', 'refresh', 'device-token', 
          'recommendations', 'similar', 'by-supplier', 'featured',
          'recommended', 'media', 'dashboard', 'legal', 'sell-faq',
          'settings', 'results', 'countries', 'states', 'cities', 'catalogs',
          'conversations', 'messages', 'presence'
      ];
      
      // Admin endpoints should NOT have trailing slashes
      const isAdminEndpoint = segments[0] === 'admin';
      const isChatEndpoint = segments[0] === 'chat';
      
      // Check if path contains a numeric ID or UUID
      const hasResourceId = segments.some(seg => 
          /^\d+$/.test(seg) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)
      );
      
      // Remove trailing slash for resource endpoints, paths with resource IDs, or admin endpoints
      if (resourceEndpoints.includes(lastSegment) || hasResourceId || isAdminEndpoint || isChatEndpoint) {
          relativePath = relativePath.replace(/\/+$/, '');
      }
  }
  
  const baseUrlCandidates = getBaseUrlCandidates();
  let targetUrl = "";

  try {
    // Use text for JSON to ensure correct formatting and debugging
    // let body: any = undefined; // REMOVED: We use streaming body now
    
    // Explicitly construct headers to ensure nothing is lost
    const forwardHeaders = new Headers();
    
    // Forward all headers except those that are automatically handled or problematic
    // Also exclude geolocation headers to prevent backend from auto-filtering based on IP headers
    // We want to control filtering explicitly via query parameters (e.g. ?location=...)
    const headersToExclude = [
        'host', 
        'connection', 
        'transfer-encoding',
        'content-length',
        'content-encoding',
        'accept-encoding',
        'origin',
        'referer',
        'sec-fetch-site',
        'sec-fetch-mode',
        'sec-fetch-dest',
        'sec-fetch-user',
        'sec-ch-ua',
        'sec-ch-ua-mobile',
        'sec-ch-ua-platform',
        'accept-language',
        'x-vercel-ip-city',
        'x-vercel-ip-country',
        'cf-ipcity',
        'cf-ipcountry'
    ];

    request.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (!headersToExclude.includes(lowerKey)) {
            if (lowerKey === 'cookie') {
                // Remove user_city and user_country cookies to prevent unwanted filtering
                const cookies = value.split(';').filter(c => 
                    !c.trim().startsWith('user_city=') && 
                    !c.trim().startsWith('user_country=')
                ).join(';');
                if (cookies.trim()) {
                    forwardHeaders.set(key, cookies);
                }
            } else {
                forwardHeaders.set(key, value);
            }
        }
    });

    // Hint backend that original request is secure behind proxy
    forwardHeaders.set('X-Forwarded-Proto', 'https');
    if (!forwardHeaders.has('X-Requested-With')) {
        forwardHeaders.set('X-Requested-With', 'XMLHttpRequest');
    }

    // Determine body based on content type and method.
    // IMPORTANT: a request body can only be consumed once. Since we may retry across multiple upstreams
    // and/or follow a redirect, we ALWAYS buffer the body to allow retries.
    // This includes multipart/form-data — without buffering, the first failed upstream candidate
    // would consume the stream and retries would send an empty body.
    let bufferedBody: ArrayBuffer | null = null;
    const methodHasBody = !['GET', 'HEAD'].includes(request.method);

    if (methodHasBody) {
      bufferedBody = await request.arrayBuffer();
    }

    const buildFetchOptions = (): RequestInit => {
      const opts: RequestInit = {
        method: request.method,
        headers: forwardHeaders,
        redirect: 'manual', // Do not follow redirects automatically
        cache: 'no-store',
      };
      if (bufferedBody) {
        opts.body = bufferedBody.slice(0);
      }
      return opts;
    };

    let response: Response | null = null;
    let lastError: unknown = null;
    let upstreamBase: string | null = null;
    const retryableStatuses = new Set([502, 503, 504, 520, 521, 522, 523, 524]);

    for (let i = 0; i < baseUrlCandidates.length; i++) {
      const baseCandidate = baseUrlCandidates[i]!;
      const hasNextCandidate = i < baseUrlCandidates.length - 1;
      const baseUrl = baseCandidate.replace(/\/+$/, "");
      let nextTargetUrl = `${baseUrl}${relativePath}`;
      nextTargetUrl = nextTargetUrl.replace(/([^:])\/{2,}/g, "$1/");

      nextTargetUrl += request.nextUrl.search;
      targetUrl = nextTargetUrl;
      if (process.env.NODE_ENV === "development") console.log(`[Generic Proxy] Forwarding ${request.method} request to: ${targetUrl}`);

      try {
        response = await fetch(targetUrl, buildFetchOptions());
        upstreamBase = baseCandidate;
        lastError = null;
        if (response.ok) break;
        if (retryableStatuses.has(response.status)) {
          if (hasNextCandidate) {
            try {
              await response.body?.cancel();
            } catch {}
            continue;
          }
          break;
        }
        break;
      } catch (err: unknown) {
        lastError = err;
        console.error(`[Generic Proxy] Upstream fetch failed for ${targetUrl}:`, err);
      }
    }

    if (!response) {
      const message =
        lastError && typeof lastError === "object" && "message" in lastError && typeof (lastError as Record<string, unknown>).message === "string"
          ? String((lastError as Record<string, unknown>).message)
          : "No upstream response";
      return NextResponse.json(
        {
          error: "Proxy Error",
          message,
          proxy_version: PROXY_VERSION,
          tried: baseUrlCandidates,
        },
        { status: 502, headers: { "x-next-proxy-version": PROXY_VERSION, "x-next-proxy-upstream": "" } },
      );
    }

    if (process.env.NODE_ENV === "development") console.log(`[Generic Proxy] Response status: ${response.status}`);

    // Manually follow redirect (once) to preserve Authorization header.
    if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('Location');
        if (location) {
             if (process.env.NODE_ENV === "development") console.log(`[Generic Proxy] Redirect detected to: ${location}`);
              
              let newUrlString = location;
             if (!location.startsWith('http')) {
                 const baseUrlObj = new URL(targetUrl);
                 newUrlString = new URL(location, baseUrlObj).toString();
             }

              const redirectUrlObj = new URL(newUrlString);
              const targetUrlObj = new URL(targetUrl);
              if (redirectUrlObj.protocol === "https:" && isLocalHostname(redirectUrlObj.hostname)) {
                  redirectUrlObj.protocol = "http:";
                  newUrlString = redirectUrlObj.toString();
              }
              const shouldUpgradeRedirect =
                redirectUrlObj.protocol === "http:" &&
                !isLocalHostname(redirectUrlObj.hostname) &&
                !isLocalHostname(targetUrlObj.hostname);

              // Force HTTPS for non-local redirects to avoid downgrade loops (Cloudflare/Backend misconfig).
              // Local FastAPI dev redirects (e.g. /notifications -> /notifications/) must stay HTTP.
              if (shouldUpgradeRedirect) {
                  if (process.env.NODE_ENV === "development") console.log(`[Generic Proxy] Upgrading redirect to HTTPS: ${newUrlString}`);
                  newUrlString = newUrlString.replace('http:', 'https:');
              }

             const originHost = new URL(targetUrl).host;
             const redirectHost = new URL(newUrlString).host;
             const isExternalRedirect = originHost !== redirectHost;
             if (isExternalRedirect) {
               const accept = (request.headers.get("accept") || "").toLowerCase();
               const wantsJson =
                 accept.includes("application/json") ||
                 request.nextUrl.searchParams.get("redirect") === "json";
               if (wantsJson) {
                 return NextResponse.json(
                   { redirect_url: newUrlString },
                   { status: 200, headers: { "x-next-proxy-version": PROXY_VERSION, "x-next-proxy-upstream": upstreamBase || "" } },
                 );
               }
               const headers = new Headers();
               response.headers.forEach((v, k) => {
                 const lowerKey = k.toLowerCase();
                 if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
                   headers.set(k, v);
                 }
               });
               headers.set("x-next-proxy-version", PROXY_VERSION);
               headers.set("x-next-proxy-upstream", upstreamBase || "");
              applyRewrittenSetCookies(
                headers,
                response,
                request.nextUrl.hostname,
                pathname.startsWith("/api/mercadopago/") ? "all" : "auth"
              );
               return NextResponse.redirect(newUrlString, { status: response.status, headers });
             }

             if (pathname.startsWith("/api/mercadopago/")) {
               const headers = new Headers();
               response.headers.forEach((v, k) => {
                 const lowerKey = k.toLowerCase();
                 if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
                   headers.set(k, v);
                 }
               });
               headers.set("x-next-proxy-version", PROXY_VERSION);
               headers.set("x-next-proxy-upstream", upstreamBase || "");
              applyRewrittenSetCookies(headers, response, request.nextUrl.hostname, "all");
               return NextResponse.redirect(newUrlString, { status: response.status, headers });
             }
             
             if (process.env.NODE_ENV === "development") console.log(`[Generic Proxy] Following redirect manually to: ${newUrlString}`);
             
             response = await fetch(newUrlString, buildFetchOptions());
             if (process.env.NODE_ENV === "development") console.log(`[Generic Proxy] Followed response status: ${response.status}`);
        }
    }

    const respContentType = response.headers.get('Content-Type') || '';
    const isBinaryGet =
      request.method === 'GET' &&
      !respContentType.includes('application/json') &&
      (respContentType.startsWith('video/') ||
       respContentType.startsWith('image/') ||
       respContentType === 'application/octet-stream' ||
       respContentType.startsWith('application/zip') ||
       respContentType.startsWith('audio/'));
    const debugProxy =
      request.nextUrl.searchParams.get("_proxy_debug") === "1" ||
      request.headers.get("x-proxy-debug") === "1";

    // For binary GETs (videos, images, etc.), stream the body and preserve headers
    if (isBinaryGet) {
      const headers = new Headers();
      response.headers.forEach((v, k) => {
        const lowerKey = k.toLowerCase();
        if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
            headers.set(k, v);
        }
      });
      headers.set("x-next-proxy-version", PROXY_VERSION);
      headers.set("x-next-proxy-upstream", upstreamBase || "");
      applyRewrittenSetCookies(
        headers,
        response,
        request.nextUrl.hostname,
        pathname.startsWith("/api/mercadopago/") ? "all" : "auth"
      );
      return new NextResponse(response.body, {
        status: response.status,
        headers
      });
    }

    if (debugProxy) {
      const raw = await response.text().catch(() => "");
      let parsed: unknown = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = null;
      }
      const proxyInfo = {
        version: PROXY_VERSION,
        upstream: upstreamBase || "",
        target: targetUrl,
        status: response.status,
        content_type: respContentType,
      };
      let body: unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = { ...(parsed as Record<string, unknown>), _proxy: proxyInfo };
      } else if (Array.isArray(parsed)) {
        body = { data: parsed, _proxy: proxyInfo };
      } else {
        body = { raw, _proxy: proxyInfo };
      }
      const headers = new Headers();
      response.headers.forEach((v, k) => {
        const lowerKey = k.toLowerCase();
        if (!["content-encoding", "content-length", "transfer-encoding"].includes(lowerKey)) {
          headers.set(k, v);
        }
      });
      headers.set("x-next-proxy-version", PROXY_VERSION);
      headers.set("x-next-proxy-upstream", upstreamBase || "");
      headers.set("Content-Type", "application/json");
      applyRewrittenSetCookies(
        headers,
        response,
        request.nextUrl.hostname,
        pathname.startsWith("/api/mercadopago/") ? "all" : "auth"
      );
      return NextResponse.json(body, { status: response.status, headers });
    }

    const headers = new Headers();
    response.headers.forEach((v, k) => {
        const lowerKey = k.toLowerCase();
        if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
            headers.set(k, v);
        }
    });
    headers.set("x-next-proxy-version", PROXY_VERSION);
    headers.set("x-next-proxy-upstream", upstreamBase || "");
    applyRewrittenSetCookies(
      headers,
      response,
      request.nextUrl.hostname,
      pathname.startsWith("/api/mercadopago/") ? "all" : "auth"
    );
    
    return new NextResponse(response.body, {
      status: response.status,
      headers
    });

  } catch (error: unknown) {
    console.error(`[Generic Proxy] Error forwarding request to ${targetUrl}:`, error);
    const message =
      error && typeof error === "object" && "message" in error && typeof (error as Record<string, unknown>).message === "string"
        ? String((error as Record<string, unknown>).message)
        : "Unknown proxy error";
    return NextResponse.json(
      {
        error: 'Proxy Error',
        message,
        proxy_version: PROXY_VERSION,
      },
      { status: 502, headers: { "x-next-proxy-version": PROXY_VERSION, "x-next-proxy-upstream": "" } },
    );
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
