import type { Metadata } from "next";
import { MarketingLandingPage } from "@/components/marketing/MarketingLandingPage";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Muestra y vende tus productos en Drooopy",
    description: "Organiza tus productos, imágenes y precios en un catálogo fácil de consultar. Déjanos tus datos y conoce Drooopy para tu negocio.",
    path: "/vender",
  }),
  title: { absolute: "Muestra y vende tus productos en Drooopy" },
};

export default function ProductsLandingPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MarketingLandingPage kind="products" searchParams={searchParams} />;
}
