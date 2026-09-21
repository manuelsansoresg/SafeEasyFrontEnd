import { fetchWithAuth } from "@/lib/api";
import type {
  MenuOrder,
  MenuOrderCreatePayload,
  MenuOrderCreated,
  MenuOrderSettings,
  MenuOrderSettingsUpdate,
  MenuOrderStatus,
  MenuOrderStatusUpdate,
} from "@/types/menuOrder";

const privateBase = "/api/menu-orders";
const publicBase = "/api/public/menu-orders";

function extractError(value: unknown): string | undefined {
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    const parts = value.map(extractError).filter(Boolean);
    return parts.length ? parts.join("; ") : undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    return extractError(
      record.detail ??
        record.message ??
        record.msg ??
        record.error,
    );
  }

  return undefined;
}

async function throwForResponse(response: Response): Promise<never> {
  const body: unknown = await response.json().catch(() => null);
  const detail = extractError(body);

  if (response.status === 400) {
    throw new Error(detail || "Revisa los datos capturados.");
  }

  if (response.status === 401) {
    throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
  }

  if (response.status === 403) {
    throw new Error(
      detail || "No tienes permiso para realizar esta acción.",
    );
  }

  if (response.status === 404) {
    throw new Error(detail || "El pedido o menú solicitado no existe.");
  }

  if (response.status === 409) {
    throw new Error(
      detail ||
        "La operación ya no se puede completar en el estado actual.",
    );
  }

  if (response.status === 422) {
    throw new Error(
      detail || "Revisa los datos del pedido e inténtalo nuevamente.",
    );
  }

  if (response.status === 429) {
    throw new Error(
      "Se hicieron demasiados intentos. Espera un momento e inténtalo de nuevo.",
    );
  }

  if (
    response.status === 502 ||
    response.status === 503 ||
    response.status === 504
  ) {
    throw new Error(
      detail || "No se pudo comunicar con el servicio de pedidos.",
    );
  }

  throw new Error(
    detail || `No se pudo completar la solicitud (${response.status}).`,
  );
}

async function publicRequest(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
  });

  if (!response.ok) {
    await throwForResponse(response);
  }

  return response;
}

async function authRequest(
  url: string,
  options?: Parameters<typeof fetchWithAuth>[1],
): Promise<Response> {
  const response = await fetchWithAuth(url, {
    cache: "no-store",
    ...options,
  });

  if (!response.ok) {
    await throwForResponse(response);
  }

  return response;
}

function buildStatusQuery(status?: MenuOrderStatus | null) {
  if (!status) return "";

  const params = new URLSearchParams({ status });
  return `?${params.toString()}`;
}

function defaultPublicSettings(menuId: number): MenuOrderSettings {
  return {
    menu_id: menuId,
    supplier_id: 0,
    accepts_orders: false,
    allows_pickup: true,
    allows_delivery: false,
    allow_guest_orders: true,
    allows_cash: true,
    allows_online_payment: false,
    mercadopago_linked: false,
    online_payment_available: false,
  };
}

export const menuOrderService = {
  async publicSettings(
    supplierSlug: string,
    menuId: number,
    signal?: AbortSignal,
  ): Promise<MenuOrderSettings> {
    const url =
      `${publicBase}/settings/` +
      `${encodeURIComponent(supplierSlug)}/${menuId}`;

    const response = await fetch(url, {
      cache: "no-store",
      signal,
    });

    // Si el menú/configuración pública no existe, el menú público puede
    // seguir mostrándose pero sin controles para realizar pedidos.
    if (response.status === 404) {
      return defaultPublicSettings(menuId);
    }

    if (!response.ok) {
      await throwForResponse(response);
    }

    const data: unknown = await response.json();

    if (!data || typeof data !== "object") {
      return defaultPublicSettings(menuId);
    }

    const settings = data as Partial<MenuOrderSettings>;

    return {
      menu_id:
        typeof settings.menu_id === "number"
          ? settings.menu_id
          : menuId,
      supplier_id:
        typeof settings.supplier_id === "number"
          ? settings.supplier_id
          : 0,
      accepts_orders: settings.accepts_orders === true,
      allows_pickup: settings.allows_pickup !== false,
      allows_delivery: settings.allows_delivery === true,
      allow_guest_orders: settings.allow_guest_orders !== false,
      allows_cash: settings.allows_cash !== false,
      allows_online_payment: settings.allows_online_payment === true,
      mercadopago_linked: settings.mercadopago_linked === true,
      online_payment_available: settings.online_payment_available === true,
    };
  },

  async createPublic(
    supplierSlug: string,
    payload: MenuOrderCreatePayload,
  ): Promise<MenuOrderCreated> {
    if (payload.items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 ||
      (item.variant_id != null && (!Number.isInteger(item.variant_id) || item.variant_id < 1)))) {
      throw new Error("Revisa la cantidad y presentación de cada producto.");
    }
    const response = await authRequest(
      `${publicBase}/${encodeURIComponent(supplierSlug)}`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    return response.json();
  },

  async publicOrder(
    orderNumber: string,
    managementToken: string,
    signal?: AbortSignal,
  ): Promise<MenuOrder> {
    const params = new URLSearchParams({
      management_token: managementToken,
    });

    const response = await publicRequest(
      `${publicBase}/${encodeURIComponent(orderNumber)}?${params.toString()}`,
      { signal },
    );

    return response.json();
  },

  async settings(
    menuId: number,
    signal?: AbortSignal,
  ): Promise<MenuOrderSettings> {
    const response = await authRequest(
      `${privateBase}/settings/${menuId}`,
      { signal },
    );

    return response.json();
  },

  async updateSettings(
    menuId: number,
    payload: MenuOrderSettingsUpdate,
  ): Promise<MenuOrderSettings> {
    const response = await authRequest(
      `${privateBase}/settings/${menuId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );

    return response.json();
  },

  async mine(
    status?: MenuOrderStatus | null,
    signal?: AbortSignal,
  ): Promise<MenuOrder[]> {
    const response = await authRequest(
      `${privateBase}/mine${buildStatusQuery(status)}`,
      { signal },
    );

    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as MenuOrder[]) : [];
  },

  async providerOrders(
    status?: MenuOrderStatus | null,
    signal?: AbortSignal,
  ): Promise<MenuOrder[]> {
    const response = await authRequest(
      `${privateBase}${buildStatusQuery(status)}`,
      { signal },
    );

    const data: unknown = await response.json();
    return Array.isArray(data) ? (data as MenuOrder[]) : [];
  },

  async providerOrder(
    orderId: number,
    signal?: AbortSignal,
  ): Promise<MenuOrder> {
    const response = await authRequest(
      `${privateBase}/${orderId}`,
      { signal },
    );

    return response.json();
  },

  async updateStatus(
    orderId: number,
    payload: MenuOrderStatusUpdate,
  ): Promise<MenuOrder> {
    const response = await authRequest(
      `${privateBase}/${orderId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );

    return response.json();
  },
};
