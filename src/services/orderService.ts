import { fetchWithAuth } from "@/lib/api";

export interface Order {
  id: number;
  supplier_id: number;
  product_id: string;
  conversation_id: string;
  buyer_id: number;
  delivery_type?: "pickup" | "shipping" | string;
  payment_method?: "card" | "transfer" | string;
  shipping_cost?: number | string | null;
  distance_km?: number | string | null;
  delivery_address?: string | null;
  shipping_address?: string | null;
  pickup_address?: string | null;
  total_amount?: string | number;
  payment_status?: string;
  fulfillment_status?: string;
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

export interface OrderRefund {
  id?: number;
  order_id?: number;
  reason?: string;
  file?: string | null;
  file_url?: string | null;
  evidence_url?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export const orderService = {
  getOrderById: async (orderId: number): Promise<Order> => {
    const tryUrls = [
      `/api/orders/${orderId}`,
      `/api/orders/${orderId}/`,
      `/api/v1/orders/${orderId}`,
      `/api/v1/orders/${orderId}/`,
    ];

    let response: Response | null = null;
    let usedUrl = "";
    for (const url of tryUrls) {
      usedUrl = url;
      response = await fetchWithAuth(url, { headers: { Accept: "application/json" } });
      if (response.ok) break;
      if (response.status === 404 || response.status === 405) continue;
      if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) continue;
      break;
    }

    if (!response || !response.ok) {
      const errorText = await response?.text().catch(() => "") ?? "";
      throw new Error(`Failed to fetch order: ${response?.status ?? "unknown"} ${usedUrl} ${errorText}`.trim());
    }

    const data: unknown = await response.json().catch(() => null);
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const nested = record.order && typeof record.order === "object" ? (record.order as Record<string, unknown>) : null;
      const candidate = (nested || record) as unknown;
      return candidate as Order;
    }

    throw new Error("Failed to fetch order: invalid response");
  },

  getMyOrderById: async (orderId: number): Promise<Order> => {
    try {
      const order = await orderService.getOrderById(orderId);
      return order;
    } catch {
      const all = await orderService.getMyOrders();
      const found = all.find((o) => Number(o.id) === Number(orderId));
      if (!found) throw new Error("No se encontró la orden.");
      return found;
    }
  },

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

    const tryUrls = [
      `/api/orders/${orderId}/status/`,
      `/api/orders/${orderId}/status`,
      `/api/v1/orders/${orderId}/status/`,
      `/api/v1/orders/${orderId}/status`,
    ];

    let response: Response | null = null;
    let usedUrl = "";
    for (const url of tryUrls) {
      usedUrl = url;
      response = await fetchWithAuth(url, options);
      if (response.ok) break;
      if (response.status === 404 || response.status === 405) continue;
      if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) continue;
      break;
    }

    if (!response || !response.ok) {
      const errorText = await response?.text().catch(() => 'No error details') ?? '';
      throw new Error(`Failed to update order status: ${response?.status ?? "unknown"} ${usedUrl} ${errorText}`.trim());
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return response.json();
    return null;
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

  getOrderRefunds: async (orderId: number): Promise<OrderRefund[]> => {
    const tryUrls = [
      `/api/orders/${orderId}/refunds`,
      `/api/orders/${orderId}/refunds/`,
      `/api/api/v1/orders/${orderId}/refunds`,
      `/api/v1/orders/${orderId}/refunds`,
    ];

    let response: Response | null = null;
    let usedUrl = "";
    for (const url of tryUrls) {
      usedUrl = url;
      response = await fetchWithAuth(url);
      if (response.ok) break;
      if (response.status !== 404 && response.status !== 405) break;
    }

    if (!response || !response.ok) {
      const errorText = await response?.text().catch(() => "") ?? "";
      throw new Error(`Failed to fetch refunds: ${response?.status ?? "unknown"} ${usedUrl} ${errorText}`.trim());
    }

    const data: unknown = await response.json().catch(() => null);
    if (Array.isArray(data)) return data as OrderRefund[];
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const items = record.items ?? record.results ?? record.data ?? record.refunds;
      if (Array.isArray(items)) return items as OrderRefund[];
      if (
        "id" in record ||
        "reason" in record ||
        "file" in record ||
        "file_url" in record ||
        "evidence_url" in record
      ) {
        return [record as unknown as OrderRefund];
      }
    }
    return [];
  },

  approveOrderRefund: async (orderId: number, refundId: number, note?: string) => {
    const payload: Record<string, unknown> = {};
    if (typeof note === "string" && note.trim().length > 0) {
      payload.note = note.trim();
    }
    const options = { method: "POST" as const, body: JSON.stringify(payload) };
    const tryUrls = [
      `/api/orders/${orderId}/refunds/${refundId}/approve`,
      `/api/orders/${orderId}/refunds/${refundId}/approve/`,
      `/api/v1/orders/${orderId}/refunds/${refundId}/approve`,
      `/api/v1/orders/${orderId}/refunds/${refundId}/approve/`,
    ];

    let response: Response | null = null;
    let usedUrl = "";
    for (const url of tryUrls) {
      usedUrl = url;
      response = await fetchWithAuth(url, options);
      if ([301, 302, 307, 308].includes(response.status)) {
        const redirectUrl = response.headers.get("Location");
        if (redirectUrl && (redirectUrl.startsWith("/") || redirectUrl.startsWith(window.location.origin))) {
          response = await fetchWithAuth(redirectUrl, options);
        }
      }
      if (response.ok) break;
      if (response.status !== 404 && response.status !== 405) break;
    }

    if (!response || !response.ok) {
      const errorText = await response?.text().catch(() => "") ?? "";
      throw new Error(`Failed to approve refund: ${response?.status ?? "unknown"} ${usedUrl} ${errorText}`.trim());
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return response.json();
    return null;
  },

  rejectOrderRefund: async (orderId: number, refundId: number, reason: string) => {
    const payload: Record<string, unknown> = { reason };
    const options = { method: "POST" as const, body: JSON.stringify(payload) };
    const tryUrls = [
      `/api/orders/${orderId}/refunds/${refundId}/reject`,
      `/api/orders/${orderId}/refunds/${refundId}/reject/`,
      `/api/v1/orders/${orderId}/refunds/${refundId}/reject`,
      `/api/v1/orders/${orderId}/refunds/${refundId}/reject/`,
    ];

    let response: Response | null = null;
    let usedUrl = "";
    for (const url of tryUrls) {
      usedUrl = url;
      response = await fetchWithAuth(url, options);
      if ([301, 302, 307, 308].includes(response.status)) {
        const redirectUrl = response.headers.get("Location");
        if (redirectUrl && (redirectUrl.startsWith("/") || redirectUrl.startsWith(window.location.origin))) {
          response = await fetchWithAuth(redirectUrl, options);
        }
      }
      if (response.ok) break;
      if (response.status !== 404 && response.status !== 405) break;
    }

    if (!response || !response.ok) {
      const errorText = await response?.text().catch(() => "") ?? "";
      throw new Error(`Failed to reject refund: ${response?.status ?? "unknown"} ${usedUrl} ${errorText}`.trim());
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return response.json();
    return null;
  },

  markOrderRefunded: async (orderId: number, refundId: number, note?: string, file?: File | null) => {
    const form = new FormData();
    if (typeof note === "string" && note.trim().length > 0) {
      form.append("note", note.trim());
    }
    if (file) {
      form.append("file", file);
    }

    const options = { method: "POST" as const, body: form };
    const tryUrls = [
      `/api/orders/${orderId}/refunds/${refundId}/mark-refunded`,
      `/api/orders/${orderId}/refunds/${refundId}/mark-refunded/`,
      `/api/v1/orders/${orderId}/refunds/${refundId}/mark-refunded`,
      `/api/v1/orders/${orderId}/refunds/${refundId}/mark-refunded/`,
    ];

    let response: Response | null = null;
    let usedUrl = "";
    for (const url of tryUrls) {
      usedUrl = url;
      response = await fetchWithAuth(url, options);
      if ([301, 302, 307, 308].includes(response.status)) {
        const redirectUrl = response.headers.get("Location");
        if (redirectUrl && (redirectUrl.startsWith("/") || redirectUrl.startsWith(window.location.origin))) {
          response = await fetchWithAuth(redirectUrl, options);
        }
      }
      if (response.ok) break;
      if (response.status !== 404 && response.status !== 405) break;
    }

    if (!response || !response.ok) {
      const errorText = await response?.text().catch(() => "") ?? "";
      throw new Error(`Failed to mark refunded: ${response?.status ?? "unknown"} ${usedUrl} ${errorText}`.trim());
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return response.json();
    return null;
  },

  markOrderReady: async (orderId: number) => {
    const options = { method: "POST" as const };
    const tryUrls = [
      `/api/orders/${orderId}/mark-ready`,
      `/api/orders/${orderId}/mark-ready/`,
      `/api/v1/orders/${orderId}/mark-ready`,
      `/api/v1/orders/${orderId}/mark-ready/`,
    ];

    let response: Response | null = null;
    let usedUrl = "";
    for (const url of tryUrls) {
      usedUrl = url;
      response = await fetchWithAuth(url, options);
      if ([301, 302, 307, 308].includes(response.status)) {
        const redirectUrl = response.headers.get("Location");
        if (redirectUrl && (redirectUrl.startsWith("/") || redirectUrl.startsWith(window.location.origin))) {
          response = await fetchWithAuth(redirectUrl, options);
        }
      }
      if (response.ok) break;
      if (response.status !== 404 && response.status !== 405) break;
    }

    if (!response || !response.ok) {
      const errorText = await response?.text().catch(() => "") ?? "";
      throw new Error(`Failed to mark order ready: ${response?.status ?? "unknown"} ${usedUrl} ${errorText}`.trim());
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return response.json();
    return null;
  },

  completeOrder: async (orderId: number, note?: string) => {
    const payload: Record<string, unknown> = {};
    if (typeof note === "string" && note.trim().length > 0) {
      payload.note = note.trim();
    }
    const options = { method: "PUT" as const, body: JSON.stringify(payload) };
    const tryUrls = [
      `/api/orders/${orderId}/complete`,
      `/api/orders/${orderId}/complete/`,
      `/api/v1/orders/${orderId}/complete`,
      `/api/v1/orders/${orderId}/complete/`,
    ];

    let response: Response | null = null;
    let usedUrl = "";
    for (const url of tryUrls) {
      usedUrl = url;
      response = await fetchWithAuth(url, options);
      if ([301, 302, 307, 308].includes(response.status)) {
        const redirectUrl = response.headers.get("Location");
        if (redirectUrl && (redirectUrl.startsWith("/") || redirectUrl.startsWith(window.location.origin))) {
          response = await fetchWithAuth(redirectUrl, options);
        }
      }
      if (response.ok) break;
      if (response.status !== 404 && response.status !== 405) break;
    }

    if (!response || !response.ok) {
      const errorText = await response?.text().catch(() => "") ?? "";
      throw new Error(`Failed to complete order: ${response?.status ?? "unknown"} ${usedUrl} ${errorText}`.trim());
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return response.json();
    return null;
  },
};
