import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type BackendCandidate = {
  baseUrl: string;
  source: "internal" | "public" | "fallback";
};

function sanitizeBaseUrl(value: string | undefined) {
  const trimmed = String(value || "").trim();
  const unwrapped = trimmed
    .replace(/^['"`]+/, "")
    .replace(/['"`]+$/, "")
    .trim();

  return unwrapped.replace(/\/+$/, "");
}

function withoutApiSuffix(value: string) {
  return value.replace(/\/api\/?$/i, "");
}

function withApiSuffix(value: string) {
  const normalized = sanitizeBaseUrl(value);
  if (!normalized) return normalized;

  return /\/api$/i.test(normalized)
    ? normalized
    : `${normalized}/api`;
}

function pushCandidate(
  candidates: BackendCandidate[],
  baseUrl: string,
  source: BackendCandidate["source"],
) {
  const normalized = sanitizeBaseUrl(baseUrl);
  if (!normalized || normalized.startsWith("/")) return;

  if (
    candidates.some(
      (candidate) => candidate.baseUrl === normalized,
    )
  ) {
    return;
  }

  candidates.push({
    baseUrl: normalized,
    source,
  });
}

/**
 * IMPORTANTE:
 *
 * FastAPI expone internamente rutas como /menu-orders y
 * /public/menu-orders. ROOT_PATH=/api sirve para el proxy
 * externo, pero no convierte la ruta interna en /api/menu-orders.
 *
 * Por eso API_INTERNAL_URL debe probarse primero TAL CUAL.
 * También probamos su variante con/sin /api para que el gateway
 * sea tolerante a configuraciones antiguas del servidor.
 */
function backendCandidates(): BackendCandidate[] {
  const candidates: BackendCandidate[] = [];

  const internal = sanitizeBaseUrl(
    process.env.API_INTERNAL_URL,
  );

  if (internal) {
    pushCandidate(candidates, internal, "internal");

    if (/\/api$/i.test(internal)) {
      pushCandidate(
        candidates,
        withoutApiSuffix(internal),
        "internal",
      );
    } else {
      pushCandidate(
        candidates,
        withApiSuffix(internal),
        "internal",
      );
    }
  }

  const publicUrl = sanitizeBaseUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL,
  );

  if (publicUrl && !publicUrl.startsWith("/")) {
    pushCandidate(
      candidates,
      withApiSuffix(publicUrl),
      "public",
    );

    // Si ya venía con /api, también conservamos exactamente
    // el valor configurado; pushCandidate evita duplicados.
    pushCandidate(
      candidates,
      publicUrl,
      "public",
    );
  }

  pushCandidate(
    candidates,
    "https://drooopy.com/api",
    "fallback",
  );

  return candidates;
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

async function isGenericRouteNotFound(
  response: Response,
): Promise<boolean> {
  if (response.status !== 404) return false;

  const raw = await response
    .clone()
    .text()
    .catch(() => "");

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
      parsed.detail ??
        parsed.message ??
        parsed.error ??
        "",
    )
      .trim()
      .toLowerCase();

    return (
      detail === "not found" ||
      detail === "404 not found"
    );
  } catch {
    return false;
  }
}

async function handler(
  request: NextRequest,
  context: {
    params: Promise<{ path: string[] }>;
  },
) {
  const { path } = await context.params;
  const parts = Array.isArray(path) ? path : [];

  if (!parts.length) {
    return NextResponse.json(
      {
        detail:
          "Menu order path is required",
      },
      { status: 400 },
    );
  }

  const scope = parts[0];
  const rest = parts.slice(1);

  let backendPath = "";

  if (scope === "public") {
    if (!rest.length) {
      return NextResponse.json(
        {
          detail:
            "Public menu order path is required",
        },
        { status: 400 },
      );
    }

    backendPath =
      `/public/menu-orders/${rest.join("/")}`;
  } else if (scope === "private") {
    backendPath = rest.length
      ? `/menu-orders/${rest.join("/")}`
      : "/menu-orders";
  } else {
    return NextResponse.json(
      {
        detail:
          "Invalid menu order gateway scope",
      },
      { status: 400 },
    );
  }

  const query = request.nextUrl.search;
  const headers = copyHeaders(request);
  const methodHasBody = ![
    "GET",
    "HEAD",
  ].includes(request.method);

  const bufferedBody = methodHasBody
    ? await request.arrayBuffer()
    : undefined;

  let lastError: unknown = null;
  let sawGeneric404 = false;

  for (const candidate of backendCandidates()) {
    const target =
      `${candidate.baseUrl}${backendPath}${query}`;

    try {
      const response = await fetch(target, {
        method: request.method,
        headers,
        body: bufferedBody
          ? bufferedBody.slice(0)
          : undefined,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(30000),
      });

      // Un 404 genérico significa normalmente que se llegó a
      // FastAPI/NGINX, pero a una base incorrecta o a una versión
      // desplegada que no contiene el router. En ese caso probamos
      // el siguiente candidato en lugar de devolver "Not Found".
      if (await isGenericRouteNotFound(response)) {
        sawGeneric404 = true;
        lastError = new Error(
          `Menu order route not found using ${candidate.source} backend: ${target}`,
        );
        continue;
      }

      if (
        [
          502,
          503,
          504,
          520,
          521,
          522,
          523,
          524,
        ].includes(response.status)
      ) {
        lastError = new Error(
          `Menu order upstream returned ${response.status}: ${target}`,
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

  console.error(
    "[Menu Orders Gateway] Upstream error:",
    lastError,
  );

  return NextResponse.json(
    {
      detail: sawGeneric404
        ? "El servicio de pedidos de menú no está disponible en la versión del backend que está ejecutándose. Actualiza y reinicia el backend."
        : "No se pudo conectar con el servicio de pedidos de menú.",
    },
    { status: 502 },
  );
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
