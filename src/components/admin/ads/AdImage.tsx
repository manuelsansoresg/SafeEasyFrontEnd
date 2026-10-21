"use client";

import { useState } from "react";

export function resolveAdImage(path?: string | null): string | null {
  if (!path?.trim()) return null;
  try {
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api").replace(/\/+$/, "");
    const origin = typeof window === "undefined" ? "https://drooopy.com" : window.location.origin;
    const api = new URL(`${base}/`, origin);
    const url = /^https?:\/\//i.test(path) || path.startsWith("//")
      ? new URL(path, api)
      : path.startsWith("/api/") ? new URL(path, api.origin) : new URL(path.replace(/^\/+/, ""), api);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function AdImage({ src, fallback, alt = "", className = "h-32 w-full" }: {
  src?: string | null; fallback?: string | null; alt?: string; className?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const url = [resolveAdImage(src), resolveAdImage(fallback)].find((value) => value && !failed.includes(value));
  return url ? (
    // Backend media may use external storage domains; preserve the original image.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} loading="lazy" className={`rounded-lg bg-[#f2f3f4] object-contain ${className}`}
      onError={() => setFailed((previous) => [...previous, url])} />
  ) : <span className={`flex items-center justify-center rounded-lg bg-[#f2f3f4] text-xs text-gray-500 ${className}`}>Imagen no disponible</span>;
}
