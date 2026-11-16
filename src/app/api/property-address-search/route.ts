import { NextRequest, NextResponse } from "next/server";
import { validPropertyCoordinates } from "@/lib/propertyLocation";

const resultLimit = 5;

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 4 || query.length > 160) {
    return NextResponse.json({ error: "Escribe entre 4 y 160 caracteres." }, { status: 400 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Inicia sesión para buscar direcciones." }, { status: 401 });
  }

  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "El buscador de direcciones no está disponible." }, { status: 503 });
  }

  try {
    const backend = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL ||
      "https://drooopy.com/api").trim().replace(/\/+$/, "");
    const session = await fetch(`${backend}/users/me`, {
      headers: { Authorization: authorization },
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(4000)]),
    });
    if (session.status === 401 || session.status === 403) {
      return NextResponse.json({ error: "Sesión sin acceso al buscador." }, { status: session.status });
    }
    if (!session.ok) throw new Error("Session lookup failed");

    const { role }: { role?: string } = await session.json();
    if (role !== "admin" && role !== "supplier") {
      return NextResponse.json({ error: "Sesión sin acceso al buscador." }, { status: 403 });
    }

    const params = new URLSearchParams({
      text: query,
      format: "json",
      lang: "es",
      bias: "proximity:-89.5926,20.9674",
      limit: String(resultLimit),
      apiKey,
    });
    const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params}`, {
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(5000)]),
    });
    if (!response.ok) throw new Error("Address search failed");

    const { results }: { results?: Array<{ lat: number; lon: number; formatted: string }> } = await response.json();
    if (!Array.isArray(results)) throw new Error("Invalid address response");

    return NextResponse.json({
      results: results.slice(0, resultLimit)
        .filter(({ lat, lon, formatted }) =>
          validPropertyCoordinates(lat, lon) && typeof formatted === "string" &&
          formatted.trim().length > 0 && formatted.length <= 500,
        )
        .map(({ lat, lon, formatted }) => ({ lat, lng: lon, address: formatted.trim() })),
    });
  } catch {
    return NextResponse.json({ error: "El buscador de direcciones no está disponible." }, { status: 503 });
  }
}
