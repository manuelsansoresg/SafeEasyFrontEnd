import Link from 'next/link';
import { ArrowRight, CalendarDays, ChevronDown, Store, Utensils } from 'lucide-react';
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
  { kind: 'products', title: 'Vende productos', description: 'Muestra tus productos con fotos y precios en tu tienda.', action: 'Explorar catálogo de ejemplo', Icon: Store },
  { kind: 'agenda', title: 'Recibe citas', description: 'Tus clientes eligen un servicio, una fecha y un horario.', action: 'Probar una reservación', Icon: CalendarDays },
  { kind: 'menu', title: 'Muestra tu menú', description: 'Comparte tus platillos y precios con un enlace.', action: 'Explorar menú de ejemplo', Icon: Utensils },
] as const;

export default function SellExamples({ campaignQuery }: { campaignQuery: string }) {
  return (
    <section id="demos" className="scroll-mt-24 bg-[#f2f3f4] px-5 py-14 sm:px-8 sm:py-20" aria-labelledby="sell-examples-title">
      <div className="mx-auto max-w-5xl">
        <h2 id="sell-examples-title" className="font-[family-name:var(--font-varela-round)] text-3xl text-[#004e28] sm:text-4xl">Así lo verían tus clientes</h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-gray-600">Explora un ejemplo según lo que quieras hacer con tu negocio.</p>

        <div className="mt-7 divide-y divide-[#004e28]/10 overflow-hidden rounded-3xl border border-[#004e28]/10 bg-white">
          {examples.map(({ kind, title, description, action, Icon }) => {
            const params = new URLSearchParams(campaignQuery);
            params.set('necesidad', kind);
            return (
              <details key={kind} className="group">
                <summary className="flex min-h-14 cursor-pointer list-none items-start gap-4 p-5 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#168e00] sm:items-center sm:p-6 [&::-webkit-details-marker]:hidden">
                  <Icon aria-hidden="true" className="mt-1 shrink-0 text-[#168e00] sm:mt-0" size={23} />
                  <span className="flex-1">
                    <span className="block text-lg font-semibold text-[#004e28]">{title}</span>
                    <span className="mt-0.5 block text-sm leading-6 text-gray-600">{description}</span>
                    <span className="mt-2 block text-sm font-semibold text-[#004e28]">{action}</span>
                  </span>
                  <ChevronDown className="mt-1 shrink-0 text-[#004e28] transition-transform group-open:rotate-180 sm:mt-0" aria-hidden="true" size={20} />
                </summary>
                <div className="border-t border-[#004e28]/10">
                  {kind === 'agenda' ? (
                    <SupplierTheme supplier={{}}><DemoSupplierAgendaTab services={[exampleService]} supplierName="la barbería" /></SupplierTheme>
                  ) : (
                    <div className="px-4 sm:px-6"><MarketingProductVisual kind={kind} /></div>
                  )}
                  <Link href={`/sell?${params}#plans`} scroll className="m-4 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#004e28] px-4 sm:m-6 py-2 text-sm font-semibold text-white hover:bg-[#116f04]">
                    Ver planes para {kind === 'products' ? 'productos' : kind === 'agenda' ? 'citas' : 'menú'} <ArrowRight aria-hidden="true" size={16} />
                  </Link>
                </div>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}
