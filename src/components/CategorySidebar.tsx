"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
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

interface Subcategory {
  id: number;
  name: string;
  category_id: number;
  slug: string;
  image: string | null;
}

export function CategorySidebar() {
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Parallel fetch
        const [catRes, subRes] = await Promise.all([
            fetchWithAuth('/api/categories/?skip=0&limit=100'),
            fetchWithAuth('/api/subcategories/?skip=0&limit=1000')
        ]);

        if (catRes.ok && subRes.ok) {
            const catData = await catRes.json();
            const subData = await subRes.json();
            
            // Ensure data is array (handle potential empty or error responses)
            setCategories(Array.isArray(catData) ? catData : []);
            setSubcategories(Array.isArray(subData) ? subData : []);
        }
      } catch (error) {
        console.error("Failed to fetch sidebar data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const renderIcon = (iconName: string | null) => {
    if (!iconName) return <Grid size={18} />;
    const IconComponent = ICON_COMPONENTS[iconName];
    return IconComponent ? <IconComponent size={18} /> : <Grid size={18} />;
  };

  const getSubcategories = (categoryId: number) => {
    return subcategories.filter(sub => sub.category_id === categoryId);
  };

  if (loading) {
      return (
        <div className="w-64 flex-shrink-0 bg-white border rounded-xl shadow-sm h-96 py-2 hidden lg:flex items-center justify-center relative">
            <Loader2 className="animate-spin text-primary" />
        </div>
      );
  }

  // If no categories, maybe show nothing or empty state
  if (categories.length === 0) {
      return (
        <div className="w-64 flex-shrink-0 bg-white border rounded-xl shadow-sm h-fit py-2 hidden lg:block relative">
            <div className="px-4 py-2 border-b mb-2">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                <span className="text-primary">☰</span> Categorías
                </h3>
            </div>
            <div className="p-4 text-sm text-gray-500 text-center">
                Sin categorías
            </div>
        </div>
      );
  }

  return (
    <div className="w-64 flex-shrink-0 bg-white border rounded-xl shadow-sm h-fit py-2 hidden lg:block relative z-30">
      <div className="px-4 py-2 border-b mb-2">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <span className="text-primary">☰</span> Categorías
        </h3>
      </div>
      <ul className="flex flex-col">
        {categories.map((cat) => (
          <li
            key={cat.id}
            className="group"
            onMouseEnter={() => setActiveCategory(cat.id)}
            onMouseLeave={() => setActiveCategory(null)}
          >
            <Link
              href={`/?category=${cat.slug}`}
              className={cn(
                "w-full px-4 py-3 text-sm text-left flex items-center justify-between hover:bg-secondary transition-colors",
                activeCategory === cat.id && "bg-secondary text-primary font-medium"
              )}
            >
              <span className="flex items-center gap-3">
                <span className={cn("text-lg opacity-70 group-hover:opacity-100", activeCategory === cat.id && "text-primary opacity-100")}>
                    {renderIcon(cat.icon)}
                </span>
                {cat.name}
              </span>
              <ChevronRight size={14} className="opacity-50 group-hover:opacity-100" />
            </Link>
            
            {/* Flyout Menu */}
            <AnimatePresence>
              {activeCategory === cat.id && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="absolute left-full top-0 w-[600px] min-h-full bg-white shadow-xl border rounded-r-xl z-50 p-6"
                  style={{ top: -1 }} 
                >
                  <h4 className="text-xl font-bold mb-4 text-gray-800">{cat.name}</h4>
                  
                  {getSubcategories(cat.id).length > 0 ? (
                      <div className="grid grid-cols-3 gap-4">
                        {getSubcategories(cat.id).map((sub) => (
                            <Link 
                              key={sub.id} 
                              href={`/?category=${cat.slug}&subcategory=${sub.slug}`}
                              className="flex flex-col items-center gap-2 p-2 hover:bg-secondary rounded-lg cursor-pointer transition-colors"
                            >
                            {/* Image */}
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden border border-gray-100">
                                {sub.image ? (
                                    <img src={sub.image} alt={sub.name} className="w-full h-full object-cover" />
                                ) : (
                                    <Grid className="text-gray-300" size={24} />
                                )}
                            </div>
                            <span className="text-sm text-center font-medium text-gray-700">{sub.name}</span>
                            </Link>
                        ))}
                      </div>
                  ) : (
                      <div className="flex flex-col items-center justify-center h-32 text-gray-400 gap-2">
                          <Package size={32} className="opacity-20" />
                          <p className="text-sm">No hay subcategorías disponibles.</p>
                      </div>
                  )}
                  
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        ))}
      </ul>
    </div>
  );
}
