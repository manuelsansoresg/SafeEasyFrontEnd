import { Product } from "./products";
import { fetchWithAuth } from "@/lib/api";
import { getDeviceId } from "@/utils/device";

export interface RecommendationsParams {
  skip?: number;
  limit?: number;
  best_rated?: boolean;
  category?: string;
  subcategory?: string;
  min_price?: number;
  max_price?: number;
  search?: string;
  location?: { latitude?: number | null; longitude?: number | null; city?: string | null; state?: string | null } | null;
}

const unwrapProducts = (data: unknown): Product[] => {
  if (Array.isArray(data)) return data as Product[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const items = record.items ?? record.results ?? record.products ?? record.data;
    if (Array.isArray(items)) return items as Product[];
  }
  return [];
};

export async function getRecommendations(params: RecommendationsParams): Promise<Product[]> {
  const queryParams = new URLSearchParams();
  
  if (params.skip !== undefined) queryParams.append("skip", params.skip.toString());
  if (params.limit !== undefined) queryParams.append("limit", params.limit.toString());
  if (params.best_rated !== undefined) queryParams.append("best_rated", params.best_rated.toString());
  if (params.category) queryParams.append("category", params.category);
  if (params.subcategory) queryParams.append("subcategory", params.subcategory);
  if (params.min_price !== undefined) queryParams.append("min_price", params.min_price.toString());
  if (params.max_price !== undefined) queryParams.append("max_price", params.max_price.toString());
  if (params.search) queryParams.append("search", params.search);
  
  if (params.location) {
    if (params.location.city) queryParams.append("city", params.location.city);
    if (params.location.state) queryParams.append("state", params.location.state);

    if (params.location.city) {
      queryParams.append("location", params.location.city);
    } else if (params.location.state) {
      queryParams.append("location", params.location.state);
    } else {
      queryParams.append("location", `${params.location.latitude},${params.location.longitude}`);
    }
  } else {
    // If no location provided, check for client-side cookies if running in browser
    if (typeof window !== 'undefined') {
        const getCookie = (name: string) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop()?.split(';').shift();
        };
        
        const cityCookie = getCookie('user_city');
        if (cityCookie) {
            queryParams.append("location", decodeURIComponent(cityCookie));
        }
    }
  }

  try {
    const deviceId = getDeviceId();
    const url = `/api/products/results?${queryParams.toString()}`;

    console.log("🔍 Fetching product results with params:", queryParams.toString());
    console.log("📍 Results location param sent:", queryParams.get("location") || "None");
    const response = await fetchWithAuth(url, {
      headers: {
        Accept: "application/json",
        ...(deviceId ? { "X-Device-ID": deviceId } : {}),
      },
    });
    
    if (!response.ok) {
      throw new Error(`Error fetching product results: ${response.statusText}`);
    }

    const data = await response.json();
    return unwrapProducts(data);
  } catch (error) {
    console.error("Failed to fetch product results:", error);
    return [];
  }
}
