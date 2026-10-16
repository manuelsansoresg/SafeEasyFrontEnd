"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
import { useAuthHydrated, useAuthStore } from "@/store/useAuthStore";
import { menuCartQuantity, useMenuCartHydrated, useMenuCartStore } from "@/store/useMenuCartStore";
import { menuCartKey } from "@/store/useMenuCartStore";
import { useMenuCartPermissions } from "@/hooks/useMenuCartPermissions";
import { readSupplierDirectoryStatus } from "@/lib/supplierDirectory";

type CartBadgeState = {
  count: number;
};

export function CartBadge() {
  const [state, setState] = useState<CartBadgeState>({ count: 0 });
  const requestId = useRef(0);
  const authHydrated = useAuthHydrated();
  const isAuthenticated = useAuthStore((value) => value.isAuthenticated);
  const menuHydrated = useMenuCartHydrated();
  const menuCarts = useMenuCartStore((value) => value.carts);
  const menuPermissions = useMenuCartPermissions();
  const menuCount = menuHydrated ? Object.values(menuCarts).reduce((sum, cart) => sum + (menuPermissions[menuCartKey(cart.supplierId, cart.menuId)] === "enabled" ? menuCartQuantity(cart) : 0), 0) : 0;

  const refresh = async () => {
    const currentRequest = ++requestId.current;
    setState({ count: 0 });
    try {
      const tryUrls = ["/api/cart/", "/api/cart", "/api/v1/cart/", "/api/v1/cart"];
      let res: Response | null = null;
      for (const url of tryUrls) {
        res = await fetchWithAuth(url);
        if (res.ok) break;
        if (res.status === 404 || res.status === 405) continue;
        if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) continue;
        break;
      }
      if (!res || !res.ok) {
        if (currentRequest === requestId.current) setState({ count: 0 });
        return;
      }

      const data: unknown = await res.json().catch(() => null);
      const record = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
      const list = Array.isArray(data)
        ? data
        : Array.isArray(record?.items)
          ? (record?.items as unknown[])
          : Array.isArray(record?.results)
            ? (record?.results as unknown[])
            : Array.isArray(record?.data)
              ? (record?.data as unknown[])
              : null;

      const carts = Array.isArray(list) ? list : [];

      const orderable = await Promise.all(carts.map(async (cart) => {
        const c = cart && typeof cart === "object" ? (cart as Record<string, unknown>) : {};
        const items =
          (Array.isArray(c.items) ? c.items : null) ||
          (Array.isArray(c.cart_items) ? c.cart_items : null) ||
          (Array.isArray(c.lines) ? c.lines : null) ||
          null;
        if (!items) return 0;
        const firstItem = items[0] && typeof items[0] === "object" ? items[0] as Record<string, unknown> : {};
        const product = firstItem.product && typeof firstItem.product === "object" ? firstItem.product as Record<string, unknown> : {};
        const slug = typeof product.slug === "string" ? product.slug : null;
        if (await readSupplierDirectoryStatus(slug) !== false) return 0;
        return items.reduce((s, it) => {
          const line = it && typeof it === "object" ? it as Record<string, unknown> : {};
          return s + (Number(line.quantity ?? 0) || 0);
        }, 0);
      }));
      const count = orderable.reduce((sum, value) => sum + value, 0);

      if (currentRequest === requestId.current) setState({ count });
    } catch {
      if (currentRequest === requestId.current) setState({ count: 0 });
    }
  };

  useEffect(() => {
    if (!authHydrated || !isAuthenticated) return;
    refresh();
    const id = window.setInterval(refresh, 30000);
    const onEvent = () => refresh();
    window.addEventListener("cart:changed", onEvent as EventListener);
    window.addEventListener("focus", onEvent);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("cart:changed", onEvent as EventListener);
      window.removeEventListener("focus", onEvent);
    };
  }, [authHydrated, isAuthenticated]);

  const count = (isAuthenticated ? state.count : 0) + menuCount;

  return (
    <Link
      href="/cart"
      aria-label="Carrito"
      className="relative flex items-center justify-center h-10 px-2 text-white hover:text-[#7ed957] transition-all"
    >
      <ShoppingCart size={20} />
      {count > 0 ? (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#168E00] text-white text-[10px] font-bold flex items-center justify-center">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
