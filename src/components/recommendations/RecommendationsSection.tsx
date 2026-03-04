"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ProductCard } from "@/components/ProductCard";
import { RecommendationsSidebar } from "./RecommendationsSidebar";
import { getRecommendations, RecommendationsParams } from "@/lib/recommendations";
import { getProducts } from "@/lib/products";
import { Product } from "@/lib/products";
import { Search } from "lucide-react";

// Simple debounce hook implementation if not present
function useLocalDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function RecommendationsSection({
  initialSearch = "",
  initialCategory,
  initialSubcategory,
}: {
  initialSearch?: string;
  initialCategory?: string;
  initialSubcategory?: string;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const limit = 20; // Sensible amount per page

  // Filters
  const [category, setCategory] = useState<string | undefined>(initialCategory);
  const [subcategory, setSubcategory] = useState<string | undefined>(initialSubcategory);
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [bestRated, setBestRated] = useState<boolean | undefined>(false);
  const [search, setSearch] = useState(initialSearch);

  const debouncedSearch = useLocalDebounce(search, 500);

  // Sync search state with URL params
  useEffect(() => {
    if (initialSearch !== undefined) {
        setSearch(initialSearch);
    }
  }, [initialSearch]);
  
  // Observer for infinite scroll
  const observer = useRef<IntersectionObserver | null>(null);
  const lastProductElementRef = useCallback((node: HTMLDivElement) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setSkip(prevSkip => prevSkip + limit);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  const fetchProducts = async (reset = false) => {
    setLoading(true);
    const currentSkip = reset ? 0 : skip;
    
    try {
      let newProducts: Product[] = [];

      if (debouncedSearch) {
        // Search Logic: Call getProducts
        const page = Math.floor(currentSkip / limit) + 1;
        newProducts = await getProducts(
            page,
            limit,
            debouncedSearch,
            category,
            subcategory,
            minPrice,
            maxPrice,
            bestRated
        );
      } else {
        // Recommendations Logic
        const params: RecommendationsParams = {
            skip: currentSkip,
            limit,
            category,
            subcategory,
            min_price: minPrice,
            max_price: maxPrice,
            best_rated: bestRated,
            // search is removed here because we use getProducts for searching
        };
        newProducts = await getRecommendations(params);
      }
      
      if (reset) {
        setProducts(newProducts);
        setSkip(0);
      } else {
        setProducts(prev => [...prev, ...newProducts]);
      }

      setHasMore(newProducts.length === limit);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setLoading(false);
    }
  };

  // Reset and fetch when filters change
  useEffect(() => {
    fetchProducts(true);
  }, [category, subcategory, minPrice, maxPrice, bestRated, debouncedSearch]);

  // Fetch more when skip changes (infinite scroll)
  useEffect(() => {
    if (skip > 0) {
      fetchProducts(false);
    }
  }, [skip]);

  const handleFilterChange = (filters: {
    category?: string;
    subcategory?: string;
    minPrice?: number;
    maxPrice?: number;
    bestRated?: boolean;
  }) => {
    setCategory(filters.category);
    setSubcategory(filters.subcategory);
    setMinPrice(filters.minPrice);
    setMaxPrice(filters.maxPrice);
    setBestRated(filters.bestRated);
    // Reset happens in useEffect
  };

  const handleClear = () => {
    setSearch("");
    setCategory(undefined);
    setSubcategory(undefined);
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setBestRated(false);
  };

  return (
    <div className="bg-white py-8">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-[#004e28] mb-6 font-[family-name:var(--font-varela-round)]">
            {debouncedSearch ? "Resultados de búsqueda" : "Recomendados / Resultados"}
        </h2>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <RecommendationsSidebar 
            selectedCategory={category}
            selectedSubcategory={subcategory}
            minPrice={minPrice}
            maxPrice={maxPrice}
            bestRated={bestRated}
            onFilterChange={handleFilterChange}
            onClear={handleClear}
          />

          {/* Main Content */}
          <div className="flex-1">
            {/* Search Bar */}
            <div className="mb-6 relative">
                <input
                    type="text"
                    placeholder="Buscar productos..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product, index) => {
                if (products.length === index + 1) {
                  return (
                    <div ref={lastProductElementRef} key={`${product.id}-${index}`}>
                      <ProductCard
                        id={String(product.id)}
                        title={product.title}
                        price={product.price}
                        image={product.thumbnail_url || ""}
                        slug={product.slug}
                        rating={Number(product.average_rating || 0)}
                        sales={product.sales_count || 0}
                        supplier={product.supplier}
                      />
                    </div>
                  );
                } else {
                  return (
                    <ProductCard
                      key={`${product.id}-${index}`}
                      id={String(product.id)}
                      title={product.title}
                      price={product.price}
                      image={product.thumbnail_url || ""}
                      slug={product.slug}
                      rating={Number(product.average_rating || 0)}
                      sales={product.sales_count || 0}
                      supplier={product.supplier}
                    />
                  );
                }
              })}
            </div>

            {loading && (
              <div className="w-full py-8 flex justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
              </div>
            )}

            {!loading && products.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <p className="text-gray-500">No se encontraron productos con estos filtros.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
