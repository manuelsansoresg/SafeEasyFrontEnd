"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { getActiveBusinessTypes, getFeaturedSuppliers, type FeaturedSupplier } from "@/services/homeService";

export function HomeFeaturedSuppliers({ businessTypeSlug }: { businessTypeSlug?: string }) {
  const [suppliers, setSuppliers] = useState<FeaturedSupplier[]>([]);
  const [businessTypeName, setBusinessTypeName] = useState("");
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const requestVersion = useRef(0);
  const limit = 3;

  const fetchSuppliers = useCallback(async (skipValue: number, version = ++requestVersion.current) => {
    setLoading(true);
    try {
      const data = await getFeaturedSuppliers(skipValue, limit + 1, businessTypeSlug);
      if (version !== requestVersion.current) return;
      setHasMore(data.length > limit);
      setSuppliers(data.slice(0, limit));
    } catch (error) {
      console.error(error);
      if (version === requestVersion.current) {
        setSuppliers([]);
        setHasMore(false);
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [businessTypeSlug]);

  useEffect(() => {
    let active = true;
    const version = ++requestVersion.current;
    setSkip(0);
    setSuppliers([]);
    setBusinessTypeName("");

    async function load() {
      if (businessTypeSlug) {
        const businessTypes = await getActiveBusinessTypes();
        if (active) {
          setBusinessTypeName(businessTypes.find((item) => item.slug === businessTypeSlug)?.name || businessTypeSlug);
        }
      }
      if (active) await fetchSuppliers(0, version);
    }
    void load();
    return () => {
      active = false;
      if (requestVersion.current === version) requestVersion.current += 1;
    };
  }, [businessTypeSlug, fetchSuppliers]);

  const handleNext = () => {
    if (hasMore) {
      const nextSkip = skip + limit;
      setSkip(nextSkip);
      void fetchSuppliers(nextSkip);
    }
  };

  const handlePrev = () => {
    if (skip >= limit) {
      const nextSkip = Math.max(0, skip - limit);
      setSkip(nextSkip);
      void fetchSuppliers(nextSkip);
    }
  };

  return (
    <div className="py-12 bg-[#f2f3f4] -mx-4 px-4 md:-mx-8 md:px-8">
      <div className="container mx-auto">
        <h2 className="text-xl md:text-4xl font-bold text-center text-[#004e28] mb-2 font-[family-name:var(--font-varela-round)]">{businessTypeSlug ? `Empresas destacadas de ${businessTypeName}` : "Empresas destacadas"}</h2>
        <div className="flex justify-center gap-1 mb-8 text-yellow-400">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star key={star} size={20} fill="currentColor" className="text-yellow-400" />
          ))}
        </div>

        <div className="relative">
          {/* Arrows */}
          <button 
            onClick={handlePrev}
            disabled={skip === 0}
            className="absolute -left-2 md:-left-12 top-1/2 -translate-y-1/2 z-10 p-1 md:p-2 bg-white/80 md:bg-transparent rounded-full md:rounded-none text-gray-400 hover:text-gray-600 disabled:opacity-0 disabled:cursor-default transition-all shadow-sm md:shadow-none border md:border-0 border-gray-100"
          >
            <ChevronLeft className="w-6 h-6 md:w-12 md:h-12" strokeWidth={1} />
          </button>
          
          <button 
            onClick={handleNext}
            disabled={!hasMore}
            className="absolute -right-2 md:-right-12 top-1/2 -translate-y-1/2 z-10 p-1 md:p-2 bg-white/80 md:bg-transparent rounded-full md:rounded-none text-gray-400 hover:text-gray-600 disabled:opacity-0 disabled:cursor-default transition-all shadow-sm md:shadow-none border md:border-0 border-gray-100"
          >
            <ChevronRight className="w-6 h-6 md:w-12 md:h-12" strokeWidth={1} />
          </button>

          {/* Grid */}
          <div className="flex overflow-x-auto pb-4 md:pb-0 gap-3 md:grid md:grid-cols-3 md:gap-6 snap-x snap-mandatory scrollbar-thin md:scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            {loading ? (
               [1, 2, 3].map((i) => (
                 <div key={i} className="flex-shrink-0 w-[45%] md:w-auto bg-white rounded-2xl h-48 md:h-80 animate-pulse snap-center"></div>
               ))
            ) : suppliers.length === 0 ? (
              <div className="col-span-full w-full rounded-2xl border border-gray-200 bg-white px-5 py-10 text-center text-sm text-gray-500">
                {businessTypeSlug ? "No hay empresas destacadas en este tipo por el momento." : "No hay empresas destacadas por el momento."}
              </div>
            ) : (
              suppliers.map((supplier) => (
                <Link 
                  href={`/empresas/${supplier.slug}`}
                  key={supplier.id}
                  className="flex-shrink-0 w-[45%] md:w-auto bg-white rounded-xl md:rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col h-full snap-center border border-gray-100"
                >
                  <div className={`relative h-24 md:h-48 w-full ${supplier.logo ? "bg-white" : "bg-gray-200"}`}>
                    {supplier.logo ? (
                      <Image
                        src={supplier.logo}
                        alt={supplier.name}
                        fill
                        className="object-contain p-4 md:p-6"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <span className="text-2xl md:text-4xl font-bold opacity-20">{supplier.name.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-3 md:p-4 flex items-center gap-2 md:gap-4 flex-1">
                    <div className="w-8 h-8 md:w-12 md:h-12 rounded-full border border-gray-100 overflow-hidden relative flex-shrink-0 bg-white shadow-sm">
                        {supplier.logo ? (
                             <Image
                                src={supplier.logo}
                                alt={supplier.name}
                                fill
                                className="object-contain p-0.5 md:p-1"
                              />
                        ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-xs md:text-base">
                                {supplier.name.charAt(0)}
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="font-bold text-gray-900 text-sm md:text-lg group-hover:text-[#004e28] transition-colors uppercase leading-tight truncate">
                            {supplier.name}
                          </h3>
                          {supplier.is_verified ? (
                            <span className="inline-flex items-center" title="Empresa verificada">
                              <CheckCircle size={14} className="text-[#168e00]" />
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[10px] md:text-sm text-gray-500 font-medium mt-0.5 md:mt-1 truncate">
                          +{supplier.views || 0} visitas
                        </p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
