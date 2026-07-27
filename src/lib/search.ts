import { fetchWithAuth } from "@/lib/api";
import { getDeviceId } from "@/utils/device";
import { Product } from "./products";

export type SearchTypeFilter = "all" | "products" | "services" | "directories";

export interface SearchDirectory {
  id: number;
  name: string;
  slug: string | null;
  short_name?: string | null;
  logo: string | null;
  is_directory?: boolean;
  is_verified?: boolean | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  short_description?: string | null;
  description?: string | null;
  category_id?: number | null;
  subcategory_id?: number | null;
  average_rating?: number | null;
  rating_count?: number | null;
  [key: string]: unknown;
}

export interface SearchService {
  id: string;
  supplier_id: number;
  title: string;
  description?: string | null;
  price: number;
  is_active: boolean;
  images?: unknown[];
  cover_image_url?: string | null;
  [key: string]: unknown;
}

export interface SearchResponse {
  query: string;
  type_filter: SearchTypeFilter;
  products: Product[];
  services: SearchService[];
  directories: SearchDirectory[];
  counts: {
    products: number;
    services: number;
    directories: number;
  };
}

export interface SearchParams {
  query: string;
  type_filter?: SearchTypeFilter;
  skip?: number;
  limit?: number;
  per_type?: number;
  category?: string;
  category_id?: number | null;
  subcategory?: string;
  subcategory_id?: number | null;
  min_price?: number;
  max_price?: number;
  best_rated?: boolean;
  location?: { latitude?: number | null; longitude?: number | null; city?: string | null; state?: string | null } | null;
  /**
   * When true, the request will NOT include any `city` / `state` / `location`
   * params — neither from the explicit `location` arg nor from the
   * `user_city` / `user_state` cookies. Useful for directory lookups where
   * filtering by city would drop city=null rows.
   */
  disableLocation?: boolean;
  /**
   * When true, the early-return short-circuit for empty queries is skipped,
   * so the request actually reaches the backend with an empty `q` param.
   * Needed for the home page's "no query" state, where we still want
   * directory/provender highlights from the unified search.
   */
  allowEmptyQuery?: boolean;
}

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

const EMPTY_RESPONSE: SearchResponse = {
  query: "",
  type_filter: "all",
  products: [],
  services: [],
  directories: [],
  counts: { products: 0, services: 0, directories: 0 },
};

const toProductList = (value: unknown): Product[] => {
  if (Array.isArray(value)) return value as Product[];
  return [];
};

const toServiceList = (value: unknown): SearchService[] => {
  if (Array.isArray(value)) return value as SearchService[];
  return [];
};

const toDirectoryList = (value: unknown): SearchDirectory[] => {
  if (Array.isArray(value)) return value as SearchDirectory[];
  return [];
};

const asCount = (value: unknown, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export async function searchAll(params: SearchParams): Promise<SearchResponse> {
  const query = String(params.query || "").trim();
  if (!query && !params.allowEmptyQuery) return { ...EMPTY_RESPONSE, query: "" };

  const queryParams = new URLSearchParams();
  // Backend uses `q` (not `query`) for the search term.
  queryParams.set("q", query);
  queryParams.set("type_filter", params.type_filter ?? "all");
  // Cap per section so the unified response stays bounded.
  if (params.per_type !== undefined) {
    queryParams.append("per_type", String(params.per_type));
  } else {
    queryParams.append("per_type", String(Math.min(params.limit ?? 8, 50)));
  }
  if (params.skip !== undefined) queryParams.append("skip", params.skip.toString());
  if (params.limit !== undefined) queryParams.append("limit", params.limit.toString());
  if (params.best_rated) queryParams.append("best_rated", "true");
  if (params.category_id !== undefined && params.category_id !== null) {
    queryParams.append("category_id", String(params.category_id));
  } else if (params.category) {
    queryParams.append("category", params.category);
  }
  if (params.subcategory_id !== undefined && params.subcategory_id !== null) {
    queryParams.append("subcategory_id", String(params.subcategory_id));
  } else if (params.subcategory) {
    queryParams.append("subcategory", params.subcategory);
  }
  if (params.min_price !== undefined) queryParams.append("min_price", params.min_price.toString());
  if (params.max_price !== undefined) queryParams.append("max_price", params.max_price.toString());

  if (params.disableLocation) {
    // Caller asked us not to apply any location filter.
  } else {
    // Backend expects flat `city` / `state` / `location` query params, not an object.
    let cityValue: string | null = null;
    let stateValue: string | null = null;
    if (params.location) {
      cityValue = params.location.city || null;
      stateValue = params.location.state || null;
    } else {
      const cityCookie = normalizeLocationText(getCookieValue("user_city"));
      const stateCookie = normalizeLocationText(getCookieValue("user_state"));
      if (cityCookie) cityValue = cityCookie;
      if (stateCookie) stateValue = stateCookie;
    }
    if (cityValue) queryParams.append("city", cityValue);
    if (stateValue) queryParams.append("state", stateValue);
  }

  try {
    const deviceId = getDeviceId();
    const url = `/api/search?${queryParams.toString()}`;
    if (process.env.NODE_ENV === "development") {
      console.log("🔎 Unified search:", url);
    }
    const response = await fetchWithAuth(url, {
      headers: {
        Accept: "application/json",
        ...(deviceId ? { "X-Device-ID": deviceId } : {}),
      },
    });

    if (!response.ok) {
      console.warn(`Unified search failed (${response.status} ${response.statusText})`);
      return {
        ...EMPTY_RESPONSE,
        query,
        type_filter: params.type_filter ?? "all",
      };
    }

    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!data) {
      return { ...EMPTY_RESPONSE, query, type_filter: params.type_filter ?? "all" };
    }

    const products = toProductList(data.products);
    const services = toServiceList(data.services);
    const directories = toDirectoryList(data.directories);

    const counts =
      data.counts && typeof data.counts === "object"
        ? (data.counts as Record<string, unknown>)
        : null;

    return {
      query: typeof data.query === "string" ? data.query : query,
      type_filter:
        typeof data.type_filter === "string"
          ? (data.type_filter as SearchTypeFilter)
          : (params.type_filter ?? "all"),
      products,
      services,
      directories,
      counts: {
        products: counts ? asCount(counts.products, products.length) : products.length,
        services: counts ? asCount(counts.services, services.length) : services.length,
        directories: counts ? asCount(counts.directories, directories.length) : directories.length,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Failed to run unified search:", message);
    return { ...EMPTY_RESPONSE, query, type_filter: params.type_filter ?? "all" };
  }
}
