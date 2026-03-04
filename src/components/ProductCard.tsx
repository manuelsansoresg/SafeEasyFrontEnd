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
    <div className="group block bg-white rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col h-full relative font-sans">
      {/* Image Container */}
      <div className="relative aspect-square bg-[#f9f9f9] p-4">
        <Link 
            href={`/product/${slug}`} 
            onClick={handleCardClick}
            className="block w-full h-full relative"
        >
            {image ? (
            <img 
                src={getImageUrl(image)} 
                alt={title} 
                className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform duration-500" 
            />
            ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
                <span className="text-4xl">📦</span>
            </div>
            )}
        </Link>
        
        {/* Favorite Button */}
        <button
          onClick={handleFavoriteClick}
          className="absolute top-3 right-3 p-1.5 bg-white rounded-full hover:bg-gray-50 transition-all z-10 shadow-sm"
          title={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
        >
          <Heart
            size={18}
            className={cn(
              "transition-colors",
              isFav ? "fill-black text-black" : "text-gray-400 hover:text-black"
            )}
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col flex-grow">
        <Link href={`/product/${slug}`} onClick={handleCardClick} className="flex-grow">
          <h3 className="text-[15px] font-bold text-gray-900 leading-tight mb-1 line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
          
          <div className="flex items-center justify-between mb-1">
             <span className="text-lg font-bold text-secondary">${displayPrice}</span>
          </div>
          
          <div className="text-xs text-gray-400 mb-3 truncate">
             {supplier?.city || "North Purwokerto"}
          </div>
        </Link>
        
        {/* Rating and Sales */}
        <div className="flex items-center gap-1 text-sm text-gray-600 mt-auto">
            <div className="flex items-center gap-1">
                <Star size={16} className="fill-amber-400 text-amber-400" />
                <span className="font-medium">{rating}</span>
            </div>
            <span className="text-gray-300 mx-1">|</span>
            <span>{sales} ventas</span>
        </div>
      </div>
    </div>
  );
}
