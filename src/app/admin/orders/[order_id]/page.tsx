"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle,
  Clock,
  FileText,
  KeyRound,
  Loader2,
  MapPin,
  PackageCheck,
  Store,
  Truck,
  X,
} from "lucide-react";

import { useAuthStore } from "@/store/useAuthStore";
import { orderService, Order, OrderHistoryItem, OrderRefund } from "@/services/orderService";
import { isAdminRole, isSupplierRole, resolveCurrentSupplier } from "@/lib/currentSupplier";
import { downloadPickupTicket, downloadShippingLabel } from "@/lib/pickupTicket";
import type { LatLngLiteral } from "@/lib/googleMaps";
import {
  fetchSupplierLocation,
  getBuyerAddress,
  getOrderBuyerCoordinates,
  getOrderSupplierCoordinates,
  getSupplierAddress,
} from "@/lib/orderLocation";
import FileUpload from "@/components/ui/FileUpload";
import { Toast } from "@/components/ui/Toast";

const OrderRouteMap = dynamic(() => import("@/components/orders/OrderRouteMap"), {
  ssr: false,
  loading: () => <div className="h-[340px] rounded-2xl border border-gray-100 bg-[#f2f3f4]" />,
});

type ToastState = null | { type: "success" | "error" | "info"; message: string };
type DeliveryTypeKey = "shipping" | "pickup";

function normalizeStatusKey(value: unknown) {
  const raw = String(value || "").trim();
  const ascii = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const v = ascii.toLowerCase().replace(/\s+/g, "_");

  if (["authorized", "autorizado"].includes(v)) return "authorized";
  if (["paid", "pagado", "approved", "aprobado", "accredited", "pago_verificado", "validado", "validated"].includes(v)) return "paid";
  if (["completed", "completado", "delivered", "entregado", "verified", "verificado"].includes(v)) return "completed";
  if (["ready_for_pickup", "ready_pickup", "listo_para_recoger", "listo_para_recojer"].includes(v)) return "ready_for_pickup";
  if (["preparing", "start_preparing", "started_preparing", "in_preparation", "en_preparacion"].includes(v)) return "preparing";
  if (["out_for_delivery", "in_transit", "transit", "en_camino", "en_reparto"].includes(v)) return "in_transit";
  if (["en_route_to_pickup", "going_to_pickup", "camino_a_recoger"].includes(v)) return "en_route_to_pickup";
  if (["picked_up", "pickup_completed", "recogido"].includes(v)) return "picked_up";
  if (["cancelled", "cancelado"].includes(v)) return "cancelled";
  if (["expired", "expirado", "vencido"].includes(v)) return "expired";
  if (["refund_requested", "reembolso_solicitado"].includes(v)) return "refund_requested";
  if (["refund_approved", "reembolso_aprobado"].includes(v)) return "refund_approved";
  if (["refund_rejected", "reembolso_rechazado"].includes(v)) return "refund_rejected";
  if (["refund_refunded", "refunded", "reembolsado", "refund_completed", "refund_complete"].includes(v)) return "refund_refunded";
  if (["pending", "pendiente", "created", "creado"].includes(v)) return v === "created" || v === "creado" ? "created" : "pending";
  return v;
}

function statusLabel(value: unknown) {
  const key = normalizeStatusKey(value);
  const map: Record<string, string> = {
    pending: "Pendiente",
    created: "Creado",
    authorized: "Tarjeta autorizada",
    paid: "Pago capturado",
    preparing: "En preparación",
    ready_for_pickup: "Listo para recoger",
    en_route_to_pickup: "En camino a recoger",
    picked_up: "Producto recogido",
    in_transit: "En camino",
    completed: "Entregado",
    cancelled: "Cancelado",
    expired: "Expirado",
    refund_requested: "Reembolso solicitado",
    refund_approved: "Reembolso aprobado",
    refund_rejected: "Reembolso rechazado",
    refund_refunded: "Reembolsado",
  };
  return map[key] || String(value || "—");
}

function getDeliveryType(order: Order): DeliveryTypeKey {
  const raw = String(order.delivery_type || "").toLowerCase();
  if (["shipping", "delivery", "envio", "envío"].includes(raw)) return "shipping";
  return "pickup";
}

function money(value: unknown) {
  const n = typeof value === "number" ? value : Number(String(value ?? 0).replace(/[^\d.-]/g, ""));
  return (Number.isFinite(n) ? n : 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  });
}

function date(value: unknown) {
  const d = new Date(String(value || ""));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-MX", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    const msg = error.message.trim();
    const low = msg.toLowerCase();

    if (low.includes("delivery code") || low.includes("código") || low.includes("codigo")) {
      if (low.includes("locked") || low.includes("bloque")) {
        return "El código quedó bloqueado temporalmente por varios intentos incorrectos. Intenta más tarde.";
      }
      if (low.includes("invalid") || low.includes("incorrect") || low.includes("incorrecto")) {
        return "El código de entrega no es correcto.";
      }
    }

    if (low.includes("settlement") || low.includes("confirm-delivery")) {
      return "Esta orden debe cerrarse validando el código de entrega del cliente.";
    }

    if (!low.includes("failed to")) return msg;
  }
  return fallback;
}

function latestHistoryKey(items: OrderHistoryItem[]) {
  const sorted = [...items].sort((a, b) => {
    const ta = new Date(String(a.created_at || a.timestamp || a.date || "")).getTime();
    const tb = new Date(String(b.created_at || b.timestamp || b.date || "")).getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });
  const h = sorted[0];
  return normalizeStatusKey(h?.status || h?.event || h?.action || h?.description || h?.message || "");
}

function latestRefund(items: OrderRefund[]) {
  return [...items].sort((a, b) => {
    const ta = new Date(String(a.updated_at || a.created_at || "")).getTime();
    const tb = new Date(String(b.updated_at || b.created_at || "")).getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  })[0] ?? null;
}

function deliveryCodeAllowed(mode: DeliveryTypeKey, state: string) {
  if (mode === "pickup") return state === "ready_for_pickup" || state === "preparing";
  return state === "in_transit" || state === "picked_up" || state === "shipped";
}

export default function AdminOrderDetailPage() {
  const params = useParams<{ order_id?: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const [authHydrated, setAuthHydrated] = useState(() => useAuthStore.persist.hasHydrated());
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<OrderHistoryItem[]>([]);
  const [refunds, setRefunds] = useState<OrderRefund[]>([]);
  const [toast, setToast] = useState<ToastState>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deliveryCode, setDeliveryCode] = useState("");
  const [acceptsCourier, setAcceptsCourier] = useState(false);
  const [buyerAddress, setBuyerAddress] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierCoordsFromApi, setSupplierCoordsFromApi] = useState<LatLngLiteral | null>(null);

  const [refundApproveOpen, setRefundApproveOpen] = useState(false);
  const [refundRejectOpen, setRefundRejectOpen] = useState(false);
  const [refundFinalizeOpen, setRefundFinalizeOpen] = useState(false);
  const [refundApproveNote, setRefundApproveNote] = useState("");
  const [refundRejectReason, setRefundRejectReason] = useState("");
  const [refundFinalizeNote, setRefundFinalizeNote] = useState("");
  const [refundFinalizeFile, setRefundFinalizeFile] = useState<File | null>(null);

  const orderId = useMemo(() => {
    const n = Number(params?.order_id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params?.order_id]);

  const roleKey = String(user?.role || "").toLowerCase();
  const isAdminUser = isAdminRole(roleKey);
  const isSupplierUser = isSupplierRole(roleKey) && !isAdminUser;
  const canView = isAdminUser || isSupplierUser;

  useEffect(() => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => setAuthHydrated(true));
    if (useAuthStore.persist.hasHydrated()) setAuthHydrated(true);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const load = useCallback(async () => {
    if (!authHydrated) return;
    if (!orderId) {
      setLoading(false);
      setToast({ type: "error", message: "order_id inválido." });
      return;
    }

    setLoading(true);
    try {
      const ord = await orderService.getOrderById(orderId);

      if (isSupplierUser) {
        const supplier = await resolveCurrentSupplier(user);
        const orderSupplierId = Number(ord.supplier?.id ?? ord.supplier_id);
        if (!supplier?.id || Number(supplier.id) !== orderSupplierId) {
          throw new Error("No puedes ver una orden que pertenece a otro proveedor.");
        }
      }

      setOrder(ord);

      const [historyResult, refundsResult] = await Promise.allSettled([
        orderService.getOrderHistory(orderId),
        orderService.getOrderRefunds(orderId),
      ]);
      setHistory(historyResult.status === "fulfilled" ? historyResult.value : []);
      setRefunds(refundsResult.status === "fulfilled" ? refundsResult.value : []);

      setBuyerAddress(getBuyerAddress(ord));
      setSupplierAddress(getSupplierAddress(ord));
      setSupplierCoordsFromApi(null);

      const supplierId = Number(ord.supplier?.id ?? ord.supplier_id);
      if (Number.isFinite(supplierId) && supplierId > 0) {
        const info = await fetchSupplierLocation(supplierId);
        if (info.address) setSupplierAddress(info.address);
        if (info.coordinates) setSupplierCoordsFromApi(info.coordinates);
        setAcceptsCourier(Boolean(info.acceptsCourier));
      }
    } catch (e) {
      setOrder(null);
      setToast({ type: "error", message: getErrorMessage(e, "No se pudo cargar la orden.") });
    } finally {
      setLoading(false);
    }
  }, [authHydrated, isSupplierUser, orderId, user]);

  useEffect(() => {
    load();
  }, [load]);

  const mode = useMemo(() => (order ? getDeliveryType(order) : "pickup"), [order]);
  const paymentKey = normalizeStatusKey(order?.payment_status || order?.status || "");
  const isPaymentReady = paymentKey === "paid" || paymentKey === "authorized";
  const fulfillmentKey = normalizeStatusKey(order?.fulfillment_status || order?.visual_status || "");
  const historyKey = latestHistoryKey(history);
  const effectiveKey =
    ["completed", "cancelled", "refund_refunded"].includes(fulfillmentKey)
      ? fulfillmentKey
      : fulfillmentKey && !["pending", "created", "authorized", "paid"].includes(fulfillmentKey)
        ? fulfillmentKey
        : historyKey || paymentKey || "pending";

  const activeRefund = useMemo(() => latestRefund(refunds), [refunds]);
  const finalState = ["completed", "cancelled", "refund_refunded"].includes(effectiveKey);
  const ownDelivery = mode === "shipping" && !acceptsCourier;
  const codeEntryVisible =
    isPaymentReady &&
    !finalState &&
    deliveryCodeAllowed(mode, effectiveKey) &&
    (mode === "pickup" || ownDelivery);

  const buyerCoords = useMemo(() => (order ? getOrderBuyerCoordinates(order) : null), [order]);
  const supplierCoords = useMemo(
    () => (order ? getOrderSupplierCoordinates(order) || supplierCoordsFromApi : supplierCoordsFromApi),
    [order, supplierCoordsFromApi],
  );

  const address = useMemo(() => {
    if (!order) return "";
    if (mode === "shipping" && buyerAddress) return buyerAddress;
    return supplierAddress || order.supplier?.name || "Tienda";
  }, [buyerAddress, mode, order, supplierAddress]);

  const markReady = async () => {
    if (!orderId || !isPaymentReady) return;
    setActionLoading("ready");
    try {
      if (mode === "shipping" && acceptsCourier) {
        await orderService.markOrderReadyForCourierPickup(orderId);
      } else if (mode === "shipping") {
        await orderService.startSupplierOrderPreparing(orderId);
      } else {
        await orderService.markOrderReady(orderId);
      }
      setToast({
        type: "success",
        message:
          mode === "pickup"
            ? "Pedido listo para recoger. El cliente ya puede usar su código de entrega."
            : acceptsCourier
              ? "Paquete listo. El repartidor ya puede continuar con la entrega."
              : "Pedido listo para iniciar la entrega.",
      });
      await load();
    } catch (e) {
      setToast({ type: "error", message: getErrorMessage(e, "No se pudo actualizar la orden.") });
    } finally {
      setActionLoading(null);
    }
  };

  const startOwnDelivery = async () => {
    if (!orderId || !ownDelivery || !isPaymentReady) return;
    setActionLoading("out-for-delivery");
    try {
      await orderService.markSupplierOrderOutForDelivery(orderId);
      setToast({ type: "success", message: "Entrega iniciada. Al llegar valida el código del cliente." });
      await load();
    } catch (e) {
      setToast({ type: "error", message: getErrorMessage(e, "No se pudo iniciar la entrega.") });
    } finally {
      setActionLoading(null);
    }
  };

  const confirmDelivery = async () => {
    if (!orderId) return;
    const code = deliveryCode.replace(/\D/g, "").trim();
    if (code.length !== 6) {
      setToast({ type: "error", message: "El código de entrega debe tener 6 dígitos." });
      return;
    }

    setActionLoading("confirm-delivery");
    try {
      await orderService.verifyDeliveryCode(orderId, code);
      setDeliveryCode("");
      setToast({
        type: "success",
        message: "Código correcto. Pedido entregado y ciclo de la orden finalizado.",
      });
      await load();
    } catch (e) {
      setToast({ type: "error", message: getErrorMessage(e, "No se pudo validar el código.") });
    } finally {
      setActionLoading(null);
    }
  };

  const cancelOrder = async () => {
    if (!orderId || finalState) return;
    setActionLoading("cancel");
    try {
      await orderService.updateOrderStatus(orderId, "cancelled");
      setToast({ type: "success", message: "Orden cancelada." });
      await load();
    } catch (e) {
      setToast({ type: "error", message: getErrorMessage(e, "No se pudo cancelar la orden.") });
    } finally {
      setActionLoading(null);
    }
  };

  const approveRefund = async () => {
    if (!orderId || !activeRefund?.id) return;
    setActionLoading("refund-approve");
    try {
      await orderService.approveOrderRefund(orderId, Number(activeRefund.id), refundApproveNote.trim() || undefined);
      setRefundApproveOpen(false);
      setRefundApproveNote("");
      setToast({ type: "success", message: "Reembolso aprobado." });
      await load();
    } catch (e) {
      setToast({ type: "error", message: getErrorMessage(e, "No se pudo aprobar el reembolso.") });
    } finally {
      setActionLoading(null);
    }
  };

  const rejectRefund = async () => {
    if (!orderId || !activeRefund?.id || !refundRejectReason.trim()) return;
    setActionLoading("refund-reject");
    try {
      await orderService.rejectOrderRefund(orderId, Number(activeRefund.id), refundRejectReason.trim());
      setRefundRejectOpen(false);
      setRefundRejectReason("");
      setToast({ type: "success", message: "Reembolso rechazado." });
      await load();
    } catch (e) {
      setToast({ type: "error", message: getErrorMessage(e, "No se pudo rechazar el reembolso.") });
    } finally {
      setActionLoading(null);
    }
  };

  const finalizeRefund = async () => {
    if (!orderId || !activeRefund?.id || !refundFinalizeFile) return;
    setActionLoading("refund-finalize");
    try {
      await orderService.markOrderRefunded(
        orderId,
        Number(activeRefund.id),
        refundFinalizeNote.trim() || undefined,
        refundFinalizeFile,
      );
      setRefundFinalizeOpen(false);
      setRefundFinalizeNote("");
      setRefundFinalizeFile(null);
      setToast({ type: "success", message: "Reembolso finalizado." });
      await load();
    } catch (e) {
      setToast({ type: "error", message: getErrorMessage(e, "No se pudo finalizar el reembolso.") });
    } finally {
      setActionLoading(null);
    }
  };

  if (!authHydrated || loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando orden...
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          No tienes permisos para ver esta página.
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-red-700">
          No se pudo cargar la orden.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 font-[family-name:var(--font-poppins)]">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/admin/orders")}
            className="h-10 w-10 rounded-full border border-gray-200 bg-white flex items-center justify-center"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="text-xs text-gray-500">Detalle de orden</div>
            <div className="text-xl font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
              #DR-{order.id}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-[#004e28]/10 bg-white">
          <div className="bg-[#0b6b3a] p-6 text-white">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
                  {mode === "shipping" ? <Truck className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                  {mode === "shipping" ? "Envío a domicilio" : "Recoger en tienda"}
                </div>
                <h1 className="mt-3 text-3xl font-bold font-[family-name:var(--font-varela-round)]">
                  Orden #DR-{order.id}
                </h1>
                <div className="mt-1 text-sm text-white/70">{date(order.created_at)}</div>
              </div>
              <div className="md:text-right">
                <div className="text-2xl font-black">{money(order.total_amount ?? order.product?.price)}</div>
                <div className="mt-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-sm font-bold">
                  {statusLabel(effectiveKey)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <section className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="flex items-center gap-2 font-bold text-gray-900">
                  <PackageCheck className="h-5 w-5 text-[#004e28]" />
                  Pedido
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 p-4">
                    <div className="text-xs font-semibold text-gray-500">Producto</div>
                    <div className="mt-1 font-bold text-gray-900">{order.product?.title || "Producto"}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-4">
                    <div className="text-xs font-semibold text-gray-500">Total</div>
                    <div className="mt-1 font-bold text-[#004e28]">{money(order.total_amount ?? order.product?.price)}</div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="font-bold text-gray-900">Información del comprador</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold text-gray-500">Nombre</div>
                    <div className="mt-1 text-sm font-semibold">{order.buyer?.name || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-gray-500">Correo</div>
                    <div className="mt-1 text-sm font-semibold">{order.buyer?.email || "—"}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs font-semibold text-gray-500">
                      {mode === "shipping" ? "Dirección de entrega" : "Punto de recolección"}
                    </div>
                    <div className="mt-1 text-sm font-semibold">{address}</div>
                  </div>
                </div>
              </section>

              {mode === "shipping" ? (
                <section className="rounded-2xl border border-gray-100 bg-white p-5">
                  <div className="flex items-center gap-2 font-bold text-gray-900">
                    <MapPin className="h-5 w-5 text-[#004e28]" />
                    Ruta de envío
                  </div>
                  <div className="mt-4">
                    <OrderRouteMap
                      mode={mode}
                      label={address}
                      origin={supplierCoords}
                      destination={buyerCoords}
                      originAddress={supplierAddress}
                      destinationAddress={address}
                    />
                  </div>
                </section>
              ) : null}

              <section className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="font-bold text-gray-900">Historial</div>
                <div className="mt-4 space-y-2">
                  {history.length === 0 ? (
                    <div className="text-sm text-gray-500">Aún no hay movimientos.</div>
                  ) : (
                    [...history]
                      .sort((a, b) => {
                        const ta = new Date(String(a.created_at || a.timestamp || a.date || "")).getTime();
                        const tb = new Date(String(b.created_at || b.timestamp || b.date || "")).getTime();
                        return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
                      })
                      .slice(0, 10)
                      .map((h, index) => (
                        <div key={index} className="rounded-xl border border-gray-100 px-4 py-3">
                          <div className="text-sm font-semibold text-gray-900">
                            {statusLabel(h.status || h.event || h.action || h.description || h.message)}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">{date(h.created_at || h.timestamp || h.date)}</div>
                        </div>
                      ))
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-5">
              <section className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="flex items-center gap-2 font-bold text-gray-900">
                  <CheckCircle className="h-5 w-5 text-[#004e28]" />
                  Acciones de entrega
                </div>

                <div className="mt-4 space-y-3">
                  {!finalState && isPaymentReady && (
                    <button
                      type="button"
                      onClick={markReady}
                      disabled={actionLoading !== null || ["ready_for_pickup", "preparing", "in_transit", "picked_up"].includes(effectiveKey)}
                      className="w-full rounded-xl bg-[#0b6b3a] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {mode === "pickup"
                        ? "Marcar listo para recoger"
                        : acceptsCourier
                          ? "Notificar paquete listo"
                          : "Marcar listo para enviar"}
                    </button>
                  )}

                  {ownDelivery && isPaymentReady && ["preparing", "ready_for_pickup"].includes(effectiveKey) ? (
                    <button
                      type="button"
                      onClick={startOwnDelivery}
                      disabled={actionLoading !== null}
                      className="w-full rounded-xl bg-[#004e28] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                    >
                      <Truck className="mr-2 inline h-4 w-4" />
                      Iniciar entrega
                    </button>
                  ) : null}

                  {acceptsCourier && mode === "shipping" ? (
                    <div className="rounded-xl bg-[#f2f3f4] px-4 py-3 text-xs font-semibold text-gray-600">
                      La entrega se cierra desde la aplicación del repartidor mediante el código del cliente.
                    </div>
                  ) : null}

                  {codeEntryVisible ? (
                    <div className="rounded-2xl border border-[#004e28]/20 bg-[#f2f3f4] p-4">
                      <div className="flex items-center gap-2 text-sm font-bold text-[#004e28]">
                        <KeyRound className="h-4 w-4" />
                        Código de entrega
                      </div>
                      <p className="mt-2 text-xs font-semibold leading-relaxed text-gray-600">
                        Pide al cliente su código de 6 dígitos únicamente cuando ya tenga el pedido.
                        Al validarlo se marca como entregado y se cierra el ciclo.
                      </p>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={deliveryCode}
                        onChange={(e) => setDeliveryCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center font-mono text-xl font-black tracking-[0.25em] outline-none focus:border-[#004e28]"
                      />
                      <button
                        type="button"
                        onClick={confirmDelivery}
                        disabled={actionLoading !== null || deliveryCode.length !== 6}
                        className="mt-3 w-full rounded-xl bg-[#004e28] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {actionLoading === "confirm-delivery" ? (
                          <>
                            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                            Validando...
                          </>
                        ) : (
                          "Validar código y entregar"
                        )}
                      </button>
                    </div>
                  ) : null}

                  {mode === "pickup" ? (
                    <button
                      type="button"
                      onClick={() => downloadPickupTicket(order)}
                      className="w-full rounded-xl border border-[#004e28]/20 bg-white px-4 py-3 text-sm font-bold text-[#004e28]"
                    >
                      Descargar ticket de recogida
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => downloadShippingLabel(order)}
                      className="w-full rounded-xl border border-[#004e28]/20 bg-white px-4 py-3 text-sm font-bold text-[#004e28]"
                    >
                      Descargar etiqueta
                    </button>
                  )}

                  {!finalState ? (
                    <button
                      type="button"
                      onClick={cancelOrder}
                      disabled={actionLoading !== null}
                      className="w-full rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-600 disabled:opacity-50"
                    >
                      Cancelar orden
                    </button>
                  ) : null}
                </div>
              </section>

              <section className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="flex items-center gap-2 font-bold text-gray-900">
                  <BadgeCheck className="h-5 w-5 text-[#004e28]" />
                  Estado del pago
                </div>
                <div className="mt-4 rounded-xl bg-gray-50 p-4">
                  <div className="text-xs font-semibold text-gray-500">Pago</div>
                  <div className="mt-1 font-bold">{statusLabel(paymentKey)}</div>
                </div>
                <div className="mt-3 rounded-xl bg-gray-50 p-4">
                  <div className="text-xs font-semibold text-gray-500">Entrega</div>
                  <div className="mt-1 font-bold">{statusLabel(effectiveKey)}</div>
                </div>
                {order.settlement_status ? (
                  <div className="mt-3 rounded-xl bg-gray-50 p-4">
                    <div className="text-xs font-semibold text-gray-500">Liquidación</div>
                    <div className="mt-1 font-bold">
                      {String(order.settlement_status).toUpperCase() === "RELEASED" ? "Liberada" : "Pendiente de entrega"}
                    </div>
                  </div>
                ) : null}
              </section>

              {activeRefund ? (
                <section className="rounded-2xl border border-gray-100 bg-white p-5">
                  <div className="font-bold text-gray-900">Reembolso</div>
                  <div className="mt-3 text-sm text-gray-600">{activeRefund.reason || "Sin motivo"}</div>
                  <div className="mt-2 text-sm font-bold">{statusLabel(activeRefund.status)}</div>

                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={() => setRefundApproveOpen(true)}
                      className="w-full rounded-xl bg-[#004e28] px-4 py-2.5 text-sm font-bold text-white"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefundRejectOpen(true)}
                      className="w-full rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white"
                    >
                      Rechazar
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefundFinalizeOpen(true)}
                      className="w-full rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-bold text-white"
                    >
                      Finalizar reembolso
                    </button>
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {refundApproveOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="font-bold">Aprobar reembolso</div>
              <button onClick={() => setRefundApproveOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <textarea
              value={refundApproveNote}
              onChange={(e) => setRefundApproveNote(e.target.value)}
              placeholder="Nota opcional"
              className="mt-4 min-h-24 w-full rounded-xl border border-gray-200 p-3"
            />
            <button onClick={approveRefund} className="mt-3 w-full rounded-xl bg-[#004e28] px-4 py-3 font-bold text-white">
              Aprobar
            </button>
          </div>
        </div>
      ) : null}

      {refundRejectOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="font-bold">Rechazar reembolso</div>
              <button onClick={() => setRefundRejectOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <textarea
              value={refundRejectReason}
              onChange={(e) => setRefundRejectReason(e.target.value)}
              placeholder="Motivo obligatorio"
              className="mt-4 min-h-24 w-full rounded-xl border border-gray-200 p-3"
            />
            <button
              onClick={rejectRefund}
              disabled={!refundRejectReason.trim()}
              className="mt-3 w-full rounded-xl bg-red-500 px-4 py-3 font-bold text-white disabled:opacity-50"
            >
              Rechazar
            </button>
          </div>
        </div>
      ) : null}

      {refundFinalizeOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="font-bold">Finalizar reembolso</div>
              <button onClick={() => setRefundFinalizeOpen(false)}><X className="h-4 w-4" /></button>
            </div>
            <textarea
              value={refundFinalizeNote}
              onChange={(e) => setRefundFinalizeNote(e.target.value)}
              placeholder="Nota opcional"
              className="mt-4 min-h-20 w-full rounded-xl border border-gray-200 p-3"
            />
            <div className="mt-4">
              <FileUpload
                label="Comprobante del reembolso"
                value={refundFinalizeFile}
                onChange={setRefundFinalizeFile}
                accept="image/*,application/pdf"
                helperText="Adjunta imagen o PDF"
              />
            </div>
            <button
              onClick={finalizeRefund}
              disabled={!refundFinalizeFile}
              className="mt-3 w-full rounded-xl bg-blue-500 px-4 py-3 font-bold text-white disabled:opacity-50"
            >
              Finalizar reembolso
            </button>
          </div>
        </div>
      ) : null}

      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
