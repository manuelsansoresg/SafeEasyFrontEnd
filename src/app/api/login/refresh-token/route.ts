import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://3.15.176.110:8080';
    // Remove trailing slash to avoid 307 redirect
    const targetUrl = `${baseUrl}/login/refresh-token`;

    console.log(`[API Proxy] Refreshing token at: ${targetUrl}`);

    const authHeader = request.headers.get('Authorization');

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {})
      },
    });

    console.log(`[API Proxy] Refresh status: ${response.status}`);

    // Handle non-JSON responses (like 401 with text body)
    const text = await response.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = { message: text };
    }

    return NextResponse.json(data, { status: response.status });

  } catch (error: any) {
    console.error('[API Proxy] Error refreshing token:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message }, 
      { status: 500 }
    );
  }
}
