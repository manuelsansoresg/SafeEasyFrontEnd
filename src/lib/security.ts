const MERCADO_PAGO_HOSTS = [
  "mercadopago.com",
  "mercadopago.com.mx",
  "mpago.la",
];

const TRUSTED_ASSET_HOSTS = [
  "drooopy.com",
  "www.drooopy.com",
  "drooopy-storage.s3.us-east-1.amazonaws.com",
];

const hasAllowedHost = (hostname: string, allowedHosts: string[]) => {
  const normalized = hostname.toLowerCase();
  return allowedHosts.some((host) => normalized === host || normalized.endsWith(`.${host}`));
};

export function isSafeMercadoPagoUrl(url: string | null | undefined) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && hasAllowedHost(parsed.hostname, MERCADO_PAGO_HOSTS);
  } catch {
    return false;
  }
}

export function getSafeMercadoPagoUrl(url: string | null | undefined) {
  if (!url || !isSafeMercadoPagoUrl(url)) return "";
  return url;
}

export function getTrustedAssetUrl(url: string | null | undefined) {
  if (!url) return "";
  if (url.startsWith("blob:")) return url;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return "";
    return hasAllowedHost(parsed.hostname, TRUSTED_ASSET_HOSTS) ? parsed.toString() : "";
  } catch {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
    return `${apiBase.replace(/\/$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
  }
}
