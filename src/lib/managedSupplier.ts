import { fetchWithAuth } from "@/lib/api";
import type { CurrentSupplier } from "@/lib/currentSupplier";

/** Explicit target for admin tools. Never falls back to the logged-in account. */
export async function loadManagedSupplier(id: number): Promise<CurrentSupplier> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("El identificador del proveedor es inválido.");
  const list = await fetchWithAuth(`/api/suppliers/?id=${id}&skip=0&limit=1`, { cache: "no-store" });
  if (list.status === 401 || list.status === 403) throw new Error("No tienes permiso para gestionar este proveedor.");
  if (list.ok) {
    const payload: unknown = await list.json();
    const record = payload && typeof payload === "object" ? payload as Record<string, unknown> : null;
    const items = Array.isArray(payload) ? payload : record?.items;
    const found = Array.isArray(items) ? items.find((item) => Number(item?.id) === id) : null;
    if (found) return found as CurrentSupplier;
  }
  const response = await fetchWithAuth(`/api/suppliers/${id}`, { cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 403 ? "No tienes permiso para gestionar este proveedor." : "No se pudo cargar el proveedor seleccionado.");
  const supplier = await response.json() as CurrentSupplier;
  if (Number(supplier.id) !== id) throw new Error("El servidor devolvió un proveedor diferente al seleccionado.");
  return supplier;
}
