"use client";

import Image from 'next/image';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Store, Utensils, X } from 'lucide-react';
import { MarketingProductVisual } from '@/components/marketing/MarketingVisuals';
import { DemoSupplierAgendaTab } from '@/components/agenda/DemoSupplierAgendaTab';
import { SupplierTheme } from '@/components/supplier/SupplierTheme';
import type { SupplierService } from '@/types/services';

const exampleService: SupplierService = {
  id: 'corte',
  supplier_id: 0,
  title: 'Corte de cabello',
  description: 'Ejemplo de un servicio que tus clientes pueden reservar.',
  price: 250,
  is_active: true,
  is_agenda_only: false,
  images: [],
  created_at: '',
  updated_at: '',
  cover_image_url: null,
  cover_thumbnail_url: null,
  category_id: null,
  subcategory_id: null,
  supplier_category_id: null,
  supplier_subcategory_id: null,
};

const examples = [
  {
    kind: 'products',
    title: 'Tienda en línea',
    description: 'Muestra productos con fotos y precios.',
    action: 'Explorar catálogo',
    planLabel: 'Ver planes para productos',
    image: '/marketing/moderno-buffet-valencia.jpeg',
    alt: 'Buffet Valencia publicado por Moderno Muebles en Drooopy',
    Icon: Store,
  },
  {
    kind: 'agenda',
    title: 'Agenda de citas',
    description: 'Permite que tus clientes elijan servicio y horario.',
    action: 'Probar una reservación',
    planLabel: 'Ver planes con Agenda',
    image: '/agenda.png',
    alt: 'Vista de la agenda de reservaciones en Drooopy',
    Icon: CalendarDays,
  },
  {
    kind: 'menu',
    title: 'Menú digital',
    description: 'Comparte tus platillos y precios con un enlace.',
    action: 'Explorar menú',
    planLabel: 'Ver planes con Menú',
    image: '/marketing/sabora-menu-cover.webp',
    alt: 'Platillos del menú de Sabora en Drooopy',
    Icon: Utensils,
  },
] as const;

type Example = (typeof examples)[number];

export default function SellExamples({ campaignQuery }: { campaignQuery: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [active, setActive] = useState<Example | null>(null);

  const planParams = new URLSearchParams(campaignQuery);
  if (active) planParams.set('necesidad', active.kind);

  return (
    <section id="demos" className="scroll-mt-24 bg-[#f2f3f4] px-5 py-14 sm:px-8 sm:py-20" aria-labelledby="sell-examples-title">
      <div className="mx-auto max-w-7xl">
        <h2 id="sell-examples-title" className="font-[family-name:var(--font-varela-round)] text-3xl text-[#004e28] sm:text-4xl">Así lo verían tus clientes</h2>

        <div className="mt-7 grid gap-5 md:grid-cols-3">
          {examples.map((example) => (
            <article key={example.kind} className="flex flex-col overflow-hidden rounded-2xl border border-[#004e28]/10 bg-white shadow-sm">
              <div className="relative aspect-[16/9] overflow-hidden bg-[#e9eee8]">
                <Image src={example.image} alt={example.alt} fill sizes="(max-width: 767px) 90vw, (max-width: 1280px) 31vw, 400px" className={example.kind === 'agenda' ? 'object-cover object-top' : 'object-cover'} />
              </div>
              <div className="flex flex-1 flex-col items-start p-5 sm:p-6">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-[#004e28]">
                  <example.Icon size={20} aria-hidden="true" className="shrink-0 text-[#168e00]" />
                  {example.title}
                </h3>
                <p className="mb-4 mt-2 text-sm leading-6 text-gray-600">{example.description}</p>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={(event) => {
                    triggerRef.current = event.currentTarget;
                    flushSync(() => setActive(example));
                    dialogRef.current?.showModal();
                  }}
                  className="mt-auto inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#004e28]/20 px-3 text-sm font-semibold text-[#004e28] hover:bg-[#edf6ef] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00]"
                >
                  {example.action} <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="sell-demo-title"
        onClose={() => {
          setActive(null);
          triggerRef.current?.focus({ preventScroll: true });
        }}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1rem)] max-w-5xl overflow-hidden rounded-2xl bg-white text-gray-900 shadow-2xl backdrop:bg-[#001c12]/65 sm:w-[calc(100%-3rem)] sm:rounded-3xl"
      >
        <div className="flex max-h-[calc(100dvh-1.5rem)] flex-col">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#004e28]/10 px-4 py-3 sm:px-6">
            <h2 id="sell-demo-title" className="font-[family-name:var(--font-varela-round)] text-xl text-[#004e28]">{active?.title}</h2>
            <button type="button" autoFocus onClick={() => dialogRef.current?.close()} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#004e28] hover:bg-[#edf6ef]">
              <X size={17} aria-hidden="true" /> Volver a los ejemplos
            </button>
          </header>
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            {active?.kind === 'agenda' ? (
              <SupplierTheme supplier={{}}>
                <DemoSupplierAgendaTab services={[exampleService]} supplierName="la barbería" />
              </SupplierTheme>
            ) : active ? (
              <div className="px-4 pb-6 sm:px-6"><MarketingProductVisual kind={active.kind} /></div>
            ) : null}
          </div>
          {active ? (
            <footer className="flex shrink-0 justify-end border-t border-[#004e28]/10 px-4 py-3 sm:px-6">
              <Link href={`/sell?${planParams}#plans`} onClick={() => dialogRef.current?.close()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#004e28] px-4 py-2 text-sm font-semibold text-white hover:bg-[#116f04] sm:w-auto">
                {active.planLabel} <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </footer>
          ) : null}
        </div>
      </dialog>
    </section>
  );
}
