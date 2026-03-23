import { NextRequest, NextResponse } from "next/server";

const sanitizeBaseUrl = (value: string | undefined) => {
  const trimmed = String(value || "").trim();
  const unwrapped = trimmed.replace(/^['"`]+/, "").replace(/['"`]+$/, "").trim();
  return unwrapped.replace(/\/+$/, "");
};

const getBaseUrl = () => {
  const internal = sanitizeBaseUrl(process.env.API_INTERNAL_URL);
  if (internal) return internal;

  const publicUrl = sanitizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
  if (publicUrl && !publicUrl.includes("localhost") && !publicUrl.startsWith("/")) {
    return publicUrl;
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

    let body: any = undefined;
    let isStreamingBody = false;
    const contentType = request.headers.get("content-type") || "";
    const methodHasBody = !["GET", "HEAD"].includes(request.method);

    if (methodHasBody) {
      const shouldStream =
        contentType.includes("multipart/form-data") || contentType.includes("application/octet-stream");

      if (shouldStream) {
        body = request.body;
        isStreamingBody = true;
      } else {
        body = await request.arrayBuffer();
      }
    }

    const fetchOptions: any = {
      method: request.method,
      headers: forwardHeaders,
      body,
      redirect: "manual",
      cache: "no-store",
    };

    if (isStreamingBody) {
      fetchOptions.duplex = "half";
    }

    let response = await fetch(targetUrl, fetchOptions);

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

        response = await fetch(newUrlString, fetchOptions);
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

    if (isBinaryGet) {
      const headers = new Headers();
      response.headers.forEach((v, k) => {
        const lowerKey = k.toLowerCase();
        if (!["content-encoding", "content-length", "transfer-encoding"].includes(lowerKey)) {
          headers.set(k, v);
        }
      });
      return new NextResponse(response.body, { status: response.status, headers });
    }

    const data = await response.text();

    const headers = new Headers();
    response.headers.forEach((v, k) => {
      const lowerKey = k.toLowerCase();
      if (!["content-encoding", "content-length", "transfer-encoding"].includes(lowerKey)) {
        headers.set(k, v);
      }
    });

    if (!headers.get("Content-Type") && data && (data.startsWith("{") || data.startsWith("["))) {
      headers.set("Content-Type", "application/json");
    }

    return new NextResponse(data, { status: response.status, headers });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Proxy Error", message: error?.message || "Unknown proxy error" },
      { status: 502 },
    );
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };

