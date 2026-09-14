"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Info,
  Loader2,
  LogIn,
  Mail,
  Phone,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  addDaysToDateInput,
  humanizeDays,
  humanizeMinutes,
} from "@/lib/agendaTime";
import { agendaBookingService } from "@/services/agendaBookingService";
import { useAuthHydrated, useAuthStore } from "@/store/useAuthStore";
import {
  getBrowserPathWithSearchAndHash,
  getLoginUrl,
} from "@/lib/authRedirect";
import type { AgendaService } from "@/types/agenda";
import type {
  AgendaAvailability,
  AgendaAvailabilitySlot,
} from "@/types/agendaBooking";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

function todayInput() {
  const now = new Date();
  const local = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000,
  );
  return local.toISOString().slice(0, 10);
}

function formatMoney(value: number | null) {
  if (value == null) return "Consultar precio";

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
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

function formatDate(
  dateValue: string,
  timezone?: string,
) {
  const options: Intl.DateTimeFormatOptions = {
    dateStyle: "full",
  };

  if (timezone) options.timeZone = timezone;

  return new Intl.DateTimeFormat(
    "es-MX",
    options,
  ).format(new Date(`${dateValue}T12:00:00`));
}

export default function PublicAgendaBookingPage() {
  const params = useParams<{ supplierId: string }>();
  const router = useRouter();
  const hydrated = useAuthHydrated();

  const auth = useAuthStore();
  const supplierId = Number(params.supplierId);
  const [loginReturnTo, setLoginReturnTo] = useState(
    `/agenda/${params.supplierId}`,
  );

  const [services, setServices] = useState<AgendaService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState(todayInput());
  const [availability, setAvailability] =
    useState<AgendaAvailability | null>(null);
  const [selectedSlot, setSelectedSlot] =
    useState<AgendaAvailabilitySlot | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoginReturnTo(getBrowserPathWithSearchAndHash());
  }, [supplierId]);

  const selectedService = useMemo(
    () =>
      services.find((service) => service.id === selectedServiceId) ??
      null,
    [services, selectedServiceId],
  );

  const guestBlocked =
    hydrated &&
    !auth.isAuthenticated &&
    availability?.allow_guest_bookings === false;

  const guestEmailRequired =
    !auth.isAuthenticated &&
    (availability?.require_guest_email ?? true);

  const maxDate = availability
    ? addDaysToDateInput(
        todayInput(),
        availability.maximum_booking_days,
      )
    : undefined;

  useEffect(() => {
    if (!Number.isFinite(supplierId) || supplierId <= 0) {
      setError("Proveedor inválido.");
      setLoadingServices(false);
      return;
    }

    const controller = new AbortController();

    const run = async () => {
      try {
        setError(null);

        const data =
          await agendaBookingService.listPublicServices(
            supplierId,
            controller.signal,
          );

        setServices(data);

        if (data.length) {
          setSelectedServiceId(data[0].id);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar la agenda.",
        );
      } finally {
        setLoadingServices(false);
      }
    };

    void run();

    return () => controller.abort();
  }, [supplierId]);

  useEffect(() => {
    if (!hydrated) return;

    if (auth.user) {
      setName((current) => current || auth.user?.name || "");
      setEmail((current) => current || auth.user?.email || "");
    }
  }, [hydrated, auth.user]);

  useEffect(() => {
    if (!selectedServiceId || !selectedDate) {
      setAvailability(null);
      setSelectedSlot(null);
      return;
    }

    const controller = new AbortController();

    const run = async () => {
      setLoadingSlots(true);
      setSelectedSlot(null);

      try {
        setError(null);

        const data =
          await agendaBookingService.availability(
            supplierId,
            selectedServiceId,
            selectedDate,
            selectedDate,
            controller.signal,
          );

        setAvailability(data);
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
  }, [supplierId, selectedServiceId, selectedDate]);

  const submit = async () => {
    if (!selectedService || !selectedSlot) {
      setError("Selecciona servicio, fecha y horario.");
      return;
    }

    if (guestBlocked) {
      setError(
        "Este negocio no permite reservaciones como invitado. Inicia sesión para continuar.",
      );
      return;
    }

    if (!name.trim()) {
      setError("Escribe el nombre de la persona que asistirá.");
      return;
    }

    if (guestEmailRequired && !email.trim()) {
      setError(
        "Este negocio solicita correo a los invitados para enviar la confirmación y el enlace de administración de la cita.",
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const booking =
        await agendaBookingService.createBooking(
          supplierId,
          {
            service_id: selectedService.id,
            start_at: selectedSlot.start_at,
            customer_name: name.trim(),
            customer_email: email.trim() || null,
            customer_phone: phone.trim() || null,
            notes: notes.trim() || null,
          },
        );

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `agenda-management-${booking.id}`,
          booking.management_token,
        );
      }

      const query = auth.isAuthenticated
        ? ""
        : `?management_token=${encodeURIComponent(
            booking.management_token,
          )}`;

      router.push(
        `/agenda/bookings/${booking.id}${query}`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo crear la cita.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loadingServices) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2
          className="animate-spin text-[#168e00]"
          size={36}
        />
      </div>
    );
  }

  if (!services.length) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <CalendarDays
            className="mx-auto text-[#168e00]"
            size={42}
          />
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            Agenda no disponible
          </h1>
          <p className="mt-2 text-gray-500">
            Este negocio no tiene servicios disponibles para reservar
            en este momento.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:py-10">
      <div>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[#004e28]"
        >
          <ArrowLeft size={17} />
          Volver
        </button>
      </div>

      <section className="rounded-3xl bg-[#004e28] p-6 text-white sm:p-8">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-white/10 p-3">
            <CalendarDays size={30} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/70">
              Agenda
            </p>
            <h1 className="mt-1 text-3xl font-bold">
              Reserva tu cita
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/80">
              Elige el servicio, la fecha y uno de los horarios
              disponibles.
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {availability ? (
        <section className="rounded-3xl border border-[#168e00]/15 bg-[#168e00]/5 p-5">
          <div className="flex items-start gap-3">
            <Info
              className="mt-0.5 shrink-0 text-[#168e00]"
              size={20}
            />
            <div>
              <h2 className="font-bold text-[#004e28]">
                Reglas de reservación
              </h2>

              <div className="mt-2 space-y-1 text-sm text-gray-700">
                <p>
                  Reserva con al menos{" "}
                  <strong>
                    {humanizeMinutes(
                      availability.minimum_notice_minutes,
                    )}
                  </strong>{" "}
                  de anticipación.
                </p>

                <p>
                  Puedes reservar hasta{" "}
                  <strong>
                    {humanizeDays(
                      availability.maximum_booking_days,
                    )}
                  </strong>{" "}
                  hacia adelante.
                </p>

                {!auth.isAuthenticated ? (
                  <p>
                    {availability.allow_guest_bookings
                      ? availability.require_guest_email
                        ? "Se permiten reservaciones como invitado y el correo es obligatorio."
                        : "Se permiten reservaciones como invitado."
                      : "Para reservar debes iniciar sesión con una cuenta de cliente."}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {guestBlocked ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <ShieldAlert
                className="mt-0.5 shrink-0 text-amber-700"
                size={22}
              />
              <div>
                <h2 className="font-bold text-amber-900">
                  Este negocio requiere una cuenta
                </h2>
                <p className="mt-1 text-sm text-amber-800">
                  Las reservaciones como invitado están desactivadas.
                  Inicia sesión para poder confirmar la cita.
                </p>
              </div>
            </div>

            <Link
              href={getLoginUrl(loginReturnTo)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 font-semibold text-white"
            >
              <LogIn size={18} />
              Iniciar sesión
            </Link>
          </div>
        </section>
      ) : !auth.isAuthenticated && hydrated ? (
        <section className="rounded-3xl border border-[#168e00]/20 bg-[#168e00]/5 p-5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-bold text-[#004e28]">
                ¿Ya tienes cuenta en Drooopy?
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Inicia sesión para que la cita aparezca automáticamente
                en “Mis citas”. También puedes continuar como invitado.
              </p>
            </div>
            <Link
              href={getLoginUrl(loginReturnTo)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#168e00] px-4 py-2.5 font-semibold text-[#168e00]"
            >
              <LogIn size={18} />
              Iniciar sesión
            </Link>
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold text-gray-900">
          1. Selecciona el servicio
        </h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {services.map((service) => {
            const selected =
              service.id === selectedServiceId;

            return (
              <button
                key={service.id}
                type="button"
                onClick={() => {
                  setSelectedServiceId(service.id);
                  setSelectedSlot(null);
                }}
                className={
                  selected
                    ? "rounded-2xl border-2 border-[#168e00] bg-[#168e00]/5 p-4 text-left"
                    : "rounded-2xl border border-gray-200 p-4 text-left transition hover:border-[#168e00]/40"
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-gray-900">
                      {service.name}
                    </h3>
                    {service.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                        {service.description}
                      </p>
                    ) : null}
                  </div>

                  {selected ? (
                    <CheckCircle2
                      className="shrink-0 text-[#168e00]"
                      size={20}
                    />
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-gray-500">
                  <span className="rounded-full bg-gray-100 px-3 py-1">
                    {humanizeMinutes(service.duration_minutes)}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1">
                    {formatMoney(service.price)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold text-gray-900">
          2. Elige fecha y horario
        </h2>

        <div className="mt-4 max-w-sm">
          <label>
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Fecha
            </span>
            <input
              type="date"
              min={todayInput()}
              max={maxDate}
              className={inputClass}
              value={selectedDate}
              onChange={(event) =>
                setSelectedDate(event.target.value)
              }
            />

            {availability ? (
              <small className="mt-1.5 block text-gray-500">
                Puedes elegir una fecha dentro de los próximos{" "}
                {humanizeDays(
                  availability.maximum_booking_days,
                )}.
              </small>
            ) : null}
          </label>
        </div>

        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-gray-700">
            {formatDate(
              selectedDate,
              availability?.timezone,
            )}
          </p>

          {loadingSlots ? (
            <div className="flex items-center gap-2 py-6 text-gray-500">
              <Loader2
                size={20}
                className="animate-spin"
              />
              Consultando horarios...
            </div>
          ) : availability?.slots.length ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {availability.slots.map((slot) => {
                const selected =
                  selectedSlot?.start_at === slot.start_at;

                return (
                  <button
                    key={slot.start_at}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
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
            <div className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-600">
              <p className="font-semibold text-gray-800">
                No hay horarios disponibles para esta fecha.
              </p>

              {availability.minimum_notice_minutes > 0 ? (
                <p className="mt-1">
                  Recuerda que este negocio exige reservar con al menos{" "}
                  <strong>
                    {humanizeMinutes(
                      availability.minimum_notice_minutes,
                    )}
                  </strong>{" "}
                  de anticipación.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">
              Selecciona un servicio y una fecha.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-xl font-bold text-gray-900">
          3. Tus datos
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label>
            <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <UserRound size={16} />
              Nombre *
            </span>
            <input
              className={inputClass}
              maxLength={255}
              value={name}
              disabled={guestBlocked}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="Nombre de quien asistirá"
            />
          </label>

          <label>
            <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Mail size={16} />
              Correo
              {guestEmailRequired ? " *" : ""}
            </span>
            <input
              type="email"
              className={inputClass}
              maxLength={255}
              value={email}
              disabled={guestBlocked}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="correo@ejemplo.com"
            />
          </label>

          <label>
            <span className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Phone size={16} />
              Teléfono
            </span>
            <input
              type="tel"
              className={inputClass}
              maxLength={30}
              value={phone}
              disabled={guestBlocked}
              onChange={(event) =>
                setPhone(event.target.value)
              }
              placeholder="Opcional"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Nota para el negocio
            </span>
            <input
              className={inputClass}
              maxLength={5000}
              value={notes}
              disabled={guestBlocked}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              placeholder="Opcional"
            />
          </label>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-gray-500">
              Resumen
            </p>
            <p className="mt-1 font-bold text-gray-900">
              {selectedService?.name || "Selecciona un servicio"}
            </p>
            {selectedSlot && availability ? (
              <p className="mt-1 text-sm text-gray-500">
                {formatDate(
                  selectedDate,
                  availability.timezone,
                )}{" "}
                ·{" "}
                {formatSlot(
                  selectedSlot.start_at,
                  availability.timezone,
                )}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={
              saving ||
              !selectedService ||
              !selectedSlot ||
              guestBlocked
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-6 py-3.5 font-bold text-white transition hover:bg-[#117500] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2
                size={19}
                className="animate-spin"
              />
            ) : (
              <CalendarDays size={19} />
            )}
            Confirmar reservación
          </button>
        </div>
      </section>
    </main>
  );
}
