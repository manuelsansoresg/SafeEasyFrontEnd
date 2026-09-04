import { fetchWithAuth } from "@/lib/api";
import type { BusinessTypeAdminDetail, BusinessTypeAdminList, BusinessTypeCategory, BusinessTypePayload } from "@/types/businessType";

const base = "/api/admin/business-types";

function errorMessage(data: unknown): string | undefined {
  if (typeof data === "string") return data;
  if (Array.isArray(data)) return data.map(errorMessage).filter(Boolean).join("; ");
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    return errorMessage(record.detail ?? record.message ?? record.msg);
  }
}

async function request(url: string, options?: Parameters<typeof fetchWithAuth>[1], categories = false): Promise<Response> {
  const response = await fetchWithAuth(url, { cache: "no-store", ...options });
  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);
    const detail = errorMessage(data);
    if (categories && response.status === 409) {
      throw new Error(`No puedes quitar esta categoría porque actualmente está siendo utilizada por productos o servicios de negocios de este tipo.${detail ? ` ${detail}` : ""}`);
    }
    throw new Error(detail || (response.status === 409
      ? "Ya existe un tipo de negocio con ese nombre."
      : response.status === 403
        ? "No tienes permiso para administrar tipos de negocio."
        : `No se pudo completar la solicitud (${response.status}). Inténtalo de nuevo.`));
  }
  return response;
}

function listItems<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const items = record.items ?? record.results ?? record.data ?? record[key];
    if (Array.isArray(items)) return items as T[];
  }
  throw new Error("La respuesta del listado no tiene el formato esperado.");
}

export const businessTypeService = {
  async list(params: { search: string; is_active?: boolean; skip: number; limit: number }, signal?: AbortSignal): Promise<BusinessTypeAdminList[]> {
    const query = new URLSearchParams({ skip: String(params.skip), limit: String(params.limit) });
    if (params.search.trim()) query.set("search", params.search.trim());
    if (params.is_active !== undefined) query.set("is_active", String(params.is_active));
    const response = await request(`${base}?${query}`, { signal });
    return listItems<BusinessTypeAdminList>(await response.json(), "business_types");
  },
  async detail(id: number, signal?: AbortSignal): Promise<BusinessTypeAdminDetail> {
    const response = await request(`${base}/${id}`, { signal });
    return response.json();
  },
  async create(payload: BusinessTypePayload): Promise<void> {
    await request(base, { method: "POST", body: JSON.stringify(payload) });
  },
  async update(id: number, payload: Partial<BusinessTypePayload>): Promise<void> {
    await request(`${base}/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
  },
  async setCategories(id: number, categoryIds: number[]): Promise<void> {
    await request(`${base}/${id}/categories`, { method: "PUT", body: JSON.stringify({ category_ids: categoryIds }) }, true);
  },
  async deactivate(id: number): Promise<void> {
    await request(`${base}/${id}`, { method: "DELETE" });
  },
  async categories(signal?: AbortSignal): Promise<BusinessTypeCategory[]> {
    const categories = new Map<number, BusinessTypeCategory>();
    const limit = 100;
    let skip = 0;
    while (true) {
      const response = await request(`/api/categories/?skip=${skip}&limit=${limit}`, { signal });
      const page = listItems<BusinessTypeCategory>(await response.json(), "categories");
      if (!page.length) break;
      const previousSize = categories.size;
      page.forEach((category) => categories.set(category.id, category));
      if (categories.size === previousSize) throw new Error("No se pudieron cargar todas las categorías. Inténtalo de nuevo.");
      skip += page.length;
    }
    return [...categories.values()];
  },
};
