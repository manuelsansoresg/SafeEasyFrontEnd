"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock3,
  Loader2,
  ShoppingBag,
  Store,
  Truck,
} from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import {
  MENU_ORDER_STATUS_CLASSES,
  MENU_ORDER_STATUS_LABELS,
  formatMenuOrderDate,
  formatMenuOrderMoney,
  fulfillmentLabel,
} from "@/lib/menuOrders";
import { menuOrderService } from "@/services/menuOrderService";
import { useAuthHydrated, useAuthStore } from "@/store/useAuthStore";
import type { MenuOrder, MenuOrderStatus } from "@/types/menuOrder";

const filters: Array<{ value: "all" | MenuOrderStatus; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Recibidos" },
  { value: "confirmed", label: "Confirmados" },
  { value: "preparing", label: "En preparación" },
  { value: "ready", label: "Listos" },
  { value: "completed", label: "Completados" },
  { value: "cancelled", label: "Cancelados" },
];

export default function ClientMenuOrdersPage() {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const { isAuthenticated } = useAuthStore();
  const [orders, setOrders] = useState<MenuOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | MenuOrderStatus>("all");

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    menuOrderService
      .mine(null, controller.signal)
      .then(setOrders)
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "No se pudieron cargar tus pedidos.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [hydrated, isAuthenticated, router]);

  const visible = useMemo(
    () => filter === "all" ? orders : orders.filter((order) => order.status === filter),
    [filter, orders],
  );

  if (!hydrated || (loading && orders.length === 0)) {
    return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 size={34} className="animate-spin text-[#168e00]" /></div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
      <PageHero eyebrow="Mi cuenta" title="Pedidos de menú" subtitle="Consulta los pedidos que realizaste desde menús de negocios en Drooopy." />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => (
          <button key={item.value} type="button" onClick={() => setFilter(item.value)} className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold ${filter === item.value ? "bg-[#004e28] text-white" : "bg-white text-gray-600 shadow-sm"}`}>
            {item.label}{item.value === "all" ? ` (${orders.length})` : ` (${orders.filter((order) => order.status === item.value).length})`}
          </button>
        ))}
      </div>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : null}

      {visible.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#168e00]/10 text-[#168e00]"><ShoppingBag size={28} /></div>
          <h2 className="mt-4 text-xl font-black text-[#004e28]">No hay pedidos para mostrar</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">Tus pedidos realizados desde menús aparecerán en esta sección.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map((order) => (
            <Link key={order.id} href={`/pedidos/menu/${encodeURIComponent(order.order_number)}`} className="block rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="font-[family-name:var(--font-varela-round)] text-lg font-black text-[#004e28]">{order.order_number}</h2><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${MENU_ORDER_STATUS_CLASSES[order.status]}`}>{MENU_ORDER_STATUS_LABELS[order.status]}</span></div>
                  <p className="mt-1 font-semibold text-gray-900">{order.menu_name}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500"><Clock3 size={14} /> {formatMenuOrderDate(order.created_at)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4 md:justify-end">
                  <p className="flex items-center gap-2 text-sm font-semibold text-gray-600">{order.fulfillment_type === "delivery" ? <Truck size={16} /> : <Store size={16} />} {fulfillmentLabel(order.fulfillment_type)}</p>
                  <p className="text-xl font-black text-[#168e00]">{formatMenuOrderMoney(order.total)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
