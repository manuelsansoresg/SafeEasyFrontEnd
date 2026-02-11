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
      return await res.json();
    }
    console.error(`Failed to fetch recommendations from ${url}: Status ${res.status}`);
    return [];
  } catch (err) {
    console.error(`Error fetching recommendations from ${url}:`, err);
    return [];
  }
};

export const getFallbackProducts = async (limit: number = 20, skip: number = 0): Promise<Product[]> => {
    // Fallback usually goes to the standard products endpoint which might be at root /products
    // If the backend has products at /products/, we should use /api/products/ via proxy.
    const url = `${BASE_URL}/products/?limit=${limit}&skip=${skip}`;
    try {
        const res = await fetchWithAuth(url);
        if (res.ok) {
            return await res.json();
        }
        console.error(`Failed to fetch fallback products from ${url}: Status ${res.status}`);
        return [];
    } catch (err) {
        console.error(`Error fetching fallback products from ${url}:`, err);
        return [];
    }
}

export const getSimilarProducts = async (slug: string, limit: number = 10, skip: number = 0): Promise<Product[]> => {
    const url = `${BASE_URL}/products/${slug}/similar?limit=${limit}&skip=${skip}`;
    try {
        const res = await fetchWithAuth(url);
        if (res.ok) {
            return await res.json();
        }
        console.error(`Failed to fetch similar products from ${url}: Status ${res.status}`);
        return [];
    } catch (err) {
        console.error(`Error fetching similar products from ${url}:`, err);
        return [];
    }
}
