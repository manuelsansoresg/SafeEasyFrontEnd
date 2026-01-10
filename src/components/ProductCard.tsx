import Link from "next/link";
import { Heart } from "lucide-react";
import StarRating from "./StarRating";

interface ProductCardProps {
  id: string;
  title: string;
  price: number;
  image: string;
  minOrder?: string;
  slug: string;
  rating?: number;
}

export function ProductCard({ id, title, price, image, minOrder = "1 pieza", slug, rating = 0 }: ProductCardProps) {
  return (
    <Link href={`/product/${slug}`} className="group block bg-white border rounded-xl overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="relative aspect-square overflow-hidden bg-secondary">
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
      </div>
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-800 line-clamp-2 group-hover:text-primary transition-colors mb-2 h-10">
          {title}
        </h3>
        <div className="mb-2">
            <StarRating rating={rating} size={14} showCount={true} />
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-lg font-bold text-gray-900">${price.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground">/ pieza</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{minOrder} (Orden mínima)</p>
      </div>
    </Link>
  );
}
