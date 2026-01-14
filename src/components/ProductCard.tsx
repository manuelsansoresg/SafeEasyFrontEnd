import Link from "next/link";
import { Heart, BadgeCheck } from "lucide-react";
import slugify from "slugify";
import StarRating from "./StarRating";
import { Supplier } from "@/lib/products";

interface ProductCardProps {
  id: string;
  title: string;
  price: number;
  image: string;
  minOrder?: string;
  slug: string;
  rating?: number;
  supplier?: Supplier;
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
}: ProductCardProps) {
  const supplierSlug =
    supplier &&
    (supplier.slug && supplier.slug.trim() !== ""
      ? supplier.slug
      : slugify(supplier.name, { lower: true, strict: true }));

  const supplierHref = supplierSlug ? `/empresas/${supplierSlug}` : null;

  return (
    <div className="group block bg-white border rounded-xl overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full">
      <Link href={`/product/${slug}`} className="block relative aspect-square overflow-hidden bg-secondary">
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
        <Link href={`/product/${slug}`}>
          <h3 className="text-sm font-medium text-gray-800 line-clamp-2 group-hover:text-primary transition-colors mb-2 h-10">
            {title}
          </h3>
        </Link>
        
        {supplier && (
          <div className="mb-2 flex items-center gap-1 text-xs">
            <span className="text-gray-500">Por:</span>
            {supplierHref ? (
              <Link
                href={supplierHref}
                className="font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                {supplier.name}
              </Link>
            ) : (
              <span className="font-medium text-gray-700">{supplier.name}</span>
            )}
            {supplier.certificates && supplier.certificates.length > 0 && (
              <span className="inline-flex items-center" aria-label="Empresa certificada">
                <BadgeCheck className="w-4 h-4 text-blue-500" />
              </span>
            )}
          </div>
        )}

        <div className="mb-2">
            <StarRating rating={rating} size={14} showCount={true} />
        </div>
        <div className="flex items-baseline gap-1 mt-auto">
          <span className="text-lg font-bold text-gray-900">${price.toFixed(2)}</span>
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
