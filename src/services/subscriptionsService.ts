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

export const subscriptionsService = {
  async listSubscriptions(params: ListSubscriptionsParams): Promise<Subscription[]> {
    const qs = new URLSearchParams();
    if (typeof params.skip === "number") qs.set("skip", String(params.skip));
    if (typeof params.limit === "number") qs.set("limit", String(params.limit));
    if (params.status) qs.set("status", params.status);
    if (params.search && params.search.trim()) qs.set("search", params.search.trim());

    const tryUrls = [`/api/subscriptions/?${qs.toString()}`, `/api/subscriptions?${qs.toString()}`];
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
    const tryUrls = [`/api/plans/?skip=0&limit=1000`, `/api/plans?skip=0&limit=1000`];
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
      `/api/subscriptions/${subscriptionId}/events`,
      `/api/subscriptions/${subscriptionId}/events/`,
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
      `/api/subscriptions/${subscriptionId}/status`,
      `/api/subscriptions/${subscriptionId}/status/`,
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
    const tryUrls = [`/api/subscriptions/my`, `/api/subscriptions/my/`];
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
      `/api/subscriptions/payments/refresh?${qs.toString()}`,
      `/api/subscriptions/payments/refresh/?${qs.toString()}`,
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

  async purchase(planId: number): Promise<PurchaseResponse> {
    const body = JSON.stringify({ plan_id: planId });
    const options = { method: "POST", body };
    const tryUrls = [`/api/subscriptions/purchase`, `/api/subscriptions/purchase/`];
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
