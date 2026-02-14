
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
  thumbnail_url?: string;
  average_rating?: number;
  supplier?: Supplier;
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
  about: string | null;
  short_description: string | null;
  description: string | null;
  address: string | null;
  exterior_number: string | null;
  interior_number: string | null;
  neighborhood: string | null;
  user_id: number;
  logo: string | null;
  about_image: string | null;
  carousel_images: CarouselImage[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  certificates: any[];
  average_rating?: number;
  rating_count?: number;
  transfer_accepted?: boolean;
  transfer_clabe?: string;
  transfer_bank?: string;
  transfer_name?: string;
  map_location?: string;
}

export interface CarouselImage {
  id: number;
  title: string;
  description: string;
  image: string;
  thumbnail: string;
  supplier_id: number;
}

export async function getProducts(
  page: number = 1, 
  limit: number = 20, 
  query: string = "",
  categorySlug?: string,
  subcategorySlug?: string,
  token?: string
): Promise<Product[]> {
  const skip = (page - 1) * limit;
  // Use the internal API URL or fallback
  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://3.15.176.110:8080').trim();
  
  let url = `${baseUrl}/products/?skip=${skip}&limit=${limit}`;
  
  // Note: Adjust the query parameter name ('search', 'q', etc.) based on your backend implementation.
  // Assuming 'search' for now as it's common.
  if (query) {
    url += `&search=${encodeURIComponent(query)}`;
  }

  if (categorySlug) {
    url += `&category=${encodeURIComponent(categorySlug)}`;
  }

  if (subcategorySlug) {
    url += `&subcategory=${encodeURIComponent(subcategorySlug)}`;
  }
  
  console.log("Fetching products from:", url);

  const headers: HeadersInit = {
    'Accept': 'application/json',
    'User-Agent': 'SafeEasyFrontEnd/1.0'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, { 
      // cache: 'no-store', // Deprecated in favor of next: { revalidate: 0 } or similar in some contexts, but valid in 14/15/16
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
       console.warn("Cause:", (error as any).cause);
    }
    return [];
  }
}
