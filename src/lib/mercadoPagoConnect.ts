import { fetchWithAuth } from "@/lib/api";

type MercadoPagoConnectPayload = {
  redirect_url?: unknown;
  authorization_url?: unknown;
  auth_url?: unknown;
  url?: unknown;
  detail?: unknown;
  message?: unknown;
};

function getText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getPayloadMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const rec = payload as MercadoPagoConnectPayload;
  return getText(rec.detail) || getText(rec.message);
}

function getRedirectUrl(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const rec = payload as MercadoPagoConnectPayload;
  return (
    getText(rec.redirect_url) ||
    getText(rec.authorization_url) ||
    getText(rec.auth_url) ||
    getText(rec.url)
  );
}

function isSafeConnectUrl(value: string) {
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin === window.location.origin && url.pathname.startsWith("/api/mercadopago/")) return true;
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === "auth.mercadopago.com" ||
      hostname.endsWith(".auth.mercadopago.com") ||
      hostname === "mercadopago.com" ||
      hostname.endsWith(".mercadopago.com") ||
      hostname === "mercadopago.com.mx" ||
      hostname.endsWith(".mercadopago.com.mx")
    );
  } catch {
    return false;
  }
}

function setReturnCookies(accountType: "seller" | "supplier") {
  const currentPath = `${window.location.pathname}${window.location.search || ""}`;
  const fallbackPath = accountType === "seller" ? "/admin/profile" : "/admin/my-company";
  const returnPath = currentPath.startsWith("/admin/") ? currentPath : fallbackPath;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = `mp_connect_return_path=${encodeURIComponent(returnPath)}; Max-Age=600; Path=/; SameSite=Lax${secure}`;
  document.cookie = `mp_connect_account_type=${encodeURIComponent(accountType)}; Max-Age=600; Path=/; SameSite=Lax${secure}`;
}

type MercadoPagoConnectOptions = {
  requireAuthenticatedStart?: boolean;
};

export async function startMercadoPagoConnect(
  accountType: "seller" | "supplier",
  options: MercadoPagoConnectOptions = {},
) {
  setReturnCookies(accountType);

  const params = new URLSearchParams({
    account_type: accountType,
    redirect: "true",
  });
  const connectPath = `/api/mercadopago/connect?${params.toString()}`;
  const openDirectConnect = () => {
    window.location.assign(connectPath);
  };

  let response: Response;
  try {
    response = await fetchWithAuth(connectPath, {
      headers: { Accept: "application/json" },
      redirect: "manual",
    });
  } catch (error) {
    if (!options.requireAuthenticatedStart) {
      openDirectConnect();
      return;
    }
    throw new Error(error instanceof Error && error.message ? error.message : "No se pudo iniciar Mercado Pago.");
  }

  if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
    const location = response.headers.get("Location");
    if (location && isSafeConnectUrl(location)) {
      window.location.assign(location);
      return;
    }
    if (!options.requireAuthenticatedStart) {
      openDirectConnect();
      return;
    }
    throw new Error("Mercado Pago no devolvió una URL de vinculación legible.");
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getPayloadMessage(payload) || `No se pudo iniciar Mercado Pago (${response.status}).`);
  }

  const redirectUrl = getRedirectUrl(payload);
  if (!redirectUrl) {
    if (!options.requireAuthenticatedStart) {
      openDirectConnect();
      return;
    }
    throw new Error("Mercado Pago no devolvió una URL de vinculación.");
  }
  if (!isSafeConnectUrl(redirectUrl)) {
    throw new Error("Mercado Pago devolvió una URL de vinculación no válida.");
  }

  window.location.assign(redirectUrl);
}
