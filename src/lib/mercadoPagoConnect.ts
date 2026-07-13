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

export async function startMercadoPagoConnect(accountType: "seller" | "supplier") {
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
  } catch {
    openDirectConnect();
    return;
  }

  if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
    openDirectConnect();
    return;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(getPayloadMessage(payload) || `No se pudo iniciar Mercado Pago (${response.status}).`);
  }

  const redirectUrl = getRedirectUrl(payload);
  if (!redirectUrl) {
    openDirectConnect();
    return;
  }
  if (!isSafeConnectUrl(redirectUrl)) {
    throw new Error("Mercado Pago devolvió una URL de vinculación no válida.");
  }

  window.location.assign(redirectUrl);
}
