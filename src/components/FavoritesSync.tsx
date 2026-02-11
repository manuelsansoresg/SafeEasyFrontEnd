"use client";

import { useEffect } from "react";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { Product } from "@/lib/products";

export function FavoritesSync({ products }: { products: Product[] }) {
  const { syncFavorites } = useFavoritesStore();

  useEffect(() => {
    if (products && products.length > 0) {
      syncFavorites(products);
    }
  }, [products, syncFavorites]);

  return null;
}
