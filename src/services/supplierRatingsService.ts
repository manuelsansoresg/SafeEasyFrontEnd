import { fetchWithAuth } from "@/lib/api";
import type {
  SupplierDirectoryRating,
  SupplierDirectoryRatingsResponse,
} from "@/types/supplierRatings";

async function readError(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  const detail =
    body && typeof body === "object" && typeof body.detail === "string"
      ? body.detail
      : null;
  return detail || fallback;
}

export const supplierRatingsService = {
  async list(slug: string): Promise<SupplierDirectoryRatingsResponse> {
    const response = await fetchWithAuth(
      `/api/suppliers/${encodeURIComponent(slug)}/directory-ratings`,
    );
    if (!response.ok) {
      throw new Error(
        await readError(response, "No se pudieron cargar las opiniones."),
      );
    }
    return response.json();
  },

  async create(
    slug: string,
    input: { rating: number; comment: string },
  ): Promise<SupplierDirectoryRating> {
    const response = await fetchWithAuth(
      `/api/suppliers/${encodeURIComponent(slug)}/directory-ratings`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
    if (!response.ok) {
      if (response.status === 409) {
        throw new Error("Ya calificaste a este proveedor.");
      }
      if (response.status === 401) {
        throw new Error("Debes iniciar sesión para calificar.");
      }
      if (response.status === 403) {
        throw new Error(
          "Este proveedor no tiene una suscripción Directorio activa.",
        );
      }
      throw new Error(
        await readError(response, "No se pudo registrar tu calificación."),
      );
    }
    return response.json();
  },
};
