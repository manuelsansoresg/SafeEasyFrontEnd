import { CategorySidebar } from "@/components/CategorySidebar";
import { ProductCard } from "@/components/ProductCard";
import { WelcomeSection } from "@/components/WelcomeSection";
import { getProducts } from "@/lib/products";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  const query = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : "";
  const categoryId = resolvedSearchParams.category ? Number(resolvedSearchParams.category) : undefined;
  const subcategoryId = resolvedSearchParams.subcategory ? Number(resolvedSearchParams.subcategory) : undefined;
  const limit = 20;

  const products = await getProducts(page, limit, query, categoryId, subcategoryId);

  const getPageUrl = (newPage: number) => {
    const params = new URLSearchParams();
    params.set("page", String(newPage));
    if (query) params.set("q", query);
    if (categoryId) params.set("category", String(categoryId));
    if (subcategoryId) params.set("subcategory", String(subcategoryId));
    return `/?${params.toString()}`;
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Welcome Section */}
      <WelcomeSection />

      <div className="flex gap-6 relative">
        {/* Sidebar - Desktop Only */}
        <CategorySidebar />

        {/* Main Content - Product Grid */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              {query 
                ? `Resultados para "${query}"` 
                : categoryId 
                  ? "Productos de la categoría" 
                  : "Recomendado para ti"}
            </h2>
            {!query && !categoryId && !subcategoryId && (
              <button className="text-primary text-sm font-medium hover:underline">
                Ver todo
              </button>
            )}
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
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <p className="text-gray-500">No se encontraron productos.</p>
              {(query || categoryId || subcategoryId) && (
                <Link href="/" className="text-primary hover:underline mt-2 inline-block">
                  Ver todos los productos
                </Link>
              )}
            </div>
          )}

          {/* Pagination */}
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

            <span className="text-sm text-gray-600 font-medium">
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
        </div>
      </div>
    </div>
  );
}
