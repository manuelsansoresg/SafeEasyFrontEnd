"use client";

import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Loader2,
  LogIn,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { agendaBookingService } from "@/services/agendaBookingService";
import { useChatInboxWebSocket } from "@/hooks/useChatWebSocket";
import { useInboxReconnect } from "@/hooks/useInboxReconnect";
import { useAuthHydrated, useAuthStore } from "@/store/useAuthStore";
import { useChatStore } from "@/store/useChatStore";
import { isAgendaInboxEvent } from "@/types/chat";
import type { AgendaService } from "@/types/agenda";
import type {
  AgendaBooking,
  AgendaBookingStatus,
} from "@/types/agendaBooking";
import { getLoginUrl } from "@/lib/authRedirect";
import { isExpectedAbort } from "@/lib/agendaRequest";

type ServiceMap = Record<string, AgendaService>;

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

export default function ClientAppointmentsPage() {
  const hydrated = useAuthHydrated();
  const auth = useAuthStore();
  const subscribeToInboxEvents = useChatStore((state) => state.subscribeToInboxEvents);
  const { status: inboxStatus } = useChatInboxWebSocket(hydrated && auth.isAuthenticated);
  const refreshSequence = useRef(0);
  const refreshRequest = useRef<Promise<void> | null>(null);
  const refreshController = useRef<AbortController | null>(null);
  const refreshQueued = useRef(false);
  const eventTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serviceCache = useRef(new Map<number, { list: AgendaService[]; loadedAt: number }>());

  const [bookings, setBookings] = useState<AgendaBooking[]>([]);
  const [services, setServices] = useState<ServiceMap>({});
  const [filter, setFilter] = useState<"all" | AgendaBookingStatus>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bookingsRef = useRef(bookings);

  useEffect(() => { bookingsRef.current = bookings; }, [bookings]);
  const refreshBookings = useCallback((silent = true): Promise<void> => {
    if (!hydrated || !auth.isAuthenticated) return Promise.resolve();
    if (refreshRequest.current && !refreshController.current?.signal.aborted) {
      refreshQueued.current = true;
      return refreshRequest.current;
    }

    const controller = new AbortController();
    refreshController.current = controller;
    const sequence = ++refreshSequence.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    const request = (async () => {
      do {
        refreshQueued.current = false;
        try {
          const data = await agendaBookingService.myBookings(undefined, controller.signal);
          if (controller.signal.aborted || sequence !== refreshSequence.current) return;
          bookingsRef.current = data;
          setBookings(data);
          setError(null);

          const supplierIds = [...new Set(data.map((item) => item.supplier_id))];
          const staleIds = supplierIds.filter((supplierId) => {
            const cached = serviceCache.current.get(supplierId);
            return !cached || Date.now() - cached.loadedAt > 5 * 60_000 ||
              data.some((booking) => booking.supplier_id === supplierId &&
                !cached.list.some((service) => service.id === booking.service_id));
          });
          const results = await Promise.allSettled(staleIds.map(async (supplierId) => ({
            supplierId,
            list: await agendaBookingService.listPublicServices(supplierId, controller.signal),
          })));
          if (controller.signal.aborted || sequence !== refreshSequence.current) return;
          for (const result of results) {
            if (result.status === "fulfilled") {
              serviceCache.current.set(result.value.supplierId, {
                list: result.value.list,
                loadedAt: Date.now(),
              });
            }
          }
          setServices((current) => {
            const next = { ...current };
            for (const supplierId of supplierIds) {
              for (const service of serviceCache.current.get(supplierId)?.list ?? []) {
                next[`${supplierId}:${service.id}`] = service;
              }
            }
            return next;
          });
        } catch (err) {
          if (isExpectedAbort(err, controller.signal) || sequence !== refreshSequence.current) return;
          if (!silent || bookingsRef.current.length === 0) {
            setError(err instanceof Error ? err.message : "No se pudieron cargar tus citas.");
          }
        }
      } while (refreshQueued.current && !controller.signal.aborted);
      if (sequence === refreshSequence.current && !controller.signal.aborted) setLoading(false);
    })();

    refreshRequest.current = request;
    void request.finally(() => {
      if (refreshRequest.current === request) refreshRequest.current = null;
    });
    return request;
  }, [auth.isAuthenticated, hydrated]);

  const resyncAfterReconnect = useCallback(() => {
    void refreshBookings();
  }, [refreshBookings]);
  useInboxReconnect(inboxStatus, hydrated && auth.isAuthenticated, resyncAfterReconnect);

  useEffect(() => {
    if (!hydrated) return;

    if (!auth.isAuthenticated) {
      setLoading(false);
      return;
    }

    void refreshBookings(false);
    return () => {
      refreshController.current?.abort();
      refreshSequence.current += 1;
      refreshRequest.current = null;
      refreshQueued.current = false;
      if (eventTimer.current) clearTimeout(eventTimer.current);
    };
  }, [auth.isAuthenticated, hydrated, refreshBookings]);

  useEffect(() => {
    if (!hydrated || !auth.isAuthenticated) return;
    const unsubscribe = subscribeToInboxEvents((event) => {
      if (!isAgendaInboxEvent(event)) return;
      if (event.type !== "agenda.booking_created" &&
          !bookingsRef.current.some((item) => item.id === event.booking_id)) return;

      if (eventTimer.current) clearTimeout(eventTimer.current);
      eventTimer.current = setTimeout(() => {
        eventTimer.current = null;
        void refreshBookings();
      }, 120);
    });
    return () => {
      if (eventTimer.current) clearTimeout(eventTimer.current);
      unsubscribe();
    };
  }, [auth.isAuthenticated, hydrated, refreshBookings, subscribeToInboxEvents]);

  const filtered = useMemo(() => {
    if (filter === "all") return bookings;
    return bookings.filter((item) => item.status === filter);
  }, [bookings, filter]);

  if (!hydrated || loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Loader2 className="animate-spin text-[#168e00]" size={34} />
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <CalendarDays className="mx-auto text-[#168e00]" size={42} />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            Mis citas
          </h1>
          <p className="mt-2 text-gray-500">
            Inicia sesión para consultar y administrar tus reservaciones.
          </p>
          <Link
            href={getLoginUrl("/client/appointments")}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-semibold text-white"
          >
            <LogIn size={18} />
            Iniciar sesión
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:py-10">
      <section className="rounded-3xl bg-[#004e28] p-6 text-white sm:p-8">
        <p className="text-sm font-semibold text-white/70">
          Cuenta
        </p>
        <h1 className="mt-1 text-3xl font-bold">
          Mis citas
        </h1>
        <p className="mt-2 text-sm text-white/80">
          Consulta tus próximas reservaciones y tu historial.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex gap-2 overflow-x-auto">
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
                : "shrink-0 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600"
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
        <div className="space-y-3">
          {filtered.map((booking) => {
            const service =
              services[`${booking.supplier_id}:${booking.service_id}`];

            return (
              <Link
                key={booking.id}
                href={`/agenda/bookings/${booking.id}`}
                className="block rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:border-[#168e00]/30"
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

                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                      <Clock3 size={16} />
                      {formatDateTime(booking.start_at)}
                    </div>

                    <p className="mt-2 text-xs text-gray-400">
                      Cita #{booking.id}
                    </p>
                  </div>

                  <ChevronRight
                    className="mt-1 shrink-0 text-gray-400"
                    size={20}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
