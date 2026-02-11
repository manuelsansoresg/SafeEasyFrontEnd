import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://3.15.176.110:8080';

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

  // Use URL object to ensure proper encoding of path segments (e.g. spaces)
  let targetUrlObj: URL;
  try {
     targetUrlObj = new URL(relativePath, BASE_URL);
  } catch (e) {
     // Fallback if BASE_URL + relativePath is somehow invalid or relativePath is absolute
     targetUrlObj = new URL(relativePath, 'http://placeholder'); // Should not happen if logic is correct
     console.error("[Generic Proxy] Error constructing URL object:", e);
  }
  
  let targetUrl = targetUrlObj.toString();
  
  // Backend requires trailing slash for some endpoints (FastAPI default behavior sometimes)
  // If the original request didn't have a slash, but it's a known collection, force it.
  const pathString = path.join('/');
  if ((pathString.endsWith('users') || pathString.endsWith('products') || pathString.endsWith('suppliers') || pathString.includes('favorites')) && !targetUrl.endsWith('/')) {
      targetUrl += '/';
  }
  
  // Append query string (search params)
  // targetUrlObj.toString() might already include params if relativePath had them? No, relativePath is path.
  // We use request.nextUrl.search which includes '?'
  
  // Special case: If this is a chat conversation request, we might need to adjust parameters
  // But generally, forwarding query params is correct.
  
  targetUrl += request.nextUrl.search;

  console.log(`[Generic Proxy] Forwarding ${request.method} request to: ${targetUrl}`);
  const authHeader = request.headers.get('Authorization') || '';
  console.log(`[Generic Proxy] Auth Header Present: ${!!authHeader} (Length: ${authHeader.length})`);

  try {
    // Use text for JSON to ensure correct formatting and debugging
    let body: any = undefined;
    const contentType = request.headers.get('Content-Type');
    
    if (!['GET', 'HEAD'].includes(request.method)) {
        if (contentType?.includes('application/json')) {
            const text = await request.text();
            console.log(`[Generic Proxy] Request Body (JSON): ${text}`);
            body = text;
        } else {
            body = await request.blob();
        }
    }
    
    // Explicitly construct headers to ensure nothing is lost
    const forwardHeaders = new Headers();
    
    // Forward all headers except those that are automatically handled or problematic
    request.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (!['host', 'content-length', 'connection', 'transfer-encoding'].includes(lowerKey)) {
            forwardHeaders.set(key, value);
        }
    });

    // Ensure accept is set if not present
    if (!forwardHeaders.has('accept')) {
        forwardHeaders.set('accept', 'application/json');
    }

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
