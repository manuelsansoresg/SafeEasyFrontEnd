import { fetchWithAuth } from "@/lib/api";

export type AdApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type AdSource = "manual" | "supplier_upload" | "supplier_carousel";

// ADVERTISING_BACKEND.md: all new responses include these fields. Views also
// tolerate absent review/date/publication fields in historical API responses.
export interface AdItem {
  id: number;
  source: AdSource;
  supplier_id: number | null;
  supplier_carousel_id: number | null;
  created_by_user_id: number | null;
  image_desktop: string | null;
  image_mobile: string | null;
  link_url: string | null;
  is_manual_url: boolean;
  manual_url: string | null;
  is_active: boolean;
  supplier_visible: boolean;
  is_published: boolean;
  approval_status: AdApprovalStatus;
  reviewed_by_user_id: number | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  display_order: number;
  city: string | null;
  state: string | null;
  content_version: number;
  created_at: string;
  updated_at: string;
}

export interface AdSupplier {
  id: number;
  name: string;
  slug: string | null;
  logo: string | null;
  city: string | null;
  state: string | null;
}

export interface AdminAdFilters {
  approval_status?: AdApprovalStatus;
  is_active?: boolean;
  source?: AdSource;
  supplier_id?: number;
}

export interface AdminAdPayload {
  image?: File | null;
  image_mobile?: File | null;
  delete_image_desktop?: boolean;
  delete_image_mobile?: boolean;
  supplier_id?: number;
  clear_supplier?: boolean;
  is_manual_url?: boolean;
  manual_url?: string;
  city?: string;
  state?: string;
  is_active?: boolean;
  display_order?: number;
}

export interface SupplierAdPayload {
  image?: File | null;
  image_mobile?: File | null;
}

export const AD_REVIEW_CONFLICT = "El anuncio fue modificado o ya no puede revisarse con esta versión. Actualiza la información antes de continuar.";

export class AdsRequestError extends Error {
  constructor(public status: number, reviewing = false) {
    const messages: Record<number, string> = {
      400: "La solicitud no es válida. Revisa los datos del anuncio.",
      401: "Tu sesión ha caducado. Inicia sesión nuevamente.",
      403: "No tienes permisos para realizar esta acción.",
      404: "El anuncio o proveedor no está disponible o no pertenece a tu cuenta.",
      409: reviewing ? AD_REVIEW_CONFLICT : "El anuncio cambió o no permite esta acción en su estado actual. Actualiza la información e inténtalo de nuevo.",
      410: "Esta operación ya no está disponible. Actualiza la página.",
      422: "Revisa los datos y las imágenes. Utiliza imágenes JPEG, PNG o WebP y un enlace válido cuando corresponda.",
    };
    super(messages[status] || "No se pudo completar la solicitud. Inténtalo nuevamente.");
  }
}

export function adsErrorMessage(error: unknown): string {
  return error instanceof AdsRequestError ? error.message : "No se pudo conectar con el servicio de anuncios. Inténtalo nuevamente.";
}

async function readResponse<T>(response: Response, reviewing = false): Promise<T> {
  if (!response.ok) throw new AdsRequestError(response.status, reviewing);
  return response.json() as Promise<T>;
}

async function readList<T>(response: Response): Promise<T[]> {
  const data = await readResponse<unknown>(response);
  if (!Array.isArray(data)) throw new Error("Unexpected advertising response");
  return data as T[];
}

function imageForm(payload: SupplierAdPayload): FormData {
  // Explicit allowlist: supplier endpoints reject every administrative field.
  const form = new FormData();
  if (payload.image) form.append("image", payload.image, payload.image.name);
  if (payload.image_mobile) form.append("image_mobile", payload.image_mobile, payload.image_mobile.name);
  return form;
}

function adminForm(payload: AdminAdPayload): FormData {
  const form = imageForm(payload);
  const fields = ["delete_image_desktop", "delete_image_mobile", "supplier_id", "clear_supplier", "is_manual_url", "manual_url", "city", "state", "is_active", "display_order"] as const;
  for (const field of fields) {
    const value = payload[field];
    if (value !== undefined) form.append(field, String(value));
  }
  return form;
}

const admin = {
  async list(skip = 0, limit = 10, filters: AdminAdFilters = {}, signal?: AbortSignal): Promise<AdItem[]> {
    const query = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    for (const [field, value] of Object.entries(filters)) {
      if (value !== undefined) query.set(field, String(value));
    }
    return readList<AdItem>(await fetchWithAuth(`/api/admin/ads?${query}`, { signal }));
  },
  async listSuppliers(search = "", skip = 0, limit = 50, signal?: AbortSignal): Promise<AdSupplier[]> {
    const query = new URLSearchParams({ search, skip: String(skip), limit: String(limit) });
    return readList<AdSupplier>(await fetchWithAuth(`/api/admin/ads/suppliers?${query}`, { signal }));
  },
  // Existing supplier detail endpoint, read only when opening a review/editor;
  // never issue a separate lookup for every advertisement in the list.
  async supplierIdentity(id: number, signal?: AbortSignal): Promise<AdSupplier> {
    return readResponse<AdSupplier>(await fetchWithAuth(`/api/suppliers/${id}`, { signal }));
  },
  async create(payload: AdminAdPayload & { image: File }): Promise<AdItem> {
    return readResponse<AdItem>(await fetchWithAuth("/api/admin/ads", { method: "POST", body: adminForm(payload) }));
  },
  async update(id: number, payload: AdminAdPayload): Promise<AdItem> {
    return readResponse<AdItem>(await fetchWithAuth(`/api/admin/ads/${id}`, { method: "PUT", body: adminForm(payload) }));
  },
  async delete(id: number): Promise<void> {
    const response = await fetchWithAuth(`/api/admin/ads/${id}`, { method: "DELETE" });
    if (!response.ok) throw new AdsRequestError(response.status);
  },
  async approve(id: number, contentVersion: number): Promise<AdItem> {
    return readResponse<AdItem>(await fetchWithAuth(`/api/admin/ads/${id}/approve`, {
      method: "POST", body: JSON.stringify({ content_version: contentVersion }),
    }), true);
  },
  async reject(id: number, contentVersion: number, reason: string): Promise<AdItem> {
    return readResponse<AdItem>(await fetchWithAuth(`/api/admin/ads/${id}/reject`, {
      method: "POST", body: JSON.stringify({ content_version: contentVersion, reason }),
    }), true);
  },
};

const supplier = {
  async list(skip = 0, limit = 10, signal?: AbortSignal): Promise<AdItem[]> {
    const query = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    return readList<AdItem>(await fetchWithAuth(`/api/suppliers/me/ads?${query}`, { signal }));
  },
  async create(payload: SupplierAdPayload & { image: File }): Promise<AdItem> {
    return readResponse<AdItem>(await fetchWithAuth("/api/suppliers/me/ads", { method: "POST", body: imageForm(payload) }));
  },
  async update(id: number, payload: SupplierAdPayload): Promise<AdItem> {
    return readResponse<AdItem>(await fetchWithAuth(`/api/suppliers/me/ads/${id}`, { method: "PUT", body: imageForm(payload) }));
  },
  async setVisibility(id: number, visible: boolean): Promise<AdItem> {
    return readResponse<AdItem>(await fetchWithAuth(`/api/suppliers/me/ads/${id}/visibility`, {
      method: "PATCH", body: JSON.stringify({ supplier_visible: visible }),
    }));
  },
  async delete(id: number): Promise<void> {
    const response = await fetchWithAuth(`/api/suppliers/me/ads/${id}`, { method: "DELETE" });
    if (!response.ok) throw new AdsRequestError(response.status);
  },
};

export const adsService = { admin, supplier };

// Notification links have no detail endpoint. Scan real server pages until the
// record is found, including announcements whose approval state has since changed.
export async function findAdById(audience: "admin" | "supplier", id: number, signal: AbortSignal): Promise<AdItem | null> {
  const limit = 200;
  for (let skip = 0; ; skip += limit) {
    signal.throwIfAborted();
    const items = audience === "admin" ? await admin.list(skip, limit, {}, signal) : await supplier.list(skip, limit, signal);
    const found = items.find((item) => item.id === id);
    if (found) return found;
    if (items.length < limit) return null;
  }
}
