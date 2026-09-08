"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { BriefcaseBusiness, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
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
  const [scrollState, setScrollState] = useState({ canGoBack: false, canGoForward: false });
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

  useEffect(() => {
    if (loading) return;
    const element = scroller.current;
    if (!element) return;

    const updateScrollState = () => {
      const maxScrollLeft = element.scrollWidth - element.clientWidth;
      const startScrollLeft = Math.max(0, -element.offsetLeft);
      const nextState = {
        canGoBack: element.scrollLeft > startScrollLeft + 2,
        canGoForward: element.scrollLeft < maxScrollLeft - 2,
      };
      setScrollState((current) =>
        current.canGoBack === nextState.canGoBack && current.canGoForward === nextState.canGoForward
          ? current
          : nextState,
      );
    };

    updateScrollState();
    element.addEventListener("scroll", updateScrollState, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(element);
    return () => {
      element.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
    };
  }, [businessTypes.length, loading]);

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
    const element = scroller.current;
    if (!element) return;
    element.scrollBy({ left: direction * Math.max(element.clientWidth * 0.8, 280), behavior: "smooth" });
  }

  if (loading) {
    return <section aria-labelledby="explore-businesses-title" className="py-8">
      <div className="mb-6">
        <h2 id="explore-businesses-title" className="font-[family-name:var(--font-varela-round)] text-2xl font-bold text-[#004e28] md:text-3xl">Explora negocios</h2>
        <p className="mt-1 text-sm text-gray-500 md:text-base">Encuentra tiendas, servicios y negocios cerca de ti.</p>
      </div>
      <div className="flex gap-4 overflow-hidden md:grid md:grid-cols-6 md:gap-x-6 md:gap-y-5">{Array.from({ length: 6 }, (_, index) => <div key={index} className="flex w-32 shrink-0 animate-pulse flex-col items-center gap-3 py-3 md:w-auto md:py-4"><span className="h-20 w-20 rounded-full bg-gray-100 md:h-24 md:w-24" /><span className="h-4 w-20 rounded-full bg-gray-100" /></div>)}</div>
    </section>;
  }

  return (
    <section aria-labelledby="explore-businesses-title" className="relative py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 id="explore-businesses-title" className="font-[family-name:var(--font-varela-round)] text-2xl font-bold text-[#004e28] md:text-3xl">Explora negocios</h2>
          <p className="mt-1 text-sm text-gray-500 md:text-base">Encuentra tiendas, servicios y negocios cerca de ti.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => scroll(-1)} disabled={!scrollState.canGoBack} aria-label="Ver opciones anteriores" className="rounded-full border border-gray-200 bg-white p-2 text-[#004e28] shadow-sm transition hover:border-[#168e00] hover:text-[#168e00] disabled:cursor-default disabled:opacity-30"><ChevronLeft size={20} /></button>
          <button type="button" onClick={() => scroll(1)} disabled={!scrollState.canGoForward} aria-label="Ver más opciones" className="rounded-full border border-gray-200 bg-white p-2 text-[#004e28] shadow-sm transition hover:border-[#168e00] hover:text-[#168e00] disabled:cursor-default disabled:opacity-30"><ChevronRight size={20} /></button>
        </div>
      </div>

      <div ref={scroller} className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-hidden scroll-smooth px-4 pb-3 md:mx-0 md:gap-6 md:px-0 md:pb-0">
        <button type="button" aria-pressed={!selectedSlug && initialIsDirectory === undefined} onClick={() => select(null)} className="group flex w-32 shrink-0 snap-start flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00]/40 md:w-[calc((100%_-_7.5rem)/6)] md:px-3 md:py-4">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center transition-transform duration-300 md:h-24 md:w-24 md:group-hover:-translate-y-1 md:group-hover:scale-[1.03]">
            <span className={`flex h-16 w-16 items-center justify-center rounded-full md:h-[72px] md:w-[72px] ${!selectedSlug && initialIsDirectory === undefined ? "bg-[#168e00] text-white" : "bg-[#f2f3f4] text-[#004e28] group-hover:text-[#168e00]"}`}><LayoutGrid className="h-8 w-8 md:h-9 md:w-9" strokeWidth={1.6} aria-hidden="true" /></span>
          </span>
          <span className={`line-clamp-2 w-full font-[family-name:var(--font-varela-round)] text-sm font-bold leading-tight transition-colors md:text-lg ${!selectedSlug && initialIsDirectory === undefined ? "text-[#168e00]" : "text-[#004e28] group-hover:text-[#168e00]"}`}>Todos</span>
          <span aria-hidden="true" className={`h-1 w-8 rounded-full transition-colors ${!selectedSlug && initialIsDirectory === undefined ? "bg-[#168e00]" : "bg-transparent group-hover:bg-[#168e00]/25"}`} />
        </button>

        <button type="button" aria-pressed={initialIsDirectory === false} onClick={() => select(null, false)} className="group flex w-32 shrink-0 snap-start flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00]/40 md:w-[calc((100%_-_7.5rem)/6)] md:px-3 md:py-4">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center transition-transform duration-300 md:h-24 md:w-24 md:group-hover:-translate-y-1 md:group-hover:scale-[1.03]">
            <span className="block h-[72px] w-[72px] shrink-0 md:h-[84px] md:w-[84px]">
              <Image src="/clasificacion/tienda_en_linea.png" alt="" width={84} height={84} unoptimized className="h-full w-full object-contain" />
            </span>
          </span>
          <span className={`line-clamp-2 w-full font-[family-name:var(--font-varela-round)] text-sm font-bold leading-tight transition-colors md:text-lg ${initialIsDirectory === false ? "text-[#168e00]" : "text-[#004e28] group-hover:text-[#168e00]"}`}>Tienda en línea</span>
          <span aria-hidden="true" className={`h-1 w-8 rounded-full transition-colors ${initialIsDirectory === false ? "bg-[#168e00]" : "bg-transparent group-hover:bg-[#168e00]/25"}`} />
        </button>

        <button type="button" aria-pressed={initialIsDirectory === true} onClick={() => select(null, true)} className="group flex w-32 shrink-0 snap-start flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00]/40 md:w-[calc((100%_-_7.5rem)/6)] md:px-3 md:py-4">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center transition-transform duration-300 md:h-24 md:w-24 md:group-hover:-translate-y-1 md:group-hover:scale-[1.03]">
            <span className="block h-[72px] w-[72px] shrink-0 md:h-[84px] md:w-[84px]">
              <Image src="/clasificacion/directorio.png" alt="" width={84} height={84} unoptimized className="h-full w-full scale-[1.45] object-contain" />
            </span>
          </span>
          <span className={`line-clamp-2 w-full font-[family-name:var(--font-varela-round)] text-sm font-bold leading-tight transition-colors md:text-lg ${initialIsDirectory === true ? "text-[#168e00]" : "text-[#004e28] group-hover:text-[#168e00]"}`}>Directorio</span>
          <span aria-hidden="true" className={`h-1 w-8 rounded-full transition-colors ${initialIsDirectory === true ? "bg-[#168e00]" : "bg-transparent group-hover:bg-[#168e00]/25"}`} />
        </button>

        {businessTypes.map((businessType) => {
          const selected = selectedSlug === businessType.slug;
          return <button key={businessType.id} type="button" aria-pressed={selected} onClick={() => select(businessType.slug)} className="group flex w-32 shrink-0 snap-start flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00]/40 md:w-[calc((100%_-_7.5rem)/6)] md:px-3 md:py-4">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center transition-transform duration-300 md:h-24 md:w-24 md:group-hover:-translate-y-1 md:group-hover:scale-[1.03]">
              {businessType.icon_url ? <span className="block h-[72px] w-[72px] shrink-0 md:h-[84px] md:w-[84px]"><Image src={businessType.icon_url} alt="" width={84} height={84} unoptimized className="h-full w-full scale-[1.45] object-contain" /></span> : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f2f3f4] md:h-[72px] md:w-[72px]"><BriefcaseBusiness className="h-8 w-8 text-[#004e28] md:h-9 md:w-9" strokeWidth={1.6} aria-hidden="true" /></span>}
            </span>
            <span className={`line-clamp-2 w-full break-words font-[family-name:var(--font-varela-round)] text-sm font-bold leading-tight transition-colors md:text-lg ${selected ? "text-[#168e00]" : "text-[#004e28] group-hover:text-[#168e00]"}`}>{businessType.name}</span>
            <span aria-hidden="true" className={`h-1 w-8 rounded-full transition-colors ${selected ? "bg-[#168e00]" : "bg-transparent group-hover:bg-[#168e00]/25"}`} />
          </button>;
        })}
      </div>
    </section>
  );
}
