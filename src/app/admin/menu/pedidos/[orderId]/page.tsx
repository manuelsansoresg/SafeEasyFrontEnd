"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Store,
  Truck,
  XCircle,
} from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { menuOrderNeedsCode, menuProviderPaymentStatusLabel } from "@/lib/menuOrderFlow";
import { Toast } from "@/components/ui/Toast";
import {
  MENU_ORDER_STATUS_CLASSES,
  MENU_ORDER_STATUS_FLOW,
  MENU_ORDER_STATUS_LABELS,
  formatMenuOrderDate,
  formatMenuOrderMoney,
  fulfillmentLabel,
  nextPrimaryStatus,
  nextPrimaryStatusLabel,
} from "@/lib/menuOrders";
import { menuOrderService } from "@/services/menuOrderService";
import { useChatInboxWebSocket } from "@/hooks/useChatWebSocket";
import { useInboxReconnect } from "@/hooks/useInboxReconnect";
import { useChatStore } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";
import { isMenuInboxEvent } from "@/types/chat";
import type { MenuOrder, MenuOrderRefund } from "@/types/menuOrder";

function paymentLabel(order: MenuOrder) {
  return order.payment_method === "online"
    ? "Tarjeta / Mercado Pago"
    : "Efectivo";
}

function paymentStatusLabel(order: MenuOrder) {
  if (order.payment_status === "refunded") return "Reembolsado";
  if (order.payment_method === "cash") {
    return order.status === "completed" ? "Pedido completado" : "Cobro al entregar / recoger";
  }
  return menuProviderPaymentStatusLabel(order);
}

export default function AdminMenuOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = Number(params.orderId);
  const token = useAuthStore((state) => state.token);
  const subscribeToInboxEvents = useChatStore((state) => state.subscribeToInboxEvents);
  const { status: inboxStatus } = useChatInboxWebSocket(Boolean(token));
  const [order, setOrder] = useState<MenuOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [refunds, setRefunds] = useState<MenuOrderRefund[]>([]);
  const [refundAction, setRefundAction] = useState<"approve" | "reject" | null>(null);
  const [refundNote, setRefundNote] = useState("");
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const loadOrder = useCallback(async (signal?: AbortSignal, silent = false) => {
    if (!Number.isFinite(orderId) || orderId <= 0) {
      setError("orderId inválido.");
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const [updated, currentRefunds] = await Promise.all([
        menuOrderService.providerOrder(orderId, signal),
        menuOrderService.getProviderRefunds(orderId),
      ]);
      if (!signal?.aborted) { setOrder(updated); setRefunds(currentRefunds); }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!silent && !signal?.aborted) setError(err instanceof Error ? err.message : "No se pudo cargar el pedido.");
    } finally {
      if (!silent && !signal?.aborted) setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (order?.fulfillment_type !== "pickup" || order.status !== "ready") return;
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, [order?.fulfillment_type, order?.status]);

  useEffect(() => {
    const controller = new AbortController();
    void loadOrder(controller.signal);
    return () => controller.abort();
  }, [loadOrder]);

  const resyncAfterReconnect = useCallback(() => {
    void loadOrder(undefined, true);
  }, [loadOrder]);
  useInboxReconnect(inboxStatus, Boolean(token), resyncAfterReconnect);

  useEffect(() => {
    if (!token || !Number.isInteger(orderId) || orderId <= 0) return;
    const controller = new AbortController();
    const unsubscribe = subscribeToInboxEvents((event) => {
      if (event.type === "notification.created" || (isMenuInboxEvent(event) && event.order_id === orderId)) {
        void loadOrder(controller.signal, true);
      }
    });
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [loadOrder, orderId, subscribeToInboxEvents, token]);

  const productCount = useMemo(
    () => order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
    [order],
  );

  const updateStatus = async () => {
    if (!order) return;
    const next = nextPrimaryStatus(order.status);
    if (!next) return;

    if (order.payment_method === "online" && !["paid", "authorized"].includes(order.payment_status)) {
      setToast({
        type: "error",
        message: "No puedes procesar este pedido hasta que Mercado Pago confirme el pago.",
      });
      return;
    }
    if (order.payment_method === "online" && order.settlement_status === "on_hold" && next === "completed") {
      setToast({ type: "error", message: "Confirma la entrega con el código del cliente." });
      return;
    }

    setBusy(true);
    try {
      const updated = await menuOrderService.updateStatus(order.id, { status: next });
      setOrder(updated);
      setToast({
        type: "success",
        message: `Pedido actualizado a ${MENU_ORDER_STATUS_LABELS[next]}.`,
      });
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "No se pudo actualizar el pedido.",
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelivery = async () => {
    if (!order || busy || !/^\d{6}$/.test(confirmationCode)) return;
    setBusy(true);
    try {
      const updated = await menuOrderService.confirmDelivery(order.id, confirmationCode);
      setOrder(updated);
      setConfirmationCode("");
      const completed = updated.status === "completed" && updated.settlement_status === "released";
      const action = updated.fulfillment_type === "pickup" ? "Recolección" : "Entrega";
      setToast({ type: "success", message: completed
        ? updated.payment_flow === "preference"
          ? `${action} confirmada. La venta quedó completada.`
          : `${action} confirmada y pago capturado.`
        : "La confirmación sigue en proceso. Actualiza el pedido en unos momentos." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo confirmar la entrega.";
      const normalized = message.toLowerCase();
      setToast({ type: "error", message:
        /incorrect|invalid code|código incorrecto/.test(normalized) ? "Código incorrecto. Pide al cliente que lo revise." :
        /too many|demasiados intentos/.test(normalized) ? "Demasiados intentos. Espera antes de reintentar." :
        /venci|expir/.test(normalized) ? "La autorización de pago venció." :
        /reconect|reconnect/.test(normalized) ? "El proveedor debe reconectar Mercado Pago." :
        /captur|cobro|liber|release/.test(normalized) ? order.payment_flow === "preference" ? "No se pudo liberar la venta. Inténtalo nuevamente." : "No se pudo capturar el pago. Inténtalo nuevamente." : message,
      });
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async () => {
    if (!order || !cancelReason.trim() || busy) return;
    setBusy(true);

    try {
      const updated = await menuOrderService.providerCancelOrder(order.id, cancelReason.trim());
      setOrder(updated);
      setCancelOpen(false);
      setCancelReason("");
      setToast({ type: "success", message: updated.payment_status === "refunded" ? "Pedido cancelado y reembolso procesado." : "Pedido cancelado." });
    } catch (err) {
      setToast({
        type: "error",
        message: err instanceof Error ? err.message : "No se pudo cancelar el pedido.",
      });
      await loadOrder(undefined, true);
    } finally {
      setBusy(false);
    }
  };

  const markNoShow = async () => {
    if (!order || busy) return;
    setBusy(true);
    try {
      await menuOrderService.markNoShow(order.id);
      setNoShowOpen(false);
      await loadOrder(undefined, true);
      setToast({ type: "success", message: "Pedido cerrado como no recogido." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo actualizar el pedido." });
      await loadOrder(undefined, true);
    } finally { setBusy(false); }
  };

  const decideRefund = async () => {
    const active = [...refunds].sort((a, b) => Date.parse(b.requested_at) - Date.parse(a.requested_at))[0];
    if (!order || !active || !refundAction || busy || (refundAction === "reject" && !refundNote.trim())) return;
    setBusy(true);
    try {
      const decision = refundAction;
      if (decision === "approve") await menuOrderService.approveRefund(order.id, active.id, refundNote);
      else await menuOrderService.rejectRefund(order.id, active.id, refundNote.trim());
      setRefundAction(null); setRefundNote("");
      await loadOrder(undefined, true);
      const current = await menuOrderService.getProviderRefunds(order.id);
      setRefunds(current);
      setToast({ type: "success", message: decision === "reject" ? "Reembolso rechazado." : current.some((refund) => refund.id === active.id && refund.status === "refunded") ? "Reembolso procesado." : "Reembolso aprobado." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo resolver la solicitud." });
      await loadOrder(undefined, true);
    } finally { setBusy(false); }
  };

  if (loading && !order) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Loader2 size={34} className="animate-spin text-[#168e00]" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <Link href="/admin/menu/pedidos" className="inline-flex items-center gap-2 text-sm font-semibold text-[#168e00]">
          <ArrowLeft size={17} /> Volver a pedidos
        </Link>
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error || "No se encontró el pedido."}
        </div>
      </div>
    );
  }

  const primaryLabel = nextPrimaryStatusLabel(order.status);
  const canCancel = ["pending", "confirmed", "preparing", "ready"].includes(order.status);
  const readyDeadline = order.fulfillment_type === "pickup" && order.status === "ready" && order.ready_at ? Date.parse(order.ready_at) + 60 * 60000 : null;
  const latestRefund = [...refunds].sort((a, b) => Date.parse(b.requested_at) - Date.parse(a.requested_at))[0];
  const currentProgress = MENU_ORDER_STATUS_FLOW.indexOf(order.status);
  const onlineBlocked =
    order.payment_method === "online" && !["paid", "authorized"].includes(order.payment_status);
  const needsCode = menuOrderNeedsCode(order);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/admin/menu/pedidos" className="inline-flex items-center gap-2 text-sm font-semibold text-[#168e00] hover:underline">
        <ArrowLeft size={17} /> Volver a pedidos
      </Link>

      <PageHero
        eyebrow="Pedido de menú"
        title={order.order_number}
        subtitle={`${order.customer_name} · ${productCount} productos · ${formatMenuOrderMoney(order.total)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {primaryLabel && !needsCode ? (
              <button
                type="button"
                disabled={busy || onlineBlocked}
                onClick={() => void updateStatus()}
                className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-4 py-3 font-semibold text-white hover:bg-[#117500] disabled:cursor-not-allowed disabled:opacity-50"
                title={onlineBlocked ? "El pago en línea todavía no está confirmado" : undefined}
              >
                {busy ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
                {primaryLabel}
              </button>
            ) : null}
            {canCancel ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setCancelOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <XCircle size={17} /> Cancelar pedido
              </button>
            ) : null}
            {readyDeadline && now >= readyDeadline ? <button type="button" disabled={busy} onClick={() => setNoShowOpen(true)} className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 font-semibold text-amber-900 disabled:opacity-50">Cliente no recogió</button> : null}
          </div>
        }
      />

      {readyDeadline && now < readyDeadline ? <p className="text-sm text-gray-600">Podrás marcar el pedido como no recogido después de las {new Date(readyDeadline).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}.</p> : null}

      {onlineBlocked && order.payment_status !== "refunded" ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Pedido pendiente de pago.</strong> No lo prepares todavía. Espera a que Mercado Pago confirme el pago.
        </div>
      ) : null}

      {needsCode ? (
        <section className="rounded-2xl border border-[#004e28]/20 bg-[#f2f3f4] p-4 sm:p-5">
          <h2 className="font-bold text-[#004e28]">{order.fulfillment_type === "pickup" ? "Confirmar recolección" : "Confirmar entrega"}</h2>
          <p className="mt-1 text-sm text-gray-600">{order.fulfillment_type === "pickup" ? "Solicita al cliente su código cuando le entregues el pedido." : "Solicita al cliente su código únicamente cuando le entregues el pedido."} {order.payment_flow === "preference" ? "Al confirmar el código, la entrega quedará completada y la venta será liberada." : "Al confirmar el código, se capturará el pago."}</p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input aria-label="Código de confirmación" inputMode="numeric" autoComplete="off" maxLength={6} value={confirmationCode} onChange={(event) => setConfirmationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Código de confirmación" className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-mono text-lg tracking-widest sm:max-w-xs" />
            <button type="button" disabled={busy || confirmationCode.length !== 6} onClick={() => void confirmDelivery()} className="rounded-xl bg-[#004e28] px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "Confirmando..." : order.fulfillment_type === "pickup" ? "Confirmar recolección" : "Confirmar entrega"}</button>
          </div>
        </section>
      ) : null}

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Estado del pedido</p>
            <span className={`mt-2 inline-flex rounded-full border px-3 py-1.5 text-sm font-bold ${MENU_ORDER_STATUS_CLASSES[order.status]}`}>
              {MENU_ORDER_STATUS_LABELS[order.status]}
            </span>
          </div>
          <p className="text-sm text-gray-500">Recibido {formatMenuOrderDate(order.created_at)}</p>
        </div>

        {order.status !== "cancelled" && order.status !== "no_show" ? (
          <div className="mt-5 grid gap-2 sm:grid-cols-5">
            {MENU_ORDER_STATUS_FLOW.map((status, index) => {
              const completed = index <= currentProgress;
              return (
                <div key={status} className={`rounded-2xl border p-3 ${completed ? "border-[#168e00]/20 bg-[#168e00]/5" : "border-gray-100 bg-gray-50"}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full ${completed ? "bg-[#168e00] text-white" : "bg-gray-200 text-gray-500"}`}>
                    {completed ? <CheckCircle2 size={16} /> : index + 1}
                  </span>
                  <p className={`mt-2 text-xs font-bold ${completed ? "text-[#004e28]" : "text-gray-400"}`}>{MENU_ORDER_STATUS_LABELS[status]}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            <strong>{order.status === "no_show" ? "No recogido." : "Pedido cancelado."}</strong>{order.cancellation_reason ? ` Motivo: ${order.cancellation_reason}` : ""}
          </div>
        )}
      </section>

      {latestRefund ? <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm"><h2 className="text-lg font-bold text-[#004e28]">Solicitud de reembolso</h2><p className="mt-2 text-sm">Motivo: {latestRefund.reason}</p><p className="text-xs text-gray-500">Fecha: {formatMenuOrderDate(latestRefund.requested_at)}</p><p className="mt-2 font-semibold">{({ requested: "Reembolso solicitado", approved: "Reembolso aprobado", rejected: "Reembolso rechazado", refunded: "Reembolso procesado" })[latestRefund.status]}</p>{latestRefund.decision_note ? <p className="mt-2 text-sm">{latestRefund.decision_note}</p> : null}{latestRefund.status === "requested" ? <div className="mt-4 flex gap-2"><button disabled={busy} onClick={() => setRefundAction("approve")} className="rounded-xl bg-[#168e00] px-4 py-2 text-white disabled:opacity-50">Aprobar reembolso</button><button disabled={busy} onClick={() => setRefundAction("reject")} className="rounded-xl border border-red-300 px-4 py-2 text-red-700 disabled:opacity-50">Rechazar reembolso</button></div> : null}</section> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
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
            <div className="flex justify-between border-t border-gray-200 pt-2 text-lg text-[#004e28]"><span className="font-black">Total</span><strong className="text-[#168e00]">{formatMenuOrderMoney(order.total)}</strong></div>
          </div>

          {order.notes ? (
            <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Notas generales</p>
              <p className="mt-1 text-sm text-amber-900">{order.notes}</p>
            </div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-400">Pago</p>
            <div className="mt-3 flex gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${["paid", "refunded"].includes(order.payment_status) ? "bg-[#168e00]/10 text-[#168e00]" : order.payment_status === "failed" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                {order.payment_method === "online" ? <CreditCard size={20} /> : <Banknote size={20} />}
              </span>
              <div>
                <p className="font-bold text-gray-900">{paymentLabel(order)}</p>
                <p className={`mt-1 text-sm font-semibold ${["paid", "refunded"].includes(order.payment_status) ? "text-[#168e00]" : order.payment_status === "failed" ? "text-red-600" : "text-amber-600"}`}>
                  {paymentStatusLabel(order)}
                </p>
                {order.status === "no_show" && order.settlement_status === "released" ? <p className="mt-1 text-sm font-semibold text-[#004e28]">Venta: Liberada</p> : null}
                {order.paid_at ? <p className="mt-1 text-xs text-gray-400">Pagado {formatMenuOrderDate(order.paid_at)}</p> : null}
                {order.mp_payment_id ? <p className="mt-1 break-all text-xs text-gray-400">MP #{order.mp_payment_id}</p> : null}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-400">Cliente</p>
            <p className="mt-3 font-bold text-gray-900">{order.customer_name}</p>
            <a href={`tel:${order.customer_phone}`} className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#168e00] hover:underline"><Phone size={16} /> {order.customer_phone}</a>
            <a href={`mailto:${order.customer_email}`} className="mt-2 flex items-center gap-2 break-all text-sm font-semibold text-[#168e00] hover:underline"><Mail size={16} /> {order.customer_email}</a>
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
            <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-400">Tiempos</p>
            <div className="mt-3 space-y-2 text-sm text-gray-600">
              <p className="flex items-center gap-2"><Clock3 size={16} className="text-[#168e00]" /> Creado: {formatMenuOrderDate(order.created_at)}</p>
              {order.confirmed_at ? <p>Confirmado: {formatMenuOrderDate(order.confirmed_at)}</p> : null}
              {order.preparing_at ? <p>Preparación: {formatMenuOrderDate(order.preparing_at)}</p> : null}
              {order.ready_at ? <p>Listo: {formatMenuOrderDate(order.ready_at)}</p> : null}
              {order.completed_at ? <p>Completado: {formatMenuOrderDate(order.completed_at)}</p> : null}
              {order.settlement_released_at ? <p>Venta liberada: {formatMenuOrderDate(order.settlement_released_at)}</p> : null}
              {order.cancelled_at ? <p>Cancelado: {formatMenuOrderDate(order.cancelled_at)}</p> : null}
              {order.no_show_at ? <p>No recogido: {formatMenuOrderDate(order.no_show_at)}</p> : null}
            </div>
          </section>
        </aside>
      </div>

      {cancelOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && setCancelOpen(false)}>
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-xl font-black text-gray-900">Cancelar pedido</h2>
            <p className="mt-1 text-sm text-gray-500">{order.payment_method === "online" && order.payment_status === "paid" ? "Al cancelar, se realizará el reembolso total al cliente." : "El cliente recibirá el cambio de estado."}</p>
            <label className="mt-5 block text-sm font-bold text-gray-700">
              Motivo de cancelación
              <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} maxLength={1000} className="mt-1.5 min-h-28 w-full resize-none rounded-xl border border-gray-200 px-3.5 py-3 font-normal outline-none focus:border-red-400" placeholder="Explica brevemente por qué se cancela el pedido" />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setCancelOpen(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 font-semibold text-gray-600">Volver</button>
              <button type="button" disabled={busy || !cancelReason.trim()} onClick={() => void cancelOrder()} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white disabled:opacity-40">
                {busy ? <Loader2 size={17} className="animate-spin" /> : <XCircle size={17} />} Confirmar cancelación
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {noShowOpen ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"><div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6"><h2 className="text-xl font-bold">Marcar como no recogido</h2><p className="mt-2 text-sm text-gray-600">Confirma sólo si el pedido estaba listo y el cliente no acudió a recogerlo. Esta acción cerrará la venta y el código dejará de funcionar.</p><div className="mt-5 flex justify-end gap-2"><button disabled={busy} onClick={() => setNoShowOpen(false)} className="rounded-xl border px-4 py-2">Volver</button><button disabled={busy} onClick={() => void markNoShow()} className="inline-flex items-center gap-2 rounded-xl bg-amber-700 px-4 py-2 text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : null}Confirmar no recogido</button></div></div></div> : null}
      {refundAction ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"><div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6"><h2 className="text-xl font-bold">{refundAction === "approve" ? "Aprobar reembolso" : "Rechazar reembolso"}</h2><p className="mt-2 text-sm text-gray-600">{refundAction === "approve" ? "Si el pago se realizó con Mercado Pago, el backend procesará automáticamente el reembolso total." : "Explica al cliente por qué se rechaza su solicitud."}</p><textarea value={refundNote} onChange={(event) => setRefundNote(event.target.value)} placeholder={refundAction === "approve" ? "Nota opcional" : "Motivo obligatorio"} className="mt-4 min-h-24 w-full rounded-xl border p-3" /><div className="mt-4 flex justify-end gap-2"><button disabled={busy} onClick={() => setRefundAction(null)} className="rounded-xl border px-4 py-2">Volver</button><button disabled={busy || (refundAction === "reject" && !refundNote.trim())} onClick={() => void decideRefund()} className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-4 py-2 text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : null}Confirmar</button></div></div></div> : null}

      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
