"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Clock3,
  CreditCard,
  Loader2,
  PackageCheck,
  Search,
  Store,
  Truck,
} from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { menuProviderPaymentStatusLabel } from "@/lib/menuOrderFlow";
import { useSupplierModules } from "@/hooks/useSupplierModules";
import { ModuleAccessError } from "@/components/admin/ModuleAccessError";
import {
  MENU_ORDER_STATUS_CLASSES,
  MENU_ORDER_STATUS_LABELS,
  formatMenuOrderDate,
  formatMenuOrderMoney,
  fulfillmentLabel,
} from "@/lib/menuOrders";
import { menuOrderService } from "@/services/menuOrderService";
import { useChatInboxWebSocket } from "@/hooks/useChatWebSocket";
import { useInboxReconnect } from "@/hooks/useInboxReconnect";
import { useChatStore } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";
import { isMenuInboxEvent } from "@/types/chat";
import type {
  MenuOrder,
  MenuOrderPaymentStatus,
  MenuOrderStatus,
} from "@/types/menuOrder";

const filters: Array<{ value: "all" | MenuOrderStatus; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Recibidos" },
  { value: "confirmed", label: "Confirmados" },
  { value: "preparing", label: "En preparación" },
  { value: "ready", label: "Listos" },
  { value: "completed", label: "Completados" },
  { value: "cancelled", label: "Cancelados" },
  { value: "no_show", label: "No recogidos" },
];

function paymentStatusLabel(order: MenuOrder) {
  if (order.payment_status === "refunded") return "Reembolsado";
  if (order.payment_method === "online") return menuProviderPaymentStatusLabel(order);
  if (order.payment_status === "paid") return "Pagado";
  if (order.payment_status === "authorized") return "Pago autorizado";
  if (order.payment_status === "failed") return "Fallido";
  if (order.payment_status === "cancelled") return "Cancelado";
  return "Pendiente";
}

function paymentStatusClass(status: MenuOrderPaymentStatus) {
  if (status === "refunded") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "authorized") return "border-sky-200 bg-sky-50 text-sky-800";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

export default function AdminMenuOrdersPage() {
  const router = useRouter();
  const { loading: accessLoading, error: accessError, hasModule, retry } = useSupplierModules();
  const hasAccess = hasModule("menu");
  const token = useAuthStore((state) => state.token);
  const subscribeToInboxEvents = useChatStore((state) => state.subscribeToInboxEvents);
  const { status: inboxStatus } = useChatInboxWebSocket(Boolean(token) && hasAccess);
  const [orders, setOrders] = useState<MenuOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | MenuOrderStatus>("all");
  const [search, setSearch] = useState("");
  const [linkedOrderNumber, setLinkedOrderNumber] = useState<string | null>(null);

  useEffect(() => {
    setLinkedOrderNumber(new URLSearchParams(window.location.search).get("order_number"));
  }, []);

  useEffect(() => {
    if (!linkedOrderNumber || loading || accessLoading || !hasAccess) return;
    const order = orders.find((item) => item.order_number === linkedOrderNumber);
    if (order) router.replace(`/admin/menu/pedidos/${order.id}`);
    else setError("Este pedido ya no está disponible o no tienes acceso a él.");
    setLinkedOrderNumber(null);
  }, [accessLoading, hasAccess, linkedOrderNumber, loading, orders, router]);

  const loadOrders = useCallback(async (signal?: AbortSignal, silent = false) => {
    if (!hasAccess) {
      if (!silent) setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const data = await menuOrderService.providerOrders(null, signal);
      if (!signal?.aborted) setOrders(data);
    } catch (err) {
      if (!silent && !signal?.aborted) setError(err instanceof Error ? err.message : "No se pudieron cargar los pedidos.");
    } finally {
      if (!silent && !signal?.aborted) setLoading(false);
    }
  }, [hasAccess]);

  useEffect(() => {
    if (accessLoading) return;
    const controller = new AbortController();
    void loadOrders(controller.signal);
    return () => controller.abort();
  }, [accessLoading, loadOrders]);

  const resyncAfterReconnect = useCallback(() => {
    void loadOrders(undefined, true);
  }, [loadOrders]);
  useInboxReconnect(inboxStatus, Boolean(token) && hasAccess, resyncAfterReconnect);

  useEffect(() => {
    if (!token || !hasAccess || accessLoading) return;
    const controller = new AbortController();
    const unsubscribe = subscribeToInboxEvents((event) => {
      if (!isMenuInboxEvent(event)) return;
      void menuOrderService.providerOrder(event.order_id, controller.signal)
        .then((updated) => {
          if (controller.signal.aborted) return;
          setOrders((current) => {
            const index = current.findIndex((item) => item.id === updated.id);
            if (index === -1) return [updated, ...current];
            return current.map((item) => item.id === updated.id ? updated : item);
          });
        })
        .catch(() => { /* La reconexión resincroniza los pedidos. */ });
    });
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [accessLoading, hasAccess, subscribeToInboxEvents, token]);

  const counts = useMemo(() => {
    const result: Record<MenuOrderStatus, number> = {
      pending: 0,
      confirmed: 0,
      preparing: 0,
      ready: 0,
      completed: 0,
      cancelled: 0,
      no_show: 0,
    };

    orders.forEach((order) => {
      result[order.status] += 1;
    });

    return result;
  }, [orders]);

  const paidOnlineCount = useMemo(
    () => orders.filter((order) => order.payment_method === "online" && order.payment_status === "paid").length,
    [orders],
  );

  const cashCount = useMemo(
    () => orders.filter((order) => order.payment_method === "cash").length,
    [orders],
  );

  const visibleOrders = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return orders.filter((order) => {
      if (statusFilter !== "all" && order.status !== statusFilter) return false;
      if (!needle) return true;

      return [
        order.order_number,
        order.customer_name,
        order.customer_email,
        order.customer_phone,
        order.menu_name,
        order.payment_method,
        order.payment_status,
      ].some((value) => String(value || "").toLowerCase().includes(needle));
    });
  }, [orders, search, statusFilter]);

  if (accessLoading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Loader2 size={34} className="animate-spin text-[#168e00]" />
      </div>
    );
  }

  if (accessError) return <ModuleAccessError onRetry={() => void retry()} />;

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <PageHero title="Pedidos de menú" subtitle="Administra los pedidos recibidos desde tus menús." eyebrow="Módulo Menú" />
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          El módulo Menú no está activo en tu cuenta.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHero
        eyebrow="Módulo Menú"
        title="Pedidos recibidos"
        subtitle="Consulta clientes, productos, forma de entrega, pago y avance de cada pedido."
        actions={
          <button
            type="button"
            onClick={() => void loadOrders()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Actualizar
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Pedidos totales</p>
          <p className="mt-1 text-3xl font-black text-gray-900">{orders.length}</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Por confirmar</p>
          <p className="mt-1 text-3xl font-black text-amber-600">{counts.pending}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Pagados en línea</p>
          <p className="mt-1 text-3xl font-black text-emerald-600">{paidOnlineCount}</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Pago en efectivo</p>
          <p className="mt-1 text-3xl font-black text-blue-600">{cashCount}</p>
        </div>
      </div>

      <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map((filter) => {
              const selected = filter.value === statusFilter;
              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold transition ${selected ? "bg-[#004e28] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {filter.label}
                  {filter.value !== "all" ? ` (${counts[filter.value]})` : ` (${orders.length})`}
                </button>
              );
            })}
          </div>

          <label className="relative block w-full lg:max-w-sm">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Folio, cliente, pago..."
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10"
            />
          </label>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : null}

      {loading ? (
        <div className="flex min-h-72 items-center justify-center rounded-3xl border border-gray-100 bg-white">
          <Loader2 size={30} className="animate-spin text-[#168e00]" />
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#168e00]/10 text-[#168e00]"><PackageCheck size={28} /></div>
          <h2 className="mt-4 text-xl font-bold text-gray-900">No hay pedidos para mostrar</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500">Cuando un cliente realice un pedido desde un menú habilitado aparecerá aquí.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleOrders.map((order) => (
            <Link
              key={order.id}
              href={`/admin/menu/pedidos/${order.id}`}
              className="block rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#168e00]/20 hover:shadow-md"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-[family-name:var(--font-varela-round)] text-lg font-black text-[#004e28]">{order.order_number}</h2>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${MENU_ORDER_STATUS_CLASSES[order.status]}`}>
                      {MENU_ORDER_STATUS_LABELS[order.status]}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${paymentStatusClass(order.payment_status)}`}>
                      {paymentStatusLabel(order)}
                    </span>
                  </div>
                  <p className="mt-1 font-semibold text-gray-900">{order.customer_name}</p>
                  <p className="mt-1 text-sm text-gray-500">{order.menu_name} · {order.items.reduce((sum, item) => sum + item.quantity, 0)} productos</p>
                </div>

                <div className="grid gap-3 text-sm sm:grid-cols-4 xl:min-w-[680px]">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Modalidad</p>
                    <p className="mt-1 flex items-center gap-1.5 font-semibold text-gray-700">
                      {order.fulfillment_type === "delivery" ? <Truck size={15} /> : <Store size={15} />}
                      {fulfillmentLabel(order.fulfillment_type)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Pago</p>
                    <p className="mt-1 flex items-center gap-1.5 font-semibold text-gray-700">
                      {order.payment_method === "online" ? <CreditCard size={15} /> : <Banknote size={15} />}
                      {order.payment_method === "online" ? "Mercado Pago" : "Efectivo"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Recibido</p>
                    <p className="mt-1 flex items-center gap-1.5 font-semibold text-gray-700"><Clock3 size={15} /> {formatMenuOrderDate(order.created_at)}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Total</p>
                    <p className="mt-1 text-lg font-black text-[#168e00]">{formatMenuOrderMoney(order.total)}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
