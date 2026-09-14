"use client";

import { useEffect, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { fetchWithAuth } from "@/lib/api";
import { PageHero } from "@/components/ui/PageHero";
import { Loader2, Heart, LogIn } from "lucide-react";
import Link from "next/link";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { useAuthHydrated, useAuthStore } from "@/store/useAuthStore";
import { getLoginUrl } from "@/lib/authRedirect";

export default function FavoritesPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { syncFavorites } = useFavoritesStore();
  const { token, isAuthenticated } = useAuthStore();
  const hydrated = useAuthHydrated();

  const loadFavorites = async () => {
    // Wait for token to be available
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/favorites/?limit=100');
      
      if (response.ok) {
        let text = '';
        try {
            text = await response.text();
            if (!text) {
                setProducts([]);
                return;
            }
            const data = JSON.parse(text);
            let productsArray: any[] = [];

        if (Array.isArray(data)) {
            productsArray = data;
        } else if (data && typeof data === 'object') {
            // Handle paginated or wrapped responses
            if (Array.isArray(data.items)) productsArray = data.items;
            else if (Array.isArray(data.results)) productsArray = data.results;
            else if (Array.isArray(data.favorites)) productsArray = data.favorites;
            else if (Array.isArray(data.data)) productsArray = data.data;
        }

        if (productsArray.length > 0 || Array.isArray(productsArray)) {
            // Ensure all items have is_favorite: true since they came from favorites endpoint
            const favoritesData = productsArray
                .filter((item: any) => item && typeof item === 'object')
                .map((item: any) => ({ ...item, is_favorite: true }));
            setProducts(favoritesData);
            syncFavorites(favoritesData);
        } else {
            console.error("Favorites response format not recognized or empty:", data);
            setProducts([]);
        }
        } catch (e) {
            console.error("Failed to parse favorites response:", e, text);
            setProducts([]);
        }
      } else {
        console.error("Failed to fetch favorites:", response.status, response.statusText);
        setProducts([]);
      }
    } catch (error) {
      console.error("Error loading favorites:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated) return;

    if (isAuthenticated && token) {
      loadFavorites();
    } else {
      setLoading(false);
    }
  }, [hydrated, isAuthenticated, token]);

  if (!hydrated || loading) {
    return (
      <div className="space-y-6 font-[family-name:var(--font-poppins)]">
        <PageHero title="Mis Favoritos" subtitle="Administra tus productos guardados." />
        <div className="flex justify-center items-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="space-y-6 font-[family-name:var(--font-poppins)]">
        <PageHero title="Mis Favoritos" subtitle="Administra tus productos guardados." />
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <Heart className="h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-bold text-gray-900">Tus favoritos están en tu cuenta</h2>
          <p className="mt-2 max-w-md text-gray-500">
            Inicia sesión para consultar y administrar los productos y negocios que guardaste.
          </p>
          <Link
            href={getLoginUrl("/client/favorites")}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-white transition-colors hover:bg-primary/90"
          >
            <LogIn size={18} />
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="space-y-6 font-[family-name:var(--font-poppins)]">
        <PageHero title="Mis Favoritos" subtitle="Administra tus productos guardados." />
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Heart className="w-8 h-8 text-primary fill-primary" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">No tienes favoritos aún</h2>
          <p className="text-gray-500 max-w-md mb-8">
            Guarda los productos que te interesen para encontrarlos fácilmente después.
          </p>
          <Link 
            href="/" 
            className="bg-primary text-white px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            Explorar Productos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-[family-name:var(--font-poppins)]">
      <PageHero
        title="Mis Favoritos"
        subtitle="Administra tus productos guardados."
        actions={
        <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
          {products.length} productos
        </span>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {products.map((product) => (
          <ProductCard 
            key={product.id} 
            id={String(product.id)}
            title={product.title}
            price={product.price}
            image={product.image || product.thumbnail_url || ""}
            slug={product.slug || "#"}
            rating={product.average_rating}
            supplier={product.supplier}
          />
        ))}
      </div>
    </div>
  );
}
