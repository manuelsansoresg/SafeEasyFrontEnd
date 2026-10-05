"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  RefreshCw,
  Store,
  Truck,
  XCircle,
} from "lucide-react";
import {
  MENU_ORDER_STATUS_CLASSES,
  MENU_ORDER_STATUS_FLOW,
  MENU_ORDER_STATUS_LABELS,
  formatMenuOrderDate,
  formatMenuOrderMoney,
  fulfillmentLabel,
} from "@/lib/menuOrders";
import { getSafeMercadoPagoUrl } from "@/lib/security";
import { menuOrderAwaitingHandoff } from "@/lib/menuOrderFlow";
import { menuOrderService } from "@/services/menuOrderService";
import { notificationService } from "@/services/notificationService";
import { useAuthHydrated, useAuthStore } from "@/store/useAuthStore";
import { useChatInboxWebSocket } from "@/hooks/useChatWebSocket";
import { useInboxReconnect } from "@/hooks/useInboxReconnect";
import { useChatStore } from "@/store/useChatStore";
import { isMenuInboxEvent } from "@/types/chat";
import { ClientShell } from "@/components/client/ClientShell";
import type { MenuOrder } from "@/types/menuOrder";

const TERMINAL_STATUSES = new Set(["completed", "cancelled"]);

function paymentMethodLabel(order: MenuOrder) {
  return order.payment_method === "online"
    ? "Tarjeta / Mercado Pago"
    : "Efectivo";
}

function paymentStatusLabel(order: MenuOrder) {
  if (order.payment_method === "cash") {
    return order.status === "completed" ? "Cobro en efectivo" : "Pago al recibir / recoger";
  }
  if (order.payment_status === "paid" && order.settlement_status === "on_hold") return "Pago recibido";
  if (order.payment_status === "paid" && order.settlement_status === "released" && order.status === "completed") return "Pago confirmado";
  if (order.payment_status === "paid") return "Pago recibido";
  if (order.payment_status === "authorized") return "Pago autorizado";
  if (order.payment_status === "failed") return "Pago no aprobado";
  if (order.payment_status === "cancelled") return "Pago cancelado";
  return "Esperando confirmación";
}

function TrackingFrame({ children, authenticated }: { children: React.ReactNode; authenticated: boolean }) {
  return authenticated ? <ClientShell>{children}</ClientShell> : <>{children}</>;
}

export default function PublicMenuOrderTrackingPage() {
  const params = useParams<{ orderNumber: string }>();
  const searchParams = useSearchParams();
  const hydrated = useAuthHydrated();
  const { isAuthenticated, user } = useAuthStore();
  const showClientShell = hydrated && isAuthenticated;
  const subscribeToInboxEvents = useChatStore((state) => state.subscribeToInboxEvents);

  const orderNumber = String(params?.orderNumber || "").trim();
  const queryToken = String(searchParams.get("management_token") || "").trim();
  const [storedToken, setStoredToken] = useState("");
  const [order, setOrder] = useState<MenuOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeNotice, setCodeNotice] = useState<string | null>(null);
  const ownsOrder = hydrated && isAuthenticated && user?.id != null && order !== null &&
    order.customer_user_id === user.id && order.order_number === orderNumber;
  const awaitingHandoff = menuOrderAwaitingHandoff(order);
  const { status: inboxStatus } = useChatInboxWebSocket(ownsOrder);

  const paymentReturn = searchParams.get("payment");
  const tokenKey = `menu-order-token:${orderNumber}`;

  useEffect(() => {
    if (!orderNumber) return;

    if (queryToken) {
      setStoredToken(queryToken);
      try {
        window.localStorage.setItem(tokenKey, queryToken);
      } catch {
        // No bloquea el seguimiento.
      }
      return;
    }

    try {
      setStoredToken(window.localStorage.getItem(tokenKey) || "");
    } catch {
      setStoredToken("");
    }
  }, [orderNumber, queryToken, tokenKey]);

  const loadOrder = useCallback(
    async (silent = false, showRefreshing = false) => {
      if (!orderNumber) return;
      if (showRefreshing) setRefreshing(true);
      if (!silent) setLoading(true);
      if (!silent) setError(null);

      try {
        let data: MenuOrder | null = null;
        const token = queryToken || storedToken;

        if (token) {
          data = await menuOrderService.publicOrder(orderNumber, token);
        } else if (isAuthenticated) {
          const items = await menuOrderService.mine();
          data = items.find((item) => item.order_number === orderNumber) ?? null;
        }

        if (!data) {
          throw new Error(
            "No pudimos abrir este pedido. Inicia sesión con la cuenta que lo realizó o usa el enlace privado recibido al crear el pedido.",
          );
        }

        setOrder(data);
      } catch (err) {
        if (!silent) setError(
          err instanceof Error ? err.message : "No se pudo cargar el pedido.",
        );
      } finally {
        if (!silent) setLoading(false);
        if (showRefreshing) setRefreshing(false);
      }
    }, [isAuthenticated, orderNumber, queryToken, storedToken],
  );

  useEffect(() => {
    if (!hydrated) return;
    if (!queryToken && !storedToken && !isAuthenticated) {
      setLoading(false);
      return;
    }
    void loadOrder();
  }, [hydrated, isAuthenticated, loadOrder, queryToken, storedToken]);

  const resyncAfterReconnect = useCallback(() => {
    void loadOrder(true);
  }, [loadOrder]);
  useInboxReconnect(inboxStatus, ownsOrder, resyncAfterReconnect);

  const loadCodeNotice = useCallback(async () => {
    if (!ownsOrder || !awaitingHandoff) return;
    try {
      const notices = await notificationService.getNotifications({ limit: 100 });
      const matching = notices.find((notice) => notice.type === "menu_order_confirmation_code" && notice.message?.includes(orderNumber));
      if (matching?.message) setCodeNotice(matching.message);
    } catch {
      // El código también se entrega al correo del cliente.
    }
  }, [awaitingHandoff, orderNumber, ownsOrder]);

  useEffect(() => { void loadCodeNotice(); }, [loadCodeNotice]);

  useEffect(() => {
    if (!ownsOrder) return;
    const unsubscribe = subscribeToInboxEvents((event) => {
      if (event.type === "notification.created" || (isMenuInboxEvent(event) && event.order_id === order?.id)) {
        void loadOrder(true);
        if (event.type === "notification.created") void loadCodeNotice();
      }
    });
    return unsubscribe;
  }, [ownsOrder, loadCodeNotice, loadOrder, order?.id, subscribeToInboxEvents]);

  useEffect(() => {
    if (!hydrated || ownsOrder || !order) return;
    const shouldPoll =
      !TERMINAL_STATUSES.has(order.status) ||
      (order.payment_method === "online" && order.payment_status === "pending");
    if (!shouldPoll) return;

    const id = window.setInterval(() => void loadOrder(true), 5000);
    return () => window.clearInterval(id);
  }, [hydrated, ownsOrder, loadOrder, order]);

  const productCount = useMemo(
    () => order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
    [order],
  );

  if (loading && !order) {
    return (
      <TrackingFrame authenticated={showClientShell}>
      <div className={`bg-[#f7f9f8] px-4 pb-20 ${showClientShell ? "" : "min-h-screen pt-28 md:pt-32"}`}>
        <div className="mx-auto flex min-h-[55vh] max-w-4xl items-center justify-center">
          <Loader2 size={34} className="animate-spin text-[#168e00]" />
        </div>
      </div>
      </TrackingFrame>
    );
  }

  if (error || !order) {
    return (
      <TrackingFrame authenticated={showClientShell}>
      <div className={`bg-[#f7f9f8] px-4 pb-20 ${showClientShell ? "" : "min-h-screen pt-28 md:pt-32"}`}>
        <div className="mx-auto max-w-3xl">
          <div className="rounded-3xl border border-red-100 bg-white p-7 text-center shadow-sm">
            <XCircle size={34} className="mx-auto text-red-500" />
            <h1 className="mt-3 text-xl font-black text-gray-900">No pudimos mostrar el pedido</h1>
            <p className="mt-2 text-sm leading-6 text-gray-600">{error || "Pedido no encontrado."}</p>
            {isAuthenticated ? (
              <Link href="/client/menu-orders" className="mt-5 inline-flex rounded-xl bg-[#004e28] px-4 py-2.5 text-sm font-bold text-white">
                Ver mis pedidos
              </Link>
            ) : null}
          </div>
        </div>
      </div>
      </TrackingFrame>
    );
  }

  const progress = MENU_ORDER_STATUS_FLOW.indexOf(order.status);
  const safeCheckout = order.payment_flow === "card_authorization" ? "" : getSafeMercadoPagoUrl(order.payment_checkout_url);
  const confirmationCode = codeNotice?.replace(orderNumber, "").match(/\b\d{6}\b/)?.[0] ?? null;

  return (
    <TrackingFrame authenticated={showClientShell}>
    <div className={`bg-[#f7f9f8] pb-24 ${showClientShell ? "" : "min-h-screen pt-28 md:pt-32"}`}>
      <div className="mx-auto max-w-6xl space-y-7 px-4 sm:px-6 lg:px-8">
        {paymentReturn ? (
        <div
          className={`rounded-2xl border p-4 text-sm shadow-sm ${
            paymentReturn === "success"
              ? "border-[#168e00]/30 bg-[#168e00]/5 text-[#004e28]"
              : paymentReturn === "pending"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {paymentReturn === "success"
            ? order.payment_status === "paid"
              ? order.settlement_status === "on_hold"
                ? "Pago recibido correctamente. Conserva tu código hasta que recibas o recojas el pedido."
                : "Pago confirmado correctamente."
              : "Mercado Pago recibió la operación. Estamos esperando la confirmación final."
            : paymentReturn === "pending"
              ? "El pago sigue pendiente de confirmación. Esta pantalla se actualizará automáticamente."
              : "El pago no se completó. Puedes volver a intentarlo si la liga sigue disponible."}
        </div>
        ) : null}

        <section className="overflow-hidden rounded-3xl border border-[#004e28]/10 bg-white shadow-[0_18px_50px_-32px_rgba(0,78,40,0.5)]">
        <div className="bg-[#004e28] px-5 py-7 text-white sm:px-8 sm:py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">Pedido de menú</p>
              <h1 className="mt-2 break-words font-[family-name:var(--font-varela-round)] text-2xl font-black leading-tight sm:text-3xl">{order.order_number}</h1>
              <p className="mt-2 text-sm text-white/75">{order.menu_name} · {productCount} productos</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-3 py-1.5 text-sm font-bold ${MENU_ORDER_STATUS_CLASSES[order.status]}`}>
                {MENU_ORDER_STATUS_LABELS[order.status]}
              </span>
              <button
                type="button"
                disabled={refreshing}
                onClick={() => void loadOrder(true, true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 text-white hover:bg-white/10 disabled:opacity-50"
                aria-label="Actualizar pedido"
              >
                <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-8">
          {order.status !== "cancelled" ? (
            <div>
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-[family-name:var(--font-varela-round)] text-base font-bold text-[#004e28]">Progreso del pedido</p>
                  <p className="mt-0.5 text-xs text-gray-500">Te mostraremos cada avance en esta misma pantalla.</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#f2f3f4] px-3 py-1 text-xs font-bold text-[#004e28]">
                  Paso {Math.max(progress + 1, 1)} de {MENU_ORDER_STATUS_FLOW.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {MENU_ORDER_STATUS_FLOW.map((status, index) => {
                  const complete = index <= progress;
                  const current = index === progress;
                  return (
                    <div
                      key={status}
                      className={`relative min-h-28 rounded-2xl border p-4 transition-colors ${
                        current
                          ? "border-[#168e00]/35 bg-[#168e00]/10 shadow-sm"
                          : complete
                            ? "border-[#168e00]/20 bg-[#168e00]/5"
                            : "border-gray-100 bg-gray-50"
                      } ${index === MENU_ORDER_STATUS_FLOW.length - 1 ? "col-span-2 sm:col-span-1" : ""}`}
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${complete ? "bg-[#168e00] text-white" : "bg-gray-200 text-gray-500"}`}>
                        {complete ? <CheckCircle2 size={17} /> : index + 1}
                      </span>
                      <p className={`mt-3 text-xs font-bold leading-5 ${complete ? "text-[#004e28]" : "text-gray-400"}`}>
                        {MENU_ORDER_STATUS_LABELS[status]}
                      </p>
                      {current ? <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-[#168e00]">Estado actual</span> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              <strong>Pedido cancelado.</strong>{order.cancellation_reason ? ` ${order.cancellation_reason}` : ""}
            </div>
          )}
        </div>
        </section>

        {awaitingHandoff ? (
          <section className="rounded-3xl border-2 border-[#168e00]/35 bg-white px-5 py-6 text-center shadow-sm sm:px-8" aria-label="Código de confirmación">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#004e28]">
              {order.fulfillment_type === "pickup" ? "Código para recoger tu pedido" : "Código de entrega"}
            </p>
            {confirmationCode ? (
              <p className="mt-3 font-mono text-4xl font-black tracking-[0.25em] text-[#004e28] sm:text-5xl" aria-label={`Código ${confirmationCode.split("").join(" ")}`}>{confirmationCode}</p>
            ) : (
              <p className="mx-auto mt-3 max-w-lg text-sm font-semibold leading-6 text-gray-700">
                Revisa el correo enviado a {order.customer_email} para consultar tu código{ownsOrder ? ", o consulta tus notificaciones" : ""}.
              </p>
            )}
            <p className="mt-3 text-sm text-gray-600">
              {order.fulfillment_type === "pickup" ? "Muéstralo únicamente cuando recojas tu pedido." : "Compártelo únicamente cuando tengas tu pedido."}
            </p>
          </section>
        ) : null}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="font-[family-name:var(--font-varela-round)] text-xl font-black text-[#004e28]">Productos</h2>
          <div className="mt-4 divide-y divide-gray-100">
            {order.items.map((item) => (
              <div key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-900">{item.quantity} × {item.item_name}</p>
                  {item.variant_name ? <p className="text-xs font-semibold text-gray-500">{item.variant_name}</p> : null}
                  {item.notes ? <p className="mt-1 text-sm text-gray-500">{item.notes}</p> : null}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-black text-[#004e28]">{formatMenuOrderMoney(item.line_total)}</p>
                  <p className="text-xs text-gray-400">{formatMenuOrderMoney(item.unit_price)} c/u</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-2 border-t border-gray-100 pt-4 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><strong>{formatMenuOrderMoney(order.subtotal)}</strong></div>
            <div className="flex justify-between text-gray-600"><span>Entrega</span><strong>{formatMenuOrderMoney(order.delivery_fee)}</strong></div>
            <div className="flex justify-between border-t border-gray-100 pt-2 text-lg text-[#004e28]"><span className="font-black">Total</span><strong className="text-[#168e00]">{formatMenuOrderMoney(order.total)}</strong></div>
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-32">
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-400">Pago</p>
            <div className="mt-3 flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#168e00]/10 text-[#168e00]">
                {order.payment_method === "online" ? <CreditCard size={20} /> : <Banknote size={20} />}
              </span>
              <div>
                <p className="font-bold text-gray-900">{paymentMethodLabel(order)}</p>
                <p className={`mt-1 text-sm font-semibold ${order.payment_status === "paid" ? "text-[#168e00]" : order.payment_status === "failed" ? "text-red-600" : "text-amber-600"}`}>
                  {paymentStatusLabel(order)}
                </p>
                {order.payment_status === "paid" && order.settlement_status === "on_hold" ? (
                  <p className="mt-2 text-sm leading-6 text-gray-600">{order.fulfillment_type === "pickup" ? "Tu pago fue recibido. Conserva tu código y muéstralo cuando recojas el pedido." : "Tu pago fue recibido. Conserva tu código y compártelo únicamente cuando recibas el pedido."}</p>
                ) : null}
                {order.payment_status === "authorized" ? (
                  <div className="mt-2 text-sm leading-6 text-gray-600">
                    <p>{order.fulfillment_type === "pickup" ? "Tu tarjeta está autorizada. Se cobrará cuando recojas tu pedido y el negocio confirme tu código." : "Tu tarjeta está autorizada. Se cobrará cuando recibas tu pedido y se confirme tu código."}</p>
                  </div>
                ) : null}
                {order.paid_at ? <p className="mt-1 text-xs text-gray-400">{formatMenuOrderDate(order.paid_at)}</p> : null}
              </div>
            </div>

            {order.payment_method === "online" && order.payment_status !== "paid" && safeCheckout ? (
              <a href={safeCheckout} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-bold text-white">
                <CreditCard size={16} /> Intentar pago nuevamente
              </a>
            ) : null}
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-400">Entrega</p>
            <p className="mt-3 flex items-center gap-2 font-semibold text-gray-800">
              {order.fulfillment_type === "delivery" ? <Truck size={18} className="text-[#168e00]" /> : <Store size={18} className="text-[#168e00]" />}
              {fulfillmentLabel(order.fulfillment_type)}
            </p>
            {order.delivery_address ? <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-gray-600"><MapPin size={17} className="mt-0.5 shrink-0 text-[#168e00]" /> {order.delivery_address}</p> : null}
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-400">Actualización</p>
            <p className="mt-3 flex items-center gap-2 text-sm text-gray-600"><Clock3 size={16} className="text-[#168e00]" /> {formatMenuOrderDate(order.updated_at)}</p>
          </section>
        </aside>
        </div>
      </div>
    </div>
    </TrackingFrame>
  );
}
