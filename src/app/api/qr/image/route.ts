import { NextRequest, NextResponse } from "next/server";

function getBackendBase(): string {
  if (process.env.API_INTERNAL_URL) {
    return process.env.API_INTERNAL_URL.replace(/\/$/, "");
  }
  const publicBase = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return publicBase.replace(/\/api\/?$/, "").replace(/\/$/, "");
}

export async function GET(request: NextRequest) {
  const tokenParam = request.nextUrl.searchParams.get("t");
  const authHeader = request.headers.get("authorization");
  const auth = authHeader || (tokenParam ? `Bearer ${tokenParam}` : null);

  if (!auth) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const backendBase = getBackendBase();
  const url = `${backendBase}/api/qr/me/image`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: auth,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        { error: text || "No se pudo obtener el código QR" },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "image/png";

    if (contentType.includes("application/json")) {
      const json = await response.json();
      const imgUrl = json.image_url || json.qr_url;
      if (imgUrl) {
        return NextResponse.redirect(imgUrl);
      }
      return NextResponse.json({ error: "Sin imagen" }, { status: 404 });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
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
