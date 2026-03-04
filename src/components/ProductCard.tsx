"use client";

import Link from "next/link";
import { Heart, Star } from "lucide-react";
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
  rating = 4.8,
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
    <div className="group block h-full relative font-sans">
      {/* Image Container */}
      <div className="relative aspect-square bg-[#f9f9f9] rounded-2xl overflow-hidden mb-3">
        {/* Favorite Button */}
        <button
            onClick={handleFavoriteClick}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-white rounded-full hover:bg-gray-50 transition-all z-30 shadow-sm border border-gray-100 group/btn"
            title={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
        >
            <Heart
            size={16}
            className={cn(
                "transition-colors",
                isFav ? "fill-red-500 text-red-500" : "text-gray-400 group-hover/btn:text-red-500"
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
                className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500 p-4" 
            />
            ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
                <span className="text-4xl">📦</span>
            </div>
            )}
        </Link>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-grow">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-1 md:gap-2 mb-1">
          <Link href={`/product/${slug}`} onClick={handleCardClick} className="flex-grow">
            <h3 className="text-[15px] font-bold text-gray-900 leading-tight line-clamp-2 group-hover:text-primary transition-colors">
              {title}
            </h3>
          </Link>
          <span className="text-lg font-bold text-[#168e00] shrink-0">${displayPrice}</span>
        </div>
          
        <div className="mb-2 truncate">
           {supplier ? (
             supplierHref ? (
               <Link href={supplierHref} className="text-xs text-gray-400 hover:text-primary hover:underline transition-colors">
                 {supplier.name || supplier.city || "Proveedor"}
               </Link>
             ) : (
               <span className="text-xs text-gray-400">
                 {supplier.name || supplier.city || "Proveedor"}
               </span>
             )
           ) : (
             <span className="text-xs text-gray-400">North Purwokerto</span>
           )}
        </div>
        
        {/* Rating and Sales */}
        <div className="flex items-center gap-1 text-sm text-gray-600 mt-auto">
            <div className="flex items-center gap-1">
                <Star size={16} className="fill-amber-400 text-amber-400" />
                <span className="font-medium text-xs">{rating}</span>
            </div>
            <span className="text-gray-300 mx-1">|</span>
            <span className="text-xs">{sales} ventas</span>
        </div>
      </div>
    </div>
  );
}
