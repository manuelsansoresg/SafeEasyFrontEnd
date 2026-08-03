import { fetchWithAuth } from "@/lib/api";

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return `${base.replace(/\/$/, "")}${path}`;
};

export type QRInfo = {
  id: number;
  supplier_id: number;
  qr_url: string;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
};

export const qrService = {
  async getQRImage(supplierId: number): Promise<string> {
    const url = apiUrl(`/qr/${supplierId}/image`);
    const response = await fetchWithAuth(url);
    if (!response.ok) {
      throw new Error("No se pudo obtener el código QR");
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },

  async regenerateQR(supplierId: number): Promise<QRInfo> {
    const response = await fetchWithAuth(apiUrl(`/qr/${supplierId}/regenerate`), {
      method: "POST",
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(text || "No se pudo regenerar el código QR");
    }
    return response.json();
  },

  getQRUrl(supplierId: number): string {
    return `${window.location.origin}/qr/${supplierId}`;
  },
};
