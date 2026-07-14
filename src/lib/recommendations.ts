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

const CITY_NORMALIZATION_MAP: Record<string, string> = {
  merida: "Mérida",
};

const normalizeLocationText = (value?: string | null) => {
  if (!value) return null;

  let cleanValue = value.trim();
  try {
    cleanValue = decodeURIComponent(cleanValue);
  } catch {
    // Keep original value if it is not URI-encoded.
  }

  if (!cleanValue || cleanValue.toLowerCase() === "undefined") return null;
  if (/^[A-Z]{2,3}$/.test(cleanValue)) return null;

  const normalizedKey = cleanValue
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return CITY_NORMALIZATION_MAP[normalizedKey] || cleanValue;
};

const getCookieValue = (name: string) => {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  return parts.length === 2 ? parts.pop()?.split(";").shift() || null : null;
};

const buildProductResultsUrls = (queryParams: URLSearchParams) => {
  const query = queryParams.toString();
  return [`/api/products/results?${query}`, `/api/products/?${query}`];
};

export async function getRecommendations(params: RecommendationsParams): Promise<Product[]> {
  const queryParams = new URLSearchParams();
  
  if (params.skip !== undefined) queryParams.append("skip", params.skip.toString());
  if (params.limit !== undefined) queryParams.append("limit", params.limit.toString());
  if (params.best_rated) queryParams.append("best_rated", "true");
  if (params.category) queryParams.append("category", params.category);
  if (params.subcategory) queryParams.append("subcategory", params.subcategory);
  if (params.min_price !== undefined) queryParams.append("min_price", params.min_price.toString());
  if (params.max_price !== undefined) queryParams.append("max_price", params.max_price.toString());
  if (params.search) queryParams.append("search", params.search);
  
  if (params.location) {
    if (params.location.city) {
      queryParams.append("location", params.location.city);
    } else if (params.location.state) {
      queryParams.append("location", params.location.state);
    } else {
      queryParams.append("location", `${params.location.latitude},${params.location.longitude}`);
    }
  } else {
    const cityCookie = normalizeLocationText(getCookieValue("user_city"));
    if (cityCookie) {
      queryParams.append("location", cityCookie);
    }
  }

  try {
    const deviceId = getDeviceId();
    const urls = buildProductResultsUrls(queryParams);

    if (process.env.NODE_ENV === "development") console.log("🔍 Fetching product results with params:", queryParams.toString());
    if (process.env.NODE_ENV === "development") console.log("📍 Results location param sent:", queryParams.get("location") || "None");

    for (const url of urls) {
      const response = await fetchWithAuth(url, {
        headers: {
          Accept: "application/json",
          ...(deviceId ? { "X-Device-ID": deviceId } : {}),
        },
      });

      if (!response.ok) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`Product results endpoint failed (${response.status} ${response.statusText}): ${url}`);
        }
        continue;
      }

      const data = await response.json();
      return unwrapProducts(data);
    }

    return [];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Failed to fetch product results:", message);
    return [];
  }
}
