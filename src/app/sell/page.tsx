import type { Metadata } from 'next';
import { campaignWhatsAppUrl } from '@/lib/marketingCampaign';
import { buildMetadata } from '@/lib/seo';
import SellHero from '@/components/sell/SellHero';
import SellExamples from '@/components/sell/SellExamples';
import SellPlans from '@/components/sell/SellPlans';
import { getSellDemos } from '@/lib/demoProfile';
import { sellCampaignParams } from '@/lib/sellCampaignParams';
import SellFAQ from '@/components/sell/SellFAQ';

type SearchParams = { [key: string]: string | string[] | undefined };

export const metadata: Metadata = buildMetadata({
  title: 'Publica tu negocio o crea tu tienda en línea | Drooopy',
  description: 'Empieza con una página para tu negocio o elige una tienda en línea. Prueba los ejemplos de catálogo, citas y menú antes de elegir tu plan.',
  path: '/sell',
});

const steps = [
  { title: 'Elige cómo empezar', text: 'Compara una página para tu negocio con los planes que te permiten publicar productos o usar herramientas como Agenda y Menú.' },
  { title: 'Personaliza tu página', text: 'Agrega el nombre, las fotos y la información de tu negocio. Publica tus productos o servicios según tu plan.' },
  { title: 'Comparte tu enlace', text: 'Envíalo por WhatsApp, publícalo en redes o agrégalo a tu perfil para que tus clientes te encuentren.' },
];

export default async function SellPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [params, demos] = await Promise.all([searchParams, getSellDemos()]);
  const accessCode = typeof params.code === 'string' ? params.code.trim() : '';
  const intent = params.necesidad === 'products' || params.necesidad === 'agenda' || params.necesidad === 'menu' ? params.necesidad : undefined;

  const campaignQuery = sellCampaignParams(params).toString();
  const demo = demos.find((item) => item.slug === params.demo);

  return (
    <main className="min-h-screen pt-20 xl:pt-24">
      <SellHero hasDemos={demos.length > 0} />
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16" aria-labelledby="sell-how-title">
        <h2 id="sell-how-title" className="font-[family-name:var(--font-varela-round)] text-3xl text-[#004e28] sm:text-4xl">Cómo funciona Drooopy</h2>
        <ol className="mt-7 grid gap-5 md:grid-cols-3">
          {steps.map(({ title, text }, index) => (
            <li key={title} className="rounded-2xl border border-[#004e28]/10 p-5 sm:p-6">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-[#edf6ef] font-semibold text-[#004e28]" aria-hidden="true">{index + 1}</span>
              <h3 className="mt-3 text-lg font-semibold text-[#004e28]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{text}</p>
            </li>
          ))}
        </ol>
      </section>
      <SellExamples demos={demos} campaignQuery={campaignQuery} />
      <SellPlans accessCode={accessCode} intent={intent} featuredPlanId={demo?.public_plan_id ?? undefined} campaignQuery={campaignQuery} />
      <SellFAQ />
      <section className="bg-[#004e28] px-5 py-12 text-center text-white">
        <h2 className="font-[family-name:var(--font-varela-round)] text-3xl">¿Tienes dudas sobre qué plan elegir?</h2>
        <a href={campaignWhatsAppUrl(intent ?? 'directory')} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-white px-5 py-3 font-semibold text-[#004e28] hover:bg-[#eaf8e5]">
          Preguntar por WhatsApp
        </a>
      </section>
    </main>
  );
}
