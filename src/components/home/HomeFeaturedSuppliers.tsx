"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { getFeaturedSuppliers, FeaturedSupplier } from "@/services/homeService";

export function HomeFeaturedSuppliers() {
  const [suppliers, setSuppliers] = useState<FeaturedSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 3;

  const fetchSuppliers = async (skipValue: number) => {
    setLoading(true);
    try {
      // Fetch one more item to check if there are more pages
      const data = await getFeaturedSuppliers(skipValue, limit + 1);
      if (data.length > limit) {
        setHasMore(true);
        setSuppliers(data.slice(0, limit));
      } else {
        setHasMore(false);
        setSuppliers(data);
      }
    } catch (error) {
      console.error(error);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers(skip);
  }, [skip]);

  const handleNext = () => {
    if (hasMore) {
      setSkip(prev => prev + limit);
    }
  };

  const handlePrev = () => {
    if (skip >= limit) {
      setSkip(prev => prev - limit);
    }
  };

  return (
    <div className="py-12 bg-gray-50 -mx-4 px-4 md:-mx-8 md:px-8">
      <div className="container mx-auto">
        <h2 className="text-4xl font-bold text-center text-[#004e28] mb-2 font-[family-name:var(--font-varela-round)]">Marcas destacadas</h2>
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
            className="absolute -left-4 md:-left-12 top-1/2 -translate-y-1/2 z-10 p-2 bg-transparent text-gray-300 hover:text-gray-500 disabled:opacity-0 disabled:cursor-default transition-opacity"
          >
            <ChevronLeft size={48} strokeWidth={1} />
          </button>
          
          <button 
            onClick={handleNext}
            disabled={!hasMore}
            className="absolute -right-4 md:-right-12 top-1/2 -translate-y-1/2 z-10 p-2 bg-transparent text-gray-300 hover:text-gray-500 disabled:opacity-0 disabled:cursor-default transition-opacity"
          >
            <ChevronRight size={48} strokeWidth={1} />
          </button>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {loading ? (
               [1, 2, 3].map((i) => (
                 <div key={i} className="bg-white rounded-2xl h-80 animate-pulse"></div>
               ))
            ) : (
              suppliers.map((supplier) => (
                <Link 
                  href={`/empresas/${supplier.slug}`}
                  key={supplier.id}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col h-full"
                >
                  <div className="relative h-48 w-full bg-gray-200">
                    {supplier.logo ? (
                      <Image
                        src={supplier.logo}
                        alt={supplier.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <span className="text-4xl font-bold opacity-20">{supplier.name.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-full border border-gray-100 overflow-hidden relative flex-shrink-0 bg-white shadow-sm">
                        {supplier.logo ? (
                             <Image
                                src={supplier.logo}
                                alt={supplier.name}
                                fill
                                className="object-contain p-1"
                              />
                        ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold">
                                {supplier.name.charAt(0)}
                            </div>
                        )}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg group-hover:text-[#004e28] transition-colors uppercase leading-tight">
                          {supplier.name}
                        </h3>
                        <p className="text-sm text-gray-500 font-medium mt-1">
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
