import type { Metadata } from "next";
import { MarketingLandingPage } from "@/components/marketing/MarketingLandingPage";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Menú digital para tu negocio",
  description: "Muestra tus platillos, fotos y precios en un menú fácil de consultar y compartir. Conoce cómo funciona Drooopy para negocios de comida.",
  path: "/menu",
});

export default function MenuPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MarketingLandingPage kind="menu" searchParams={searchParams} />;
}
