import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthPost } from '@/app/api/login/_authProxy';

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();

    return proxyAuthPost(request, {
      endpoint: "/login/password-reset/confirm",
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: bodyText,
    });

  } catch (error: unknown) {
    console.error('[API Proxy] Error en password-reset/confirm:', error);
    const message =
      error && typeof error === "object" && "message" in error && typeof (error as Record<string, unknown>).message === "string"
        ? String((error as Record<string, unknown>).message)
        : "Unknown error";
    return NextResponse.json(
      {
        error: 'Internal Server Error (Proxy)',
        message,
        details: String(error)
      },
      { status: 500 }
    );
  }
}
