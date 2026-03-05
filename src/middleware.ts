import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
  // Cloudflare inyecta estas cabeceras.
  // 'cf-ipcity' suele venir en minúsculas en los headers de Request.
  const city = request.headers.get('cf-ipcity');
  const country = request.headers.get('cf-ipcountry');

  if (city) {
    response.cookies.set('user_city', city, { 
      path: '/', 
      sameSite: 'lax', 
      secure: true, 
      httpOnly: false 
    });
  }
  if (country) {
    response.cookies.set('user_country', country, { 
      path: '/', 
      sameSite: 'lax', 
      secure: true, 
      httpOnly: false 
    });
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
