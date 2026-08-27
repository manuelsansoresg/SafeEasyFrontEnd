import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { parseMapLocation } from "@/lib/googleMaps";
import {
  absoluteMediaUrl,
  absoluteSiteUrl,
  buildMetadata,
  fetchSupplierForSeo,
  fetchSupplierProductsForSeo,
  fetchSupplierServicesForSeo,
  makeDescription,
  SITE_NAME,
  stripHtml,
  truncateText,
  type SeoProduct,
  type SeoSupplier,
} from "@/lib/seo";
import type { SupplierService } from "@/types/services";

type SupplierLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

type SupplierSeoContext = {
  supplier: SeoSupplier | null;
  services: SupplierService[];
  products: SeoProduct[];
};

const safeSocialUrl = (value?: string | null) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};

const getSupplierContext = async (slug: string): Promise<SupplierSeoContext> => {
  const supplier = await fetchSupplierForSeo(slug);
  if (!supplier || supplier.is_active === false) {
    return { supplier: null, services: [], products: [] };
  }

  const [services, products] = await Promise.all([
    fetchSupplierServicesForSeo(supplier.id),
    fetchSupplierProductsForSeo(supplier),
  ]);
  return { supplier, services, products };
};

const getSupplierImage = (supplier: SeoSupplier) => {
  const carousel = supplier.carousel_images?.find(
    (item) => item.image || item.image_movil || item.thumbnail || item.thumbnail_movil,
  );
  return absoluteMediaUrl(
    carousel?.image ||
      carousel?.image_movil ||
      supplier.logo ||
      supplier.logo_url ||
      supplier.about_media ||
      supplier.intro_image_url ||
      carousel?.thumbnail ||
      carousel?.thumbnail_movil ||
      supplier.image ||
      supplier.image_url,
  );
};

const getBusinessActivity = (supplier: SeoSupplier, services: SupplierService[]) => {
  const structured = [
    supplier.business_category,
    supplier.business_type,
    supplier.specialty,
    ...(supplier.specialties || []),
  ]
    .map(stripHtml)
    .find(Boolean);
  if (structured) return truncateText(structured, 45).replace(/\.\.\.$/, "");

  const serviceTitle = stripHtml(services[0]?.title);
  return serviceTitle
    ? truncateText(serviceTitle, 45).replace(/\.\.\.$/, "")
    : null;
};

const getSupplierDescription = (
  supplier: SeoSupplier,
  services: SupplierService[],
  products: SeoProduct[],
) => {
  const location = [supplier.city, supplier.state].filter(Boolean).join(", ");
  const profileText = stripHtml(
    supplier.short_description ||
      supplier.description ||
      supplier.intro_description ||
      supplier.about ||
      supplier.intro_title ||
      supplier.title_about ||
      supplier.subtitle_about,
  );
  const serviceNames = services
    .map((service) => stripHtml(service.title))
    .filter(Boolean)
    .slice(0, 3);
  const serviceText = serviceNames.length
    ? `Ofrece ${serviceNames.join(", ")}.`
    : "";
  const productText = products.length
    ? " Consulta sus productos e información de compra."
    : "";

  if (serviceText) {
    return truncateText(
      `Conoce ${supplier.name}${location ? ` en ${location}` : ""}. ${serviceText}${profileText ? ` ${profileText}` : ""}`,
      160,
    );
  }

  if (profileText) {
    return truncateText(`${profileText}${productText}`, 160);
  }

  return makeDescription(
    `${supplier.name}${location ? ` en ${location}` : ""}.${productText || " Consulta su información, ubicación, horarios y formas de contacto."}`,
  );
};

const getSupplierTitle = (supplier: SeoSupplier, services: SupplierService[]) => {
  const activity = getBusinessActivity(supplier, services);
  const location = [supplier.city, supplier.state].filter(Boolean).join(", ");
  const qualifier = [activity, location ? `en ${location}` : null]
    .filter(Boolean)
    .join(" ");
  return truncateText(`${supplier.name}${qualifier ? ` | ${qualifier}` : ""}`, 58).replace(
    /\.\.\.$/,
    "",
  );
};

const openingHours = (supplier: SeoSupplier) => {
  const days = [
    "https://schema.org/Sunday",
    "https://schema.org/Monday",
    "https://schema.org/Tuesday",
    "https://schema.org/Wednesday",
    "https://schema.org/Thursday",
    "https://schema.org/Friday",
    "https://schema.org/Saturday",
  ];
  return (supplier.business_hours || []).flatMap((hour) => {
    const day = days[Number(hour.day_of_week)];
    if (hour.is_closed || !day || !hour.open_time || !hour.close_time) return [];
    return [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: day,
        opens: hour.open_time,
        closes: hour.close_time,
      },
    ];
  });
};

export async function generateMetadata({ params }: SupplierLayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const { supplier, services, products } = await getSupplierContext(slug);

  if (!supplier) {
    return buildMetadata({
      title: "Negocio",
      description: "Consulta tiendas, negocios y servicios disponibles en Drooopy.",
      path: `/empresas/${slug}`,
      noIndex: true,
    });
  }

  return buildMetadata({
    title: getSupplierTitle(supplier, services),
    description: getSupplierDescription(supplier, services, products),
    path: `/empresas/${supplier.slug || slug}`,
    image: getSupplierImage(supplier),
    imageAlt: `${supplier.name}${supplier.city ? ` en ${supplier.city}` : ""}`,
  });
}

export default async function SupplierLayout({ children, params }: SupplierLayoutProps) {
  const { slug } = await params;
  const { supplier, services, products } = await getSupplierContext(slug);
  if (!supplier) return children;

  const supplierUrl = absoluteSiteUrl(`/empresas/${supplier.slug || slug}`);
  const image = getSupplierImage(supplier);
  const description = getSupplierDescription(supplier, services, products);
  const location = parseMapLocation(supplier.map_location);
  const addressParts = [supplier.address, supplier.city, supplier.state, supplier.cp, supplier.country].filter(Boolean);
  const sameAs = [supplier.facebook_url, supplier.instagram_url, supplier.x_url]
    .map(safeSocialUrl)
    .filter((url): url is string => Boolean(url));
  const serviceCatalog = services.slice(0, 8);
  const productOffers = products.slice(0, 6);
  const openingHoursSpecifications = openingHours(supplier);
  const schemaType = serviceCatalog.length
    ? "ProfessionalService"
    : productOffers.length
      ? "Store"
      : "LocalBusiness";

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": schemaType,
            "@id": `${supplierUrl}#business`,
            name: supplier.name,
            description,
            url: supplierUrl,
            image: image ? [image] : undefined,
            logo: absoluteMediaUrl(supplier.logo || supplier.logo_url) || undefined,
            telephone: supplier.phone || undefined,
            email: supplier.email || undefined,
            address: addressParts.length
              ? {
                  "@type": "PostalAddress",
                  streetAddress: [supplier.address, supplier.exterior_number, supplier.interior_number, supplier.neighborhood]
                    .filter(Boolean)
                    .join(", ") || undefined,
                  addressLocality: supplier.city || undefined,
                  addressRegion: supplier.state || undefined,
                  postalCode: supplier.cp || undefined,
                  addressCountry: supplier.country || "MX",
                }
              : undefined,
            geo: location
              ? {
                  "@type": "GeoCoordinates",
                  latitude: location.lat,
                  longitude: location.lng,
                }
              : undefined,
            openingHoursSpecification: openingHoursSpecifications.length
              ? openingHoursSpecifications
              : undefined,
            sameAs: sameAs.length ? sameAs : undefined,
            aggregateRating:
              Number(supplier.average_rating) > 0 && Number(supplier.rating_count) > 0
                ? {
                    "@type": "AggregateRating",
                    ratingValue: Number(supplier.average_rating).toFixed(1),
                    reviewCount: Number(supplier.rating_count),
                  }
                : undefined,
            hasOfferCatalog: serviceCatalog.length
              ? {
                  "@type": "OfferCatalog",
                  name: `Servicios de ${supplier.name}`,
                  itemListElement: serviceCatalog.map((service) => ({
                    "@type": "Offer",
                    url: absoluteSiteUrl(`/servicios/${service.id}`),
                    itemOffered: {
                      "@type": "Service",
                      name: stripHtml(service.title),
                      description: stripHtml(service.description)
                        ? makeDescription(service.description, "")
                        : undefined,
                      provider: { "@id": `${supplierUrl}#business` },
                    },
                    price:
                      Number.isFinite(Number(service.price)) && Number(service.price) >= 0
                        ? Number(service.price)
                        : undefined,
                    priceCurrency:
                      Number.isFinite(Number(service.price)) && Number(service.price) >= 0
                        ? "MXN"
                        : undefined,
                  })),
                }
              : undefined,
            makesOffer: productOffers.length
              ? productOffers.map((product) => ({
                  "@type": "Offer",
                  url: absoluteSiteUrl(`/product/${product.slug || product.id}`),
                  price:
                    Number.isFinite(Number(product.price)) && Number(product.price) >= 0
                      ? Number(product.price)
                      : undefined,
                  priceCurrency:
                    Number.isFinite(Number(product.price)) && Number(product.price) >= 0
                      ? "MXN"
                      : undefined,
                  availability:
                    product.stock == null
                      ? undefined
                      : Number(product.stock) > 0
                        ? "https://schema.org/InStock"
                        : "https://schema.org/OutOfStock",
                  itemOffered: {
                    "@type": "Product",
                    name: product.title,
                    url: absoluteSiteUrl(`/product/${product.slug || product.id}`),
                  },
                }))
              : undefined,
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Inicio", item: absoluteSiteUrl("/") },
              { "@type": "ListItem", position: 2, name: "Tiendas y negocios", item: absoluteSiteUrl("/") },
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
