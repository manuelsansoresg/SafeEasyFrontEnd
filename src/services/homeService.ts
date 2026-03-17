import { fetchWithAuth } from "@/lib/api";

export interface FeaturedSupplier {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
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
  try {
    const res = await fetchWithAuth(`/api/suppliers/featured?skip=${skip}&limit=${limit}`);
    if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
        // Handle pagination object if returned
        if (data && Array.isArray(data.items)) return data.items;
        if (data && Array.isArray(data.results)) return data.results;
        if (data && Array.isArray(data.data)) return data.data;
        return [];
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
