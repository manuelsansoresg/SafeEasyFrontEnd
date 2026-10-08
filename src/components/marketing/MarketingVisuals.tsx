"use client";

import Image from "next/image";
import { CheckCircle2, Clock3 } from "lucide-react";
import AgendaMonthlyCalendar from "@/components/agenda/AgendaMonthlyCalendar";
import type { NewLandingKind } from "@/lib/marketingPlans";
import type { AgendaExample } from "@/lib/marketingPageData";

type ExampleItem = { name: string; image: string; price?: string };

const menuItems: ExampleItem[] = [
  { name: "Cochinita pibil", price: "Orden completa · $140", image: "/marketing/sabora-cochinita.webp" },
  { name: "Papadzules", price: "$99", image: "/marketing/sabora-papadzules.webp" },
  { name: "Panuchos", price: "$25", image: "/marketing/sabora-panuchos.webp" },
];

const products: ExampleItem[] = [
  { name: "Mesa Alicia", image: "/marketing/moderno-mesa-alicia.jpeg" },
  { name: "Mesa Hannia", image: "/marketing/moderno-mesa-hannia.jpeg" },
  { name: "Mesa centro Nala", image: "/marketing/moderno-mesa-nala.jpg" },
];

const money = (price: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(price);
const dayDate = (date: string) => new Date(`${date}T12:00:00Z`);
const timeLabel = (date: string, timezone: string) => new Intl.DateTimeFormat("es-MX", {
  hour: "2-digit", minute: "2-digit", hour12: true, timeZone: timezone,
}).format(new Date(date));

function AgendaLivePreview({ example }: { example: AgendaExample | null }) {
  const service = example?.service;
  const selectedDate = example?.selectedDate;
  const timezone = example?.timezone ?? "America/Merida";
  const weekday = selectedDate ? new Intl.DateTimeFormat("es-MX", { weekday: "long", timeZone: timezone }).format(dayDate(selectedDate)) : null;
  const month = selectedDate ? new Intl.DateTimeFormat("es-MX", { month: "long", timeZone: timezone }).format(dayDate(selectedDate)) : null;
  const day = selectedDate ? Number(selectedDate.slice(-2)) : null;
  const slots = example?.slots.slice(0, 3) ?? [];

  return <div className="relative mx-auto w-full max-w-[610px] overflow-hidden rounded-[1.75rem] border border-[#004e28]/10 bg-white p-5 shadow-[0_24px_70px_-42px_rgba(0,78,40,0.3)] sm:p-7 lg:max-w-none lg:p-8">
    <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[5rem] bg-[#f2f3f4]" aria-hidden="true" />
    <div className="relative">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#116f04]">Agenda en Drooopy</p>
      <h2 className="mt-2 font-[family-name:var(--font-varela-round)] text-[1.65rem] leading-tight text-[#004e28] sm:text-3xl">Reserva tu cita</h2>
      <p className="mt-1 text-sm text-[#40554a]">Servicio, fecha y horario en un solo recorrido.</p>
    </div>

    <div className="relative mt-6">
      <div className="flex items-center gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#004e28] text-[11px] font-bold text-white">01</span><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#40554a]">Servicio</p></div>
      {service ? <div className="mt-2 flex items-start justify-between gap-3 rounded-2xl border border-[#168e00]/25 bg-[#f6faf5] p-4">
        <div className="min-w-0"><p className="font-bold leading-snug text-[#004e28]">{service.name}</p><p className="mt-1 text-xs font-medium text-[#40554a]">{service.duration_minutes} minutos{service.price !== null ? ` · ${money(service.price)}` : ""}</p></div>
        <CheckCircle2 className="shrink-0 text-[#168e00]" size={21} aria-label="Servicio seleccionado" />
      </div> : <p className="mt-2 rounded-2xl bg-[#f2f3f4] p-4 text-sm text-[#40554a]">El servicio de ejemplo no está disponible en este momento.</p>}

      <div className="mt-5 grid gap-5 border-t border-[#004e28]/10 pt-5 sm:grid-cols-[0.38fr_0.62fr] sm:gap-6">
        <div>
          <div className="flex items-center gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#004e28] text-[11px] font-bold text-white">02</span><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#40554a]">Fecha</p></div>
          {selectedDate ? <div className="mt-2 flex items-baseline gap-3 sm:gap-2"><span className="font-[family-name:var(--font-varela-round)] text-5xl leading-none text-[#004e28]">{day}</span><div className="text-sm leading-5 text-[#40554a]"><span className="block capitalize">{weekday}</span><span className="block capitalize">{month} {selectedDate.slice(0, 4)}</span></div></div> : <p className="mt-3 text-sm text-[#40554a]">Consulta la disponibilidad desde Drooopy.</p>}
        </div>
        <div className="sm:border-l sm:border-[#004e28]/10 sm:pl-6">
          <div className="flex items-center gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#004e28] text-[11px] font-bold text-white">03</span><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#40554a]">Horario</p></div>
          {slots.length ? <div className="mt-3 flex flex-wrap gap-2">{slots.map((slot, index) => <span key={slot} className={`rounded-full px-3 py-2 text-xs font-semibold sm:text-sm ${index === 0 ? "bg-[#168e00] text-white" : "border border-[#004e28]/15 bg-[#f2f3f4] text-[#004e28]"}`}>{timeLabel(slot, timezone)}</span>)}</div> : <p className="mt-3 text-sm leading-6 text-[#40554a]">Consulta la disponibilidad desde Drooopy.</p>}
        </div>
      </div>
    </div>
    <p className="mt-6 border-t border-[#004e28]/10 pt-4 text-xs font-semibold text-[#004e28]">Eligen. Reservan. Tú recibes la cita.</p>
  </div>;
}

export function MarketingHeroVisual({ kind, agendaExample }: { kind: NewLandingKind; agendaExample: AgendaExample | null }) {
  if (kind === "agenda") return <AgendaLivePreview example={agendaExample} />;
  const isMenu = kind === "menu";
  return <figure className="mx-auto w-full max-w-[570px] lg:max-w-none">
    <div className="relative aspect-[4/3] overflow-hidden rounded-[1.75rem] bg-[#e9eee8] shadow-[0_30px_70px_-38px_rgba(0,78,40,0.4)] sm:aspect-[5/4]">
      <Image
        src={isMenu ? "/marketing/sabora-menu-cover.webp" : "/marketing/moderno-buffet-valencia.jpeg"}
        alt={isMenu ? "Portada del menú semanal publicado por Sabora en Drooopy" : "Buffet Valencia publicado por Moderno Muebles en Drooopy"}
        fill priority sizes="(max-width: 1023px) 100vw, 55vw"
        className="object-cover object-center"
      />
    </div>
    <figcaption className="mt-3 text-xs font-medium text-[#536657]">
      {isMenu ? "Menú real publicado en Drooopy · Sabora" : "Producto real publicado en Drooopy · Moderno Muebles"}
    </figcaption>
  </figure>;
}

export function MarketingAgendaShowcase({ today, example }: { today: string; example: AgendaExample | null }) {
  const availableDates = new Set(example?.dates ?? []);
  const max = new Date(`${today}T12:00:00Z`);
  max.setUTCDate(max.getUTCDate() + 28);
  const selectedDate = example?.selectedDate ?? null;
  const selectedLabel = selectedDate ? new Intl.DateTimeFormat("es-MX", {
    weekday: "long", day: "numeric", month: "long", timeZone: example?.timezone ?? "America/Merida",
  }).format(dayDate(selectedDate)) : null;
  const month = `${(selectedDate ?? today).slice(0, 7)}-01`;
  const service = example?.service;
  const showcaseSlots = example ? (example.slots.length > 3 ? example.slots.slice(3, 11) : example.slots.slice(0, 8)) : [];

  return <div className="mx-auto mt-8 max-w-5xl rounded-[1.75rem] border border-[#004e28]/10 bg-white p-4 shadow-[0_24px_65px_-50px_rgba(0,78,40,0.25)] sm:p-6 lg:p-8">
    <h3 className="text-lg font-bold text-[#17251c] sm:text-xl">1. Servicio</h3>
    {service ? <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-[#168e00]/30 bg-[#f6faf5] p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0"><div className="flex items-center gap-2"><h4 className="font-bold text-[#004e28]">{service.name}</h4><CheckCircle2 className="shrink-0 text-[#168e00]" size={19} aria-label="Servicio seleccionado" /></div>{service.description ? <p className="mt-1 max-w-2xl text-sm leading-5 text-[#40554a]">{service.description}</p> : null}</div>
      <p className="shrink-0 text-sm font-semibold text-[#004e28]">{service.duration_minutes} min{service.price !== null ? ` · ${money(service.price)}` : ""}</p>
    </div> : <p className="mt-3 rounded-2xl bg-[#f2f3f4] p-4 text-sm text-[#40554a]">El servicio de ejemplo no está disponible en este momento.</p>}

    <div className="mt-5 border-t border-[#004e28]/10 pt-5">
      <h3 className="text-lg font-bold text-[#17251c] sm:text-xl">2. Elige fecha y horario</h3>
      <div className="mt-4 grid items-center gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-8">
        <div className="pointer-events-none min-w-0 [&>div]:!shadow-none [&_[role=gridcell]_button]:!size-9 sm:[&_[role=gridcell]_button]:!size-10" aria-hidden="true"><AgendaMonthlyCalendar month={month} availableDates={availableDates} selectedDate={selectedDate} minDate={today} maxDate={max.toISOString().slice(0, 10)} loading={false} onSelectDate={() => {}} onPreviousMonth={() => {}} onNextMonth={() => {}} /></div>
        <div className="min-w-0 lg:pl-1">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#116f04]">Fecha seleccionada</p>
          <p className="mt-2 font-[family-name:var(--font-varela-round)] text-xl leading-tight text-[#004e28] sm:text-2xl">{selectedLabel ?? "Sin fecha disponible"}</p>
          <div className="mt-5 border-t border-[#004e28]/10 pt-5"><h4 className="text-sm font-bold text-[#17251c]">Horarios disponibles</h4>
            {showcaseSlots.length ? <div className="mt-3 flex flex-wrap gap-2">{showcaseSlots.map((slot) => <span key={slot} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#004e28]/12 bg-[#f2f3f4] px-3 py-2 text-sm font-semibold text-[#004e28]"><Clock3 size={15} aria-hidden="true" />{timeLabel(slot, example?.timezone ?? "America/Merida")}</span>)}</div> : <p className="mt-3 text-sm leading-6 text-[#40554a]">No hay horarios de ejemplo disponibles en este momento.</p>}
          </div>
          <p className="mt-5 text-xs leading-5 text-[#5f7164]">Vista de ejemplo. Las reservaciones se hacen desde la Agenda del negocio.</p>
        </div>
      </div>
    </div>
  </div>;
}

export function MarketingProductVisual({ kind }: { kind: Exclude<NewLandingKind, "agenda"> }) {
  const items = kind === "menu" ? menuItems : products;
  return <div className="mt-7 grid gap-4 sm:grid-cols-3 sm:gap-5">
    {items.map((item) => <figure key={item.name} className="overflow-hidden rounded-[1.25rem] border border-[#004e28]/10 bg-white shadow-[0_16px_45px_-34px_rgba(0,40,20,0.3)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#e9eee8]">
        <Image src={item.image} alt={item.name} fill sizes="(max-width: 639px) 100vw, 33vw" className="object-cover" />
      </div>
      <figcaption className="flex min-h-16 items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-[#004e28]">
        {item.name}{item.price ? <span className="shrink-0 text-xs text-[#116f04]">{item.price}</span> : null}
      </figcaption>
    </figure>)}
  </div>;
}
