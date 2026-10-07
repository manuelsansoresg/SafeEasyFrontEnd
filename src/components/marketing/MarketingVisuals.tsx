"use client";

import Image from "next/image";
import { useMemo } from "react";
import AgendaMonthlyCalendar from "@/components/agenda/AgendaMonthlyCalendar";
import type { NewLandingKind } from "@/lib/marketingPlans";

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

function AgendaLivePreview({ today, dates }: { today: string; dates: string[] }) {
  const availableDates = useMemo(() => new Set(dates), [dates]);
  const month = `${today.slice(0, 7)}-01`;
  const maxDate = useMemo(() => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 28);
    return date.toISOString().slice(0, 10);
  }, [today]);

  return <div className="w-full rounded-[1.5rem] border border-[#004e28]/10 bg-white p-4 shadow-[0_24px_70px_-40px_rgba(0,78,40,0.32)] sm:p-6">
    <div className="mb-5 border-b border-[#004e28]/10 pb-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#116f04]">Agenda en Drooopy</p>
      <h2 className="mt-2 font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28]">Reserva tu cita</h2>
      <p className="mt-1 text-sm text-[#40554a]">Elige el servicio, la fecha y un horario disponible.</p>
      <div className="mt-4 rounded-xl border border-[#168e00]/25 bg-[#f3faf1] px-4 py-3 text-sm text-[#004e28]">
        <strong>Valoración general</strong><span className="ml-2 text-[#40554a]">1 hora</span>
      </div>
    </div>
    <div className="pointer-events-none" aria-hidden="true">
      <AgendaMonthlyCalendar
        month={month} availableDates={availableDates} selectedDate={null}
        minDate={today} maxDate={maxDate} loading={false}
        onSelectDate={() => {}} onPreviousMonth={() => {}} onNextMonth={() => {}}
      />
    </div>
    <p className="mt-3 text-xs text-[#5f7164]">{dates.length ? "Vista del calendario real de reservaciones." : "La disponibilidad de este ejemplo no está disponible en este momento."}</p>
  </div>;
}

export function MarketingHeroVisual({ kind, today, agendaDates }: { kind: NewLandingKind; today: string; agendaDates: string[] }) {
  if (kind === "agenda") return <AgendaLivePreview today={today} dates={agendaDates} />;
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
