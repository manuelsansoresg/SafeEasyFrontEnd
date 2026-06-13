import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FavoritesSync } from "@/components/FavoritesSync";
import { JsonLd } from "@/components/JsonLd";
import { RecommendationsSection } from "@/components/recommendations/RecommendationsSection";
import {
  absoluteMediaUrl,
  absoluteSiteUrl,
  buildMetadata,
  fetchCategoryForSeo,
  makeDescription,
} from "@/lib/seo";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

const formatCategoryName = (slug: string) =>
  slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await fetchCategoryForSeo(slug);
  const name = category?.name || formatCategoryName(slug);

  return buildMetadata({
    title: `${name} en México`,
    description: makeDescription(
      category?.description,
      `Encuentra productos y proveedores de ${name.toLowerCase()} en Drooopy. Revisa opciones disponibles y conecta con negocios en México.`,
    ),
    path: `/categorias/${category?.slug || slug}`,
    image: absoluteMediaUrl(category?.image || category?.thumbnail_url),
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = await fetchCategoryForSeo(slug);
  const name = category?.name || formatCategoryName(slug);
  const categorySlug = category?.slug || slug;
  const categoryUrl = absoluteSiteUrl(`/categorias/${categorySlug}`);
  const description = makeDescription(
    category?.description,
    `Explora productos y proveedores de ${name.toLowerCase()} disponibles en Drooopy.`,
  );

  return (
    <div className="flex min-h-screen flex-col bg-white pt-24 md:pt-28">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${name} en México`,
            description,
            url: categoryUrl,
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Inicio",
                item: absoluteSiteUrl("/"),
              },
              {
                "@type": "ListItem",
                position: 2,
                name,
                item: categoryUrl,
              },
            ],
          },
        ]}
      />

      <section className="bg-[#004e28] text-white">
        <div className="container mx-auto px-4 py-12 md:py-16">
          <Link
            href="/"
            className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-white/80 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Volver al inicio
          </Link>
          <div className="max-w-4xl">
            <p className="font-[family-name:var(--font-varela-round)] text-lg text-[#7ed957]">
              Categoría
            </p>
            <h1 className="mt-3 font-[family-name:var(--font-varela-round)] text-4xl leading-tight md:text-6xl">
              {name}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-white/85 md:text-lg">
              {description}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <FavoritesSync products={[]} />
        <RecommendationsSection initialCategory={categorySlug} />
      </section>
    </div>
  );
}
