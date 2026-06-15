import { NextRequest, NextResponse } from "next/server";

const PROXY_VERSION = "2026-04-15-body-replay-2";

const sanitizeBaseUrl = (value: string | undefined) => {
  const trimmed = String(value || "").trim();
  const unwrapped = trimmed.replace(/^['"`]+/, "").replace(/['"`]+$/, "").trim();
  return unwrapped.replace(/\/+$/, "");
};

const ensureApiRootPath = (baseUrl: string) => {
  const normalized = sanitizeBaseUrl(baseUrl);
  if (!normalized) return normalized;
  if (normalized.endsWith("/api")) return normalized;
  return `${normalized}/api`;
};

const getBaseUrl = () => {
  const internal = sanitizeBaseUrl(process.env.API_INTERNAL_URL);
  if (internal) return ensureApiRootPath(internal);

  const publicUrl = sanitizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
  const isProd = process.env.NODE_ENV === "production";
  const isLocalPublic =
    publicUrl.includes("localhost") ||
    publicUrl.includes("127.0.0.1") ||
    publicUrl.includes("0.0.0.0");
  if (publicUrl && !publicUrl.startsWith("/") && (!isProd || !isLocalPublic)) {
    return ensureApiRootPath(publicUrl);
  }

  if (!isProd && publicUrl && !publicUrl.startsWith("/") && isLocalPublic) {
    return ensureApiRootPath(publicUrl);
  }

  return "https://drooopy.com/api";
};

const BASE_URL = getBaseUrl();

async function handler(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  let relativePath = pathname.replace(/^\/proxy/, "");

  if (relativePath.startsWith("/backend")) {
    relativePath = relativePath.replace(/^\/backend/, "");
  }

  if (relativePath && !relativePath.startsWith("/")) {
    relativePath = "/" + relativePath;
  }

  const baseUrl = BASE_URL.replace(/\/+$/, "");
  let targetUrl = `${baseUrl}${relativePath}`;
  targetUrl = targetUrl.replace(/([^:])\/{2,}/g, "$1/");

  if (
    (targetUrl.endsWith("users") ||
      targetUrl.endsWith("products") ||
      targetUrl.endsWith("suppliers") ||
      targetUrl.endsWith("orders")) &&
    !targetUrl.endsWith("/")
  ) {
    targetUrl += "/";
  }

  targetUrl += request.nextUrl.search;

  try {
    const forwardHeaders = new Headers();
    const headersToExclude = [
      "host",
      "connection",
      "transfer-encoding",
      "content-length",
      "content-encoding",
      "accept-encoding",
      "origin",
      "referer",
      "sec-fetch-site",
      "sec-fetch-mode",
      "sec-fetch-dest",
      "sec-fetch-user",
      "sec-ch-ua",
      "sec-ch-ua-mobile",
      "sec-ch-ua-platform",
      "accept-language",
      "x-vercel-ip-city",
      "x-vercel-ip-country",
      "cf-ipcity",
      "cf-ipcountry",
    ];

    request.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (headersToExclude.includes(lowerKey)) return;

      if (lowerKey === "cookie") {
        const cookies = value
          .split(";")
          .filter(
            (c) => !c.trim().startsWith("user_city=") && !c.trim().startsWith("user_country="),
          )
          .join(";");
        if (cookies.trim()) forwardHeaders.set(key, cookies);
        return;
      }

      forwardHeaders.set(key, value);
    });

    forwardHeaders.set("X-Forwarded-Proto", "https");
    if (!forwardHeaders.has("X-Requested-With")) {
      forwardHeaders.set("X-Requested-With", "XMLHttpRequest");
    }

    let isStreamingBody = false;
    let bufferedBody: ArrayBuffer | null = null;
    const contentType = request.headers.get("content-type") || "";
    const methodHasBody = !["GET", "HEAD"].includes(request.method);

    if (methodHasBody) {
      const shouldStream =
        contentType.includes("multipart/form-data") || contentType.includes("application/octet-stream");

      if (shouldStream) {
        isStreamingBody = true;
      } else {
        bufferedBody = await request.arrayBuffer();
      }
    }

    const buildFetchOptions = (): RequestInit & { duplex?: "half" } => {
      const opts: RequestInit & { duplex?: "half" } = {
        method: request.method,
        headers: forwardHeaders,
        redirect: "manual",
        cache: "no-store",
      };
      if (isStreamingBody) {
        opts.body = request.body;
        opts.duplex = "half";
      } else if (bufferedBody) {
        opts.body = bufferedBody.slice(0);
      }
      return opts;
    };

    let response = await fetch(targetUrl, buildFetchOptions());

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (location) {
        if (isStreamingBody) {
          return new NextResponse(response.body, { status: response.status, headers: response.headers });
        }

        let newUrlString = location;
        if (!location.startsWith("http")) {
          const baseUrlObj = new URL(targetUrl);
          newUrlString = new URL(location, baseUrlObj).toString();
        }

        if (newUrlString.startsWith("http:")) {
          newUrlString = newUrlString.replace("http:", "https:");
        }

        response = await fetch(newUrlString, buildFetchOptions());
      }
    }

    const respContentType = response.headers.get("Content-Type") || "";
    const isBinaryGet =
      request.method === "GET" &&
      !respContentType.includes("application/json") &&
      (respContentType.startsWith("video/") ||
        respContentType.startsWith("image/") ||
        respContentType === "application/octet-stream" ||
        respContentType.startsWith("application/zip") ||
        respContentType.startsWith("audio/"));
    const debugProxy =
      process.env.NODE_ENV !== "production" &&
      (request.nextUrl.searchParams.get("_proxy_debug") === "1" ||
        request.headers.get("x-proxy-debug") === "1");

    if (isBinaryGet) {
      const headers = new Headers();
      response.headers.forEach((v, k) => {
        const lowerKey = k.toLowerCase();
        if (!["content-encoding", "content-length", "transfer-encoding"].includes(lowerKey)) {
          headers.set(k, v);
        }
      });
      headers.set("x-next-proxy-version", PROXY_VERSION);
      headers.set("x-next-proxy-upstream", BASE_URL);
      return new NextResponse(response.body, { status: response.status, headers });
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
        upstream: BASE_URL,
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
      headers.set("x-next-proxy-upstream", BASE_URL);
      headers.set("Content-Type", "application/json");
      return NextResponse.json(body, { status: response.status, headers });
    }

    const headers = new Headers();
    response.headers.forEach((v, k) => {
      const lowerKey = k.toLowerCase();
      if (!["content-encoding", "content-length", "transfer-encoding"].includes(lowerKey)) {
        headers.set(k, v);
      }
    });
    headers.set("x-next-proxy-version", PROXY_VERSION);
    headers.set("x-next-proxy-upstream", BASE_URL);
    return new NextResponse(response.body, { status: response.status, headers });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Proxy Error", message: error?.message || "Unknown proxy error", proxy_version: PROXY_VERSION },
      { status: 502, headers: { "x-next-proxy-version": PROXY_VERSION, "x-next-proxy-upstream": BASE_URL } },
    );
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
