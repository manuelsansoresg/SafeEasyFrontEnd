"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { RecommendationsSidebar } from "./RecommendationsSidebar";
import { searchAll, SearchService, SearchDirectory, SearchResponse } from "@/lib/search";
import { Product } from "@/lib/products";
import { getRecommendations, getFallbackProducts } from "@/lib/interactions";
import { DirectoryCard } from "./DirectoryCard";
import { Search, Filter } from "lucide-react";
import { useLocationStore } from "@/store/useLocationStore";

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

const getImageUrl = (path: string | null | undefined) => {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("https")) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api").replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`.replace(/([^:])\/{2,}/g, "$1/");
};

function ServiceCard({ service }: { service: SearchService }) {
  const cover =
    getImageUrl(service.cover_image_url) ||
    getImageUrl((service as Record<string, unknown>).cover_thumbnail_url as string) ||
    getImageUrl(((service.images as Array<Record<string, string>> | undefined)?.[0]?.image_url) || null);

  return (
    <Link
      href={`/services/${service.id}`}
      className="group block h-full relative bg-white rounded-[2rem] overflow-hidden border border-[#004e28]/10 transition-all duration-500 hover:shadow-[0_20px_40px_-15px_rgba(0,78,40,0.2)] hover:-translate-y-2"
    >
      <div className="relative aspect-[4/5] bg-[#f2f3f4] overflow-hidden">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={service.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 bg-[#f2f3f4]">
            <span className="text-4xl opacity-50">🛎️</span>
          </div>
        )}

        <span className="absolute top-4 left-4 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#168e00] text-white text-[10px] font-bold uppercase tracking-wider shadow">
          Servicio
        </span>
      </div>

      <div className="p-6 flex flex-col flex-grow relative z-10 bg-white">
        <h3 className="text-lg font-bold text-gray-900 leading-tight line-clamp-2 font-[family-name:var(--font-varela-round)] group-hover:text-[#004e28] transition-colors">
          {service.title}
        </h3>
        {service.description ? (
          <p className="text-sm text-gray-500 line-clamp-2 mt-2">{service.description}</p>
        ) : null}
        {Number.isFinite(service.price) && service.price > 0 ? (
          <div className="flex items-baseline gap-1 mt-3">
            <span className="text-sm font-medium text-gray-400">$</span>
            <span className="text-2xl font-black text-[#004e28] tracking-tight font-[family-name:var(--font-poppins)]">
              {Number(service.price).toFixed(0)}
            </span>
          </div>
        ) : null}
      </div>
    </Link>
  );
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
  const [services, setServices] = useState<SearchService[]>([]);
  const [directories, setDirectories] = useState<SearchDirectory[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const [productCount, setProductCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [directoryCount, setDirectoryCount] = useState(0);
  const limit = 20;

  // Filters
  const [category, setCategory] = useState<string | undefined>(initialCategory);
  const [subcategory, setSubcategory] = useState<string | undefined>(initialSubcategory);
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [bestRated, setBestRated] = useState<boolean | undefined>(false);
  const [search, setSearch] = useState(initialSearch);
  const [filterCity, setFilterCity] = useState<string | undefined>();
  const [filterState, setFilterState] = useState<string | undefined>();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { city, state } = useLocationStore();

  const debouncedSearch = useLocalDebounce(search, 500);

  // Sync search state with URL params
  useEffect(() => {
    if (initialSearch !== undefined) {
        setSearch(initialSearch);
    }
    if (initialCategory !== undefined) {
        setCategory(initialCategory);
    }
    if (initialSubcategory !== undefined) {
        setSubcategory(initialSubcategory);
    }
  }, [initialSearch, initialCategory, initialSubcategory]);

  // Observer for infinite scroll
  const observer = useRef<IntersectionObserver | null>(null);
  const lastResultElementRef = useCallback((node: HTMLDivElement) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setSkip(prevSkip => prevSkip + limit);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  const fetchResults = async (reset = false) => {
    console.log(" fetchResults called with:", {
      reset,
      skip,
      category,
      subcategory,
      minPrice,
      maxPrice,
      bestRated,
      debouncedSearch,
      filterCity,
      filterState,
    });

    setLoading(true);
    const currentSkip = reset ? 0 : skip;
    const hasQuery = debouncedSearch.trim().length > 0;

    // Check if any filters are active
    const hasActiveFilters = !!(
      category ||
      subcategory ||
      minPrice !== undefined ||
      maxPrice !== undefined ||
      bestRated ||
      filterCity ||
      filterState
    );

    console.log("🔍 Filter state:", { hasQuery, hasActiveFilters });

    try {
      let productsArr: Product[] = [];
      let servicesArr: SearchService[] = [];
      let directoriesArr: SearchDirectory[] = [];
      let productTotal = 0;
      let serviceTotal = 0;
      let directoryTotal = 0;

      if (!hasQuery && !hasActiveFilters) {
        // No active query and no filters → fall back to the personalized recommendations
        // endpoint for products, and ask the unified search (type_filter=all)
        // for both products and directories. The backend now rejects
        // type_filter=services with 422, so we use "all" to also surface
        // featured directories (businesses with a plan).
        const [recommended, searchEmpty] = await Promise.all([
          getRecommendations(20, currentSkip).then(async (list) => {
            if (Array.isArray(list) && list.length > 0) return list;
            return getFallbackProducts(20);
          }),
          currentSkip === 0
            ? searchAll({
                query: "",
                type_filter: "all",
                per_type: 8,
                allowEmptyQuery: true,
                disableLocation: true,
              })
            : Promise.resolve(null),
        ]);

        productsArr = Array.isArray(recommended) ? recommended : [];
        servicesArr = [];
        // If the personalized endpoint didn't return products, fall back to
        // whatever the unified search surfaced (so we never end up empty here).
        if (productsArr.length === 0 && Array.isArray(searchEmpty?.products)) {
          productsArr = searchEmpty.products;
        }
        directoriesArr = Array.isArray(searchEmpty?.directories) ? searchEmpty!.directories : [];
        productTotal = productsArr.length;
        serviceTotal = servicesArr.length;
        directoryTotal = directoriesArr.length;
      } else {
        // Only send location if the user explicitly selected it in the filter.
        // Don't auto-apply location from cookies when other filters are active,
        // as it can cause no results (e.g., no products in Mérida with price <= 400).
        const locationParam =
          filterCity || filterState
            ? { city: filterCity || null, state: filterState || null }
            : null;
        const disableLocation = !filterCity && !filterState;

        // 1) Unified call (filters by query + location, returns products + services)
        console.log(" Fetching with filters:", {
          query: debouncedSearch,
          category,
          subcategory,
          minPrice,
          maxPrice,
          bestRated,
          location: locationParam,
          disableLocation,
          hasQuery,
        });

        const response: SearchResponse = await searchAll({
          query: debouncedSearch,
          type_filter: "all",
          skip: currentSkip,
          limit,
          category,
          subcategory,
          min_price: minPrice,
          max_price: maxPrice,
          best_rated: bestRated,
          disableLocation,
          location: locationParam,
          allowEmptyQuery: !hasQuery,
        });

        console.log(" Search response:", {
          products: response?.products?.length || 0,
          services: response?.services?.length || 0,
          directories: response?.directories?.length || 0,
        });

        // Client-side filter: if there's a query, only keep products whose
        // title/description actually mention it. The backend's unified search
        // sometimes returns unrelated rows when location is set, and this avoids
        // showing "mesa de marmol" when the user typed "spa".
        const normalizedQuery = debouncedSearch.trim().toLowerCase();
        const allProducts = Array.isArray(response?.products) ? response.products : [];
        productsArr = normalizedQuery
          ? allProducts.filter((p) => {
              const title = (p.title || "").toLowerCase();
              const description = (p.description || "").toLowerCase();
              return title.includes(normalizedQuery) || description.includes(normalizedQuery);
            })
          : allProducts;

        servicesArr = Array.isArray(response?.services) ? response.services : [];
        directoriesArr = Array.isArray(response?.directories) ? response.directories : [];

        productTotal = normalizedQuery ? productsArr.length : response.counts.products;
        serviceTotal = servicesArr.length;
        directoryTotal = directoriesArr.length;
      }

      if (reset) {
        setProducts(productsArr);
        setServices(servicesArr);
        setDirectories(directoriesArr);
        setSkip(0);
      } else {
        setProducts(prev => [...prev, ...productsArr]);
        setServices(prev => {
          const seen = new Set(prev.map((s) => s.id));
          const next = [...prev];
          for (const svc of servicesArr) {
            if (!seen.has(svc.id)) {
              next.push(svc);
              seen.add(svc.id);
            }
          }
          return next;
        });
        setDirectories(prev => {
          const seen = new Set(prev.map((d) => d.id));
          const next = [...prev];
          for (const dir of directoriesArr) {
            if (!seen.has(dir.id)) {
              next.push(dir);
              seen.add(dir.id);
            }
          }
          return next;
        });
      }

      setProductCount(productTotal);
      setServiceCount(serviceTotal);
      setDirectoryCount(directoryTotal);
      setHasMore(productsArr.length === limit || servicesArr.length === limit);
    } catch (error) {
      console.error("Error fetching search results:", error);
    } finally {
      setLoading(false);
    }
  };

  // Reset and fetch when filters change
  useEffect(() => {
    fetchResults(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, subcategory, minPrice, maxPrice, bestRated, debouncedSearch, filterCity, filterState, city, state]);

  // Fetch more when skip changes (infinite scroll)
  useEffect(() => {
    if (skip > 0) {
      fetchResults(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  const handleFilterChange = (filters: {
    category?: string;
    subcategory?: string;
    minPrice?: number;
    maxPrice?: number;
    bestRated?: boolean;
    city?: string;
    state?: string;
  }) => {
    setCategory(filters.category);
    setSubcategory(filters.subcategory);
    setMinPrice(filters.minPrice);
    setMaxPrice(filters.maxPrice);
    setBestRated(filters.bestRated);
    setFilterCity(filters.city);
    setFilterState(filters.state);
    // Reset happens in useEffect
  };

  const handleClear = () => {
    setSearch("");
    setCategory(undefined);
    setSubcategory(undefined);
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setBestRated(false);
    setFilterCity(undefined);
    setFilterState(undefined);
  };

  const hasAnyResults = products.length > 0 || services.length > 0 || directories.length > 0;

  return (
    <div id="recommendations-section" className="bg-white py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-3xl font-bold text-[#004e28] font-[family-name:var(--font-varela-round)]">
                {debouncedSearch ? "Resultados de búsqueda" : "Recomendados para ti"}
            </h2>

            {/* Mobile Filter Icon */}
            <button
              onClick={() => setIsFilterOpen(true)}
              className="lg:hidden p-2 text-[#004e28] hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Filtrar"
            >
              <Filter size={24} />
            </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 relative">
          {/* Sidebar */}
          <div className={`
            fixed inset-0 z-[60] bg-white transform transition-transform duration-300 lg:relative lg:transform-none lg:z-0 lg:bg-transparent lg:w-auto lg:inset-auto
            ${isFilterOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}>
            <div className="h-full lg:h-auto">
                <RecommendationsSidebar
                    selectedCategory={category}
                    selectedSubcategory={subcategory}
                    minPrice={minPrice}
                    maxPrice={maxPrice}
                    bestRated={bestRated}
                    city={filterCity}
                    state={filterState}
                    onFilterChange={handleFilterChange}
                    onClear={handleClear}
                    onClose={() => setIsFilterOpen(false)}
                />
            </div>
          </div>

          {/* Overlay for mobile */}
          {isFilterOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setIsFilterOpen(false)}
            />
          )}

          {/* Main Content */}
          <div className="flex-1">
            {/* Search Bar */}
            <div className="mb-6 relative">
                <input
                    type="text"
                    placeholder="Buscar productos o servicios..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            </div>

            {/* Classified sections: services (Servicios) then products (Productos) */}
            {services.length > 0 && (
              <section className="mb-10">
                <header className="flex items-baseline justify-between mb-4">
                  <h3 className="text-lg md:text-xl font-bold text-[#004e28] font-[family-name:var(--font-varela-round)]">
                    Servicios
                  </h3>
                  <span className="text-xs text-gray-500">
                    {serviceCount} resultado{serviceCount === 1 ? "" : "s"}
                  </span>
                </header>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {services.map((service) => (
                    <ServiceCard key={`svc-${service.id}`} service={service} />
                  ))}
                </div>
              </section>
            )}

            {products.length > 0 && (
              <section className="mb-10">
                <header className="flex items-baseline justify-between mb-4">
                  <h3 className="text-lg md:text-xl font-bold text-[#004e28] font-[family-name:var(--font-varela-round)]">
                    Productos
                  </h3>
                  <span className="text-xs text-gray-500">
                    {productCount} resultado{productCount === 1 ? "" : "s"}
                  </span>
                </header>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {products.map((product, index) => {
                    const isLast = products.length === index + 1 && services.length === 0 && directories.length === 0;
                    const wrapperProps = isLast ? { ref: lastResultElementRef } : {};
                    return (
                      <div {...wrapperProps} key={`product-${product.id}-${index}`}>
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
                  })}
                </div>
              </section>
            )}

            {directories.length > 0 && (
              <section className="mb-10">
                <header className="flex items-baseline justify-between mb-4">
                  <h3 className="text-lg md:text-xl font-bold text-[#004e28] font-[family-name:var(--font-varela-round)]">
                    Negocios
                  </h3>
                  <span className="text-xs text-gray-500">
                    {directoryCount} resultado{directoryCount === 1 ? "" : "s"}
                  </span>
                </header>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {directories.map((directory, index) => {
                    const isLast = directories.length === index + 1 && services.length === 0 && products.length === 0;
                    const wrapperProps = isLast ? { ref: lastResultElementRef } : {};
                    return (
                      <div {...wrapperProps} key={`directory-${directory.id}-${index}`}>
                        <DirectoryCard directory={directory} />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {loading && (
              <div className="w-full py-8 flex justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
              </div>
            )}

            {!loading && !hasAnyResults && (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <p className="text-gray-500">
                  No se encontraron productos ni servicios con estos filtros.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
