import { fetchWithAuth } from "@/lib/api";

export interface Order {
  id: number;
  supplier_id: number;
  product_id: string;
  conversation_id: string;
  buyer_id: number;
  total_amount?: string | number;
  payment_status?: string;
  receipt_url?: string;
  status?: 'pending' | 'completed' | 'cancelled' | string;
  created_at: string;
  updated_at: string;
  supplier: {
    name: string;
    // ... other supplier fields if needed
    id?: number;
    slug?: string;
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
    supplier_id?: number;
    slug?: string;
  };
}

export interface OrderHistoryItem {
  created_at?: string;
  timestamp?: string;
  date?: string;
  status?: string;
  event?: string;
  action?: string;
  description?: string;
  message?: string;
  actor?: string;
  user?: { id?: number; name?: string; role?: string };
}

export const orderService = {
  getOrders: async (
    page = 1,
    limit = 10,
    supplierId?: number,
    productId?: string
  ): Promise<Order[]> => {
    const skip = (page - 1) * limit;
    const params = new URLSearchParams();
    params.set("skip", String(skip));
    params.set("limit", String(limit));
    if (supplierId && Number.isFinite(supplierId)) {
      params.set("supplier_id", String(supplierId));
    }
    if (productId) {
      params.set("product_id", String(productId));
    }

    const response = await fetchWithAuth(`/api/orders?${params.toString()}`);
    if (!response.ok) {
      throw new Error("Failed to fetch orders");
    }
    return response.json();
  },

  getOrderHistory: async (orderId: number): Promise<OrderHistoryItem[]> => {
    let url = `/api/orders/${orderId}/history`;
    let response = await fetchWithAuth(url);

    if (response.status === 404 || response.status === 405) {
      url = `/api/orders/${orderId}/history/`;
      response = await fetchWithAuth(url);
    }

    if (!response.ok) {
      throw new Error("Failed to fetch order history");
    }

    const data: unknown = await response.json().catch(() => null);
    if (Array.isArray(data)) return data as OrderHistoryItem[];
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const items = record.items ?? record.results;
      if (Array.isArray(items)) return items as OrderHistoryItem[];
    }
    return [];
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
