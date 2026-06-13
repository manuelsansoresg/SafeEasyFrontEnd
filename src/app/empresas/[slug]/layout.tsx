import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import {
  absoluteMediaUrl,
  absoluteSiteUrl,
  buildMetadata,
  fetchSupplierForSeo,
  makeDescription,
  SITE_NAME,
  stripHtml,
} from "@/lib/seo";

type SupplierLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

const getSupplierImage = (supplier: Awaited<ReturnType<typeof fetchSupplierForSeo>>) => {
  if (!supplier) return null;
  return absoluteMediaUrl(
    supplier.logo ||
      supplier.logo_url ||
      supplier.image ||
      supplier.image_url,
  );
};

const getSupplierDescription = (supplier: Awaited<ReturnType<typeof fetchSupplierForSeo>>) => {
  if (!supplier) return "Consulta proveedores y negocios en Drooopy.";
  return makeDescription(
    supplier.short_description || supplier.description || supplier.about,
    `${supplier.name} en Drooopy. Revisa su catálogo, productos, datos de contacto y ubicación.`,
  );
};

export async function generateMetadata({ params }: SupplierLayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const supplier = await fetchSupplierForSeo(slug);

  if (!supplier) {
    return buildMetadata({
      title: "Proveedor",
      description: "Consulta proveedores, negocios y catálogos disponibles en Drooopy.",
      path: `/empresas/${slug}`,
    });
  }

  const location = [supplier.city, supplier.state].filter(Boolean).join(", ");

  return buildMetadata({
    title: `${supplier.name}${location ? ` en ${location}` : ""}`,
    description: getSupplierDescription(supplier),
    path: `/empresas/${supplier.slug || slug}`,
    image: getSupplierImage(supplier),
  });
}

export default async function SupplierLayout({ children, params }: SupplierLayoutProps) {
  const { slug } = await params;
  const supplier = await fetchSupplierForSeo(slug);

  if (!supplier) return children;

  const supplierSlug = supplier.slug || slug;
  const supplierUrl = absoluteSiteUrl(`/empresas/${supplierSlug}`);
  const image = getSupplierImage(supplier);
  const addressParts = [supplier.city, supplier.state, supplier.country].filter(Boolean);

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "Store",
            name: supplier.name,
            description: getSupplierDescription(supplier),
            url: supplierUrl,
            image: image || undefined,
            telephone: supplier.phone || undefined,
            email: supplier.email || undefined,
            address:
              addressParts.length > 0
                ? {
                    "@type": "PostalAddress",
                    addressLocality: supplier.city || undefined,
                    addressRegion: supplier.state || undefined,
                    addressCountry: supplier.country || "MX",
                  }
                : undefined,
            aggregateRating:
              Number(supplier.average_rating) > 0 && Number(supplier.rating_count) > 0
                ? {
                    "@type": "AggregateRating",
                    ratingValue: Number(supplier.average_rating).toFixed(1),
                    reviewCount: Number(supplier.rating_count),
                  }
                : undefined,
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
                name: "Proveedores",
                item: absoluteSiteUrl("/"),
              },
              {
                "@type": "ListItem",
                position: 3,
                name: stripHtml(supplier.name) || SITE_NAME,
                item: supplierUrl,
              },
            ],
          },
        ]}
      />
      {children}
    </>
  );
}
