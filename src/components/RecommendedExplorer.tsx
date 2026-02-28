"use client";

import { useEffect, useState } from "react";
import { Product } from "@/lib/products";
import { ProductCard } from "@/components/ProductCard";

const PAGE_LIMIT = 5;

type KindKey = "most_searched" | "most_purchased" | "best_rated";

const KIND_CONFIG: { key: KindKey; label: string }[] = [
  { key: "most_searched", label: "Más buscados" },
  { key: "most_purchased", label: "Más comprados" },
  { key: "best_rated", label: "Mejor calificados" },
];

interface RecommendedExplorerProps {
  initialKind: KindKey;
}

export function RecommendedExplorer({ initialKind }: RecommendedExplorerProps) {
  const [activeKind, setActiveKind] = useState<KindKey>(initialKind);
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = async (kind: KindKey, skipValue: number, append: boolean) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const params = new URLSearchParams({
        kind,
        limit: String(PAGE_LIMIT),
        skip: String(skipValue),
      });

      const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api").replace(/\/$/, "");
      const urls = [
        // Preferir rewrite directo al backend
        `/api/backend/products/recommended?${params.toString()}`,
        // Proxy genérico interno
        `/api/products/recommended?${params.toString()}`,
        // Ruta absoluta directa al backend
        `${base}/products/recommended?${params.toString()}`,
      ];

      let list: Product[] | null = null;

      for (const url of urls) {
        try {
          const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
          if (!res.ok) {
            continue;
          }
          const data = await res.json();
          if (Array.isArray(data)) {
            list = data;
          } else if (data && typeof data === "object") {
            if (Array.isArray((data as any).items)) list = (data as any).items;
            else if (Array.isArray((data as any).results)) list = (data as any).results;
            else if (Array.isArray((data as any).products)) list = (data as any).products;
            else if (Array.isArray((data as any).data)) list = (data as any).data;
          }
          break;
        } catch {
          continue;
        }
      }

      if (!list) {
        setError("No se pudieron cargar los productos.");
        setHasMore(false);
        return;
      }

      setHasMore(list.length === PAGE_LIMIT);
      if (append) {
        setItems((prev) => [...prev, ...list!]);
      } else {
        setItems(list);
      }
    } catch {
      setError("Ocurrió un error al cargar los productos.");
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    setItems([]);
    setError(null);
    setHasMore(true);
    setSkip(0);
    fetchPage(activeKind, 0, false);
  }, [activeKind]);

  useEffect(() => {
    const onScroll = () => {
      if (!hasMore || loading || loadingMore) return;
      const scrollPosition = window.innerHeight + window.scrollY;
      const threshold = document.body.offsetHeight - 400;
      if (scrollPosition >= threshold) {
        const nextSkip = skip + PAGE_LIMIT;
        setSkip(nextSkip);
        fetchPage(activeKind, nextSkip, true);
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [hasMore, loading, loadingMore, skip, activeKind]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 mb-2">
        {KIND_CONFIG.map((kind) => {
          const isActive = kind.key === activeKind;
          return (
            <button
              key={kind.key}
              type="button"
              onClick={() => setActiveKind(kind.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium border ${
                isActive
                  ? "bg-primary text-white border-primary"
                  : "bg-white text-gray-700 border-gray-200 hover:border-primary hover:text-primary"
              }`}
            >
              {kind.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="w-full py-12 flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          No hay productos disponibles en esta categoría.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((product, index) => (
            <ProductCard
              key={`${product.id}-${index}`}
              id={String(product.id)}
              title={product.title}
              price={product.price}
              image={product.thumbnail_url || ""}
              minOrder="1 pieza"
              slug={product.slug}
              rating={Number(product.average_rating || 0)}
              supplier={product.supplier}
            />
          ))}
        </div>
      )}

      {loadingMore && (
        <div className="w-full py-4 flex justify-center text-sm text-gray-500">
          Cargando más productos...
        </div>
      )}
    </div>
  );
}
