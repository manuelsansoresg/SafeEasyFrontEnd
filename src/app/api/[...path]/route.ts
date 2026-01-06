import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8080';

async function handler(request: NextRequest, { params }: { params: { path: string[] } }) {
  // Await the params object
  const { path } = await Promise.resolve(params);
  const pathString = path.join('/');
  
  // Backend requires trailing slash for some endpoints (FastAPI default behavior sometimes)
  // If pathString doesn't end with slash and no query params, maybe add it?
  // But let's check query params first.
  
  let targetUrl = `${BASE_URL}/${pathString}`;
  
  // Append trailing slash if it's likely a collection resource and missing it, 
  // but be careful not to break IDs like /suppliers/1
  // The redirect was /suppliers?skip.. -> /suppliers/?skip...
  // So if we are hitting a root resource without ID, we might need a slash.
  
  if (!pathString.includes('.') && !targetUrl.endsWith('/')) {
      // Very naive check: if the last part is not a number, add slash?
      // Or just rely on 'redirect: follow' added below.
      // Let's rely on redirect: follow for now, but if it fails for POST, we might need to force slash.
  }

  targetUrl += request.nextUrl.search;

  console.log(`[Generic Proxy] Forwarding ${request.method} request to: ${targetUrl}`);

  try {
    const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
    
    let response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Content-Type': request.headers.get('Content-Type') || 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
        'accept': 'application/json',
      },
      body,
      redirect: 'follow', // Ensure fetch follows redirects
    });

    // Manually handle 307 if fetch doesn't follow (sometimes happens with POST/PUT in node-fetch depending on version)
    // But standard fetch should follow. However, let's check if we got a redirect and just return it to browser or follow it.
    // If backend returns 307 to a URL with trailing slash, we should probably just return the response
    // and let the browser follow, OR follow it here.
    
    // Better: Fix the target URL to include trailing slash if missing? 
    // The curl showed redirect from /suppliers to /suppliers/
    // Let's try to detect if we need a trailing slash or just follow.
    
    console.log(`[Generic Proxy] Response status: ${response.status}`);

    const data = await response.text();
    
    // Attempt to parse JSON to ensure we're returning valid JSON if possible, 
    // but returning text/blob is fine too depending on content-type.
    // For now, let's just return the body with the correct status and headers.
    
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
