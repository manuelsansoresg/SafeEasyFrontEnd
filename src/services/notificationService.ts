import { fetchWithAuth } from "@/lib/api";

export type NotificationItem = {
  id: number | string;
  title?: string;
  message?: string;
  created_at?: string;
  is_read?: boolean;
  read?: boolean;
  order_id?: number | string | null;
};

const extractNotifications = (data: unknown): NotificationItem[] => {
  if (Array.isArray(data)) return data as NotificationItem[];
  if (!data || typeof data !== "object") return [];

  const record = data as Record<string, unknown>;
  const candidates = [record.results, record.data, record.notifications, record.items];
  const list = candidates.find(Array.isArray);
  return (list || []) as NotificationItem[];
};

const readErrorBody = async (res: Response) => {
  try {
    const data = await res.json();
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      return String(record.detail || record.message || record.error || "").trim();
    }
  } catch {
    try {
      return (await res.text()).trim();
    } catch {}
  }
  return "";
};

type NotificationRequestOptions = RequestInit & {
  headers?: Record<string, string>;
};

const requestJson = async (url: string, options?: NotificationRequestOptions) => {
  const res = await fetchWithAuth(url, options);
  if (!res.ok) {
    const detail = await readErrorBody(res);
    throw new Error(detail || `No se pudieron cargar las notificaciones (${res.status}).`);
  }
  if (res.status === 204) return null;
  const raw = await res.text();
  return raw ? JSON.parse(raw) : null;
};

export const notificationService = {
  async getNotifications(params: { unreadOnly?: boolean; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.unreadOnly) query.set("unread_only", "true");
    if (params.limit) query.set("limit", String(params.limit));

    const qs = query.toString();
    const data = await requestJson(`/api/notifications${qs ? `?${qs}` : ""}`);
    return extractNotifications(data);
  },

  async markRead(id: number | string) {
    await requestJson(`/api/notifications/${encodeURIComponent(String(id))}/read`, { method: "PATCH" });
  },
};
