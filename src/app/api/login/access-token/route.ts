import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 1. Obtener la URL base. Prioridad: Variable de entorno -> Fallback local
    // Nota: Usamos 127.0.0.1:8080 como fallback porque parece ser el puerto del backend en el servidor
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8080';
    const targetUrl = `${baseUrl}/login/access-token`;

    console.log(`[API Proxy] Intentando conectar a: ${targetUrl}`);

    // 2. Leer el cuerpo de la petición (form-urlencoded)
    const contentType = request.headers.get('content-type') || 'application/x-www-form-urlencoded';
    const bodyText = await request.text();

    // 3. Hacer la petición al backend real
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        'accept': 'application/json',
      },
      body: bodyText,
    });

    console.log(`[API Proxy] Respuesta del backend: ${response.status} ${response.statusText}`);

    // 4. Leer la respuesta del backend
    // Intentamos leer como texto primero por si no es JSON válido (ej. error HTML de Nginx)
    const responseText = await response.text();
    
    let data;
    try {
        data = JSON.parse(responseText);
    } catch (e) {
        console.error('[API Proxy] La respuesta no es JSON válido:', responseText.substring(0, 200));
        // Si no es JSON, devolvemos el texto como error genérico o tal cual
        return NextResponse.json(
            { error: 'Invalid JSON response from backend', details: responseText.substring(0, 200) }, 
            { status: response.status >= 400 ? response.status : 500 }
        );
    }

    // 5. Devolver la respuesta al cliente
    return NextResponse.json(data, { status: response.status });

  } catch (error: any) {
    console.error('[API Proxy] Error interno:', error);
    return NextResponse.json(
      { 
        error: 'Internal Server Error (Proxy)', 
        message: error.message,
        cause: error.cause ? String(error.cause) : undefined
      }, 
      { status: 500 }
    );
  }
}
