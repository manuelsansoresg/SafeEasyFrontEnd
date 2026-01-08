
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
}

export async function getProducts(
  page: number = 1, 
  limit: number = 20, 
  query: string = "",
  categorySlug?: string,
  subcategorySlug?: string
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

  try {
    const res = await fetch(url, { 
      // cache: 'no-store', // Deprecated in favor of next: { revalidate: 0 } or similar in some contexts, but valid in 14/15/16
      next: { revalidate: 0 },
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SafeEasyFrontEnd/1.0'
      }
    });
    
    if (!res.ok) {
      console.error(`Failed to fetch products: ${res.status} ${res.statusText}`);
      return [];
    }
    
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching products:", error);
    if (error instanceof Error && 'cause' in error) {
       console.error("Cause:", (error as any).cause);
    }
    return [];
  }
}
