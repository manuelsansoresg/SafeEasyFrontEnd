"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Store,
  Truck,
  XCircle,
} from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
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
import type { MenuOrder } from "@/types/menuOrder";

type ToastState = { type: "success" | "error" | "info"; message: string } | null;

export default function AdminMenuOrderDetailPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = Number(params.orderId);
  const [order, setOrder] = useState<MenuOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const loadOrder = useCallback(async () => {
    if (!Number.isFinite(orderId) || orderId <= 0) {
      setError("El identificador del pedido no es válido.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    try {
      setOrder(await menuOrderService.providerOrder(orderId, controller.signal));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el pedido.");
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const productCount = useMemo(
    () => order?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
    [order],
  );

  const updateStatus = async () => {
    if (!order) return;
    const next = nextPrimaryStatus(order.status);
    if (!next) return;

    setBusy(true);
    try {
      const updated = await menuOrderService.updateStatus(order.id, { status: next });
      setOrder(updated);
      setToast({ type: "success", message: `Pedido actualizado a ${MENU_ORDER_STATUS_LABELS[next]}.` });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo actualizar el pedido." });
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async () => {
    if (!order || !cancelReason.trim()) return;
    setBusy(true);
    try {
      const updated = await menuOrderService.updateStatus(order.id, {
        status: "cancelled",
        cancellation_reason: cancelReason.trim(),
      });
      setOrder(updated);
      setCancelOpen(false);
      setCancelReason("");
      setToast({ type: "success", message: "Pedido cancelado." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo cancelar el pedido." });
    } finally {
      setBusy(false);
    }
  };

  if (loading && !order) {
    return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 size={34} className="animate-spin text-[#168e00]" /></div>;
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <Link href="/admin/menu/pedidos" className="inline-flex items-center gap-2 text-sm font-semibold text-[#168e00]"><ArrowLeft size={17} /> Volver a pedidos</Link>
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error || "No se encontró el pedido."}</div>
      </div>
    );
  }

  const primaryLabel = nextPrimaryStatusLabel(order.status);
  const canCancel = ["pending", "confirmed", "preparing"].includes(order.status);
  const currentProgress = MENU_ORDER_STATUS_FLOW.indexOf(order.status);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/admin/menu/pedidos" className="inline-flex items-center gap-2 text-sm font-semibold text-[#168e00] hover:underline"><ArrowLeft size={17} /> Volver a pedidos</Link>

      <PageHero
        eyebrow="Pedido de menú"
        title={order.order_number}
        subtitle={`${order.customer_name} · ${productCount} productos · ${formatMenuOrderMoney(order.total)}`}
        actions={
          <>
            {primaryLabel ? (
              <button type="button" disabled={busy} onClick={() => void updateStatus()} className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-4 py-3 font-semibold text-white hover:bg-[#117500] disabled:opacity-50">
                {busy ? <Loader2 size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
                {primaryLabel}
              </button>
            ) : null}
            {canCancel ? (
              <button type="button" disabled={busy} onClick={() => setCancelOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                <XCircle size={17} /> Cancelar
              </button>
            ) : null}
          </>
        }
      />

      <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Estado actual</p>
            <span className={`mt-2 inline-flex rounded-full border px-3 py-1.5 text-sm font-bold ${MENU_ORDER_STATUS_CLASSES[order.status]}`}>{MENU_ORDER_STATUS_LABELS[order.status]}</span>
          </div>
          <p className="text-sm text-gray-500">Recibido {formatMenuOrderDate(order.created_at)}</p>
        </div>

        {order.status !== "cancelled" ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-5">
            {MENU_ORDER_STATUS_FLOW.map((status, index) => {
              const completed = index <= currentProgress;
              return (
                <div key={status} className={`rounded-2xl border p-3 ${completed ? "border-[#168e00]/20 bg-[#168e00]/5" : "border-gray-100 bg-gray-50"}`}>
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full ${completed ? "bg-[#168e00] text-white" : "bg-gray-200 text-gray-500"}`}>{completed ? <CheckCircle2 size={16} /> : <span className="text-xs font-black">{index + 1}</span>}</div>
                  <p className={`mt-2 text-xs font-bold ${completed ? "text-[#004e28]" : "text-gray-400"}`}>{MENU_ORDER_STATUS_LABELS[status]}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            <strong>Pedido cancelado.</strong>{order.cancellation_reason ? ` Motivo: ${order.cancellation_reason}` : ""}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-xl font-black text-[#004e28]">Productos</h2>
          <div className="mt-4 divide-y divide-gray-100">
            {order.items.map((item) => (
              <div key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#168e00]/10 font-black text-[#168e00]">{item.quantity}×</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="font-bold text-gray-900">{item.item_name}{item.variant_name && !item.item_name.includes(item.variant_name) ? ` · ${item.variant_name}` : ""}</p>{item.notes ? <p className="mt-1 text-sm text-gray-500">Nota: {item.notes}</p> : null}</div>
                    <div className="shrink-0 text-right"><p className="font-black text-[#004e28]">{formatMenuOrderMoney(item.line_total)}</p><p className="text-xs text-gray-400">{formatMenuOrderMoney(item.unit_price)} c/u</p></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-2 rounded-2xl bg-[#f2f3f4] p-4 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><strong>{formatMenuOrderMoney(order.subtotal)}</strong></div>
            <div className="flex justify-between text-gray-600"><span>Entrega</span><strong>{formatMenuOrderMoney(order.delivery_fee)}</strong></div>
            <div className="flex justify-between border-t border-gray-200 pt-2 text-lg text-[#004e28]"><span className="font-black">Total</span><strong className="text-[#168e00]">{formatMenuOrderMoney(order.total)}</strong></div>
          </div>

          {order.notes ? <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Notas generales</p><p className="mt-1 text-sm text-amber-900">{order.notes}</p></div> : null}
        </section>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-[#004e28]">Cliente</h2>
            <p className="mt-3 font-bold text-gray-900">{order.customer_name}</p>
            <a href={`tel:${order.customer_phone}`} className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#168e00] hover:underline"><Phone size={16} /> {order.customer_phone}</a>
            <a href={`mailto:${order.customer_email}`} className="mt-2 flex items-center gap-2 break-all text-sm font-semibold text-[#168e00] hover:underline"><Mail size={16} /> {order.customer_email}</a>
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-[#004e28]">Entrega</h2>
            <p className="mt-3 flex items-center gap-2 font-semibold text-gray-800">{order.fulfillment_type === "delivery" ? <Truck size={18} className="text-[#168e00]" /> : <Store size={18} className="text-[#168e00]" />} {fulfillmentLabel(order.fulfillment_type)}</p>
            {order.delivery_address ? <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-gray-600"><MapPin size={17} className="mt-0.5 shrink-0 text-[#168e00]" /> {order.delivery_address}</p> : null}
          </section>

          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-[#004e28]">Tiempos</h2>
            <div className="mt-3 space-y-3 text-sm text-gray-600">
              <p className="flex items-center gap-2"><Clock3 size={16} className="text-[#168e00]" /> Creado: {formatMenuOrderDate(order.created_at)}</p>
              {order.confirmed_at ? <p>Confirmado: {formatMenuOrderDate(order.confirmed_at)}</p> : null}
              {order.preparing_at ? <p>Preparación: {formatMenuOrderDate(order.preparing_at)}</p> : null}
              {order.ready_at ? <p>Listo: {formatMenuOrderDate(order.ready_at)}</p> : null}
              {order.completed_at ? <p>Completado: {formatMenuOrderDate(order.completed_at)}</p> : null}
              {order.cancelled_at ? <p>Cancelado: {formatMenuOrderDate(order.cancelled_at)}</p> : null}
            </div>
          </section>
        </aside>
      </div>

      {cancelOpen ? (
        <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => !busy && setCancelOpen(false)}>
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-xl font-black text-gray-900">Cancelar pedido</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">El cliente recibirá el cambio de estado y, si corresponde, también un correo con el motivo.</p>
            <label className="mt-5 block text-sm font-bold text-gray-700">Motivo de cancelación<textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} maxLength={1000} className="mt-1.5 min-h-28 w-full resize-none rounded-xl border border-gray-200 px-3.5 py-3 font-normal outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100" placeholder="Explica brevemente por qué se cancela el pedido" /></label>
            <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setCancelOpen(false)} className="rounded-xl border border-gray-200 px-4 py-2.5 font-semibold text-gray-600">Volver</button><button type="button" disabled={busy || !cancelReason.trim()} onClick={() => void cancelOrder()} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white disabled:opacity-40">{busy ? <Loader2 size={17} className="animate-spin" /> : <XCircle size={17} />} Confirmar cancelación</button></div>
          </div>
        </div>
      ) : null}

      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
