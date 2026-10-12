import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { FavoritesSync } from "@/components/FavoritesSync";
import { AdsCarousel } from "@/components/AdsCarousel";
import { HomeBusinessTypes } from "@/components/home/HomeBusinessTypes";
import { HomeFeaturedSuppliers } from "@/components/home/HomeFeaturedSuppliers";
import { HomeFeaturedProducts } from "@/components/home/HomeFeaturedProducts";
import { RecommendationsSection } from "@/components/recommendations/RecommendationsSection";
import { HomeBusinessSupport } from "@/components/home/HomeBusinessSupport";
import { HomeRegisterBanner } from "@/components/home/HomeRegisterBanner";
import { JsonLd } from "@/components/JsonLd";
import { absoluteSiteUrl, buildMetadata, fetchSeoList, type SeoCategory } from "@/lib/seo";
import type { FeaturedProduct, FeaturedSupplier } from "@/services/homeService";
import type { Product } from "@/lib/products";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Drooopy | Tiendas, negocios y servicios en México",
    description:
      "Encuentra tiendas en línea, productos, negocios y servicios en México. Compra, compara y conecta con empresas cerca de ti en Drooopy.",
    path: "/",
  }),
  title: {
    absolute: "Drooopy | Tiendas, negocios y servicios en México",
  },
};

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const query =
    typeof resolvedSearchParams.search === "string"
      ? resolvedSearchParams.search
      : typeof resolvedSearchParams.q === "string"
        ? resolvedSearchParams.q
        : undefined;
  const categorySlug = typeof resolvedSearchParams.category === "string" ? resolvedSearchParams.category : undefined;
  const subcategorySlug = typeof resolvedSearchParams.subcategory === "string" ? resolvedSearchParams.subcategory : undefined;
  const businessTypeSlug = typeof resolvedSearchParams.business_type === "string" ? resolvedSearchParams.business_type : undefined;
  const isDirectory = businessTypeSlug
    ? undefined
    : resolvedSearchParams.is_directory === "true"
      ? true
      : resolvedSearchParams.is_directory === "false"
        ? false
        : undefined;

  const typeQuery = businessTypeSlug ? `&business_type_slug=${encodeURIComponent(businessTypeSlug)}` : "";
  const [featuredSuppliers, featuredProducts, initialProducts, categories] = await Promise.all([
    fetchSeoList<FeaturedSupplier>(`/suppliers/featured?skip=0&limit=3${typeQuery}`),
    isDirectory === true ? Promise.resolve([]) : fetchSeoList<FeaturedProduct>(`/products/featured?skip=0&limit=3${typeQuery}`),
    query || categorySlug || subcategorySlug || businessTypeSlug || isDirectory !== undefined
      ? Promise.resolve([])
      : fetchSeoList<Product>("/products/?skip=0&limit=20"),
    fetchSeoList<SeoCategory>("/categories/?skip=0&limit=100"),
  ]);

  return (
    <div className="flex flex-col w-full pt-24 md:pt-28">
      <h1 className="sr-only">Drooopy: tiendas, negocios y servicios en México</h1>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Drooopy: tiendas, negocios y servicios en México",
          description:
            "Encuentra tiendas en línea, productos, negocios y servicios en México. Compra, compara y conecta con empresas cerca de ti en Drooopy.",
          url: absoluteSiteUrl("/"),
          inLanguage: "es-MX",
          isPartOf: {
            "@type": "WebSite",
            name: "Drooopy",
            url: absoluteSiteUrl("/"),
          },
        }}
      />
      <nav aria-label="Categorías públicas" className="sr-only focus-within:not-sr-only">
        {categories.filter((item) => item.is_active === true && item.slug).map((item) => (
          <Link key={item.id} href={`/categorias/${item.slug}`}>{item.name}</Link>
        ))}
      </nav>
      {/* Banner & Categories - White Background */}
      <div className="bg-white w-full pb-8">
         <div className="container mx-auto px-4 pt-6">
            <FavoritesSync products={[]} />
            <AdsCarousel />
            <Suspense fallback={<div className="h-48 animate-pulse rounded-2xl bg-gray-100" />}><HomeBusinessTypes initialBusinessType={businessTypeSlug} initialIsDirectory={isDirectory} /></Suspense>
         </div>
      </div>

      {/* Featured - Gray Background */}
      <div className="bg-[#f2f3f4] w-full pb-8">
         <div className="container mx-auto px-4 pt-6">
            <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-white/70" />}><HomeFeaturedSuppliers businessTypeSlug={businessTypeSlug} initialSuppliers={featuredSuppliers.filter((item) => Boolean(item.slug)).slice(0, 3)} /></Suspense>
            {isDirectory !== true ? <HomeFeaturedProducts businessTypeSlug={businessTypeSlug} initialProducts={featuredProducts.filter((item) => Boolean(item.slug)).slice(0, 3)} /> : null}
         </div>
      </div>

      {/* Recommendations Section - White Background */}
      <div className="bg-white w-full">
         <RecommendationsSection 
            initialSearch={query}
            initialCategory={categorySlug}
            initialSubcategory={subcategorySlug}
            initialBusinessType={businessTypeSlug}
            initialIsDirectory={isDirectory}
            initialProducts={initialProducts.filter((item) => item.is_active === true && Boolean(item.slug))}
         />
      </div>

      {/* Business Support Section */}
      <HomeBusinessSupport />

      {/* Register Banner Section */}
      <HomeRegisterBanner />
    </div>
  );
}
