import type { Metadata } from "next";
import { FavoritesSync } from "@/components/FavoritesSync";
import { AdsCarousel } from "@/components/AdsCarousel";
import { HomeCategories } from "@/components/home/HomeCategories";
import { HomeFeaturedSuppliers } from "@/components/home/HomeFeaturedSuppliers";
import { HomeFeaturedProducts } from "@/components/home/HomeFeaturedProducts";
import { RecommendationsSection } from "@/components/recommendations/RecommendationsSection";
import { HomeBusinessSupport } from "@/components/home/HomeBusinessSupport";
import { HomeRegisterBanner } from "@/components/home/HomeRegisterBanner";
import { JsonLd } from "@/components/JsonLd";
import { absoluteSiteUrl, buildMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Drooopy | Productos y proveedores en México",
    description:
      "Descubre productos, proveedores y negocios en México. Compara opciones, revisa catálogos y conecta con vendedores desde Drooopy.",
    path: "/",
  }),
  title: {
    absolute: "Drooopy | Productos y proveedores en México",
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

  return (
    <div className="flex flex-col w-full pt-24 md:pt-28">
      <h1 className="sr-only">Drooopy: productos y proveedores en México</h1>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Drooopy | Productos y proveedores en México",
          description:
            "Descubre productos, proveedores y negocios en México desde Drooopy.",
          url: absoluteSiteUrl("/"),
        }}
      />
      {/* Banner & Categories - White Background */}
      <div className="bg-white w-full pb-8">
         <div className="container mx-auto px-4 pt-6">
            <FavoritesSync products={[]} />
            <AdsCarousel />
            <HomeCategories />
         </div>
      </div>

      {/* Featured - Gray Background */}
      <div className="bg-[#f2f3f4] w-full pb-8">
         <div className="container mx-auto px-4 pt-6">
            <HomeFeaturedSuppliers />
            <HomeFeaturedProducts />
         </div>
      </div>

      {/* Recommendations Section - White Background */}
      <div className="bg-white w-full">
         <RecommendationsSection 
            initialSearch={query}
            initialCategory={categorySlug}
            initialSubcategory={subcategorySlug}
         />
      </div>

      {/* Business Support Section */}
      <HomeBusinessSupport />

      {/* Register Banner Section */}
      <HomeRegisterBanner />
    </div>
  );
}
