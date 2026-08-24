import { NextRequest, NextResponse } from "next/server";

const getBaseUrl = () => {
  const internal = process.env.API_INTERNAL_URL?.trim().replace(/\/+$/, "");
  if (internal) return internal;
  const publicUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (publicUrl) return publicUrl;
  if (process.env.NODE_ENV !== "production") return "http://localhost:8000";
  return "https://drooopy.com/api";
};

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");

    const baseUrl = getBaseUrl();
    const targetUrl = `${baseUrl}/account/deletion-request`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (authHeader) headers["Authorization"] = authHeader;

    const response = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: "{}",
      cache: "no-store",
    });

    const responseText = await response.text();
    let data: unknown;
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { error: "Invalid JSON from backend", raw_response: responseText };
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error: unknown) {
    const message =
      error && typeof error === "object" && "message" in error && typeof (error as Record<string, unknown>).message === "string"
        ? String((error as Record<string, unknown>).message)
        : "Unknown error";
    return NextResponse.json(
      { error: "Proxy Error", message },
      { status: 502 },
    );
  }
}
