import type { Metadata } from "next";
import ProductDetailClient from "@/components/product/ProductDetailClient";
import { JsonLd } from "@/components/JsonLd";
import {
  absoluteMediaUrl,
  absoluteSiteUrl,
  buildMetadata,
  fetchProductForSeo,
  makeDescription,
  SITE_NAME,
} from "@/lib/seo";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

const getProductImage = (product: Awaited<ReturnType<typeof fetchProductForSeo>>) => {
  if (!product) return null;
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
  const product = await fetchProductForSeo(slug);

  if (!product) {
    return buildMetadata({
      title: "Producto",
      description: "Consulta productos disponibles en Drooopy.",
      path: `/product/${slug}`,
    });
  }

  const category = product.category?.name ? ` de ${product.category.name}` : "";
  const supplier = product.supplier?.name ? ` por ${product.supplier.name}` : "";

  return buildMetadata({
    title: `${product.title}${category}`,
    description: makeDescription(
      product.description,
      `Encuentra ${product.title}${supplier} en Drooopy. Revisa detalles, disponibilidad y opciones de compra.`,
    ),
    path: `/product/${product.slug || slug}`,
    image: getProductImage(product),
  });
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await fetchProductForSeo(slug);
  const productSlug = product?.slug || slug;
  const productUrl = absoluteSiteUrl(`/product/${productSlug}`);
  const image = getProductImage(product);
  const price = product?.price != null ? Number(product.price) : null;
  const reviewCount = Array.isArray(product?.ratings)
    ? product.ratings.length
    : Number(product?.average_rating) > 0
      ? 1
      : 0;

  const jsonLd = product
    ? [
        {
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.title,
          description: makeDescription(product.description, `Producto disponible en ${SITE_NAME}.`),
          image: image ? [image] : undefined,
          sku: String(product.id),
          category: product.subcategory?.name || product.category?.name || undefined,
          brand: product.supplier?.name
            ? {
                "@type": "Brand",
                name: product.supplier.name,
              }
            : {
                "@type": "Brand",
                name: SITE_NAME,
              },
          offers:
            price != null && Number.isFinite(price)
              ? {
                  "@type": "Offer",
                  url: productUrl,
                  price,
                  priceCurrency: "MXN",
                  availability:
                    Number(product.stock ?? 0) > 0
                      ? "https://schema.org/InStock"
                      : "https://schema.org/OutOfStock",
                }
              : undefined,
          aggregateRating:
            Number(product.average_rating) > 0 && reviewCount > 0
              ? {
                  "@type": "AggregateRating",
                  ratingValue: Number(product.average_rating).toFixed(1),
                  reviewCount,
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
      ]
    : null;

  return (
    <>
      {jsonLd ? <JsonLd data={jsonLd} /> : null}
      <ProductDetailClient />
    </>
  );
}
