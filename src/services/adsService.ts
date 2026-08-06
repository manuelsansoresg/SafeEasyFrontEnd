import { fetchWithAuth } from "@/lib/api";

export interface AdItem {
  id: number;
  link_url?: string | null;
  city?: string | null;
  state?: string | null;
  display_order?: number | null;
  is_active: boolean;
  image_desktop?: string | null;
  image_mobile?: string | null;
}

export const adsService = {
  list: async (skip = 0, limit = 10): Promise<AdItem[]> => {
    const q = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    const res = await fetchWithAuth(`/api/admin/ads?${q.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
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
    if (params.image_mobile) {
      console.log("[adsService.create] Sending image_mobile:", params.image_mobile.name, params.image_mobile.size);
      form.append("image_mobile", params.image_mobile, params.image_mobile.name);
    } else {
      console.log("[adsService.create] No image_mobile provided");
    }
    if (params.link_url) form.append("link_url", params.link_url);
    form.append("city", params.city ?? "");
    form.append("state", params.state ?? "");
    if (typeof params.display_order !== "undefined" && params.display_order !== null) {
      form.append("display_order", String(params.display_order));
    }
    form.append("is_active", String(params.is_active));
    const res = await fetchWithAuth(`/api/admin/ads`, { method: "POST", body: form });
    if (!res.ok) {
      console.error("[adsService.create] Failed:", res.status, await res.text());
      return null;
    }
    return res.json();
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
    if (payload.image) {
      console.log("[adsService.update] Sending image:", payload.image.name, payload.image.size);
      form.append("image", payload.image, payload.image.name);
    }
    if (payload.image_mobile) {
      console.log("[adsService.update] Sending image_mobile:", payload.image_mobile.name, payload.image_mobile.size);
      form.append("image_mobile", payload.image_mobile, payload.image_mobile.name);
    }
    if (payload.delete_image_desktop) {
      console.log("[adsService.update] Deleting image_desktop");
      form.append("delete_image_desktop", "true");
    }
    if (payload.delete_image_mobile) {
      console.log("[adsService.update] Deleting image_mobile");
      form.append("delete_image_mobile", "true");
    }
    const res = await fetchWithAuth(`/api/admin/ads/${id}`, { method: "PUT", body: form });
    if (!res.ok) {
      console.error("[adsService.update] Failed:", res.status, await res.text());
      return null;
    }
    return res.json();
  },

  delete: async (id: number): Promise<boolean> => {
    const res = await fetchWithAuth(`/api/admin/ads/${id}`, { method: "DELETE" });
    return res.ok;
  },
};
