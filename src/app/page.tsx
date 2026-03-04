import { CategorySidebar } from "@/components/CategorySidebar";
import { ProductCard } from "@/components/ProductCard";
import { getProducts } from "@/lib/products";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cookies } from "next/headers";
import { FavoritesSync } from "@/components/FavoritesSync";
import { AdsCarousel } from "@/components/AdsCarousel";
import { HomeCategories } from "@/components/home/HomeCategories";
import { HomeFeaturedSuppliers } from "@/components/home/HomeFeaturedSuppliers";
import { HomeFeaturedProducts } from "@/components/home/HomeFeaturedProducts";

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

      {!hasFilters ? (
        <>
          <HomeCategories />
          <HomeFeaturedSuppliers />
          <HomeFeaturedProducts />
        </>
      ) : (
        <div className="flex gap-6 relative mt-8">
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
                    : "Resultados"}
              </h2>
              <Link href="/" className="text-primary text-sm font-medium hover:underline">
                Limpiar filtros
              </Link>
            </div>

            {products.length > 0 ? (
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
                <Link href="/" className="text-primary hover:underline mt-2 inline-block">
                  Ver todos los productos
                </Link>
              </div>
            )}

            {/* Pagination */}
            {products.length > 0 && (
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
      )}
    </div>
  );
}
