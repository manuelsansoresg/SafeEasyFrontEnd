"use client";

import { CalendarDays, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import {
  AgendaBookingHeader,
  AgendaDateTimePicker,
  AgendaServicePicker,
  agendaBookingButtonClass,
  agendaPanelClass,
  formatAgendaDate,
} from "@/components/agenda/AgendaBookingPickers";
import { addDaysToDateInput, addMonthsToInput, dateInputInTimeZone, startOfMonthInput } from "@/lib/agendaTime";
import type { SupplierService } from "@/types/services";

const exampleTimes = [
  { id: "09:00", label: "09:00 am" },
  { id: "11:00", label: "11:00 am" },
  { id: "13:00", label: "01:00 pm" },
  { id: "16:00", label: "04:00 pm" },
];

export function DemoSupplierAgendaTab({
  services,
  supplierName,
  initialServiceId,
}: {
  services: SupplierService[];
  supplierName: string;
  initialServiceId?: string | null;
}) {
  const [{ minDate, maxDate, availableDates }] = useState(() => {
    const today = dateInputInTimeZone(new Date(), "America/Merida");
    const dates = Array.from({ length: 31 }, (_, index) => addDaysToDateInput(today, index));
    return { minDate: today, maxDate: dates[30], availableDates: new Set(dates) };
  });
  const [serviceId, setServiceId] = useState(
    services.find((service) => service.id === initialServiceId)?.id ?? services[0]?.id ?? null,
  );
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonthInput(minDate));
  const [selectedDate, setSelectedDate] = useState<string | null>(minDate);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const selectedService = services.find((service) => service.id === serviceId);
  const selectedSlot = exampleTimes.find((slot) => slot.id === selectedSlotId);

  function selectDate(date: string | null) {
    setSelectedDate(date);
    setSelectedSlotId(null);
    setConfirmed(false);
  }

  function moveMonth(offset: number) {
    setVisibleMonth((month) => addMonthsToInput(month, offset));
    selectDate(null);
  }

  return (
    <section className="supplier-surface-page bg-[var(--supplier-page-background,#f2f3f4)] py-14 md:py-18">
      <div className="mx-auto max-w-5xl space-y-6 px-4">
        <AgendaBookingHeader title={`Agenda de ${supplierName}`} demo>
          Elige el servicio, la fecha y uno de los horarios de ejemplo. La confirmación es simulada.
        </AgendaBookingHeader>

        {services.length ? (
          <>
            <AgendaServicePicker
              services={services.map(({ id, title, description, price }) => ({
                id,
                name: title,
                description,
                price,
              }))}
              selectedServiceId={serviceId}
              onSelectService={(id) => {
                if (id === serviceId) return;
                setServiceId(id);
                selectDate(selectedDate);
              }}
            />

            <AgendaDateTimePicker
              calendar={{
                month: visibleMonth,
                availableDates,
                selectedDate,
                minDate,
                maxDate,
                loading: false,
                onSelectDate: selectDate,
                onPreviousMonth: () => moveMonth(-1),
                onNextMonth: () => moveMonth(1),
              }}
              hasAvailability
              slots={selectedDate ? exampleTimes : []}
              selectedSlotId={selectedSlotId}
              onSelectSlot={(id) => {
                if (id === selectedSlotId) return;
                setSelectedSlotId(id);
                setConfirmed(false);
              }}
              emptyState="Elige un día en el calendario para ver los horarios de ejemplo."
            />

            <section className={agendaPanelClass}>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-semibold text-gray-500">Resumen</p>
                  <p className="mt-1 font-bold text-gray-900">
                    {selectedService?.title ?? "Selecciona un servicio"}
                  </p>
                  {selectedDate && selectedSlot ? (
                    <p className="mt-1 text-sm text-gray-500">
                      {formatAgendaDate(selectedDate)} · {selectedSlot.label}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={agendaBookingButtonClass}
                  disabled={!selectedService || !selectedDate || !selectedSlot}
                  onClick={() => setConfirmed(true)}
                >
                  <CalendarDays size={19} aria-hidden="true" />
                  Probar reservación
                </button>
              </div>
              {confirmed ? (
                <p role="status" className="mt-4 flex items-center gap-2 text-sm font-semibold text-[var(--supplier-accent,#168e00)]">
                  <CheckCircle2 size={18} aria-hidden="true" />
                  Reservación simulada.
                </p>
              ) : null}
            </section>
          </>
        ) : (
          <p className="text-sm text-gray-500">Esta demostración aún no tiene servicios para reservar.</p>
        )}
      </div>
    </section>
  );
}
