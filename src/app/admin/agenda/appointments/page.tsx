"use client";

import Link from "next/link";
import { useSearchParams } from 'next/navigation';
import AgendaCalendarToolbar from '@/components/agenda/AgendaCalendarToolbar';
import AgendaProviderCalendar from '@/components/agenda/AgendaProviderCalendar';
import AgendaPendingRequests from '@/components/agenda/AgendaPendingRequests';
import AgendaRescheduleRequestsModal from '@/components/agenda/AgendaRescheduleRequestsModal';
import { useProviderAgenda } from '@/hooks/useProviderAgenda';
import { dateInZone, formatAgendaDate, parseAgendaNavigation } from '@/lib/agendaCalendar';
import {
  ArrowLeft,
  CalendarClock,
  Check,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import AgendaFinancialPanel from '@/components/agenda/AgendaFinancialPanel';
import { isFinancialBooking } from '@/lib/agendaFinance';
import AgendaPaymentStatus from "@/components/agenda/AgendaPaymentStatus";
import AgendaRefundStatus from "@/components/agenda/AgendaRefundStatus";
import AgendaModalShell from "@/components/agenda/AgendaModalShell";
import { createAgendaRefundHistoryCache } from "@/lib/agendaRefundHistoryCache";
import { useSupplierModules } from "@/hooks/useSupplierModules";
import { useChatInboxWebSocket } from "@/hooks/useChatWebSocket";
import { useInboxReconnect } from "@/hooks/useInboxReconnect";
import { ModuleAccessError } from "@/components/admin/ModuleAccessError";
import { agendaBookingService } from "@/services/agendaBookingService";
import { useChatStore } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";
import { isAgendaInboxEvent } from "@/types/chat";
import type { AgendaService } from "@/types/agenda";
import type {
  AgendaAvailability,
  AgendaAvailabilitySlot,
  AgendaBookingPayment,
  AgendaBookingStatus,
  AgendaProviderBooking,
  AgendaRefund,
} from "@/types/agendaBooking";

type ToastState =
  | { type: "success" | "error" | "info"; message: string }
  | null;

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10";

function statusLabel(status: AgendaBookingStatus) {
  return {
    pending: "Pendiente",
    confirmed: "Confirmada",
    completed: "Completada",
    cancelled: "Cancelada",
    no_show: "No asistió",
  }[status];
}

function statusClass(status: AgendaBookingStatus) {
  if (status === "confirmed") return "bg-green-50 text-green-700";
  if (status === "pending") return "bg-amber-50 text-amber-700";
  if (status === "cancelled" || status === "no_show") {
    return "bg-red-50 text-red-700";
  }
  return "bg-blue-50 text-blue-700";
}

function formatDateTime(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatSlot(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export default function ProviderAgendaAppointmentsPage() {
  const { loading: accessLoading, error: accessError, hasModule, getModule, retry } = useSupplierModules();
  const hasAccess = hasModule("agenda");
  const onlinePaymentsEnabled = getModule("agenda")?.online_payments_enabled === true;
  const token = useAuthStore((state) => state.token);
  const subscribeToInboxEvents = useChatStore((state) => state.subscribeToInboxEvents);
  const { status: inboxStatus } = useChatInboxWebSocket(Boolean(token) && hasAccess);

  const userId = useAuthStore(state => state.user?.id);
  const agenda = useProviderAgenda(hasAccess && !accessLoading, userId);
  const { appointments, setAppointments, services, filter, setFilter, loading, view, setView, date, setDate, timezone, load, pendingMap, refreshAll } = agenda;
  const [detailBooking, setDetailBooking] = useState<AgendaProviderBooking | null>(null);
  const [targetRequestId, setTargetRequestId] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const navigation = searchParams.toString();
  const navigationSequence = useRef(0);
  const handledNavigation = useRef('');
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [paymentWorkingId, setPaymentWorkingId] = useState<number | null>(null);
  const [payments, setPayments] = useState<
    Record<number, AgendaBookingPayment | null | undefined>
  >({});
  const [refunds, setRefunds] = useState<Record<number, AgendaRefund[]>>({});
  const [refundErrors, setRefundErrors] = useState<Record<number, string>>({});
  const [refundLoading, setRefundLoading] = useState<Record<number, boolean>>({});
  const [openRefundIds, setOpenRefundIds] = useState<Set<number>>(new Set());
  const openRefundIdsRef = useRef<Set<number>>(new Set());
  const [cancelBooking, setCancelBooking] = useState<AgendaProviderBooking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [refundAction, setRefundAction] = useState<{ booking: AgendaProviderBooking; refund: AgendaRefund; kind: "manual" | "retry" } | null>(null);
  const [reference, setReference] = useState("");
  const [refundWorking, setRefundWorking] = useState(false);
  const [refundActionError, setRefundActionError] = useState<string | null>(null);
  const lastAgendaEvent = useRef<Map<string, number>>(new Map());
  const [toast, setToast] = useState<ToastState>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] =
    useState<AgendaProviderBooking | null>(null);
  const [requestsBooking, setRequestsBooking] =
    useState<AgendaProviderBooking | null>(null);
  const [requestsRefreshKey, setRequestsRefreshKey] = useState(0);

  const refundHistory = useMemo(() => createAgendaRefundHistoryCache<AgendaRefund>({
    fetch: (bookingId, signal) => agendaBookingService.providerBookingRefunds(bookingId, signal),
    onLoaded: (bookingId, items) => {
      setRefunds((current) => ({ ...current, [bookingId]: items }));
      setRefundErrors((current) => ({ ...current, [bookingId]: "" }));
    },
    onError: (bookingId, error) => setRefundErrors((current) => ({
      ...current,
      [bookingId]: error instanceof Error ? error.message : "No se pudieron consultar las devoluciones.",
    })),
    onLoading: (bookingId, loading) => setRefundLoading((current) => ({ ...current, [bookingId]: loading })),
  }), []);
  const loadRefunds = refundHistory.load;

  const toggleRefunds = (bookingId: number) => {
    const opening = !openRefundIdsRef.current.has(bookingId);
    const next = new Set(openRefundIdsRef.current);
    if (opening) next.add(bookingId);
    else next.delete(bookingId);
    openRefundIdsRef.current = next;
    setOpenRefundIds(next);
    if (opening) void loadRefunds(bookingId);
  };

  const refreshAppointment = useCallback(async (
    bookingId: number,
    includePayment = false,
    signal?: AbortSignal,
    includeRefunds = true,
  ) => {
    const updated = await agendaBookingService.providerAppointment(bookingId, signal);
    const payment = includePayment && !isFinancialBooking(updated) ? await agendaBookingService.providerBookingPayment(bookingId, signal) : undefined;
    if (signal?.aborted) return;
    setAppointments((current) => {
      const index = current.findIndex((item) => item.id === bookingId);
      if (index === -1) return [updated, ...current];
      return current.map((item) => item.id === bookingId ? { ...updated, cancellation_result: updated.cancellation_result ?? item.cancellation_result } : item);
    });
    if (includePayment) {
      setPayments((current) => ({ ...current, [bookingId]: payment }));
    }
    if (!isFinancialBooking(updated) && includeRefunds && (openRefundIdsRef.current.has(bookingId) || refundHistory.hasLoaded(bookingId))) {
      void loadRefunds(bookingId, true, signal);
    }
  }, [loadRefunds, refundHistory, setAppointments]);

  const resyncAfterReconnect = useCallback(() => { void refreshAll(); }, [refreshAll]);
  useInboxReconnect(inboxStatus, Boolean(token) && hasAccess, resyncAfterReconnect);
  useEffect(() => {
    if (!token || !hasAccess || accessLoading) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToInboxEvents(event => {
      if (!isAgendaInboxEvent(event)) return;
      const key = `${event.type}:${event.booking_id}:${event.reschedule_request_id ?? ''}`;
      const now = Date.now();
      if (now - (lastAgendaEvent.current.get(key) ?? 0) < 300) return;
      lastAgendaEvent.current.set(key, now);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refreshAll(), 120);
      if (requestsBooking?.id === event.booking_id) setRequestsRefreshKey(value => value + 1);
      // Refresh an open detail only; calendar/list events never fan out financial requests.
      if (detailBooking?.id === event.booking_id) void agendaBookingService.providerAppointment(event.booking_id).then(updated => setDetailBooking(current => current?.id === updated.id && Date.parse(current.updated_at) <= Date.parse(updated.updated_at) ? updated : current)).catch(() => undefined);
    });
    return () => { if (timer) clearTimeout(timer); unsubscribe(); };
  }, [accessLoading, hasAccess, token, subscribeToInboxEvents, refreshAll, requestsBooking?.id, detailBooking?.id]);
  useEffect(() => {
    if (!hasAccess || !agenda.ready || handledNavigation.current === `${userId}:${navigation}`) return;
    const target = parseAgendaNavigation(new URLSearchParams(navigation));
    if (!target.bookingId) return;
    const controller = new AbortController();
    const sequence = ++navigationSequence.current;
    const run = async () => {
      try {
        const booking = await agendaBookingService.providerAppointment(target.bookingId!, controller.signal);
        const requests = !target.reschedule ? await agendaBookingService.rescheduleRequests(booking.id, controller.signal) : [];
        if (controller.signal.aborted || sequence !== navigationSequence.current) return;
        handledNavigation.current = `${userId}:${navigation}`;
        setSelectedBookingId(booking.id); setDate(dateInZone(booking.start_at, timezone));
        if (target.reschedule || requests.filter(request => request.status === 'pending').length === 1) {
          setTargetRequestId(target.requestId ?? requests.find(request => request.status === 'pending')?.id ?? null); setRequestsBooking(booking);
        } else setDetailBooking(booking);
      } catch (error) {
        if (!controller.signal.aborted && sequence === navigationSequence.current) { handledNavigation.current = `${userId}:${navigation}`; setToast({ type: 'error', message: error instanceof Error ? error.message : 'La reservación no existe o no tienes acceso.' }); }
      }
    };
    void run(); return () => controller.abort();
  }, [hasAccess, agenda.ready, userId, navigation, timezone, setDate]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const serviceMap = useMemo(() => {
    const map = new Map<number, AgendaService>();
    services.forEach((service) => map.set(service.id, service));
    return map;
  }, [services]);

  const filtered = useMemo(() => {
    if (filter === "all") return appointments;
    return appointments.filter((item) => item.status === filter);
  }, [appointments, filter]);

  const replaceAppointment = (updated: AgendaProviderBooking) => {
    setDetailBooking(current => current?.id === updated.id ? updated : current);
    setAppointments((current) =>
      current.map((item) =>
        item.id === updated.id ? updated : item,
      ),
    );
  };

  const changeStatus = async (
    booking: AgendaProviderBooking,
    status: AgendaBookingStatus,
  ) => {
    if (status === "cancelled") { setCancelBooking(booking); setCancelReason(""); setCancelError(null); return; }
    const note = window.prompt(
      "Nota interna del proveedor (opcional):",
      booking.provider_notes || "",
    );

    if (note === null) return;

    setWorkingId(booking.id);

    try {
      const updated =
        await agendaBookingService.updateProviderStatus(
          booking.id,
          {
            status,
            provider_notes: note.trim() || null,
          },
        );

      replaceAppointment(updated);
      void refreshAll();
      setToast({
        type: "success",
        message: `Cita marcada como ${statusLabel(status).toLowerCase()}.`,
      });
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cambiar el estado.",
      });
    } finally {
      setWorkingId(null);
    }
  };

  const confirmCancellation = async () => {
    if (!cancelBooking || !cancelReason.trim() || workingId !== null) return;
    const bookingId = cancelBooking.id;
    setWorkingId(bookingId);
    setCancelError(null);
    try {
      const updated = await agendaBookingService.updateProviderStatus(bookingId, { status: "cancelled", cancellation_reason: cancelReason.trim(), provider_notes: cancelBooking.provider_notes });
      replaceAppointment(updated);
      setCancelBooking(null);
      void refreshAll();
      const open = new Set(openRefundIdsRef.current);
      open.add(bookingId);
      openRefundIdsRef.current = open;
      setOpenRefundIds(open);
      if (!isFinancialBooking(updated)) void loadRefunds(bookingId, true);
      setToast({ type: "success", message: "Reservación cancelada. Consulta el estado de la devolución." });
      void refreshAppointment(bookingId, true, undefined, false).catch(() => setToast({ type: "info", message: "Reservación cancelada. Usa Actualizar estado para consultar la devolución." }));
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : "No se pudo cancelar la reservación. Intenta nuevamente.");
    } finally { setWorkingId(null); }
  };

  const submitRefundAction = async () => {
    if (!refundAction || refundWorking) return;
    if (refundAction.kind === "manual" && (reference.trim().length < 3 || reference.trim().length > 255)) return;
    setRefundWorking(true);
    setRefundActionError(null);
    try {
      const { booking, refund, kind } = refundAction;
      const updated = kind === "manual"
        ? await agendaBookingService.confirmManualRefund(booking.id, refund.id, reference.trim())
        : await agendaBookingService.retryRefund(booking.id, refund.id);
      setRefunds((current) => ({ ...current, [booking.id]: (current[booking.id] ?? []).map((item) => item.id === updated.id ? updated : item) }));
      if (updated.status === "failed") {
        setRefundActionError("No se pudo completar el reembolso. Intenta nuevamente o revisa tu cuenta de Mercado Pago.");
        void refreshAppointment(booking.id, true).catch(() => {});
        return;
      }
      setRefundAction(null);
      setReference("");
      setToast({ type: "success", message: updated.status === "confirmed" ? "Devolución confirmada." : "La devolución sigue en proceso. Actualiza el estado para consultarla." });
      void refreshAppointment(booking.id, true).catch(() => setToast({ type: "info", message: "Operación registrada. Usa Actualizar estado para consultar el pago." }));
    } catch (error) {
      setRefundActionError(error instanceof Error ? error.message : refundAction.kind === "manual" ? "No se pudo confirmar la devolución. Verifica la referencia e intenta nuevamente." : "Mercado Pago no pudo completar la devolución. Puedes intentarlo nuevamente más tarde.");
    } finally { setRefundWorking(false); }
  };

  const markCashPaymentPaid = async (bookingId: number) => {
    if (!window.confirm("¿Confirmas que recibiste el pago de esta cita?")) {
      return;
    }

    setPaymentWorkingId(bookingId);
    try {
      const updated = await agendaBookingService.markBookingPaymentPaid(bookingId);
      setPayments((current) => ({ ...current, [bookingId]: updated }));
      setToast({ type: "success", message: "Pago registrado correctamente." });
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo registrar el pago.",
      });
    } finally {
      setPaymentWorkingId(null);
    }
  };

  const serviceNames = useMemo(() => new Map(services.map(service => [service.id, service.name])), [services]);
  const handlePaymentLoaded = useCallback((id: number, payment: AgendaBookingPayment | null) => setPayments(current => ({ ...current, [id]: payment })), []);
  const openBooking = async (id: number, requestId?: number) => {
    try {
      const booking = await agendaBookingService.providerAppointment(id);
      if (requestId) { setTargetRequestId(requestId); setRequestsBooking(booking); }
      else setDetailBooking(booking);
    } catch (error) { setToast({ type: 'error', message: error instanceof Error ? error.message : 'No se pudo abrir la reservación.' }); }
  };
  const renderBookingCards = (items: AgendaProviderBooking[], detail = false) => (
        <div className={detail ? "grid w-full min-w-0 grid-cols-1" : "grid gap-4 xl:grid-cols-2"}>
          {items.map((booking) => {
            const service = serviceMap.get(booking.service_id);
            const working = workingId === booking.id;

            return (
              <article
                key={booking.id}
                id={`booking-${booking.id}`}
                className={`min-w-0 rounded-3xl border bg-white p-5 shadow-sm sm:p-6 ${selectedBookingId === booking.id ? "border-[#168e00] ring-2 ring-[#168e00]/20" : "border-gray-100"}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-gray-900">
                        {service?.name || `Servicio #${booking.service_id}`}
                      </h2>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(
                          booking.status,
                        )}`}
                      >
                        {statusLabel(booking.status)}
                      </span>
                    </div>

                    <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <Clock3 size={16} className="text-[#168e00]" />
                      {formatDateTime(booking.start_at, timezone)}
                    </p>
                  </div>

                  <span className="text-xs font-semibold text-gray-400">
                    #{booking.id}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Info label="Cliente" value={booking.customer_name} />
                  <Info
                    label="Correo"
                    value={booking.customer_email || "Sin correo"}
                  />
                  <Info
                    label="Teléfono"
                    value={booking.customer_phone || "Sin teléfono"}
                  />
                  <Info
                    label="Origen"
                    value={
                      booking.customer_user_id
                        ? "Cliente registrado"
                        : "Invitado"
                    }
                  />
                </div>

                {booking.notes ? (
                  <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                    <strong>Nota del cliente:</strong> {booking.notes}
                  </div>
                ) : null}

                {booking.provider_notes ? (
                  <div className="mt-3 rounded-2xl bg-[#004e28]/5 p-4 text-sm text-gray-600">
                    <strong>Nota interna:</strong>{" "}
                    {booking.provider_notes}
                  </div>
                ) : null}

                {isFinancialBooking(booking) ? <details className="mt-4" open={selectedBookingId === booking.id || Boolean(booking.cancellation_result)}><summary className="cursor-pointer rounded-xl bg-[#004e28]/5 p-3 font-bold text-[#004e28]">Pagos de la reservación</summary><ProviderFinancialDetail booking={booking} onlineAvailable={onlinePaymentsEnabled && agenda.onlineConfigured} /></details> : <details className="mt-4"><summary className="cursor-pointer rounded-xl bg-[#004e28]/5 p-3 font-bold text-[#004e28]">Pagos y devoluciones</summary>
                <LegacyPaymentLoader bookingId={booking.id} onLoaded={handlePaymentLoaded} />
                <div className="mt-4">
                  <AgendaPaymentStatus
                    compact
                    payment={payments[booking.id]}
                    cancelled={booking.status === "cancelled"}
                    primaryRefundConfirmed={refunds[booking.id]?.some((refund) => refund.refund_type === "primary" && refund.status === "confirmed")}
                    markingPaid={paymentWorkingId === booking.id}
                    onMarkPaid={() => void markCashPaymentPaid(booking.id)}
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-gray-100 bg-[#f2f3f4] p-4">
                  <button type="button" aria-expanded={openRefundIds.has(booking.id)} onClick={() => toggleRefunds(booking.id)} className="w-full text-left font-bold text-[#004e28] focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-[#168e00]">
                    {openRefundIds.has(booking.id) ? "Ocultar devoluciones" : "Ver devoluciones"}
                    {refunds[booking.id]?.length ? ` (${refunds[booking.id].length})` : ""}
                  </button>
                  {openRefundIds.has(booking.id) ? (
                    <div className="mt-3 space-y-3">
                      {refundLoading[booking.id] && refunds[booking.id] === undefined ? <p role="status" className="text-sm text-gray-600">Consultando devoluciones...</p> : null}
                      {refundErrors[booking.id] ? <p role="alert" className="text-sm text-amber-800">{refundErrors[booking.id]}</p> : null}
                      {refunds[booking.id]?.map((refund) => (
                        <div key={refund.id}>
                          <AgendaRefundStatus refund={refund} compact />
                          {refund.status === "manual_pending" && refund.method === "cash" ? (
                            <button type="button" className="mt-2 rounded-xl bg-[#168e00] px-4 py-2 text-sm font-bold text-white focus-visible:outline-2" onClick={() => { setRefundAction({ booking, refund, kind: "manual" }); setReference(""); setRefundActionError(null); }}>Confirmar devolución</button>
                          ) : refund.method === "online" && (refund.status === "failed" || refund.status === "pending") ? (
                            <button type="button" className="mt-2 rounded-xl border border-[#168e00] px-4 py-2 text-sm font-bold text-[#168e00] focus-visible:outline-2" onClick={() => { setRefundAction({ booking, refund, kind: "retry" }); setRefundActionError(null); }}>Reintentar reembolso</button>
                          ) : null}
                        </div>
                      ))}
                      {refunds[booking.id]?.length === 0 ? <p className="text-sm text-gray-600">Esta reservación no tiene devoluciones registradas.</p> : null}
                      <button type="button" disabled={refundLoading[booking.id]} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-[#004e28] disabled:opacity-50" onClick={() => void loadRefunds(booking.id, true)}>Actualizar estado</button>
                    </div>
                  ) : null}
                </div>

                </details>}
                {pendingMap.get(booking.id) ? <div className="mt-4 space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950"><p className="font-bold">El cliente solicitó cambiar esta cita</p><p>Actual: {formatAgendaDate(booking.start_at, timezone)}</p><p>Propuesta: {formatAgendaDate(pendingMap.get(booking.id)!.requested_start_at, timezone)}</p><button type="button" className="min-h-11 font-bold underline" onClick={() => { setTargetRequestId(pendingMap.get(booking.id)!.id); setRequestsBooking(booking); }}>Revisar solicitud</button></div> : null}
                <div className={detail ? "mt-6 space-y-3 border-t border-gray-100 pt-5" : "mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4"}>
                  <div className={detail ? `grid grid-cols-1 gap-3 ${booking.status === "confirmed" ? "sm:grid-cols-3" : "sm:grid-cols-2"} [&:empty]:hidden [&>button]:min-h-11 [&>button]:justify-center` : "contents"}>
                  {booking.status === "pending" ? (
                    <>
                      <ActionButton
                        disabled={working}
                        onClick={() =>
                          void changeStatus(booking, "confirmed")
                        }
                        label="Confirmar"
                        icon={<Check size={16} />}
                      />
                      <DangerButton
                        disabled={working}
                        onClick={() =>
                          void changeStatus(booking, "cancelled")
                        }
                        label="Cancelar"
                      />
                    </>
                  ) : null}

                  {booking.status === "confirmed" ? (
                    <>
                      <ActionButton
                        disabled={working}
                        onClick={() =>
                          void changeStatus(booking, "completed")
                        }
                        label="Completar"
                        icon={<Check size={16} />}
                      />
                      <SecondaryButton
                        disabled={working}
                        onClick={() =>
                          void changeStatus(booking, "no_show")
                        }
                        label="No asistió"
                      />
                      <DangerButton
                        disabled={working}
                        onClick={() =>
                          void changeStatus(booking, "cancelled")
                        }
                        label="Cancelar"
                      />
                    </>
                  ) : null}

                  </div>
                  <div className={detail ? "grid grid-cols-1 gap-3 sm:grid-cols-2 [&>button]:min-h-11 [&>button]:justify-center" : "contents"}>
                  {(booking.status === "pending" ||
                    booking.status === "confirmed") ? (
                    <SecondaryButton
                      disabled={working}
                      onClick={() => setRescheduleBooking(booking)}
                      label="Reprogramar cita"
                      icon={<RefreshCw size={16} />}
                    />
                  ) : null}

                  <SecondaryButton
                    disabled={working}
                    onClick={() => { setTargetRequestId(null); setRequestsBooking(booking); }}
                    label="Solicitudes de cambio"
                    icon={<CalendarClock size={16} />}
                  />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
  );

  if (accessLoading || (hasAccess && !agenda.ready && !agenda.contextError)) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Loader2 className="animate-spin text-[#168e00]" size={34} />
      </div>
    );
  }

  if (accessError) return <ModuleAccessError onRetry={() => void retry()} />;

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          El módulo Agenda no está activo.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/agenda"
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#004e28]"
        >
          <ArrowLeft size={17} />
          Configuración de Agenda
        </Link>

        <button
          type="button"
          disabled={!agenda.ready}
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-4 py-3 font-semibold text-white hover:bg-[#117500]"
        >
          <Plus size={18} />
          Crear cita
        </button>
      </div>

      <PageHero
        eyebrow="Agenda"
        title="Mi Agenda"
        subtitle="Consulta, confirma, reprograma y administra las reservaciones de tus clientes."
      />

      {agenda.ready ? <>
        <AgendaPendingRequests items={agenda.pending} total={agenda.pendingTotal} error={agenda.pendingError} loading={agenda.pendingLoading} page={agenda.pendingPage} onPage={agenda.setPendingPage} onRefresh={() => void agenda.loadPending()} onReview={item => void openBooking(item.booking_id, item.id)} onBooking={id => void openBooking(id)} services={serviceNames} timezone={timezone} />
        <AgendaCalendarToolbar view={view} date={date} timezone={timezone} onView={setView} onDate={setDate} loading={loading} />
        {view === 'reservations' ? <label className="block rounded-2xl bg-white p-4 text-sm font-semibold text-[#004e28]">Orden de reservaciones<select value={agenda.sort} onChange={event => agenda.setSort(event.target.value as import('@/lib/agendaCalendar').AgendaSort)} className="mt-2 block h-12 w-full rounded-xl border border-gray-200 bg-white px-4"><option value="created_desc">Más recientes · fecha de registro</option><option value="start_asc">Próximas citas · desde ahora</option><option value="start_desc">Fecha de cita descendente</option></select></label> : null}
      </> : null}

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
        {[
          ["all", "Todas"],
          ["pending", "Pendientes"],
          ["confirmed", "Confirmadas"],
          ["completed", "Completadas"],
          ["cancelled", "Canceladas"],
          ["no_show", "No asistió"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() =>
              setFilter(value as "all" | AgendaBookingStatus)
            }
            className={
              filter === value
                ? "shrink-0 rounded-xl bg-[#004e28] px-4 py-2.5 text-sm font-semibold text-white"
                : "shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {agenda.contextError ? <div role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{agenda.contextError}<button type="button" onClick={agenda.retryContext} className="ml-2 underline">Volver a consultar configuración</button></div> : null}
      {agenda.error ? <div role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{agenda.error}<button type="button" onClick={() => void load()} className="ml-2 underline">Actualizar citas</button></div> : null}
      {loading && agenda.ready ? <p role="status" className="rounded-xl bg-white p-5 text-gray-500">Consultando el período…</p> : agenda.ready && view !== 'reservations' ? <AgendaProviderCalendar key={`${view}:${date}`} view={view} date={date} timezone={timezone} bookings={filtered} schedules={agenda.schedules} pendingIds={new Set(pendingMap.keys())} serviceNames={serviceNames} onFocusDate={setDate} onSelectDate={day => { setDate(day); setView('day'); }} onSelectBooking={booking => { if (pendingMap.has(booking.id)) { setTargetRequestId(pendingMap.get(booking.id)!.id); setRequestsBooking(booking); } else setDetailBooking(booking); }} /> : null}
      {!loading && view === 'reservations' ? <>
        {!filtered.length ? <p className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center text-gray-500">No hay reservaciones con este filtro.</p> : renderBookingCards(filtered)}
        <div className="flex items-center justify-between rounded-xl bg-white p-3 text-sm"><button type="button" disabled={!agenda.page} onClick={() => agenda.setPage(agenda.page - 1)} className="min-h-11 rounded-xl border px-3 disabled:opacity-40">Anterior</button><span>Página {agenda.page + 1}</span><button type="button" disabled={!agenda.hasMore} onClick={() => agenda.setPage(agenda.page + 1)} className="min-h-11 rounded-xl border px-3 disabled:opacity-40">Siguiente</button></div>
      </> : null}
      <AgendaModalShell asForm={false} open={Boolean(detailBooking)} title="Detalle de la reservación" hideSubmit saving={workingId !== null} cancelLabel="Cerrar" onClose={() => setDetailBooking(null)} onSubmit={event => event.preventDefault()}>{detailBooking ? renderBookingCards([detailBooking], true) : null}</AgendaModalShell>

      <AgendaModalShell open={Boolean(cancelBooking)} title="Cancelar reservación" saving={workingId !== null} cancelLabel="Volver" submitDisabled={!cancelReason.trim()} submitLabel="Confirmar cancelación" onClose={() => { setCancelBooking(null); setCancelError(null); }} onSubmit={(event) => { event.preventDefault(); void confirmCancellation(); }}>
        {cancelBooking ? <>
          <div className="space-y-1 rounded-2xl bg-[#f2f3f4] p-4 text-sm">
            <p><strong>Cliente:</strong> {cancelBooking.customer_name}</p>
            <p><strong>Servicio:</strong> {serviceMap.get(cancelBooking.service_id)?.name ?? `Servicio #${cancelBooking.service_id}`}</p>
            <p><strong>Fecha:</strong> {formatDateTime(cancelBooking.start_at, timezone)}</p>
            <p><strong>Pago:</strong> {payments[cancelBooking.id]?.payment_status ?? "Sin pago"}</p>
            {payments[cancelBooking.id]?.payment_status === "paid" ? <p><strong>Importe pagado:</strong> {payments[cancelBooking.id]?.amount} MXN</p> : null}
          </div>
          <p className="text-sm text-gray-700">{payments[cancelBooking.id]?.payment_status === "paid" && payments[cancelBooking.id]?.payment_method === "online" ? "Al cancelar esta reservación, se gestionará el reembolso completo del pago realizado por el cliente." : payments[cancelBooking.id]?.payment_status === "paid" && payments[cancelBooking.id]?.payment_method === "cash" ? "Deberás confirmar posteriormente la devolución del dinero recibido." : "La reservación se cancelará sin generar una devolución."}</p>
          <label className="block text-sm font-semibold">Motivo de cancelación *
            <textarea required maxLength={5000} rows={4} className={`${inputClass} mt-2`} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Explica el motivo real de la cancelación" />
          </label>
          {cancelError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{cancelError}</p> : null}
        </> : null}
      </AgendaModalShell>

      <AgendaModalShell open={Boolean(refundAction)} title={refundAction?.kind === "manual" ? "Confirmar devolución al cliente" : "Reintentar devolución"} saving={refundWorking} cancelLabel="Volver" submitDisabled={refundAction?.kind === "manual" && (reference.trim().length < 3 || reference.trim().length > 255)} submitLabel={refundAction?.kind === "manual" ? "Confirmar devolución" : "Reintentar reembolso"} onClose={() => { setRefundAction(null); setRefundActionError(null); }} onSubmit={(event) => { event.preventDefault(); void submitRefundAction(); }}>
        {refundAction ? refundAction.kind === "manual" ? <>
          <div className="space-y-1 rounded-2xl bg-[#f2f3f4] p-4 text-sm">
            <p><strong>Cliente:</strong> {refundAction.booking.customer_name}</p>
            <p><strong>Importe:</strong> {refundAction.refund.amount} {refundAction.refund.currency}</p>
            <p><strong>Método:</strong> Pago directo</p>
            {refundAction.refund.reason ? <p><strong>Motivo:</strong> {refundAction.refund.reason}</p> : null}
          </div>
          <p className="text-sm text-amber-900">Devuelve efectivamente el dinero al cliente antes de confirmar esta operación.</p>
          <label className="block text-sm font-semibold">Referencia o comprobante de devolución *
            <input required minLength={3} maxLength={255} className={`${inputClass} mt-2`} value={reference} onChange={(event) => setReference(event.target.value)} />
          </label>
        </> : <p className="text-sm text-gray-700">Volveremos a consultar y procesar la devolución mediante Mercado Pago. No se generará una nueva reservación ni un nuevo cobro.</p> : null}
        {refundActionError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{refundActionError}</p> : null}
      </AgendaModalShell>

      {agenda.ready ? <ProviderCreateModal
        timezone={timezone}
        open={createOpen}
        services={services.filter((item) => item.is_active)}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          setAppointments((current) => current.some((item) => item.id === created.id)
            ? current.map((item) => item.id === created.id ? created : item)
            : [created, ...current]);
          setPayments((current) => current[created.id] !== undefined
            ? current
            : { ...current, [created.id]: null });
          setCreateOpen(false);
          void refreshAll();
          setToast({
            type: "success",
            message: "Cita creada.",
          });
        }}
        onError={(message) =>
          setToast({ type: "error", message })
        }
      /> : null}

      {agenda.ready ? <ProviderRescheduleModal
        timezone={timezone}
        booking={rescheduleBooking}
        service={rescheduleBooking
          ? serviceMap.get(rescheduleBooking.service_id) || null
          : null}
        onClose={() => setRescheduleBooking(null)}
        onUpdated={(updated) => {
          replaceAppointment(updated);
          setRescheduleBooking(null);
          void refreshAll();
          setToast({
            type: "success",
            message: "Cita reprogramada.",
          });
        }}
        onError={(message) =>
          setToast({ type: "error", message })
        }
      /> : null}

      {requestsBooking && agenda.ready ? <AgendaRescheduleRequestsModal key={`${requestsBooking.id}:${targetRequestId}`} booking={requestsBooking} requestId={targetRequestId} serviceName={serviceNames.get(requestsBooking.service_id)} timezone={timezone} refreshKey={requestsRefreshKey} onClose={() => { setRequestsBooking(null); setTargetRequestId(null); }} onDecision={async () => {
        const updated = await agendaBookingService.providerAppointment(requestsBooking.id);
        setRequestsBooking(updated); setDetailBooking(current => current?.id === updated.id ? updated : current);
        await refreshAll();
      }} /> : null}

      {toast ? (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-gray-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-1 font-semibold text-gray-700 [overflow-wrap:anywhere]">
        {value}
      </p>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  icon,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-3.5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}

function SecondaryButton({
  label,
  onClick,
  disabled,
  icon,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm font-semibold text-gray-600 disabled:opacity-50"
    >
      {icon}
      {label}
    </button>
  );
}

function DangerButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl border border-red-200 px-3.5 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function ModalShell({ title, children, onClose, saving = false }: { title: string; children: React.ReactNode; onClose: () => void; saving?: boolean }) {
  return <AgendaModalShell open asForm={false} hideSubmit title={title} saving={saving} cancelLabel="Cerrar" onClose={onClose} onSubmit={event => event.preventDefault()}>{children}</AgendaModalShell>;
}

function ProviderCreateModal({
  open,
  services,
  timezone,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  services: AgendaService[];
  timezone: string;
  onClose: () => void;
  onCreated: (booking: AgendaProviderBooking) => void;
  onError: (message: string) => void;
}) {
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [date, setDate] = useState(() => dateInZone(new Date(), timezone));
  const [availability, setAvailability] =
    useState<AgendaAvailability | null>(null);
  const [slot, setSlot] =
    useState<AgendaAvailabilitySlot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] =
    useState<"pending" | "confirmed">("confirmed");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);

  useEffect(() => {
    if (open && services.length && serviceId == null) {
      setServiceId(services[0].id);
    }
  }, [open, serviceId, services]);

  useEffect(() => {
    if (!open || !serviceId || !date) return;

    const controller = new AbortController();

    const run = async () => {
      setLoadingSlots(true);
      setSlot(null);

      try {
        const data = await agendaBookingService.availability(
          services[0]?.supplier_id || 0,
          serviceId,
          date,
          date,
          controller.signal,
        );
        setAvailability(data);
      } catch (error) {
        onError(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar horarios.",
        );
        setAvailability(null);
      } finally {
        setLoadingSlots(false);
      }
    };

    void run();

    return () => controller.abort();
  }, [date, onError, open, serviceId, services]);

  if (!open) return null;

  const submit = async () => {
    if (savingLock.current) return;
    if (!serviceId || !slot || !name.trim()) {
      onError("Completa servicio, horario y nombre.");
      return;
    }

    savingLock.current = true;
    setSaving(true);

    try {
      const created =
        await agendaBookingService.createProviderAppointment({
          service_id: serviceId,
          start_at: slot.start_at,
          customer_name: name.trim(),
          customer_email: email.trim() || null,
          customer_phone: phone.trim() || null,
          notes: notes.trim() || null,
          customer_user_id: null,
          status,
        });

      onCreated({
        ...created,
        provider_notes: null,
      });
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "No se pudo crear la cita.",
      );
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  };

  return (
    <ModalShell saving={saving} title="Crear cita" onClose={onClose}>
      <div className="space-y-5">
        <label>
          <span className="mb-1.5 block text-sm font-semibold text-gray-700">
            Servicio
          </span>
          <select
            className={inputClass}
            value={serviceId ?? ""}
            onChange={(event) =>
              setServiceId(Number(event.target.value))
            }
          >
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1.5 block text-sm font-semibold text-gray-700">
            Fecha
          </span>
          <input
            type="date"
            min={dateInZone(new Date(), timezone)}
            className={inputClass}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>

        <div>
          <span className="mb-2 block text-sm font-semibold text-gray-700">
            Horario
          </span>
          {loadingSlots ? (
            <Loader2 className="animate-spin text-[#168e00]" size={22} />
          ) : availability?.slots.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {availability.slots.map((item) => (
                <button
                  key={item.start_at}
                  type="button"
                  onClick={() => setSlot(item)}
                  className={
                    slot?.start_at === item.start_at
                      ? "rounded-xl bg-[#168e00] px-3 py-2.5 font-semibold text-white"
                      : "rounded-xl border border-gray-200 px-3 py-2.5 font-semibold text-gray-600"
                  }
                >
                  {formatSlot(
                    item.start_at,
                    availability.timezone,
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No hay horarios disponibles.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Nombre *
            </span>
            <input
              className={inputClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label>
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Correo
            </span>
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Teléfono
            </span>
            <input
              className={inputClass}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>

          <label>
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Estado inicial
            </span>
            <select
              className={inputClass}
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as "pending" | "confirmed",
                )
              }
            >
              <option value="confirmed">Confirmada</option>
              <option value="pending">Pendiente</option>
            </select>
          </label>
        </div>

        <label>
          <span className="mb-1.5 block text-sm font-semibold text-gray-700">
            Nota
          </span>
          <textarea
            rows={3}
            className={inputClass}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-5 py-3 font-semibold text-gray-600"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || !slot || !name.trim()}
            onClick={() => void submit()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Plus size={18} />
            )}
            Crear cita
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ProviderRescheduleModal({
  booking,
  service,
  timezone,
  onClose,
  onUpdated,
  onError,
}: {
  booking: AgendaProviderBooking | null;
  service: AgendaService | null;
  timezone: string;
  onClose: () => void;
  onUpdated: (booking: AgendaProviderBooking) => void;
  onError: (message: string) => void;
}) {
  const [date, setDate] = useState(() => dateInZone(new Date(), timezone));
  const [availability, setAvailability] =
    useState<AgendaAvailability | null>(null);
  const [slot, setSlot] =
    useState<AgendaAvailabilitySlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);

  useEffect(() => {
    if (!booking || !service) return;

    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      setSlot(null);

      try {
        const data = await agendaBookingService.availability(
          booking.supplier_id,
          service.id,
          date,
          date,
          controller.signal,
        );
        setAvailability(data);
      } catch (error) {
        onError(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar horarios.",
        );
        setAvailability(null);
      } finally {
        setLoading(false);
      }
    };

    void run();

    return () => controller.abort();
  }, [booking, date, onError, service]);

  if (!booking || !service) return null;

  const submit = async () => {
    if (savingLock.current) return;
    if (!slot) return;

    savingLock.current = true;
    setSaving(true);

    try {
      const updated =
        await agendaBookingService.providerReschedule(
          booking.id,
          slot.start_at,
        );

      onUpdated(updated);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "No se pudo reprogramar.",
      );
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={`Reprogramar cita #${booking.id}`}
      saving={saving}
      onClose={onClose}
    >
      <div className="space-y-5">
        <label>
          <span className="mb-1.5 block text-sm font-semibold text-gray-700">
            Nueva fecha
          </span>
          <input
            type="date"
            min={dateInZone(new Date(), timezone)}
            className={inputClass}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>

        <div>
          <span className="mb-2 block text-sm font-semibold text-gray-700">
            Nuevo horario
          </span>

          {loading ? (
            <Loader2 className="animate-spin text-[#168e00]" size={22} />
          ) : availability?.slots.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {availability.slots.map((item) => (
                <button
                  key={item.start_at}
                  type="button"
                  onClick={() => setSlot(item)}
                  className={
                    slot?.start_at === item.start_at
                      ? "rounded-xl bg-[#168e00] px-3 py-2.5 font-semibold text-white"
                      : "rounded-xl border border-gray-200 px-3 py-2.5 font-semibold text-gray-600"
                  }
                >
                  {formatSlot(
                    item.start_at,
                    availability.timezone,
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No hay horarios disponibles.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 px-5 py-3 font-semibold text-gray-600"
          >
            Cerrar
          </button>
          <button
            type="button"
            disabled={saving || !slot}
            onClick={() => void submit()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <RefreshCw size={18} />
            )}
            Reprogramar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function ProviderFinancialDetail({ booking, onlineAvailable }: { booking: AgendaProviderBooking; onlineAvailable: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const details = ref.current?.parentElement as HTMLDetailsElement | null;
    if (!details) return;
    const toggle = () => { if (details.open) setLoaded(true); };
    const frame = requestAnimationFrame(toggle);
    details.addEventListener('toggle', toggle);
    return () => { cancelAnimationFrame(frame); details.removeEventListener('toggle', toggle); };
  }, []);
  return <div ref={ref}>{loaded ? <AgendaFinancialPanel booking={booking} provider onlineAvailable={onlineAvailable} /> : null}</div>;
}

function LegacyPaymentLoader({ bookingId, onLoaded }: { bookingId: number; onLoaded: (id: number, payment: AgendaBookingPayment | null) => void }) {
  const [error, setError] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const details = ref.current?.closest('details');
    const controller = new AbortController();
    let started = false;
    const load = () => {
      if (!details?.open || started) return;
      started = true;
      void agendaBookingService.providerBookingPayment(bookingId, controller.signal).then(payment => { if (!controller.signal.aborted) onLoaded(bookingId, payment); }).catch(error => { if (!controller.signal.aborted) { started = false; setError(error instanceof Error ? error.message : 'No se pudo consultar el pago.'); } });
    };
    details?.addEventListener('toggle', load);
    const frame = requestAnimationFrame(load);
    return () => { controller.abort(); cancelAnimationFrame(frame); details?.removeEventListener('toggle', load); };
  }, [bookingId, onLoaded]);
  return <div ref={ref}>{error ? <p role="alert" className="text-sm text-amber-900">{error}</p> : null}</div>;
}
