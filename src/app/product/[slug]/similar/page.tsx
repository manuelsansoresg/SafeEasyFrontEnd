'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSimilarProducts } from '@/lib/interactions';
import { ProductCard } from '@/components/ProductCard';
import { Product } from '@/lib/products';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useAuthStore } from '@/store/useAuthStore';

export default function SimilarProductsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const { syncFavorites } = useFavoritesStore();
  const { token } = useAuthStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 20;

  const observerTarget = useRef(null);

  const fetchSimilar = async (currentPage: number, append: boolean = false) => {
    try {
      if (!append) setLoading(true);
      const skip = (currentPage - 1) * limit;
      const data = await getSimilarProducts(slug, limit, skip);
      
      syncFavorites(data);

      if (append) {
        setProducts(prev => [...prev, ...data]);
      } else {
        setProducts(data);
      }
      setHasMore(data.length === limit);
    } catch (err) {
      console.error("Error fetching similar products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!slug) return;
    fetchSimilar(1, false);
  }, [slug, token]);

  useEffect(() => {
    if (!slug) return;
    if (page === 1) return;
    fetchSimilar(page, true);
  }, [page, slug]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, loading]);

  if (loading && page === 1) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
          <p className="text-gray-500">Cargando recomendaciones...</p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <button 
            onClick={() => router.back()} 
            className="flex items-center text-gray-500 hover:text-primary transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Volver
          </button>
          
        </div>

        {products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
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
                />
              ))}
            </div>
            
            {hasMore && (
              <div ref={observerTarget} className="flex justify-center py-8">
                {loading && (
                  <div className="flex items-center gap-3 text-gray-500">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-sm">Cargando más productos...</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20 bg-gray-50 rounded-2xl">
            <p className="text-gray-500 text-lg">
              No encontramos productos relacionados en este momento.
            </p>
            <button 
              onClick={() => router.push('/')}
              className="mt-4 px-6 py-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors"
            >
              Explorar catálogo
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
