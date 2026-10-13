import { cache } from "react";
import { getApiBaseUrl, listFromPayload, fetchSupplierProductsForSeo, fetchSupplierServicesForSeo, type SeoProduct, type SeoSupplier } from "@/lib/seo";
import { supplierHasActiveSubscription } from "@/lib/subscriptionAccess";
import type { SupplierService } from "@/types/services";

export type PublicSupplierProfile = {
  supplier: SeoSupplier;
  products: SeoProduct[];
  services: SupplierService[];
};

// The public detail endpoint is the source of truth for the profile. A missing
// subscription field is not evidence that a public supplier has expired.
const isPublic = (supplier: SeoSupplier) => {
  if (supplier.is_active === false || supplier.is_demo === true) return false;
  const record = supplier as unknown as Record<string, unknown>;
  const subscriptionKeys = [
    "has_active_subscription", "hasActiveSubscription", "subscription_active",
    "subscriptionActive", "subscription", "active_subscription",
    "supplier_subscription", "supplierSubscription",
  ];
  return !subscriptionKeys.some((key) => key in record) || supplierHasActiveSubscription(supplier);
};

const fetchSupplier = async (path: string): Promise<
  { status: "found"; data: unknown } | { status: "missing" | "forbidden" }
> => {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 404) return { status: "missing" };
  if (response.status === 403) return { status: "forbidden" };
  if (!response.ok) throw new Error(`Supplier API returned HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object") throw new Error("Supplier API returned an invalid response");
  return { status: "found", data };
};

export const getPublicSupplierProfile = cache(async (slug: string): Promise<PublicSupplierProfile | null> => {
  const encoded = encodeURIComponent(slug);
  // FastAPI detail routes omit the final slash. A legacy deployment may still
  // require it, so retry only when the first route is genuinely absent.
  const first = await fetchSupplier(`/suppliers/${encoded}`);
  if (first.status === "forbidden") return null;
  const direct = first.status === "missing"
    ? await fetchSupplier(`/suppliers/${encoded}/`)
    : first;
  if (direct.status === "forbidden") return null;
  let supplier: SeoSupplier | null = null;
  if (direct.status === "found") {
    const data = direct.data;
    if (!data || typeof data !== "object" || !("id" in data) || !("name" in data)) {
      throw new Error("Supplier API returned an incomplete profile");
    }
    supplier = data as SeoSupplier;
  }

  if (!supplier) {
    const result = await fetchSupplier(`/suppliers/?slug=${encoded}`);
    if (result.status === "forbidden") return null;
    supplier = listFromPayload<SeoSupplier>(result.status === "found" ? result.data : null).find((item) =>
      typeof item.slug === "string" && item.slug.toLowerCase() === slug.toLowerCase(),
    ) ?? null;
  }
  if (!supplier || !isPublic(supplier)) return null;
  if (typeof supplier.id !== "number" || typeof supplier.name !== "string") {
    throw new Error("Supplier API returned an incomplete profile");
  }

  const [services, products] = await Promise.all([
    fetchSupplierServicesForSeo(supplier.id),
    fetchSupplierProductsForSeo(supplier),
  ]);
  return { supplier, services, products };
});
