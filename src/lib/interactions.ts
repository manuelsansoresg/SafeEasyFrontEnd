import { Product } from './products';
import { getDeviceId } from '@/utils/device';
import { fetchWithAuth } from '@/lib/api';

// Use local proxy for client-side requests to avoid CORS
// The proxy at /api/ strips the first '/api' segment.
// We target the root of the backend API.
const BASE_URL = '/api';

export interface InteractionData {
  product_id?: string | number;
  search_term?: string;
  interaction_type: 'view' | 'search';
}

export const registerInteraction = async (data: InteractionData) => {
  const deviceId = getDeviceId();
  const url = `${BASE_URL}/interactions/`;
  try {
    const res = await fetchWithAuth(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-ID': deviceId || '',
      },
      body: JSON.stringify(data),
      // keepalive: true, // Removed to avoid potential socket errors in some environments
    });
    if (!res.ok) {
        console.error(`Error registering interaction at ${url}:`, await res.text());
    }
  } catch (error) {
    console.error(`Error tracking interaction at ${url}:`, error);
  }
};

export const getRecommendations = async (limit: number = 20, skip: number = 0): Promise<Product[]> => {
  const deviceId = getDeviceId();
  // Ensure no double slash issues, though fetch usually handles it.
  const url = `${BASE_URL}/interactions/recommendations?limit=${limit}&skip=${skip}`;
  try {
    const res = await fetchWithAuth(url, {
      headers: {
        'X-Device-ID': deviceId || '',
      }
    });
    if (res.ok) {
      const text = await res.text();
      if (!text) return [];
      try {
        const data = JSON.parse(text);
        if (Array.isArray(data)) return data;
        // Handle wrapped responses
        if (data && typeof data === 'object') {
            if (Array.isArray((data as any).items)) return (data as any).items;
            if (Array.isArray((data as any).results)) return (data as any).results;
            if (Array.isArray((data as any).data)) return (data as any).data;
        }
        return [];
      } catch (e) {
        console.error("JSON parse error in getRecommendations", e);
        return [];
      }
    }
    console.error(`Failed to fetch recommendations from ${url}: Status ${res.status}`);
    return [];
  } catch (err) {
    console.error(`Error fetching recommendations from ${url}:`, err);
    return [];
  }
};

export const getFallbackProducts = async (limit: number = 20, skip: number = 0): Promise<Product[]> => {
    const url = `/api/products/?limit=${limit}&skip=${skip}`;
    try {
        const res = await fetchWithAuth(url);
        if (res.ok) {
            const text = await res.text();
            if (!text) return [];
            try {
                const data = JSON.parse(text);
                if (Array.isArray(data)) return data;
                if (data && typeof data === 'object') {
                    if (Array.isArray((data as any).items)) return (data as any).items;
                    if (Array.isArray((data as any).results)) return (data as any).results;
                    if (Array.isArray((data as any).data)) return (data as any).data;
                }
                return [];
            } catch (e) {
                console.error("JSON parse error in getFallbackProducts", e);
                return [];
            }
        }
        console.error(`Failed to fetch fallback products from ${url}: Status ${res.status}`);
        return [];
    } catch (err) {
        console.error(`Error fetching fallback products from ${url}:`, err);
        return [];
    }
}

export const getSimilarProducts = async (slug: string, limit: number = 10, skip: number = 0): Promise<Product[]> => {
    const url = `/api/products/${slug}/similar?limit=${limit}&skip=${skip}`;
    try {
        const res = await fetchWithAuth(url);
        if (res.ok) {
            const text = await res.text();
            if (!text) return [];
            try {
                const data = JSON.parse(text);
                if (Array.isArray(data)) return data;
                if (data && typeof data === 'object') {
                    if (Array.isArray((data as any).items)) return (data as any).items;
                    if (Array.isArray((data as any).results)) return (data as any).results;
                    if (Array.isArray((data as any).data)) return (data as any).data;
                }
                return [];
            } catch (e) {
                console.error("JSON parse error in getSimilarProducts", e);
                return [];
            }
        }
        console.error(`Failed to fetch similar products from ${url}: Status ${res.status}`);
        return [];
    } catch (err) {
        console.error(`Error fetching similar products from ${url}:`, err);
        return [];
    }
}
