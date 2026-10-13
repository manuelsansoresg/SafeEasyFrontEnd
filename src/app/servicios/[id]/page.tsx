import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { absoluteMediaUrl, absoluteSiteUrl, buildMetadata, getApiBaseUrl, makeDescription, truncateText } from "@/lib/seo";
import { getPublicService } from "@/lib/publicCatalog";
import ServiceDetailClient, { type ServiceSupplierSummary } from "./ServiceDetailClient";

type ServicePageProps = { params: Promise<{ id: string }> };

async function getSupplierSummary(supplierId: number): Promise<ServiceSupplierSummary | null> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/suppliers/${supplierId}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;
    const supplier = await response.json() as ServiceSupplierSummary;
    return supplier?.id === supplierId ? supplier : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: ServicePageProps): Promise<Metadata> {
  const { id } = await params;
  const service = await getPublicService(id);
  if (!service) notFound();

  return buildMetadata({
    title: truncateText(service.title, 58),
    description: makeDescription(service.description, `Conoce ${service.title} y contacta al proveedor en Drooopy.`),
    path: `/servicios/${service.id}`,
    image: absoluteMediaUrl(service.cover_image_url || service.images?.[0]?.image_url),
    imageAlt: service.title,
  });
}

export default async function PublicServicePage({ params }: ServicePageProps) {
  const { id } = await params;
  const service = await getPublicService(id);
  if (!service) notFound();
  const supplier = await getSupplierSummary(service.supplier_id);
  const url = absoluteSiteUrl(`/servicios/${service.id}`);
  const image = absoluteMediaUrl(service.cover_image_url || service.images?.[0]?.image_url);
  const price = service.price == null ? null : Number(service.price);
  const hasPrice = price !== null && Number.isFinite(price) && price >= 0;

  return (
    <>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Service",
        name: service.title,
        description: makeDescription(service.description, `Servicio disponible en Drooopy.`),
        url,
        image: image || undefined,
        provider: supplier?.name ? {
          "@type": "Organization",
          name: supplier.name,
          url: supplier.slug ? absoluteSiteUrl(`/empresas/${supplier.slug}`) : undefined,
        } : undefined,
        offers: hasPrice ? {
          "@type": "Offer",
          price,
          priceCurrency: "MXN",
          url,
        } : undefined,
      }} />
      <ServiceDetailClient key={service.id} service={service} initialSupplier={supplier} />
    </>
  );
}
