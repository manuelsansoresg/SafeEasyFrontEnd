import type { Metadata } from "next";
import type { SupplierService } from "@/types/services";

const DEFAULT_SITE_URL = "https://drooopy.com";
const DEFAULT_API_BASE_URL = "https://drooopy.com/api";

export const SITE_NAME = "Drooopy";
export const SITE_DESCRIPTION =
  "Encuentra tiendas en línea, productos, negocios y servicios en México. Compra, compara y conecta con empresas cerca de ti en Drooopy.";

export type SeoListPayload<T> =
  | T[]
  | {
      items?: T[];
      results?: T[];
      data?: T[];
      products?: T[];
      suppliers?: T[];
      categories?: T[];
      services?: T[];
    };

export interface SeoCategory {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  thumbnail_url?: string | null;
  updated_at?: string | null;
  is_active?: boolean;
}

export interface SeoSupplier {
  id: number;
  name: string;
  slug?: string | null;
  short_name?: string | null;
  short_description?: string | null;
  description?: string | null;
  about?: string | null;
  title_about?: string | null;
  subtitle_about?: string | null;
  intro_title?: string | null;
  intro_description?: string | null;
  intro_image_url?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  logo?: string | null;
  logo_url?: string | null;
  image?: string | null;
  image_url?: string | null;
  about_media?: string | null;
  about_media_thumbnail?: string | null;
  address?: string | null;
  exterior_number?: string | null;
  interior_number?: string | null;
  neighborhood?: string | null;
  cp?: string | null;
  map_location?: string | null;
  facebook_url?: string | null;
  instagram_url?: string | null;
  x_url?: string | null;
  business_category?: string | null;
  business_type?: string | null;
  specialty?: string | null;
  specialties?: string[] | null;
  tags?: string[] | null;
  carousel_images?: Array<{
    image?: string | null;
    thumbnail?: string | null;
    image_movil?: string | null;
    thumbnail_movil?: string | null;
  }>;
  business_hours?: Array<{
    day_of_week: number;
    open_time?: string | null;
    close_time?: string | null;
    is_closed?: boolean;
  }>;
  is_active?: boolean;
  is_directory?: boolean;
  is_verified?: boolean;
  average_rating?: number | null;
  rating_count?: number | null;
  updated_at?: string | null;
}

export interface SeoProduct {
  id: string | number;
  title: string;
  slug?: string | null;
  description?: string | null;
  price?: number | string | null;
  stock?: number | null;
  sku?: string | null;
  is_active?: boolean;
  image?: string | null;
  thumbnail_url?: string | null;
  average_rating?: number | null;
  ratings?: unknown[];
  updated_at?: string | null;
  category?: {
    name?: string | null;
    slug?: string | null;
  } | null;
  subcategory?: {
    name?: string | null;
    slug?: string | null;
  } | null;
  supplier?: {
    id?: number | null;
    name?: string | null;
    slug?: string | null;
    is_active?: boolean;
  } | null;
  media?: Array<{
    url?: string | null;
    path?: string | null;
    thumbnail_url?: string | null;
    is_primary?: boolean;
    type?: string | null;
  }>;
}

export const getSiteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");

export const getApiBaseUrl = () => {
  const raw =
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    DEFAULT_API_BASE_URL;
  const clean = raw.trim().replace(/\/+$/, "");
  return clean.endsWith("/api") ? clean : `${clean}/api`;
};

export const absoluteSiteUrl = (path = "/") => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const withSlash = normalizedPath.endsWith("/") ? normalizedPath : `${normalizedPath}/`;
  return `${getSiteUrl()}${withSlash}`;
};

export const DEFAULT_OG_IMAGE = `${getSiteUrl()}/og/drooopy-tiendas-negocios-servicios.jpg`;
export const DEFAULT_OG_IMAGE_ALT =
  "Drooopy, tiendas, negocios y servicios en México";

export const absoluteMediaUrl = (path?: string | null) => {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${getApiBaseUrl()}${cleanPath}`.replace(/([^:])\/{2,}/g, "$1/");
};

export const stripHtml = (value?: string | null) =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

export const truncateText = (value: string, maxLength = 155) => {
  if (value.length <= maxLength) return value;
  const clipped = value.slice(0, maxLength - 1).trim();
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 80 ? clipped.slice(0, lastSpace) : clipped).trim()}...`;
};

export const makeDescription = (primary?: string | null, fallback = SITE_DESCRIPTION) =>
  truncateText(stripHtml(primary) || fallback);

export const listFromPayload = <T>(payload: SeoListPayload<T> | unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.items,
    record.results,
    record.data,
    record.products,
    record.suppliers,
    record.categories,
    record.services,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as T[];
  }

  return [];
};

const fetchJson = async <T>(path: string): Promise<T | null> => {
  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "DrooopySEO/1.0",
      },
      next: { revalidate: 900 },
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

export const fetchProductForSeo = async (slug: string) => {
  const encoded = encodeURIComponent(slug);
  const direct = await fetchJson<SeoProduct>(`/products/${encoded}`);
  if (direct?.title) return direct;

  const searchPayload = await fetchJson<SeoListPayload<SeoProduct>>(
    `/products/?search=${encoded}&limit=5`,
  );
  const found = listFromPayload<SeoProduct>(searchPayload).find(
    (product) => product.slug === slug || String(product.id) === slug,
  );

  return found || null;
};

export const fetchSupplierForSeo = async (slug: string) => {
  const encoded = encodeURIComponent(slug);
  const direct =
    (await fetchJson<SeoSupplier>(`/suppliers/${encoded}/`)) ||
    (await fetchJson<SeoSupplier>(`/suppliers/${encoded}`));
  if (direct?.name) return direct;

  const listPayload = await fetchJson<SeoListPayload<SeoSupplier>>(
    `/suppliers/?slug=${encoded}`,
  );
  const found = listFromPayload<SeoSupplier>(listPayload).find(
    (supplier) =>
      typeof supplier.slug === "string" &&
      supplier.slug.toLowerCase() === slug.toLowerCase(),
  );

  return found || null;
};

export const fetchSupplierServicesForSeo = async (supplierId: number) => {
  const payload = await fetchJson<SeoListPayload<SupplierService>>(
    `/services/?supplier_id=${encodeURIComponent(String(supplierId))}&skip=0&limit=20`,
  );
  return listFromPayload<SupplierService>(payload)
    .filter(
      (service) =>
        service.is_active === true && Number(service.supplier_id) === supplierId,
    )
    .slice(0, 10);
};

export const fetchSupplierProductsForSeo = async (
  supplier: Pick<SeoSupplier, "id" | "slug">,
) => {
  const identifier = supplier.slug || String(supplier.id);
  const direct = await fetchJson<SeoListPayload<SeoProduct>>(
    `/products/by-supplier/${encodeURIComponent(identifier)}?skip=0&limit=12`,
  );
  const directProducts = listFromPayload<SeoProduct>(direct);
  const products = directProducts.length
    ? directProducts
    : listFromPayload<SeoProduct>(
        await fetchJson<SeoListPayload<SeoProduct>>(
          `/products/?supplier_id=${encodeURIComponent(String(supplier.id))}&skip=0&limit=12`,
        ),
      );

  return products.filter((product) => product.is_active !== false).slice(0, 10);
};

export const fetchCategoryForSeo = async (slug: string) => {
  const encoded = encodeURIComponent(slug);
  const direct =
    (await fetchJson<SeoCategory>(`/categories/${encoded}/`)) ||
    (await fetchJson<SeoCategory>(`/categories/${encoded}`));
  if (direct?.name) return direct;

  const listPayload = await fetchJson<SeoListPayload<SeoCategory>>(
    `/categories/?skip=0&limit=1000`,
  );
  const found = listFromPayload<SeoCategory>(listPayload).find(
    (category) =>
      typeof category.slug === "string" &&
      category.slug.toLowerCase() === slug.toLowerCase(),
  );

  return found || null;
};

export const fetchSeoList = async <T>(path: string) => {
  const payload = await fetchJson<SeoListPayload<T>>(path);
  return listFromPayload<T>(payload);
};

export const buildMetadata = ({
  title,
  description,
  path,
  image,
  imageAlt,
  type = "website",
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  imageAlt?: string;
  type?: "website" | "article";
  noIndex?: boolean;
}): Metadata => {
  const url = absoluteSiteUrl(path);
  const resolvedImage = image || DEFAULT_OG_IMAGE;
  const images = [
    {
      url: resolvedImage,
      width: 1200,
      height: 630,
      alt: imageAlt || DEFAULT_OG_IMAGE_ALT,
    },
  ];

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "es_MX",
      type,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [resolvedImage],
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
          },
        },
  };
};
