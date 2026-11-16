"use client";

import { useQuery } from "@tanstack/react-query";
import { catalogLabels } from "@/lib/catalogLabels";
import { isSupplierRole, resolveCurrentSupplier } from "@/lib/currentSupplier";
import { useAuthStore } from "@/store/useAuthStore";

export const supplierCatalogTypeQueryKey = ["supplier-catalog-type"] as const;

export function useSupplierCatalogLabels() {
  const { user, token } = useAuthStore();
  const { data } = useQuery({
    queryKey: [...supplierCatalogTypeQueryKey, user?.id],
    queryFn: async ({ signal }) => {
      const supplier = await resolveCurrentSupplier(user, { signal });
      return supplier?.business_type ?? null;
    },
    enabled: Boolean(token && user?.id && isSupplierRole(user.role)),
    staleTime: 30_000,
  });

  return catalogLabels(data);
}
