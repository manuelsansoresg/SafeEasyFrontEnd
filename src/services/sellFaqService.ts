import { fetchWithAuth } from "@/lib/api";

export interface SellFaq {
  id: number;
  question: string;
  answer: string;
  position: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export type SellFaqPayload = {
  question: string;
  answer: string;
  position: number;
  is_active: boolean;
};

const readJson = async <T>(response: Response): Promise<T | null> => {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const pickList = (data: unknown): SellFaq[] => {
  if (Array.isArray(data)) return data as SellFaq[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const items = record.items ?? record.results ?? record.data ?? record.faqs;
    if (Array.isArray(items)) return items as SellFaq[];
  }
  return [];
};

const requestWithFallback = async (urls: string[], init?: Parameters<typeof fetchWithAuth>[1]) => {
  let response: Response | null = null;
  for (const url of urls) {
    response = await fetchWithAuth(url, init);
    if (response.ok) break;
    if (response.status !== 404 && response.status !== 405) break;
  }
  return response;
};

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return `${base.replace(/\/$/, "")}${path}`;
};

const requestPublicWithFallback = async (urls: string[]) => {
  let response: Response | null = null;
  for (const url of urls) {
    response = await fetch(url, { headers: { Accept: "application/json" } });
    if (response.ok) break;
    if (response.status !== 404 && response.status !== 405) break;
  }
  return response;
};

export const sellFaqService = {
  async listActive(): Promise<SellFaq[]> {
    const response = await requestPublicWithFallback([
      "/api/sell-faq",
      "/api/sell-faq/",
      apiUrl("/api/sell-faq"),
      apiUrl("/api/sell-faq/"),
    ]);
    if (!response?.ok) return [];
    const json = await readJson<unknown>(response);
    return pickList(json)
      .filter((faq) => faq.is_active)
      .sort((a, b) => a.position - b.position || a.id - b.id);
  },

  async list(): Promise<SellFaq[]> {
    const response = await requestWithFallback([
      "/api/admin/sell-faq",
      "/api/admin/sell-faq/",
      apiUrl("/api/admin/sell-faq"),
      apiUrl("/api/admin/sell-faq/"),
    ]);
    if (!response?.ok) return [];
    const json = await readJson<unknown>(response);
    return pickList(json).sort((a, b) => a.position - b.position || a.id - b.id);
  },

  async create(payload: SellFaqPayload): Promise<SellFaq | null> {
    const response = await requestWithFallback(
      ["/api/admin/sell-faq", "/api/admin/sell-faq/", apiUrl("/api/admin/sell-faq"), apiUrl("/api/admin/sell-faq/")],
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
    if (!response?.ok) return null;
    return readJson<SellFaq>(response);
  },

  async update(id: number, payload: SellFaqPayload): Promise<SellFaq | null> {
    const response = await requestWithFallback(
      [`/api/admin/sell-faq/${id}`, `/api/admin/sell-faq/${id}/`, apiUrl(`/api/admin/sell-faq/${id}`), apiUrl(`/api/admin/sell-faq/${id}/`)],
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );
    if (!response?.ok) return null;
    return readJson<SellFaq>(response);
  },

  async delete(id: number): Promise<boolean> {
    const response = await requestWithFallback(
      [`/api/admin/sell-faq/${id}`, `/api/admin/sell-faq/${id}/`, apiUrl(`/api/admin/sell-faq/${id}`), apiUrl(`/api/admin/sell-faq/${id}/`)],
      { method: "DELETE" },
    );
    return Boolean(response?.ok);
  },
};
