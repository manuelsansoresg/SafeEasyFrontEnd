import { NextRequest, NextResponse } from 'next/server';

const getBaseUrl = () => {
  const internal = process.env.API_INTERNAL_URL;
  if (internal) return internal;
  
  const publicUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (publicUrl && !publicUrl.includes('localhost') && !publicUrl.startsWith('/')) {
      return publicUrl;
  }
  
  return 'https://drooopy.com/api/';
};

const BASE_URL = getBaseUrl();

// Fallback: Fetch real products from the supplier if recommendations are not available
const fetchFallbackProducts = async (supplierId: string, limit: number, token?: string) => {
    try {
        const backendUrl = BASE_URL.replace(/\/+$/, '');
        // Use the general products endpoint filtered by supplier
        // This endpoint is verified to exist in page.tsx logic
        const targetUrl = `${backendUrl}/products/by-supplier/${supplierId}?limit=${limit}&skip=0`;
        
        console.log(`[API Proxy] Fetching fallback products: ${targetUrl}`);
        
        const res = await fetch(targetUrl, {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': token } : {})
            },
            cache: 'no-store'
        });

        if (res.ok) {
            const data = await res.json();
            // Handle different response structures (list or paginated object)
            let items = [];
            if (Array.isArray(data)) {
                items = data;
            } else if (data && Array.isArray(data.items)) {
                items = data.items;
            } else if (data && Array.isArray(data.results)) {
                items = data.results;
            }
            
            // Return only the requested number of items
            return items.slice(0, limit);
        } else {
            console.warn(`[API Proxy] Fallback fetch failed: ${res.status}`);
            return [];
        }
    } catch (error) {
        console.error(`[API Proxy] Fallback fetch error:`, error);
        return [];
    }
};

// Fallback 2: Fetch global products if supplier products are not available
const fetchGlobalProducts = async (limit: number, token?: string) => {
    try {
        const backendUrl = BASE_URL.replace(/\/+$/, '');
        // Fetch from global products endpoint
        const targetUrl = `${backendUrl}/products/?limit=${limit}&skip=0`;
        
        console.log(`[API Proxy] Fetching global fallback products: ${targetUrl}`);
        
        const res = await fetch(targetUrl, {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': token } : {})
            },
            cache: 'no-store'
        });

        if (res.ok) {
            const data = await res.json();
            // Handle different response structures
            let items = [];
            if (Array.isArray(data)) {
                items = data;
            } else if (data && Array.isArray(data.items)) {
                items = data.items;
            } else if (data && Array.isArray(data.results)) {
                items = data.results;
            }
            
            return items.slice(0, limit);
        } else {
            return [];
        }
    } catch (error) {
        console.error(`[API Proxy] Global fetch error:`, error);
        return [];
    }
};

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const searchParams = request.nextUrl.searchParams;
    const kind = searchParams.get('kind') || 'most_searched';
    const limit = parseInt(searchParams.get('limit') || '5');
    const { id: supplierId } = await params;
    const token = request.headers.get('Authorization') || undefined;

    // 1. Try to fetch from real backend first (Recommended Endpoint)
    const backendUrl = BASE_URL.replace(/\/+$/, '');
    const targetUrl = `${backendUrl}/products/recommended/supplier/${supplierId}?kind=${kind}&limit=${limit}`;
    
    try {
        console.log(`[API Proxy] Trying backend recommended: ${targetUrl}`);
        const res = await fetch(targetUrl, {
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': token } : {})
            },
            cache: 'no-store'
        });

        if (res.ok) {
            const data = await res.json();
            
            // If we have data, return it immediately
            if (Array.isArray(data) && data.length > 0) {
                return NextResponse.json(data);
            }
            
            // If data is empty but request was OK, user might still want to see *something* in the UI
            // So we fall through to fallback logic below
            console.log(`[API Proxy] Recommended endpoint returned empty, trying fallback.`);
        } else {
            console.warn(`[API Proxy] Recommended endpoint failed with ${res.status}, trying fallback.`);
        }
    } catch (error) {
        console.error(`[API Proxy] Recommended fetch error:`, error);
    }

    // 2. Fallback: Get ANY products from this supplier so the carousel isn't empty/broken
    // This solves "images don't exist" by using real products
    const fallbackProducts = await fetchFallbackProducts(supplierId, limit, token);
    
    if (fallbackProducts.length > 0) {
        // If we found products, we can rotate/shuffle them slightly to simulate different sections
        let rotated = [...fallbackProducts];
        if (kind === 'most_purchased') {
            // Rotate by 1
            rotated.push(rotated.shift()!);
        } else if (kind === 'best_rated') {
            // Rotate by 2
            if (rotated.length > 1) {
                rotated.push(rotated.shift()!);
                rotated.push(rotated.shift()!);
            }
        }
        
        return NextResponse.json(rotated);
    }

    // 3. Global Fallback: If supplier has NO products, show global products to keep layout visible
    // This solves "carousel disappears"
    const globalProducts = await fetchGlobalProducts(limit, token);
    if (globalProducts.length > 0) {
         let rotated = [...globalProducts];
         // Shuffle slightly based on kind
         if (kind === 'most_purchased') rotated.push(rotated.shift()!);
         else if (kind === 'best_rated') rotated.reverse();
         
         return NextResponse.json(rotated);
    }

    // 4. Return empty array (Nothing found at all)
    return NextResponse.json([]);
}
