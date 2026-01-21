'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getSimilarProducts } from '@/lib/interactions';
import { ProductCard } from '@/components/ProductCard';
import { Product } from '@/lib/products';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export default function SimilarProductsPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    const fetchSimilar = async () => {
      try {
        const data = await getSimilarProducts(slug);
        setProducts(data);
      } catch (err) {
        console.error("Error fetching similar products:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSimilar();
  }, [slug]);

  if (loading) {
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
