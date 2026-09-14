type SearchParamsLike = Pick<URLSearchParams, "toString">;

const FALLBACK_ORIGIN = "https://internal.drooopy.invalid";
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;
const ENCODED_BACKSLASH = /%5c/i;

function getValidationOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return FALLBACK_ORIGIN;
}

export function isSafeInternalRedirect(
  value: string | null | undefined,
): value is string {
  if (!value || CONTROL_CHARACTERS.test(value)) return false;
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes("\\") || ENCODED_BACKSLASH.test(value)) return false;

  try {
    const origin = getValidationOrigin();
    const destination = new URL(value, origin);

    return (
      destination.origin === origin &&
      destination.pathname.startsWith("/") &&
      !destination.pathname.startsWith("//") &&
      !destination.pathname.includes("\\")
    );
  } catch {
    return false;
  }
}

export function sanitizeInternalRedirect(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!isSafeInternalRedirect(value)) return fallback;

  const destination = new URL(value, getValidationOrigin());
  return destination.pathname + destination.search + destination.hash;
}

export function getLoginUrl(returnTo: string): string {
  const safeReturnTo = sanitizeInternalRedirect(returnTo);
  return `/login?redirect=${encodeURIComponent(safeReturnTo)}`;
}

export function getCurrentPathWithSearch(
  pathname: string,
  searchParams: SearchParamsLike,
): string {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function getBrowserPathWithSearchAndHash(): string {
  if (typeof window === "undefined") return "/";

  return sanitizeInternalRedirect(
    window.location.pathname + window.location.search + window.location.hash,
  );
}
