import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PROXY_VERSION = "2026-09-20-menu-orders-fix-1";
const IDEMPOTENCY_TTL_MS = 30_000;

const idempotentMutationResponses = new Map<
  string,
  { expiresAt: number; response: Promise<Response> }
>();

type BackendCandidate = {
  baseUrl: string;
  label: string;
};

function sanitizeBaseUrl(value: string | undefined) {
  return String(value || "")
    .trim()
    .replace(/^[\'"`]+/, "")
    .replace(/[\'"`]+$/, "")
    .replace(/\/+$/, "");
}

function withoutApiSuffix(value: string) {
  return sanitizeBaseUrl(value).replace(/\/api\/?$/i, "");
}

function withApiSuffix(value: string) {
  const normalized = sanitizeBaseUrl(value);
  if (!normalized) return "";
  return /\/api$/i.test(normalized)
    ? normalized
    : `${normalized}/api`;
}

function addCandidate(
  list: BackendCandidate[],
  baseUrl: string,
  label: string,
) {
  const normalized = sanitizeBaseUrl(baseUrl);
  if (!normalized || normalized.startsWith("/")) return;
  if (list.some((item) => item.baseUrl === normalized)) return;
  list.push({ baseUrl: normalized, label });
}

function backendCandidates(): BackendCandidate[] {
  const candidates: BackendCandidate[] = [];
  const internal = sanitizeBaseUrl(process.env.API_INTERNAL_URL);
  const publicUrl = sanitizeBaseUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL,
  );

  // FastAPI registra internamente /menus, /menu-orders, etc.
  // ROOT_PATH=/api describe el prefijo externo y no debe forzarse
  // para una conexión directa al proceso FastAPI.
  if (internal) {
    addCandidate(
      candidates,
      withoutApiSuffix(internal),
      "API_INTERNAL_URL sin /api",
    );
    addCandidate(
      candidates,
      internal,
      "API_INTERNAL_URL exacta",
    );
    addCandidate(
      candidates,
      withApiSuffix(internal),
      "API_INTERNAL_URL con /api",
    );
  }

  // El frontend y FastAPI pueden vivir en el mismo servidor.
  // Estas rutas evitan una vuelta innecesaria por Nginx/Cloudflare.
  addCandidate(
    candidates,
    "http://127.0.0.1:8000",
    "FastAPI local 127.0.0.1",
  );
  addCandidate(
    candidates,
    "http://localhost:8000",
    "FastAPI local localhost",
  );

  if (publicUrl && !publicUrl.startsWith("/")) {
    addCandidate(
      candidates,
      withApiSuffix(publicUrl),
      "NEXT_PUBLIC_API_BASE_URL con /api",
    );
    addCandidate(
      candidates,
      publicUrl,
      "NEXT_PUBLIC_API_BASE_URL exacta",
    );
    addCandidate(
      candidates,
      withoutApiSuffix(publicUrl),
      "NEXT_PUBLIC_API_BASE_URL sin /api",
    );
  }

  addCandidate(
    candidates,
    "https://drooopy.com/api",
    "fallback público",
  );

  return candidates;
}

function copyRequestHeaders(request: NextRequest) {
  const headers = new Headers();

  const excluded = new Set([
    "host",
    "connection",
    "content-length",
    "transfer-encoding",
    "content-encoding",
    "accept-encoding",
  ]);

  request.headers.forEach((value, key) => {
    if (!excluded.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  headers.set("X-Forwarded-Proto", "https");

  if (!headers.has("X-Requested-With")) {
    headers.set("X-Requested-With", "XMLHttpRequest");
  }

  return headers;
}

function copyResponseHeaders(response: Response) {
  const headers = new Headers();

  response.headers.forEach((value, key) => {
    const lower = key.toLowerCase();

    if (
      lower === "content-encoding" ||
      lower === "content-length" ||
      lower === "transfer-encoding"
    ) {
      return;
    }

    headers.set(key, value);
  });

  headers.set("x-next-proxy-version", PROXY_VERSION);
  return headers;
}

async function isGenericRouteNotFound(response: Response) {
  if (response.status !== 404) return false;

  const raw = await response.clone().text().catch(() => "");
  const normalizedRaw = raw.trim().toLowerCase();

  if (!normalizedRaw) return true;
  if (
    normalizedRaw === "not found" ||
    normalizedRaw === "404 not found"
  ) {
    return true;
  }

  try {
    const parsed = JSON.parse(raw) as {
      detail?: unknown;
      message?: unknown;
      error?: unknown;
    };

    const detail = String(
      parsed.detail ?? parsed.message ?? parsed.error ?? "",
    )
      .trim()
      .toLowerCase();

    return detail === "not found" || detail === "404 not found";
  } catch {
    return false;
  }
}

function normalizeBackendPath(pathname: string) {
  let relativePath = pathname.replace(/^\/api/, "");

  if (relativePath.startsWith("/backend")) {
    relativePath = relativePath.replace(/^\/backend/, "");
  }

  if (relativePath && !relativePath.startsWith("/")) {
    relativePath = `/${relativePath}`;
  }

  if (!relativePath) return "/";

  const segments = relativePath.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1] || "";

  const resourceEndpoints = new Set([
    "me",
    "my",
    "has-role",
    "map-location",
    "stats",
    "business-hours",
    "carousel",
    "certificates",
    "header-video",
    "ratings",
    "directory-ratings",
    "views",
    "earnings",
    "availability",
    "location",
    "mp-status",
    "active-delivery",
    "deliveries",
    "payouts",
    "manual",
    "offers",
    "current",
    "accept",
    "reject",
    "cancel",
    "mark-picked-up",
    "status",
    "history",
    "payment-info",
    "receipt",
    "refresh-preference",
    "refunds",
    "approve",
    "mark-refunded",
    "verify-code",
    "delivery-code",
    "complete",
    "mark-ready",
    "customer-pickup",
    "courier-pickup",
    "start-checkout",
    "shipping-quote",
    "add",
    "update",
    "clear",
    "item",
    "read",
    "claim",
    "close",
    "mark-read",
    "resolve",
    "unassigned",
    "connect",
    "disconnect",
    "callback",
    "events",
    "purchase",
    "payments",
    "refresh",
    "device-token",
    "recommendations",
    "similar",
    "by-supplier",
    "featured",
    "recommended",
    "media",
    "dashboard",
    "legal",
    "sell-faq",
    "settings",
    "results",
    "countries",
    "states",
    "cities",
    "catalogs",
    "conversations",
    "messages",
    "presence",
    "orders",
    "gallery",
    "intro-image",
    "deleted",
    "supplier-categories",
    "mine",
  ]);

  const hasResourceId = segments.some(
    (segment) =>
      /^\d+$/.test(segment) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        segment,
      ),
  );

  const isAdminEndpoint = segments[0] === "admin";
  const isChatEndpoint = segments[0] === "chat";
  const isSupplierCategorySubcategories =
    segments[0] === "supplier-categories" &&
    lastSegment === "subcategories";

  // MUY IMPORTANTE: FastAPI tiene redirect_slashes=False y todas las
  // rutas del módulo de pedidos de menú están registradas sin slash final.
  const isMenuOrderEndpoint =
    segments[0] === "menu-orders" ||
    (segments[0] === "public" && segments[1] === "menu-orders");

  if (
    resourceEndpoints.has(lastSegment) ||
    hasResourceId ||
    isAdminEndpoint ||
    isChatEndpoint ||
    isSupplierCategorySubcategories ||
    isMenuOrderEndpoint
  ) {
    return relativePath.replace(/\/+$/, "");
  }

  return relativePath.endsWith("/")
    ? relativePath
    : `${relativePath}/`;
}

async function proxyRequest(request: NextRequest) {
  const relativePath = normalizeBackendPath(request.nextUrl.pathname);
  const query = request.nextUrl.search;
  const headers = copyRequestHeaders(request);
  const methodHasBody = !["GET", "HEAD"].includes(request.method);
  const bufferedBody = methodHasBody
    ? await request.arrayBuffer()
    : undefined;

  const canRetryNetworkFailure =
    request.method === "GET" || request.method === "HEAD";

  const retryableStatuses = new Set([
    502,
    503,
    504,
    520,
    521,
    522,
    523,
    524,
  ]);

  let lastError: unknown = null;
  let lastTarget = "";

  const candidates = backendCandidates();

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const hasNext = index < candidates.length - 1;
    const target = `${candidate.baseUrl}${relativePath}${query}`;
    lastTarget = target;

    try {
      const response = await fetch(target, {
        method: request.method,
        headers,
        body: bufferedBody ? bufferedBody.slice(0) : undefined,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(
          candidate.baseUrl.includes("127.0.0.1") ||
            candidate.baseUrl.includes("localhost")
            ? 5000
            : 30000,
        ),
      });

      // Si la base URL es incorrecta, Nginx/FastAPI suele responder un
      // 404 genérico. En ese caso sí es seguro probar el siguiente candidato,
      // incluso para una mutación, porque la ruta nunca fue ejecutada.
      if (await isGenericRouteNotFound(response)) {
        lastError = new Error(
          `Ruta no encontrada usando ${candidate.label}: ${target}`,
        );
        if (hasNext) continue;
      }

      if (retryableStatuses.has(response.status)) {
        lastError = new Error(
          `Upstream ${response.status} usando ${candidate.label}: ${target}`,
        );

        if (hasNext && canRetryNetworkFailure) {
          try {
            await response.body?.cancel();
          } catch {}
          continue;
        }
      }

      const responseHeaders = copyResponseHeaders(response);
      responseHeaders.set("x-next-proxy-upstream", candidate.baseUrl);

      return new NextResponse(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    } catch (error) {
      lastError = error;

      // Nunca reenviar automáticamente POST/PUT/PATCH/DELETE después de un
      // timeout/error de red: el primer servidor pudo haber guardado el cambio.
      if (!canRetryNetworkFailure || !hasNext) break;
    }
  }

  console.error("[Generic Proxy] Upstream error", {
    path: relativePath,
    target: lastTarget,
    error: lastError,
  });

  return NextResponse.json(
    {
      detail: "No se pudo comunicar con el backend.",
      proxy_version: PROXY_VERSION,
    },
    {
      status: 502,
      headers: {
        "x-next-proxy-version": PROXY_VERSION,
      },
    },
  );
}

async function handler(request: NextRequest) {
  const idempotencyKey = request.headers
    .get("x-idempotency-key")
    ?.trim();

  if (
    !idempotencyKey ||
    request.method === "GET" ||
    request.method === "HEAD"
  ) {
    return proxyRequest(request);
  }

  const now = Date.now();

  for (const [key, entry] of idempotentMutationResponses) {
    if (entry.expiresAt <= now) {
      idempotentMutationResponses.delete(key);
    }
  }

  const authScope =
    request.headers.get("authorization")?.slice(-24) || "anonymous";

  const scopedKey = `${authScope}:${request.method}:${request.nextUrl.pathname}:${idempotencyKey}`;
  const existing = idempotentMutationResponses.get(scopedKey);

  if (existing && existing.expiresAt > now) {
    return (await existing.response).clone();
  }

  const upstreamResponse = proxyRequest(request);
  const cachedResponse = upstreamResponse.then((response) =>
    response.clone(),
  );

  idempotentMutationResponses.set(scopedKey, {
    expiresAt: now + IDEMPOTENCY_TTL_MS,
    response: cachedResponse,
  });

  try {
    const response = await upstreamResponse;

    if (!response.ok) {
      idempotentMutationResponses.delete(scopedKey);
    }

    return response;
  } catch (error) {
    idempotentMutationResponses.delete(scopedKey);
    throw error;
  }
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
};
