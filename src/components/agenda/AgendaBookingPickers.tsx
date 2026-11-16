"use client";

import { CalendarDays, CheckCircle2, Clock3, Loader2 } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import AgendaMonthlyCalendar from "@/components/agenda/AgendaMonthlyCalendar";
import { humanizeMinutes } from "@/lib/agendaTime";

export const agendaPanelClass = "rounded-3xl border border-gray-100 supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] p-5 shadow-sm sm:p-6";
export const agendaBookingButtonClass = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl supplier-surface-primary bg-[var(--supplier-primary-action,#168e00)] px-6 py-3.5 font-bold text-[color:var(--supplier-inverse,#ffffff)] transition hover:bg-[var(--supplier-primary-hover,#117500)] disabled:cursor-not-allowed disabled:opacity-50";

function formatMoney(value: number | null) {
  if (value == null) return "Consultar precio";

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

export function formatAgendaDate(
  dateValue: string,
) {
  const [year, month, day] = dateValue.split("-").map(Number);

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

type BookingService<Id extends string | number> = {
  id: Id;
  name: string;
  description?: string | null;
  duration_minutes?: number | null;
  price: number | null;
};

export function AgendaServicePicker<Id extends string | number>({
  services,
  selectedServiceId,
  onSelectService,
}: {
  services: BookingService<Id>[];
  selectedServiceId: Id | null;
  onSelectService: (id: Id) => void;
}) {
  return (
    <section className={agendaPanelClass}>
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
              onClick={() => onSelectService(service.id)}
              aria-pressed={selected}
              className={
                selected
                  ? "rounded-2xl border-2 border-[var(--supplier-outline,#168e00)] bg-[var(--supplier-primary,#168e00)]/5 p-4 text-left"
                  : "rounded-2xl border border-gray-200 p-4 text-left transition hover:border-[var(--supplier-outline,#168e00)]/40"
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
                    className="shrink-0 text-[var(--supplier-accent,#168e00)]"
                    size={20}
                  />
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-gray-500">
                {service.duration_minutes != null ? (
                  <span className="rounded-full bg-gray-100 px-3 py-1">
                    {humanizeMinutes(service.duration_minutes)}
                  </span>
                ) : null}
                <span className="rounded-full bg-gray-100 px-3 py-1">
                  {formatMoney(service.price)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function AgendaDateTimePicker({
  calendar,
  hasAvailability,
  slots,
  selectedSlotId,
  onSelectSlot,
  emptyState,
}: {
  calendar: ComponentProps<typeof AgendaMonthlyCalendar>;
  hasAvailability: boolean;
  slots: { id: string; label: string }[];
  selectedSlotId: string | null;
  onSelectSlot: (id: string) => void;
  emptyState: ReactNode;
}) {
  return (
    <section className={agendaPanelClass}>
      <h2 className="text-xl font-bold text-gray-900">
        2. Elige fecha y horario
      </h2>

      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <AgendaMonthlyCalendar {...calendar} />

        <div className="min-w-0 rounded-2xl supplier-surface-page bg-[var(--supplier-page-background,#f2f3f4)] p-4 sm:p-5">
          {calendar.selectedDate && hasAvailability ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--supplier-accent,#168e00)]">
                Fecha seleccionada
              </p>
              <p className="mt-1 font-[family-name:var(--font-varela-round)] text-lg font-bold text-[var(--supplier-heading,#004e28)]">
                {formatAgendaDate(calendar.selectedDate)}
              </p>
            </div>
          ) : (
            <p className="font-semibold text-gray-700">
              Selecciona un día disponible
            </p>
          )}

          <h3 className="mt-5 text-sm font-bold text-gray-800">
            Horarios disponibles
          </h3>

          {calendar.loading ? (
            <div className="flex min-h-28 items-center gap-2 py-6 text-sm text-gray-500" role="status">
              <Loader2 size={20} className="animate-spin" aria-hidden="true" />
              Consultando horarios...
            </div>
          ) : slots.length > 0 && hasAvailability ? (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              {slots.map((slot) => {
                const selected =
                  selectedSlotId === slot.id;

                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => onSelectSlot(slot.id)}
                    aria-pressed={selected}
                    aria-label={`Elegir horario ${slot.label}`}
                    className={
                      selected
                        ? "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl supplier-surface-primary bg-[var(--supplier-primary-action,#168e00)] px-3 py-3 text-sm font-semibold text-[color:var(--supplier-inverse,#ffffff)] shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--supplier-heading,#004e28)]"
                        : "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-gray-200 supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] px-3 py-3 text-sm font-semibold text-gray-700 transition hover:border-[var(--supplier-outline,#168e00)] hover:text-[var(--supplier-accent,#168e00)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--supplier-outline,#168e00)]"
                    }
                  >
                    <Clock3 size={16} aria-hidden="true" />
                    {slot.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-gray-200 supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] p-4 text-sm text-gray-600">
              {emptyState}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function AgendaBookingHeader({
  title,
  demo = false,
  pageHeading = false,
  children,
}: {
  title: string;
  demo?: boolean;
  pageHeading?: boolean;
  children: ReactNode;
}) {
  const Heading = pageHeading ? "h1" : "h2";

  return (
    <header className="rounded-3xl supplier-surface-secondary bg-[var(--supplier-secondary,#004e28)] p-6 text-[color:var(--supplier-inverse,#ffffff)] sm:p-8">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--supplier-card-background,#ffffff)]/10">
          <CalendarDays size={25} />
        </span>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[color:var(--supplier-inverse-muted,#ffffff)]">
            {demo ? "Agenda de demostración" : "Agenda"}
          </p>
          <Heading className="mt-1 font-[family-name:var(--font-varela-round)] text-3xl font-black">
            {title}
          </Heading>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--supplier-inverse-muted,#ffffff)]">
            {children}
          </p>
        </div>
      </div>
    </header>
  );
}
