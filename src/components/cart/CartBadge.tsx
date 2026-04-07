"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";

type CartBadgeState = {
  count: number;
};

export function CartBadge() {
  const [state, setState] = useState<CartBadgeState>({ count: 0 });
  const inflight = useRef(false);

  const refresh = async () => {
    if (inflight.current) return;
    inflight.current = true;
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
        setState({ count: 0 });
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

      const count = carts.reduce((sum, cart) => {
        const c = cart && typeof cart === "object" ? (cart as Record<string, unknown>) : {};
        const items =
          (Array.isArray(c.items) ? c.items : null) ||
          (Array.isArray(c.cart_items) ? c.cart_items : null) ||
          (Array.isArray(c.lines) ? c.lines : null) ||
          null;
        if (!items) return sum;
        return sum + items.reduce((s, it) => s + (Number((it as any)?.quantity ?? 0) || 0), 0);
      }, 0);

      setState({ count });
    } catch {
      setState({ count: 0 });
    } finally {
      inflight.current = false;
    }
  };

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 30000);
    const onEvent = () => refresh();
    window.addEventListener("cart:changed", onEvent as EventListener);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("cart:changed", onEvent as EventListener);
    };
  }, []);

  return (
    <Link
      href="/cart"
      aria-label="Carrito"
      className="relative flex items-center justify-center h-10 px-2 text-white hover:text-[#7ed957] transition-all"
    >
      <ShoppingCart size={20} />
      {state.count > 0 ? (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#168E00] text-white text-[10px] font-bold flex items-center justify-center">
          {state.count > 99 ? "99+" : state.count}
        </span>
      ) : null}
    </Link>
  );
}

