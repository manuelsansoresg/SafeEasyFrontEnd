import type { AgendaAppointmentQuery, AgendaProviderReschedulePage, AgendaProviderRescheduleItem } from '@/types/agendaBooking';
import type { AgendaPaymentRetryResponse, FinancialQuote, FinancialSummary, FinancialHistory, FinancialIntent, FinancialBookingPayload, FinancialBookingCreated, CancellationPreview, ManualMethod, FinancialOperation, FinancialRefund } from '@/types/agendaFinance';
import { fetchWithAuth } from "@/lib/api";
import type { AgendaService, PublicAgendaSettings } from "@/types/agenda";
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
  AgendaRefund,
} from "@/types/agendaBooking";

// `/api/*` apunta al backend FastAPI en producción, por lo que una ruta de
// Next bajo `/api/agenda-gateway` no llega a ejecutarse allí. El proxy público
// del frontend sí está disponible y conserva las rutas reales de Agenda.
const agendaGateway = "/proxy/agenda";
const publicAgendaGateway = "/proxy/public/agenda";

export class AgendaBookingRequestError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "AgendaBookingRequestError";
    this.status = status;
    this.code = code;
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
      "Este negocio no permite reservaciones como invitado. Inicia sesión para continuar.",

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
      "Este negocio no permite que el usuario cancele la cita.",

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
  const errorDetail = body && typeof body === "object" && "detail" in body ? body.detail : null;
  const code = errorDetail && typeof errorDetail === "object" && "code" in errorDetail ? String(errorDetail.code) : undefined;

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
      response.status, code,
    );
  }

  if (response.status === 422) {
    throw new AgendaBookingRequestError(
      detail || "Revisa los datos capturados.",
      response.status,
    );
  }

  if (response.status >= 500) {
    throw new AgendaBookingRequestError(
      "El servicio no está disponible en este momento. Intenta de nuevo más tarde.",
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
  async providerRescheduleRequests(skip = 0, limit = 50, signal?: AbortSignal, status?: import('@/types/agendaBooking').AgendaRescheduleStatus): Promise<AgendaProviderReschedulePage> {
    return request<AgendaProviderReschedulePage>(`${agendaGateway}/reschedule-requests${queryString({ status, skip, limit })}`, { signal });
  },
  async providerPendingRequests(signal?: AbortSignal): Promise<{ total: number; items: AgendaProviderRescheduleItem[] }> {
    const items: AgendaProviderRescheduleItem[] = [];
    let total: number | undefined;
    for (let skip = 0; ; skip += 200) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const page = await agendaBookingService.providerRescheduleRequests(skip, 200, signal, 'pending');
      if (total !== undefined && total !== page.total) throw new Error('Las solicitudes cambiaron durante la consulta. Actualiza la bandeja.');
      total = page.total; items.push(...page.items);
      if (page.items.length < 200) {
        const unique = [...new Map(items.map(item => [item.id, item])).values()];
        if (unique.length !== total) throw new Error('No se pudo completar la consulta de solicitudes. Actualiza la bandeja.');
        return { total, items: unique };
      }
    }
  },
  async providerCalendarAppointments(options: AgendaAppointmentQuery, status?: AgendaBookingStatus, signal?: AbortSignal): Promise<AgendaProviderBooking[]> {
    if (!options.date_from || !options.date_to) throw new Error('El calendario requiere un intervalo de fechas completo.');
    const all: AgendaProviderBooking[] = [];
    for (let skip = 0; ; skip += 200) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const page = await agendaBookingService.providerAppointments(status, signal, { ...options, sort: 'start_asc', overlap: true, skip, limit: 200 });
      all.push(...page);
      if (page.length < 200) return [...new Map(all.map(booking => [booking.id, booking])).values()];
    }
  },

  cancellationPolicyException(bookingId: number, payload: { reason: string; reference: string | null }) {
    return request<{ id: number; retention_blocked: boolean }>(`${agendaGateway}/appointments/${bookingId}/cancellation-policy-exception`, { method: 'POST', body: JSON.stringify(payload), retryOnAuthFailure: false });
  },

  financialQuote(supplierId: number, serviceId: number, signal?: AbortSignal) {
    return request<FinancialQuote>(`${publicAgendaGateway}/${supplierId}/services/${serviceId}/financial-quote`, { signal, retryOnAuthFailure: false });
  },
  createFinancialBooking(supplierId: number, payload: FinancialBookingPayload) {
    return request<FinancialBookingCreated>(`${publicAgendaGateway}/${supplierId}/bookings/financial`, { method: 'POST', body: JSON.stringify(payload), retryOnAuthFailure: false });
  },
  financialSummary(bookingId: number, provider = false, managementToken?: string | null, signal?: AbortSignal) {
    return request<FinancialSummary>(provider ? `${agendaGateway}/appointments/${bookingId}/financial-summary` : `${publicAgendaGateway}/bookings/${bookingId}/financial-summary${queryString({ management_token: managementToken })}`, { signal, retryOnAuthFailure: provider });
  },
  refreshFinancialSummary(bookingId: number, provider = false, managementToken?: string | null, signal?: AbortSignal) {
    return request<FinancialSummary>(provider ? `${agendaGateway}/appointments/${bookingId}/financial-summary/refresh` : `${publicAgendaGateway}/bookings/${bookingId}/financial-summary/refresh${queryString({ management_token: managementToken })}`, { method: 'POST', signal, retryOnAuthFailure: provider || !managementToken });
  },
  retryFinancialPayment(bookingId: number, idempotencyKey: string, managementToken?: string | null, signal?: AbortSignal) {
    return request<AgendaPaymentRetryResponse>(`${publicAgendaGateway}/bookings/${bookingId}/payments/retry${queryString({ management_token: managementToken })}`, { method: 'POST', body: JSON.stringify({ idempotency_key: idempotencyKey }), signal, retryOnAuthFailure: false });
  },
  financialHistory(bookingId: number, signal?: AbortSignal) {
    return request<FinancialHistory>(`${agendaGateway}/appointments/${bookingId}/payments`, { signal });
  },
  registerManualPayment(bookingId: number, payload: { amount: string; method: ManualMethod; reference: string | null; idempotency_key: string }) {
    return request<FinancialOperation>(`${agendaGateway}/appointments/${bookingId}/payments/manual`, { method: 'POST', body: JSON.stringify(payload), retryOnAuthFailure: false });
  },
  createBalanceIntent(bookingId: number, idempotency_key: string) {
    return request<FinancialIntent>(`${agendaGateway}/appointments/${bookingId}/payment-intents`, { method: 'POST', body: JSON.stringify({ idempotency_key }), retryOnAuthFailure: false });
  },
  adjustPayment(bookingId: number, operationId: number, action: 'reversals' | 'refunds', payload: { amount: string; reason: string; idempotency_key: string }) {
    return request<FinancialOperation | FinancialRefund>(`${agendaGateway}/appointments/${bookingId}/payments/${operationId}/${action}`, { method: 'POST', body: JSON.stringify(payload), retryOnAuthFailure: false });
  },
  confirmFinancialManualRefund(bookingId: number, refundId: number, reference: string) {
    return request<FinancialRefund>(`${agendaGateway}/appointments/${bookingId}/financial-refunds/${refundId}/confirm-manual`, { method: 'POST', body: JSON.stringify({ reference }), retryOnAuthFailure: false });
  },
  cancellationPreview(bookingId: number, managementToken?: string | null, signal?: AbortSignal) {
    return request<CancellationPreview>(`${publicAgendaGateway}/bookings/${bookingId}/cancellation-preview${queryString({ management_token: managementToken })}`, { signal, retryOnAuthFailure: false });
  },

  async getPublicSettings(
    supplierId: number,
    signal?: AbortSignal,
  ): Promise<PublicAgendaSettings> {
    return request<PublicAgendaSettings>(
      `${publicAgendaGateway}/${supplierId}/settings`,
      { signal, retryOnAuthFailure: false },
    );
  },

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

  async getBookingRefunds(bookingId: number, managementToken?: string | null, signal?: AbortSignal): Promise<AgendaRefund[]> {
    return request<AgendaRefund[]>(
      `${publicAgendaGateway}/bookings/${bookingId}/refunds${queryString({ management_token: managementToken })}`,
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
    options: AgendaAppointmentQuery = {},
  ): Promise<AgendaProviderBooking[]> {
    const query = queryString({
      status,
      ...options,
      overlap: options.overlap === undefined ? undefined : String(options.overlap),
      include_total: options.include_total === undefined ? undefined : String(options.include_total),
      limit: options.limit ?? 200,
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

  async providerBookingRefunds(bookingId: number, signal?: AbortSignal): Promise<AgendaRefund[]> {
    return request<AgendaRefund[]>(`${agendaGateway}/appointments/${bookingId}/refunds`, { signal });
  },

  async confirmManualRefund(bookingId: number, refundId: number, reference: string): Promise<AgendaRefund> {
    return request<AgendaRefund>(`${agendaGateway}/appointments/${bookingId}/refunds/${refundId}/confirm-manual`, {
      method: "POST", body: JSON.stringify({ reference }),
    });
  },

  async retryRefund(bookingId: number, refundId: number): Promise<AgendaRefund> {
    return request<AgendaRefund>(`${agendaGateway}/appointments/${bookingId}/refunds/${refundId}/retry`, { method: "POST" });
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
