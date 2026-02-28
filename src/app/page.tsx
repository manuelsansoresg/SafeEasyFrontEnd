import { CategorySidebar } from "@/components/CategorySidebar";
import { ProductCard } from "@/components/ProductCard";
import RecommendedProducts from "@/components/RecommendedProducts";
import { getProducts } from "@/lib/products";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cookies } from "next/headers";
import { FavoritesSync } from "@/components/FavoritesSync";
import { AdsCarousel } from "@/components/AdsCarousel";
import { Product } from "@/lib/products";
import { HomeRecommendedRow } from "@/components/HomeRecommendedRow";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const query = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : "";
  const categorySlug = typeof resolvedSearchParams.category === "string" ? resolvedSearchParams.category : undefined;
  const subcategorySlug = typeof resolvedSearchParams.subcategory === "string" ? resolvedSearchParams.subcategory : undefined;
  const limit = 20;

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  const hasFilters = query || categorySlug || subcategorySlug;
  const products = hasFilters ? await getProducts(page, limit, query, categorySlug, subcategorySlug, token) : [];

  const fetchRecommendedList = async (kind: string): Promise<Product[]> => {
    const base = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api").replace(/\/$/, "");
    const params = new URLSearchParams({
      kind,
      limit: "5",
      skip: "0",
    });

    const url = `${base}/products/recommended?${params.toString()}`;

    try {
      const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
      if (!res.ok) {
        console.error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
        return [];
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
      if (data && typeof data === "object") {
        const arrays = [
          (data as any).items,
          (data as any).results,
          (data as any).products,
          (data as any).data,
        ];
        const found = arrays.find((a) => Array.isArray(a)) as Product[] | undefined;
        if (found) {
          return found;
        }
      }
    } catch (error) {
      console.error(`Error fetching recommended from ${url}:`, error);
    }

    // Si nada funciona, devolvemos lista vacía (no mostramos productos para ese tipo)
    return [];
  };

  const [mostSearchedProducts, mostPurchasedProducts, bestRatedProducts] =
    await Promise.all([
      fetchRecommendedList("most_searched"),
      fetchRecommendedList("most_purchased"),
      fetchRecommendedList("best_rated"),
    ]);

  const getPageUrl = (newPage: number) => {
    const params = new URLSearchParams();
    params.set("page", String(newPage));
    if (query) params.set("q", query);
    if (categorySlug) params.set("category", categorySlug);
    if (subcategorySlug) params.set("subcategory", subcategorySlug);
    return `/?${params.toString()}`;
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <FavoritesSync products={products} />
      <AdsCarousel />

      {!hasFilters && (
        <div className="space-y-8 mb-8 bg-primary/5 border border-primary/10 rounded-2xl p-4 md:p-6">
          <HomeRecommendedRow
            title="Más buscados"
            description="Productos con más vistas y búsquedas."
            kind="most_searched"
            products={mostSearchedProducts}
          />

          <HomeRecommendedRow
            title="Más comprados"
            description="Productos con más órdenes completadas."
            kind="most_purchased"
            products={mostPurchasedProducts}
          />

          <HomeRecommendedRow
            title="Mejor calificados"
            description="Productos con mejores reseñas de clientes."
            kind="best_rated"
            products={bestRatedProducts}
          />
        </div>
      )}

      <div className="flex gap-6 relative">
        {/* Sidebar - Desktop Only */}
        <CategorySidebar />

        {/* Main Content - Product Grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              {query 
                ? `Resultados para "${query}"` 
                : categorySlug 
                  ? `Productos de ${subcategorySlug || categorySlug}`.replace(/-/g, ' ') 
                  : "Recomendado para ti"}
            </h2>
            {!query && !categorySlug && !subcategorySlug && (
              <Link href="/" className="text-primary text-sm font-medium hover:underline">
                Ver todo
              </Link>
            )}
          </div>

          {hasFilters ? (
            products.length > 0 ? (
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
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-xl">
                <p className="text-gray-500">No se encontraron productos.</p>
                {(query || categorySlug || subcategorySlug) && (
                  <Link href="/" className="text-primary hover:underline mt-2 inline-block">
                    Ver todos los productos
                  </Link>
                )}
              </div>
            )
          ) : (
            <RecommendedProducts />
          )}

          {/* Pagination - Only show if we have filters (standard list) */}
          {hasFilters && products.length > 0 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              {page > 1 ? (
                <Link
                  href={getPageUrl(page - 1)}
                  className="flex items-center gap-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  <ChevronLeft size={16} />
                  Anterior
                </Link>
              ) : (
                <button
                  disabled
                  className="flex items-center gap-1 px-4 py-2 border rounded-lg text-gray-300 cursor-not-allowed text-sm font-medium"
                >
                  <ChevronLeft size={16} />
                  Anterior
                </button>
              )}
              
              <span className="text-sm text-gray-600">
                Página {page}
              </span>

              {products.length === limit ? (
                <Link
                  href={getPageUrl(page + 1)}
                  className="flex items-center gap-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Siguiente
                  <ChevronRight size={16} />
                </Link>
              ) : (
                <button
                  disabled
                  className="flex items-center gap-1 px-4 py-2 border rounded-lg text-gray-300 cursor-not-allowed text-sm font-medium"
                >
                  Siguiente
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
