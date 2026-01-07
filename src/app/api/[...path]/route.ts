import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8080';

async function handler(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  // Await the params object
  const { path } = await params;
  
  // Construct target URL
  // We prefer using the incoming pathname to preserve trailing slashes that Next.js params might strip
  const pathname = request.nextUrl.pathname;
  // pathname starts with /api/... 
  // We want to append everything after /api/ to BASE_URL
  
  let relativePath = pathname.replace(/^\/api\//, '');
  // If the replace didn't work (e.g. path is just /api), fall back to params
  if (relativePath === pathname) {
      relativePath = path.join('/');
  }

  let targetUrl = `${BASE_URL}/${relativePath}`;
  
  // Backend requires trailing slash for some endpoints (FastAPI default behavior sometimes)
  // If the original request didn't have a slash, but it's a known collection, force it.
  const pathString = path.join('/');
  if ((pathString.endsWith('users') || pathString.endsWith('products') || pathString.endsWith('suppliers')) && !targetUrl.endsWith('/')) {
      targetUrl += '/';
  }
  
  targetUrl += request.nextUrl.search;

  console.log(`[Generic Proxy] Forwarding ${request.method} request to: ${targetUrl}`);
  const authHeader = request.headers.get('Authorization') || '';
  console.log(`[Generic Proxy] Auth Header Present: ${!!authHeader} (Length: ${authHeader.length})`);

  try {
    // Use blob to handle body safely for both text and binary (multipart)
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.blob();
    
    // Explicitly construct headers to ensure nothing is lost
    const forwardHeaders = new Headers();
    if (request.headers.get('Content-Type')) {
        forwardHeaders.set('Content-Type', request.headers.get('Content-Type')!);
    }
    if (request.headers.get('Authorization')) {
        forwardHeaders.set('Authorization', request.headers.get('Authorization')!);
    }
    forwardHeaders.set('accept', 'application/json');

    const fetchOptions: RequestInit = {
      method: request.method,
      headers: forwardHeaders,
      body,
      redirect: 'manual', // Do not follow redirects automatically
      cache: 'no-store',
    };

    console.log(`[Generic Proxy] Fetching ${targetUrl} with Auth: ${!!forwardHeaders.get('Authorization')}`);

    let response = await fetch(targetUrl, fetchOptions);

    console.log(`[Generic Proxy] Response status: ${response.status}`);

    // Manually follow redirect (once) to preserve Authorization header
    if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('Location');
        if (location) {
             console.log(`[Generic Proxy] Redirect detected to: ${location}`);
             
             let newUrlString = location;
             if (!location.startsWith('http')) {
                 const baseUrlObj = new URL(targetUrl);
                 newUrlString = new URL(location, baseUrlObj).toString();
             }
             
             console.log(`[Generic Proxy] Following redirect manually to: ${newUrlString}`);
             
             response = await fetch(newUrlString, fetchOptions);
             console.log(`[Generic Proxy] Followed response status: ${response.status}`);
        }
    }

    const data = await response.text();
    
    if (!response.ok) {
        console.error(`[Generic Proxy] Backend error ${response.status} for ${targetUrl}:`, data);
        
        // Return debug info to frontend for ANY error
        // We wrap the backend error in our own JSON if it's not a successful response
        return new NextResponse(JSON.stringify({
             error_source: "proxy_debug",
             status: response.status,
             detail: "Backend returned error",
             backend_response: data, // Include the raw backend response
             debug_target_url: targetUrl,
             debug_auth_header_sent: !!forwardHeaders.get('Authorization'),
             debug_auth_header_len: (forwardHeaders.get('Authorization') || '').length
        }), { 
            status: response.status, 
            headers: { 'Content-Type': 'application/json' } 
        });
    }
    
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    });

  } catch (error: any) {
    console.error(`[Generic Proxy] Error forwarding request to ${targetUrl}:`, error);
    
    // Return a structured error response that the frontend can parse
    return NextResponse.json(
      { 
        error: 'Proxy Error', 
        message: error.message || 'Unknown proxy error',
        cause: error.cause ? String(error.cause) : undefined
      },
      { status: 502 } // 502 Bad Gateway is appropriate for proxy errors
    );
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
