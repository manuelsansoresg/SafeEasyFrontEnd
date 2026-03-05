import { NextRequest, NextResponse } from 'next/server';

const getBaseUrl = () => {
  const internal = process.env.API_INTERNAL_URL;
  if (internal) return internal;
  
  const publicUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  // Prevent loop if public URL points to localhost/proxy
  if (publicUrl && !publicUrl.includes('localhost') && !publicUrl.startsWith('/')) {
      return publicUrl;
  }
  
  return 'https://drooopy.com/api/';
};

const BASE_URL = getBaseUrl();

async function handler(request: NextRequest) {
  // Use pathname directly to avoid params ambiguity
  const pathname = request.nextUrl.pathname;
  
  // Remove /api prefix
  let relativePath = pathname.replace(/^\/api/, '');
  
  // Remove /backend prefix if present (common misconfiguration or legacy rewrite artifact)
  if (relativePath.startsWith('/backend')) {
      relativePath = relativePath.replace(/^\/backend/, '');
  }
  
  // Ensure relativePath starts with / if it's not empty
  if (relativePath && !relativePath.startsWith('/')) {
      relativePath = '/' + relativePath;
  }
  
  // Normalize base URL to remove trailing slashes
  const baseUrl = BASE_URL.replace(/\/+$/, '');
  
  // Construct target URL
  let targetUrl = `${baseUrl}${relativePath}`;

  // Fix double slashes in path (but keep protocol slashes)
  // This handles cases where relativePath might start with multiple slashes
  targetUrl = targetUrl.replace(/([^:])\/{2,}/g, '$1/');
  
  // Backend requires trailing slash for some endpoints (FastAPI default behavior sometimes)
  // If the original request didn't have a slash, but it's a known collection, force it.
  if ((targetUrl.endsWith('users') || targetUrl.endsWith('products') || targetUrl.endsWith('suppliers')) && !targetUrl.endsWith('/')) {
      targetUrl += '/';
  }
  
  // Append query string (search params)
  targetUrl += request.nextUrl.search;

  console.log(`[Generic Proxy] Forwarding ${request.method} request to: ${targetUrl}`);

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
    // Also exclude geolocation headers to prevent backend from auto-filtering based on IP headers
    // We want to control filtering explicitly via query parameters (e.g. ?location=...)
    const headersToExclude = [
        'host', 
        'content-length', 
        'connection', 
        'transfer-encoding',
        'x-vercel-ip-city',
        'x-vercel-ip-country',
        'cf-ipcity',
        'cf-ipcountry'
    ];

    request.headers.forEach((value, key) => {
        const lowerKey = key.toLowerCase();
        if (!headersToExclude.includes(lowerKey)) {
            if (lowerKey === 'cookie') {
                // Remove user_city and user_country cookies to prevent unwanted filtering
                const cookies = value.split(';').filter(c => 
                    !c.trim().startsWith('user_city=') && 
                    !c.trim().startsWith('user_country=')
                ).join(';');
                if (cookies.trim()) {
                    forwardHeaders.set(key, cookies);
                }
            } else {
                forwardHeaders.set(key, value);
            }
        }
    });

    // Hint backend that original request is secure behind proxy
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

             // Force HTTPS for redirects to avoid downgrade loops (Cloudflare/Backend misconfig)
             if (newUrlString.startsWith('http:')) {
                 console.log(`[Generic Proxy] Upgrading redirect to HTTPS: ${newUrlString}`);
                 newUrlString = newUrlString.replace('http:', 'https:');
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

    // For binary GETs (videos, images, etc.), stream the body and preserve headers
    if (isBinaryGet) {
      const headers = new Headers();
      response.headers.forEach((v, k) => {
        const lowerKey = k.toLowerCase();
        if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
            headers.set(k, v);
        }
      });
      return new NextResponse(response.body, {
        status: response.status,
        headers
      });
    }

    // For non-binary or non-GET, read as text to maintain existing debug behavior
    const data = await response.text();
    
    // Only return error JSON if status is truly an error and not just 404/401 that client handles
    // Actually, client expects standard HTTP responses. 
    // If we wrap 404 in a JSON structure that client doesn't expect, it might break.
    // Let's return the body as is, but log it.
    
    if (!response.ok) {
      console.error(`[Generic Proxy] Backend error ${response.status} for ${targetUrl}`);
      // Don't modify body for 404/401 etc as client might parse it
    }

    const headers = new Headers();
    response.headers.forEach((v, k) => {
        const lowerKey = k.toLowerCase();
        // Remove compression headers since we've already decompressed the body (via .text())
        if (!['content-encoding', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
            headers.set(k, v);
        }
    });
    
    // Ensure Content-Type is set if missing (e.g. for empty 204)
    // But if it's JSON, ensure it says so.
    if (!headers.get('Content-Type') && data && (data.startsWith('{') || data.startsWith('['))) {
       headers.set('Content-Type', 'application/json');
    }

    return new NextResponse(data, {
      status: response.status,
      headers
    });

  } catch (error: any) {
    console.error(`[Generic Proxy] Error forwarding request to ${targetUrl}:`, error);
    return NextResponse.json({
      error: 'Proxy Error',
      message: error?.message || 'Unknown proxy error',
    }, { status: 502 });
  }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE, handler as PATCH };
