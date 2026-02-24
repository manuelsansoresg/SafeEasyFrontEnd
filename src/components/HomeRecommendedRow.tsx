"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Product } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";

type KindKey = "most_searched" | "most_purchased" | "best_rated";

interface HomeRecommendedRowProps {
  title: string;
  description: string;
  kind: KindKey;
  products: Product[];
}

export function HomeRecommendedRow({
  title,
  description,
  kind,
  products,
}: HomeRecommendedRowProps) {
  const router = useRouter();

  const href = `/recomendados?kind=${kind}`;

  const handleCardClick = useCallback(() => {
    router.push(href);
  }, [router, href]);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={handleCardClick}
          className="text-left group"
        >
          <h2 className="text-lg md:text-xl font-semibold text-gray-900 group-hover:text-primary transition-colors">
            {title}
          </h2>
          <p className="text-xs md:text-sm text-gray-500">
            {description}
          </p>
        </button>
        <Link
          href={href}
          className="text-xs md:text-sm font-medium text-primary hover:underline"
        >
          Ver más
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {products.slice(0, 5).map((product, index) => (
          <div
            key={product.id}
            className={index >= 4 ? "hidden lg:block" : ""}
          >
            <ProductCard
              id={String(product.id)}
              title={product.title}
              price={product.price}
              image={product.thumbnail_url || ""}
              minOrder="1 pieza"
              slug={product.slug}
              rating={Number(product.average_rating || 0)}
              supplier={product.supplier}
              onClick={handleCardClick}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
