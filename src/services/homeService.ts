import { fetchWithAuth } from "@/lib/api";

export interface FeaturedSupplier {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  logo_url?: string | null;
  image?: string | null;
  image_url?: string | null;
  views: number;
  average_rating: number;
  is_featured: boolean;
  is_verified?: boolean;
}

export interface FeaturedProduct {
  id: string;
  title: string;
  slug: string;
  image: string | null;
  views: number;
  average_rating: number;
}

export async function getFeaturedSuppliers(skip = 0, limit = 3): Promise<FeaturedSupplier[]> {
  const normalizeSupplier = (value: unknown): FeaturedSupplier | null => {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    const id = Number(record.id);
    const name = typeof record.name === "string" ? record.name : "";
    const slug = typeof record.slug === "string" ? record.slug : "";
    if (!Number.isFinite(id) || !name || !slug) return null;

    const logo =
      (typeof record.logo === "string" && record.logo.trim()) ||
      (typeof record.logo_url === "string" && record.logo_url.trim()) ||
      (typeof record.image === "string" && record.image.trim()) ||
      (typeof record.image_url === "string" && record.image_url.trim()) ||
      null;

    return {
      id,
      name,
      slug,
      logo,
      logo_url: typeof record.logo_url === "string" ? record.logo_url : null,
      image: typeof record.image === "string" ? record.image : null,
      image_url: typeof record.image_url === "string" ? record.image_url : null,
      views: Number(record.views) || 0,
      average_rating: Number(record.average_rating) || 0,
      is_featured: Boolean(record.is_featured),
      is_verified: typeof record.is_verified === "boolean" ? record.is_verified : undefined,
    };
  };

  const normalizeList = (payload: unknown) => {
    const list = Array.isArray(payload)
      ? payload
      : payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).items)
        ? ((payload as Record<string, unknown>).items as unknown[])
        : payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).results)
          ? ((payload as Record<string, unknown>).results as unknown[])
          : payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).data)
            ? ((payload as Record<string, unknown>).data as unknown[])
            : [];
    return list.map(normalizeSupplier).filter((item): item is FeaturedSupplier => Boolean(item));
  };

  try {
    const res = await fetchWithAuth(`/api/suppliers/featured?skip=${skip}&limit=${limit}`);
    if (res.ok) {
        const data = await res.json();
        return normalizeList(data);
    }
    return [];
  } catch (error) {
    console.error("Error fetching featured suppliers:", error);
    return [];
  }
}

export async function getFeaturedProducts(skip = 0, limit = 3): Promise<FeaturedProduct[]> {
  try {
    const res = await fetchWithAuth(`/api/products/featured?skip=${skip}&limit=${limit}`);
    if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.items)) return data.items;
        if (data && Array.isArray(data.results)) return data.results;
        if (data && Array.isArray(data.data)) return data.data;
        return [];
    }
    return [];
  } catch (error) {
    console.error("Error fetching featured products:", error);
    return [];
  }
}
