"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { BriefcaseBusiness, Check, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { getActiveBusinessTypes } from "@/services/homeService";
import type { BusinessTypePublic } from "@/types/businessType";

export function HomeBusinessTypes({
  initialBusinessType,
  initialIsDirectory,
}: {
  initialBusinessType?: string;
  initialIsDirectory?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scroller = useRef<HTMLDivElement>(null);
  const [businessTypes, setBusinessTypes] = useState<BusinessTypePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedSlug = initialBusinessType || null;

  useEffect(() => {
    let active = true;
    async function load() {
      const items = await getActiveBusinessTypes();
      if (active) {
        setBusinessTypes(items);
        setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  function select(slug: string | null, isDirectory?: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("category");
    params.delete("subcategory");
    if (slug) {
      params.delete("is_directory");
      params.set("business_type", slug);
    } else if (isDirectory !== undefined) {
      params.delete("business_type");
      params.set("is_directory", String(isDirectory));
    } else {
      params.delete("business_type");
      params.delete("is_directory");
    }
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }

  function scroll(direction: -1 | 1) {
    scroller.current?.scrollBy({ left: direction * 280, behavior: "smooth" });
  }

  if (loading) {
    return <section aria-labelledby="explore-businesses-title" className="py-8">
      <div className="mb-6">
        <h2 id="explore-businesses-title" className="font-[family-name:var(--font-varela-round)] text-2xl font-bold text-[#004e28] md:text-3xl">Explora negocios</h2>
        <p className="mt-1 text-sm text-gray-500 md:text-base">Encuentra tiendas, servicios y negocios cerca de ti.</p>
      </div>
      <div className="flex gap-3 overflow-hidden md:grid md:grid-cols-6 md:gap-4">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-40 w-32 shrink-0 animate-pulse rounded-3xl bg-gray-100 md:h-48 md:w-auto" />)}</div>
    </section>;
  }

  return (
    <section aria-labelledby="explore-businesses-title" className="relative py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 id="explore-businesses-title" className="font-[family-name:var(--font-varela-round)] text-2xl font-bold text-[#004e28] md:text-3xl">Explora negocios</h2>
          <p className="mt-1 text-sm text-gray-500 md:text-base">Encuentra tiendas, servicios y negocios cerca de ti.</p>
        </div>
        <div className="flex gap-2 md:hidden">
          <button type="button" onClick={() => scroll(-1)} aria-label="Ver opciones anteriores" className="rounded-full border border-gray-200 bg-white p-2 text-gray-500 shadow-sm"><ChevronLeft size={20} /></button>
          <button type="button" onClick={() => scroll(1)} aria-label="Ver más opciones" className="rounded-full border border-gray-200 bg-white p-2 text-gray-500 shadow-sm"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div ref={scroller} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 scrollbar-thin md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-6">
        <button type="button" aria-pressed={!selectedSlug && initialIsDirectory === undefined} onClick={() => select(null)} className={`group relative flex h-40 w-32 shrink-0 snap-start flex-col items-center justify-center gap-3 rounded-3xl border p-3 text-center shadow-[0_3px_14px_rgba(0,78,40,0.06)] transition-all duration-300 md:h-48 md:w-auto md:p-4 md:hover:-translate-y-1 ${!selectedSlug && initialIsDirectory === undefined ? "border-[#168e00] bg-[#168e00]/[0.06] shadow-[0_8px_24px_rgba(22,142,0,0.12)] ring-1 ring-[#168e00]/20" : "border-gray-200 bg-white hover:border-[#168e00]/40 hover:shadow-lg"}`}>
          {!selectedSlug && initialIsDirectory === undefined ? <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#168e00] text-white"><Check size={14} strokeWidth={2.5} aria-hidden="true" /></span> : null}
          <span className={`flex h-20 w-20 items-center justify-center rounded-3xl md:h-24 md:w-24 ${!selectedSlug && initialIsDirectory === undefined ? "bg-[#168e00] text-white" : "bg-[#f2f3f4] text-[#004e28] group-hover:text-[#168e00]"}`}><LayoutGrid className="h-12 w-12 md:h-16 md:w-16" strokeWidth={1.6} aria-hidden="true" /></span>
          <span className="line-clamp-2 w-full font-[family-name:var(--font-varela-round)] text-sm font-bold leading-tight text-[#004e28] md:text-lg">Todos</span>
        </button>

        <button type="button" aria-pressed={initialIsDirectory === false} onClick={() => select(null, false)} className={`group relative flex h-40 w-32 shrink-0 snap-start flex-col items-center justify-center gap-3 rounded-3xl border p-3 text-center shadow-[0_3px_14px_rgba(0,78,40,0.06)] transition-all duration-300 md:h-48 md:w-auto md:p-4 md:hover:-translate-y-1 ${initialIsDirectory === false ? "border-[#168e00] bg-[#168e00]/[0.06] shadow-[0_8px_24px_rgba(22,142,0,0.12)] ring-1 ring-[#168e00]/20" : "border-gray-200 bg-white hover:border-[#168e00]/40 hover:shadow-lg"}`}>
          {initialIsDirectory === false ? <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#168e00] text-white"><Check size={14} strokeWidth={2.5} aria-hidden="true" /></span> : null}
          <span className="relative flex h-20 w-20 items-center justify-center md:h-24 md:w-24">
            <Image src="/clasificacion/tienda_en_linea.png" alt="" fill sizes="96px" className="object-contain" />
          </span>
          <span className="line-clamp-2 w-full font-[family-name:var(--font-varela-round)] text-sm font-bold leading-tight text-[#004e28] md:text-lg">Tienda en línea</span>
        </button>

        <button type="button" aria-pressed={initialIsDirectory === true} onClick={() => select(null, true)} className={`group relative flex h-40 w-32 shrink-0 snap-start flex-col items-center justify-center gap-3 rounded-3xl border p-3 text-center shadow-[0_3px_14px_rgba(0,78,40,0.06)] transition-all duration-300 md:h-48 md:w-auto md:p-4 md:hover:-translate-y-1 ${initialIsDirectory === true ? "border-[#168e00] bg-[#168e00]/[0.06] shadow-[0_8px_24px_rgba(22,142,0,0.12)] ring-1 ring-[#168e00]/20" : "border-gray-200 bg-white hover:border-[#168e00]/40 hover:shadow-lg"}`}>
          {initialIsDirectory === true ? <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#168e00] text-white"><Check size={14} strokeWidth={2.5} aria-hidden="true" /></span> : null}
          <span className="relative flex h-20 w-20 items-center justify-center md:h-24 md:w-24">
            <Image src="/clasificacion/directorio.png" alt="" fill sizes="96px" className="scale-[1.45] object-contain" />
          </span>
          <span className="line-clamp-2 w-full font-[family-name:var(--font-varela-round)] text-sm font-bold leading-tight text-[#004e28] md:text-lg">Directorio</span>
        </button>

        {businessTypes.map((businessType) => {
          const selected = selectedSlug === businessType.slug;
          return <button key={businessType.id} type="button" aria-pressed={selected} onClick={() => select(businessType.slug)} className={`group relative flex h-40 w-32 shrink-0 snap-start flex-col items-center justify-center gap-3 rounded-3xl border p-3 text-center shadow-[0_3px_14px_rgba(0,78,40,0.06)] transition-all duration-300 md:h-48 md:w-auto md:p-4 md:hover:-translate-y-1 ${selected ? "border-[#168e00] bg-[#168e00]/[0.06] shadow-[0_8px_24px_rgba(22,142,0,0.12)] ring-1 ring-[#168e00]/20" : "border-gray-200 bg-white hover:border-[#168e00]/40 hover:shadow-lg"}`}>
            {selected ? <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#168e00] text-white"><Check size={14} strokeWidth={2.5} aria-hidden="true" /></span> : null}
            <span className="relative flex h-20 w-20 items-center justify-center md:h-24 md:w-24">
              {businessType.icon_url ? <Image src={businessType.icon_url} alt="" fill sizes="96px" className="scale-[1.45] object-contain" /> : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f2f3f4] md:h-20 md:w-20"><BriefcaseBusiness className="h-10 w-10 text-[#004e28] md:h-12 md:w-12" strokeWidth={1.6} aria-hidden="true" /></span>}
            </span>
            <span className="line-clamp-2 w-full break-words font-[family-name:var(--font-varela-round)] text-sm font-bold leading-tight text-[#004e28] md:text-lg">{businessType.name}</span>
          </button>;
        })}
      </div>
    </section>
  );
}
