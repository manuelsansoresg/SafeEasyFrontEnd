/** Match the backend's safe advertising destinations, including encoded input. */
export function safeAdDestination(value?: string | null): string | null {
  if (!value || value.length > 500) return null;
  let decoded = value;
  try {
    for (let i = 0; i < 5; i++) {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    if (/[\s\u0000-\u001f\u007f\\]/.test(decoded)) return null;
    if (decoded.startsWith("/")) {
      if (!value.startsWith("/") || decoded.startsWith("//")) return null;
      const path = decoded.split(/[?#]/, 1)[0];
      return path.split("/").some((part) => part === "." || part === "..") ? null : value;
    }
    if (!/^https?:\/\//i.test(value) || !/^https?:\/\//i.test(decoded)) return null;
    const url = new URL(decoded);
    return url.hostname && !url.username && !url.password && ["http:", "https:"].includes(url.protocol) ? value : null;
  } catch {
    return null;
  }
}
