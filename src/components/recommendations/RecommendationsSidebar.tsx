"use client";

import { useState, useEffect } from "react";
import { ChevronRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface Subcategory {
  id: number;
  name: string;
  category_id: number;
  slug: string;
}

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return `${base.replace(/\/$/, "")}${path}`;
};

const unwrapList = <T,>(data: unknown, key: string): T[] => {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const items = record.items ?? record.results ?? record.data ?? record[key];
    if (Array.isArray(items)) return items as T[];
  }
  return [];
};

const fetchPublicList = async <T,>(urls: string[], key: string) => {
  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        if (response.status === 404 || response.status === 405) continue;
        return [];
      }
      const data: unknown = await response.json().catch(() => null);
      return unwrapList<T>(data, key);
    } catch {
      continue;
    }
  }
  return [];
};

interface RecommendationsSidebarProps {
  selectedCategory?: string;
  selectedSubcategory?: string;
  minPrice?: number;
  maxPrice?: number;
  bestRated?: boolean;
  onFilterChange: (filters: {
    category?: string;
    subcategory?: string;
    minPrice?: number;
    maxPrice?: number;
    bestRated?: boolean;
  }) => void;
  onClear?: () => void;
  onClose?: () => void;
}

export function RecommendationsSidebar({
  selectedCategory,
  selectedSubcategory,
  minPrice,
  maxPrice,
  bestRated,
  onFilterChange,
  onClear,
  onClose,
}: RecommendationsSidebarProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [localMinPrice, setLocalMinPrice] = useState(minPrice?.toString() || "");
  const [localMaxPrice, setLocalMaxPrice] = useState(maxPrice?.toString() || "");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catData, subData] = await Promise.all([
          fetchPublicList<Category>(
            [
              "/api/categories/?skip=0&limit=100",
              "/api/backend/categories/?skip=0&limit=100",
              apiUrl("/categories/?skip=0&limit=100"),
            ],
            "categories",
          ),
          fetchPublicList<Subcategory>(
            [
              "/api/subcategories/?skip=0&limit=1000",
              "/api/backend/subcategories/?skip=0&limit=1000",
              apiUrl("/subcategories/?skip=0&limit=1000"),
            ],
            "subcategories",
          ),
        ]);
        setCategories(catData);
        setSubcategories(subData);
      } catch (error) {
        console.error("Failed to fetch sidebar data", error);
      }
    };
    fetchData();
  }, []);

  const handleCategoryClick = (categorySlug: string) => {
    if (expandedCategory === categorySlug) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(categorySlug);
    }
    
    // If clicking the category itself, select it and clear subcategory
    if (selectedCategory === categorySlug) {
        onFilterChange({ category: undefined, subcategory: undefined, minPrice, maxPrice, bestRated });
    } else {
        onFilterChange({ category: categorySlug, subcategory: undefined, minPrice, maxPrice, bestRated });
    }
  };

  const handleSubcategoryClick = (e: React.MouseEvent, subcategorySlug: string, categorySlug: string) => {
    e.stopPropagation();
    if (selectedSubcategory === subcategorySlug) {
        onFilterChange({ category: categorySlug, subcategory: undefined, minPrice, maxPrice, bestRated });
    } else {
        onFilterChange({ category: categorySlug, subcategory: subcategorySlug, minPrice, maxPrice, bestRated });
    }
  };

  const handlePriceApply = () => {
    const min = localMinPrice ? parseFloat(localMinPrice) : undefined;
    const max = localMaxPrice ? parseFloat(localMaxPrice) : undefined;
    onFilterChange({ 
        category: selectedCategory, 
        subcategory: selectedSubcategory, 
        minPrice: min, 
        maxPrice: max,
        bestRated
    });
  };
  
  const handleClearAll = () => {
      setLocalMinPrice("");
      setLocalMaxPrice("");
      setExpandedCategory(null);
      if (onClear) {
        onClear();
      } else {
        onFilterChange({ 
          category: undefined, 
          subcategory: undefined, 
          minPrice: undefined, 
          maxPrice: undefined,
          bestRated: false
        });
      }
  };

  const handleBestRatedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
        category: selectedCategory,
        subcategory: selectedSubcategory,
        minPrice,
        maxPrice,
        bestRated: e.target.checked
    });
  };

  return (
    <div className="w-full h-full md:w-64 flex flex-col md:block flex-shrink-0 bg-white rounded-xl md:border md:border-gray-100 md:h-fit md:sticky md:top-20 md:p-4 shadow-sm md:shadow-none relative">
      <div className="flex-none p-4 md:p-0 flex items-center justify-between border-b border-gray-100 md:border-0 md:mb-4 bg-white">
        <h3 className="font-bold text-gray-800 text-lg md:text-base">Filtros</h3>
        <div className="flex items-center gap-4">
            <button 
                onClick={handleClearAll}
                className="text-xs text-primary hover:underline font-medium"
            >
                Limpiar todo
            </button>
            {onClose && (
                <button 
                  onClick={onClose} 
                  className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Cerrar filtros"
                >
                    <X size={24} />
                </button>
            )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 pb-24 md:p-0 md:overflow-visible md:pb-0">
        {/* Best Rated Filter */}
        <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Destacados</h4>
            <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative flex items-center">
                <input 
                type="checkbox" 
                className="peer h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary/20"
                checked={bestRated || false}
                onChange={handleBestRatedChange}
                />
            </div>
            <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                Mejores calificados
            </span>
            </label>
        </div>

        {/* Price Filter */}
        <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Rango de Precio</h4>
            <div className="space-y-3">
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                <input
                    type="number"
                    placeholder="Min"
                    value={localMinPrice}
                    onChange={(e) => setLocalMinPrice(e.target.value)}
                    className="w-full pl-5 pr-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:border-primary"
                />
                </div>
                <span className="text-gray-400">-</span>
                <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                <input
                    type="number"
                    placeholder="Max"
                    value={localMaxPrice}
                    onChange={(e) => setLocalMaxPrice(e.target.value)}
                    className="w-full pl-5 pr-2 py-1.5 text-sm border rounded-lg focus:outline-none focus:border-primary"
                />
                </div>
            </div>
            <button
                onClick={handlePriceApply}
                className="hidden md:block w-full py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-lg hover:bg-primary/20 transition-colors"
            >
                Aplicar Precio
            </button>
            </div>
        </div>

        {/* Categories Filter */}
        <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Categorías</h4>
            <div className="space-y-1">
            {categories.map((category) => {
                const isSelected = selectedCategory === category.slug;
                const isExpanded = expandedCategory === category.slug || isSelected;
                const categorySubs = subcategories.filter(sub => sub.category_id === category.id);
                const hasSubs = categorySubs.length > 0;

                return (
                <div key={category.id} className="border-b border-gray-50 last:border-0 pb-1 mb-1">
                    <button
                    onClick={() => handleCategoryClick(category.slug)}
                    className={cn(
                        "flex items-center justify-between w-full py-2 text-left text-sm hover:text-primary transition-colors",
                        isSelected ? "font-bold text-primary" : "text-gray-600"
                    )}
                    >
                    <span>{category.name}</span>
                    {hasSubs && (
                        <ChevronRight
                        size={14}
                        className={cn(
                            "transition-transform",
                            isExpanded ? "rotate-90" : ""
                        )}
                        />
                    )}
                    </button>

                    {hasSubs && isExpanded && (
                    <div className="pl-3 pb-2 space-y-1">
                        {categorySubs.map((sub) => (
                        <button
                            key={sub.id}
                            onClick={(e) => handleSubcategoryClick(e, sub.slug, category.slug)}
                            className={cn(
                            "flex items-center gap-2 w-full py-1 text-xs hover:text-primary transition-colors",
                            selectedSubcategory === sub.slug
                                ? "text-primary font-medium"
                                : "text-gray-500"
                            )}
                        >
                            <div className={cn(
                                "w-3 h-3 rounded border flex items-center justify-center",
                                selectedSubcategory === sub.slug ? "border-primary bg-primary text-white" : "border-gray-300"
                            )}>
                                {selectedSubcategory === sub.slug && <Check size={8} />}
                            </div>
                            {sub.name}
                        </button>
                        ))}
                    </div>
                    )}
                </div>
                );
            })}
            </div>
        </div>
      </div>

      {onClose && (
        <div className="absolute bottom-0 left-0 w-full p-4 border-t border-gray-100 md:hidden bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
            <button 
                onClick={() => {
                    handlePriceApply();
                    onClose();
                }}
                className="w-full bg-[#004e28] text-white font-bold py-3 rounded-xl hover:bg-[#003d1f] transition-colors flex items-center justify-center gap-2"
            >
                Aplicar filtros
            </button>
        </div>
      )}
    </div>
  );
}
