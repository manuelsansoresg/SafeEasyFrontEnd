import { fetchWithAuth } from "@/lib/api";
import type {
  AgendaException,
  AgendaExceptionPayload,
  AgendaSchedule,
  AgendaSchedulePayload,
  AgendaService,
  AgendaServicePayload,
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
  const detail = extractError(body);
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

  async createService(payload: AgendaServicePayload): Promise<AgendaService> {
    const response = await request(`${base}/services`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.json();
  },

  async updateService(id: number, payload: Partial<AgendaServicePayload>): Promise<AgendaService> {
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
