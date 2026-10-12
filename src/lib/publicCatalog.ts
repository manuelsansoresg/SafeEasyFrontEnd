import { cache } from "react";
import { getApiBaseUrl, type SeoCategory } from "@/lib/seo";
import type { ProductDetail } from "@/components/product/ProductDetailClient";
import type { Product } from "@/lib/products";
import type { SupplierService } from "@/types/services";

async function readPublicApi<T>(path: string): Promise<T | null> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Public catalog API returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

// The detail endpoints enforce active products, suppliers, subscriptions, and services.
export const getPublicProduct = cache(async (slug: string) => {
  const product = await readPublicApi<ProductDetail>(`/products/${encodeURIComponent(slug)}`);
  return product?.is_active === false ? null : product;
});

export const getPublicService = cache(async (id: string) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const service = await readPublicApi<SupplierService>(`/services/${encodeURIComponent(id)}`);
  return service?.is_active === false || service?.is_agenda_only === true ? null : service;
});

// FastAPI exposes categories through its paginated list, without a slug detail route.
export const getPublicCategory = cache(async (slug: string): Promise<SeoCategory | null> => {
  const pageSize = 1000;
  for (let skip = 0; ; skip += pageSize) {
    const categories = await readPublicApi<SeoCategory[]>(`/categories/?skip=${skip}&limit=${pageSize}`);
    if (!Array.isArray(categories)) throw new Error("Invalid public category response");
    const category = categories.find((item) => item.slug === slug);
    if (category) return category.is_active === true ? category : null;
    if (categories.length < pageSize) return null;
  }
});

export const getPublicCategoryProducts = cache(async (slug: string): Promise<Product[]> => {
  const products = await readPublicApi<Product[]>(
    `/products/?category=${encodeURIComponent(slug)}&skip=0&limit=20`,
  );
  if (!Array.isArray(products)) throw new Error("Invalid public product list response");
  return products.filter((product) => product.is_active !== false && Boolean(product.slug));
});
