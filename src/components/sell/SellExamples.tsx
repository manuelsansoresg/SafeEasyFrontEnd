import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { SellDemo } from '@/lib/demoProfile';
import { absoluteMediaUrl } from '@/lib/seo';

const actions = {
  productos: 'Visitar tienda',
  agenda: 'Probar agenda',
  menu: 'Explorar menú',
};

export default function SellExamples({ demos, campaignQuery }: { demos: SellDemo[]; campaignQuery: string }) {
  if (!demos.length) return null;

  const params = new URLSearchParams(campaignQuery);
  params.set('desde', 'sell');

  return (
    <section id="demos" className="scroll-mt-24 bg-[#f2f3f4] px-5 py-14 sm:px-8 sm:py-20" aria-labelledby="sell-examples-title">
      <div className="mx-auto max-w-7xl">
        <h2 id="sell-examples-title" className="font-[family-name:var(--font-varela-round)] text-3xl text-[#004e28] sm:text-4xl">Así lo verían tus clientes</h2>
        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {demos.map((demo) => {
            const basePath = `/demos/${encodeURIComponent(demo.slug)}`;
            const image = absoluteMediaUrl(demo.header_image);
            const logo = absoluteMediaUrl(demo.logo);
            return (
              <article key={demo.slug} className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-[0_8px_24px_-16px_#004e2840] transition-shadow hover:shadow-[0_12px_30px_-16px_#004e2870]">
                {image ? (
                  <div className="relative aspect-[16/9] overflow-hidden bg-[#e9eee8]">
                    <Image src={image} alt="" fill sizes="(max-width: 767px) 90vw, 400px" className="object-cover" />
                  </div>
                ) : null}
                <div className="flex flex-1 flex-col items-center px-6 py-7 text-center sm:px-7 sm:py-8">
                  {logo ? (
                    <Image src={logo} alt="" width={112} height={112} sizes="(min-width: 640px) 112px, 96px" className="size-24 object-contain sm:size-28" />
                  ) : (
                    <span aria-hidden="true" className="grid size-24 place-items-center text-4xl font-semibold text-[#004e28] sm:size-28">
                      {demo.name.trim().split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0]).join('').toLocaleUpperCase('es-MX')}
                    </span>
                  )}
                  <h3 className="mt-4 w-full break-words text-xl font-semibold leading-snug text-[#004e28]">{demo.name}</h3>
                  <p className="mb-5 mt-1.5 text-sm leading-6 text-gray-600">Plan de la demo · {demo.plan_name}</p>
                  <div className="mt-auto flex flex-wrap justify-center gap-2">
                    {demo.tabs.length ? demo.tabs.map((tab) => (
                      <Link key={tab} href={`${basePath}/${tab}/?${params}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#edf6ef] px-4 text-sm font-semibold text-[#004e28] transition-colors hover:bg-[#004e28] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00]">
                        {actions[tab]} <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    )) : (
                      <Link href={`${basePath}/?${params}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#edf6ef] px-4 text-sm font-semibold text-[#004e28] transition-colors hover:bg-[#004e28] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00]">
                        Visitar demo <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
