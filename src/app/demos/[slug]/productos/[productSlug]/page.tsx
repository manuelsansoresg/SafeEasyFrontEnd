import { notFound } from "next/navigation";
import ProductDetailClient, { type ProductDetail } from "@/components/product/ProductDetailClient";
import { getDemoProduct, getDemoSupplier } from "@/lib/demoProfile";

export const metadata = { robots: { index: false, follow: false } };

export default async function DemoProductPage({ params, searchParams }: {
  params: Promise<{ slug: string; productSlug: string }>;
  searchParams: Promise<{ desde?: string }>;
}) {
  const { slug, productSlug } = await params;
  const { desde } = await searchParams;
  const [supplier, product] = await Promise.all([getDemoSupplier(slug), getDemoProduct(slug, productSlug)]);
  if (!supplier || !product) notFound();

  const id = String(product.id ?? product.slug);
  const cover = product.image || product.thumbnail_url;
  const media = [
    ...(cover ? [{ type: "image" as const, url: cover }] : []),
    ...(product.media ?? []).filter((item) => item.url !== cover),
  ];
  const initialProduct: ProductDetail = {
    ...product,
    id,
    sku: product.sku ?? "",
    stock: product.stock ?? 0,
    is_active: true,
    supplier_id: supplier.id,
    supplier: { id: supplier.id, name: supplier.name, slug, logo: supplier.logo, first_name: "", last_name: "" },
    category_id: null,
    subcategory_id: null,
    average_rating: 0,
    ratings: [],
    media: media.map((item, index) => ({
      id: index,
      product_id: id,
      type: item.type === "video" ? "video" : "image",
      url: item.url,
      path: item.url,
      filename: product.title,
      thumbnail_url: null,
      is_primary: index === 0,
      position: index,
    })),
  };

  return (
    <ProductDetailClient
      key={id}
      initialProduct={initialProduct}
      demoCatalogHref={`/demos/${encodeURIComponent(slug)}/productos/${desde === "sell" ? "?desde=sell" : ""}`}
    />
  );
}
