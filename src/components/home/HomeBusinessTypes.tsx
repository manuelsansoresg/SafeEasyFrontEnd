"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { BriefcaseBusiness, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { getActiveBusinessTypes } from "@/services/homeService";
import type { BusinessTypePublic } from "@/types/businessType";

export function HomeBusinessTypes() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scroller = useRef<HTMLDivElement>(null);
  const [businessTypes, setBusinessTypes] = useState<BusinessTypePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedSlug = searchParams.get("business_type");

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

  function select(slug: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set("business_type", slug);
    else params.delete("business_type");
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  }

  function scroll(direction: -1 | 1) {
    scroller.current?.scrollBy({ left: direction * 280, behavior: "smooth" });
  }

  if (loading) {
    return <section aria-labelledby="business-types-title" className="py-8">
      <h2 id="business-types-title" className="mb-6 font-[family-name:var(--font-varela-round)] text-xl font-bold text-[#004e28] md:text-3xl">Tipos de negocio</h2>
      <div className="flex gap-3 overflow-hidden md:grid md:grid-cols-6 md:gap-4">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-32 w-32 shrink-0 animate-pulse rounded-2xl bg-gray-100 md:h-40 md:w-auto" />)}</div>
    </section>;
  }

  return (
    <section aria-labelledby="business-types-title" className="relative py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 id="business-types-title" className="font-[family-name:var(--font-varela-round)] text-xl font-bold text-[#004e28] md:text-3xl">Tipos de negocio</h2>
        <div className="flex gap-2 md:hidden">
          <button type="button" onClick={() => scroll(-1)} aria-label="Ver tipos anteriores" className="rounded-full border border-gray-200 bg-white p-2 text-gray-500 shadow-sm"><ChevronLeft size={20} /></button>
          <button type="button" onClick={() => scroll(1)} aria-label="Ver más tipos" className="rounded-full border border-gray-200 bg-white p-2 text-gray-500 shadow-sm"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div ref={scroller} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 scrollbar-thin md:mx-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-6">
        <button type="button" aria-pressed={!selectedSlug} onClick={() => select(null)} className={`group flex h-32 w-32 shrink-0 snap-start flex-col items-center justify-center rounded-2xl border p-3 text-center transition md:h-40 md:w-auto ${!selectedSlug ? "border-[#168e00] bg-[#168e00]/[0.06] shadow-sm" : "border-gray-200 bg-white hover:border-[#168e00]/40 hover:shadow-md"}`}>
          <span className={`mb-3 flex h-14 w-14 items-center justify-center rounded-2xl ${!selectedSlug ? "bg-[#168e00] text-white" : "bg-[#f2f3f4] text-[#004e28] group-hover:text-[#168e00]"}`}><LayoutGrid size={28} strokeWidth={1.6} aria-hidden="true" /></span>
          <span className="font-[family-name:var(--font-varela-round)] text-sm font-bold leading-tight text-[#004e28] md:text-base">Todos</span>
        </button>

        {businessTypes.map((businessType) => {
          const selected = selectedSlug === businessType.slug;
          return <button key={businessType.id} type="button" aria-pressed={selected} onClick={() => select(businessType.slug)} className={`group flex h-32 w-32 shrink-0 snap-start flex-col items-center justify-center rounded-2xl border p-3 text-center transition md:h-40 md:w-auto ${selected ? "border-[#168e00] bg-[#168e00]/[0.06] shadow-sm" : "border-gray-200 bg-white hover:border-[#168e00]/40 hover:shadow-md"}`}>
            <span className="relative mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-[#f2f3f4] md:h-16 md:w-16">
              {businessType.icon_url ? <Image src={businessType.icon_url} alt="" fill sizes="64px" className="object-contain p-2" /> : <BriefcaseBusiness size={28} className="text-[#004e28]" strokeWidth={1.6} aria-hidden="true" />}
            </span>
            <span className="line-clamp-2 w-full break-words font-[family-name:var(--font-varela-round)] text-sm font-bold leading-tight text-[#004e28] md:text-base">{businessType.name}</span>
          </button>;
        })}
      </div>
    </section>
  );
}
