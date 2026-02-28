import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'https://drooopy.com/api/';

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
  if ((pathString.endsWith('users') || pathString.endsWith('products') || pathString.endsWith('suppliers')) && !targetUrl.endsWith('/')) {
      targetUrl += '/';
  }
  
  // Append query string (search params)
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

    // Hint backend that original request is secure behind proxy (fixes 'solicitó el recurso de forma no segura')
    forwardHeaders.set('X-Forwarded-Proto', 'https');
    if (!forwardHeaders.has('X-Requested-With')) {
        forwardHeaders.set('X-Requested-With', 'XMLHttpRequest');
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

    const respContentType = response.headers.get('Content-Type') || '';
    const isBinaryGet =
      request.method === 'GET' &&
      !respContentType.includes('application/json') &&
      (respContentType.startsWith('video/') ||
       respContentType.startsWith('image/') ||
       respContentType === 'application/octet-stream' ||
       respContentType.startsWith('application/zip') ||
       respContentType.startsWith('audio/'));

    // For binary GETs (videos, images, etc.), stream the body and preserve headers (Range support)
    if (isBinaryGet) {
      const headers = new Headers();
      response.headers.forEach((v, k) => headers.set(k, v));
      return new NextResponse(response.body, {
        status: response.status,
        headers
      });
    }

    // For non-binary or non-GET, read as text to maintain existing debug behavior
    const data = await response.text();
    if (!response.ok) {
      console.error(`[Generic Proxy] Backend error ${response.status} for ${targetUrl}:`, data);
      return new NextResponse(JSON.stringify({
        error_source: "proxy_debug",
        status: response.status,
        detail: "Backend returned error",
        backend_response: data,
        debug_target_url: targetUrl,
        debug_auth_header_sent: !!forwardHeaders.get('Authorization'),
        debug_auth_header_len: (forwardHeaders.get('Authorization') || '').length
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const headers = new Headers();
    response.headers.forEach((v, k) => headers.set(k, v));
    if (!headers.get('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return new NextResponse(data, {
      status: response.status,
      headers
    });

  } catch (error: any) {
    console.error(`[Generic Proxy] Error forwarding request to ${targetUrl}:`, error);

    const errorPayload: Record<string, unknown> = {
      error: 'Proxy Error',
      message: error?.message || 'Unknown proxy error',
    };

    if (error?.name) {
      errorPayload.name = error.name;
    }

    if (typeof error?.code !== 'undefined') {
      errorPayload.code = String(error.code);
    }

    if (error?.cause) {
      errorPayload.cause = String(error.cause);
    }

    return NextResponse.json(errorPayload, { status: 502 });
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
