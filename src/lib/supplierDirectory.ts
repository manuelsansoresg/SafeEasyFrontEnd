import { supplierHasDirectorySubscription } from "@/lib/subscriptionAccess";

export async function readSupplierDirectoryStatus(productSlug: string | null | undefined): Promise<boolean | null> {
  if (!productSlug) return null;
  try {
    const response = await fetch(`/api/products/${encodeURIComponent(productSlug)}`, { cache: "no-store" });
    if (!response.ok) return null;
    const product: unknown = await response.json();
    if (!product || typeof product !== "object") return null;
    return supplierHasDirectorySubscription((product as { supplier?: unknown }).supplier);
  } catch {
    return null;
  }
}

export async function readSupplierDirectoryStatusBySlug(supplierSlug: string): Promise<boolean | null> {
  try {
    const response = await fetch(`/api/suppliers/${encodeURIComponent(supplierSlug)}`, { cache: "no-store" });
    if (!response.ok) return null;
    const supplier: unknown = await response.json();
    return supplierHasDirectorySubscription(supplier);
  } catch {
    return null;
  }
}
