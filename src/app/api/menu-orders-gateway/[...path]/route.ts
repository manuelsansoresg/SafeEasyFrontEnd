import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function sanitizeBaseUrl(value: string | undefined) {
  const trimmed = String(value || "").trim();
  const unwrapped = trimmed
    .replace(/^['"`]+/, "")
    .replace(/['"`]+$/, "")
    .trim();

  return unwrapped.replace(/\/+$/, "");
}

function ensureApiRootPath(baseUrl: string) {
  const normalized = sanitizeBaseUrl(baseUrl);
  if (!normalized) return normalized;

  if (
    process.env.NODE_ENV === "production" &&
    !normalized.endsWith("/api")
  ) {
    return `${normalized}/api`;
  }

  return normalized;
}

function backendCandidates() {
  const internal = sanitizeBaseUrl(process.env.API_INTERNAL_URL);
  const publicUrl = sanitizeBaseUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL,
  );

  const candidates: string[] = [];

  if (internal) {
    candidates.push(ensureApiRootPath(internal));
  }

  if (publicUrl && !publicUrl.startsWith("/")) {
    candidates.push(ensureApiRootPath(publicUrl));
  }

  if (process.env.NODE_ENV !== "production") {
    candidates.push(
      "http://127.0.0.1:8000",
      "http://localhost:8000",
    );
  }

  candidates.push("https://drooopy.com/api");

  return Array.from(new Set(candidates));
}

function copyHeaders(request: NextRequest) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();

    if (
      lower === "host" ||
      lower === "connection" ||
      lower === "content-length" ||
      lower === "transfer-encoding" ||
      lower === "content-encoding" ||
      lower === "accept-encoding"
    ) {
      return;
    }

    headers.set(key, value);
  });

  headers.set("X-Forwarded-Proto", "https");
  headers.set("X-Requested-With", "XMLHttpRequest");

  return headers;
}

async function handler(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const parts = Array.isArray(path) ? path : [];

  if (!parts.length) {
    return NextResponse.json(
      { detail: "Menu order path is required" },
      { status: 400 },
    );
  }

  const scope = parts[0];
  const rest = parts.slice(1);

  let backendPath = "";

  if (scope === "public") {
    if (!rest.length) {
      return NextResponse.json(
        { detail: "Public menu order path is required" },
        { status: 400 },
      );
    }
    backendPath = `/public/menu-orders/${rest.join("/")}`;
  } else if (scope === "private") {
    backendPath = rest.length
      ? `/menu-orders/${rest.join("/")}`
      : "/menu-orders";
  } else {
    return NextResponse.json(
      { detail: "Invalid menu order gateway scope" },
      { status: 400 },
    );
  }

  const query = request.nextUrl.search;
  const headers = copyHeaders(request);
  const methodHasBody = !["GET", "HEAD"].includes(request.method);
  const bufferedBody = methodHasBody
    ? await request.arrayBuffer()
    : undefined;

  let lastError: unknown = null;

  for (const candidate of backendCandidates()) {
    const target = `${candidate.replace(/\/+$/, "")}${backendPath}${query}`;

    try {
      const response = await fetch(target, {
        method: request.method,
        headers,
        body: bufferedBody ? bufferedBody.slice(0) : undefined,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(30000),
      });

      if (
        [502, 503, 504, 520, 521, 522, 523, 524].includes(response.status)
      ) {
        lastError = new Error(
          `Menu order upstream returned ${response.status}`,
        );
        continue;
      }

      const responseHeaders = new Headers();

      response.headers.forEach((value, key) => {
        const lower = key.toLowerCase();

        if (
          lower === "content-encoding" ||
          lower === "content-length" ||
          lower === "transfer-encoding"
        ) {
          return;
        }

        responseHeaders.set(key, value);
      });

      return new NextResponse(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    } catch (error) {
      lastError = error;
    }
  }

  console.error("[Menu Orders Gateway] Upstream error:", lastError);

  return NextResponse.json(
    { detail: "No se pudo conectar con el servicio de pedidos de menú." },
    { status: 502 },
  );
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
