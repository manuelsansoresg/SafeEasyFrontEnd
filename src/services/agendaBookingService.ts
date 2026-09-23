import { fetchWithAuth } from "@/lib/api";
import type { AgendaService } from "@/types/agenda";
import type {
  AgendaAvailability,
  AgendaBooking,
  AgendaBookingCreated,
  AgendaBookingPayment,
  AgendaBookingPayload,
  AgendaBookingStatus,
  AgendaCancelPayload,
  AgendaProviderBooking,
  AgendaProviderBookingCreated,
  AgendaProviderBookingPayload,
  AgendaRescheduleDecisionPayload,
  AgendaReschedulePayload,
  AgendaRescheduleRequest,
  AgendaStatusPayload,
} from "@/types/agendaBooking";

// `/api/*` apunta al backend FastAPI en producción, por lo que una ruta de
// Next bajo `/api/agenda-gateway` no llega a ejecutarse allí. El proxy público
// del frontend sí está disponible y conserva las rutas reales de Agenda.
const agendaGateway = "/proxy/agenda";
const publicAgendaGateway = "/proxy/public/agenda";

class AgendaBookingRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AgendaBookingRequestError";
    this.status = status;
  }
}

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
    "Booking payment not found":
      "No hay un registro de pago para esta cita.",
    "If Agenda payments are enabled, at least one payment method must be allowed":
      "Selecciona al menos una forma de pago.",
    "Sólo los pagos en efectivo pueden marcarse manualmente como pagados.":
      "Sólo los pagos directos pueden marcarse manualmente como pagados.",
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
    throw new AgendaBookingRequestError(
      "Has realizado demasiados intentos. Espera un momento y vuelve a intentar.",
      response.status,
    );
  }

  if (response.status === 401) {
    throw new AgendaBookingRequestError(
      "Tu sesión expiró. Inicia sesión nuevamente.",
      response.status,
    );
  }

  if (response.status === 403) {
    throw new AgendaBookingRequestError(
      detail || "No tienes permiso para realizar esta acción.",
      response.status,
    );
  }

  if (response.status === 404) {
    throw new AgendaBookingRequestError(
      detail || "El recurso solicitado no existe.",
      response.status,
    );
  }

  if (response.status === 409) {
    throw new AgendaBookingRequestError(
      detail || "Existe un conflicto con esta cita.",
      response.status,
    );
  }

  if (response.status === 422) {
    throw new AgendaBookingRequestError(
      detail || "Revisa los datos capturados.",
      response.status,
    );
  }

  throw new AgendaBookingRequestError(
    detail ||
      `No se pudo completar la solicitud (${response.status}).`,
    response.status,
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
      `${publicAgendaGateway}/${supplierId}/services`,
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
      `${publicAgendaGateway}/${supplierId}/availability${query}`,
      { signal, retryOnAuthFailure: false },
    );
  },

  async createBooking(
    supplierId: number,
    payload: AgendaBookingPayload,
  ): Promise<AgendaBookingCreated> {
    return request<AgendaBookingCreated>(
      `${publicAgendaGateway}/${supplierId}/bookings`,
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
      `${publicAgendaGateway}/bookings/${bookingId}${query}`,
      { signal, retryOnAuthFailure: false },
    );
  },

  async getBookingPayment(
    bookingId: number,
    managementToken?: string | null,
    signal?: AbortSignal,
  ): Promise<AgendaBookingPayment | null> {
    const query = queryString({
      management_token: managementToken,
    });
    try {
      return await request<AgendaBookingPayment>(
        `${publicAgendaGateway}/bookings/${bookingId}/payment${query}`,
        { signal, retryOnAuthFailure: false },
      );
    } catch (error) {
      if (error instanceof AgendaBookingRequestError && error.status === 404) {
        return null;
      }
      throw error;
    }
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
      `${agendaGateway}/bookings/mine${query}`,
      { signal },
    );
  },

  async cancelBooking(
    bookingId: number,
    payload: AgendaCancelPayload,
  ): Promise<AgendaBooking> {
    return request<AgendaBooking>(
      `${agendaGateway}/bookings/${bookingId}/cancel`,
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
      `${agendaGateway}/bookings/${bookingId}/reschedule-requests`,
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
      `${agendaGateway}/appointments${query}`,
      { signal },
    );
  },

  async createProviderAppointment(
    payload: AgendaProviderBookingPayload,
  ): Promise<AgendaProviderBookingCreated> {
    return request<AgendaProviderBookingCreated>(
      `${agendaGateway}/appointments`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  async providerBookingPayment(
    bookingId: number,
    signal?: AbortSignal,
  ): Promise<AgendaBookingPayment | null> {
    try {
      return await request<AgendaBookingPayment>(
        `${agendaGateway}/appointments/${bookingId}/payment`,
        { signal },
      );
    } catch (error) {
      if (error instanceof AgendaBookingRequestError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async markBookingPaymentPaid(
    bookingId: number,
  ): Promise<AgendaBookingPayment> {
    return request<AgendaBookingPayment>(
      `${agendaGateway}/appointments/${bookingId}/payment/mark-paid`,
      { method: "POST" },
    );
  },

  async providerAppointment(
    bookingId: number,
    signal?: AbortSignal,
  ): Promise<AgendaProviderBooking> {
    return request<AgendaProviderBooking>(
      `${agendaGateway}/appointments/${bookingId}`,
      { signal },
    );
  },

  async providerReschedule(
    bookingId: number,
    startAt: string,
  ): Promise<AgendaProviderBooking> {
    return request<AgendaProviderBooking>(
      `${agendaGateway}/appointments/${bookingId}/reschedule`,
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
      `${agendaGateway}/appointments/${bookingId}/status`,
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
      `${agendaGateway}/appointments/${bookingId}/reschedule-requests`,
      { signal },
    );
  },

  async decideReschedule(
    bookingId: number,
    requestId: number,
    payload: AgendaRescheduleDecisionPayload,
  ): Promise<AgendaRescheduleRequest> {
    return request<AgendaRescheduleRequest>(
      `${agendaGateway}/appointments/${bookingId}/reschedule-requests/${requestId}/decision`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },
};
