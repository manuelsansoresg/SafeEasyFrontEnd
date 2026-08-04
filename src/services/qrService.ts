import { fetchWithAuth } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return `${base.replace(/\/$/, "")}${path}`;
};

export type QRInfo = {
  id?: number;
  supplier_id?: number;
  token: string;
  qr_url?: string;
  image_url?: string;
  slug?: string;
  created_at?: string;
  updated_at?: string;
};

async function handleResponse<T>(response: Response, context: string): Promise<T> {
  if (!response.ok) {
    let message = context;
    try {
      const body = await response.text();
      if (body) {
        try {
          const json = JSON.parse(body);
          message = json.detail || json.message || json.error || body;
        } catch {
          message = body;
        }
      }
    } catch {
      // ignore
    }
    throw new Error(`${context}: ${message}`);
  }
  return response.json();
}

function normalizeQRInfo(data: Record<string, unknown>): QRInfo {
  const token = (data.token || data.qr_token || data.qr_url || "") as string;
  return {
    id: data.id as number | undefined,
    supplier_id: data.supplier_id as number | undefined,
    token: String(token),
    qr_url: data.qr_url as string | undefined,
    image_url: data.image_url as string | undefined,
    slug: data.slug as string | undefined,
    created_at: data.created_at as string | undefined,
    updated_at: data.updated_at as string | undefined,
  };
}

function getAuthToken(): string | null {
  try {
    return useAuthStore.getState().token;
  } catch {
    return null;
  }
}

export const qrService = {
  async getQRImageBlob(): Promise<string> {
    const token = getAuthToken();
    const url = token ? `/api/qr/image?t=${encodeURIComponent(token)}` : "/api/qr/image";
    const response = await fetch(url);
    if (!response.ok) {
      let message = "No se pudo obtener el código QR";
      try {
        const body = await response.text();
        if (body) {
          try {
            const json = JSON.parse(body);
            message = json.detail || json.message || json.error || body;
          } catch {
            message = body;
          }
        }
      } catch {
        // ignore
      }
      throw new Error(`${message} (HTTP ${response.status})`);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },

  async generateQRToken(): Promise<QRInfo> {
    const data = await handleResponse<Record<string, unknown>>(
      await fetchWithAuth(apiUrl("/qr/me/token"), { method: "POST" }),
      "No se pudo generar el token del código QR"
    );
    return normalizeQRInfo(data);
  },

  async regenerateQR(): Promise<QRInfo> {
    const data = await handleResponse<Record<string, unknown>>(
      await fetchWithAuth(apiUrl("/qr/me/regenerate"), { method: "POST" }),
      "No se pudo regenerar el código QR"
    );
    return normalizeQRInfo(data);
  },

  getQRUrl(token: string): string {
    return `${window.location.origin}/qr/${token}`;
  },
};
