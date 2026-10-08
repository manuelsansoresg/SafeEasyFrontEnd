"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  Check,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import AgendaPaymentStatus from "@/components/agenda/AgendaPaymentStatus";
import AgendaRefundStatus from "@/components/agenda/AgendaRefundStatus";
import AgendaModalShell from "@/components/agenda/AgendaModalShell";
import { useSupplierModules } from "@/hooks/useSupplierModules";
import { useChatInboxWebSocket } from "@/hooks/useChatWebSocket";
import { useInboxReconnect } from "@/hooks/useInboxReconnect";
import { ModuleAccessError } from "@/components/admin/ModuleAccessError";
import { agendaService } from "@/services/agendaService";
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
  AgendaRescheduleRequest,
  AgendaRefund,
} from "@/types/agendaBooking";

type ToastState =
  | { type: "success" | "error" | "info"; message: string }
  | null;

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10";

function localDateInput() {
  const now = new Date();
  const local = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000,
  );
  return local.toISOString().slice(0, 10);
}

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

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("es-MX", {
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
  const { loading: accessLoading, error: accessError, hasModule, retry } = useSupplierModules();
  const hasAccess = hasModule("agenda");
  const token = useAuthStore((state) => state.token);
  const subscribeToInboxEvents = useChatStore((state) => state.subscribeToInboxEvents);
  const { status: inboxStatus } = useChatInboxWebSocket(Boolean(token) && hasAccess);

  const [appointments, setAppointments] = useState<
    AgendaProviderBooking[]
  >([]);
  const [services, setServices] = useState<AgendaService[]>([]);
  const [filter, setFilter] =
    useState<"all" | AgendaBookingStatus>("all");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [paymentWorkingId, setPaymentWorkingId] = useState<number | null>(null);
  const [payments, setPayments] = useState<
    Record<number, AgendaBookingPayment | null | undefined>
  >({});
  const [refunds, setRefunds] = useState<Record<number, AgendaRefund[]>>({});
  const [refundErrors, setRefundErrors] = useState<Record<number, string>>({});
  const [cancelBooking, setCancelBooking] = useState<AgendaProviderBooking | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [refundAction, setRefundAction] = useState<{ booking: AgendaProviderBooking; refund: AgendaRefund; kind: "manual" | "retry" } | null>(null);
  const [reference, setReference] = useState("");
  const [refundWorking, setRefundWorking] = useState(false);
  const lastAgendaEvent = useRef<Map<string, number>>(new Map());
  const [toast, setToast] = useState<ToastState>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] =
    useState<AgendaProviderBooking | null>(null);
  const [requestsBooking, setRequestsBooking] =
    useState<AgendaProviderBooking | null>(null);
  const [requestsRefreshKey, setRequestsRefreshKey] = useState(0);

  const refreshAppointment = useCallback(async (
    bookingId: number,
    includePayment = false,
    signal?: AbortSignal,
  ) => {
    const [updated, payment, refundResult] = await Promise.all([
      agendaBookingService.providerAppointment(bookingId, signal),
      includePayment
        ? agendaBookingService.providerBookingPayment(bookingId, signal)
        : Promise.resolve(undefined),
      agendaBookingService.providerBookingRefunds(bookingId, signal).then(
        (value) => ({ value, error: "" }),
        (error: unknown) => ({ value: null, error: error instanceof Error ? error.message : "No se pudieron consultar las devoluciones." }),
      ),
    ]);
    if (signal?.aborted) return;
    setAppointments((current) => {
      const index = current.findIndex((item) => item.id === bookingId);
      if (index === -1) return [updated, ...current];
      return current.map((item) => item.id === bookingId ? updated : item);
    });
    if (includePayment) {
      setPayments((current) => ({ ...current, [bookingId]: payment }));
    }
    const refreshedRefunds = refundResult.value;
    if (refreshedRefunds) setRefunds((current) => ({ ...current, [bookingId]: refreshedRefunds }));
    setRefundErrors((current) => ({ ...current, [bookingId]: refundResult.error }));
  }, []);

  const load = useCallback(async (signal?: AbortSignal, silent = false) => {
    if (!hasAccess) {
      if (!silent) setLoading(false);
      return;
    }

    if (!silent) setLoading(true);

    try {
      const [appointmentsData, servicesData] =
        await Promise.all([
          agendaBookingService.providerAppointments(
            undefined,
            signal,
          ),
          silent ? Promise.resolve(null) : agendaService.listServices(signal),
        ]);

      setAppointments(appointmentsData);
      if (servicesData) setServices(servicesData);
      if (!silent) setLoading(false);

      const paymentResults = await Promise.allSettled(
        appointmentsData.map(async (booking) => [
          booking.id,
          await agendaBookingService.providerBookingPayment(booking.id, signal),
        ] as const),
      );
      if (!signal?.aborted) {
        const paymentEntries = paymentResults
          .filter((result): result is PromiseFulfilledResult<readonly [number, AgendaBookingPayment | null]> => result.status === "fulfilled")
          .map((result) => result.value);
        setPayments((current) => silent
          ? { ...current, ...Object.fromEntries(paymentEntries) }
          : Object.fromEntries(paymentEntries));
      }
      const refundResults = await Promise.allSettled(
        appointmentsData.filter((booking) => booking.status === "cancelled").map(async (booking) => [booking.id, await agendaBookingService.providerBookingRefunds(booking.id, signal)] as const),
      );
      if (!signal?.aborted) {
        const entries = refundResults.filter((result): result is PromiseFulfilledResult<readonly [number, AgendaRefund[]]> => result.status === "fulfilled").map((result) => result.value);
        setRefunds((current) => ({ ...current, ...Object.fromEntries(entries) }));
      }
    } catch (error) {
      if (signal?.aborted) return;
      if (!silent) setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las citas.",
      });
    } finally {
      if (!signal?.aborted && !silent) setLoading(false);
    }
  }, [hasAccess]);

  const resyncAfterReconnect = useCallback(() => {
    void load(undefined, true);
  }, [load]);
  useInboxReconnect(inboxStatus, Boolean(token) && hasAccess, resyncAfterReconnect);

  useEffect(() => {
    if (accessLoading) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [accessLoading, load]);

  useEffect(() => {
    if (!token || !hasAccess || accessLoading) return;
    const controller = new AbortController();
    const unsubscribe = subscribeToInboxEvents((event) => {
      if (!isAgendaInboxEvent(event)) return;
      const eventKey = `${event.type}:${event.booking_id}`;
      const now = Date.now();
      if (now - (lastAgendaEvent.current.get(eventKey) ?? 0) < 500) return;
      lastAgendaEvent.current.set(eventKey, now);
      const includePayment = true;
      void refreshAppointment(event.booking_id, includePayment, controller.signal)
        .catch(() => { /* Una actualización posterior puede recuperar esta cita. */ });
      if (requestsBooking?.id === event.booking_id &&
          (event.type === "agenda.reschedule_requested" ||
           event.type === "agenda.reschedule_decided")) {
        setRequestsRefreshKey((current) => current + 1);
      }
    });
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [accessLoading, hasAccess, refreshAppointment, requestsBooking?.id, subscribeToInboxEvents, token]);

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
    setAppointments((current) =>
      current.map((item) =>
        item.id === updated.id ? updated : item,
      ),
    );
  };

  const showRequestsError = useCallback((message: string) => {
    setToast({ type: "error", message });
  }, []);

  const changeStatus = async (
    booking: AgendaProviderBooking,
    status: AgendaBookingStatus,
  ) => {
    if (status === "cancelled") { setCancelBooking(booking); setCancelReason(""); return; }
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
    try {
      const updated = await agendaBookingService.updateProviderStatus(bookingId, { status: "cancelled", cancellation_reason: cancelReason.trim(), provider_notes: cancelBooking.provider_notes });
      replaceAppointment(updated);
      setCancelBooking(null);
      setToast({ type: "success", message: "Reservación cancelada. Consulta el estado de la devolución." });
      void refreshAppointment(bookingId, true).catch(() => setToast({ type: "info", message: "Reservación cancelada. Usa Actualizar estado para consultar la devolución." }));
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "No se pudo cancelar la reservación." });
    } finally { setWorkingId(null); }
  };

  const submitRefundAction = async () => {
    if (!refundAction || refundWorking) return;
    if (refundAction.kind === "manual" && (reference.trim().length < 3 || reference.trim().length > 255)) return;
    setRefundWorking(true);
    try {
      const { booking, refund, kind } = refundAction;
      const updated = kind === "manual"
        ? await agendaBookingService.confirmManualRefund(booking.id, refund.id, reference.trim())
        : await agendaBookingService.retryRefund(booking.id, refund.id);
      setRefunds((current) => ({ ...current, [booking.id]: (current[booking.id] ?? []).map((item) => item.id === updated.id ? updated : item) }));
      setRefundAction(null);
      setReference("");
      setToast({ type: updated.status === "failed" ? "error" : "success", message: updated.status === "confirmed" ? "Devolución confirmada." : updated.status === "failed" ? "No se pudo completar el reembolso. Intenta nuevamente o revisa tu cuenta de Mercado Pago." : "La devolución sigue en proceso. Actualiza el estado para consultarla." });
      void refreshAppointment(booking.id, true).catch(() => setToast({ type: "info", message: "Operación registrada. Usa Actualizar estado para consultar el pago." }));
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "No se pudo completar la operación." });
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

  if (accessLoading || (hasAccess && loading)) {
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
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-4 py-3 font-semibold text-white hover:bg-[#117500]"
        >
          <Plus size={18} />
          Crear cita
        </button>
      </div>

      <PageHero
        eyebrow="Agenda"
        title="Citas"
        subtitle="Consulta, confirma, reprograma y administra las reservaciones de tus clientes."
      />

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

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center">
          <CalendarDays className="mx-auto text-[#168e00]" size={38} />
          <h2 className="mt-3 text-xl font-bold text-gray-900">
            No hay citas
          </h2>
          <p className="mt-1 text-gray-500">
            No encontramos reservaciones con este filtro.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((booking) => {
            const service = serviceMap.get(booking.service_id);
            const working = workingId === booking.id;

            return (
              <article
                key={booking.id}
                className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6"
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
                      {formatDateTime(booking.start_at)}
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

                <div className="mt-4">
                  <AgendaPaymentStatus
                    compact
                    payment={payments[booking.id]}
                    cancelled={booking.status === "cancelled"}
                    markingPaid={paymentWorkingId === booking.id}
                    onMarkPaid={() => void markCashPaymentPaid(booking.id)}
                  />
                </div>

                {booking.status === "cancelled" ? (
                  <div className="mt-4 space-y-3">
                    {refunds[booking.id]?.length ? (
                      <details className="rounded-2xl border border-gray-100 bg-[#f2f3f4] p-4" open>
                        <summary className="cursor-pointer font-bold text-[#004e28]">Devoluciones de esta reservación</summary>
                        <div className="mt-3 space-y-3">
                          {refunds[booking.id].map((refund) => (
                            <div key={refund.id}>
                              <AgendaRefundStatus refund={refund} compact />
                              {refund.status === "manual_pending" && refund.method === "cash" ? (
                                <button type="button" className="mt-2 rounded-xl bg-[#168e00] px-4 py-2 text-sm font-bold text-white focus-visible:outline-2" onClick={() => { setRefundAction({ booking, refund, kind: "manual" }); setReference(""); }}>Confirmar devolución</button>
                              ) : refund.method === "online" && (refund.status === "failed" || refund.status === "pending") ? (
                                <button type="button" className="mt-2 rounded-xl border border-[#168e00] px-4 py-2 text-sm font-bold text-[#168e00] focus-visible:outline-2" onClick={() => setRefundAction({ booking, refund, kind: "retry" })}>Reintentar reembolso</button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </details>
                    ) : null}
                    {refundErrors[booking.id] ? <p role="alert" className="text-sm text-amber-800">{refundErrors[booking.id]}</p> : null}
                    <button type="button" className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-[#004e28]" onClick={() => void refreshAppointment(booking.id, true).catch((error: unknown) => setRefundErrors((current) => ({ ...current, [booking.id]: error instanceof Error ? error.message : "No se pudo actualizar el estado." })))}>Actualizar estado</button>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
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

                  {(booking.status === "pending" ||
                    booking.status === "confirmed") ? (
                    <SecondaryButton
                      disabled={working}
                      onClick={() => setRescheduleBooking(booking)}
                      label="Reprogramar"
                      icon={<RefreshCw size={16} />}
                    />
                  ) : null}

                  <SecondaryButton
                    disabled={working}
                    onClick={() => setRequestsBooking(booking)}
                    label="Solicitudes de cambio"
                    icon={<CalendarClock size={16} />}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AgendaModalShell open={Boolean(cancelBooking)} title="Cancelar reservación" saving={workingId !== null} cancelLabel="Volver" submitDisabled={!cancelReason.trim()} submitLabel="Confirmar cancelación" onClose={() => setCancelBooking(null)} onSubmit={(event) => { event.preventDefault(); void confirmCancellation(); }}>
        {cancelBooking ? <>
          <div className="space-y-1 rounded-2xl bg-[#f2f3f4] p-4 text-sm">
            <p><strong>Cliente:</strong> {cancelBooking.customer_name}</p>
            <p><strong>Servicio:</strong> {serviceMap.get(cancelBooking.service_id)?.name ?? `Servicio #${cancelBooking.service_id}`}</p>
            <p><strong>Fecha:</strong> {formatDateTime(cancelBooking.start_at)}</p>
            <p><strong>Pago:</strong> {payments[cancelBooking.id]?.payment_status ?? "Sin pago"}</p>
            {payments[cancelBooking.id]?.payment_status === "paid" ? <p><strong>Importe pagado:</strong> {payments[cancelBooking.id]?.amount} MXN</p> : null}
          </div>
          <p className="text-sm text-gray-700">{payments[cancelBooking.id]?.payment_status === "paid" && payments[cancelBooking.id]?.payment_method === "online" ? "Al cancelar esta reservación, se gestionará el reembolso completo del pago realizado por el cliente." : payments[cancelBooking.id]?.payment_status === "paid" && payments[cancelBooking.id]?.payment_method === "cash" ? "Deberás confirmar posteriormente la devolución del dinero recibido." : "La reservación se cancelará sin generar una devolución."}</p>
          <label className="block text-sm font-semibold">Motivo de cancelación *
            <textarea required maxLength={5000} rows={4} className={`${inputClass} mt-2`} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Explica el motivo real de la cancelación" />
          </label>
        </> : null}
      </AgendaModalShell>

      <AgendaModalShell open={Boolean(refundAction)} title={refundAction?.kind === "manual" ? "Confirmar devolución al cliente" : "Reintentar devolución"} saving={refundWorking} cancelLabel="Volver" submitDisabled={refundAction?.kind === "manual" && (reference.trim().length < 3 || reference.trim().length > 255)} submitLabel={refundAction?.kind === "manual" ? "Confirmar devolución" : "Reintentar reembolso"} onClose={() => setRefundAction(null)} onSubmit={(event) => { event.preventDefault(); void submitRefundAction(); }}>
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
      </AgendaModalShell>

      <ProviderCreateModal
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
          setToast({
            type: "success",
            message: "Cita creada.",
          });
        }}
        onError={(message) =>
          setToast({ type: "error", message })
        }
      />

      <ProviderRescheduleModal
        booking={rescheduleBooking}
        service={rescheduleBooking
          ? serviceMap.get(rescheduleBooking.service_id) || null
          : null}
        onClose={() => setRescheduleBooking(null)}
        onUpdated={(updated) => {
          replaceAppointment(updated);
          setRescheduleBooking(null);
          setToast({
            type: "success",
            message: "Cita reprogramada.",
          });
        }}
        onError={(message) =>
          setToast({ type: "error", message })
        }
      />

      <RequestsModal
        booking={requestsBooking}
        refreshKey={requestsRefreshKey}
        onClose={() => setRequestsBooking(null)}
        onDecision={() => {
          if (requestsBooking) void refreshAppointment(requestsBooking.id)
            .catch(() => { /* El siguiente evento puede actualizar la cita. */ });
        }}
        onError={showRequestsError}
      />

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
    <div className="rounded-2xl bg-gray-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-1 font-semibold text-gray-700">
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

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[30000] overflow-y-auto bg-black/40 p-4">
      <div className="mx-auto my-8 max-w-2xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <h2 className="text-xl font-bold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 p-2 text-gray-500"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ProviderCreateModal({
  open,
  services,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  services: AgendaService[];
  onClose: () => void;
  onCreated: (booking: AgendaProviderBooking) => void;
  onError: (message: string) => void;
}) {
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [date, setDate] = useState(localDateInput());
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
    if (!serviceId || !slot || !name.trim()) {
      onError("Completa servicio, horario y nombre.");
      return;
    }

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
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Crear cita" onClose={onClose}>
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
            min={localDateInput()}
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
  onClose,
  onUpdated,
  onError,
}: {
  booking: AgendaProviderBooking | null;
  service: AgendaService | null;
  onClose: () => void;
  onUpdated: (booking: AgendaProviderBooking) => void;
  onError: (message: string) => void;
}) {
  const [date, setDate] = useState(localDateInput());
  const [availability, setAvailability] =
    useState<AgendaAvailability | null>(null);
  const [slot, setSlot] =
    useState<AgendaAvailabilitySlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
    if (!slot) return;

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
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={`Reprogramar cita #${booking.id}`}
      onClose={onClose}
    >
      <div className="space-y-5">
        <label>
          <span className="mb-1.5 block text-sm font-semibold text-gray-700">
            Nueva fecha
          </span>
          <input
            type="date"
            min={localDateInput()}
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

function RequestsModal({
  booking,
  refreshKey,
  onClose,
  onDecision,
  onError,
}: {
  booking: AgendaProviderBooking | null;
  refreshKey: number;
  onClose: () => void;
  onDecision: () => void;
  onError: (message: string) => void;
}) {
  const [requests, setRequests] = useState<AgendaRescheduleRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const loadedBookingId = useRef<number | null>(null);
  const bookingId = booking?.id;

  useEffect(() => {
    if (!bookingId) return;

    const controller = new AbortController();

    const run = async () => {
      if (loadedBookingId.current !== bookingId) setLoading(true);

      try {
        const data =
          await agendaBookingService.rescheduleRequests(
            bookingId,
            controller.signal,
          );
        if (!controller.signal.aborted) {
          loadedBookingId.current = bookingId;
          setRequests(data);
        }
      } catch (error) {
        if (!controller.signal.aborted && loadedBookingId.current !== bookingId) {
          onError(error instanceof Error ? error.message : "No se pudieron cargar las solicitudes.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void run();

    return () => controller.abort();
  }, [bookingId, onError, refreshKey]);

  if (!booking) return null;

  const decide = async (
    request: AgendaRescheduleRequest,
    approve: boolean,
  ) => {
    const responseNote = window.prompt(
      approve
        ? "Mensaje para el cliente (opcional):"
        : "Motivo del rechazo (opcional):",
      "",
    );

    if (responseNote === null) return;

    setWorkingId(request.id);

    try {
      const updated =
        await agendaBookingService.decideReschedule(
          booking.id,
          request.id,
          {
            approve,
            response_note: responseNote.trim() || null,
          },
        );

      setRequests((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      );

      onDecision();
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "No se pudo responder la solicitud.",
      );
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <ModalShell
      title={`Solicitudes de cambio · Cita #${booking.id}`}
      onClose={onClose}
    >
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-[#168e00]" size={28} />
        </div>
      ) : requests.length === 0 ? (
        <p className="rounded-2xl bg-gray-50 p-5 text-center text-gray-500">
          Esta cita no tiene solicitudes de reprogramación.
        </p>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="rounded-2xl border border-gray-200 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-gray-900">
                    {formatDateTime(request.requested_start_at)}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {request.reason || "Sin motivo"}
                  </p>
                  {request.response_note ? (
                    <p className="mt-2 text-sm text-gray-600">
                      Respuesta: {request.response_note}
                    </p>
                  ) : null}
                </div>

                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
                  {request.status === "pending"
                    ? "Pendiente"
                    : request.status === "approved"
                      ? "Aprobada"
                      : request.status === "rejected"
                        ? "Rechazada"
                        : "Cancelada"}
                </span>
              </div>

              {request.status === "pending" ? (
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={workingId === request.id}
                    onClick={() => void decide(request, true)}
                    className="rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Aprobar
                  </button>
                  <button
                    type="button"
                    disabled={workingId === request.id}
                    onClick={() => void decide(request, false)}
                    className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-50"
                  >
                    Rechazar
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
