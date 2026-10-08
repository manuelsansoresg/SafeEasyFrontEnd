"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  CalendarClock,
  CalendarDays,
  Clock3,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AgendaPaymentStatus from "@/components/agenda/AgendaPaymentStatus";
import AgendaRefundStatus from "@/components/agenda/AgendaRefundStatus";
import AgendaModalShell from "@/components/agenda/AgendaModalShell";
import {
  canStillCancel,
  humanizeMinutes,
} from "@/lib/agendaTime";
import { didAgendaRefundConfirm, getAgendaPaymentNotice, hasProcessingAgendaRefund } from "@/lib/agendaRefundPresentation";
import { isExpectedAbort } from "@/lib/agendaRequest";
import {
  getCurrentPathWithSearch,
  getLoginUrl,
} from "@/lib/authRedirect";
import { agendaBookingService } from "@/services/agendaBookingService";
import { useChatInboxWebSocket } from "@/hooks/useChatWebSocket";
import { useInboxReconnect } from "@/hooks/useInboxReconnect";
import { useAuthHydrated, useAuthStore } from "@/store/useAuthStore";
import { useChatStore } from "@/store/useChatStore";
import { isAgendaInboxEvent } from "@/types/chat";
import type { AgendaService } from "@/types/agenda";
import type {
  AgendaAvailability,
  AgendaAvailabilitySlot,
  AgendaBooking,
  AgendaBookingPayment,
  AgendaRefund,
} from "@/types/agendaBooking";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";
const detailsUnavailableMessage =
  "Tu reservación existe, pero no pudimos actualizar algunos detalles. Puedes intentarlo nuevamente.";

function statusLabel(status: AgendaBooking["status"]) {
  return {
    pending: "Pendiente",
    confirmed: "Confirmada",
    completed: "Completada",
    cancelled: "Cancelada",
    no_show: "No asistió",
  }[status];
}

function statusClass(status: AgendaBooking["status"]) {
  if (status === "confirmed") {
    return "bg-green-50 text-green-700";
  }

  if (status === "pending") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "cancelled" || status === "no_show") {
    return "bg-red-50 text-red-700";
  }

  return "bg-blue-50 text-blue-700";
}

function dateInputToday() {
  const now = new Date();
  const local = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000,
  );

  return local.toISOString().slice(0, 10);
}

function formatDateTime(
  iso: string,
  timezone?: string,
) {
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "full",
    timeStyle: "short",
  };

  if (timezone) options.timeZone = timezone;

  return new Intl.DateTimeFormat(
    "es-MX",
    options,
  ).format(new Date(iso));
}

function formatSlot(
  iso: string,
  timezone: string,
) {
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function localDateForIso(
  iso: string,
  timezone: string,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));

  const year = parts.find((item) => item.type === "year")?.value;
  const month = parts.find((item) => item.type === "month")?.value;
  const day = parts.find((item) => item.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

export default function AgendaBookingManagementPage() {
  const params = useParams<{ bookingId: string }>();
  const searchParams = useSearchParams();
  const hydrated = useAuthHydrated();
  const auth = useAuthStore();

  const bookingId = Number(params.bookingId);
  const tokenFromUrl =
    searchParams.get("management_token") || "";
  const paymentReturn = searchParams.get("payment");

  const [managementToken, setManagementToken] =
    useState(tokenFromUrl);
  const [tokenReadyFor, setTokenReadyFor] = useState<string | null>(null);
  const tokenResolutionKey = `${bookingId}:${tokenFromUrl}`;
  const subscribeToInboxEvents = useChatStore((state) => state.subscribeToInboxEvents);
  const lastAgendaEvent = useRef<Map<string, number>>(new Map());
  const loadSequence = useRef(0);
  const registeredRefreshSequence = useRef(0);
  const loadedBookingKey = useRef<string | null>(null);
  const registeredClient = hydrated && auth.isAuthenticated && !managementToken;
  const { status: inboxStatus } = useChatInboxWebSocket(registeredClient);

  const [booking, setBooking] =
    useState<AgendaBooking | null>(null);
  const [service, setService] =
    useState<AgendaService | null>(null);
  const [rules, setRules] =
    useState<AgendaAvailability | null>(null);
  const [timezone, setTimezone] =
    useState<string | undefined>();
  const [payment, setPayment] =
    useState<AgendaBookingPayment | null | undefined>(undefined);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [refunds, setRefunds] = useState<AgendaRefund[]>([]);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [success, setSuccess] =
    useState<string | null>(null);
  const [loadRefresh, setLoadRefresh] = useState(0);

  const [cancelReason, setCancelReason] = useState("");

  const [rescheduleOpen, setRescheduleOpen] =
    useState(false);
  const [rescheduleDate, setRescheduleDate] =
    useState(dateInputToday());
  const [availability, setAvailability] =
    useState<AgendaAvailability | null>(null);
  const [selectedSlot, setSelectedSlot] =
    useState<AgendaAvailabilitySlot | null>(null);
  const [rescheduleReason, setRescheduleReason] =
    useState("");
  const [loadingSlots, setLoadingSlots] =
    useState(false);

  const isActive = useMemo(
    () =>
      booking?.status === "pending" ||
      booking?.status === "confirmed",
    [booking],
  );

  const cancellationAllowed = booking?.cancellation_allowed_snapshot ?? rules?.allow_customer_cancellation ?? true;
  const noticeHours = booking?.cancellation_notice_hours_snapshot ?? rules?.cancellation_notice_hours;
  const deadline = booking?.cancellation_deadline_at ?? (booking && noticeHours !== undefined
    ? new Date(new Date(booking.start_at).getTime() - noticeHours * 3600000).toISOString()
    : null);
  const cancellationPolicy = !cancellationAllowed
    ? "Este negocio no permite cancelar reservaciones desde la plataforma."
    : deadline
      ? `Puedes cancelar hasta el ${formatDateTime(deadline, timezone)}.`
      : "La cancelación está sujeta a las condiciones aceptadas al reservar.";

  const cancellationWithinTime =
    !booking ||
    (deadline ? Date.now() <= new Date(deadline).getTime() : !rules || canStillCancel(
      booking.start_at,
      booking.cancellation_notice_hours_snapshot ?? rules.cancellation_notice_hours,
    ));

  const canCancel =
    isActive &&
    cancellationAllowed &&
    cancellationWithinTime;

  const pendingRefund = hasProcessingAgendaRefund(refunds);
  const paymentNotice = booking
    ? getAgendaPaymentNotice(booking.status, payment?.payment_status, refunds, Boolean(paymentReturn))
    : null;

  const rescheduleAllowed =
    !rules || rules.allow_reschedule_requests;

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;

    if (tokenFromUrl) {
      window.localStorage.setItem(
        `agenda-management-${bookingId}`,
        tokenFromUrl,
      );
      setManagementToken(tokenFromUrl);
      setTokenReadyFor(tokenResolutionKey);
      return;
    }

    const stored = window.localStorage.getItem(
      `agenda-management-${bookingId}`,
    );

    setManagementToken(stored || "");
    setTokenReadyFor(tokenResolutionKey);
  }, [bookingId, hydrated, tokenFromUrl, tokenResolutionKey]);

  useEffect(() => {
    if (!hydrated || tokenReadyFor !== tokenResolutionKey) return;

    const controller = new AbortController();
    const sequence = ++loadSequence.current;
    const isCurrent = () => !controller.signal.aborted && sequence === loadSequence.current;
    const requestKey = managementToken
      ? `${bookingId}:guest:${managementToken}`
      : `${bookingId}:user:${auth.user?.id ?? "none"}`;

    const run = async () => {
      setLoading(loadedBookingKey.current !== requestKey);
      setError(null);
      if (loadedBookingKey.current !== requestKey) {
        setBooking(null);
        setService(null);
        setRefunds([]);
      }

      try {
        let data: AgendaBooking | null = null;

        if (managementToken) {
          data =
            await agendaBookingService.getGuestBooking(
              bookingId,
              managementToken,
              controller.signal,
            );
        } else if (auth.isAuthenticated) {
          const mine =
            await agendaBookingService.myBookings(
              undefined,
              controller.signal,
            );

          data =
            mine.find((item) => item.id === bookingId) ||
            null;

          if (!data) {
            throw new Error(
              "No encontramos esta cita entre tus reservaciones.",
            );
          }
        } else {
          throw new Error(
            "Necesitas el enlace de administración enviado por correo o iniciar sesión.",
          );
        }

        if (!isCurrent()) return;
        loadedBookingKey.current = requestKey;
        setBooking(data);

        let found: AgendaService | null = null;
        try {
          const services = await agendaBookingService.listPublicServices(
            data.supplier_id,
            controller.signal,
          );
          if (!isCurrent()) return;
          found = services.find((item) => item.id === data?.service_id) || null;
          setService(found);
        } catch (serviceError) {
          if (!isExpectedAbort(serviceError, controller.signal) && isCurrent()) {
            setError(detailsUnavailableMessage);
          }
        }

        if (found) {
          try {
            const currentDate = dateInputToday();

            const availabilityData =
              await agendaBookingService.availability(
                data.supplier_id,
                data.service_id,
                currentDate,
                currentDate,
                controller.signal,
              );

            if (!isCurrent()) return;
            setRules(availabilityData);
            setTimezone(
              availabilityData.timezone,
            );

            setRescheduleDate(
              localDateForIso(
                data.start_at,
                availabilityData.timezone,
              ),
            );
          } catch {
            // La cita se sigue mostrando aunque la configuración pública
            // no pueda recuperarse temporalmente.
          }
        }

        try {
          const paymentData = await agendaBookingService.getBookingPayment(
            bookingId,
            managementToken || null,
            controller.signal,
          );
          if (!isCurrent()) return;
          setPayment(paymentData);
          setPaymentError(null);
        } catch (paymentRequestError) {
          if (isExpectedAbort(paymentRequestError, controller.signal) || !isCurrent()) return;
          setPaymentError(
            paymentRequestError instanceof Error
              ? paymentRequestError.message
              : "No se pudo consultar el estado del pago.",
          );
        }
        try {
          const nextRefunds = await agendaBookingService.getBookingRefunds(bookingId, managementToken || null, controller.signal);
          if (!isCurrent()) return;
          setRefunds(nextRefunds);
          setRefundError(null);
        } catch (refundRequestError) {
          if (isExpectedAbort(refundRequestError, controller.signal) || !isCurrent()) return;
          setRefundError(refundRequestError instanceof Error ? refundRequestError.message : "No se pudieron consultar las devoluciones.");
        }
      } catch (err) {
        if (isExpectedAbort(err, controller.signal) || !isCurrent()) return;
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar la cita.",
        );
      } finally {
        if (isCurrent()) setLoading(false);
      }
    };

    void run();

    return () => {
      controller.abort();
      loadSequence.current += 1;
    };
  }, [
    auth.isAuthenticated,
    auth.user?.id,
    bookingId,
    hydrated,
    managementToken,
    loadRefresh,
    tokenReadyFor,
    tokenResolutionKey,
  ]);

  const refreshRegisteredBooking = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++registeredRefreshSequence.current;
    try {
      const [mine, paymentResult, refundResult] = await Promise.all([
        agendaBookingService.myBookings(undefined, signal),
        agendaBookingService.getBookingPayment(bookingId, null, signal).then(
          (value) => ({ value, error: "" }),
          (error: unknown) => ({ value: null, error: error instanceof Error ? error.message : "No se pudo consultar el pago." }),
        ),
        agendaBookingService.getBookingRefunds(bookingId, null, signal).then(
          (value) => ({ value, error: "" }),
          (error: unknown) => ({ value: null, error: error instanceof Error ? error.message : "No se pudieron consultar las devoluciones." }),
        ),
      ]);
      if (signal?.aborted || sequence !== registeredRefreshSequence.current) return;
      const updated = mine.find((item) => item.id === bookingId);
      if (updated) setBooking(updated);
      if (!paymentResult.error) setPayment(paymentResult.value);
      if (!isExpectedAbort(paymentResult.error, signal)) setPaymentError(paymentResult.error || null);
      if (refundResult.value) setRefunds(refundResult.value);
      if (!isExpectedAbort(refundResult.error, signal)) setRefundError(refundResult.error || null);
    } catch {
      // Una actualización automática fallida no interrumpe la gestión de la cita.
    }
  }, [bookingId]);

  const refreshFinancials = useCallback(async () => {
    if (!booking) return;
    const results = await Promise.allSettled([
      agendaBookingService.getBookingPayment(booking.id, managementToken || null),
      agendaBookingService.getBookingRefunds(booking.id, managementToken || null),
    ]);
    if (results[0].status === "fulfilled") { setPayment(results[0].value); setPaymentError(null); }
    else setPaymentError(results[0].reason instanceof Error ? results[0].reason.message : "No se pudo consultar el pago.");
    if (results[1].status === "fulfilled") { setRefunds(results[1].value); setRefundError(null); }
    else setRefundError(results[1].reason instanceof Error ? results[1].reason.message : "No se pudieron consultar las devoluciones.");
  }, [booking, managementToken]);

  const resyncAfterReconnect = useCallback(() => {
    void refreshRegisteredBooking();
  }, [refreshRegisteredBooking]);
  useInboxReconnect(inboxStatus, registeredClient, resyncAfterReconnect);

  useEffect(() => {
    if (!registeredClient || !Number.isFinite(bookingId)) return;
    const controller = new AbortController();
    const unsubscribe = subscribeToInboxEvents((event) => {
      if (!isAgendaInboxEvent(event) || event.booking_id !== bookingId) return;
      const now = Date.now();
      if (now - (lastAgendaEvent.current.get(event.type) ?? 0) < 500) return;
      lastAgendaEvent.current.set(event.type, now);
      void refreshRegisteredBooking(controller.signal);
    });
    return () => {
      controller.abort();
      registeredRefreshSequence.current += 1;
      unsubscribe();
    };
  }, [bookingId, refreshRegisteredBooking, registeredClient, subscribeToInboxEvents]);

  useEffect(() => {
    if (
      registeredClient ||
      !booking ||
      booking.status === "cancelled" ||
      payment?.payment_method !== "online" ||
      payment.payment_status !== "pending"
    ) {
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      try {
        const updated = await agendaBookingService.getBookingPayment(
          booking.id,
          managementToken || null,
        );
        if (!cancelled && updated) {
          setPayment(updated);
          setPaymentError(null);
        }
      } catch (paymentRequestError) {
        if (!cancelled) {
          setPaymentError(
            paymentRequestError instanceof Error
              ? paymentRequestError.message
              : "No se pudo actualizar el estado del pago.",
          );
        }
      }
    };

    const intervalId = window.setInterval(() => void refresh(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [booking, managementToken, payment?.payment_method, payment?.payment_status, registeredClient]);

  useEffect(() => {
    if (!managementToken || registeredClient || booking?.id !== bookingId || !pendingRefund) return;

    let active = true;
    let inFlight = false;
    let failures = 0;
    let stopped = false;
    let timer: number | undefined;
    let requestController: AbortController | null = null;

    const schedule = (delay: number) => {
      if (active && !stopped && document.visibilityState === "visible" && failures < 3) {
        timer = window.setTimeout(() => void poll(), delay);
      }
    };

    const poll = async () => {
      if (!active || inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      requestController = new AbortController();
      const signal = requestController.signal;
      let continuePolling = true;

      try {
        const updatedRefunds = await agendaBookingService.getBookingRefunds(bookingId, managementToken, signal);
        if (!active || signal.aborted) return;

        const newlyConfirmed = didAgendaRefundConfirm(refunds, updatedRefunds);
        if (newlyConfirmed) {
          try {
            const updatedPayment = await agendaBookingService.getBookingPayment(bookingId, managementToken, signal);
            if (active && !signal.aborted) { setPayment(updatedPayment); setPaymentError(null); }
          } catch (paymentRequestError) {
            if (active && !signal.aborted) setPaymentError(paymentRequestError instanceof Error ? paymentRequestError.message : "No se pudo actualizar el pago.");
          }
        }

        if (!active || signal.aborted) return;
        setRefunds(updatedRefunds);
        setRefundError(null);
        failures = 0;
        continuePolling = hasProcessingAgendaRefund(updatedRefunds);
        if (!continuePolling) stopped = true;
      } catch (refundRequestError) {
        if (!active || signal.aborted) return;
        failures += 1;
        setRefundError(refundRequestError instanceof Error ? refundRequestError.message : "No se pudo actualizar la devolución.");
        if (typeof refundRequestError === "object" && refundRequestError !== null && "status" in refundRequestError &&
          (refundRequestError.status === 401 || refundRequestError.status === 403)) {
          continuePolling = false;
          stopped = true;
        }
      } finally {
        inFlight = false;
        requestController = null;
        if (continuePolling) schedule(10000);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (timer !== undefined) window.clearTimeout(timer);
        requestController?.abort();
      } else if (active && !stopped && !inFlight) {
        if (timer !== undefined) window.clearTimeout(timer);
        schedule(0);
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    schedule(10000);
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
      requestController?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [booking?.id, bookingId, managementToken, pendingRefund, refunds, registeredClient]);

  useEffect(() => {
    if (
      !rescheduleOpen ||
      !booking ||
      !rescheduleDate
    ) {
      return;
    }

    const controller = new AbortController();

    const run = async () => {
      setLoadingSlots(true);
      setSelectedSlot(null);
      setError(null);

      try {
        const data =
          await agendaBookingService.availability(
            booking.supplier_id,
            booking.service_id,
            rescheduleDate,
            rescheduleDate,
            controller.signal,
          );

        setAvailability(data);
        setRules(data);
        setTimezone(data.timezone);
      } catch (err) {
        if (isExpectedAbort(err, controller.signal)) return;
        setAvailability(null);
        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron consultar los horarios.",
        );
      } finally {
        setLoadingSlots(false);
      }
    };

    void run();

    return () => controller.abort();
  }, [
    booking,
    rescheduleDate,
    rescheduleOpen,
  ]);

  const cancel = async () => {
    if (!booking) return;

    if (!cancellationAllowed) {
      setCancelError(
        "Este negocio no permite que el cliente cancele la cita.",
      );
      return;
    }

    if (!cancellationWithinTime) {
      setCancelError("El plazo para cancelar esta reservación ya terminó.");
      return;
    }

    setWorking(true);
    setCancelError(null);
    setSuccess(null);

    try {
      const updated =
        await agendaBookingService.cancelBooking(
          booking.id,
          {
            reason:
              cancelReason.trim() || null,
            management_token:
              managementToken || null,
          },
        );

      setBooking(updated);
      setCancelOpen(false);
      await refreshFinancials();
      setSuccess("La reservación fue cancelada. Consulta el estado de la devolución abajo.");
    } catch (err) {
      setCancelError(
        err instanceof Error
          ? err.message
          : "No se pudo cancelar la reservación. Intenta nuevamente.",
      );
    } finally {
      setWorking(false);
    }
  };

  const requestReschedule = async () => {
    if (!booking || !selectedSlot) {
      setError("Selecciona un nuevo horario.");
      return;
    }

    if (!rescheduleAllowed && rules) {
      setError(
        "Este negocio no permite solicitar cambios de fecha u hora.",
      );
      return;
    }

    setWorking(true);
    setError(null);
    setSuccess(null);

    try {
      await agendaBookingService.requestReschedule(
        booking.id,
        {
          requested_start_at:
            selectedSlot.start_at,
          reason:
            rescheduleReason.trim() || null,
          management_token:
            managementToken || null,
        },
      );

      setSuccess(
        "Solicitud enviada. El negocio debe aprobar o rechazar el cambio.",
      );
      setRescheduleOpen(false);
      setSelectedSlot(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo solicitar el cambio.",
      );
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2
          className="animate-spin text-[#168e00]"
          size={36}
        />
      </div>
    );
  }

  if (!booking) {
    return (
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:pb-12 sm:pt-32">
        <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <XCircle
            className="mx-auto text-red-500"
            size={42}
          />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            No pudimos abrir esta cita
          </h1>
          <p className="mt-2 text-gray-500">
            {error ||
              "Verifica el enlace recibido por correo."}
          </p>

          {!auth.isAuthenticated ? (
            <Link
              href={getLoginUrl(
                getCurrentPathWithSearch(
                  `/agenda/bookings/${params.bookingId}`,
                  searchParams,
                ),
              )}
              className="mt-5 inline-flex rounded-xl bg-[#168e00] px-5 py-3 font-semibold text-white"
            >
              Iniciar sesión
            </Link>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 pb-24 pt-28 sm:pb-12 sm:pt-32">
      <section className="rounded-3xl bg-[#004e28] p-6 text-white sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white/70">
              Cita #{booking.id}
            </p>
            <h1 className="mt-1 break-words text-3xl font-bold">
              {service?.name || "Tu cita"}
            </h1>
            <p className="mt-2 text-white/80">
              {formatDateTime(
                booking.start_at,
                timezone,
              )}
            </p>
          </div>

          <span
            className={`shrink-0 self-start rounded-full px-3 py-1.5 text-sm font-bold ${statusClass(
              booking.status,
            )}`}
          >
            {statusLabel(booking.status)}
          </span>
        </div>
      </section>

      {paymentNotice ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${paymentNotice.classes}`}
          role="status"
        >
          {paymentNotice.message}
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
          {error === detailsUnavailableMessage ? (
            <button
              type="button"
              onClick={() => setLoadRefresh((current) => current + 1)}
              className="ml-2 font-bold underline underline-offset-2"
            >
              Volver a consultar
            </button>
          ) : null}
        </div>
      ) : null}

      {success ? (
        <div role="status" className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {success}
        </div>
      ) : null}

      {booking && isActive ? (
        <section className="rounded-3xl border border-[#168e00]/15 bg-[#168e00]/5 p-5">
          <div className="flex items-start gap-3">
            <Info
              className="mt-0.5 shrink-0 text-[#168e00]"
              size={20}
            />
            <div className="space-y-1 text-sm text-gray-700">
              <p className="font-bold text-[#004e28]">
                Reglas para administrar esta cita
              </p>

              <p>{cancellationWithinTime ? cancellationPolicy : "El plazo para cancelar esta reservación ya terminó."}</p>

              {rules?.allow_reschedule_requests ? (
                <p>
                  Los nuevos horarios disponibles respetan una
                  anticipación mínima de{" "}
                  <strong>
                    {humanizeMinutes(
                      rules.minimum_notice_minutes,
                    )}
                  </strong>
                  .
                </p>
              ) : (
                <p>
                  Este negocio no permite solicitudes de cambio de
                  horario.
                </p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold text-gray-900">
          Detalles de la cita
        </h2>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <DetailInfo
            label="Servicio"
            value={service?.name || `Servicio #${booking.service_id}`}
          />
          <DetailInfo
            label="Fecha y hora"
            value={formatDateTime(
              booking.start_at,
              timezone,
            )}
          />
          <DetailInfo
            label="Nombre"
            value={booking.customer_name}
          />
          <DetailInfo
            label="Correo"
            value={booking.customer_email || "No registrado"}
          />
          <DetailInfo
            label="Teléfono"
            value={booking.customer_phone || "No registrado"}
          />
          <DetailInfo
            label="Estado"
            value={statusLabel(booking.status)}
          />
        </div>

        {booking.notes ? (
          <div className="mt-5 rounded-2xl bg-gray-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
              Nota
            </p>
            <p className="mt-1 text-gray-700">
              {booking.notes}
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold text-gray-900">Pago</h2>
        {paymentError ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {paymentError}
            <button
              type="button"
              onClick={() => void refreshFinancials()}
              className="ml-2 font-bold underline underline-offset-2"
            >
              Volver a consultar
            </button>
          </p>
        ) : null}
        <div className="mt-4">
          <AgendaPaymentStatus payment={payment} cancelled={booking.status === "cancelled"} primaryRefundConfirmed={refunds.some((refund) => refund.refund_type === "primary" && refund.status === "confirmed")} />
        </div>
      </section>

      {(refunds.length > 0 || refundError || booking.status === "cancelled") ? (
        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-[#004e28]">Devoluciones de esta reservación</h2>
            <button type="button" onClick={() => void refreshFinancials()} className="rounded-xl border border-[#168e00] px-3 py-2 text-sm font-semibold text-[#168e00] focus-visible:outline-2">Actualizar estado</button>
          </div>
          {refundError ? <p role="alert" className="mt-3 text-sm text-amber-800">{refundError}</p> : null}
          {refunds.length ? <div className="mt-4 grid gap-3">{refunds.map((refund) => <AgendaRefundStatus key={refund.id} refund={refund} />)}</div>
            : !refundError ? <p className="mt-3 text-sm text-gray-600">No hay devoluciones registradas.</p> : null}
        </section>
      ) : null}

      {isActive ? (
        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-bold text-gray-900">
            Administrar cita
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div
              className={
                rescheduleAllowed
                  ? "rounded-2xl border border-gray-200 p-4"
                  : "rounded-2xl border border-gray-200 bg-gray-50 p-4 opacity-70"
              }
            >
              <div className="flex items-center gap-2">
                <RefreshCw
                  size={18}
                  className="text-[#168e00]"
                />
                <h3 className="font-bold text-gray-900">
                  Cambiar fecha u hora
                </h3>
              </div>

              <p className="mt-2 text-sm text-gray-500">
                {rescheduleAllowed
                  ? "Puedes solicitar otro horario. El negocio debe aprobar el cambio."
                  : "Este negocio no permite solicitudes de cambio de horario."}
              </p>

              <button
                type="button"
                disabled={!rescheduleAllowed}
                onClick={() =>
                  setRescheduleOpen(
                    (current) => !current,
                  )
                }
                className="mt-4 rounded-xl border border-[#168e00] px-4 py-2.5 font-semibold text-[#168e00] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Solicitar cambio
              </button>
            </div>

            <div
              className={
                canCancel
                  ? "rounded-2xl border border-red-100 p-4"
                  : "rounded-2xl border border-red-100 bg-red-50/40 p-4"
              }
            >
              <div className="flex items-center gap-2">
                <XCircle
                  size={18}
                  className="text-red-600"
                />
                <h3 className="font-bold text-gray-900">
                  Cancelar cita
                </h3>
              </div>

              {!cancellationAllowed ? (
                <div className="mt-3 flex items-start gap-2 text-sm text-red-700">
                  <ShieldAlert
                    className="mt-0.5 shrink-0"
                    size={17}
                  />
                  Este negocio no permite cancelar reservaciones desde la plataforma.
                </div>
              ) : !cancellationWithinTime ? (
                <div className="mt-3 flex items-start gap-2 text-sm text-red-700">
                  <ShieldAlert
                    className="mt-0.5 shrink-0"
                    size={17}
                  />
                  <span>
                    El plazo para cancelar esta reservación ya terminó.
                  </span>
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  {cancellationPolicy}
                </p>
              )}

              <button
                type="button"
                disabled={working || !canCancel}
                onClick={() => { setCancelError(null); setCancelOpen(true); }}
                className="mt-3 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Cancelar cita
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {rescheduleOpen && booking && rescheduleAllowed ? (
        <section className="rounded-3xl border border-[#168e00]/20 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            <CalendarClock
              className="text-[#168e00]"
              size={22}
            />
            <h2 className="text-xl font-bold text-gray-900">
              Solicitar nuevo horario
            </h2>
          </div>

          {rules ? (
            <p className="mt-2 text-sm text-gray-500">
              Los horarios mostrados respetan la anticipación mínima de{" "}
              <strong>
                {humanizeMinutes(
                  rules.minimum_notice_minutes,
                )}
              </strong>
              .
            </p>
          ) : null}

          <div className="mt-5 max-w-sm">
            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                Nueva fecha
              </span>
              <input
                type="date"
                min={dateInputToday()}
                className={inputClass}
                value={rescheduleDate}
                onChange={(event) =>
                  setRescheduleDate(
                    event.target.value,
                  )
                }
              />
            </label>
          </div>

          <div className="mt-5">
            {loadingSlots ? (
              <div className="flex items-center gap-2 py-4 text-gray-500">
                <Loader2
                  size={18}
                  className="animate-spin"
                />
                Consultando horarios...
              </div>
            ) : availability?.slots.length ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {availability.slots.map((slot) => {
                  const selected =
                    selectedSlot?.start_at ===
                    slot.start_at;

                  return (
                    <button
                      key={slot.start_at}
                      type="button"
                      onClick={() =>
                        setSelectedSlot(slot)
                      }
                      className={
                        selected
                          ? "inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-3 py-3 font-semibold text-white"
                          : "inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-3 font-semibold text-gray-700 hover:border-[#168e00] hover:text-[#168e00]"
                      }
                    >
                      <Clock3 size={16} />
                      {formatSlot(
                        slot.start_at,
                        availability.timezone,
                      )}
                    </button>
                  );
                })}
              </div>
            ) : availability ? (
              <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600">
                No hay horarios disponibles para esta fecha.
                {availability.minimum_notice_minutes > 0 ? (
                  <>
                    {" "}
                    Recuerda que deben faltar al menos{" "}
                    <strong>
                      {humanizeMinutes(
                        availability.minimum_notice_minutes,
                      )}
                    </strong>{" "}
                    para el nuevo horario.
                  </>
                ) : null}
              </div>
            ) : (
              <p className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">
                Selecciona una fecha.
              </p>
            )}
          </div>

          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Motivo del cambio
            </span>
            <input
              className={inputClass}
              maxLength={5000}
              value={rescheduleReason}
              onChange={(event) =>
                setRescheduleReason(
                  event.target.value,
                )
              }
              placeholder="Opcional"
            />
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={working || !selectedSlot}
              onClick={() =>
                void requestReschedule()
              }
              className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {working ? (
                <Loader2
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <CalendarDays size={18} />
              )}
              Enviar solicitud
            </button>

            <button
              type="button"
              onClick={() =>
                setRescheduleOpen(false)
              }
              className="rounded-xl border border-gray-200 px-5 py-3 font-semibold text-gray-600"
            >
              Cerrar
            </button>
          </div>
        </section>
      ) : null}

      <AgendaModalShell open={cancelOpen} title="¿Cancelar tu reservación?" saving={working} cancelLabel="Volver" submitLabel="Confirmar cancelación" onClose={() => { setCancelOpen(false); setCancelError(null); }} onSubmit={(event) => { event.preventDefault(); void cancel(); }}>
        <div className="space-y-2 rounded-2xl bg-[#f2f3f4] p-4 text-sm text-gray-700">
          <p><strong>Servicio:</strong> {service?.name ?? `Servicio #${booking.service_id}`}</p>
          <p><strong>Cita:</strong> {formatDateTime(booking.start_at, timezone)}</p>
          <p><strong>Pago:</strong> {payment?.payment_method === "online" ? "Mercado Pago" : payment?.payment_method === "cash" ? "Pago directo" : "Sin cobro"}</p>
          {payment?.payment_status === "paid" ? <p><strong>Importe pagado:</strong> {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(payment.amount)}</p> : null}
          <p>{cancellationPolicy}</p>
        </div>
        <p className="text-sm text-gray-700">{payment?.payment_method === "online" && payment.payment_status === "paid"
          ? "Si cancelas dentro del plazo permitido, se gestionará la devolución completa del importe pagado."
          : payment?.payment_method === "cash" && payment.payment_status === "paid"
            ? "La devolución del pago deberá ser confirmada por el negocio."
            : payment?.payment_method !== "none" && payment?.payment_status === "pending"
              ? "La reservación se cancelará sin generar un reembolso."
              : "La reservación será cancelada."}</p>
        <label className="block text-sm font-semibold text-gray-700">Motivo de cancelación (opcional)
          <textarea className={`${inputClass} mt-2`} maxLength={5000} rows={3} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
        </label>
        {cancelError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{cancelError}</p> : null}
      </AgendaModalShell>

      <div className="flex flex-wrap gap-3">
        {auth.isAuthenticated ? (
          <Link
            href="/client/appointments"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 font-semibold text-gray-600"
          >
            <CalendarDays size={18} />
            Mis citas
          </Link>
        ) : null}

        <Link
          href={`/agenda/${booking.supplier_id}`}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 font-semibold text-gray-600"
        >
          <CalendarDays size={18} />
          Reservar otra cita
        </Link>
      </div>
    </main>
  );
}

function DetailInfo({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-1 font-semibold text-gray-800">
        {value}
      </p>
    </div>
  );
}
