import { fetchWithAuth } from "@/lib/api";
import type {
  Plan,
  PurchaseResponse,
  Subscription,
  SubscriptionEvent,
  UpdateSubscriptionStatusPayload,
} from "@/types/subscriptions";

type ListSubscriptionsParams = {
  skip?: number;
  limit?: number;
  status?: "active" | "expired";
  search?: string;
};

const readJson = async <T>(response: Response): Promise<T> => {
  const text = await response.text().catch(() => "");
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    console.error("[subscriptionsService] Failed to parse JSON:", text.slice(0, 200));
    return null as T;
  }
};

const pickArray = <T>(data: unknown): T[] => {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const items = record.items ?? record.results ?? record.data ?? record.subscriptions ?? record.plans;
    if (Array.isArray(items)) return items as T[];
  }
  return [];
};

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return `${base.replace(/\/$/, "")}${path}`;
};

export const subscriptionsService = {
  async listSubscriptions(params: ListSubscriptionsParams): Promise<Subscription[]> {
    const qs = new URLSearchParams();
    if (typeof params.skip === "number") qs.set("skip", String(params.skip));
    if (typeof params.limit === "number") qs.set("limit", String(params.limit));
    if (params.status) qs.set("status", params.status);
    if (params.search && params.search.trim()) qs.set("search", params.search.trim());

    const query = qs.toString();
    const tryUrls = [
      apiUrl(`/admin/subscriptions/?${query}`),
      apiUrl(`/admin/subscriptions?${query}`),
      apiUrl(`/subscriptions/?${query}`),
      apiUrl(`/subscriptions?${query}`),
    ];
    let response: Response | null = null;
    for (const url of tryUrls) {
      response = await fetchWithAuth(url);
      if (response.ok) break;
      if (response.status !== 404 && response.status !== 405) break;
    }

    if (!response || !response.ok) {
      const text = await response?.text().catch(() => "") ?? "";
      console.error(`[subscriptionsService] listSubscriptions failed:`, {
        status: response?.status,
        statusText: response?.statusText,
        body: text.slice(0, 500),
        triedUrls: tryUrls,
      });
      throw new Error(`Failed to fetch subscriptions (${response?.status ?? "unknown"}) ${text}`.trim());
    }

    const json = await readJson<unknown>(response);
    return pickArray<Subscription>(json);
  },

  async listPlans(): Promise<Plan[]> {
    const tryUrls = [apiUrl(`/plans/?skip=0&limit=1000`), apiUrl(`/plans?skip=0&limit=1000`)];
    let response: Response | null = null;
    for (const url of tryUrls) {
      response = await fetchWithAuth(url);
      if (response.ok) break;
      if (response.status !== 404 && response.status !== 405) break;
    }
    if (!response || !response.ok) {
      const text = await response?.text().catch(() => "") ?? "";
      console.error(`[subscriptionsService] listPlans failed:`, {
        status: response?.status,
        statusText: response?.statusText,
        body: text.slice(0, 500),
        triedUrls: tryUrls,
      });
      throw new Error(`Failed to fetch plans (${response?.status ?? "unknown"}) ${text}`.trim());
    }
    const json = await readJson<unknown>(response);
    return pickArray<Plan>(json);
  },

  async getEvents(subscriptionId: number): Promise<SubscriptionEvent[]> {
    const tryUrls = [
      apiUrl(`/admin/subscriptions/${subscriptionId}/events`),
      apiUrl(`/admin/subscriptions/${subscriptionId}/events/`),
      apiUrl(`/subscriptions/${subscriptionId}/events`),
      apiUrl(`/subscriptions/${subscriptionId}/events/`),
    ];
    let response: Response | null = null;
    for (const url of tryUrls) {
      response = await fetchWithAuth(url);
      if (response.ok) break;
      if (response.status !== 404 && response.status !== 405) break;
    }
    if (!response || !response.ok) {
      const text = await response?.text().catch(() => "") ?? "";
      console.error(`[subscriptionsService] getEvents failed:`, {
        subscriptionId,
        status: response?.status,
        statusText: response?.statusText,
        body: text.slice(0, 500),
        triedUrls: tryUrls,
      });
      throw new Error(`Failed to fetch events (${response?.status ?? "unknown"}) ${text}`.trim());
    }
    const json = await readJson<unknown>(response);
    return pickArray<SubscriptionEvent>(json);
  },

  async updateStatus(subscriptionId: number, payload: UpdateSubscriptionStatusPayload) {
    const body = JSON.stringify(payload);
    const options = { method: "PUT", body };
    const tryUrls = [
      apiUrl(`/admin/subscriptions/${subscriptionId}/status`),
      apiUrl(`/admin/subscriptions/${subscriptionId}/status/`),
      apiUrl(`/subscriptions/${subscriptionId}/status`),
      apiUrl(`/subscriptions/${subscriptionId}/status/`),
    ];

    let response: Response | null = null;
    let used = "";
    for (const url of tryUrls) {
      used = url;
      response = await fetchWithAuth(url, options);
      if (response.ok) break;
      if (response.status === 404 || response.status === 405) continue;
      if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) continue;
      break;
    }

    if (!response || !response.ok) {
      const text = await response?.text().catch(() => "") ?? "";
      throw new Error(`Failed to update subscription (${response?.status ?? "unknown"}) ${used} ${text}`.trim());
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return readJson<unknown>(response);
    return null;
  },

  async getMySubscription(): Promise<Subscription | null> {
    const tryUrls = [apiUrl(`/subscriptions/my`), apiUrl(`/subscriptions/my/`)];
    let response: Response | null = null;
    for (const url of tryUrls) {
      response = await fetchWithAuth(url);
      if (response.ok) break;
      if (response.status !== 404 && response.status !== 405) break;
    }
    if (!response || !response.ok) {
      if (response?.status === 404) return null;
      const text = await response?.text().catch(() => "") ?? "";
      console.error(`[subscriptionsService] getMySubscription failed:`, {
        status: response?.status,
        statusText: response?.statusText,
        body: text.slice(0, 500),
      });
      throw new Error(`Failed to fetch my subscription (${response?.status ?? "unknown"}) ${text}`.trim());
    }
    const json = await readJson<Subscription>(response);
    return json;
  },

  async refreshPayment(mpPaymentId: string) {
    const qs = new URLSearchParams({ mp_payment_id: mpPaymentId });
    const options = { method: "POST" };
    const tryUrls = [
      apiUrl(`/subscriptions/payments/refresh?${qs.toString()}`),
      apiUrl(`/subscriptions/payments/refresh/?${qs.toString()}`),
    ];
    let response: Response | null = null;
    for (const url of tryUrls) {
      response = await fetchWithAuth(url, options);
      if (response.ok) break;
      if (response.status !== 404 && response.status !== 405) break;
    }
    if (!response || !response.ok) {
      const text = await response?.text().catch(() => "") ?? "";
      throw new Error(`Failed to refresh subscription payment (${response?.status ?? "unknown"}) ${text}`.trim());
    }
    return readJson<unknown>(response);
  },

  async purchase(planId: number, paymentMethod?: "card" | "card_terminal", supplierId?: number): Promise<PurchaseResponse> {
    const body = JSON.stringify({
      plan_id: planId,
      ...(paymentMethod ? { payment_method: paymentMethod } : {}),
      ...(typeof supplierId === "number" ? { supplier_id: supplierId } : {}),
    });
    const options = { method: "POST", body };
    const tryUrls = [`/api/subscriptions/purchase`, `/api/subscriptions/purchase/`, apiUrl(`/subscriptions/purchase`), apiUrl(`/subscriptions/purchase/`)];
    let response: Response | null = null;
    for (const url of tryUrls) {
      response = await fetchWithAuth(url, options);
      if (response.ok) break;
      if (response.status !== 404 && response.status !== 405) break;
    }
    if (!response || !response.ok) {
      const text = await response?.text().catch(() => "") ?? "";
      throw new Error(`Failed to purchase subscription (${response?.status ?? "unknown"}) ${text}`.trim());
    }
    const json = await readJson<PurchaseResponse>(response);
    if (!json) throw new Error("Empty response from purchase endpoint");
    return json;
  },
};
