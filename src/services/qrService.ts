import { fetchWithAuth } from '@/lib/api';

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://drooopy.com/api';
  return `${base.replace(/\/$/, '')}${path}`;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function findField(data: unknown, keys: string[], depth = 0): unknown {
  if (depth > 4 || !isRecord(data)) return undefined;

  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null) return data[key];
  }

  for (const value of Object.values(data)) {
    if (isRecord(value)) {
      const nested = findField(value, keys, depth + 1);
      if (nested !== undefined) return nested;
    }
  }

  return undefined;
}

function stringField(data: unknown, keys: string[]): string | undefined {
  const value = findField(data, keys);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberField(data: unknown, keys: string[]): number | undefined {
  const value = findField(data, keys);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function tokenFromQRUrl(qrUrl?: string): string | undefined {
  if (!qrUrl) return undefined;
  const match = qrUrl.match(/\/qr\/([^/?#]+)/i);
  if (!match?.[1] || match[1] === 'me') return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function downloadFilename(contentDisposition: string | null): string {
  if (!contentDisposition) return 'mi-qr.png';

  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  const rawFilename = encodedMatch?.[1] || plainMatch?.[1];

  if (!rawFilename) return 'mi-qr.png';

  try {
    return decodeURIComponent(rawFilename).replace(/[\\/]/g, '-') || 'mi-qr.png';
  } catch {
    return rawFilename.replace(/[\\/]/g, '-') || 'mi-qr.png';
  }
}

function normalizeQRInfo(data: unknown): QRInfo {
  const qrUrl = stringField(data, ['qr_url', 'qrUrl', 'redirect_url', 'redirectUrl']);
  const imageUrl = stringField(data, ['qr_image_url', 'image_url', 'imageUrl']);
  const token =
    stringField(data, ['token', 'qr_token', 'qrToken', 'supplier_qr_token']) ||
    tokenFromQRUrl(qrUrl) ||
    tokenFromQRUrl(imageUrl) ||
    '';

  return {
    id: numberField(data, ['qr_id', 'id']),
    supplier_id: numberField(data, ['supplier_id', 'supplierId']),
    token,
    qr_url: qrUrl,
    image_url: imageUrl,
    slug: stringField(data, ['slug', 'supplier_slug', 'supplierSlug']),
    created_at: stringField(data, ['created_at', 'createdAt']),
    updated_at: stringField(data, ['updated_at', 'updatedAt']),
  };
}

async function requestMyQRImage(): Promise<{
  imageUrl: string;
  info: QRInfo | null;
}> {
  const response = await fetchWithAuth(apiUrl('/qr/me/image'), {
    cache: 'no-store',
  });

  if (!response.ok) {
    let message = 'No se pudo obtener el código QR';
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

  const json: unknown = await response.json();
  const imageUrl = stringField(json, [
    'qr_image_url',
    'image_url',
    'imageUrl',
    'qr_url',
  ]);

  if (!imageUrl) {
    throw new Error('No se recibió la URL de la imagen (HTTP 404)');
  }

  const info = normalizeQRInfo(json);
  return { imageUrl, info: info.token ? info : null };
}

export const qrService = {
  async getQRImage(): Promise<{ imageUrl: string; info: QRInfo | null }> {
    return requestMyQRImage();
  },

  async downloadQRImage(): Promise<{ blob: Blob; filename: string }> {
    const response = await fetchWithAuth(apiUrl('/qr/me/image/download'), {
      cache: 'no-store',
    });

    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(message || `No se pudo descargar el código QR (HTTP ${response.status})`);
    }

    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) {
      throw new Error('El servidor no devolvió una imagen válida.');
    }

    return {
      blob,
      filename: downloadFilename(response.headers.get('content-disposition')),
    };
  },

  async generateQRToken(): Promise<QRInfo> {
    const data = await handleResponse<Record<string, unknown>>(
      await fetchWithAuth(apiUrl('/qr/me/token'), { method: 'POST' }),
      'No se pudo generar el token del código QR'
    );
    return normalizeQRInfo(data);
  },

  async regenerateQR(): Promise<QRInfo> {
    const data = await handleResponse<Record<string, unknown>>(
      await fetchWithAuth(apiUrl('/qr/me/regenerate'), { method: 'POST' }),
      'No se pudo regenerar el código QR'
    );
    return normalizeQRInfo(data);
  },

  getQRUrl(token: string): string {
    return apiUrl(`/qr/${encodeURIComponent(token)}`);
  },
};
