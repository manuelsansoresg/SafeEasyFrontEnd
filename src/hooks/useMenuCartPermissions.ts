"use client";

import { useEffect, useState } from "react";
import { menuOrderService } from "@/services/menuOrderService";
import { readSupplierDirectoryStatusBySlug } from "@/lib/supplierDirectory";
import { menuCartKey, useMenuCartHydrated, useMenuCartStore } from "@/store/useMenuCartStore";

type Permission = "enabled" | "catalog" | "unavailable";

export function useMenuCartPermissions() {
  const hydrated = useMenuCartHydrated();
  const carts = useMenuCartStore((state) => state.carts);
  const [permissions, setPermissions] = useState<Record<string, Permission>>({});
  const identityKey = Object.values(carts).map((cart) => `${menuCartKey(cart.supplierId, cart.menuId)}:${cart.supplierSlug}`).sort().join("|");

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    let revision = 0;
    const refresh = async () => {
      const currentRevision = ++revision;
      const identities = Object.values(useMenuCartStore.getState().carts).map((cart) => ({
        key: menuCartKey(cart.supplierId, cart.menuId),
        slug: cart.supplierSlug,
        menuId: cart.menuId,
      }));
      setPermissions({});
      const result = await Promise.all(identities.map(async ({ key, slug, menuId }) => {
        try {
          const [settings, isDirectory] = await Promise.all([
            menuOrderService.publicSettings(slug, menuId),
            readSupplierDirectoryStatusBySlug(slug),
          ]);
          return [key, isDirectory === true ? "catalog" : isDirectory === null ? "unavailable" : settings.orders_enabled_by_plan && settings.accepts_orders
            ? "enabled" : settings.orders_enabled_by_plan ? "unavailable" : "catalog"] as const;
        } catch {
          return [key, "unavailable"] as const;
        }
      }));
      if (active && currentRevision === revision) setPermissions(Object.fromEntries(result));
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); };
  }, [hydrated, identityKey]);

  return permissions;
}
