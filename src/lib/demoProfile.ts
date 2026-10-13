import { cache } from "react";
import { getApiBaseUrl } from "@/lib/seo";
import type { Supplier } from "@/lib/products";

export type DemoSupplier = Partial<Supplier> & {
  id: number;
  slug: string;
  name: string;
  is_demo: true;
  logo: string | null;
  header_image: string | null;
  short_description: string | null;
  description: string | null;
  about: string | null;
  primary_color: string | null;
};

export type DemoProduct = {
  id?: number | string;
  slug: string;
  title: string;
  description: string;
  price: number;
  image: string | null;
  thumbnail_url: string | null;
};

export type DemoService = {
  id?: string;
  title: string;
  description: string;
  price: number;
  images: string[];
};

export type DemoMenu = {
  id: number;
  name: string;
  description: string | null;
  price: number | null;
  sections: Array<{
    name: string;
    description: string | null;
    items: Array<{ name: string; description: string | null; price: number | null; image_url: string | null }>;
  }>;
};

async function readDemo<T>(path: string): Promise<T | null> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Demo API returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export const getDemoSupplier = cache(async (slug: string): Promise<DemoSupplier | null> => {
  const data = await readDemo<DemoSupplier>(`/demos/${encodeURIComponent(slug)}`);
  if (!data || data.is_demo !== true || data.slug !== slug || typeof data.id !== "number" || typeof data.name !== "string") return null;
  return data;
});

export async function getDemoContent(slug: string) {
  const encoded = encodeURIComponent(slug);
  const [products, services, menuSummaries] = await Promise.all([
    readDemo<DemoProduct[]>(`/demos/${encoded}/products`),
    readDemo<DemoService[]>(`/demos/${encoded}/services`),
    readDemo<Array<Pick<DemoMenu, "id" | "name" | "description" | "price">>>(`/demos/${encoded}/menus`),
  ]);
  if (!Array.isArray(products) || !Array.isArray(services) || !Array.isArray(menuSummaries)) {
    throw new Error("Demo API returned incomplete content");
  }
  const menus = await Promise.all(menuSummaries.map(async (menu) => {
    const detail = await readDemo<DemoMenu>(`/demos/${encoded}/menus/${menu.id}`);
    if (!detail) throw new Error("Demo menu disappeared while loading");
    return detail;
  }));
  return { products, services, menus };
}
