import { fetchWithAuth } from "@/lib/api";
import type {
  CreateServiceInput,
  SupplierService,
  UpdateServiceInput,
} from "@/types/services";

export class ServiceRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ServiceRequestError";
    this.status = status;
  }
}

function unwrapServices(data: unknown): SupplierService[] {
  if (Array.isArray(data)) return data as SupplierService[];
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const candidate =
    record.items ?? record.results ?? record.data ?? record.services;
  return Array.isArray(candidate) ? (candidate as SupplierService[]) : [];
}

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
      if (
        detail ===
        "An active directory subscription is required to manage services"
      ) {
        return "Se requiere una suscripción de directorio activa para administrar servicios.";
      }
      if (detail === "A service must keep at least one image") {
        return "El servicio debe conservar al menos una imagen.";
      }
      if (detail === "Service not found") return "Servicio no encontrado.";
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
  throw new ServiceRequestError(
    await readError(response, fallback),
    response.status,
  );
}

async function readService(
  response: Response,
  fallback: string,
): Promise<SupplierService> {
  await requireOk(response, fallback);
  return response.json() as Promise<SupplierService>;
}

function appendImages(formData: FormData, images: File[]) {
  images.forEach((image) => formData.append("images", image));
}

export const servicesService = {
  async listPublic(params: {
    supplierId?: number;
    skip?: number;
    limit?: number;
  } = {}): Promise<SupplierService[]> {
    const query = new URLSearchParams();
    if (params.supplierId) query.set("supplier_id", String(params.supplierId));
    query.set("skip", String(params.skip ?? 0));
    query.set("limit", String(Math.min(params.limit ?? 20, 100)));

    const response = await fetch(`/api/services/?${query.toString()}`, {
      cache: "no-store",
    });
    await requireOk(response, "No se pudieron cargar los servicios.");
    return unwrapServices(await response.json());
  },

  async getPublic(serviceId: string): Promise<SupplierService> {
    const response = await fetch(
      `/api/services/${encodeURIComponent(serviceId)}`,
      { cache: "no-store" },
    );
    return readService(response, "No se pudo cargar el servicio.");
  },

  async listMine(params: {
    skip?: number;
    limit?: number;
  } = {}): Promise<SupplierService[]> {
    const query = new URLSearchParams({
      skip: String(params.skip ?? 0),
      limit: String(Math.min(params.limit ?? 100, 100)),
    });
    const response = await fetchWithAuth(
      `/api/services/me?${query.toString()}`,
      { cache: "no-store" },
    );
    await requireOk(response, "No se pudieron cargar tus servicios.");
    return unwrapServices(await response.json());
  },

  async create(input: CreateServiceInput): Promise<SupplierService> {
    const formData = new FormData();
    formData.append("supplier_id", String(input.supplierId));
    formData.append("title", input.title);
    formData.append("description", input.description);
    formData.append("price", String(input.price));
    formData.append("is_active", String(input.isActive));
    formData.append("cover_index", String(input.coverIndex));
    appendImages(formData, input.images);

    const response = await fetchWithAuth("/api/services/", {
      method: "POST",
      body: formData,
    });
    return readService(response, "No se pudo crear el servicio.");
  },

  async update(
    serviceId: string,
    input: UpdateServiceInput,
  ): Promise<SupplierService> {
    const response = await fetchWithAuth(
      `/api/services/${encodeURIComponent(serviceId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
    return readService(response, "No se pudo actualizar el servicio.");
  },

  async addImages(
    serviceId: string,
    images: File[],
    coverIndex?: number,
  ): Promise<SupplierService> {
    const formData = new FormData();
    appendImages(formData, images);
    if (typeof coverIndex === "number") {
      formData.append("cover_index", String(coverIndex));
    }

    const response = await fetchWithAuth(
      `/api/services/${encodeURIComponent(serviceId)}/images`,
      { method: "POST", body: formData },
    );
    return readService(response, "No se pudieron agregar las imágenes.");
  },

  async setCover(
    serviceId: string,
    imageId: number,
  ): Promise<SupplierService> {
    const response = await fetchWithAuth(
      `/api/services/${encodeURIComponent(serviceId)}/images/${imageId}/cover`,
      { method: "PATCH" },
    );
    return readService(response, "No se pudo cambiar la portada.");
  },

  async deleteImage(
    serviceId: string,
    imageId: number,
  ): Promise<SupplierService> {
    const response = await fetchWithAuth(
      `/api/services/${encodeURIComponent(serviceId)}/images/${imageId}`,
      { method: "DELETE" },
    );
    return readService(response, "No se pudo eliminar la imagen.");
  },

  async delete(serviceId: string): Promise<void> {
    const response = await fetchWithAuth(
      `/api/services/${encodeURIComponent(serviceId)}`,
      { method: "DELETE" },
    );
    await requireOk(response, "No se pudo eliminar el servicio.");
  },
};
