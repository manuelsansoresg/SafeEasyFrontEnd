import Image from 'next/image';
import { ArrowDown, ArrowRight } from 'lucide-react';

export default function SellHero() {
  return (
    <section className="overflow-hidden bg-[#004e28] text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
        <div>
          <h1 className="max-w-3xl font-[family-name:var(--font-varela-round)] text-4xl leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
            Tu negocio en línea, listo para compartir
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/85 sm:text-lg">
            Crea una página para tu negocio y compártela con tus clientes por WhatsApp o redes sociales. Empieza con el plan más sencillo o elige una tienda en línea desde el primer día.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href="#plans" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-[#004e28] hover:bg-[#eaf8e5]">
              Ver planes y precios <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a href="#demos" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/40 px-5 py-3 font-semibold hover:bg-white/10">
              Probar Drooopy <ArrowDown size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
        <figure className="mx-auto w-full max-w-[340px]">
          <Image src="/directorio.png" alt="Página de un negocio en Drooopy vista desde un celular" width={1122} height={1402} priority sizes="(max-width: 420px) 85vw, 340px" className="h-auto w-full" />
        </figure>
      </div>
    </section>
  );
}
