import { fetchWithAuth } from "@/lib/api";

export interface AdItem {
  id: number;
  source?: "manual" | "supplier_carousel";
  supplier_carousel_id?: number | null;
  supplier_id?: number | null;
  link_url?: string | null;
  city?: string | null;
  state?: string | null;
  display_order?: number | null;
  is_active: boolean;
  image_desktop?: string | null;
  image_mobile?: string | null;
}

export interface AdSupplier {
  id: number;
  name: string;
  slug?: string | null;
  logo?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface SupplierAdImage {
  id: number;
  supplier_id: number;
  image: string | null;
  image_movil?: string | null;
  thumbnail?: string | null;
  thumbnail_movil?: string | null;
  title?: string | null;
  description?: string | null;
  is_selected: boolean;
}

export interface CreateSupplierAdPayload {
  supplier_carousel_id: number;
  display_order: number;
  is_active: boolean;
}

export class AdsRequestError extends Error {
  constructor(public status: number) {
    const messages: Record<number, string> = {
      401: "Tu sesión ha caducado. Inicia sesión nuevamente.",
      403: "No tienes permisos para administrar anuncios.",
      404: "El proveedor, la imagen o el anuncio ya no está disponible.",
      409: "Esta imagen ya está agregada a los anuncios, aunque esté inactiva.",
      422: "Revisa los datos del anuncio e inténtalo de nuevo.",
    };
    super(messages[status] || "No se pudo completar la solicitud. Inténtalo nuevamente.");
  }
}

export function adsErrorMessage(error: unknown): string {
  return error instanceof AdsRequestError ? error.message : "No se pudo conectar con el servicio de anuncios. Inténtalo nuevamente.";
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw new AdsRequestError(response.status);
  return response.json() as Promise<T>;
}

async function readList<T>(response: Response): Promise<T[]> {
  const data = await readResponse<unknown>(response);
  if (!Array.isArray(data)) throw new Error("Unexpected ads response");
  return data as T[];
}

export const adsService = {
  listSuppliers: async (search = "", skip = 0, limit = 50, signal?: AbortSignal): Promise<AdSupplier[]> => {
    const query = new URLSearchParams({ search, skip: String(skip), limit: String(limit) });
    return readList<AdSupplier>(await fetchWithAuth(`/api/admin/ads/suppliers?${query}`, { signal }));
  },

  getSupplierImages: async (supplierId: number, signal?: AbortSignal): Promise<SupplierAdImage[]> =>
    readList<SupplierAdImage>(await fetchWithAuth(`/api/admin/ads/suppliers/${supplierId}/images`, { signal })),

  createFromSupplier: async (payload: CreateSupplierAdPayload): Promise<AdItem> =>
    readResponse<AdItem>(await fetchWithAuth("/api/admin/ads/from-supplier", {
      method: "POST",
      body: JSON.stringify(payload),
    })),

  list: async (skip = 0, limit = 10, isActive?: boolean, signal?: AbortSignal): Promise<AdItem[]> => {
    const q = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (isActive !== undefined) q.set("is_active", String(isActive));
    return readList<AdItem>(await fetchWithAuth(`/api/admin/ads?${q.toString()}`, { signal }));
  },

  create: async (params: {
    image: File;
    image_mobile?: File | null;
    link_url?: string | null;
    city?: string | null;
    state?: string | null;
    display_order?: number | null;
    is_active: boolean;
  }): Promise<AdItem | null> => {
    const form = new FormData();
    form.append("image", params.image, params.image.name);
    if (params.image_mobile) form.append("image_mobile", params.image_mobile, params.image_mobile.name);
    if (params.link_url) form.append("link_url", params.link_url);
    form.append("city", params.city ?? "");
    form.append("state", params.state ?? "");
    if (typeof params.display_order !== "undefined" && params.display_order !== null) {
      form.append("display_order", String(params.display_order));
    }
    form.append("is_active", String(params.is_active));
    const res = await fetchWithAuth(`/api/admin/ads`, { method: "POST", body: form });
    return readResponse<AdItem>(res);
  },

  update: async (
    id: number, 
    payload: { 
      city?: string | null; 
      state?: string | null; 
      display_order?: number | null;
      is_active?: boolean; 
      link_url?: string | null;
      image?: File | null;
      image_mobile?: File | null;
      delete_image_desktop?: boolean;
      delete_image_mobile?: boolean;
    }
  ): Promise<AdItem | null> => {
    const form = new FormData();
    if (typeof payload.city !== "undefined") form.append("city", payload.city ?? "");
    if (typeof payload.state !== "undefined") form.append("state", payload.state ?? "");
    if (typeof payload.display_order !== "undefined") form.append("display_order", String(payload.display_order ?? 0));
    if (typeof payload.is_active !== "undefined") form.append("is_active", String(payload.is_active));
    if (typeof payload.link_url !== "undefined") form.append("link_url", payload.link_url ?? "");
    if (payload.image) form.append("image", payload.image, payload.image.name);
    if (payload.image_mobile) form.append("image_mobile", payload.image_mobile, payload.image_mobile.name);
    if (payload.delete_image_desktop) form.append("delete_image_desktop", "true");
    if (payload.delete_image_mobile) form.append("delete_image_mobile", "true");
    const res = await fetchWithAuth(`/api/admin/ads/${id}`, { method: "PUT", body: form });
    return readResponse<AdItem>(res);
  },

  delete: async (id: number): Promise<boolean> => {
    const res = await fetchWithAuth(`/api/admin/ads/${id}`, { method: "DELETE" });
    if (!res.ok) throw new AdsRequestError(res.status);
    return true;
  },
};
