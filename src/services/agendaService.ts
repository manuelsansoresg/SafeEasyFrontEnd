import { fetchWithAuth } from "@/lib/api";
import type {
  AgendaException,
  AgendaExceptionPayload,
  AgendaCatalogService,
  AgendaSchedule,
  AgendaSchedulePayload,
  AgendaService,
  AgendaServiceCreatePayload,
  AgendaServiceUpdatePayload,
  AgendaSettings,
  AgendaSettingsPayload,
} from "@/types/agenda";

const base = "/api/agenda";

function extractError(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const messages = value.map(extractError).filter(Boolean);
    return messages.length ? messages.join("; ") : undefined;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return extractError(record.detail ?? record.message ?? record.msg ?? record.error);
  }
  return undefined;
}

async function request(
  url: string,
  options?: Parameters<typeof fetchWithAuth>[1],
): Promise<Response> {
  const response = await fetchWithAuth(url, { cache: "no-store", ...options });
  if (response.ok) return response;

  const body: unknown = await response.json().catch(() => null);
  const rawDetail = extractError(body);
  const translations: Record<string, string> = {
    "Este servicio ya está configurado en Agenda.":
      "Este servicio ya forma parte de tu Agenda.",
    "Service not found": "El servicio ya no está disponible.",
    "The catalog service is not available":
      "Activa primero el servicio para poder ofrecer reservaciones.",
    "Active Agenda access is required to manage store services":
      "Necesitas tener activo el módulo Agenda para administrar estos servicios.",
    "An active subscription is required to manage services":
      "Necesitas una suscripción activa para administrar servicios.",
    "Active subscription required":
      "Necesitas una suscripción activa para administrar servicios.",
  };
  const detail = rawDetail ? translations[rawDetail] ?? rawDetail : undefined;
  if (response.status === 401) throw new Error("Tu sesión expiró. Inicia sesión nuevamente.");
  if (response.status === 403) throw new Error(detail || "No tienes acceso al módulo Agenda.");
  if (response.status === 404) throw new Error(detail || "El recurso solicitado no existe.");
  if (response.status === 409) throw new Error(detail || "Existe un conflicto con los datos guardados.");
  if (response.status === 422) throw new Error(detail || "Revisa los datos capturados.");
  throw new Error(detail || `No se pudo completar la solicitud (${response.status}).`);
}

export const agendaService = {
  async getSettings(signal?: AbortSignal): Promise<AgendaSettings> {
    const response = await request(`${base}/settings`, { signal });
    return response.json();
  },

  async updateSettings(payload: AgendaSettingsPayload): Promise<AgendaSettings> {
    const response = await request(`${base}/settings`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  async listSchedules(signal?: AbortSignal): Promise<AgendaSchedule[]> {
    const response = await request(`${base}/schedules`, { signal });
    return response.json();
  },

  async replaceSchedules(schedules: AgendaSchedulePayload[]): Promise<AgendaSchedule[]> {
    const response = await request(`${base}/schedules`, {
      method: "PUT",
      body: JSON.stringify({ schedules }),
    });
    return response.json();
  },

  async listServices(signal?: AbortSignal): Promise<AgendaService[]> {
    const response = await request(`${base}/services`, { signal });
    return response.json();
  },

  async listServiceCatalog(signal?: AbortSignal): Promise<AgendaCatalogService[]> {
    const response = await request(`${base}/services/catalog`, { signal });
    return response.json();
  },

  async createService(payload: AgendaServiceCreatePayload): Promise<AgendaService> {
    const response = await request(`${base}/services`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  async updateService(id: number, payload: AgendaServiceUpdatePayload): Promise<AgendaService> {
    const response = await request(`${base}/services/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  async listExceptions(signal?: AbortSignal): Promise<AgendaException[]> {
    const response = await request(`${base}/exceptions`, { signal });
    return response.json();
  },

  async createException(payload: AgendaExceptionPayload): Promise<AgendaException> {
    const response = await request(`${base}/exceptions`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  async updateException(id: number, payload: AgendaExceptionPayload): Promise<AgendaException> {
    const response = await request(`${base}/exceptions/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  async removeException(id: number): Promise<void> {
    await request(`${base}/exceptions/${id}`, { method: "DELETE" });
  },
};
