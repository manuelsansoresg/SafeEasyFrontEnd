'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getRecommendations, getFallbackProducts, registerInteraction } from '@/lib/interactions';
import { ProductCard } from '@/components/ProductCard';
import { Product } from '@/lib/products';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useAuthStore } from '@/store/useAuthStore';

export default function RecommendedProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { syncFavorites } = useFavoritesStore();
  const { token } = useAuthStore();

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        let data = await getRecommendations(500);
        
        // Fallback to standard products if recommendations are empty or failed
        if (!data || data.length === 0) {
            data = await getFallbackProducts(20);
        }
        
        if (data) {
          syncFavorites(data);
          setProducts(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [syncFavorites, token]);

  const handleProductClick = async (e: React.MouseEvent, product: Product) => {
    e.preventDefault(); // Prevent default Link navigation
    
    // 1. Register Interaction (View)
    // We don't await this so it doesn't block the UI, 
    // but keepalive=true in interactions.ts ensures it completes.
    registerInteraction({
        product_id: product.id,
        interaction_type: 'view'
    });

    // 2. Navigate to Similar Products Page
    router.push(`/product/${product.slug}/similar`);
  };

  if (loading) return (
    <div className="w-full py-12 flex justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  if (products.length === 0) return (
      <div className="py-12 text-center text-gray-500">
          No hay recomendaciones disponibles por el momento.
      </div>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          id={String(product.id)}
          title={product.title}
          price={product.price}
          image={product.thumbnail_url || ""}
          minOrder="1 pieza"
          slug={product.slug}
          rating={Number(product.average_rating || 0)}
          supplier={product.supplier}
          onClick={(e) => handleProductClick(e, product)}
        />
      ))}
    </div>
  );
}
