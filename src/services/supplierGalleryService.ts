import { fetchWithAuth } from "@/lib/api";
import type {
  SupplierGalleryImage,
  SupplierGalleryUploadResult,
} from "@/types/supplierGallery";

export class SupplierGalleryRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "SupplierGalleryRequestError";
    this.status = status;
  }
}

function unwrapList(data: unknown): SupplierGalleryImage[] {
  if (Array.isArray(data)) return data as SupplierGalleryImage[];
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const candidates = [
    record.items,
    record.results,
    record.data,
    record.images,
    record.gallery,
    record.uploaded,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as SupplierGalleryImage[];
  }
  return [];
}

const asNumber = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

async function readError(response: Response, fallback: string) {
  const text = await response.text().catch(() => "");
  if (!text) return fallback;

  try {
    const payload = JSON.parse(text) as {
      detail?: unknown;
      message?: unknown;
      error?: unknown;
    };
    const detail = payload.detail ?? payload.message ?? payload.error;
    if (typeof detail === "string") {
      if (detail === "An active directory subscription is required to manage the gallery") {
        return "Se requiere una suscripción de directorio activa para administrar la galería.";
      }
      if (detail === "Gallery image not found") return "Imagen no encontrada.";
      if (detail.startsWith("Gallery limit reached")) {
        return "Has alcanzado el límite de imágenes de tu plan.";
      }
      if (detail === "At least one image file is required") {
        return "Selecciona al menos una imagen para subir.";
      }
      if (detail === "You can upload up to 10 images at once") {
        return "Solo puedes subir 10 imágenes a la vez.";
      }
      return detail;
    }
    if (Array.isArray(detail)) {
      const messages = detail.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const message = (item as Record<string, unknown>).msg;
        return typeof message === "string" ? [message] : [];
      });
      if (messages.length) return messages.join(". ");
    }
  } catch {
    return text;
  }

  return fallback;
}

async function requireOk(response: Response, fallback: string) {
  if (response.ok) return;
  throw new SupplierGalleryRequestError(
    await readError(response, fallback),
    response.status,
  );
}

export const supplierGalleryService = {
  /**
   * GET /suppliers/{supplier_id}/gallery — usado por la página pública.
   * Devuelve las imágenes ordenadas por position.
   *
   * Nota: en producción el endpoint público aún no está disponible (404).
   * Como fallback usamos `fetchWithAuth` para que funcione cuando el visitante
   * está autenticado (dueño de la empresa, admin). Si no hay sesión, el
   * backend debería exponer el endpoint público.
   */
  async list(supplierId: number): Promise<SupplierGalleryImage[]> {
    const response = await fetchWithAuth(
      `/api/suppliers/${encodeURIComponent(String(supplierId))}/gallery`,
      { cache: "no-store" },
    );
    await requireOk(response, "No se pudo cargar la galería.");
    return unwrapList(await response.json());
  },

  /**
   * GET /suppliers/{supplier_id}/gallery — autenticado (para que el dueño/admin vea su galería).
   * Reutiliza el mismo endpoint; usar el de auth garantiza que se vea aunque luego sea privado.
   */
  async listMine(supplierId: number): Promise<SupplierGalleryImage[]> {
    const response = await fetchWithAuth(
      `/api/suppliers/${encodeURIComponent(String(supplierId))}/gallery`,
      { cache: "no-store" },
    );
    await requireOk(response, "No se pudo cargar la galería.");
    return unwrapList(await response.json());
  },

  /**
   * POST /suppliers/{supplier_id}/gallery — dueño o admin
   * Sube entre 1 y 10 imágenes como multipart/form-data (campo: images).
   */
  async upload(
    supplierId: number,
    images: File[],
  ): Promise<SupplierGalleryUploadResult> {
    const formData = new FormData();
    images.forEach((image) => formData.append("images", image));

    const response = await fetchWithAuth(
      `/api/suppliers/${encodeURIComponent(String(supplierId))}/gallery`,
      { method: "POST", body: formData },
    );
    await requireOk(response, "No se pudieron subir las imágenes.");

    const data = await response.json().catch(() => null);
    const uploaded = unwrapList(data);
    const record =
      data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    const total = asNumber(record?.total) ?? uploaded.length;
    const limit = asNumber(record?.limit ?? record?.max_gallery_images);

    return { uploaded, total, limit };
  },

  /**
   * DELETE /suppliers/{supplier_id}/gallery/{image_id} — dueño o admin
   */
  async remove(supplierId: number, imageId: number): Promise<void> {
    const response = await fetchWithAuth(
      `/api/suppliers/${encodeURIComponent(String(supplierId))}/gallery/${encodeURIComponent(String(imageId))}`,
      { method: "DELETE" },
    );
    await requireOk(response, "No se pudo eliminar la imagen.");
  },
};
