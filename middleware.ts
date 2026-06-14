import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/api/mercadopago/callback' || pathname.startsWith('/api/mercadopago/callback/')) {
    return NextResponse.next();
  }
  const host = request.nextUrl.hostname;
  const isProd = process.env.NODE_ENV === "production";
  const debugMiddleware = process.env.NEXT_PUBLIC_MIDDLEWARE_DEBUG === "true";
  if (isProd && host === "www.drooopy.com") {
    const url = request.nextUrl.clone();
    url.hostname = "drooopy.com";
    url.protocol = "https:";
    return NextResponse.redirect(url);
  }
  const response = NextResponse.next();
  
  // 1. Intentar obtener la ciudad de los headers de Cloudflare
  let city = request.headers.get('cf-ipcity');
  let country = request.headers.get('cf-ipcountry');

  // 2. Fallback: Intentar obtener la ciudad de los headers de Vercel (si Cloudflare falla o no está)
  if (!city) {
    city = request.headers.get('x-vercel-ip-city');
    country = request.headers.get('x-vercel-ip-country');
  }

  if (debugMiddleware) {
    const debugInfo = JSON.stringify({
      cf_city: request.headers.get('cf-ipcity') || 'null',
      cf_country: request.headers.get('cf-ipcountry') || 'null',
      vercel_city: request.headers.get('x-vercel-ip-city') || 'null',
      vercel_country: request.headers.get('x-vercel-ip-country') || 'null',
      url: request.url
    });

    response.cookies.set('mw_debug_headers', debugInfo, { httpOnly: false, path: '/' });
    response.cookies.set('mw_debug', 'active', { httpOnly: false, path: '/' });
    console.log('[Middleware] Geo headers', { city: city || null, country: country || null, url: request.url });
  } else {
    response.cookies.delete('mw_debug_headers');
    response.cookies.delete('mw_debug');
  }

  if (city) {
    // Decodificar por si viene con caracteres especiales
    // Cloudflare envía caracteres latinos codificados en ISO-8859-1 o UTF-8 a veces extraño.
    // Usamos encodeURIComponent para asegurar que la cookie sea válida y luego decode en el cliente.
    try {
        // Intento simple de limpieza de caracteres raros si es necesario, 
        // pero lo más seguro para cookies es codificarlo
        city = encodeURIComponent(city);
    } catch (e) {
      console.error('Error encoding city:', e);
    }

    // IMPORTANTE: httpOnly: false para que el cliente (JS) pueda leerla
    response.cookies.set('user_city', city, { 
      httpOnly: false, 
      path: '/',
      secure: process.env.NODE_ENV === 'production', // Solo secure en producción
      sameSite: 'lax'
    });
  }

  if (country) {
     response.cookies.set('user_country', country, { 
      httpOnly: false, 
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
  }

  return response;
}

export const config = {
  matcher: [
    // Excluir rutas de API y estáticas para no sobrecargar
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
