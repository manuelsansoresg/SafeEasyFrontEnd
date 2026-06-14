
export interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  stock: number;
  sku: string;
  is_active: boolean;
  supplier_id: number;
  category_id: number;
  subcategory_id: number;
  slug: string;
  thumbnail_url?: string | null;
  average_rating?: number;
  sales_count?: number;
  supplier?: Supplier;
}

export interface BusinessHour {
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface Supplier {
  id: number;
  name: string;
  slug: string | null;
  short_name: string | null;
  rfc: string | null;
  phone: string;
  email: string;
  city: string | null;
  state: string | null;
  country: string | null;
  is_active: boolean;
  is_verified?: boolean;
  about: string | null;
  title_about?: string | null;
  subtitle_about?: string | null;
  short_description: string | null;
  description: string | null;
  address: string | null;
  exterior_number: string | null;
  interior_number: string | null;
  neighborhood: string | null;
  user_id: number;
  logo: string | null;
  about_media: string | null;
  carousel_images: CarouselImage[];
  certificates: Certificate[];
  average_rating?: number;
  rating_count?: number;
  sales_count?: number;
  transfer_accepted?: boolean;
  transfer_clabe?: string;
  transfer_bank?: string;
  transfer_name?: string;
  map_location?: string;
  page_background_color?: string;
  background_color?: string; // Legacy field
  card_background_color?: string;
  header_background_color?: string;
  header_media_type?: 'image' | 'video';
  header_video?: string;
  primary_color?: string;
  business_hours?: BusinessHour[];
}

export interface CarouselImage {
  id: number;
  title: string;
  description: string;
  image: string;
  thumbnail: string;
  supplier_id: number;
}

export interface Certificate {
  id: number;
  name?: string;
  description: string;
  place: string;
  link?: string;
  image_url?: string;
  url?: string;
  path?: string;
  image?: string;
  thumbnail?: string;
  certificate_date?: string;
  expiration_date?: string;
  [key: string]: unknown;
}

export async function getProducts(
  page: number = 1, 
  limit: number = 20, 
  query: string = "",
  categorySlug?: string,
  subcategorySlug?: string,
  minPrice?: number,
  maxPrice?: number,
  bestRated?: boolean,
  token?: string,
  location?: { latitude?: number | null; longitude?: number | null; city?: string | null; state?: string | null } | null
): Promise<Product[]> {
  const skip = (page - 1) * limit;
  // Use the internal API URL or fallback
  let envBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://drooopy.com/api').trim();
  
  // Ensure absolute URL on server side
  if (typeof window === 'undefined' && envBase.startsWith('/')) {
      envBase = process.env.API_INTERNAL_URL || 'https://drooopy.com/api';
  }
  
  const baseUrl = envBase.replace(/\/$/, '');
  
  const queryParams = new URLSearchParams();
  queryParams.append("skip", skip.toString());
  queryParams.append("limit", limit.toString());
  
  if (query) queryParams.append("search", query);
  if (categorySlug) queryParams.append("category", categorySlug);
  if (subcategorySlug) queryParams.append("subcategory", subcategorySlug);
  if (minPrice !== undefined) queryParams.append("min_price", minPrice.toString());
  if (maxPrice !== undefined) queryParams.append("max_price", maxPrice.toString());
  if (bestRated) queryParams.append("best_rated", "true");
  
  if (location) {
    if (location.city) {
      // If we have a city name, use it as the location search term
      queryParams.append("location", location.city);
    } else {
      // Fallback to coordinates if no city name (or if backend supports it)
      queryParams.append("location", `${location.latitude},${location.longitude}`);
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

  const url = `${baseUrl}/products/?${queryParams.toString()}`;
  
  if (process.env.NODE_ENV === "development") console.log("🔍 Fetching products with params:", queryParams.toString());
  if (process.env.NODE_ENV === "development") console.log("📍 Location param sent:", queryParams.get("location") || "None");
  
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'DrooopyFrontEnd/1.0'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, { 
      next: { revalidate: 0 },
      headers
    });
    
    if (!res.ok) {
      console.error(`Failed to fetch products: ${res.status} ${res.statusText}`);
      return [];
    }
    
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("Warning: Error fetching products (returning empty list):", error);
    if (error instanceof Error && 'cause' in error) {
       console.warn("Cause:", (error as { cause?: unknown }).cause);
    }
    return [];
  }
}
