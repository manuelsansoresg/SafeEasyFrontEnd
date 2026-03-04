import { FavoritesSync } from "@/components/FavoritesSync";
import { AdsCarousel } from "@/components/AdsCarousel";
import { HomeCategories } from "@/components/home/HomeCategories";
import { HomeFeaturedSuppliers } from "@/components/home/HomeFeaturedSuppliers";
import { HomeFeaturedProducts } from "@/components/home/HomeFeaturedProducts";
import { RecommendationsSection } from "@/components/recommendations/RecommendationsSection";
import { HomeBusinessSupport } from "@/components/home/HomeBusinessSupport";
import { HomeRegisterBanner } from "@/components/home/HomeRegisterBanner";

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : undefined;
  const categorySlug = typeof resolvedSearchParams.category === "string" ? resolvedSearchParams.category : undefined;
  const subcategorySlug = typeof resolvedSearchParams.subcategory === "string" ? resolvedSearchParams.subcategory : undefined;

  return (
    <div className="flex flex-col w-full">
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
