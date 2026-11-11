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
        <div className="mt-7 grid gap-5 md:grid-cols-3">
          {demos.map((demo) => {
            const basePath = `/demos/${encodeURIComponent(demo.slug)}`;
            const image = absoluteMediaUrl(demo.header_image);
            const logo = absoluteMediaUrl(demo.logo);
            return (
              <article key={demo.slug} className="flex flex-col overflow-hidden rounded-2xl border border-[#004e28]/10 bg-white shadow-sm">
                {image ? (
                  <div className="relative aspect-[16/9] overflow-hidden bg-[#e9eee8]">
                    <Image src={image} alt="" fill sizes="(max-width: 767px) 90vw, 400px" className="object-cover" />
                  </div>
                ) : null}
                <div className="flex flex-1 flex-col p-5 sm:p-6">
                  <div className="mb-4 flex items-center gap-3">
                    <div aria-hidden="true" className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#004e28]/10 bg-[#edf6ef]">
                      {logo ? (
                        <Image src={logo} alt="" width={56} height={56} className="size-full bg-white object-contain p-1.5" />
                      ) : (
                        <span className="font-semibold text-[#004e28]">
                          {demo.name.trim().split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0]).join('').toLocaleUpperCase('es-MX')}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="break-words text-lg font-semibold text-[#004e28]">{demo.name}</h3>
                      <p className="mt-1 text-sm leading-6 text-gray-600">Plan de la demo · {demo.plan_name}</p>
                    </div>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-2">
                    {demo.tabs.length ? demo.tabs.map((tab) => (
                      <Link key={tab} href={`${basePath}/${tab}/?${params}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#004e28]/20 px-3 text-sm font-semibold text-[#004e28] hover:bg-[#edf6ef]">
                        {actions[tab]} <ArrowRight size={16} aria-hidden="true" />
                      </Link>
                    )) : (
                      <Link href={`${basePath}/?${params}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#004e28]/20 px-3 text-sm font-semibold text-[#004e28] hover:bg-[#edf6ef]">
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
