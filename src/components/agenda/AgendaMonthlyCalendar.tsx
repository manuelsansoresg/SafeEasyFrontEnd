"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type AgendaMonthlyCalendarProps = {
  month: string;
  availableDates: ReadonlySet<string>;
  selectedDate: string | null;
  minDate: string;
  maxDate: string | null;
  loading: boolean;
  onSelectDate: (date: string) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
};

const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildCalendarDays(month: string) {
  const firstDay = parseDateInput(month);
  const mondayOffset = (firstDay.getUTCDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setUTCDate(firstDay.getUTCDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    return toDateInput(date);
  });
}

function formatMonth(month: string) {
  const label = new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseDateInput(month));

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatDayLabel(date: string, available: boolean) {
  const label = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(parseDateInput(date));

  return available ? `${label}, con horarios disponibles` : `${label}, sin horarios disponibles`;
}

function monthOffset(month: string, offset: number) {
  const date = parseDateInput(month);
  date.setUTCMonth(date.getUTCMonth() + offset, 1);
  return toDateInput(date);
}

function monthEnd(month: string) {
  const date = parseDateInput(month);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return toDateInput(date);
}

export default function AgendaMonthlyCalendar({
  month,
  availableDates,
  selectedDate,
  minDate,
  maxDate,
  loading,
  onSelectDate,
  onPreviousMonth,
  onNextMonth,
}: AgendaMonthlyCalendarProps) {
  const days = buildCalendarDays(month);
  const monthKey = month.slice(0, 7);
  const previousMonth = monthOffset(month, -1);
  const nextMonth = monthOffset(month, 1);
  const canGoPrevious = monthEnd(previousMonth) >= minDate;
  const canGoNext = Boolean(maxDate && nextMonth <= maxDate);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-3 shadow-[0_12px_35px_rgba(0,78,40,0.06)] sm:p-5"
      aria-busy={loading}
    >
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPreviousMonth}
          disabled={!canGoPrevious || loading}
          aria-label="Ver mes anterior"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-[#004e28] transition hover:border-[#168e00] hover:bg-[#168e00]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00] disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-300"
        >
          <ChevronLeft aria-hidden="true" size={21} />
        </button>

        <h3 className="text-center font-[family-name:var(--font-varela-round)] text-lg font-bold text-[#004e28] sm:text-xl">
          {formatMonth(month)}
        </h3>

        <button
          type="button"
          onClick={onNextMonth}
          disabled={!canGoNext || loading}
          aria-label="Ver mes siguiente"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 text-[#004e28] transition hover:border-[#168e00] hover:bg-[#168e00]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00] disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-300"
        >
          <ChevronRight aria-hidden="true" size={21} />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-7" aria-hidden="true">
        {weekDays.map((day) => (
          <div
            key={day}
            className="pb-2 text-center text-[0.68rem] font-bold uppercase tracking-wide text-gray-500 sm:text-xs"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1" role="grid" aria-label={`Calendario de ${formatMonth(month)}`}>
        {days.map((date) => {
          const inCurrentMonth = date.slice(0, 7) === monthKey;
          const inRange = date >= minDate && Boolean(maxDate && date <= maxDate);
          const available = inCurrentMonth && inRange && availableDates.has(date);
          const selected = selectedDate === date;
          const day = Number(date.slice(-2));

          return (
            <div key={date} className="flex min-w-0 justify-center" role="gridcell">
              <button
                type="button"
                disabled={!available || loading}
                onClick={() => onSelectDate(date)}
                aria-label={formatDayLabel(date, available)}
                aria-current={selected ? "date" : undefined}
                className={[
                  "relative flex size-10 items-center justify-center rounded-xl text-sm font-semibold transition sm:size-11",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00]",
                  selected
                    ? "bg-[#168e00] text-white shadow-sm"
                    : available
                      ? "text-gray-800 hover:bg-[#168e00]/8 hover:text-[#004e28]"
                      : inCurrentMonth
                        ? "cursor-not-allowed text-gray-300"
                        : "cursor-not-allowed text-gray-200",
                ].join(" ")}
              >
                {day}
                {available && !selected ? (
                  <span
                    className="absolute bottom-1 size-1 rounded-full bg-[#168e00]"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-3 text-xs text-gray-600">
        <span className="size-2 rounded-full bg-[#168e00]" aria-hidden="true" />
        Los días con punto verde tienen horarios disponibles.
      </p>

      {loading ? (
        <div
          className="absolute inset-0 flex items-center justify-center bg-white/85 px-4 backdrop-blur-[1px]"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-gray-600 shadow-sm">
            <Loader2 className="animate-spin text-[#168e00]" size={19} aria-hidden="true" />
            Consultando horarios disponibles...
          </div>
        </div>
      ) : null}
    </div>
  );
}
