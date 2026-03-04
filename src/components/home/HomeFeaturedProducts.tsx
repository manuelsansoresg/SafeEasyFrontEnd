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
    <div className="py-12 bg-white">
      <div className="container mx-auto">
        <h2 className="text-4xl font-bold text-center text-[#004e28] mb-2 font-[family-name:var(--font-varela-round)]">Productos destacados</h2>
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
                 <div key={i} className="bg-gray-50 rounded-2xl h-80 animate-pulse"></div>
               ))
            ) : (
              products.map((product) => (
                <Link 
                  href={`/products/${product.slug}`}
                  key={product.id}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all group border border-gray-100 h-full flex flex-col"
                >
                  <div className="relative h-48 w-full bg-gray-50">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={product.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400">
                        <span className="text-4xl font-bold opacity-20">{product.title.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-bold text-gray-900 text-lg group-hover:text-[#004e28] transition-colors line-clamp-2 leading-tight mb-2">
                        {product.title}
                    </h3>
                    
                    <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center gap-1 text-yellow-400 text-sm">
                            <Star size={16} fill="currentColor" />
                            <span className="text-gray-600 font-medium ml-1">{product.average_rating || 0}</span>
                        </div>
                        <p className="text-xs text-gray-400 font-medium">
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
