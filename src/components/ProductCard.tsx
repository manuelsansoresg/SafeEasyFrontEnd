"use client";

import Link from "next/link";
import { CheckCircle, Heart, Star } from "lucide-react";
import slugify from "slugify";
import { Supplier } from "@/lib/products";
import { useAuthStore } from "@/store/useAuthStore";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface ProductCardProps {
  id: string;
  title: string;
  price: number;
  image: string;
  minOrder?: string;
  slug: string;
  rating?: number;
  sales?: number;
  supplier?: Supplier;
  onClick?: (e: React.MouseEvent) => void;
}

export function ProductCard({
  id,
  title,
  price,
  image,
  minOrder = "1 pieza",
  slug,
  rating = 0,
  sales = 500,
  supplier,
  onClick,
}: ProductCardProps) {
  const { isAuthenticated } = useAuthStore();
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const isFav = isFavorite(id);

  const supplierSlug =
    supplier &&
    (supplier.slug && supplier.slug.trim() !== ""
      ? supplier.slug
      : (supplier.name ? slugify(supplier.name, { lower: true, strict: true }) : ""));

  const supplierHref = supplierSlug ? `/empresas/${supplierSlug}` : null;
  const showSupplierVerified = supplier && supplier.is_verified === true;

  const getImageUrl = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http") || path.startsWith("https")) return path;
    const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://drooopy.com/api').replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`.replace(/([^:])\/{2,}/g, '$1/');
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick(e);
    }
  };

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      alert("Debes iniciar sesión para agregar a favoritos");
      return;
    }

    try {
      await toggleFavorite(id);
    } catch (error) {
      console.error("Error toggling favorite", error);
    }
  };

  const displayPrice = (typeof price === 'number' ? price : 0).toFixed(0);

  return (
    <div className="group block h-full relative bg-white rounded-[2rem] overflow-hidden transition-all duration-500 hover:shadow-[0_20px_40px_-15px_rgba(0,78,40,0.2)] hover:-translate-y-2">
      {/* Image Container - Premium Aspect Ratio */}
      <div className="relative aspect-[4/5] bg-[#f2f3f4] overflow-hidden">
        {/* Favorite Button - Floating Glass Effect */}
        <button
            onClick={handleFavoriteClick}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/90 backdrop-blur-md rounded-full hover:bg-[#168e00] hover:text-white transition-all z-30 shadow-sm group/btn"
            title={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
        >
            <Heart
            size={20}
            className={cn(
                "transition-colors duration-300",
                isFav ? "fill-[#168e00] text-[#168e00]" : "text-gray-400 group-hover/btn:text-white"
            )}
            strokeWidth={2}
            />
        </button>

        <Link 
            href={`/product/${slug}`} 
            onClick={handleCardClick}
            className="block w-full h-full relative"
        >
            {image ? (
            <img 
                src={getImageUrl(image)} 
                alt={title} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out" 
            />
            ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 bg-[#f2f3f4]">
                <span className="text-4xl opacity-50">📦</span>
            </div>
            )}
            
            {/* Quick View Overlay (Optional Premium Touch) */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#004e28]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Floating Action Button on Hover */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 translate-y-10 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500 delay-75">
                <span className="bg-white text-[#004e28] px-6 py-2 rounded-full font-bold text-sm shadow-lg flex items-center gap-2 font-[family-name:var(--font-varela-round)]">
                    Ver Detalles
                </span>
            </div>
        </Link>
      </div>

      {/* Content - Minimalist & Clean */}
      <div className="p-6 flex flex-col flex-grow relative z-10 bg-white">
        <div className="flex flex-col gap-2 mb-3">
           <div className="flex items-center justify-between">
                {supplier ? (
                  <div className="flex items-center gap-2 min-w-0">
                    {supplierHref ? (
                      <Link
                        href={supplierHref}
                        className="text-xs font-bold text-[#168e00] uppercase tracking-wider font-[family-name:var(--font-varela-round)] truncate hover:underline"
                        title={supplier.name || "Proveedor"}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {supplier.name || "Proveedor"}
                      </Link>
                    ) : (
                      <div
                        className="text-xs font-bold text-[#168e00] uppercase tracking-wider font-[family-name:var(--font-varela-round)] truncate"
                        title={supplier.name || "Proveedor"}
                      >
                        {supplier.name || "Proveedor"}
                      </div>
                    )}
                    {showSupplierVerified ? (
                      <span className="inline-flex items-center" title="Empresa verificada">
                        <CheckCircle size={14} className="text-[#168e00]" />
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex items-center gap-1 bg-[#f2f3f4] px-2 py-1 rounded-md">
                    <Star size={10} className="fill-amber-400 text-amber-400" />
                    <span className="font-bold text-xs text-gray-700">{rating}</span>
                </div>
           </div>
          
          <Link href={`/product/${slug}`} onClick={handleCardClick} className="block group-hover:text-[#004e28] transition-colors">
            <h3 className="text-lg font-bold text-gray-900 leading-tight line-clamp-2 font-[family-name:var(--font-varela-round)]">
              {title}
            </h3>
          </Link>
          
          <div className="flex items-baseline gap-1 mt-2">
             <span className="text-sm font-medium text-gray-400">$</span>
             <span className="text-2xl font-black text-[#004e28] tracking-tight font-[family-name:var(--font-poppins)]">{displayPrice}</span>
             <span className="text-xs text-gray-400 ml-1 font-normal">/ {minOrder}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
