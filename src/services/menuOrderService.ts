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

const gatewayBase = "/api/menu-orders-gateway";

function extractError(value: unknown): string | undefined {
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    const parts = value.map(extractError).filter(Boolean);
    return parts.length ? parts.join("; ") : undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return extractError(
      record.detail ?? record.message ?? record.msg ?? record.error,
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
    throw new Error(detail || "No tienes permiso para realizar esta acción.");
  }

  if (response.status === 404) {
    throw new Error(detail || "El pedido o menú solicitado no existe.");
  }

  if (response.status === 409) {
    throw new Error(
      detail || "La operación ya no se puede completar en el estado actual.",
    );
  }

  if (response.status === 422) {
    throw new Error(detail || "Revisa los datos del pedido e inténtalo nuevamente.");
  }

  if (response.status === 429) {
    throw new Error("Se hicieron demasiados intentos. Espera un momento e inténtalo de nuevo.");
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

  if (!response.ok) await throwForResponse(response);
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

  if (!response.ok) await throwForResponse(response);
  return response;
}

function buildStatusQuery(status?: MenuOrderStatus | null) {
  if (!status) return "";
  const params = new URLSearchParams({ status });
  return `?${params.toString()}`;
}

export const menuOrderService = {
  async publicSettings(
    supplierSlug: string,
    menuId: number,
    signal?: AbortSignal,
  ): Promise<MenuOrderSettings> {
    const response = await publicRequest(
      `${gatewayBase}/public/settings/${encodeURIComponent(supplierSlug)}/${menuId}`,
      { signal },
    );
    return response.json();
  },

  async createPublic(
    supplierSlug: string,
    payload: MenuOrderCreatePayload,
  ): Promise<MenuOrderCreated> {
    const response = await authRequest(
      `${gatewayBase}/public/${encodeURIComponent(supplierSlug)}`,
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
    const params = new URLSearchParams({ management_token: managementToken });
    const response = await publicRequest(
      `${gatewayBase}/public/${encodeURIComponent(orderNumber)}?${params.toString()}`,
      { signal },
    );
    return response.json();
  },

  async settings(
    menuId: number,
    signal?: AbortSignal,
  ): Promise<MenuOrderSettings> {
    const response = await authRequest(
      `${gatewayBase}/private/settings/${menuId}`,
      { signal },
    );
    return response.json();
  },

  async updateSettings(
    menuId: number,
    payload: MenuOrderSettingsUpdate,
  ): Promise<MenuOrderSettings> {
    const response = await authRequest(
      `${gatewayBase}/private/settings/${menuId}`,
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
      `${gatewayBase}/private/mine${buildStatusQuery(status)}`,
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
      `${gatewayBase}/private${buildStatusQuery(status)}`,
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
      `${gatewayBase}/private/${orderId}`,
      { signal },
    );
    return response.json();
  },

  async updateStatus(
    orderId: number,
    payload: MenuOrderStatusUpdate,
  ): Promise<MenuOrder> {
    const response = await authRequest(
      `${gatewayBase}/private/${orderId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    return response.json();
  },
};
