import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://3.15.176.110:8080';

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathString = path.join('/');
  const targetUrl = `${BASE_URL}/static/${pathString}`;

  try {
    const response = await fetch(targetUrl);

    if (!response.ok) {
      return new NextResponse(`Error fetching static asset: ${response.statusText}`, { status: response.status });
    }

    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    const blob = await response.blob();

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error(`Error proxying static asset ${targetUrl}:`, error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
