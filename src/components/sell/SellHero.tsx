import Image from 'next/image';
import { ArrowDown, ArrowRight } from 'lucide-react';

export default function SellHero() {
  return (
    <section className="overflow-hidden bg-[#004e28] bg-[radial-gradient(ellipse_at_78%_60%,#17633d_0%,transparent_55%),linear-gradient(150deg,#004e28_0%,#00331f_100%)] text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:py-16">
        <div>
          <h1 className="max-w-2xl text-balance font-[family-name:var(--font-varela-round)] text-4xl leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem] xl:text-6xl">
            Tu negocio en línea, en un solo enlace
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/85 sm:text-lg">
            Crea una página para tu negocio y compártela por WhatsApp o redes sociales. Empieza con lo básico o abre tu tienda en línea desde el primer día.
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
        <figure className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[1.75rem] border border-white/20 bg-[#f2f3f4] shadow-[0_24px_60px_-24px_#001e13] sm:rounded-[2rem]">
          <Image src="/directorio.png" alt="Página de un negocio en Drooopy vista desde un celular" width={1122} height={1402} priority sizes="(max-width: 420px) 90vw, 360px" className="h-auto w-full" />
        </figure>
      </div>
    </section>
  );
}
