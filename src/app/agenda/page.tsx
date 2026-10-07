import type { Metadata } from "next";
import { MarketingLandingPage } from "@/components/marketing/MarketingLandingPage";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Agenda y reservaciones para tu negocio",
  description: "Muestra tus servicios y horarios disponibles para que tus clientes encuentren una opción para reservar en Drooopy.",
  path: "/agenda",
});

export default function AgendaLandingPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <MarketingLandingPage kind="agenda" searchParams={searchParams} />;
}
