import { NextRequest, NextResponse } from "next/server";

function buildBackendUrl(path: string): string {
  const raw = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  const base = raw.replace(/\/api\/?$/, "").replace(/\/$/, "");
  return `${base}/api${path.startsWith("/") ? path : `/${path}`}`;
}

export async function GET(request: NextRequest) {
  const tokenParam = request.nextUrl.searchParams.get("t");
  const authHeader = request.headers.get("authorization");
  const auth = authHeader || (tokenParam ? `Bearer ${tokenParam}` : null);

  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = buildBackendUrl("/qr/me/image");
  console.log("[qr/image] Fetching:", url);
  console.log("[qr/image] Auth header present:", !!auth);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: auth,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });

    console.log("[qr/image] Response status:", response.status);
    console.log("[qr/image] Response content-type:", response.headers.get("content-type"));

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.log("[qr/image] Error body:", text);
      return new NextResponse(text || "No se pudo obtener el código QR", {
        status: response.status,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const contentType = response.headers.get("content-type") || "image/png";

    if (contentType.includes("application/json")) {
      const json = await response.json();
      console.log("[qr/image] JSON response:", JSON.stringify(json));
      const imgUrl = json.image_url || json.qr_url;
      if (imgUrl) {
        return NextResponse.redirect(imgUrl);
      }
      return NextResponse.json({ error: "Sin imagen" }, { status: 404 });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log("[qr/image] Image size:", buffer.length, "bytes");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[qr/image] Error:", error);
    return NextResponse.json(
      { error: "Error al obtener el código QR" },
      { status: 500 }
    );
  }
}
