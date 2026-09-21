"use client";

import { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { ProductCard } from "@/components/ProductCard";

interface SupplierProduct {
  id: string | number;
  title: string;
  price: number;
  stock: number;
  slug: string;
  thumbnail_url?: string | null;
  image?: string | null;
  average_rating?: number;
  sales_count?: number;
  supplier?: any;
}

interface SupplierProductCarouselProps {
  supplierId: number | string;
  kind: "most_searched" | "most_purchased" | "best_rated";
  title: string;
  limit?: number;
}

export function SupplierProductCarousel({
  supplierId,
  kind,
  title,
  limit = 12,
}: SupplierProductCarouselProps) {
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Default to desktop view (4 items)
  const [itemsPerView, setItemsPerView] = useState(4);

  useEffect(() => {
    const handleResize = () => {
      // Mobile breakpoint usually 768px
      if (window.innerWidth < 768) {
        setItemsPerView(2);
      } else {
        setItemsPerView(4);
      }
    };

    // Set initial value
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        // Use the API endpoint provided by the user
        // Note: The limit query parameter is handled by the backend
        const res = await fetch(
          `/api/products/recommended/supplier/${supplierId}?kind=${kind}&limit=${limit}`
        );

        if (!res.ok) {
          // If the endpoint doesn't exist yet, we might want to fail gracefully or show empty
          console.error("Failed to fetch products");
          setProducts([]);
          return;
        }

        const data = await res.json();
        const items = Array.isArray(data) ? data : data.items || [];
        setProducts(items);
      } catch (err) {
        console.error(err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    if (supplierId) {
      fetchProducts();
    }
  }, [supplierId, kind, limit]);

  const nextSlide = () => {
    if (currentIndex + itemsPerView < products.length) {
      setCurrentIndex((prev) => prev + itemsPerView);
    }
  };

  const prevSlide = () => {
    if (currentIndex - itemsPerView >= 0) {
      setCurrentIndex((prev) => prev - itemsPerView);
    }
  };

  if (loading) {
    return (
      <div className="py-8 w-full">
        <h3 className="text-2xl font-bold mb-6 text-[#004e28] px-4 md:px-0 font-[family-name:var(--font-varela-round)]">
            {title}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-4 md:px-0">
          {[...Array(itemsPerView)].map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return null;
  }

  const showControls = products.length > itemsPerView;
  const isAtStart = currentIndex === 0;
  const isAtEnd = currentIndex + itemsPerView >= products.length;

  return (
    <div className="py-8 w-full relative group">
      <div className="flex items-center justify-between mb-6 px-4 md:px-0">
        <h3 className="text-2xl font-bold text-[#004e28] font-[family-name:var(--font-varela-round)]">
          {title}
        </h3>
        {showControls && (
          <div className="flex gap-2">
            <button
              onClick={prevSlide}
              disabled={isAtStart}
              className="p-2 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-[#004e28] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={nextSlide}
              disabled={isAtEnd}
              className="p-2 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-[#004e28] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Siguiente"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden px-4 md:px-0">
        <motion.div
          className="flex"
          initial={false}
          animate={{ x: `-${currentIndex * (100 / itemsPerView)}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="flex-shrink-0 px-2"
              style={{ width: `${100 / itemsPerView}%` }}
            >
              <ProductCard
                id={String(product.id)}
                title={product.title}
                price={product.price}
                image={product.thumbnail_url || ""}
                minOrder="1 pza"
                slug={product.slug}
                rating={product.average_rating || 0}
                sales={product.sales_count || product.stock}
                supplier={product.supplier}
              />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
