"use client";

import { CalendarDays, CheckCircle2 } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import type { SupplierService } from "@/types/services";

type DemoReservation = { service: string; date: string; time: string };
const exampleTimes = ["09:00", "11:00", "13:00", "16:00"];
const fieldClass = "mt-2 min-h-12 w-full rounded-xl border border-[var(--supplier-heading)]/25 bg-[var(--supplier-card-background)] px-3 text-sm text-[var(--supplier-text-on-card)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--supplier-outline)]";

/** Uses demo catalog data only: no real availability, payments or booking requests. */
export function DemoSupplierAgendaTab({ services, supplierName, initialServiceId }: { services: SupplierService[]; supplierName: string; initialServiceId?: string | null }) {
  const [serviceId, setServiceId] = useState(services.find((service) => service.id === initialServiceId)?.id ?? services[0]?.id ?? "");
  const formId = useId();
  const [reservation, setReservation] = useState<DemoReservation | null>(null);
  const selectedService = services.find((service) => service.id === serviceId);

  const simulateReservation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const date = String(form.get("demo-date") || "");
    const time = String(form.get("demo-time") || "");
    if (!selectedService || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !exampleTimes.includes(time)) return;
    setReservation({ service: selectedService.title, date, time });
  };

  return (
    <section className="supplier-surface-page bg-[var(--supplier-page-background)] py-14 md:py-18" aria-labelledby="demo-agenda-title">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <header className="mb-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--supplier-accent)]">Modo demostración</p>
          <h2 id="demo-agenda-title" className="font-[family-name:var(--font-varela-round)] text-3xl text-[var(--supplier-heading)]">Agenda de {supplierName}</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--supplier-muted)]">Prueba cómo sería una reservación. Los horarios son de ejemplo y no representan disponibilidad real. No se crean citas, cobros ni notificaciones.</p>
        </header>

        {!services.length ? (
          <p className="text-sm text-[var(--supplier-muted)]">Esta demostración aún no tiene servicios para reservar.</p>
        ) : (
          <form onSubmit={simulateReservation} className="supplier-surface-card max-w-3xl rounded-3xl border border-[var(--supplier-heading)]/15 bg-[var(--supplier-card-background)] p-5 sm:p-8">
            <label htmlFor={`${formId}-service`} className="block text-sm font-semibold text-[var(--supplier-heading)]">
              Servicio de demostración
              <select id={`${formId}-service`} required value={serviceId} onChange={(event) => { setServiceId(event.target.value); setReservation(null); }} className={fieldClass}>
                {services.map((service) => <option key={service.id} value={service.id}>{service.title}</option>)}
              </select>
            </label>
            {selectedService?.description ? <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[var(--supplier-muted)]">{selectedService.description}</p> : null}
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label htmlFor={`${formId}-date`} className="block text-sm font-semibold text-[var(--supplier-heading)]">
                Fecha de ejemplo
                <input id={`${formId}-date`} name="demo-date" type="date" required onChange={() => setReservation(null)} className={`${fieldClass} min-w-0`} />
              </label>
              <label htmlFor={`${formId}-time`} className="block text-sm font-semibold text-[var(--supplier-heading)]">
                Horario de ejemplo
                <select id={`${formId}-time`} name="demo-time" required defaultValue="" onChange={() => setReservation(null)} className={fieldClass}>
                  <option value="" disabled>Elige un horario</option>
                  {exampleTimes.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <button type="submit" className="supplier-surface-primary mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--supplier-primary)] px-5 py-3 font-semibold text-[var(--supplier-on-primary)] transition-colors hover:bg-[var(--supplier-primary-hover)] sm:w-auto">
              <CalendarDays size={18} aria-hidden="true" /> Probar reservación
            </button>
            {reservation ? (
              <div role="status" className="mt-5 rounded-2xl border border-[var(--supplier-outline)]/30 p-4 text-sm leading-6 text-[var(--supplier-heading)]">
                <p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} aria-hidden="true" /> Reservación simulada</p>
                <p className="mt-2">{reservation.service} · {new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${reservation.date}T12:00:00Z`))} · {reservation.time}</p>
                <p className="mt-1 text-[var(--supplier-muted)]">No se creó una reservación real. Esta prueba se borra al salir.</p>
              </div>
            ) : null}
          </form>
        )}
      </div>
    </section>
  );
}
