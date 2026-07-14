import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthPost } from '@/app/api/login/_authProxy';

export async function POST(request: NextRequest) {
  try {
    // Leer el cuerpo de la petición
    const contentType = request.headers.get('content-type') || 'application/x-www-form-urlencoded';
    const bodyText = await request.text();

    return proxyAuthPost(request, {
      endpoint: "/login/access-token",
      headers: {
        'Content-Type': contentType,
        'accept': 'application/json',
      },
      body: bodyText,
    });

  } catch (error: unknown) {
    console.error('[API Proxy] Error CRÍTICO en el proxy:', error);
    const message =
      error && typeof error === "object" && "message" in error && typeof (error as Record<string, unknown>).message === "string"
        ? String((error as Record<string, unknown>).message)
        : "Unknown error";
    return NextResponse.json(
      { 
        error: 'Internal Server Error (Proxy)', 
        message,
        details: String(error)
      }, 
      { status: 500 }
    );
  }
}
