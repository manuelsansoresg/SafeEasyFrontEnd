import { NextRequest, NextResponse } from 'next/server';

const sanitizeBaseUrl = (value: string | undefined) => {
  const trimmed = String(value || "").trim();
  const unwrapped = trimmed.replace(/^['"`]+/, "").replace(/['"`]+$/, "").trim();
  return unwrapped.replace(/\/+$/, "");
};

export async function POST(request: NextRequest) {
  try {
    const baseUrl =
      sanitizeBaseUrl(process.env.API_INTERNAL_URL) ||
      sanitizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL) ||
      'https://drooopy.com/api';
    const targetUrl = `${baseUrl}/login/access-token`;

    // Leer el cuerpo de la petición
    const contentType = request.headers.get('content-type') || 'application/x-www-form-urlencoded';
    const bodyText = await request.text();

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'accept': 'application/json',
      },
      body: bodyText,
    });

    const responseText = await response.text();
    let data;
    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
        console.error('[API Proxy] Error parseando JSON del backend:', e);
        data = { 
            error: 'Invalid JSON from backend', 
            raw_response: responseText,
            status: response.status
        };
    }

    return NextResponse.json(data, { status: response.status });

  } catch (error: any) {
    console.error('[API Proxy] Error CRÍTICO en el proxy:', error);
    return NextResponse.json(
      { 
        error: 'Internal Server Error (Proxy)', 
        message: error.message,
        details: error.toString()
      }, 
      { status: 500 }
    );
  }
}
