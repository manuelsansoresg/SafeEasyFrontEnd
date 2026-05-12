"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { orderService, Order, OrderHistoryItem, OrderRefund } from "@/services/orderService";
import { downloadPickupTicket, downloadShippingLabel } from "@/lib/pickupTicket";
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
  ArrowLeft,
  BadgeCheck,
  Check,
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  MapPin,
  PackageCheck,
  Phone,
  Star,
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
  if (v === "cancelled" || v === "cancelado") return "cancelled";

  if (v === "expired" || v === "expirado" || v === "vencido") return "expired";
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
  if (k === "created" || k === "pending") return "paid";
  return k;
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
    shipped: "Enviado",
    completed: "Entregado",
    verified: "Entregado",
    cancelled: "Cancelado",
    expired: "Expirado",
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

function getImageUrl(path: string | null | undefined) {
  if (!path) return "/placeholder.png";
  if (path.startsWith("http") || path.startsWith("https") || path.startsWith("data:")) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api").replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`.replace(/([^:])\/{2,}/g, "$1/");
}

function formatDate(value: string | undefined | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
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
  if (k === "cancelled") return 0;
  if (k === "refund_refunded") return 4;
  if (k === "refund_requested" || k === "refund_approved" || k === "refund_rejected") return 3;
  if (k === "completed" || k === "verified") return 4;

  if (mode === "shipping") {
    if (k === "in_transit" || k === "shipped") return 3;
    if (k === "preparing") return 2;
    if (k === "paid" || k === "created" || k === "pending") return 1;
    return 1;
  }

  if (k === "ready_for_pickup" || k === "shipped") return 3;
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
              <div className="mt-2 text-center text-xs font-semibold text-gray-900 truncate">{s.label}</div>
              <div className="mt-0.5 text-center text-[11px] text-gray-400">{cancelled ? "Cancelado" : done ? "Listo" : active ? "Actual" : "Pendiente"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getOrderItems(order: Order | null): Array<Record<string, unknown>> {
  if (!order) return [];
  const anyOrder = order as unknown as Record<string, unknown>;
  const candidates = [
    anyOrder.items,
    anyOrder.order_items,
    anyOrder.orderItems,
    anyOrder.products,
    anyOrder.lines,
    anyOrder.line_items,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c as Array<Record<string, unknown>>;
  }
  return [];
}

function normalizePhone(value: unknown) {
  const v = typeof value === "string" ? value.trim() : "";
  return v || "—";
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

export default function AdminOrderDetailPage() {
  const params = useParams<{ order_id?: string }>();
  const router = useRouter();
  const { user, token } = useAuthStore();
  const roleKey = String(user?.role || "").toLowerCase();
  const canViewOrdersPage = roleKey === "admin" || roleKey === "superuser" || roleKey === "supplier";

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<OrderHistoryItem[]>([]);
  const [refunds, setRefunds] = useState<OrderRefund[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [buyerAddress, setBuyerAddress] = useState<string>("");
  const [supplierAddress, setSupplierAddress] = useState<string>("");
  const [supplierCoordsFromApi, setSupplierCoordsFromApi] = useState<LatLngLiteral | null>(null);

  const [refundApproveOpen, setRefundApproveOpen] = useState(false);
  const [refundRejectOpen, setRefundRejectOpen] = useState(false);
  const [refundFinalizeOpen, setRefundFinalizeOpen] = useState(false);
  const [refundApproveNote, setRefundApproveNote] = useState("");
  const [refundRejectReason, setRefundRejectReason] = useState("");
  const [refundFinalizeNote, setRefundFinalizeNote] = useState("");
  const [refundFinalizeFile, setRefundFinalizeFile] = useState<File | null>(null);

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
    if (!token) {
      setToast({ type: "error", message: "Sesión no válida." });
      setLoading(false);
      return;
    }
    if (!orderId) {
      setToast({ type: "error", message: "order_id inválido." });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const ord = await orderService.getOrderById(orderId);
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
    } catch (e) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as any).message) : "No se pudo cargar la orden.";
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
  }, [orderId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const latestHistoryKey = useMemo(() => pickLatestHistoryKey(history), [history]);
  const paymentMethod = useMemo(() => getPaymentMethodKey(order), [order]);
  const mode = useMemo(() => (order ? getDeliveryTypeKey(order) : "pickup"), [order]);
  const steps = useMemo(() => getSteps(mode), [mode]);
  const statusRaw = order
    ? String(order.fulfillment_status || order.visual_status || order.status || order.payment_status || "")
    : "";
  const mergedKey = latestHistoryKey || normalizeStatusKey(statusRaw || "paid");
  const rawEffective =
    paymentMethod === "card" ? toEffectiveCardStatusKey(mergedKey) : normalizeStatusKey(mergedKey);
  const effectiveKey = rawEffective || "paid";
  const cancelled = normalizeStatusKey(effectiveKey) === "cancelled";
  const rank = getProgressRank(mode, effectiveKey);
  const activeRefund = useMemo(() => pickLatestRefund(refunds), [refunds]);

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

  const refresh = async () => {
    await load();
  };

  const applyStatus = async (next: string) => {
    if (!orderId) return;
    setActionLoading(next);
    try {
      await orderService.updateOrderStatus(orderId, next);
      setToast({ type: "success", message: "Estado actualizado." });
      await refresh();
    } catch (e) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as any).message) : "No se pudo actualizar el estado.";
      setToast({ type: "error", message: msg });
    } finally {
      setActionLoading(null);
    }
  };

  const paymentStatusKey = useMemo(() => {
    const raw = String(order?.payment_status || order?.status || "").trim();
    return normalizeStatusKey(raw || "pending");
  }, [order]);

  const isPaymentPaid = useMemo(() => paymentStatusKey === "paid", [paymentStatusKey]);

  const handleMarkReady = async () => {
    if (!orderId) return;
    if (!isPaymentPaid) {
      setToast({ type: "error", message: "Solo puedes marcar como listo cuando el pago esté confirmado." });
      return;
    }
    setActionLoading("mark-ready");
    try {
      await orderService.markOrderReady(orderId, mode);
      const msg = mode === "shipping"
        ? "Orden marcada como lista para envío."
        : "Orden marcada como lista para recoger.";
      setToast({ type: "success", message: msg });
      await refresh();
    } catch (e) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as any).message) : "No se pudo marcar como lista.";
      setToast({ type: "error", message: msg });
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (note?: string) => {
    if (!orderId) return;
    if (!isPaymentPaid) {
      setToast({ type: "error", message: "Solo puedes completar la orden cuando el pago esté confirmado." });
      return;
    }
    setActionLoading("complete");
    try {
      await orderService.completeOrder(orderId, note);
      setToast({ type: "success", message: "Orden completada." });
      await refresh();
    } catch (e) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as any).message) : "No se pudo completar la orden.";
      setToast({ type: "error", message: msg });
    } finally {
      setActionLoading(null);
    }
  };

  const submitRefundApprove = async () => {
    if (!orderId || !activeRefund?.id) return;
    setActionLoading("refund_approve");
    try {
      await orderService.approveOrderRefund(orderId, Number(activeRefund.id), refundApproveNote.trim() || undefined);
      setToast({ type: "success", message: "Reembolso aprobado." });
      setRefundApproveOpen(false);
      setRefundApproveNote("");
      await refresh();
    } catch (e) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as any).message) : "No se pudo aprobar el reembolso.";
      setToast({ type: "error", message: msg });
    } finally {
      setActionLoading(null);
    }
  };

  const submitRefundReject = async () => {
    if (!orderId || !activeRefund?.id) return;
    const reason = refundRejectReason.trim();
    if (!reason) return;
    setActionLoading("refund_reject");
    try {
      await orderService.rejectOrderRefund(orderId, Number(activeRefund.id), reason);
      setToast({ type: "success", message: "Reembolso rechazado." });
      setRefundRejectOpen(false);
      setRefundRejectReason("");
      await refresh();
    } catch (e) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as any).message) : "No se pudo rechazar el reembolso.";
      setToast({ type: "error", message: msg });
    } finally {
      setActionLoading(null);
    }
  };

  const submitRefundFinalize = async () => {
    if (!orderId || !activeRefund?.id) return;
    if (!refundFinalizeFile) {
      setToast({ type: "error", message: "Adjunta el comprobante del reembolso." });
      return;
    }
    setActionLoading("refund_finalize");
    try {
      await orderService.markOrderRefunded(
        orderId,
        Number(activeRefund.id),
        refundFinalizeNote.trim() || undefined,
        refundFinalizeFile,
      );
      setToast({ type: "success", message: "Reembolso finalizado." });
      setRefundFinalizeOpen(false);
      setRefundFinalizeNote("");
      setRefundFinalizeFile(null);
      await refresh();
    } catch (e) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as any).message) : "No se pudo finalizar el reembolso.";
      setToast({ type: "error", message: msg });
    } finally {
      setActionLoading(null);
    }
  };

  const showRefundPanel =
    Boolean(activeRefund) ||
    normalizeStatusKey(effectiveKey) === "refund_requested" ||
    normalizeStatusKey(effectiveKey) === "refund_approved" ||
    normalizeStatusKey(effectiveKey) === "refund_rejected" ||
    normalizeStatusKey(effectiveKey) === "refund_refunded";

  const canMarkDelivered = useMemo(() => {
    const k = normalizeStatusKey(effectiveKey);
    return k !== "completed" && k !== "verified" && k !== "cancelled" && k !== "refund_refunded";
  }, [effectiveKey]);

  const isReadyForPickup = useMemo(() => {
    const k = normalizeStatusKey(effectiveKey);
    return k === "ready_for_pickup";
  }, [effectiveKey]);

  const canMarkShipped = useMemo(() => {
    const k = normalizeStatusKey(effectiveKey);
    if (k === "completed" || k === "verified" || k === "cancelled" || k === "refund_refunded") return false;
    if (k === "shipped" || k === "in_transit") return false;
    if (k === "ready_for_pickup") return false;
    return true;
  }, [effectiveKey]);

  const canCancel = useMemo(() => {
    const k = normalizeStatusKey(effectiveKey);
    return k !== "completed" && k !== "verified" && k !== "cancelled" && k !== "refund_refunded";
  }, [effectiveKey]);

  const items = useMemo(() => getOrderItems(order), [order]);

  const buyerDoc = useMemo(() => {
    const anyBuyer = order?.buyer as unknown as Record<string, unknown> | undefined;
    const raw =
      (anyBuyer && (anyBuyer.document as unknown)) ||
      (anyBuyer && (anyBuyer.document_id as unknown)) ||
      (anyBuyer && (anyBuyer.identification as unknown)) ||
      (anyBuyer && (anyBuyer.cc as unknown)) ||
      null;
    const v = typeof raw === "string" ? raw.trim() : "";
    return v || "—";
  }, [order]);

  const buyerPhone = useMemo(() => {
    const anyBuyer = order?.buyer as unknown as Record<string, unknown> | undefined;
    const raw =
      (anyBuyer && (anyBuyer.phone as unknown)) ||
      (anyBuyer && (anyBuyer.telefono as unknown)) ||
      (anyBuyer && (anyBuyer.contact_phone as unknown)) ||
      null;
    return normalizePhone(raw);
  }, [order]);

  const supplierCoords = useMemo(() => {
    if (!order) return supplierCoordsFromApi;
    return getOrderSupplierCoordinates(order) || supplierCoordsFromApi;
  }, [order, supplierCoordsFromApi]);

  const buyerCoords = useMemo(() => {
    if (!order) return null;
    return getOrderBuyerCoordinates(order);
  }, [order]);

  const shippingCost = useMemo(() => {
    const v = (order as any)?.shipping_cost ?? (order as any)?.shippingCost ?? null;
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(String(v).replace(/[^\d.-]/g, "")) : 0;
    return Number.isFinite(n) ? n : 0;
  }, [order]);

  const totalAmount = useMemo(() => {
    const v = (order as any)?.total_amount ?? order?.product?.price ?? 0;
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(String(v).replace(/[^\d.-]/g, "")) : 0;
    return Number.isFinite(n) ? n : 0;
  }, [order]);

  const subtotalAmount = useMemo(() => {
    if (mode !== "shipping") return totalAmount;
    const subtotal = totalAmount - shippingCost;
    return subtotal > 0 ? subtotal : 0;
  }, [mode, totalAmount, shippingCost]);

  const shippingHeaderStatus = useMemo(() => {
    const k = normalizeStatusKey(effectiveKey);
    if (k === "in_transit" || k === "shipped") return "Enviando";
    if (k === "ready_for_pickup") return "Listo para recoger";
    if (k === "preparing") return "En preparación";
    if (k === "paid") return "Pago confirmado";
    if (k === "completed" || k === "verified") return "Entregado";
    if (k === "cancelled") return "Cancelado";
    if (k === "expired") return "Expirado";
    return toSpanishStatusLabel(effectiveKey);
  }, [effectiveKey]);

  const courierMeta = useMemo(() => {
    const anyOrder = order as unknown as Record<string, unknown> | null;
    const raw =
      (anyOrder && (anyOrder.courier as unknown)) ||
      (anyOrder && (anyOrder.courier_user as unknown)) ||
      (anyOrder && (anyOrder.courierUser as unknown)) ||
      null;
    const courier = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
    const name =
      (courier && typeof courier.name === "string" && courier.name) ||
      (courier && typeof courier.full_name === "string" && courier.full_name) ||
      (courier && typeof courier.username === "string" && courier.username) ||
      "";
    const vehicle =
      (courier && typeof courier.vehicle === "string" && courier.vehicle) ||
      (courier && typeof courier.vehicle_type === "string" && courier.vehicle_type) ||
      (courier && typeof courier.transport === "string" && courier.transport) ||
      "";
    const plate =
      (courier && typeof courier.plate === "string" && courier.plate) ||
      (courier && typeof courier.license_plate === "string" && courier.license_plate) ||
      "";
    const ratingRaw =
      (courier && (courier.rating as unknown)) ||
      (courier && (courier.score as unknown)) ||
      null;
    const rating =
      typeof ratingRaw === "number"
        ? ratingRaw
        : typeof ratingRaw === "string"
          ? Number(String(ratingRaw).replace(/[^\d.-]/g, ""))
          : NaN;
    const phone = courier ? normalizePhone(courier.phone) : "—";
    return {
      name: name || "—",
      vehicle: vehicle || "—",
      plate: plate || "—",
      rating: Number.isFinite(rating) ? rating : 4.9,
      phone,
    };
  }, [order]);

  return (
    <div className="p-6 font-[family-name:var(--font-poppins)]">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/admin/orders")}
            className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-white border border-gray-200 hover:bg-gray-50"
            aria-label="Volver a órdenes"
            title="Volver a órdenes"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="min-w-0">
            <div className="text-xs text-gray-500">Volver a órdenes</div>
            <div className="text-lg font-bold text-gray-900 font-[family-name:var(--font-varela-round)] truncate">
              {order ? `#DR-${order.id}` : "Detalle de Orden"}
            </div>
          </div>
        </div>

        {!canViewOrdersPage ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-red-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            No tienes permisos para ver esta página.
          </div>
        ) : loading ? (
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
            {mode === "pickup" ? (
              <>
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-2xl lg:text-3xl font-bold text-gray-900 font-[family-name:var(--font-varela-round)] truncate">
                        Orden #{`DR-${order.id}`}
                      </div>
                      <span
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                        style={{
                          backgroundColor: cancelled ? "#ef444414" : isPaymentPaid ? "#16a34a14" : "#f59e0b14",
                          color: cancelled ? "#ef4444" : isPaymentPaid ? "#16a34a" : "#b45309",
                          border: `1px solid ${cancelled ? "#ef444433" : isPaymentPaid ? "#16a34a33" : "#f59e0b33"}`,
                        }}
                      >
                        {cancelled ? "Cancelado" : isPaymentPaid ? "Pago Confirmado" : "Pago Pendiente"}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500 flex items-center gap-2">
                      <Store className="h-4 w-4 text-gray-400" />
                      Recogida en Tienda • {order.supplier?.name || "Sucursal"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-2xl border border-gray-100 bg-white p-6">
                      <div className="flex items-center gap-2 text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                        <Store className="h-4 w-4 text-[#004e28]" />
                        Información del Comprador
                      </div>
                      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <div className="text-[11px] font-semibold tracking-wider text-gray-400">NOMBRE COMPLETO</div>
                          <div className="mt-1 text-sm font-semibold text-gray-900">{order.buyer?.name || "—"}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold tracking-wider text-gray-400">DOCUMENTO DE IDENTIDAD</div>
                          <div className="mt-1 text-sm font-semibold text-gray-900">{buyerDoc}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold tracking-wider text-gray-400">TELÉFONO DE CONTACTO</div>
                          <div className="mt-1 text-sm font-semibold text-gray-900">{buyerPhone}</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold tracking-wider text-gray-400">CORREO ELECTRÓNICO</div>
                          <div className="mt-1 text-sm font-semibold text-gray-900">{order.buyer?.email || "—"}</div>
                        </div>
                        <div className="md:col-span-2">
                          <div className="text-[11px] font-semibold tracking-wider text-gray-400">DIRECCIÓN DE ENTREGA</div>
                          <div className="mt-1 text-sm font-semibold text-gray-900">{buyerAddress || "—"}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-6">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                          <PackageCheck className="h-4 w-4 text-[#004e28]" />
                          Resumen de Productos
                        </div>
                        <div className="text-sm font-bold text-[#004e28]">{formatMoney(totalAmount)}</div>
                      </div>

                      <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
                        <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500">
                          <div className="col-span-7">PRODUCTO</div>
                          <div className="col-span-2 text-center">CANTIDAD</div>
                          <div className="col-span-3 text-right">TOTAL</div>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {(items.length ? items : [order as unknown as Record<string, unknown>]).map((it, idx) => {
                            const rawProduct = (it.product && typeof it.product === "object" ? it.product : null) as Record<string, unknown> | null;
                            const title =
                              (rawProduct && typeof rawProduct.title === "string" && rawProduct.title) ||
                              (typeof it.product_title === "string" && it.product_title) ||
                              order.product?.title ||
                              "Producto";
                            const imagePath =
                              (rawProduct && typeof rawProduct.thumbnail_url === "string" && rawProduct.thumbnail_url) ||
                              (rawProduct && typeof rawProduct.image === "string" && rawProduct.image) ||
                              order.product?.thumbnail_url ||
                              order.product?.image ||
                              null;
                            const qtyRaw = (it.quantity as unknown) ?? (it.qty as unknown) ?? 1;
                            const qty = typeof qtyRaw === "number" ? qtyRaw : typeof qtyRaw === "string" ? Number(qtyRaw) : 1;
                            const unitRaw =
                              (it.unit_price as unknown) ??
                              (it.price as unknown) ??
                              (rawProduct && (rawProduct.price as unknown)) ??
                              (order.product?.price as unknown) ??
                              0;
                            const unit =
                              typeof unitRaw === "number" ? unitRaw : typeof unitRaw === "string" ? Number(String(unitRaw).replace(/[^\d.-]/g, "")) : 0;
                            const lineTotal = Number.isFinite(unit) ? unit * (Number.isFinite(qty) ? qty : 1) : 0;
                            return (
                              <div key={idx} className="grid grid-cols-12 px-4 py-4 text-sm text-gray-900 items-center">
                                <div className="col-span-7">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="h-10 w-10 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                                      <img
                                        src={getImageUrl(imagePath)}
                                        alt={title}
                                        className="h-full w-full object-cover"
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-semibold truncate">{title}</div>
                                      <div className="text-xs text-gray-400 truncate">{order.supplier?.name || ""}</div>
                                    </div>
                                  </div>
                                </div>
                                <div className="col-span-2 text-center">{Number.isFinite(qty) ? qty : 1}</div>
                                <div className="col-span-3 text-right font-bold">{formatMoney(lineTotal || unit || 0)}</div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="px-4 py-4 bg-white">
                          <div className="flex justify-end">
                            <div className="text-right">
                              <div className="text-xs text-gray-500 font-semibold">Subtotal</div>
                              <div className="mt-1 text-base font-bold text-gray-900">{formatMoney(subtotalAmount)}</div>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-end">
                            <div className="text-right">
                              <div className="text-xs font-semibold text-gray-500">Total a Cobrar</div>
                              <div className="mt-1 text-lg font-bold" style={{ color: "#004e28" }}>
                                {formatMoney(totalAmount)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-2xl border border-gray-100 bg-white p-6">
                      <div className="flex items-center gap-2 text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                        <CheckCircle className="h-4 w-4 text-[#004e28]" />
                        Acciones de Entrega
                      </div>
                      <div className="mt-4 space-y-3">
                        <button
                          type="button"
                          disabled={actionLoading !== null || !isPaymentPaid}
                          onClick={handleMarkReady}
                          className="w-full inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                          style={{ backgroundColor: "#0b6b3a" }}
                        >
                          <Store className="h-4 w-4 mr-2" />
                          Marcar como listo para recoger
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading !== null || !isPaymentPaid}
                          onClick={() => handleComplete()}
                          className="w-full inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                          style={{ backgroundColor: "#004e28" }}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Marcar como Entregado
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await downloadPickupTicket(order);
                          }}
                          className="w-full inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold"
                          style={{ backgroundColor: "#ffffff", color: "#004e28", border: "1px solid #004e2833" }}
                        >
                          Descargar Ticket de Recogida
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-5">
                      <div className="text-sm">
                        <span className="font-bold" style={{ color: "#004e28" }}>Nota:</span>{" "}
                        <span className="text-gray-600">
                          Al marcar como entregado, se notificará automáticamente al cliente y se cerrará el ciclo logístico de este pedido.
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-5">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Fecha de Orden:</span>
                          <span className="font-semibold text-gray-900">{formatDate(order.created_at)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-400">Método:</span>
                          <span className="font-semibold text-gray-900">Recogida Local</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-5">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#004e2814" }}>
                          <MapPin className="h-5 w-5 text-[#004e28]" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900">{order.supplier?.name || "Sucursal"}</div>
                          <div className="mt-0.5 text-xs text-gray-500 truncate">{address}</div>
                        </div>
                      </div>
                    </div>

                    {showRefundPanel ? (
                      <div className="rounded-2xl border border-gray-100 bg-white p-6">
                        <div className="text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">Reembolso</div>
                        <div className="mt-3 text-sm text-gray-700">
                          Estado: <span className="font-semibold">{toSpanishStatusLabel(activeRefund?.status || effectiveKey)}</span>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">{activeRefund?.reason || "—"}</div>
                        <div className="mt-4 flex flex-col gap-2">
                          <button
                            type="button"
                            disabled={actionLoading !== null || !activeRefund?.id}
                            onClick={() => setRefundApproveOpen(true)}
                            className="w-full inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                            style={{ backgroundColor: "#004e28" }}
                          >
                            Aprobar reembolso
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading !== null || !activeRefund?.id}
                            onClick={() => setRefundRejectOpen(true)}
                            className="w-full inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                            style={{ backgroundColor: "#ef4444" }}
                          >
                            Rechazar reembolso
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading !== null || !activeRefund?.id}
                            onClick={() => setRefundFinalizeOpen(true)}
                            className="w-full inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                            style={{ backgroundColor: "#3b82f6" }}
                          >
                            Finalizar reembolso
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-2xl font-bold text-gray-900 font-[family-name:var(--font-varela-round)] truncate">
                      Detalle de Orden #{`DR-${order.id}`}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
                      <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />
                      <span className="font-semibold">Estado:</span>
                      <span className="font-semibold text-green-700">{shippingHeaderStatus}</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">{formatDate(order.created_at)}</div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                  <div className="lg:col-span-3 space-y-6">
                    <OrderRouteMap
                      mode={mode}
                      label={address}
                      origin={supplierCoords}
                      destination={buyerCoords}
                      originAddress={supplierAddress}
                      destinationAddress={address}
                    />

                    <div className="rounded-2xl border border-gray-100 bg-white p-6">
                      <div className="flex items-center justify-between gap-4">
                        <div className="text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                          Información del Repartidor
                        </div>
                        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: "#16a34a14", color: "#16a34a", border: "1px solid #16a34a33" }}>
                          ESPERANDO REPARTIDOR
                        </span>
                      </div>

                      <div className="mt-5 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        <div className="md:col-span-4 flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400">
                            <Truck className="h-6 w-6" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-gray-400">REPARTIDOR</div>
                            <div className="mt-0.5 text-sm font-bold text-gray-900 truncate">{courierMeta.name}</div>
                          </div>
                        </div>

                        <div className="md:col-span-6 grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <div className="text-xs font-semibold text-gray-400">VEHÍCULO</div>
                            <div className="mt-0.5 font-semibold text-gray-900">{courierMeta.vehicle}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-gray-400">PLACA</div>
                            <div className="mt-0.5 font-semibold text-gray-900">{courierMeta.plate}</div>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-gray-400">CALIFICACIÓN</div>
                            <div className="mt-0.5 font-semibold text-gray-900 flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500" />
                              {courierMeta.rating.toFixed(1)}
                            </div>
                          </div>
                        </div>

                        <div className="md:col-span-2 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="h-10 w-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 inline-flex items-center justify-center"
                            aria-label="Llamar"
                            title="Llamar"
                          >
                            <Phone className="h-5 w-5 text-[#004e28]" />
                          </button>
                          <button
                            type="button"
                            className="h-10 w-10 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 inline-flex items-center justify-center"
                            aria-label="Mensaje"
                            title="Mensaje"
                          >
                            <FileText className="h-5 w-5 text-[#004e28]" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-6">
                      <div className="text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                        Resumen de Productos
                      </div>
                      <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
                        <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500">
                          <div className="col-span-6">PRODUCTO</div>
                          <div className="col-span-2">SKU</div>
                          <div className="col-span-2 text-center">CANTIDAD</div>
                          <div className="col-span-2 text-right">TOTAL</div>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {(items.length ? items : [order as unknown as Record<string, unknown>]).map((it, idx) => {
                            const rawProduct = (it.product && typeof it.product === "object" ? it.product : null) as Record<string, unknown> | null;
                            const title =
                              (rawProduct && typeof rawProduct.title === "string" && rawProduct.title) ||
                              (typeof it.product_title === "string" && it.product_title) ||
                              order.product?.title ||
                              "Producto";
                            const sku =
                              (typeof it.sku === "string" && it.sku) ||
                              (rawProduct && typeof rawProduct.sku === "string" ? (rawProduct.sku as string) : "") ||
                              "—";
                            const qtyRaw = (it.quantity as unknown) ?? (it.qty as unknown) ?? 1;
                            const qty = typeof qtyRaw === "number" ? qtyRaw : typeof qtyRaw === "string" ? Number(qtyRaw) : 1;
                            const unitRaw =
                              (it.unit_price as unknown) ??
                              (it.price as unknown) ??
                              (rawProduct && (rawProduct.price as unknown)) ??
                              (order.product?.price as unknown) ??
                              0;
                            const unit =
                              typeof unitRaw === "number" ? unitRaw : typeof unitRaw === "string" ? Number(String(unitRaw).replace(/[^\d.-]/g, "")) : 0;
                            const lineTotal = Number.isFinite(unit) ? unit * (Number.isFinite(qty) ? qty : 1) : 0;
                            return (
                              <div key={idx} className="grid grid-cols-12 px-4 py-4 text-sm text-gray-900">
                                <div className="col-span-6 font-semibold">{title}</div>
                                <div className="col-span-2 text-gray-500">{sku}</div>
                                <div className="col-span-2 text-center">{Number.isFinite(qty) ? qty : 1}</div>
                                <div className="col-span-2 text-right font-bold">{formatMoney(lineTotal || unit || 0)}</div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="px-4 py-4">
                          <div className="flex items-center justify-end gap-10 text-sm">
                            <div className="text-right">
                              <div className="text-xs text-gray-500 font-semibold">Subtotal</div>
                              <div className="mt-1 font-bold text-gray-900">{formatMoney(subtotalAmount)}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-500 font-semibold">Costo de Envío</div>
                              <div className="mt-1 font-bold text-gray-900">{formatMoney(shippingCost)}</div>
                            </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-end">
                            <div className="text-right">
                              <div className="text-xs font-semibold text-gray-500">TOTAL DEL PEDIDO</div>
                              <div className="mt-1 text-2xl font-bold" style={{ color: "#0b6b3a" }}>
                                {formatMoney(totalAmount)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-2xl border border-gray-100 bg-white p-6">
                      <div className="text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">Gestión de Orden</div>
                      <div className="mt-4 space-y-3">
                        {isReadyForPickup ? (
                          <div className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ backgroundColor: "#16a34a" }}>
                            <CheckCircle className="h-4 w-4" />
                            Listo para que lo retire el repartidor
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={actionLoading !== null || !canMarkShipped}
                            onClick={handleMarkReady}
                            className="w-full inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                            style={{ backgroundColor: "#0b6b3a" }}
                          >
                            <Truck className="h-4 w-4 mr-2" />
                            Cambiar a "Listo para recoger"
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            await downloadShippingLabel(order);
                          }}
                          className="w-full inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold"
                          style={{ backgroundColor: "#ffffff", color: "#0b6b3a", border: "1px solid #0b6b3a33" }}
                        >
                          Descargar etiqueta
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading !== null || !canCancel}
                          onClick={() => applyStatus("cancelled")}
                          className="w-full inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold"
                          style={{ backgroundColor: "#ffffff", color: "#ef4444", border: "1px solid #ef444433" }}
                        >
                          Cancelar orden
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-6">
                      <div className="text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">Datos del Comprador</div>
                      <div className="mt-4 space-y-4">
                        <div>
                          <div className="text-xs text-gray-400 font-semibold">NOMBRE</div>
                          <div className="mt-1 text-sm font-semibold text-gray-900">{order.buyer?.name || "—"}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 font-semibold">DIRECCIÓN DE ENTREGA</div>
                          <div className="mt-1 text-sm font-semibold text-gray-900">{buyerAddress || address}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-400 font-semibold">TELÉFONO</div>
                          <div className="mt-1 text-sm font-semibold text-gray-900">{buyerPhone}</div>
                        </div>
                      </div>
                    </div>

                    {showRefundPanel ? (
                      <div className="rounded-2xl border border-gray-100 bg-white p-6">
                        <div className="text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">Reembolso</div>
                        <div className="mt-3 text-sm text-gray-700">
                          Estado: <span className="font-semibold">{toSpanishStatusLabel(activeRefund?.status || effectiveKey)}</span>
                        </div>
                        <div className="mt-2 text-xs text-gray-500">{activeRefund?.reason || "—"}</div>
                        <div className="mt-4 flex flex-col gap-2">
                          <button
                            type="button"
                            disabled={actionLoading !== null || !activeRefund?.id}
                            onClick={() => setRefundApproveOpen(true)}
                            className="w-full inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                            style={{ backgroundColor: "#004e28" }}
                          >
                            Aprobar reembolso
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading !== null || !activeRefund?.id}
                            onClick={() => setRefundRejectOpen(true)}
                            className="w-full inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                            style={{ backgroundColor: "#ef4444" }}
                          >
                            Rechazar reembolso
                          </button>
                          <button
                            type="button"
                            disabled={actionLoading !== null || !activeRefund?.id}
                            onClick={() => setRefundFinalizeOpen(true)}
                            className="w-full inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                            style={{ backgroundColor: "#3b82f6" }}
                          >
                            Finalizar reembolso
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {refundApproveOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4" onClick={() => setRefundApproveOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">Aprobar reembolso</div>
              <button
                onClick={() => setRefundApproveOpen(false)}
                disabled={actionLoading !== null}
                className="inline-flex items-center justify-center rounded-full p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Nota (opcional)</label>
              <textarea
                value={refundApproveNote}
                onChange={(e) => setRefundApproveNote(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#004e28]/20 focus:border-[#004e28]/40"
                placeholder="Agrega una nota si aplica..."
                disabled={actionLoading !== null}
              />
              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  onClick={() => setRefundApproveOpen(false)}
                  disabled={actionLoading !== null}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 border border-gray-200 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitRefundApprove}
                  disabled={actionLoading !== null}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: "#004e28" }}
                >
                  {actionLoading === "refund_approve" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Procesando...
                    </>
                  ) : (
                    "Aprobar"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {refundRejectOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4" onClick={() => setRefundRejectOpen(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">Rechazar reembolso</div>
              <button
                onClick={() => setRefundRejectOpen(false)}
                disabled={actionLoading !== null}
                className="inline-flex items-center justify-center rounded-full p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Motivo (obligatorio)</label>
              <textarea
                value={refundRejectReason}
                onChange={(e) => setRefundRejectReason(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#004e28]/20 focus:border-[#004e28]/40"
                placeholder="Escribe el motivo..."
                disabled={actionLoading !== null}
              />
              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  onClick={() => setRefundRejectOpen(false)}
                  disabled={actionLoading !== null}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 border border-gray-200 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitRefundReject}
                  disabled={actionLoading !== null || !refundRejectReason.trim()}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: "#ef4444" }}
                >
                  {actionLoading === "refund_reject" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Procesando...
                    </>
                  ) : (
                    "Rechazar"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {refundFinalizeOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4" onClick={() => setRefundFinalizeOpen(false)}>
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl overflow-hidden border border-gray-100" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">Finalizar reembolso</div>
              <button
                onClick={() => setRefundFinalizeOpen(false)}
                disabled={actionLoading !== null}
                className="inline-flex items-center justify-center rounded-full p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Nota (opcional)</label>
                <textarea
                  value={refundFinalizeNote}
                  onChange={(e) => setRefundFinalizeNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#004e28]/20 focus:border-[#004e28]/40"
                  placeholder="Agrega una nota si aplica..."
                  disabled={actionLoading !== null}
                />
              </div>
              <div>
                <FileUpload
                  label="Comprobante del reembolso"
                  value={refundFinalizeFile}
                  onChange={setRefundFinalizeFile}
                  accept="image/*,application/pdf"
                  disabled={actionLoading !== null}
                  helperText="Adjunta imagen o PDF"
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setRefundFinalizeOpen(false)}
                  disabled={actionLoading !== null}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 border border-gray-200 disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  onClick={submitRefundFinalize}
                  disabled={actionLoading !== null || !refundFinalizeFile}
                  className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  style={{ backgroundColor: "#3b82f6" }}
                >
                  {actionLoading === "refund_finalize" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Procesando...
                    </>
                  ) : (
                    "Finalizar"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <Toast type={toast.type} message={toast.message} onClose={closeToast} /> : null}
    </div>
  );
}
