"use client";

import Link from "next/link";
import { Heart, BadgeCheck } from "lucide-react";
import slugify from "slugify";
import StarRating from "./StarRating";
import { Supplier } from "@/lib/products";
import { useAuthStore } from "@/store/useAuthStore";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  id: string;
  title: string;
  price: number;
  image: string;
  minOrder?: string;
  slug: string;
  rating?: number;
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

  return (
    <div className="group block bg-white border rounded-xl overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full relative">
      <Link 
        href={`/product/${slug}`} 
        className="block relative aspect-square overflow-hidden bg-secondary"
        onClick={handleCardClick}
      >
        <button
          onClick={handleFavoriteClick}
          className="absolute top-2 right-2 p-2 bg-white/90 rounded-full hover:bg-white transition-all z-10 shadow-sm hover:scale-110"
          title={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
        >
          <Heart
            size={18}
            className={cn(
              "transition-colors",
              isFav ? "fill-primary text-primary" : "text-gray-400 hover:text-primary"
            )}
          />
        </button>
        {image ? (
          <img 
            src={image} 
            alt={title} 
            className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500" 
          />
        ) : (
          /* Placeholder for Image */
          <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-gray-100 group-hover:scale-105 transition-transform duration-500">
             <span className="text-4xl">📦</span>
          </div>
        )}
      </Link>
      <div className="p-4 flex flex-col flex-grow">
        <Link href={`/product/${slug}`} onClick={handleCardClick}>
          <h3 className="text-sm font-medium text-gray-800 line-clamp-2 group-hover:text-primary transition-colors mb-2 h-10">
            {title}
          </h3>
        </Link>
        
        <div className="mb-2">
            <StarRating rating={rating} size={14} showCount={true} />
        </div>
        <div className="flex items-baseline gap-1 mt-auto">
          <span className="text-lg font-bold text-gray-900">${(typeof price === 'number' ? price : 0).toFixed(2)}</span>
          <span className="text-xs text-muted-foreground">/ pieza</span>
        </div>

        {supplier && supplierHref ? (
          <Link
            href={supplierHref}
            className="text-xs text-primary mt-1 inline-flex items-center gap-1 hover:underline cursor-pointer"
          >
            {supplier.name}
          </Link>
        ) : (
          supplier && (
            <p className="text-xs text-muted-foreground mt-1">
              {supplier.name}
            </p>
          )
        )}
      </div>
    </div>
  );
}
