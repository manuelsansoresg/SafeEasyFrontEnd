import { fetchWithAuth } from "@/lib/api";

export type ShippingRates = {
  min_distance_km: number;
  extra_cost_per_km: number;
};

// FastAPI serializes Decimal amounts as JSON strings.
export type SupplierShippingSettings = {
  supplier_id: number;
  allow_provider_shipping_configuration: boolean;
  min_distance_km: number | null;
  extra_cost_per_km: number | string | null;
  effective_min_distance_km: number;
  effective_extra_cost_per_km: number | string;
  source: "global" | "provider";
};

export class ShippingSettingsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ShippingSettingsError";
  }
}

async function request(path: string, options: Omit<RequestInit, "headers"> = {}): Promise<Record<string, unknown>> {
  const response = await fetchWithAuth(path, { ...options, cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const message = typeof detail === "string" ? detail : Array.isArray(detail)
      ? detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(". ") : null;
    throw new ShippingSettingsError(message || "No se pudo obtener o guardar la configuración de envío.", response.status);
  }
  if (!data || typeof data !== "object" || typeof data.allow_provider_shipping_configuration !== "boolean") {
    throw new Error("El backend no devolvió la configuración de envío esperada. Recarga o contacta a Drooopy.");
  }
  return data;
}

function readSupplier(data: Record<string, unknown>): SupplierShippingSettings {
  const validAmount = (value: unknown) => (typeof value === "number" || typeof value === "string") && String(value).trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
  if (typeof data.supplier_id !== "number" || !validAmount(data.effective_min_distance_km) ||
    !validAmount(data.effective_extra_cost_per_km) ||
    (data.min_distance_km !== null && !validAmount(data.min_distance_km)) ||
    (data.extra_cost_per_km !== null && !validAmount(data.extra_cost_per_km)) ||
    (data.source !== "global" && data.source !== "provider")) {
    throw new Error("La respuesta de tarifas del proveedor es inválida. Intenta cargarla de nuevo.");
  }
  return data as SupplierShippingSettings;
}

export const shippingSettingsService = {
  async getPermission(signal?: AbortSignal) {
    const data = await request("/api/admin/settings", { signal });
    return data.allow_provider_shipping_configuration as boolean;
  },
  async setPermission(allowed: boolean) {
    const data = await request("/api/admin/settings", {
      method: "PATCH",
      body: JSON.stringify({ allow_provider_shipping_configuration: allowed }),
    });
    return data.allow_provider_shipping_configuration as boolean;
  },
  async getMine(signal?: AbortSignal) {
    return readSupplier(await request("/api/suppliers/me/shipping-settings", { signal }));
  },
  async saveMine(rates: ShippingRates) {
    return readSupplier(await request("/api/suppliers/me/shipping-settings", {
      method: "PUT",
      body: JSON.stringify(rates),
    }));
  },
};
