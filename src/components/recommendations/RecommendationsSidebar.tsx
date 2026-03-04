"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/api";

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
}

export function RecommendationsSidebar({
  selectedCategory,
  selectedSubcategory,
  minPrice,
  maxPrice,
  bestRated,
  onFilterChange,
  onClear,
}: RecommendationsSidebarProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [localMinPrice, setLocalMinPrice] = useState(minPrice?.toString() || "");
  const [localMaxPrice, setLocalMaxPrice] = useState(maxPrice?.toString() || "");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories
        const catRes = await fetchWithAuth('/api/categories/?skip=0&limit=100');
        if (catRes.ok) {
          const text = await catRes.text();
          const parsed = JSON.parse(text);
          const catData = Array.isArray(parsed) ? parsed : (parsed.items || parsed.results || parsed.data || []);
          setCategories(catData);
        }

        // Fetch subcategories
        const subRes = await fetchWithAuth('/api/subcategories/?skip=0&limit=1000');
        if (subRes.ok) {
          const text = await subRes.text();
          const parsed = JSON.parse(text);
          const subData = Array.isArray(parsed) ? parsed : (parsed.items || parsed.results || parsed.data || []);
          setSubcategories(subData);
        }
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
    <div className="w-64 flex-shrink-0 bg-white p-4 rounded-xl border border-gray-100 h-fit sticky top-20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800">Filtros</h3>
        <button 
            onClick={handleClearAll}
            className="text-xs text-primary hover:underline font-medium"
        >
            Limpiar todo
        </button>
      </div>

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
            className="w-full py-1.5 bg-primary/10 text-primary text-sm font-medium rounded-lg hover:bg-primary/20 transition-colors"
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
  );
}
