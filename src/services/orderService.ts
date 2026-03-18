import { fetchWithAuth } from "@/lib/api";

export interface Order {
  id: number;
  supplier_id: number;
  product_id: string;
  conversation_id: string;
  buyer_id: number;
  total_amount?: string | number;
  payment_status?: string;
  visual_status?: string;
  receipt_url?: string;
  status?: 'pending' | 'completed' | 'cancelled' | string;
  created_at: string;
  updated_at: string;
  supplier: {
    name: string;
    // ... other supplier fields if needed
    id?: number;
    slug?: string;
    transfer_clabe?: string | null;
    transfer_bank?: string | null;
    transfer_name?: string | null;
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
    thumbnail_url?: string | null;
    image?: string | null;
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
    const tryUrls = [`/api/orders/`, `/api/orders`];
    let response: Response | null = null;
    let usedUrl = "";
    for (const url of tryUrls) {
      usedUrl = url;
      response = await fetchWithAuth(url);
      if (response.ok) break;
      if (response.status !== 404 && response.status !== 405) break;
    }

    if (!response || !response.ok) {
      const status = response?.status ?? "unknown";
      const bodyText = await response?.text().catch(() => "") ?? "";
      throw new Error(`Failed to fetch orders (${status}) ${usedUrl} ${bodyText}`.trim());
    }

    const data: unknown = await response.json().catch(() => null);
    const all: Order[] = Array.isArray(data)
      ? (data as Order[])
      : data && typeof data === "object"
        ? (((data as Record<string, unknown>).items as Order[]) ||
            ((data as Record<string, unknown>).results as Order[]) ||
            ((data as Record<string, unknown>).data as Order[]) ||
            ((data as Record<string, unknown>).orders as Order[]) ||
            [])
        : [];

    let filtered = all;
    if (supplierId && Number.isFinite(supplierId)) {
      filtered = filtered.filter((o) => Number(o.supplier_id) === Number(supplierId));
    }
    if (productId) {
      filtered = filtered.filter((o) => String(o.product_id) === String(productId));
    }

    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : filtered.length;
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const start = (safePage - 1) * safeLimit;
    const end = start + safeLimit;
    return filtered.slice(start, end);
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

  updateOrderStatus: async (orderId: number, status: string, note?: string) => {
    const payload: Record<string, unknown> = { status };
    if (typeof note === "string" && note.trim().length > 0) {
      payload.note = note;
    }
    const body = JSON.stringify(payload);
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
  },

  getMyOrders: async (): Promise<Order[]> => {
    const tryUrls = [
      `/api/users/me/orders`,
      `/api/users/me/orders/`,
    ];

    let response: Response | null = null;
    for (const url of tryUrls) {
      response = await fetchWithAuth(url);
      if (response.ok) break;
      if (response.status !== 404 && response.status !== 405) break;
    }

    if (!response || !response.ok) {
      throw new Error("Failed to fetch my orders");
    }

    const data: unknown = await response.json().catch(() => null);
    if (Array.isArray(data)) return data as Order[];
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const items = record.items ?? record.results ?? record.data ?? record.orders;
      if (Array.isArray(items)) return items as Order[];
    }
    return [];
  },

  uploadOrderReceipt: async (orderId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);

    const options = {
      method: "POST",
      body: form,
    };

    const tryUrls = [
      `/api/orders/${orderId}/receipt`,
      `/api/orders/${orderId}/receipt/`,
      `/api/api/v1/orders/${orderId}/receipt`,
    ];

    let response: Response | null = null;
    let usedUrl = "";
    for (const url of tryUrls) {
      usedUrl = url;
      response = await fetchWithAuth(url, options);
      if (response.ok) break;
      if (response.status !== 404 && response.status !== 405) break;
    }

    if (!response || !response.ok) {
      const errorText = await response?.text().catch(() => "") ?? "";
      throw new Error(`Failed to upload receipt: ${response?.status ?? "unknown"} ${usedUrl} ${errorText}`.trim());
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    return null;
  },

  requestOrderRefund: async (orderId: number, reason: string, file?: File | null) => {
    const form = new FormData();
    form.append("reason", reason);
    if (file) {
      form.append("file", file);
    }

    const options = {
      method: "POST",
      body: form,
    };

    const tryUrls = [
      `/api/orders/${orderId}/refunds`,
      `/api/orders/${orderId}/refunds/`,
      `/api/api/v1/orders/${orderId}/refunds`,
    ];

    let response: Response | null = null;
    let usedUrl = "";
    for (const url of tryUrls) {
      usedUrl = url;
      response = await fetchWithAuth(url, options);
      if (response.ok) break;
      if (response.status !== 404 && response.status !== 405) break;
    }

    if (!response || !response.ok) {
      const errorText = await response?.text().catch(() => "") ?? "";
      throw new Error(
        `Failed to request refund: ${response?.status ?? "unknown"} ${usedUrl} ${errorText}`.trim()
      );
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    return null;
  },
};
