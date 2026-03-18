import { NextRequest, NextResponse } from 'next/server';

const sanitizeBaseUrl = (value: string | undefined) => {
  const trimmed = String(value || "").trim();
  const unwrapped = trimmed.replace(/^['"`]+/, "").replace(/['"`]+$/, "").trim();
  return unwrapped.replace(/\/+$/, "");
};

export async function POST(request: NextRequest) {
  try {
    const baseUrl =
      sanitizeBaseUrl(process.env.API_INTERNAL_URL) ||
      sanitizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL) ||
      'https://drooopy.com/api';
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
