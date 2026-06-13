import type { MetadataRoute } from "next";
import {
  absoluteSiteUrl,
  fetchSeoList,
  type SeoCategory,
  type SeoProduct,
  type SeoSupplier,
} from "@/lib/seo";

const staticRoutes: MetadataRoute.Sitemap = [
  {
    url: absoluteSiteUrl("/"),
    changeFrequency: "daily",
    priority: 1,
  },
  {
    url: absoluteSiteUrl("/nosotros"),
    changeFrequency: "monthly",
    priority: 0.7,
  },
  {
    url: absoluteSiteUrl("/contacto"),
    changeFrequency: "monthly",
    priority: 0.6,
  },
  {
    url: absoluteSiteUrl("/centro-de-ayuda"),
    changeFrequency: "weekly",
    priority: 0.6,
  },
  {
    url: absoluteSiteUrl("/sell"),
    changeFrequency: "weekly",
    priority: 0.7,
  },
  {
    url: absoluteSiteUrl("/politicas-de-privacidad"),
    changeFrequency: "yearly",
    priority: 0.3,
  },
  {
    url: absoluteSiteUrl("/terminos-y-condiciones"),
    changeFrequency: "yearly",
    priority: 0.3,
  },
];

const toDate = (value?: string | null) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, suppliers, categories] = await Promise.all([
    fetchSeoList<SeoProduct>("/products/?skip=0&limit=1000"),
    fetchSeoList<SeoSupplier>("/suppliers/?skip=0&limit=1000"),
    fetchSeoList<SeoCategory>("/categories/?skip=0&limit=1000"),
  ]);

  const productRoutes: MetadataRoute.Sitemap = products
    .filter((product) => product.slug || product.id)
    .map((product) => ({
      url: absoluteSiteUrl(`/product/${product.slug || product.id}`),
      lastModified: toDate(product.updated_at),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  const supplierRoutes: MetadataRoute.Sitemap = suppliers
    .filter((supplier) => supplier.slug)
    .map((supplier) => ({
      url: absoluteSiteUrl(`/empresas/${supplier.slug}`),
      lastModified: toDate(supplier.updated_at),
      changeFrequency: "weekly",
      priority: 0.75,
    }));

  const categoryRoutes: MetadataRoute.Sitemap = categories
    .filter((category) => category.slug)
    .map((category) => ({
      url: absoluteSiteUrl(`/categorias/${category.slug}`),
      lastModified: toDate(category.updated_at),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  return [...staticRoutes, ...categoryRoutes, ...supplierRoutes, ...productRoutes];
}
