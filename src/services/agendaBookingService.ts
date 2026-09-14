import { fetchWithAuth } from "@/lib/api";
import type { AgendaService } from "@/types/agenda";
import type {
  AgendaAvailability,
  AgendaBooking,
  AgendaBookingCreated,
  AgendaBookingPayload,
  AgendaBookingStatus,
  AgendaCancelPayload,
  AgendaProviderBooking,
  AgendaProviderBookingPayload,
  AgendaRescheduleDecisionPayload,
  AgendaReschedulePayload,
  AgendaRescheduleRequest,
  AgendaStatusPayload,
} from "@/types/agendaBooking";

const gateway = "/api/agenda-gateway";

function extractError(value: unknown): string | undefined {
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    const messages = value
      .map(extractError)
      .filter((item): item is string => Boolean(item));

    return messages.length ? messages.join("; ") : undefined;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    return extractError(
      record.detail ??
        record.message ??
        record.msg ??
        record.error,
    );
  }

  return undefined;
}

function friendlyAgendaError(detail: string | undefined) {
  if (!detail) return undefined;

  const translations: Record<string, string> = {
    "Agenda not found":
      "Este negocio no tiene la Agenda disponible.",
    "Agenda service not found":
      "El servicio seleccionado ya no está disponible.",
    "Guest bookings are disabled":
      "Este negocio requiere que inicies sesión para reservar.",
    "Only customers can book":
      "Sólo una cuenta de cliente puede realizar esta reservación.",
    "customer_name is required":
      "Escribe el nombre de la persona que asistirá a la cita.",
    "customer_email is required":
      "El correo electrónico es obligatorio para esta reservación.",
    "The requested time is not available":
      "Ese horario acaba de dejar de estar disponible. Elige otro.",
    "Booking not found":
      "No encontramos esta cita.",
    "Booking access denied":
      "No tienes permiso para administrar esta cita.",
    "Customer cancellations are disabled":
      "Este negocio no permite que el cliente cancele la cita.",
    "Booking cannot be cancelled":
      "Esta cita ya no se puede cancelar.",
    "Cancellation deadline has passed":
      "Ya pasó el tiempo límite permitido para cancelar esta cita.",
    "Reschedule requests are disabled":
      "Este negocio no permite solicitar cambios de horario.",
    "Booking cannot be rescheduled":
      "Esta cita ya no se puede reprogramar.",
    "A reschedule request is already pending":
      "Ya existe una solicitud de cambio pendiente para esta cita.",
    "Reschedule request already decided":
      "Esta solicitud de cambio ya fue respondida.",
    "Invalid booking status transition":
      "Ese cambio de estado no está permitido.",
    "Invalid availability date range":
      "La fecha seleccionada está fuera del periodo permitido para reservar.",
    "start_at must include a timezone":
      "La fecha y hora seleccionadas no tienen una zona horaria válida.",
    "requested_start_at must include a timezone":
      "La nueva fecha y hora no tienen una zona horaria válida.",
  };

  return translations[detail] || detail;
}

async function request<T>(
  url: string,
  options?: Parameters<typeof fetchWithAuth>[1],
): Promise<T> {
  const response = await fetchWithAuth(url, {
    cache: "no-store",
    ...options,
  });

  if (response.ok) {
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  const body: unknown = await response
    .json()
    .catch(() => null);

  const detail = friendlyAgendaError(extractError(body));

  if (response.status === 429) {
    throw new Error(
      "Has realizado demasiados intentos. Espera un momento y vuelve a intentar.",
    );
  }

  if (response.status === 401) {
    throw new Error(
      "Tu sesión expiró. Inicia sesión nuevamente.",
    );
  }

  if (response.status === 403) {
    throw new Error(
      detail || "No tienes permiso para realizar esta acción.",
    );
  }

  if (response.status === 404) {
    throw new Error(
      detail || "El recurso solicitado no existe.",
    );
  }

  if (response.status === 409) {
    throw new Error(
      detail || "Existe un conflicto con esta cita.",
    );
  }

  if (response.status === 422) {
    throw new Error(
      detail || "Revisa los datos capturados.",
    );
  }

  throw new Error(
    detail ||
      `No se pudo completar la solicitud (${response.status}).`,
  );
}

function queryString(
  values: Record<
    string,
    string | number | null | undefined
  >,
) {
  const params = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  const result = params.toString();
  return result ? `?${result}` : "";
}

export const agendaBookingService = {
  async listPublicServices(
    supplierId: number,
    signal?: AbortSignal,
  ): Promise<AgendaService[]> {
    return request<AgendaService[]>(
      `${gateway}/public/${supplierId}/services`,
      { signal, retryOnAuthFailure: false },
    );
  },

  async availability(
    supplierId: number,
    serviceId: number,
    dateFrom: string,
    dateTo?: string,
    signal?: AbortSignal,
  ): Promise<AgendaAvailability> {
    const query = queryString({
      service_id: serviceId,
      date_from: dateFrom,
      date_to: dateTo,
    });

    return request<AgendaAvailability>(
      `${gateway}/public/${supplierId}/availability${query}`,
      { signal, retryOnAuthFailure: false },
    );
  },

  async createBooking(
    supplierId: number,
    payload: AgendaBookingPayload,
  ): Promise<AgendaBookingCreated> {
    return request<AgendaBookingCreated>(
      `${gateway}/public/${supplierId}/bookings`,
      {
        method: "POST",
        body: JSON.stringify(payload),
        retryOnAuthFailure: false,
      },
    );
  },

  async getGuestBooking(
    bookingId: number,
    managementToken: string,
    signal?: AbortSignal,
  ): Promise<AgendaBooking> {
    const query = queryString({
      management_token: managementToken,
    });

    return request<AgendaBooking>(
      `${gateway}/public/bookings/${bookingId}${query}`,
      { signal, retryOnAuthFailure: false },
    );
  },

  async myBookings(
    status?: AgendaBookingStatus,
    signal?: AbortSignal,
  ): Promise<AgendaBooking[]> {
    const query = queryString({
      status,
      limit: 200,
    });

    return request<AgendaBooking[]>(
      `${gateway}/bookings/mine${query}`,
      { signal },
    );
  },

  async cancelBooking(
    bookingId: number,
    payload: AgendaCancelPayload,
  ): Promise<AgendaBooking> {
    return request<AgendaBooking>(
      `${gateway}/bookings/${bookingId}/cancel`,
      {
        method: "POST",
        body: JSON.stringify(payload),
        retryOnAuthFailure: false,
      },
    );
  },

  async requestReschedule(
    bookingId: number,
    payload: AgendaReschedulePayload,
  ): Promise<AgendaRescheduleRequest> {
    return request<AgendaRescheduleRequest>(
      `${gateway}/bookings/${bookingId}/reschedule-requests`,
      {
        method: "POST",
        body: JSON.stringify(payload),
        retryOnAuthFailure: false,
      },
    );
  },

  async providerAppointments(
    status?: AgendaBookingStatus,
    signal?: AbortSignal,
  ): Promise<AgendaProviderBooking[]> {
    const query = queryString({
      status,
      limit: 200,
    });

    return request<AgendaProviderBooking[]>(
      `${gateway}/appointments${query}`,
      { signal },
    );
  },

  async createProviderAppointment(
    payload: AgendaProviderBookingPayload,
  ): Promise<AgendaBookingCreated> {
    return request<AgendaBookingCreated>(
      `${gateway}/appointments`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  async providerAppointment(
    bookingId: number,
    signal?: AbortSignal,
  ): Promise<AgendaProviderBooking> {
    return request<AgendaProviderBooking>(
      `${gateway}/appointments/${bookingId}`,
      { signal },
    );
  },

  async providerReschedule(
    bookingId: number,
    startAt: string,
  ): Promise<AgendaProviderBooking> {
    return request<AgendaProviderBooking>(
      `${gateway}/appointments/${bookingId}/reschedule`,
      {
        method: "POST",
        body: JSON.stringify({
          start_at: startAt,
        }),
      },
    );
  },

  async updateProviderStatus(
    bookingId: number,
    payload: AgendaStatusPayload,
  ): Promise<AgendaProviderBooking> {
    return request<AgendaProviderBooking>(
      `${gateway}/appointments/${bookingId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
  },

  async rescheduleRequests(
    bookingId: number,
    signal?: AbortSignal,
  ): Promise<AgendaRescheduleRequest[]> {
    return request<AgendaRescheduleRequest[]>(
      `${gateway}/appointments/${bookingId}/reschedule-requests`,
      { signal },
    );
  },

  async decideReschedule(
    bookingId: number,
    requestId: number,
    payload: AgendaRescheduleDecisionPayload,
  ): Promise<AgendaRescheduleRequest> {
    return request<AgendaRescheduleRequest>(
      `${gateway}/appointments/${bookingId}/reschedule-requests/${requestId}/decision`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },
};
