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
    link_url?: string | null;
    city?: string | null;
    state?: string | null;
    display_order?: number | null;
    is_active: boolean;
  }): Promise<AdItem | null> => {
    const form = new FormData();
    form.append("image", params.image);
    if (params.link_url) form.append("link_url", params.link_url);
    form.append("city", params.city ?? "");
    form.append("state", params.state ?? "");
    if (typeof params.display_order !== "undefined" && params.display_order !== null) {
      form.append("display_order", String(params.display_order));
    }
    form.append("is_active", String(params.is_active));
    const res = await fetchWithAuth(`/api/admin/ads`, { method: "POST", body: form });
    if (!res.ok) return null;
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
    }
  ): Promise<AdItem | null> => {
    const form = new FormData();
    if (typeof payload.city !== "undefined") form.append("city", payload.city ?? "");
    if (typeof payload.state !== "undefined") form.append("state", payload.state ?? "");
    if (typeof payload.display_order !== "undefined") form.append("display_order", String(payload.display_order ?? 0));
    if (typeof payload.is_active !== "undefined") form.append("is_active", String(payload.is_active));
    if (typeof payload.link_url !== "undefined") form.append("link_url", payload.link_url ?? "");
    if (payload.image) form.append("image", payload.image);
    const res = await fetchWithAuth(`/api/admin/ads/${id}`, { method: "PUT", body: form });
    if (!res.ok) return null;
    return res.json();
  },

  delete: async (id: number): Promise<boolean> => {
    const res = await fetchWithAuth(`/api/admin/ads/${id}`, { method: "DELETE" });
    return res.ok;
  },
};
