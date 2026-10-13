import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductDetailClient from "@/components/product/ProductDetailClient";
import { JsonLd } from "@/components/JsonLd";
import { getPublicProduct } from "@/lib/publicCatalog";
import {
  absoluteMediaUrl,
  absoluteSiteUrl,
  buildMetadata,
  makeDescription,
  SITE_NAME,
  truncateText,
} from "@/lib/seo";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

const getProductImage = (product: NonNullable<Awaited<ReturnType<typeof getPublicProduct>>>) => {
  const primaryMedia = product.media?.find((item) => item.is_primary && item.type !== "video");
  const firstMedia = product.media?.find((item) => item.type !== "video");
  return absoluteMediaUrl(
    primaryMedia?.url ||
      primaryMedia?.path ||
      primaryMedia?.thumbnail_url ||
      firstMedia?.url ||
      firstMedia?.path ||
      firstMedia?.thumbnail_url ||
      product.image ||
      product.thumbnail_url,
  );
};

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicProduct(slug);

  if (!product) notFound();

  const category = product.subcategory?.name || product.category?.name;
  const supplier = product.supplier?.name;
  const titleParts = [product.title, category, supplier].filter(Boolean);
  while (titleParts.length > 1 && titleParts.join(" | ").length > 58) titleParts.pop();

  return buildMetadata({
    title: truncateText(titleParts.join(" | "), 58).replace(/\.\.\.$/, ""),
    description: makeDescription(
      product.description,
      `Consulta ${product.title}${supplier ? ` en ${supplier}` : ""}. Revisa precio, disponibilidad, imágenes y opciones de compra en Drooopy.`,
    ),
    path: `/product/${product.slug || slug}`,
    image: getProductImage(product),
    imageAlt: `${product.title}${supplier ? `, vendido por ${supplier}` : ""}`,
    noIndex: product.is_active === false,
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getPublicProduct(slug);
  if (!product) notFound();
  const productSlug = product.slug || slug;
  const productUrl = absoluteSiteUrl(`/product/${productSlug}`);
  const image = getProductImage(product);
  const price = product.price != null ? Number(product.price) : null;
  const reviewCount = Array.isArray(product.ratings)
    ? product.ratings.filter((rating) => rating.is_approved === true).length
    : 0;
  const hasValidOffer = price != null && Number.isFinite(price) && price >= 0;
  const hasValidRating = Number(product.average_rating) > 0 && reviewCount > 0;

  const jsonLd = [
        ...(hasValidOffer || hasValidRating ? [
          {
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.title,
            description: makeDescription(product.description, `Producto disponible en ${SITE_NAME}.`),
            image: image ? [image] : undefined,
            sku: product.sku || undefined,
            category: product.subcategory?.name || product.category?.name || undefined,
            offers:
              hasValidOffer
                ? {
                    "@type": "Offer",
                    url: productUrl,
                    price,
                    priceCurrency: "MXN",
                    availability:
                      product.stock != null && Number.isFinite(Number(product.stock))
                        ? Number(product.stock) > 0
                          ? "https://schema.org/InStock"
                          : "https://schema.org/OutOfStock"
                        : undefined,
                    itemCondition: "https://schema.org/NewCondition",
                    seller: product.supplier?.name
                      ? {
                          "@type": "Organization",
                          name: product.supplier.name,
                          url: product.supplier.slug
                            ? absoluteSiteUrl(`/empresas/${product.supplier.slug}`)
                            : undefined,
                        }
                      : undefined,
                  }
                : undefined,
            aggregateRating:
              hasValidRating
                ? {
                    "@type": "AggregateRating",
                    ratingValue: Number(product.average_rating).toFixed(1),
                    reviewCount,
                  }
                : undefined,
          },
        ] : []),
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
              name: product.category?.name || "Productos",
              item: product.category?.slug
                ? absoluteSiteUrl(`/categorias/${product.category.slug}`)
                : absoluteSiteUrl("/"),
            },
            {
              "@type": "ListItem",
              position: 3,
              name: product.title,
              item: productUrl,
            },
          ],
        },
      ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <ProductDetailClient key={product.id} initialProduct={product} />
    </>
  );
}
