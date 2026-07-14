import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthPost } from '@/app/api/login/_authProxy';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');

    return proxyAuthPost(request, {
      endpoint: "/login/refresh-token",
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        ...(authHeader ? { 'Authorization': authHeader } : {})
      },
    });

  } catch (error: unknown) {
    console.error('[API Proxy] Error refreshing token:', error);
    const message =
      error && typeof error === "object" && "message" in error && typeof (error as Record<string, unknown>).message === "string"
        ? String((error as Record<string, unknown>).message)
        : "Unknown error";
    return NextResponse.json(
      { error: 'Internal Server Error', message }, 
      { status: 500 }
    );
  }
}
