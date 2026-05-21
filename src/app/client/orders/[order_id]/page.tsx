"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { orderService, Order, OrderHistoryItem, OrderRefund } from "@/services/orderService";
import type { LatLngLiteral } from "@/lib/googleMaps";
import {
  fetchSupplierLocation,
  getBuyerAddress,
  getOrderBuyerCoordinates,
  getOrderSupplierCoordinates,
  getSupplierAddress,
} from "@/lib/orderLocation";
import OrderRouteMap from "@/components/orders/OrderRouteMap";
import FileUpload from "@/components/ui/FileUpload";
import { Toast } from "@/components/ui/Toast";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Clock,
  Copy,
  FileText,
  Loader2,
  MapPin,
  PackageCheck,
  Store,
  Truck,
  X,
} from "lucide-react";

type ToastState = null | { type: "success" | "error" | "info"; message: string };

type DeliveryTypeKey = "shipping" | "pickup";
type PaymentMethodKey = "card" | "transfer";

function normalizeStatusKey(value: string) {
  const raw = String(value || "").trim();
  const ascii = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const v = ascii.toLowerCase().trim().replace(/\s+/g, "_");

  if (v === "pending" || v === "pendiente") return "pending";
  if (v === "paid" || v === "pagado" || v === "pago_verificado" || v === "validado" || v === "validated")
    return "paid";
  if (v === "verified" || v === "verificado") return "verified";
  if (v === "completed" || v === "completado" || v === "delivered" || v === "entregado") return "completed";
  if (v === "shipped" || v === "enviado") return "shipped";
  if (v === "rejected" || v === "rechazado" || v === "payment_rejected" || v === "pago_rechazado")
    return "payment_rejected";
  if (v === "cancelled" || v === "cancelado") return "cancelled";
  if (v === "expired" || v === "expirado" || v === "checkout_expired" || v === "checkout_expirado") return "expired";
  if (v === "created" || v === "creado") return "created";
  if (v === "refund_requested" || v === "reembolso_solicitado") return "refund_requested";
  if (
    v === "refund_refunded" ||
    v === "refunded" ||
    v === "reembolsado" ||
    v === "refund_completed" ||
    v === "refund_complete"
  )
    return "refund_refunded";
  if (v === "refund_approved" || v === "reembolso_aprobado") return "refund_approved";
  if (v === "refund_rejected" || v === "reembolso_rechazado") return "refund_rejected";

  if (v === "preparing" || v === "in_preparation" || v === "en_preparacion" || v === "en_preparación") return "preparing";
  if (v === "ready_for_pickup" || v === "ready_pickup" || v === "listo_para_recoger" || v === "listo_para_recojer")
    return "ready_for_pickup";
  if (v === "en_route_to_pickup" || v === "going_to_pickup" || v === "camino_a_recoger") return "en_route_to_pickup";
  if (v === "picked_up" || v === "pickup_completed" || v === "recogido") return "picked_up";
  if (v === "en_route_to_delivery" || v === "out_for_delivery" || v === "camino_a_entregar") return "in_transit";
  if (v === "in_transit" || v === "transit" || v === "en_camino") return "in_transit";

  return v;
}

function getPaymentMethodKey(order: Order | null): PaymentMethodKey {
  if (!order) return "card";
  const anyOrder = order as unknown as Record<string, unknown>;
  const raw = anyOrder.payment_method ?? anyOrder.paymentMethod ?? null;
  const v = String(raw || "").trim().toLowerCase();
  if (v === "transfer" || v === "bank_transfer" || v === "spei") return "transfer";
  return "card";
}

function toEffectiveCardStatusKey(value: string) {
  const k = normalizeStatusKey(value);
  if (k === "expired") return "expired";
  if (k === "created" || k === "pending") return "paid";
  return k;
}

function isExpiredCheckout(order: Order | null) {
  if (!order) return false;
  return [order.status, order.payment_status, order.fulfillment_status, order.visual_status].some(
    (value) => normalizeStatusKey(String(value || "")) === "expired"
  );
}

function toSpanishStatusLabel(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const key = normalizeStatusKey(raw);
  const map: Record<string, string> = {
    created: "Creado",
    pending: "Pendiente",
    paid: "Pago recibido",
    preparing: "En preparación",
    in_transit: "En camino",
    ready_for_pickup: "Listo para recoger",
    en_route_to_pickup: "En camino a recoger",
    picked_up: "Producto recogido",
    shipped: "Enviado",
    completed: "Entregado",
    verified: "Entregado",
    payment_rejected: "Pago rechazado",
    cancelled: "Cancelado",
    expired: "Checkout expirado",
    refund_requested: "Reembolso solicitado",
    refund_approved: "Reembolso aprobado",
    refund_rejected: "Reembolso rechazado",
    refund_refunded: "Reembolsado",
  };
  return map[key] || raw;
}

function formatMoney(value: string | number | null | undefined) {
  const numberValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(String(value).replace(/[^\d.-]/g, "")) : 0;
  const safe = Number.isFinite(numberValue) ? numberValue : 0;
  return safe.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function formatDate(value: string | undefined | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatDeliveryCode(value: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.length === 6 ? `${raw.slice(0, 3)} ${raw.slice(3)}` : raw;
}

function isDeliveryCodeStage(value: string) {
  const k = normalizeStatusKey(value);
  return ["en_route_to_pickup", "picked_up", "in_transit", "completed", "verified"].includes(k);
}

function getDeliveryTypeKey(order: Order): DeliveryTypeKey {
  const anyOrder = order as unknown as Record<string, unknown>;
  const raw =
    anyOrder.delivery_type ??
    anyOrder.deliveryType ??
    anyOrder.shipping_type ??
    anyOrder.shippingType ??
    anyOrder.fulfillment_type ??
    anyOrder.fulfillmentType ??
    null;
  const v = String(raw || "").trim().toLowerCase();
  if (v === "shipping" || v === "delivery" || v === "envio" || v === "envío") return "shipping";
  if (v === "pickup" || v === "store_pickup" || v === "recoger" || v === "recoleccion") return "pickup";

  const statusRaw = String(order.fulfillment_status || order.visual_status || order.status || order.payment_status || "");
  const normalized = normalizeStatusKey(statusRaw);
  if (normalized === "shipped" || normalized === "in_transit") return "shipping";
  return "pickup";
}

function formatEtaLabel(order: Order, mode: DeliveryTypeKey) {
  const created = new Date(order.created_at || "");
  const base = Number.isNaN(created.getTime()) ? new Date() : created;
  const minutesToAdd = mode === "shipping" ? 24 * 60 + 30 : 90;
  const eta = new Date(base.getTime() + minutesToAdd * 60_000);
  const now = new Date();
  const sameDay =
    eta.getFullYear() === now.getFullYear() && eta.getMonth() === now.getMonth() && eta.getDate() === now.getDate();
  const dayLabel = sameDay
    ? "Hoy"
    : eta.toLocaleDateString("es-MX", { weekday: "short", month: "short", day: "2-digit" }).replace(/\.$/, "");
  const timeLabel = eta.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  return `${dayLabel}, ${timeLabel}`;
}

type ProgressStep = { key: string; label: string; Icon: typeof Check };

function getSteps(mode: DeliveryTypeKey): ProgressStep[] {
  return mode === "shipping"
    ? [
        { key: "paid", label: "Pago recibido", Icon: BadgeCheck },
        { key: "preparing", label: "En preparación", Icon: FileText },
        { key: "in_transit", label: "En camino", Icon: Truck },
        { key: "delivered", label: "Entregado", Icon: PackageCheck },
      ]
    : [
        { key: "paid", label: "Pago recibido", Icon: BadgeCheck },
        { key: "preparing", label: "En preparación", Icon: FileText },
        { key: "ready_for_pickup", label: "Listo para recoger", Icon: Store },
        { key: "picked", label: "Entregado", Icon: PackageCheck },
      ];
}

function getProgressRank(mode: DeliveryTypeKey, statusKey: string) {
  const k = normalizeStatusKey(statusKey);
  if (k === "cancelled" || k === "expired") return 0;
  if (k === "refund_refunded") return 4;
  if (k === "refund_requested" || k === "refund_approved" || k === "refund_rejected") return 3;
  if (k === "completed" || k === "verified") return 4;

  if (mode === "shipping") {
    if (k === "in_transit" || k === "shipped" || k === "en_route_to_pickup" || k === "picked_up") return 3;
    if (k === "preparing") return 2;
    if (k === "paid" || k === "created" || k === "pending") return 1;
    return 1;
  }

  if (k === "ready_for_pickup" || k === "shipped" || k === "en_route_to_pickup" || k === "picked_up") return 3;
  if (k === "preparing") return 2;
  if (k === "paid" || k === "created" || k === "pending") return 1;
  return 1;
}

function Stepper({ steps, rank, cancelled }: { steps: ProgressStep[]; rank: number; cancelled: boolean }) {
  const muted = cancelled ? "#9ca3af" : "#004e28";
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        {steps.map((s, idx) => {
          const stepRank = idx + 1;
          const done = !cancelled && rank > stepRank;
          const active = !cancelled && rank === stepRank;
          const Icon = s.Icon;
          const baseColor = cancelled ? muted : done ? "#004e28" : active ? "#16a34a" : "#cbd5e1";
          const bg = cancelled ? "#f3f4f6" : done || active ? `${baseColor}14` : "#f3f4f6";
          return (
            <div key={s.key} className="flex-1 min-w-0">
              <div className="flex items-center justify-center">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center border"
                  style={{
                    backgroundColor: bg,
                    borderColor: cancelled ? "#e5e7eb" : done || active ? `${baseColor}55` : "#e5e7eb",
                  }}
                >
                  <Icon className="h-5 w-5" style={{ color: baseColor }} />
                </div>
              </div>
              <div className="mt-2 text-center text-xs font-semibold text-gray-900 font-[family-name:var(--font-poppins)] truncate">
                {s.label}
              </div>
              <div className="mt-0.5 text-center text-[11px] text-gray-400 font-[family-name:var(--font-poppins)]">
                {cancelled ? "Cancelado" : done ? "Listo" : active ? "Actual" : "Pendiente"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function pickLatestHistoryKey(items: OrderHistoryItem[]) {
  if (!items.length) return "";
  const scored = items
    .map((h) => {
      const rawAt = h.created_at || h.timestamp || h.date || "";
      const at = rawAt ? new Date(rawAt) : null;
      const ts = at && !Number.isNaN(at.getTime()) ? at.getTime() : 0;
      const rawEvent =
        (typeof h.status === "string" && h.status) ||
        (typeof h.event === "string" && h.event) ||
        (typeof h.action === "string" && h.action) ||
        "";
      const description = (h.description || h.message || "").toString().trim();
      const candidate = rawEvent || description;
      return { ts, key: normalizeStatusKey(candidate) };
    })
    .sort((a, b) => b.ts - a.ts);
  return scored[0]?.key || "";
}

function pickLatestRefund(items: OrderRefund[]) {
  if (!items.length) return null;
  const scored = [...items]
    .map((r) => {
      const rawAt = r.updated_at || r.created_at || "";
      const at = rawAt ? new Date(rawAt) : null;
      const ts = at && !Number.isNaN(at.getTime()) ? at.getTime() : 0;
      return { r, ts };
    })
    .sort((a, b) => b.ts - a.ts);
  return scored[0]?.r ?? null;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

export default function ClientOrderDetailPage() {
  const params = useParams<{ order_id?: string }>();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<OrderHistoryItem[]>([]);
  const [refunds, setRefunds] = useState<OrderRefund[]>([]);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundEvidence, setRefundEvidence] = useState<File | null>(null);
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [buyerAddress, setBuyerAddress] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierCoordsFromApi, setSupplierCoordsFromApi] = useState<LatLngLiteral | null>(null);
  const [deliveryCode, setDeliveryCode] = useState<string | null>(null);
  const [deliveryCodeLoading, setDeliveryCodeLoading] = useState(false);
  const [deliveryCodeError, setDeliveryCodeError] = useState<string | null>(null);
  const [focusDeliveryCode, setFocusDeliveryCode] = useState(false);
  const [deliveryCodeHighlighted, setDeliveryCodeHighlighted] = useState(false);
  const deliveryCodeRef = useRef<HTMLDivElement>(null);

  const orderId = useMemo(() => {
    const raw = params?.order_id;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params?.order_id]);

  const closeToast = () => setToast(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const load = useCallback(async () => {
    if (!orderId) {
      setToast({ type: "error", message: "order_id inválido." });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const ord = await orderService.getMyOrderById(orderId);
      setOrder(ord);
      const [h, r] = await Promise.allSettled([
        orderService.getOrderHistory(orderId),
        orderService.getOrderRefunds(orderId),
      ]);
      setHistory(h.status === "fulfilled" ? h.value : []);
      setRefunds(r.status === "fulfilled" ? r.value : []);
      setBuyerAddress(getBuyerAddress(ord));
      setSupplierAddress(getSupplierAddress(ord));
      setSupplierCoordsFromApi(null);

      const supplierId = Number(ord.supplier?.id ?? ord.supplier_id);
      if (Number.isFinite(supplierId) && supplierId > 0) {
        const supplierLocation = await fetchSupplierLocation(supplierId);
        if (supplierLocation.address) setSupplierAddress(supplierLocation.address);
        if (supplierLocation.coordinates) setSupplierCoordsFromApi(supplierLocation.coordinates);
      }
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "No se pudo cargar la orden.");
      setToast({ type: "error", message: msg });
      setOrder(null);
      setHistory([]);
      setRefunds([]);
      setBuyerAddress("");
      setSupplierAddress("");
      setSupplierCoordsFromApi(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setFocusDeliveryCode(params.get("focus") === "delivery-code");
  }, []);

  const latestHistoryKey = useMemo(() => pickLatestHistoryKey(history), [history]);
  const paymentMethod = useMemo(() => getPaymentMethodKey(order), [order]);
  const mode = useMemo(() => (order ? getDeliveryTypeKey(order) : "pickup"), [order]);
  const steps = useMemo(() => getSteps(mode), [mode]);
  const isExpired = isExpiredCheckout(order);
  const statusRaw = order
    ? isExpired
      ? "expired"
      : String(order.fulfillment_status || order.visual_status || order.status || order.payment_status || "")
    : "";
  const mergedKey = isExpired ? "expired" : latestHistoryKey || normalizeStatusKey(statusRaw || "paid");
  const rawEffective =
    paymentMethod === "card" ? toEffectiveCardStatusKey(mergedKey) : normalizeStatusKey(mergedKey);
  const effectiveKey = rawEffective || "paid";
  const cancelled = normalizeStatusKey(effectiveKey) === "cancelled" || isExpired;
  const rank = getProgressRank(mode, effectiveKey);
  const activeRefund = useMemo(() => pickLatestRefund(refunds), [refunds]);
  const deliveryCodeStage = mode === "shipping" && !cancelled && isDeliveryCodeStage(effectiveKey);
  const showDeliveryCodeCard = Boolean(order && !isExpired && deliveryCodeStage);

  const address = useMemo(() => {
    if (!order) return "";
    if (mode === "shipping" && buyerAddress) return buyerAddress;
    const anyOrder = order as unknown as Record<string, unknown>;
    const raw =
      (typeof anyOrder.delivery_address === "string" && anyOrder.delivery_address) ||
      (typeof anyOrder.shipping_address === "string" && anyOrder.shipping_address) ||
      (typeof anyOrder.address === "string" && anyOrder.address) ||
      (typeof anyOrder.pickup_address === "string" && anyOrder.pickup_address) ||
      "";
    const fallback = mode === "shipping" ? order.supplier?.name || "Sucursal" : order.supplier?.name || "Tienda";
    return raw && raw.trim() ? raw.trim() : fallback;
  }, [order, mode, buyerAddress]);
  const routeMapLabel = mode === "pickup" ? supplierAddress || address : address;

  const supplierCoords = useMemo(() => {
    if (!order) return supplierCoordsFromApi;
    return getOrderSupplierCoordinates(order) || supplierCoordsFromApi;
  }, [order, supplierCoordsFromApi]);

  const buyerCoords = useMemo(() => {
    if (!order) return null;
    return getOrderBuyerCoordinates(order);
  }, [order]);

  const canRequestRefund = useMemo(() => {
    if (!order || isExpired) return false;
    const k = normalizeStatusKey(statusRaw);
    return k === "completed" || k === "verified";
  }, [order, statusRaw, isExpired]);

  useEffect(() => {
    if (!orderId || !showDeliveryCodeCard) {
      setDeliveryCode(null);
      setDeliveryCodeError(null);
      return;
    }

    let alive = true;
    setDeliveryCodeLoading(true);
    setDeliveryCodeError(null);
    orderService
      .getOrderDeliveryCode(orderId)
      .then((result) => {
        if (!alive) return;
        setDeliveryCode(result.code);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setDeliveryCode(null);
        setDeliveryCodeError(getErrorMessage(e, "No se pudo cargar el código de entrega."));
      })
      .finally(() => {
        if (alive) setDeliveryCodeLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [orderId, showDeliveryCodeCard]);

  useEffect(() => {
    if (!focusDeliveryCode || !showDeliveryCodeCard || loading) return;
    const scrollId = window.setTimeout(() => {
      deliveryCodeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setDeliveryCodeHighlighted(true);
    }, 150);
    const highlightId = window.setTimeout(() => setDeliveryCodeHighlighted(false), 2600);
    return () => {
      window.clearTimeout(scrollId);
      window.clearTimeout(highlightId);
    };
  }, [focusDeliveryCode, showDeliveryCodeCard, loading]);

  const copyDeliveryCode = async () => {
    if (!deliveryCode) return;
    try {
      await navigator.clipboard.writeText(deliveryCode);
      setToast({ type: "success", message: "Código copiado." });
    } catch {
      setToast({ type: "error", message: "No se pudo copiar el código." });
    }
  };

  const submitRefund = async () => {
    if (!orderId) return;
    const reason = refundReason.trim();
    if (!reason) {
      setToast({ type: "error", message: "Escribe el motivo del reembolso." });
      return;
    }
    setRefundSubmitting(true);
    try {
      await orderService.requestOrderRefund(orderId, reason, refundEvidence);
      setToast({ type: "success", message: "Solicitud de reembolso enviada." });
      setRefundModalOpen(false);
      setRefundReason("");
      setRefundEvidence(null);
      setRefundLoading(true);
      const next = await orderService.getOrderRefunds(orderId);
      setRefunds(next);
      const h = await orderService.getOrderHistory(orderId).catch(() => []);
      setHistory(h);
    } catch (e: unknown) {
      const msg = getErrorMessage(e, "No se pudo solicitar el reembolso.");
      setToast({ type: "error", message: msg });
    } finally {
      setRefundLoading(false);
      setRefundSubmitting(false);
    }
  };

  return (
    <div className="pb-16 font-[family-name:var(--font-poppins)]">
      <div className="container mx-auto px-4 space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando orden...
          </div>
        ) : !order ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            No se pudo cargar la orden.
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
              <div
                className="px-6 py-5 text-white"
                style={{ background: "linear-gradient(135deg, #004e28 0%, #0b6b3a 100%)" }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                    style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
                  >
                    {mode === "shipping" ? (
                      <><Truck className="h-3.5 w-3.5" /> Envío a domicilio</>
                    ) : (
                      <><Store className="h-3.5 w-3.5" /> Recoger en tienda</>
                    )}
                  </span>
                  <span className="text-xs font-semibold text-white/60">
                    #{order.id} • {formatDate(order.created_at)}
                  </span>
                </div>
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-2xl lg:text-3xl font-bold font-[family-name:var(--font-varela-round)] truncate">
                      {order.product?.title || "Producto"}
                    </div>
                    <div className="mt-1 text-white/70 text-sm">
                      {formatMoney(order.total_amount ?? order.product?.price ?? 0)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-bold"
                      style={{
                        backgroundColor: isExpired ? "#f2f3f4" : cancelled ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.15)",
                        color: isExpired ? "#000000" : "#ffffff",
                      }}
                    >
                      {toSpanishStatusLabel(effectiveKey)}
                    </span>
                    <div className="text-right">
                      <div className="text-xs text-white/60">
                        {mode === "shipping" ? "Entrega estimada" : "Recolección"}
                      </div>
                      <div className="flex items-center gap-1.5 justify-end mt-0.5">
                        <Clock className="h-3.5 w-3.5 text-white/70" />
                        <div className="text-sm font-bold text-white">{formatEtaLabel(order, mode)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-white">
                {isExpired ? (
                  <div className="rounded-2xl border border-[#004e28]/25 bg-[#f2f3f4] px-5 py-4 text-black">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#004e28]" />
                      <div>
                        <div className="text-sm font-bold text-[#004e28]">Tu checkout expiró</div>
                        <div className="mt-1 text-sm text-black">
                          La reserva de stock venció porque no se completó el pago a tiempo. Para continuar, volvé a crear la orden.
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Stepper steps={steps} rank={rank} cancelled={cancelled} />
                    {showDeliveryCodeCard ? (
                      <div
                        ref={deliveryCodeRef}
                        className={`rounded-2xl border bg-[#f2f3f4] p-5 transition-all duration-300 ${
                          deliveryCodeHighlighted
                            ? "border-[#168e00] shadow-lg shadow-[#004e28]/20 ring-4 ring-[#168e00]/15"
                            : "border-[#004e28]/20"
                        }`}
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div className="min-w-0">
                            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#004e28]">
                              <Truck className="h-3.5 w-3.5" />
                              {deliveryCodeStage ? "Entrega en curso" : "Código de entrega"}
                            </div>
                            <div className="mt-3 text-sm font-bold text-[#004e28] font-[family-name:var(--font-varela-round)]">
                              Código de entrega
                            </div>
                            <p className="mt-1 text-sm text-gray-600">
                              {mode === "shipping"
                                ? "Compartilo con el repartidor solo cuando recibas tu pedido."
                                : "Mostralo en tienda para retirar tu pedido."}
                            </p>
                          </div>

                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="rounded-2xl border border-[#004e28]/15 bg-white px-5 py-3 text-center min-w-[180px]">
                              {deliveryCodeLoading ? (
                                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-500">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Cargando...
                                </div>
                              ) : deliveryCode ? (
                                <div className="font-mono text-3xl font-black tracking-[0.18em] text-[#004e28]">
                                  {formatDeliveryCode(deliveryCode)}
                                </div>
                              ) : (
                                <div className="text-sm font-semibold text-gray-500">
                                  {deliveryCodeError || "El código estará disponible cuando el repartidor esté en camino."}
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={copyDeliveryCode}
                              disabled={!deliveryCode || deliveryCodeLoading}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#004e28] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#168e00] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Copy className="h-4 w-4" />
                              Copiar código
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                <div className="rounded-2xl border border-gray-100 bg-white p-6">
                  <div className="text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                    Información del comprador
                  </div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs font-semibold text-gray-500">Nombre</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{order.buyer?.name || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500">Correo</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{order.buyer?.email || "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-500">Creado</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{formatDate(order.created_at)}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                      Resumen del producto
                    </div>
                    <div className="text-sm font-bold text-[#004e28]">{formatMoney(order.total_amount ?? order.product?.price ?? 0)}</div>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
                    <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500">
                      <div className="col-span-6">PRODUCTO</div>
                      <div className="col-span-2 text-center">CANT.</div>
                      <div className="col-span-2 text-right">PRECIO</div>
                      <div className="col-span-2 text-right">TOTAL</div>
                    </div>
                    <div className="grid grid-cols-12 px-4 py-4 text-sm text-gray-900">
                      <div className="col-span-6 font-semibold">{order.product?.title || "Producto"}</div>
                      <div className="col-span-2 text-center">1</div>
                      <div className="col-span-2 text-right">{formatMoney(order.product?.price ?? order.total_amount ?? 0)}</div>
                      <div className="col-span-2 text-right font-bold">{formatMoney(order.total_amount ?? order.product?.price ?? 0)}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-6">
                  <div className="text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">Historial</div>
                  <div className="mt-4 space-y-3">
                    {history.length === 0 ? (
                      <div className="text-sm text-gray-500">Aún no hay movimientos.</div>
                    ) : (
                      [...history]
                        .sort((a, b) => {
                          const ad = new Date(a.created_at || a.timestamp || a.date || "").getTime();
                          const bd = new Date(b.created_at || b.timestamp || b.date || "").getTime();
                          return (Number.isFinite(bd) ? bd : 0) - (Number.isFinite(ad) ? ad : 0);
                        })
                        .slice(0, 8)
                        .map((h, idx) => {
                          const label = toSpanishStatusLabel(String(h.status || h.event || h.action || h.description || h.message || "").trim());
                          const at = formatDate(h.created_at || h.timestamp || h.date || "");
                          return (
                            <div key={idx} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900 truncate">{label || "Actualización"}</div>
                                <div className="text-xs text-gray-500 mt-1">{at}</div>
                              </div>
                              <div className="text-xs font-semibold text-gray-500">{h.actor || h.user?.role || ""}</div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl border border-gray-100 bg-white p-6">
                  <div className="flex items-center gap-2 text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                    <Store className="h-4 w-4" style={{ color: "#004e28" }} />
                    Datos de la orden
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <div className="text-xs font-semibold text-gray-500">Estado</div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{toSpanishStatusLabel(effectiveKey)}</div>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <div className="text-xs font-semibold text-gray-500">
                        {mode === "shipping" ? "Dirección de entrega" : "Punto de recolección"}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{address}</div>
                    </div>

                    {mode === "shipping" ? (
                      <>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                          <div className="text-xs font-semibold text-gray-500">Tipo de envío</div>
                          <div className="mt-1 text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                            <Truck className="h-3.5 w-3.5 text-[#004e28]" />
                            Envío a domicilio
                          </div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                          <div className="text-xs font-semibold text-gray-500">Proveedor</div>
                          <div className="mt-1 text-sm font-semibold text-gray-900">
                            {order.supplier?.name || "Sucursal del proveedor"}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                          <div className="text-xs font-semibold text-gray-500">Proveedor</div>
                          <div className="mt-1 text-sm font-semibold text-gray-900">
                            {order.supplier?.name || "Tienda"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                          <div className="text-xs font-semibold text-gray-500">Tipo</div>
                          <div className="mt-1 text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                            <Store className="h-3.5 w-3.5" style={{ color: "#004e28" }} />
                            Recoger en tienda
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-6">
                  <div className="flex items-center gap-2 text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                    <MapPin className="h-4 w-4" style={{ color: "#004e28" }} />
                    {mode === "shipping" ? "Ruta de envío" : "Punto de recolección"}
                  </div>
                  {mode === "shipping" ? (
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="text-xs font-semibold text-gray-400 flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-gray-400" />
                          Origen
                        </div>
                        <div className="mt-1 font-semibold text-gray-900">{order.supplier?.name || "Sucursal"}</div>
                      </div>
                      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="text-xs font-semibold text-gray-400 flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-[#004e28]" />
                          Destino
                        </div>
                        <div className="mt-1 font-semibold text-gray-900">{address}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <div className="text-xs font-semibold text-gray-400 flex items-center gap-1">
                        <Store className="h-3 w-3" />
                        Ubicación de la tienda
                      </div>
                      <div className="mt-1 text-sm font-semibold text-gray-900">{routeMapLabel}</div>
                      <div className="mt-1 text-xs text-gray-400">
                        {order.supplier?.name || "Proveedor"}
                      </div>
                    </div>
                  )}
                  {mode === "shipping" && (
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
                  )}
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-6">
                  <div className="text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">Reembolso</div>
                  <div className="mt-4">
                    {refundLoading ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando...
                      </div>
                    ) : activeRefund ? (
                      <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="text-xs font-semibold text-gray-500">Último estado</div>
                        <div className="mt-1 text-sm font-semibold text-gray-900">
                          {toSpanishStatusLabel(activeRefund.status || effectiveKey)}
                        </div>
                        <div className="mt-2 text-xs text-gray-500">{activeRefund.reason || "—"}</div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">No hay reembolsos registrados.</div>
                    )}

                    {canRequestRefund ? (
                      <button
                        type="button"
                        onClick={() => setRefundModalOpen(true)}
                        className="mt-4 w-full inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                        style={{ backgroundColor: "#ef4444" }}
                      >
                        Solicitar reembolso
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {refundModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4" onClick={() => setRefundModalOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="relative px-6 pt-6 pb-4 border-b border-gray-100">
              <button
                onClick={() => setRefundModalOpen(false)}
                className="absolute right-3 top-3 inline-flex items-center justify-center rounded-full p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                aria-label="Cerrar"
                disabled={refundSubmitting}
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-lg font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">Solicitar reembolso</h3>
              <div className="mt-1 text-sm text-gray-500">Pedido #{orderId ?? "—"}</div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <div className="text-sm font-semibold text-gray-900 mb-2">Motivo</div>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full min-h-[120px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#004e28]/30"
                  placeholder="Describe el motivo del reembolso..."
                  disabled={refundSubmitting}
                />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 mb-2">Evidencia (opcional)</div>
                <FileUpload
                  accept="image/*"
                  value={refundEvidence}
                  disabled={refundSubmitting}
                  onChange={(f) => setRefundEvidence(f)}
                  helperText="Arrastra y suelta o haz clic para seleccionar"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setRefundModalOpen(false)}
                disabled={refundSubmitting}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
                style={{ backgroundColor: "#ffffff", color: "#111827", border: "1px solid #e5e7eb" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitRefund}
                disabled={refundSubmitting}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: "#ef4444" }}
              >
                {refundSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  "Confirmar"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <Toast type={toast.type} message={toast.message} onClose={closeToast} /> : null}
    </div>
  );
}
