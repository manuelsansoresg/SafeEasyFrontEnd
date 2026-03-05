import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Capture location from headers (Vercel or Cloudflare)
  const city = request.headers.get('x-vercel-ip-city') || request.headers.get('cf-ipcity');
  const country = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry');
  
  // Create a response object
  const response = NextResponse.next();

  // If we have a city, store it in a cookie
  // This makes it available to both Server Components (via cookies()) and Client Components
  if (city) {
    // Decode city name as it might be encoded (e.g. M%C3%A9rida)
    const decodedCity = decodeURIComponent(city);
    
    // Set cookie with the city name
    response.cookies.set('user_city', decodedCity, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      sameSite: 'lax',
      httpOnly: false // Allow client-side access
    });
  }
  
  if (country) {
    response.cookies.set('user_country', country, {
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      sameSite: 'lax',
      httpOnly: false // Allow client-side access
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
