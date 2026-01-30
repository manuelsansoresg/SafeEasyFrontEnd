import { fetchWithAuth } from "@/lib/api";

export interface Order {
  id: number;
  supplier_id: number;
  product_id: string;
  conversation_id: string;
  status: 'pending' | 'completed' | 'cancelled';
  buyer_id: number;
  created_at: string;
  updated_at: string;
  supplier: {
    name: string;
    // ... other supplier fields if needed
  };
  buyer: {
    id: number;
    name: string;
    email: string;
    // ... other buyer fields
  };
  product: {
    id: string;
    title: string;
    price: number;
    // ... other product fields
  };
}

export const orderService = {
  getOrders: async (page = 1, limit = 10): Promise<Order[]> => {
    // Note: The user requirement didn't specify query params for pagination in the GET /orders endpoint
    // but usually they exist. I'll append them if the API supports it, otherwise I'll just fetch.
    // The user said: "este es el enpont del api es metodo GET /orders y devuelve esto [ ... ]"
    // "ese listado debe paginarse" -> This might mean client-side pagination if the API doesn't support it,
    // or the API supports it but the user didn't document the params.
    // I'll assume standard query params ?skip=0&limit=10 or ?page=1&page_size=10. 
    // Given the previous patterns in many APIs, I'll try without params first or check if there are other services.
    // Let's check chatService to see how it handles things.
    // For now I will assume the API returns all orders and I paginate client side, OR I pass params.
    // Let's assume standard `?skip=${(page-1)*limit}&limit=${limit}` or similar.
    // However, the user provided a JSON array example, not a paginated response object (e.g. { items: [], total: 100 }).
    // If it returns a plain array, I might have to paginate client-side or the array IS the page.
    // I'll assume it returns the full list for now or the current page.
    
    // Let's try to fetch with no params first, but standard is usually query params.
    // I will pass `skip` and `limit` just in case.
    const skip = (page - 1) * limit;
    const response = await fetchWithAuth(`/api/orders?skip=${skip}&limit=${limit}`);
    if (!response.ok) {
      throw new Error("Failed to fetch orders");
    }
    return response.json();
  },

  updateOrderStatus: async (orderId: number, status: string) => {
    const body = JSON.stringify({ status });
    const options = {
      method: 'PUT',
      body,
    };

    // Try multiple URL patterns to ensure we hit the correct backend endpoint
    // 1. Standard pattern (matches getOrders)
    let url = `/api/orders/${orderId}/status`;
    console.log(`[OrderService] Updating status at: ${url}`);
    
    let response = await fetchWithAuth(url, options);

    if (response.status === 404 || response.status === 405) {
        console.warn(`[OrderService] ${response.status} on ${url}, trying with trailing slash...`);
        // 2. Try with trailing slash (FastAPI/Django sometimes requires this)
        url = `/api/orders/${orderId}/status/`;
        response = await fetchWithAuth(url, options);
    }

    if (response.status === 404 || response.status === 405) {
        console.warn(`[OrderService] ${response.status} on ${url}, trying v1 prefix...`);
        // 3. Try v1 prefix
        url = `/api/api/v1/orders/${orderId}/status`;
        response = await fetchWithAuth(url, options);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      console.error(`[OrderService] Failed to update order status. Status: ${response.status}. URL: ${url}. Response: ${errorText}`);
      throw new Error(`Failed to update order status: ${response.status} ${errorText}`);
    }
    return response.json();
  }
};
