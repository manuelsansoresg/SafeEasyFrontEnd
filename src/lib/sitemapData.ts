import { unstable_cache } from "next/cache";
import { absoluteSiteUrl, getApiBaseUrl, type SeoCategory, type SeoProduct, type SeoSupplier } from "@/lib/seo";
import type { SupplierService } from "@/types/services";

export const SITEMAP_PAGE_SIZE = 10000;
const API_PAGE_SIZE = 1000;
const SERVICE_PAGE_SIZE = 100;

export type SitemapEntry = { url: string; lastModified?: string };
export type SitemapSnapshot = Record<"pages" | "categories" | "suppliers" | "products" | "services", SitemapEntry[]>;

const fixedPaths = [
  "/", "/nosotros", "/contacto", "/centro-de-ayuda", "/sell",
  "/directorio", "/menu", "/vender", "/agenda",
  "/politicas-de-privacidad", "/terminos-y-condiciones",
];

function validDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function pathSegment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = value.trim();
  return slug && slug !== "." && slug !== ".." && !/[/?#\\]/.test(slug)
    ? encodeURIComponent(slug) : null;
}

async function allPages<T>(resource: string, pageSize = API_PAGE_SIZE): Promise<T[]> {
  const items: T[] = [];
  for (let skip = 0; ; skip += pageSize) {
    const response = await fetch(`${getApiBaseUrl()}${resource}?skip=${skip}&limit=${pageSize}`, {
      headers: { Accept: "application/json", "User-Agent": "DrooopySEO/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Sitemap API ${resource} returned HTTP ${response.status}`);
    const page: unknown = await response.json();
    if (!Array.isArray(page) || page.length > pageSize) {
      throw new Error(`Sitemap API ${resource} returned an invalid page`);
    }
    items.push(...page as T[]);
    if (page.length < pageSize) return items;
  }
}

function unique(entries: SitemapEntry[]): SitemapEntry[] {
  return [...new Map(entries.map((entry) => [entry.url, entry])).values()];
}

export async function loadSitemapSnapshot(): Promise<SitemapSnapshot> {
  // Fail the whole refresh if any API page fails. ISR keeps the last valid XML.
  const [suppliers, products, categories, services] = await Promise.all([
    allPages<SeoSupplier>("/suppliers/"),
    allPages<SeoProduct>("/products/"),
    allPages<SeoCategory>("/categories/"),
    allPages<SupplierService>("/services/", SERVICE_PAGE_SIZE),
  ]);
  const publicSuppliers = new Set(suppliers.filter((item) => item.is_active === true).map((item) => item.id));
  const directorySuppliers = new Set(suppliers.filter((item) => item.is_active === true && item.is_directory === true).map((item) => item.id));
  return {
    pages: fixedPaths.map((path) => ({ url: absoluteSiteUrl(path) })),
    categories: unique(categories.flatMap((item) => {
      const slug = pathSegment(item.slug);
      return item.is_active === true && slug ? [{ url: absoluteSiteUrl(`/categorias/${slug}`), lastModified: validDate(item.updated_at) }] : [];
    })),
    suppliers: unique(suppliers.flatMap((item) => {
      const slug = pathSegment(item.slug);
      return publicSuppliers.has(item.id) && slug ? [{ url: absoluteSiteUrl(`/empresas/${slug}`), lastModified: validDate(item.updated_at) }] : [];
    })),
    products: unique(products.flatMap((item) => {
      const slug = pathSegment(item.slug);
      return item.is_active === true && slug && item.supplier?.id != null && publicSuppliers.has(item.supplier.id)
        ? [{ url: absoluteSiteUrl(`/product/${slug}`), lastModified: validDate(item.updated_at) }] : [];
    })),
    services: unique(services.flatMap((item) => {
      const id = pathSegment(item.id);
      return item.is_active === true && item.is_agenda_only !== true && id && directorySuppliers.has(Number(item.supplier_id))
        ? [{ url: absoluteSiteUrl(`/servicios/${id}`), lastModified: validDate(item.updated_at) }] : [];
    })),
  };
}

export const getSitemapSnapshot = unstable_cache(loadSitemapSnapshot, ["public-sitemap-v1"], { revalidate: 900 });

export function sitemapParts(snapshot: SitemapSnapshot) {
  return (Object.keys(snapshot) as Array<keyof SitemapSnapshot>).flatMap((kind) =>
    Array.from({ length: Math.ceil(snapshot[kind].length / SITEMAP_PAGE_SIZE) }, (_, page) => ({ kind, page })),
  );
}

const escapeXml = (value: string) => value.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
})[char] || char);

export function sitemapIndexXml(snapshot: SitemapSnapshot): string {
  const sites = sitemapParts(snapshot).map(({ kind, page }) =>
    `<sitemap><loc>${escapeXml(absoluteSiteUrl(`/sitemaps/${kind}-${page}.xml`).replace(/\/$/, ""))}</loc></sitemap>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sites.join("")}</sitemapindex>`;
}

export function sitemapUrlsetXml(entries: SitemapEntry[]): string {
  const urls = entries.map(({ url, lastModified }) =>
    `<url><loc>${escapeXml(url)}</loc>${lastModified ? `<lastmod>${escapeXml(lastModified)}</lastmod>` : ""}</url>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`;
}
