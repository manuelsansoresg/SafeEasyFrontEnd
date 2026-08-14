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
      return new NextResponse(text || "No se pudo obtener el código QR", {
        status: response.status,
        headers: { "Content-Type": "text/plain" },
      });
    }

    const json = await response.json();
    const imgUrl = json.qr_image_url || json.image_url || json.qr_url;
    
    if (imgUrl) {
      const resolvedImageUrl = new URL(imgUrl, url).toString();
      const imageResponse = await fetch(resolvedImageUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });

      if (!imageResponse.ok) {
        return NextResponse.json(
          { error: "No se pudo descargar la imagen del código QR" },
          { status: imageResponse.status },
        );
      }

      const contentType = imageResponse.headers.get("content-type");
      return new NextResponse(imageResponse.body, {
        status: 200,
        headers: {
          "Content-Type": contentType?.startsWith("image/")
            ? contentType
            : "image/png",
          "Content-Disposition": request.nextUrl.searchParams.has("download")
            ? 'attachment; filename="qr-empresa.png"'
            : 'inline; filename="qr-empresa.png"',
          "Cache-Control": "private, no-store",
        },
      });
    }
    
    return NextResponse.json({ error: "Sin imagen" }, { status: 404 });
  } catch (error) {
    console.error("[qr/image] Error:", error);
    return NextResponse.json(
      { error: "Error al obtener el código QR" },
      { status: 500 }
    );
  }
}
