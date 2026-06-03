"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { getFeaturedProducts, FeaturedProduct } from "@/services/homeService";

export function HomeFeaturedProducts() {
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 3;

  const fetchProducts = async (skipValue: number) => {
    setLoading(true);
    try {
      // Fetch one more item to check if there are more pages
      const data = await getFeaturedProducts(skipValue, limit + 1);
      if (data.length > limit) {
        setHasMore(true);
        setProducts(data.slice(0, limit));
      } else {
        setHasMore(false);
        setProducts(data);
      }
    } catch (error) {
      console.error(error);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(skip);
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
    <div className="py-12 bg-[#f2f3f4]">
      <div className="container mx-auto">
        <h2 className="text-xl md:text-4xl font-bold text-center text-[#004e28] mb-2 font-[family-name:var(--font-varela-round)]">Productos destacados</h2>
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
                 <div key={i} className="flex-shrink-0 w-[45%] md:w-auto bg-gray-50 rounded-xl md:rounded-2xl h-48 md:h-80 animate-pulse snap-center"></div>
               ))
            ) : (
              products.map((product) => (
                <Link 
                  href={`/product/${product.slug || product.id}`}
                  key={product.id}
                  className="flex-shrink-0 w-[45%] md:w-auto bg-white rounded-xl md:rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all group border border-gray-100 h-full flex flex-col snap-center"
                >
                  <div className="relative aspect-[4/3] w-full bg-gray-50">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={product.title}
                        fill
                        className="object-cover object-center group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <span className="text-2xl md:text-4xl font-bold opacity-20">{product.title.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-2 md:p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-gray-900 text-sm md:text-lg group-hover:text-[#004e28] transition-colors line-clamp-2 leading-tight mb-1 md:mb-2">
                        {product.title}
                    </h3>
                    
                    <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-0.5 md:gap-1 text-yellow-400 text-xs md:text-sm">
                            <Star className="w-3 h-3 md:w-4 md:h-4" fill="currentColor" />
                            <span className="text-gray-600 font-medium ml-0.5 md:ml-1">{product.average_rating || 0}</span>
                        </div>
                        <p className="text-[10px] md:text-xs text-gray-400 font-medium">
                          +{product.views || 0} vistas
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
