import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // 1. Intentar obtener la ciudad de los headers de Cloudflare
  let city = request.headers.get('cf-ipcity');
  let country = request.headers.get('cf-ipcountry');

  // 2. Fallback: Intentar obtener la ciudad de los headers de Vercel (si Cloudflare falla o no está)
  if (!city) {
    city = request.headers.get('x-vercel-ip-city');
    country = request.headers.get('x-vercel-ip-country');
  }

  // Log para depuración en el servidor (Vercel/Cloudflare logs)
  console.log('Middleware running.');
  console.log('Headers City:', city || 'None');
  console.log('Headers Country:', country || 'None');
  console.log('URL:', request.url);

  // Cookie de depuración para verificar que el middleware se ejecutó
  response.cookies.set('mw_debug', 'active', { httpOnly: false, path: '/' });

  if (city) {
    // Decodificar por si viene con caracteres especiales
    try {
      city = decodeURIComponent(city);
    } catch (e) {
      console.error('Error decoding city:', e);
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
