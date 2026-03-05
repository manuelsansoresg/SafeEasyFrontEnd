import { Product } from "./products";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";

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
    if (params.location.city) {
      queryParams.append("location", params.location.city);
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
    console.log("🔍 Fetching recommendations with params:", queryParams.toString());
    console.log("📍 Reco Location param sent:", queryParams.get("location") || "None");
    const response = await fetch(`${API_BASE_URL}/interactions/recommendations?${queryParams.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching recommendations: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to fetch recommendations:", error);
    return [];
  }
}
