"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

// Import icons
import { 
  ChevronLeft, ChevronRight, Smartphone, Laptop, Headphones, Shirt, Home, Car,
  Wrench, Watch, Camera, Gamepad, Music, Book, 
  Coffee, Utensils, Gift, ShoppingBag, Tag, Grid, 
  Layers, Package, Zap, Activity, Heart, Smile
} from "lucide-react";

// Map string names to components
const ICON_COMPONENTS: Record<string, LucideIcon> = {
  Smartphone, Laptop, Headphones, Shirt, Home, Car, 
  Wrench, Watch, Camera, Gamepad, Music, Book, 
  Coffee, Utensils, Gift, ShoppingBag, Tag, Grid, 
  Layers, Package, Zap, Activity, Heart, Smile
};

interface Category {
  id: number;
  name: string;
  icon: string | null;
  slug: string;
  product_count?: number | null;
  products_count?: number | null;
  productsCount?: number | null;
  total_products?: number | null;
  totalProducts?: number | null;
  count?: number | null;
}

interface ProductSummary {
  category_id?: number | string | null;
  category?: {
    id?: number | string | null;
    slug?: string | null;
    name?: string | null;
  } | null;
  category_slug?: string | null;
  category_name?: string | null;
}

const extractList = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.results)) return record.results;
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.products)) return record.products;
  return [];
};

const toOptionalNumber = (value: unknown) => {
  if (value == null) return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const toCategory = (value: unknown): Category | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = Number(record.id);
  const name = typeof record.name === "string" ? record.name : "";
  const slug = typeof record.slug === "string" ? record.slug : "";
  if (!Number.isFinite(id) || !name || !slug) return null;
  return {
    id,
    name,
    slug,
    icon: typeof record.icon === "string" ? record.icon : null,
    product_count: toOptionalNumber(record.product_count),
    products_count: toOptionalNumber(record.products_count),
    productsCount: toOptionalNumber(record.productsCount),
    total_products: toOptionalNumber(record.total_products),
    totalProducts: toOptionalNumber(record.totalProducts),
    count: toOptionalNumber(record.count),
  };
};

const toProductSummary = (value: unknown): ProductSummary | null => {
  if (!value || typeof value !== "object") return null;
  return value as ProductSummary;
};

const countFromCategory = (category: Category) =>
  category.product_count ??
  category.products_count ??
  category.productsCount ??
  category.total_products ??
  category.totalProducts ??
  category.count;

const formatProductCount = (count: number | undefined) => {
  const safeCount = count ?? 0;
  const label = safeCount === 1 ? "producto" : "productos";
  return `${safeCount.toLocaleString("es-MX")} ${label}`;
};

export function HomeCategories() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [productCounts, setProductCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 6; // Adjust based on screen size if needed, but 6 is a good start for desktop

  const handleCategoryClick = (slug: string) => {
    router.push(`/categorias/${slug}`);
  };

  const fetchProductCounts = useCallback(async (catData: Category[]) => {
    const seededCounts = new Map<number, number>();
    catData.forEach((category) => {
      const count = countFromCategory(category);
      if (typeof count === "number") seededCounts.set(category.id, count);
    });

    try {
      const res = await fetchWithAuth("/api/products/?skip=0&limit=10000", {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const productData = extractList(await res.json());
        const categoriesById = new Map(catData.map((category) => [category.id, category]));
        const categoriesBySlug = new Map(catData.map((category) => [category.slug, category]));
        const categoriesByName = new Map(catData.map((category) => [category.name.toLowerCase(), category]));
        const nextCounts = new Map<number, number>();

        productData.forEach((entry) => {
          const product = toProductSummary(entry);
          if (!product) return;

          const directId = Number(product.category_id ?? product.category?.id);
          const category =
            (Number.isFinite(directId) ? categoriesById.get(directId) : undefined) ??
            (product.category_slug ? categoriesBySlug.get(product.category_slug) : undefined) ??
            (product.category?.slug ? categoriesBySlug.get(product.category.slug) : undefined) ??
            (product.category_name ? categoriesByName.get(product.category_name.toLowerCase()) : undefined) ??
            (product.category?.name ? categoriesByName.get(product.category.name.toLowerCase()) : undefined);

          if (!category) return;
          nextCounts.set(category.id, (nextCounts.get(category.id) ?? 0) + 1);
        });

        if (nextCounts.size > 0) {
          seededCounts.clear();
          catData.forEach((category) => seededCounts.set(category.id, nextCounts.get(category.id) ?? 0));
        }
      }
    } catch (error) {
      console.error("Error fetching category product counts:", error);
    }

    setProductCounts(Object.fromEntries(seededCounts));
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetchWithAuth("/api/categories/?skip=0&limit=100", {
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          const catData = extractList(data).map(toCategory).filter((category): category is Category => Boolean(category));
          setCategories(catData);
          await fetchProductCounts(catData);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, [fetchProductCounts]);

  const totalPages = Math.ceil(categories.length / itemsPerPage);

  const handleNext = () => {
    setCurrentPage((prev) => (prev + 1) % totalPages);
  };

  const handlePrev = () => {
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);
  };

  const currentCategories = categories.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  if (loading) {
    return <div className="py-8 text-center">Cargando categorías...</div>;
  }

  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="py-8 relative">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl md:text-3xl font-bold text-[#004e28] font-[family-name:var(--font-varela-round)]">Categorías</h2>
      </div>

      <div className="relative">
        {/* Pagination Arrows */}
        <button 
            onClick={handlePrev}
            disabled={currentPage === 0}
            className="absolute -left-4 md:-left-12 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-400 disabled:opacity-0 disabled:cursor-default transition-all shadow-sm"
        >
            <ChevronLeft size={24} />
        </button>
        <button 
            onClick={handleNext}
            disabled={currentPage === totalPages - 1}
            className="absolute -right-4 md:-right-12 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 text-gray-400 disabled:opacity-0 disabled:cursor-default transition-all shadow-sm"
        >
            <ChevronRight size={24} />
        </button>

        <div className="flex overflow-x-auto pb-4 gap-3 md:grid md:grid-cols-3 lg:grid-cols-6 md:gap-4 snap-x snap-mandatory scrollbar-thin md:scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
          {currentCategories.map((category) => {
            const Icon = category.icon && ICON_COMPONENTS[category.icon] 
              ? ICON_COMPONENTS[category.icon] 
              : Package;
              
            return (
              <div 
                key={category.id} 
                onClick={() => handleCategoryClick(category.slug)}
                className="cursor-pointer flex-shrink-0 w-28 md:w-auto flex flex-col items-center justify-center p-2 md:p-6 bg-transparent md:bg-white md:border md:border-gray-200 rounded-xl hover:shadow-md transition-shadow group h-auto md:h-40 snap-start"
              >
                <div className="mb-2 md:mb-4 text-[#004e28] group-hover:text-[#168e00] transition-colors">
                  <Icon className="w-8 h-8 md:w-8 md:h-8" strokeWidth={1.5} />
                </div>
                <h3 className="font-bold text-[#004e28] font-[family-name:var(--font-varela-round)] text-center mb-1 leading-tight md:line-clamp-1 group-hover:text-[#168e00] transition-colors text-xs md:text-lg w-full break-words">{category.name}</h3>
                <p className="text-[10px] md:text-xs text-gray-400 font-medium">
                  {formatProductCount(productCounts[category.id] ?? countFromCategory(category))}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
