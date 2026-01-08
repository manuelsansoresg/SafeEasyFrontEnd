import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://3.15.176.110:8080';
    const targetUrl = `${baseUrl}/login/access-token`;

    console.log(`[API Proxy] ------------------------------------------------`);
    console.log(`[API Proxy] Request entrante para: ${targetUrl}`);

    // Leer el cuerpo de la petición
    const contentType = request.headers.get('content-type') || 'application/x-www-form-urlencoded';
    const bodyText = await request.text();
    
    console.log(`[API Proxy] Body enviado al backend (${bodyText.length} chars):`, bodyText);

    // Hacer la petición al backend real
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'accept': 'application/json',
      },
      body: bodyText,
    });

    console.log(`[API Proxy] Status backend: ${response.status} ${response.statusText}`);

    const responseText = await response.text();
    console.log(`[API Proxy] Respuesta backend raw:`, responseText);

    let data;
    try {
        data = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
        console.error('[API Proxy] Error parseando JSON del backend:', e);
        // Si falla el parseo, devolvemos el texto en un objeto de error para que el frontend vea algo
        data = { 
            error: 'Invalid JSON from backend', 
            raw_response: responseText,
            status: response.status
        };
    }

    // Asegurarnos de que devolvemos un JSON válido
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
