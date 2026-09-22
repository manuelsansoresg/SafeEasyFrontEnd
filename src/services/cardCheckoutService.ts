import { fetchWithAuth } from "@/lib/api";
import type {
  CardAuthorizationRequest,
  CardAuthorizationResponse,
  CheckoutSessionStatus,
} from "@/types/cardCheckout";

export class CardCheckoutError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CardCheckoutError";
    this.status = status;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function backendDetail(value: unknown) {
  const data = asRecord(value);
  for (const candidate of [data.detail, data.message, data.error]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

function friendlyError(status: number, payload: unknown) {
  const detail = backendDetail(payload);
  const normalized = detail.toLowerCase();

  if (status === 401) return "Tu sesión venció. Inicia sesión nuevamente para continuar.";
  if (status === 409) {
    if (normalized.includes("procesando") || normalized.includes("processing")) {
      return "Mercado Pago ya está procesando esta autorización. Espera la confirmación antes de volver a pagar.";
    }
    return "La compra cambió mientras autorizabas la tarjeta. Revisa el carrito antes de intentarlo de nuevo.";
  }
  if (status === 422) return "Los datos de la autorización no son válidos. Revisa la tarjeta e inténtalo nuevamente.";
  if (status === 502) return "Mercado Pago no pudo completar la autorización en este momento. Inténtalo nuevamente en unos minutos.";
  if (normalized.includes("stock")) return "Uno de los productos ya no tiene existencias suficientes. Revisa tu carrito.";
  if (normalized.includes("inactive") || normalized.includes("not available")) {
    return "Uno de los productos ya no está disponible. Revisa tu carrito.";
  }
  if (normalized.includes("shipping") || normalized.includes("distance_km") || normalized.includes("quote")) {
    return "La cotización de envío ya no es válida. Regresa al carrito y calcula el envío nuevamente.";
  }
  if (normalized.includes("métodos de cobro") || normalized.includes("payment account")) {
    return "Este proveedor todavía no tiene disponible el cobro con Mercado Pago.";
  }
  if (normalized.includes("rejected") || normalized.includes("rechaz")) {
    return "La tarjeta fue rechazada. Revisa los datos o utiliza otra tarjeta.";
  }
  if (status >= 500) return "No pudimos comunicarnos con Mercado Pago. Inténtalo nuevamente en unos minutos.";
  if (status >= 400 && status < 500 && detail && detail.length <= 180) return detail;
  return "No se pudo autorizar la tarjeta. Revisa los datos e inténtalo nuevamente.";
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

export const cardCheckoutService = {
  authorize: async (request: CardAuthorizationRequest): Promise<CardAuthorizationResponse> => {
    const response = await fetchWithAuth("/api/orders/checkout/card/authorize", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: JSON.stringify(request),
    });
    const payload = await readJson(response);

    if (!response.ok) {
      throw new CardCheckoutError(friendlyError(response.status, payload), response.status);
    }

    return payload as CardAuthorizationResponse;
  },

  getSessionStatus: async (checkoutId: string): Promise<CheckoutSessionStatus> => {
    const response = await fetchWithAuth(
      `/api/orders/checkout-sessions/${encodeURIComponent(checkoutId)}/status`,
      { headers: { Accept: "application/json" } },
    );
    const payload = await readJson(response);

    if (!response.ok) {
      throw new CardCheckoutError(friendlyError(response.status, payload), response.status);
    }

    return payload as CheckoutSessionStatus;
  },
};
