import { cache } from "react";
import { getApiBaseUrl, listFromPayload, fetchSupplierProductsForSeo, fetchSupplierServicesForSeo, type SeoProduct, type SeoSupplier } from "@/lib/seo";
import { planAllowsProducts, supplierAllowsProducts, supplierHasActiveSubscription, supplierHasDirectorySubscription } from "@/lib/subscriptionAccess";
import type { SupplierService } from "@/types/services";

export type PublicSupplierProfile = {
  supplier: SeoSupplier;
  products: SeoProduct[];
  canShowProducts: boolean;
  publicAgendaAvailable: boolean | null;
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

async function getPublicProductAccess(supplier: SeoSupplier) {
  if (supplierHasDirectorySubscription(supplier)) return false;
  const details = supplier as unknown as Record<string, unknown>;
  if (details.max_images_per_product != null) return planAllowsProducts(details);
  if (supplierAllowsProducts(supplier)) return true;

  const planId = details.current_plan_id;
  if (typeof planId === "number" && Number.isSafeInteger(planId) && planId > 0) {
    try {
      const result = await fetchSupplier(`/plans/${planId}`);
      if (result.status === "found") {
        const plan = result.data as Record<string, unknown>;
        if (plan.max_images_per_product != null) return planAllowsProducts(plan);
      }
    } catch {
      // Older deployments may omit the plan limits from the public profile.
    }
  }

  return false;
}

async function getPublicAgendaAvailability(supplierId: number): Promise<boolean | null> {
  try {
    // This endpoint checks the published Agenda without loading its payment configuration.
    const result = await fetchSupplier(`/public/agenda/${supplierId}/services`);
    return result.status === "found" ? Array.isArray(result.data) || null : false;
  } catch {
    return null;
  }
}

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

  const [services, products, publicAgendaAvailable] = await Promise.all([
    fetchSupplierServicesForSeo(supplier.id),
    fetchSupplierProductsForSeo(supplier),
    typeof supplier.agenda_enabled === "boolean"
      ? Promise.resolve(supplier.agenda_enabled)
      : getPublicAgendaAvailability(supplier.id),
  ]);
  const canShowProducts = await getPublicProductAccess(supplier);
  return { supplier, services, products, canShowProducts, publicAgendaAvailable };
});
