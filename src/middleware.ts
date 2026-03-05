import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Captura los headers de Cloudflare
  const city = request.headers.get('cf-ipcity');

  console.log('Middleware running. City:', city || 'None', 'URL:', request.url);

  if (city) {
    // IMPORTANTE: httpOnly debe ser false para que tu JS lo pueda leer
    response.cookies.set('user_city', city, { httpOnly: false, path: '/' });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
