"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const categories = [
  { id: "electronics", name: "Electrónica de Consumo", icon: "🎧" },
  { id: "fashion", name: "Ropa y Accesorios", icon: "👕" },
  { id: "home", name: "Hogar y Jardín", icon: "🏠" },
  { id: "sports", name: "Deportes y Entretenimiento", icon: "⚽" },
  { id: "beauty", name: "Belleza y Cuidado Personal", icon: "💄" },
  { id: "auto", name: "Vehículos y Accesorios", icon: "🚗" },
  { id: "machinery", name: "Maquinaria Industrial", icon: "🏭" },
];

const subCategories = {
  electronics: [
    { name: "Televisores", image: "/placeholder.svg" },
    { name: "Auriculares", image: "/placeholder.svg" },
    { name: "Cámaras", image: "/placeholder.svg" },
    { name: "Smartwatches", image: "/placeholder.svg" },
  ],
  // ... add more as needed
};

export function CategorySidebar() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  return (
    <div className="w-64 flex-shrink-0 bg-white border rounded-xl shadow-sm h-fit py-2 hidden lg:block relative">
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
            <button
              className={cn(
                "w-full px-4 py-3 text-sm text-left flex items-center justify-between hover:bg-secondary transition-colors",
                activeCategory === cat.id && "bg-secondary text-primary font-medium"
              )}
            >
              <span className="flex items-center gap-3">
                <span className="text-lg opacity-70 group-hover:opacity-100">{cat.icon}</span>
                {cat.name}
              </span>
              <ChevronRight size={14} className="opacity-50 group-hover:opacity-100" />
            </button>
            
            {/* Flyout Menu (Optional based on Alibaba style, user asked for "window") */}
            <AnimatePresence>
              {activeCategory === cat.id && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="absolute left-full top-0 w-[600px] min-h-full bg-white shadow-xl border rounded-r-xl z-20 p-6"
                  style={{ top: -1 }} // Align top
                >
                  <h4 className="text-xl font-bold mb-4 text-gray-800">{cat.name}</h4>
                  <div className="grid grid-cols-3 gap-4">
                     {/* Dummy Subcategories */}
                     {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-2 p-2 hover:bg-secondary rounded-lg cursor-pointer transition-colors">
                           <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-xs text-gray-400">
                             Img
                           </div>
                           <span className="text-sm text-center font-medium text-gray-700">Subcategoría {i + 1}</span>
                        </div>
                     ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        ))}
      </ul>
    </div>
  );
}
