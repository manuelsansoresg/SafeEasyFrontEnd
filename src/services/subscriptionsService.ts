import { fetchWithAuth } from "@/lib/api";
import type {
  ManualSubscriptionPayload,
  Plan,
  PurchaseResponse,
  SupplierSubscriptionOption,
  Subscription,
  SubscriptionHistoryEntry,
  UpdateManualSubscriptionPayload,
} from "@/types/subscriptions";

type ListSubscriptionsParams = {
  skip?: number;
  limit?: number;
  status?: "active" | "expired" | "cancelled";
  search?: string;
};

export class SubscriptionRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SubscriptionRequestError";
    this.status = status;
  }
}

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
    const items =
      record.items ??
      record.results ??
      record.data ??
      record.subscriptions ??
      record.plans ??
      record.suppliers ??
      record.history;
    if (Array.isArray(items)) return items as T[];
  }
  return [];
};

const readErrorMessage = async (response: Response, fallback: string) => {
  const text = await response.text().catch(() => "");
  if (!text) return fallback;
  try {
    const data = JSON.parse(text) as { detail?: unknown; message?: unknown; error?: unknown };
    const detail = data.detail ?? data.message ?? data.error;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => {
          if (!item || typeof item !== "object") return "";
          const message = (item as Record<string, unknown>).msg;
          return typeof message === "string" ? message : "";
        })
        .filter(Boolean);
      if (messages.length > 0) return messages.join(". ");
    }
  } catch {
    return text;
  }
  return fallback;
};

const requireOk = async (response: Response, fallback: string) => {
  if (response.ok) return;
  throw new SubscriptionRequestError(await readErrorMessage(response, fallback), response.status);
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
};

const optionalString = (...values: unknown[]) => {
  const value = values.find((candidate) => typeof candidate === "string");
  return typeof value === "string" ? value : null;
};

const optionalNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (value == null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const normalizeHistoryEntry = (
  value: SubscriptionHistoryEntry,
  index: number,
): SubscriptionHistoryEntry => {
  const record = asRecord(value);
  const previous = asRecord(
    record.previous_values ?? record.old_values ?? record.before ?? record.previous,
  );
  const next = asRecord(
    record.new_values ?? record.next_values ?? record.after ?? record.current,
  );
  const admin = asRecord(
    record.admin ?? record.admin_user ?? record.changed_by ?? record.performed_by,
  );

  return {
    id: optionalNumber(record.id, record.history_id) ?? -(index + 1),
    subscription_id: optionalNumber(record.subscription_id, record.subscriptionId) ?? 0,
    supplier_id: optionalNumber(record.supplier_id, record.supplierId),
    admin_user_id: optionalNumber(
      record.admin_user_id,
      record.admin_id,
      record.changed_by_user_id,
      admin.id,
    ),
    admin_name: optionalString(
      record.admin_name,
      record.changed_by_name,
      admin.full_name,
      admin.name,
      admin.email,
    ),
    action: optionalString(record.action, record.event_type, record.action_type, record.type),
    previous_status: optionalString(
      record.previous_status,
      record.old_status,
      previous.status,
    ),
    new_status: optionalString(record.new_status, record.status, next.status),
    previous_plan_id: optionalNumber(
      record.previous_plan_id,
      record.old_plan_id,
      previous.plan_id,
    ),
    new_plan_id: optionalNumber(record.new_plan_id, record.plan_id, next.plan_id),
    previous_start_date: optionalString(
      record.previous_start_date,
      record.old_start_date,
      previous.start_date,
    ),
    new_start_date: optionalString(
      record.new_start_date,
      record.start_date,
      next.start_date,
    ),
    previous_end_date: optionalString(
      record.previous_end_date,
      record.old_end_date,
      previous.end_date,
    ),
    new_end_date: optionalString(record.new_end_date, record.end_date, next.end_date),
    assignment_type:
      (optionalString(record.assignment_type, record.reason_type) as
        | SubscriptionHistoryEntry["assignment_type"]
        | null) ?? null,
    note: optionalString(record.note, record.reason, record.comment) ?? "",
    created_at:
      optionalString(record.created_at, record.timestamp, record.changed_at) ?? "",
  };
};

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return `${base.replace(/\/$/, "")}${path}`;
};

export const subscriptionsService = {
  async listSubscriptions(params: ListSubscriptionsParams): Promise<Subscription[]> {
    const qs = new URLSearchParams();
    if (typeof params.skip === "number") qs.set("skip", String(params.skip));
    if (typeof params.limit === "number") qs.set("limit", String(Math.min(params.limit, 500)));
    if (params.status) qs.set("status", params.status);
    if (params.search && params.search.trim()) qs.set("search", params.search.trim());

    const query = qs.toString();
    const suffix = query ? `?${query}` : "";
    const tryUrls = [
      `/api/subscriptions/${suffix}`,
      `/api/subscriptions${suffix}`,
      `/api/admin/subscriptions/${suffix}`,
      `/api/admin/subscriptions${suffix}`,
      apiUrl(`/subscriptions/${suffix}`),
      apiUrl(`/subscriptions${suffix}`),
      apiUrl(`/admin/subscriptions/${suffix}`),
      apiUrl(`/admin/subscriptions${suffix}`),
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
    const tryUrls = [
      `/api/plans/?skip=0&limit=1000`,
      `/api/plans?skip=0&limit=1000`,
      apiUrl(`/plans/?skip=0&limit=1000`),
      apiUrl(`/plans?skip=0&limit=1000`),
    ];
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

  async listSupplierOptions(): Promise<SupplierSubscriptionOption[]> {
    const response = await fetchWithAuth("/api/suppliers/?skip=0&limit=1000");
    await requireOk(response, "No se pudieron cargar los proveedores.");
    const json = await readJson<unknown>(response);
    return pickArray<SupplierSubscriptionOption>(json);
  },

  async assignManual(payload: ManualSubscriptionPayload) {
    const response = await fetchWithAuth("/api/subscriptions/admin/manual", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await requireOk(response, "No se pudo asignar la subscripción.");
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return readJson<unknown>(response);
    return null;
  },

  async updateManual(subscriptionId: number, payload: UpdateManualSubscriptionPayload) {
    const options = {
      method: "PATCH",
      body: JSON.stringify(payload),
    };
    const tryUrls = [
      `/api/subscriptions/admin/${subscriptionId}`,
      `/api/subscriptions/admin/${subscriptionId}/`,
      apiUrl(`/subscriptions/admin/${subscriptionId}`),
      apiUrl(`/subscriptions/admin/${subscriptionId}/`),
    ];
    let response: Response | null = null;
    for (const url of tryUrls) {
      response = await fetchWithAuth(url, options);
      if (response.ok) break;
      if (response.status !== 404 && response.status !== 405) break;
    }

    if (response?.status === 404 || response?.status === 405) {
      throw new SubscriptionRequestError(
        "La modificación administrativa de suscripciones aún no está disponible en el backend publicado.",
        response.status,
      );
    }
    if (!response) {
      throw new SubscriptionRequestError(
        "No se pudo conectar con el servicio de suscripciones.",
        0,
      );
    }
    await requireOk(response, "No se pudo modificar la subscripción.");
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return readJson<unknown>(response);
    return null;
  },

  async getHistory(subscriptionId: number, skip = 0, limit = 50): Promise<SubscriptionHistoryEntry[]> {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    const response = await fetchWithAuth(
      `/api/subscriptions/admin/${subscriptionId}/history?${params.toString()}`,
    );
    await requireOk(response, "No se pudo cargar el historial.");
    const json = await readJson<unknown>(response);
    return pickArray<SubscriptionHistoryEntry>(json).map(normalizeHistoryEntry);
  },

  async getMySubscription(): Promise<Subscription | null> {
    const tryUrls = [
      `/api/subscriptions/my`,
      `/api/subscriptions/my/`,
      apiUrl(`/subscriptions/my`),
      apiUrl(`/subscriptions/my/`),
    ];
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
