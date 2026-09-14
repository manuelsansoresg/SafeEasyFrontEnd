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
import { useEffect, useMemo, useState } from "react";
import {
  canStillCancel,
  humanizeHours,
  humanizeMinutes,
} from "@/lib/agendaTime";
import { agendaBookingService } from "@/services/agendaBookingService";
import { useAuthHydrated, useAuthStore } from "@/store/useAuthStore";
import type { AgendaService } from "@/types/agenda";
import type {
  AgendaAvailability,
  AgendaAvailabilitySlot,
  AgendaBooking,
} from "@/types/agendaBooking";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

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

  const [managementToken, setManagementToken] =
    useState(tokenFromUrl);

  const [booking, setBooking] =
    useState<AgendaBooking | null>(null);
  const [service, setService] =
    useState<AgendaService | null>(null);
  const [rules, setRules] =
    useState<AgendaAvailability | null>(null);
  const [timezone, setTimezone] =
    useState<string | undefined>();

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [success, setSuccess] =
    useState<string | null>(null);

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

  const cancellationAllowed =
    !rules || rules.allow_customer_cancellation;

  const cancellationWithinTime =
    !booking ||
    !rules ||
    canStillCancel(
      booking.start_at,
      rules.cancellation_notice_hours,
    );

  const canCancel =
    isActive &&
    cancellationAllowed &&
    cancellationWithinTime;

  const rescheduleAllowed =
    !rules || rules.allow_reschedule_requests;

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (tokenFromUrl) {
      window.localStorage.setItem(
        `agenda-management-${bookingId}`,
        tokenFromUrl,
      );
      setManagementToken(tokenFromUrl);
      return;
    }

    const stored = window.localStorage.getItem(
      `agenda-management-${bookingId}`,
    );

    if (stored) {
      setManagementToken(stored);
    }
  }, [bookingId, tokenFromUrl]);

  useEffect(() => {
    if (!hydrated) return;

    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      setError(null);

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

        setBooking(data);

        const services =
          await agendaBookingService.listPublicServices(
            data.supplier_id,
            controller.signal,
          );

        const found =
          services.find(
            (item) => item.id === data?.service_id,
          ) || null;

        setService(found);

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
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar la cita.",
        );
      } finally {
        setLoading(false);
      }
    };

    void run();

    return () => controller.abort();
  }, [
    auth.isAuthenticated,
    bookingId,
    hydrated,
    managementToken,
  ]);

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

    if (!cancellationAllowed && rules) {
      setError(
        "Este negocio no permite que el cliente cancele la cita.",
      );
      return;
    }

    if (!cancellationWithinTime && rules) {
      setError(
        `La cancelación sólo está permitida hasta ${humanizeHours(
          rules.cancellation_notice_hours,
        )} antes de la cita. Ese plazo ya terminó.`,
      );
      return;
    }

    if (
      !window.confirm(
        "¿Seguro que deseas cancelar esta cita?",
      )
    ) {
      return;
    }

    setWorking(true);
    setError(null);
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
      setSuccess("La cita fue cancelada.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cancelar la cita.",
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
      <main className="mx-auto max-w-3xl px-4 py-10">
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
              href="/login"
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
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:py-10">
      <section className="rounded-3xl bg-[#004e28] p-6 text-white sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm font-semibold text-white/70">
              Cita #{booking.id}
            </p>
            <h1 className="mt-1 text-3xl font-bold">
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
            className={`self-start rounded-full px-3 py-1.5 text-sm font-bold ${statusClass(
              booking.status,
            )}`}
          >
            {statusLabel(booking.status)}
          </span>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {success}
        </div>
      ) : null}

      {rules && isActive ? (
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

              {rules.allow_customer_cancellation ? (
                <p>
                  Puedes cancelar hasta{" "}
                  <strong>
                    {humanizeHours(
                      rules.cancellation_notice_hours,
                    )}
                  </strong>{" "}
                  antes de la cita.
                </p>
              ) : (
                <p>
                  Este negocio no permite cancelaciones realizadas por
                  el cliente.
                </p>
              )}

              {rules.allow_reschedule_requests ? (
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

              {rules && !rules.allow_customer_cancellation ? (
                <div className="mt-3 flex items-start gap-2 text-sm text-red-700">
                  <ShieldAlert
                    className="mt-0.5 shrink-0"
                    size={17}
                  />
                  Este negocio no permite que el cliente cancele la cita.
                </div>
              ) : rules && !cancellationWithinTime ? (
                <div className="mt-3 flex items-start gap-2 text-sm text-red-700">
                  <ShieldAlert
                    className="mt-0.5 shrink-0"
                    size={17}
                  />
                  <span>
                    Sólo se puede cancelar hasta{" "}
                    <strong>
                      {humanizeHours(
                        rules.cancellation_notice_hours,
                      )}
                    </strong>{" "}
                    antes de la cita. Ese plazo ya terminó.
                  </span>
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  {rules
                    ? `Puedes cancelar mientras falten al menos ${humanizeHours(
                        rules.cancellation_notice_hours,
                      )} para la cita.`
                    : "La cancelación se realizará si todavía estás dentro del tiempo permitido por el negocio."}
                </p>
              )}

              <input
                className={`${inputClass} mt-4`}
                maxLength={5000}
                value={cancelReason}
                disabled={!canCancel}
                onChange={(event) =>
                  setCancelReason(
                    event.target.value,
                  )
                }
                placeholder="Motivo opcional"
              />

              <button
                type="button"
                disabled={working || !canCancel}
                onClick={() => void cancel()}
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
