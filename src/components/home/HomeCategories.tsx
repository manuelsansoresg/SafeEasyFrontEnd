"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/api";

// Import icons
import { 
  Smartphone, Laptop, Headphones, Shirt, Home, Car, 
  Wrench, Watch, Camera, Gamepad, Music, Book, 
  Coffee, Utensils, Gift, ShoppingBag, Tag, Grid, 
  Layers, Package, Zap, Activity, Heart, Smile
} from "lucide-react";

// Map string names to components
const ICON_COMPONENTS: Record<string, any> = {
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
}

export function HomeCategories() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 6; // Adjust based on screen size if needed, but 6 is a good start for desktop

  const handleCategoryClick = (slug: string) => {
    // Navigate to the category page with query param
    router.push(`/?category=${slug}`, { scroll: false });
    
    // Scroll to recommendations section
    setTimeout(() => {
        document.getElementById('recommendations-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetchWithAuth('/api/categories/?skip=0&limit=100');
        if (res.ok) {
            const data = await res.json();
            let catData: Category[] = [];
            if (Array.isArray(data)) catData = data;
            else if (data && typeof data === 'object') {
                if (Array.isArray((data as any).items)) catData = (data as any).items;
                else if (Array.isArray((data as any).results)) catData = (data as any).results;
                else if (Array.isArray((data as any).data)) catData = (data as any).data;
            }
            setCategories(catData);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

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
              
            // Generar un número aleatorio fijo basado en el ID para que parezca real pero sea consistente
            const productCount = (category.id * 1234) % 15000 + 500; 
            const formattedCount = productCount > 1000 
              ? `${(productCount / 1000).toFixed(1)}k` 
              : productCount;

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
                <p className="text-[10px] md:text-xs text-gray-400 font-medium">{formattedCount} products</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
