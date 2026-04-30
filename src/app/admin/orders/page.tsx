"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { orderService, Order, OrderHistoryItem, OrderRefund } from "@/services/orderService";
import { chatService } from "@/services/chatService";
import { useChat } from "@/context/ChatContext";
import FileUpload from "@/components/ui/FileUpload";
import { Toast } from "@/components/ui/Toast";
import { 
  Loader2, 
  MessageSquare,
  ChevronLeft, 
  ChevronRight,
  X,
  Image as ImageIcon,
  BadgeCheck,
  Check,
  Clock,
  FileText,
  MapPin,
  PackageCheck,
  Store,
  Truck
} from "lucide-react";

function normalizeStatusKey(value: string) {
  const raw = String(value || "").trim();
  const ascii = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const v = ascii.toLowerCase().trim().replace(/\s+/g, "_");

  if (v === "pending" || v === "pendiente") return "pending";
  if (v === "paid" || v === "pagado" || v === "pago_verificado" || v === "validado" || v === "validated")
    return "paid";
  if (v === "verified" || v === "verificado") return "verified";
  if (
    v === "esperando_validacion" ||
    v === "esperando_validacion_de_pago" ||
    v === "waiting_validation" ||
    v === "awaiting_validation" ||
    v === "pending_validation" ||
    v === "payment_pending_validation" ||
    v === "pending_payment_validation"
  )
    return "receipt_uploaded";
  if (v === "completed" || v === "completado" || v === "delivered" || v === "entregado") return "completed";
  if (v === "shipped" || v === "enviado") return "shipped";
  if (v === "rejected" || v === "rechazado" || v === "payment_rejected" || v === "pago_rechazado")
    return "payment_rejected";
  if (v === "cancelled" || v === "cancelado") return "cancelled";
  if (v === "receipt_uploaded" || v === "comprobante_subido") return "receipt_uploaded";
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

  return v;
}

function toSpanishStatusLabel(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const key = normalizeStatusKey(raw);
  const map: Record<string, string> = {
    pending: "Pendiente",
    paid: "Pago verificado",
    verified: "Verificado",
    completed: "Completado",
    shipped: "Enviado",
    receipt_uploaded: "Comprobante subido",
    payment_rejected: "Pago rechazado",
    rejected: "Pago rechazado",
    cancelled: "Cancelado",
    created: "Creado",
    refund_requested: "Reembolso solicitado",
    refund_approved: "Reembolso aprobado",
    refund_rejected: "Reembolso rechazado",
    refund_refunded: "Reembolsado",
  };
  return map[key] || raw;
}

function toSpanishHistoryText(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  const exact = toSpanishStatusLabel(raw);
  if (exact && exact !== raw) return exact;

  const replacements: Array<[RegExp, string]> = [
    [/(^|[^a-z0-9_])refund_requested([^a-z0-9_]|$)/gi, "$1Reembolso solicitado$2"],
    [/(^|[^a-z0-9_])refund_approved([^a-z0-9_]|$)/gi, "$1Reembolso aprobado$2"],
    [/(^|[^a-z0-9_])refund_rejected([^a-z0-9_]|$)/gi, "$1Reembolso rechazado$2"],
    [/(^|[^a-z0-9_])refund_refunded([^a-z0-9_]|$)/gi, "$1Reembolsado$2"],
    [/(^|[^a-z0-9_])refund_completed([^a-z0-9_]|$)/gi, "$1Reembolsado$2"],
    [/(^|[^a-z0-9_])payment_rejected([^a-z0-9_]|$)/gi, "$1Pago rechazado$2"],
    [/(^|[^a-z0-9_])receipt_uploaded([^a-z0-9_]|$)/gi, "$1Comprobante subido$2"],
    [/(^|[^a-z0-9_])verified([^a-z0-9_]|$)/gi, "$1Verificado$2"],
    [/(^|[^a-z0-9_])paid([^a-z0-9_]|$)/gi, "$1Pago verificado$2"],
    [/(^|[^a-z0-9_])pending([^a-z0-9_]|$)/gi, "$1Pendiente$2"],
    [/(^|[^a-z0-9_])created([^a-z0-9_]|$)/gi, "$1Creado$2"],
    [/(^|[^a-z0-9_])completed([^a-z0-9_]|$)/gi, "$1Completado$2"],
    [/(^|[^a-z0-9_])shipped([^a-z0-9_]|$)/gi, "$1Enviado$2"],
    [/(^|[^a-z0-9_])cancelled([^a-z0-9_]|$)/gi, "$1Cancelado$2"],
  ];

  let out = raw;
  for (const [re, rep] of replacements) out = out.replace(re, rep);
  return out;
}

function StatusBadge({ value }: { value: string }) {
  const raw = (value || "").trim();
  const normalized = normalizeStatusKey(raw);

  const isPaid = normalized === "paid";
  const isCompleted = normalized === "completed" || normalized === "verified";
  const isRefundRequested = normalized === "refund_requested";
  const isRefunded = normalized === "refund_refunded";

  const bg = isRefunded
    ? "#6b7280"
    : isCompleted
      ? "#004e28"
      : isPaid
        ? "#168e00"
        : isRefundRequested
          ? "#f59e0b"
          : "#f2f3f4";
  const fg = isRefunded || isCompleted || isPaid ? "#ffffff" : isRefundRequested ? "#000000" : "#000000";

  const label = toSpanishStatusLabel(raw) || "—";

  return (
    <span
      className="inline-flex items-center justify-center whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold font-[family-name:var(--font-poppins)]"
      style={{ backgroundColor: bg, color: fg }}
    >
      {label}
    </span>
  );
}

function MinimalStatusPill({ value }: { value: string }) {
  const raw = (value || "").trim();
  const normalized = normalizeStatusKey(raw);

  const isPaid = normalized === "paid";
  const isCompleted = normalized === "completed" || normalized === "verified";
  const isReceipt = normalized === "receipt_uploaded";
  const isRejected = normalized === "payment_rejected";
  const isCancelled = normalized === "cancelled";
  const isShipped = normalized === "shipped";
  const isPending = normalized === "pending";
  const isRefundRequested = normalized === "refund_requested";
  const isRefunded = normalized === "refund_refunded";

  const base = isRefunded
    ? "#6b7280"
    : isCompleted
    ? "#004e28"
    : isPaid
      ? "#168e00"
      : isRefundRequested
        ? "#f59e0b"
      : isReceipt
        ? "#3b82f6"
        : isRejected
          ? "#ef4444"
          : isCancelled
            ? "#6b7280"
            : isShipped
              ? "#fbbf24"
              : isPending
                ? "#6b7280"
                : "#6b7280";

  const label = toSpanishStatusLabel(raw) || "—";
  const bg = base === "#fbbf24" || base === "#f59e0b" ? "#fff7ed" : `${base}14`;

  return (
    <span
      className="inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold font-[family-name:var(--font-poppins)]"
      style={{ backgroundColor: bg, color: base }}
    >
      {label}
    </span>
  );
}

type DeliveryTypeKey = "shipping" | "pickup";

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
  if (normalized === "shipped") return "shipping";
  return "pickup";
}

function getDeliveryTitle(mode: DeliveryTypeKey) {
  return mode === "shipping" ? "Envío a domicilio" : "Recoger en tienda";
}

function formatEtaLabel(order: Order, mode: DeliveryTypeKey) {
  const created = new Date(order.created_at || "");
  const base = Number.isNaN(created.getTime()) ? new Date() : created;
  const minutesToAdd = mode === "shipping" ? 24 * 60 + 90 : 120;
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

function DeliveryTypePill({ order }: { order: Order }) {
  const mode = getDeliveryTypeKey(order);
  const label = mode === "shipping" ? "Envío" : "Recoger";
  const bg = mode === "shipping" ? "#3b82f614" : "#004e2814";
  const fg = mode === "shipping" ? "#3b82f6" : "#004e28";
  return (
    <span
      className="inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold font-[family-name:var(--font-poppins)]"
      style={{ backgroundColor: bg, color: fg, border: `1px solid ${fg}33` }}
    >
      {label}
    </span>
  );
}

type ProgressStep = {
  key: "created" | "receipt_uploaded" | "paid" | "shipped" | "completed";
  label: string;
  Icon: typeof Check;
};

function getBaseProgressSteps(mode: DeliveryTypeKey): ProgressStep[] {
  return [
    { key: "created", label: "Creado", Icon: Check },
    { key: "receipt_uploaded", label: "Comprobante", Icon: FileText },
    { key: "paid", label: "Pago verificado", Icon: BadgeCheck },
    { key: "shipped", label: mode === "shipping" ? "Enviado" : "Listo para recoger", Icon: mode === "shipping" ? Truck : Store },
    { key: "completed", label: mode === "shipping" ? "Entregado" : "Completado", Icon: PackageCheck },
  ];
}

function getProgressRank(statusKey: string) {
  const k = normalizeStatusKey(statusKey);
  if (k === "created" || k === "pending") return 1;
  if (k === "receipt_uploaded") return 2;
  if (k === "paid") return 3;
  if (k === "shipped") return 4;
  if (k === "verified" || k === "completed") return 5;
  if (k === "refund_requested" || k === "refund_approved" || k === "refund_rejected" || k === "refund_refunded") return 5;
  return 1;
}

function DemoRouteMap({
  mode,
  label,
}: {
  mode: DeliveryTypeKey;
  label: string;
}) {
  const accent = mode === "shipping" ? "#22c55e" : "#004e28";
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-[#0b1220]">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 800 420"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M80 360 C 180 300, 260 310, 320 260 C 390 200, 420 210, 470 170 C 540 110, 590 130, 650 90 C 700 60, 730 70, 760 50"
          fill="none"
          stroke={accent}
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d="M80 360 C 180 300, 260 310, 320 260 C 390 200, 420 210, 470 170 C 540 110, 590 130, 650 90 C 700 60, 730 70, 760 50"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.8"
        />
        <circle cx="80" cy="360" r="10" fill={accent} />
        <circle cx="760" cy="50" r="10" fill={accent} />
      </svg>
      <div className="relative p-5">
        <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-white backdrop-blur">
          <MapPin className="h-4 w-4" style={{ color: accent }} />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white/70 font-[family-name:var(--font-poppins)]">
              Ubicación (demo)
            </div>
            <div className="text-sm font-semibold text-white font-[family-name:var(--font-poppins)] truncate">
              {label}
            </div>
          </div>
        </div>
      </div>
      <div className="relative h-[240px]" />
    </div>
  );
}

function ProgressStepper({
  steps,
  currentRank,
}: {
  steps: ProgressStep[];
  currentRank: number;
}) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2">
        {steps.map((s, idx) => {
          const stepRank = idx + 1;
          const done = currentRank > stepRank;
          const active = currentRank === stepRank;
          const Icon = s.Icon;
          const baseColor = done ? "#004e28" : active ? "#16a34a" : "#9ca3af";
          const bg =
            done || active ? `${baseColor}14` : "#f3f4f6";
          return (
            <div key={s.key} className="flex-1 min-w-0">
              <div className="flex items-center justify-center">
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center border"
                  style={{
                    backgroundColor: bg,
                    borderColor: done || active ? `${baseColor}55` : "#e5e7eb",
                  }}
                >
                  <Icon className="h-5 w-5" style={{ color: baseColor }} />
                </div>
              </div>
              <div className="mt-2 text-center text-xs font-semibold text-gray-900 font-[family-name:var(--font-poppins)] truncate">
                {s.label}
              </div>
              <div className="mt-0.5 text-center text-[11px] text-gray-400 font-[family-name:var(--font-poppins)]">
                {done ? "Listo" : active ? "Actual" : "Pendiente"}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 h-px bg-gray-100" />
    </div>
  );
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const { openChat } = useChat();
  const roleKey = String(user?.role || "").toLowerCase();
  const isAdminUser = roleKey === "admin" || roleKey === "superuser";
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<OrderHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<string>("");
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [rejectSpinnerVisible, setRejectSpinnerVisible] = useState(false);
  const rejectSpinnerTimerRef = useRef<number | null>(null);
  const [activeRefund, setActiveRefund] = useState<OrderRefund | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [isRefundApproveModalOpen, setIsRefundApproveModalOpen] = useState(false);
  const [refundApproveNote, setRefundApproveNote] = useState("");
  const [isRefundRejectModalOpen, setIsRefundRejectModalOpen] = useState(false);
  const [refundRejectReason, setRefundRejectReason] = useState("");
  const [isRefundFinalizeModalOpen, setIsRefundFinalizeModalOpen] = useState(false);
  const [refundFinalizeNote, setRefundFinalizeNote] = useState("");
  const [refundFinalizeFile, setRefundFinalizeFile] = useState<File | null>(null);

  useEffect(() => {
    if (!token) {
      setOrders([]);
      setLoading(false);
      return;
    }
    fetchOrders();
  }, [page, user?.role, token]);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3000);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    return () => {
      if (rejectSpinnerTimerRef.current) window.clearTimeout(rejectSpinnerTimerRef.current);
    };
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await orderService.getOrders(page, limit);
      setOrders(data);
    } catch (error) {
      console.error("Error fetching orders:", error);
      setError(getErrorMessage(error) || "No se pudieron cargar las órdenes.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const getErrorMessage = (e: unknown) => {
    if (!e || typeof e !== "object") return null;
    const rec = e as Record<string, unknown>;
    return typeof rec.message === "string" ? rec.message : null;
  };

  const formatDate = (value: string | undefined) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return new Intl.DateTimeFormat("es-MX", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const getOrderAmount = (order: Order) => {
    const raw = order.total_amount ?? order.product?.price;
    const n = typeof raw === "string" ? Number(raw) : Number(raw);
    if (!Number.isFinite(n)) return "-";
    return formatCurrency(n);
  };

  const getOrderPaymentStatus = (order: Order) => {
    const s = order.fulfillment_status || order.visual_status || order.payment_status || order.status;
    return typeof s === "string" && s.trim() ? s : "-";
  };

  const isReceiptPending = (order: Order) => {
    const status = String(order.status || "").toLowerCase();
    const payment = String(order.payment_status || "").toLowerCase();
    const visual = String(order.visual_status || "").toLowerCase();
    const fulfillment = String(order.fulfillment_status || "").toLowerCase();
    return (
      status === "comprobante_subido" ||
      status === "receipt_uploaded" ||
      payment === "comprobante_subido" ||
      payment === "receipt_uploaded" ||
      visual === "comprobante_subido" ||
      visual === "comprobante subido" ||
      visual === "receipt_uploaded" ||
      fulfillment === "comprobante_subido" ||
      fulfillment === "receipt_uploaded" ||
      fulfillment === "comprobante subido"
    );
  };

  const getReceiptUrl = (order: Order) => {
    const url = order.receipt_url;
    return typeof url === "string" && url.trim() ? url : "";
  };

  const getMediaUrl = (maybeUrl: string | null | undefined) => {
    const raw = typeof maybeUrl === "string" ? maybeUrl.trim() : "";
    if (!raw) return "";
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim().replace(/\/$/, "");
    if (base && raw.startsWith("/")) return `${base}${raw}`;
    return raw;
  };

  const pickActiveRefund = (items: OrderRefund[]) => {
    const sorted = [...items].sort((a, b) => {
      const ad = new Date(a.created_at || "").getTime();
      const bd = new Date(b.created_at || "").getTime();
      const at = Number.isFinite(ad) ? ad : 0;
      const bt = Number.isFinite(bd) ? bd : 0;
      if (at !== bt) return bt - at;
      return Number(b.id || 0) - Number(a.id || 0);
    });
    return sorted[0] ?? null;
  };

  const openCustomerChat = async (order: Order) => {
    setError(null);
    try {
      const conversations = await chatService.getConversations();
      const buyerId = Number(order.buyer_id);
      const supplier = Number(order.supplier_id);
      const productId = String(order.product_id || "");

      const scored = conversations
        .map((c) => {
          const cBuyer = Number(c.buyer_id ?? c.user_id);
          const cSupplier = Number(c.supplier_id);
          const cProduct = c.product_id != null ? String(c.product_id) : "";

          let score = 0;
          if (Number.isFinite(supplier) && Number.isFinite(cSupplier) && supplier === cSupplier) score += 3;
          if (Number.isFinite(buyerId) && Number.isFinite(cBuyer) && buyerId === cBuyer) score += 3;
          if (productId && cProduct && productId === cProduct) score += 2;

          return { conv: c, score };
        })
        .sort((a, b) => b.score - a.score);

      const best = scored[0]?.conv;
      if (!best || scored[0].score < 3) {
        setError("No se pudo abrir el chat para esta orden.");
        return;
      }

      openChat({
        ...best,
        product_id: best.product_id ?? order.product_id,
        product_title: best.product_title ?? order.product?.title,
        product_price:
          typeof best.product_price === "number"
            ? best.product_price
            : typeof order.product?.price === "number"
              ? order.product.price
              : undefined,
        product_slug: best.product_slug ?? order.product?.slug,
      });
    } catch {
      setError("No se pudo abrir el chat para esta orden.");
    }
  };

  function Timeline({
    items,
    loading,
    refundProofUrl,
  }: {
    items: OrderHistoryItem[];
    loading: boolean;
    refundProofUrl?: string;
  }) {
    if (loading) {
      return (
        <div className="flex items-center gap-2 text-sm text-gray-500 font-[family-name:var(--font-poppins)]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando historial...
        </div>
      );
    }

    if (!items.length) {
      return (
        <div className="text-sm text-gray-500 font-[family-name:var(--font-poppins)]">
          Esperando acciones del cliente
        </div>
      );
    }

    const statusMeta = (statusKey: string) => {
      const v = normalizeStatusKey(statusKey);
      if (v === "paid") return { label: "Pago verificado", bg: "#168e00", fg: "#ffffff" };
      if (v === "verified") return { label: "Verificado", bg: "#004e28", fg: "#ffffff" };
      if (v === "completed") return { label: "Completado", bg: "#004e28", fg: "#ffffff" };
      if (v === "shipped") return { label: "Enviado", bg: "#fbbf24", fg: "#000000" };
      if (v === "refund_requested") return { label: "Reembolso solicitado", bg: "#f59e0b", fg: "#000000" };
      if (v === "refund_refunded") return { label: "Reembolsado", bg: "#6b7280", fg: "#ffffff" };
      if (v === "payment_rejected") return { label: "Pago rechazado", bg: "#ef4444", fg: "#ffffff" };
      if (v === "cancelled") return { label: "Cancelado", bg: "#6b7280", fg: "#ffffff" };
      if (v === "receipt_uploaded") return { label: "Comprobante subido", bg: "#3b82f6", fg: "#ffffff" };
      if (v === "created") return { label: "Creado", bg: "#f2f3f4", fg: "#000000" };
      if (v === "pending") return { label: "Pendiente", bg: "#f2f3f4", fg: "#000000" };
      return { label: "", bg: "#f2f3f4", fg: "#000000" };
    };

    const rows = items.map((h) => {
      const rawAt = h.created_at || h.timestamp || h.date || "";
      const at = rawAt ? new Date(rawAt) : null;
      const timeLabel =
        at && !Number.isNaN(at.getTime())
          ? at.toLocaleString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
          : rawAt || "";

      const statusRaw =
        (typeof h.status === "string" && h.status) ||
        (typeof h.event === "string" && h.event) ||
        (typeof h.action === "string" && h.action) ||
        "";

      const meta = statusMeta(statusRaw);
      const fallbackTextRaw = normalizeHistoryRow(h).text;
      const fallbackText = toSpanishHistoryText(fallbackTextRaw);
      const title = meta.label || fallbackText || "Actualización";

      const detail =
        meta.label && fallbackText && fallbackText !== meta.label ? fallbackText : "";

      const actor =
        (typeof h.actor === "string" && h.actor) ||
        (h.user && typeof h.user === "object"
          ? (typeof h.user.name === "string" && h.user.name) || (typeof h.user.role === "string" && h.user.role)
          : "") ||
        "";

      const isRefunded = normalizeStatusKey(statusRaw) === "refund_refunded";
      return { timeLabel, title, detail, statusRaw, meta, actor, isRefunded };
    });

    return (
      <div className="max-h-[200px] overflow-y-auto pr-2">
        <div className="space-y-2">
          {rows.map((row, idx) => {
            const isLast = idx === rows.length - 1;
            return (
              <div key={idx} className="flex gap-2">
                <div className="flex flex-col items-center">
                  <div className="h-2 w-2 rounded-full bg-[#004e28]" />
                  {!isLast && <div className="w-px flex-1 bg-gray-200 mt-0.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 font-[family-name:var(--font-poppins)]">
                    {row.timeLabel}
                    {row.actor ? <span className="text-gray-300"> • </span> : null}
                    {row.actor ? <span className="text-gray-500">{row.actor}</span> : null}
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-gray-900 font-[family-name:var(--font-poppins)] truncate">
                    {row.title}
                  </div>
                  {row.detail ? (
                    <div className="mt-0.5 text-sm text-gray-700 font-[family-name:var(--font-poppins)]">
                      {row.detail}
                    </div>
                  ) : null}
                  {row.isRefunded && refundProofUrl ? (
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => window.open(refundProofUrl, "_blank", "noopener,noreferrer")}
                        className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold font-[family-name:var(--font-poppins)]"
                        style={{
                          backgroundColor: "#004e2814",
                          color: "#004e28",
                          border: "1px solid #004e2833",
                        }}
                      >
                        Ver comprobante
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const openManageModal = async (order: Order) => {
    setSelectedOrder(order);
    setModalError(null);
    setHistory([]);
    setHistoryLoading(true);
    setActiveRefund(null);
    setRefundLoading(true);
    try {
      const [historyResult, refundsResult] = await Promise.allSettled([
        orderService.getOrderHistory(order.id),
        orderService.getOrderRefunds(order.id),
      ]);

      if (historyResult.status === "fulfilled") {
        const sorted = [...historyResult.value].sort((a, b) => {
          const ad = new Date(a.created_at || a.timestamp || a.date || "");
          const bd = new Date(b.created_at || b.timestamp || b.date || "");
          const at = Number.isNaN(ad.getTime()) ? 0 : ad.getTime();
          const bt = Number.isNaN(bd.getTime()) ? 0 : bd.getTime();
          return bt - at;
        });
        setHistory(sorted);
      } else {
        setHistory([]);
      }

      if (refundsResult.status === "fulfilled") {
        setActiveRefund(pickActiveRefund(refundsResult.value));
      } else {
        setActiveRefund(null);
      }
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
      setRefundLoading(false);
    }
  };

  const closeManageModal = () => {
    setSelectedOrder(null);
    setHistory([]);
    setHistoryLoading(false);
    setModalError(null);
    setActionLoading(null);
    setIsRejectModalOpen(false);
    setRejectNote("");
    setActiveRefund(null);
    setRefundLoading(false);
    setIsRefundApproveModalOpen(false);
    setRefundApproveNote("");
    setIsRefundRejectModalOpen(false);
    setRefundRejectReason("");
    setIsRefundFinalizeModalOpen(false);
    setRefundFinalizeNote("");
    setRefundFinalizeFile(null);
    setRejectSpinnerVisible(false);
    if (rejectSpinnerTimerRef.current) {
      window.clearTimeout(rejectSpinnerTimerRef.current);
      rejectSpinnerTimerRef.current = null;
    }
  };

  const refreshRefundData = async (orderId: number): Promise<number | null> => {
    setRefundLoading(true);
    try {
      const list = await orderService.getOrderRefunds(orderId);
      const picked = pickActiveRefund(list);
      setActiveRefund(picked);
      return picked?.id != null ? Number(picked.id) : null;
    } catch {
      setActiveRefund(null);
      return null;
    } finally {
      setRefundLoading(false);
    }
  };

  const refreshHistory = async (orderId: number) => {
    setHistoryLoading(true);
    try {
      const items = await orderService.getOrderHistory(orderId);
      const sorted = [...items].sort((a, b) => {
        const ad = new Date(a.created_at || a.timestamp || a.date || "");
        const bd = new Date(b.created_at || b.timestamp || b.date || "");
        const at = Number.isNaN(ad.getTime()) ? 0 : ad.getTime();
        const bt = Number.isNaN(bd.getTime()) ? 0 : bd.getTime();
        return at - bt;
      });
      setHistory(sorted);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openRefundApproveModal = async () => {
    if (!selectedOrder) return;
    setModalError(null);
    if (activeRefund?.id == null) {
      await refreshRefundData(selectedOrder.id);
    }
    setRefundApproveNote("");
    setIsRefundApproveModalOpen(true);
  };

  const closeRefundApproveModal = () => {
    if (actionLoading) return;
    setIsRefundApproveModalOpen(false);
    setRefundApproveNote("");
  };

  const submitRefundApprove = async () => {
    if (!selectedOrder) return;
    const orderId = selectedOrder.id;
    setActionLoading("refund_approve");
    setModalError(null);
    try {
      let refundId: number | null = activeRefund?.id != null ? Number(activeRefund.id) : null;
      if (!refundId) {
        refundId = await refreshRefundData(orderId);
      }
      if (!refundId) {
        throw new Error("No se encontró el refund_id para esta orden.");
      }
      const note = refundApproveNote.trim();
      await orderService.approveOrderRefund(orderId, refundId, note || undefined);
      setToastMessage("Reembolso aprobado");
      await Promise.allSettled([fetchOrders(), refreshHistory(orderId), refreshRefundData(orderId)]);
      setIsRefundApproveModalOpen(false);
      setRefundApproveNote("");
    } catch (e) {
      setModalError(getErrorMessage(e) || "No se pudo aprobar el reembolso.");
    } finally {
      setActionLoading(null);
    }
  };

  const openRefundRejectModal = async () => {
    if (!selectedOrder) return;
    setModalError(null);
    if (activeRefund?.id == null) {
      await refreshRefundData(selectedOrder.id);
    }
    setRefundRejectReason("");
    setIsRefundRejectModalOpen(true);
  };

  const closeRefundRejectModal = () => {
    if (actionLoading) return;
    setIsRefundRejectModalOpen(false);
    setRefundRejectReason("");
  };

  const submitRefundReject = async () => {
    if (!selectedOrder) return;
    const orderId = selectedOrder.id;
    const reason = refundRejectReason.trim();
    if (!reason) return;
    setActionLoading("refund_reject");
    setModalError(null);
    try {
      let refundId: number | null = activeRefund?.id != null ? Number(activeRefund.id) : null;
      if (!refundId) {
        refundId = await refreshRefundData(orderId);
      }
      if (!refundId) {
        throw new Error("No se encontró el refund_id para esta orden.");
      }
      await orderService.rejectOrderRefund(orderId, refundId, reason);
      setToastMessage("Reembolso rechazado");
      await Promise.allSettled([fetchOrders(), refreshHistory(orderId), refreshRefundData(orderId)]);
      setIsRefundRejectModalOpen(false);
      setRefundRejectReason("");
    } catch (e) {
      setModalError(getErrorMessage(e) || "No se pudo rechazar el reembolso.");
    } finally {
      setActionLoading(null);
    }
  };

  const openRefundFinalizeModal = async () => {
    if (!selectedOrder) return;
    setModalError(null);
    if (activeRefund?.id == null) {
      await refreshRefundData(selectedOrder.id);
    }
    setRefundFinalizeNote("");
    setRefundFinalizeFile(null);
    setIsRefundFinalizeModalOpen(true);
  };

  const closeRefundFinalizeModal = () => {
    if (actionLoading) return;
    setIsRefundFinalizeModalOpen(false);
    setRefundFinalizeNote("");
    setRefundFinalizeFile(null);
  };

  const submitRefundFinalize = async () => {
    if (!selectedOrder) return;
    const orderId = selectedOrder.id;
    setActionLoading("refund_mark_refunded");
    setModalError(null);
    try {
      let refundId: number | null = activeRefund?.id != null ? Number(activeRefund.id) : null;
      if (!refundId) {
        refundId = await refreshRefundData(orderId);
      }
      if (!refundId) {
        throw new Error("No se encontró el refund_id para esta orden.");
      }
      if (!refundFinalizeFile) {
        throw new Error("Adjunta el comprobante del reembolso.");
      }
      const note = refundFinalizeNote.trim();
      await orderService.markOrderRefunded(orderId, refundId, note || undefined, refundFinalizeFile);
      setToastMessage("Pago de reembolso confirmado");
      await Promise.allSettled([fetchOrders(), refreshHistory(orderId), refreshRefundData(orderId)]);
      setIsRefundFinalizeModalOpen(false);
      setRefundFinalizeNote("");
      setRefundFinalizeFile(null);
    } catch (e) {
      setModalError(getErrorMessage(e) || "No se pudo confirmar el pago.");
    } finally {
      setActionLoading(null);
    }
  };

  const applyStatus = async (
    newStatus: "paid" | "shipped" | "completed" | "rejected" | "cancelled",
    note?: string
  ) => {
    if (!selectedOrder) return;
    setActionLoading(newStatus);
    setModalError(null);
    try {
      const updated = await orderService.updateOrderStatus(selectedOrder.id, newStatus, note).catch(() => null);
      const updatedRec =
        updated && typeof updated === "object" ? (updated as Record<string, unknown>) : null;
      const nextStatus =
        typeof updatedRec?.status === "string" ? updatedRec.status : newStatus;
      const nextVisualStatus =
        typeof updatedRec?.visual_status === "string"
          ? updatedRec.visual_status
          : typeof updatedRec?.status === "string"
            ? updatedRec.status
            : newStatus;

      setOrders((prev) =>
        prev.map((o) => (o.id === selectedOrder.id ? { ...o, status: nextStatus, visual_status: nextVisualStatus } : o))
      );
      setSelectedOrder((prev) => (prev ? { ...prev, status: nextStatus, visual_status: nextVisualStatus } : prev));
      if (newStatus === "rejected") {
        setIsRejectModalOpen(false);
        setRejectNote("");
      }

      try {
        const items = await orderService.getOrderHistory(selectedOrder.id);
        const sorted = [...items].sort((a, b) => {
          const ad = new Date(a.created_at || a.timestamp || a.date || "");
          const bd = new Date(b.created_at || b.timestamp || b.date || "");
          const at = Number.isNaN(ad.getTime()) ? 0 : ad.getTime();
          const bt = Number.isNaN(bd.getTime()) ? 0 : bd.getTime();
        return bt - at;
        });
        setHistory(sorted);
      } catch {
      }
    } catch (e) {
      setModalError(getErrorMessage(e) || "No se pudo actualizar el estatus.");
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectModal = () => {
    setModalError(null);
    setRejectNote("");
    setIsRejectModalOpen(true);
  };

  const closeRejectModal = () => {
    if (actionLoading) return;
    setIsRejectModalOpen(false);
    setRejectNote("");
  };

  const submitRejection = async () => {
    if (!selectedOrder) return;
    const note = rejectNote.trim();
    if (note.length < 10) return;

    const orderId = selectedOrder.id;
    setModalError(null);
    setActionLoading("reject");
    setRejectSpinnerVisible(false);
    if (rejectSpinnerTimerRef.current) window.clearTimeout(rejectSpinnerTimerRef.current);
    rejectSpinnerTimerRef.current = window.setTimeout(() => setRejectSpinnerVisible(true), 500);

    try {
      await orderService.updateOrderStatus(orderId, "pending", note);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, status: "pending", visual_status: "pending", receipt_url: "" } : o
        )
      );
      setToastMessage("Rechazo procesado exitosamente");
      closeManageModal();
      fetchOrders();
    } catch {
      setModalError("No se pudo procesar el rechazo.");
    } finally {
      if (rejectSpinnerTimerRef.current) window.clearTimeout(rejectSpinnerTimerRef.current);
      rejectSpinnerTimerRef.current = null;
      setRejectSpinnerVisible(false);
      setActionLoading(null);
    }
  };

  const normalizeHistoryRow = (item: OrderHistoryItem) => {
    const rawAt = item.created_at || item.timestamp || item.date || "";
    const at = rawAt ? new Date(rawAt) : null;
    const timeLabel =
      at && !Number.isNaN(at.getTime())
        ? at.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
        : rawAt || "";

    const rawText =
      item.description ||
      item.message ||
      item.event ||
      item.action ||
      item.status ||
      "";

    const text = rawText ? String(rawText) : "Actualización";
    return { timeLabel, text };
  };

  const getLatestHistoryStatusKey = (items: OrderHistoryItem[]) => {
    if (!items.length) return "";
    const h = items[0];
    const candidates = [
      h.status,
      h.event,
      h.action,
      h.description,
      h.message,
      normalizeHistoryRow(h).text,
    ];
    const first = candidates.find((c) => typeof c === "string" && c.trim());
    return normalizeStatusKey(typeof first === "string" ? first : "");
  };

  const hasRefundRequestedSignal = (items: OrderHistoryItem[]) => {
    return items.some((h) => {
      const candidates = [
        h.status,
        h.event,
        h.action,
        h.description,
        h.message,
        normalizeHistoryRow(h).text,
      ];
      return candidates.some((c) => typeof c === "string" && normalizeStatusKey(c) === "refund_requested");
    });
  };

  return (
    <div className="p-6">
      {toastMessage ? <Toast type="success" message={toastMessage} onClose={() => setToastMessage(null)} /> : null}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">Órdenes</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 font-[family-name:var(--font-poppins)]">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Producto</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Entrega</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Monto</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pago</th>
                {isAdminUser ? (
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Proveedor</th>
                ) : null}
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Creado</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={isAdminUser ? 9 : 8} className="px-6 py-8 text-center">
                    <div className="flex justify-center items-center">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={isAdminUser ? 9 : 8} className="px-6 py-8 text-center text-gray-500">
                    No hay órdenes encontradas.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr
                    key={order.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      isReceiptPending(order) ? "bg-[#168e00]/5" : ""
                    }`}
                  >
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex items-center gap-2 font-[family-name:var(--font-poppins)]">
                        {isReceiptPending(order) && (
                          <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#168e00] shadow-[0_0_0_3px_rgba(22,142,0,0.18)] animate-pulse" />
                        )}
                        <span>#{order.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-[family-name:var(--font-poppins)]">
                      {order.product?.title || "Producto desconocido"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <DeliveryTypePill order={order} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-[family-name:var(--font-poppins)]">
                      {getOrderAmount(order)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <StatusBadge value={getOrderPaymentStatus(order)} />
                    </td>
                    {isAdminUser ? (
                      <td className="px-6 py-4 text-sm text-gray-500 font-[family-name:var(--font-poppins)]">
                        <div className="flex flex-col">
                          <span className="text-gray-900">
                            {order.supplier?.name || "Proveedor desconocido"}
                          </span>
                          <span className="text-xs text-gray-400">ID: {order.supplier_id}</span>
                        </div>
                      </td>
                    ) : null}
                    <td className="px-6 py-4 text-sm font-[family-name:var(--font-poppins)]">
                      <div className="flex flex-col">
                        <span className="text-gray-900">{order.buyer?.name || `Usuario #${order.buyer_id}`}</span>
                        <span className="text-xs text-gray-400">{order.buyer?.email || "-"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-[family-name:var(--font-poppins)]">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/admin/orders/${order.id}`)}
                          className="inline-flex items-center justify-center px-4 py-2 rounded-md text-xs font-semibold text-white shadow-sm hover:opacity-95 font-[family-name:var(--font-poppins)]"
                          style={{ backgroundColor: "#004e28" }}
                        >
                          Gestionar
                        </button>
                        <button
                          onClick={() => openCustomerChat(order)}
                          className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-gray-200 bg-white hover:bg-gray-50"
                          aria-label="Abrir chat"
                          title="Abrir chat"
                        >
                          <MessageSquare className="w-4 h-4 text-[#004e28]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Anterior
            </button>
            <span className="text-sm text-gray-700">
              Página {page}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={orders.length < limit || loading}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Siguiente
              <ChevronRight className="w-4 h-4 ml-2" />
            </button>
        </div>
      </div>

      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={closeManageModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-5xl rounded-2xl bg-white shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "#ffffff" }}
          >
            <div className="relative px-8 pt-7 pb-5 border-b border-gray-100">
              <button
                onClick={closeManageModal}
                className="absolute right-4 top-4 inline-flex items-center justify-center rounded-full p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                  Gestión de Pedido
                </h2>
                <MinimalStatusPill
                  value={
                    getLatestHistoryStatusKey(history) === "refund_refunded"
                      ? "refund_refunded"
                      : getOrderPaymentStatus(selectedOrder)
                  }
                />
              </div>
              <div className="mt-1 text-sm text-gray-500 font-[family-name:var(--font-poppins)]">
                #{selectedOrder.id} • {selectedOrder.product?.title || "Producto"}
              </div>
            </div>

            <div className="px-8 py-6">
              {(() => {
                const mode = getDeliveryTypeKey(selectedOrder);
                const title = getDeliveryTitle(mode);
                const latestHistoryKey = getLatestHistoryStatusKey(history);
                const orderStatusRaw = String(
                  selectedOrder.fulfillment_status ||
                    selectedOrder.visual_status ||
                    selectedOrder.status ||
                    selectedOrder.payment_status ||
                    ""
                );
                const currentKey = latestHistoryKey || normalizeStatusKey(orderStatusRaw);
                const progressRank = getProgressRank(currentKey);
                const steps = getBaseProgressSteps(mode);
                const etaLabel = formatEtaLabel(selectedOrder, mode);
                const anyOrder = selectedOrder as unknown as Record<string, unknown>;
                const addressRaw =
                  (typeof anyOrder.delivery_address === "string" && anyOrder.delivery_address) ||
                  (typeof anyOrder.shipping_address === "string" && anyOrder.shipping_address) ||
                  (typeof anyOrder.address === "string" && anyOrder.address) ||
                  (typeof anyOrder.pickup_address === "string" && anyOrder.pickup_address) ||
                  "";
                const address = addressRaw && addressRaw.trim() ? addressRaw.trim() : mode === "shipping" ? selectedOrder.supplier?.name || "Sucursal" : selectedOrder.supplier?.name || "Tienda";
                const headlinePill =
                  normalizeStatusKey(currentKey) === "refund_refunded"
                    ? "refund_refunded"
                    : normalizeStatusKey(orderStatusRaw) || "pending";
                const refundExists = Boolean(activeRefund) || hasRefundRequestedSignal(history);
                const refundKey = normalizeStatusKey(latestHistoryKey);
                const showRefundStrip =
                  refundExists &&
                  (refundKey === "refund_requested" ||
                    refundKey === "refund_approved" ||
                    refundKey === "refund_rejected" ||
                    refundKey === "refund_refunded");

                const refundLabel =
                  refundKey === "refund_requested"
                    ? "Reembolso solicitado"
                    : refundKey === "refund_approved"
                      ? "Reembolso aprobado"
                      : refundKey === "refund_rejected"
                        ? "Reembolso rechazado"
                        : refundKey === "refund_refunded"
                          ? "Reembolsado"
                          : "Reembolso";

                const refundTone =
                  refundKey === "refund_rejected"
                    ? { bg: "#ef444414", fg: "#ef4444", border: "#ef444433" }
                    : refundKey === "refund_refunded"
                      ? { bg: "#6b728014", fg: "#6b7280", border: "#6b728033" }
                      : { bg: "#f59e0b14", fg: "#b45309", border: "#f59e0b33" };

                const shippingGradient = "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)";
                const pickupGradient = "linear-gradient(135deg, #004e28 0%, #0b6b3a 100%)";
                const headerBg = mode === "shipping" ? shippingGradient : pickupGradient;
                return (
                  <div className="mb-6 overflow-hidden rounded-2xl border border-gray-100">
                    <div
                      className="px-6 py-5 text-white"
                      style={{ background: headerBg }}
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {mode === "shipping" ? (
                              <Truck className="h-4 w-4 text-white/80" />
                            ) : (
                              <Store className="h-4 w-4 text-white/80" />
                            )}
                            <span className="text-xs font-semibold tracking-wider text-white/70 font-[family-name:var(--font-poppins)]">
                              Pedido #{selectedOrder.id}
                            </span>
                          </div>
                          <div className="text-3xl font-bold font-[family-name:var(--font-varela-round)] truncate">
                            {title}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold font-[family-name:var(--font-poppins)]">
                              {toSpanishStatusLabel(headlinePill)}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold font-[family-name:var(--font-poppins)]">
                              {selectedOrder.supplier?.name || "Proveedor"}
                            </span>
                            {showRefundStrip ? (
                              <span
                                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold font-[family-name:var(--font-poppins)]"
                                style={{ backgroundColor: refundTone.bg, color: refundTone.fg, border: `1px solid ${refundTone.border}` }}
                              >
                                {refundLabel}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="shrink-0 text-left md:text-right">
                          <div className="text-xs font-semibold tracking-wider text-white/70 font-[family-name:var(--font-poppins)]">
                            {mode === "shipping" ? "Entrega estimada" : "Recolección estimada"}
                          </div>
                          <div className="mt-1 flex items-center gap-2 md:justify-end">
                            <Clock className="h-4 w-4 text-white/80" />
                            <div className="text-xl font-bold font-[family-name:var(--font-poppins)]">{etaLabel}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white px-6 py-5">
                      <ProgressStepper steps={steps} currentRank={progressRank} />

                      <div className="mt-5 grid grid-cols-1 lg:grid-cols-5 gap-5">
                        <div className="lg:col-span-3">
                          <DemoRouteMap
                            mode={mode}
                            label={mode === "shipping" ? `Destino: ${address}` : `Ubicación: ${address}`}
                          />
                        </div>
                        <div className="lg:col-span-2 space-y-4">
                          <div className="rounded-2xl border border-gray-100 bg-white p-5">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 font-[family-name:var(--font-poppins)]">
                              {mode === "shipping" ? (
                                <><Truck className="h-3 w-3" /> Entregar en</>
                              ) : (
                                <><Store className="h-3 w-3" /> Recoger en</>
                              )}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-gray-900 font-[family-name:var(--font-poppins)]">
                              {address}
                            </div>
                            {mode === "shipping" ? (
                              <div className="mt-2 space-y-1">
                                <div className="text-xs text-gray-500 font-[family-name:var(--font-poppins)]">
                                  <span className="font-semibold">Origen:</span> {selectedOrder.supplier?.name || "Sucursal"}
                                </div>
                                <div className="text-xs text-gray-500 font-[family-name:var(--font-poppins)]">
                                  <span className="font-semibold">Código:</span>{" "}
                                  <span className="font-mono">{(anyOrder as any).delivery_code || "—"}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 text-xs text-gray-500 font-[family-name:var(--font-poppins)]">
                                {selectedOrder.supplier?.name || "Tienda"}
                              </div>
                            )}
                          </div>

                          <div className="rounded-2xl border border-gray-100 bg-white p-5">
                            <div className="text-xs font-semibold text-gray-500 font-[family-name:var(--font-poppins)]">
                              Estado actual
                            </div>
                            <div className="mt-2">
                              <MinimalStatusPill value={headlinePill} />
                            </div>
                            <div className="mt-3 text-xs text-gray-500 font-[family-name:var(--font-poppins)]">
                              Basado en historial y estatus de la orden.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-sm font-bold text-gray-900 font-[family-name:var(--font-varela-round)] mb-3">
                    Evidencia de Pago
                  </div>

                  {getReceiptUrl(selectedOrder) ? (
                    <div className="rounded-xl border border-gray-100 bg-white p-3">
                      <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#f2f3f4]">
                        <img
                          src={getReceiptUrl(selectedOrder)}
                          alt="Comprobante de pago"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-100 bg-white p-6">
                      <div className="flex flex-col items-center justify-center text-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                        <div className="text-sm text-gray-400 font-[family-name:var(--font-poppins)]">
                          Esperando que el cliente suba el recibo
                        </div>
                      </div>
                    </div>
                  )}

                  {normalizeStatusKey(getOrderPaymentStatus(selectedOrder)) === "refund_requested" ||
                  Boolean(activeRefund) ||
                  hasRefundRequestedSignal(history) ? (
                    <div className="mt-6">
                      <div className="text-sm font-bold text-gray-900 font-[family-name:var(--font-varela-round)] mb-3">
                        Detalle del Reclamo
                      </div>

                      {refundLoading ? (
                        <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-6">
                          <div className="flex items-center gap-2 text-sm text-gray-500 font-[family-name:var(--font-poppins)]">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Cargando reclamo...
                          </div>
                        </div>
                      ) : activeRefund ? (
                        <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-5 space-y-4">
                          <div>
                            <div className="text-xs font-semibold text-gray-500 font-[family-name:var(--font-poppins)]">
                              Motivo
                            </div>
                            <div className="mt-1 text-sm text-gray-900 font-[family-name:var(--font-poppins)] whitespace-pre-wrap">
                              {activeRefund.reason?.trim() ? activeRefund.reason : "—"}
                            </div>
                          </div>

                          {getMediaUrl(activeRefund.file_url || activeRefund.evidence_url || activeRefund.file) ? (
                            <div>
                              <div className="text-xs font-semibold text-gray-500 font-[family-name:var(--font-poppins)] mb-2">
                                Foto
                              </div>
                              <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#f2f3f4] border border-gray-100">
                                <img
                                  src={getMediaUrl(activeRefund.file_url || activeRefund.evidence_url || activeRefund.file)}
                                  alt="Evidencia del reclamo"
                                  className="h-full w-full object-contain"
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-6">
                          <div className="text-sm text-gray-400 font-[family-name:var(--font-poppins)]">
                            No hay información del reclamo.
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-5">
                  <div className="text-sm font-bold text-gray-900 font-[family-name:var(--font-varela-round)] mb-3">
                    Acciones
                  </div>

                  {(() => {
                    const statusKey = String(
                      selectedOrder.fulfillment_status ||
                        selectedOrder.visual_status ||
                        selectedOrder.status ||
                        selectedOrder.payment_status ||
                        ""
                    )
                      .trim()
                      .toLowerCase();

                    const normalized = normalizeStatusKey(statusKey);
                    const latestHistoryKey = getLatestHistoryStatusKey(history);
                    const isRefundFinalizedInHistory = latestHistoryKey === "refund_refunded";
                    const refundProofUrl = getMediaUrl(
                      activeRefund?.file_url || activeRefund?.evidence_url || activeRefund?.file
                    );
                    const hasReceipt = Boolean(getReceiptUrl(selectedOrder));
                    const isPendingLike =
                      normalized === "pending" || normalized === "receipt_uploaded" || normalized === "created";
                    const isPaid = normalized === "paid";
                    const isFinal =
                      normalized === "verified" ||
                      normalized === "completed" ||
                      normalized === "cancelled" ||
                      normalized === "payment_rejected";
                    const canConfirmPayment = hasReceipt && isPendingLike && !isPaid && !isFinal;
                    const canReject = (isPendingLike || isPaid) && !isFinal;

                    const showRefundActions =
                      !isRefundFinalizedInHistory &&
                      (normalized === "refund_requested" || Boolean(activeRefund) || hasRefundRequestedSignal(history));

                    if (isRefundFinalizedInHistory) {
                      return (
                        <div className="space-y-3">
                          <div className="text-sm font-semibold text-gray-700 font-[family-name:var(--font-poppins)]">
                            Reembolso finalizado.
                          </div>
                          {refundProofUrl ? (
                            <button
                              type="button"
                              onClick={() => window.open(refundProofUrl, "_blank", "noopener,noreferrer")}
                              className="w-full inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)]"
                              style={{
                                backgroundColor: "#004e2814",
                                color: "#004e28",
                                border: "1px solid #004e2833",
                              }}
                            >
                              Ver Comprobante de Pago
                            </button>
                          ) : null}
                        </div>
                      );
                    }

                    if (showRefundActions) {
                      if (refundLoading) {
                        return (
                          <div className="flex items-center gap-2 text-sm text-gray-500 font-[family-name:var(--font-poppins)]">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Cargando reembolso...
                          </div>
                        );
                      }

                      const hasRefundId = activeRefund?.id != null;
                      if (!hasRefundId) {
                        return (
                          <div className="text-sm text-gray-500 font-[family-name:var(--font-poppins)]">
                            No hay reembolso activo para esta orden.
                          </div>
                        );
                      }

                      const evidenceUrl = getMediaUrl(activeRefund?.file_url || activeRefund?.evidence_url || activeRefund?.file);
                      return (
                        <>
                          {evidenceUrl ? (
                            <div className="mb-4 flex items-center gap-3">
                              <div className="h-14 w-14 overflow-hidden rounded-xl border border-gray-100 bg-[#f2f3f4]">
                                <img src={evidenceUrl} alt="Evidencia del reembolso" className="h-full w-full object-cover" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-gray-500 font-[family-name:var(--font-poppins)]">
                                  Evidencia
                                </div>
                                <div className="text-sm font-semibold text-gray-900 font-[family-name:var(--font-poppins)] truncate">
                                  Reembolso solicitado
                                </div>
                              </div>
                            </div>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={openRefundApproveModal}
                              disabled={actionLoading !== null}
                              className="inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)] disabled:opacity-60"
                              style={{
                                backgroundColor: "#004e2814",
                                color: "#004e28",
                                border: "1px solid #004e2833",
                              }}
                            >
                              {actionLoading === "refund_approve" ? "Actualizando..." : "Aprobar Reembolso"}
                            </button>

                            <button
                              onClick={openRefundRejectModal}
                              disabled={actionLoading !== null}
                              className="inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)] disabled:opacity-60"
                              style={{
                                backgroundColor: "#ef444414",
                                color: "#ef4444",
                                border: "1px solid #ef444433",
                              }}
                            >
                              {actionLoading === "refund_reject" ? "Actualizando..." : "Rechazar Reembolso"}
                            </button>

                            <button
                              onClick={openRefundFinalizeModal}
                              disabled={actionLoading !== null}
                              className="inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)] disabled:opacity-60"
                              style={{
                                backgroundColor: "#3b82f614",
                                color: "#3b82f6",
                                border: "1px solid #3b82f633",
                              }}
                            >
                              {actionLoading === "refund_mark_refunded" ? "Actualizando..." : "Finalizar Reembolso"}
                            </button>
                          </div>
                        </>
                      );
                    }

                    return (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {canConfirmPayment ? (
                            <button
                              onClick={() => applyStatus("paid")}
                              disabled={actionLoading !== null || !hasReceipt}
                              className="inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)] disabled:opacity-60"
                              style={{
                                backgroundColor: "#004e2814",
                                color: "#004e28",
                                border: "1px solid #004e2833",
                              }}
                              title={
                                !hasReceipt
                                  ? "Se requiere receipt_url para confirmar el pago"
                                  : undefined
                              }
                            >
                              {actionLoading === "paid" ? "Actualizando..." : "Confirmar Pago"}
                            </button>
                          ) : null}

                          {isPaid ? (
                            <button
                              onClick={() => applyStatus("completed")}
                              disabled={actionLoading !== null}
                              className="inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)] disabled:opacity-60"
                              style={{
                                backgroundColor: "#004e2814",
                                color: "#004e28",
                                border: "1px solid #004e2833",
                              }}
                            >
                              {actionLoading === "completed" ? "Actualizando..." : "Completar"}
                            </button>
                          ) : null}
                        </div>

                        <div className="mt-4 flex items-center justify-end gap-3">
                          <button
                            onClick={openRejectModal}
                            disabled={actionLoading !== null || isFinal || !canReject}
                            className={`text-sm font-semibold font-[family-name:var(--font-poppins)] ${
                              isFinal || !canReject
                                ? "text-gray-300 cursor-not-allowed"
                                : "text-red-600 hover:text-red-700"
                            } disabled:opacity-60`}
                          >
                            {actionLoading === "rejected" ? "Actualizando..." : "Rechazar"}
                          </button>
                        </div>
                      </>
                    );
                  })()}

                  {modalError ? (
                    <div className="mt-4 text-sm text-red-600 font-[family-name:var(--font-poppins)]">
                      {modalError}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="my-6 h-px bg-gray-100" />

              <div className="rounded-xl border border-gray-100 bg-white p-5">
                <div className="text-sm font-bold text-gray-900 font-[family-name:var(--font-varela-round)] mb-3">
                  Historial
                </div>
                <Timeline
                  items={history}
                  loading={historyLoading}
                  refundProofUrl={
                    getLatestHistoryStatusKey(history) === "refund_refunded"
                      ? getMediaUrl(activeRefund?.file_url || activeRefund?.evidence_url || activeRefund?.file)
                      : undefined
                  }
                />
              </div>
            </div>
          </div>

          {isRejectModalOpen ? (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
              onClick={closeRejectModal}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden border border-gray-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div className="text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                    Rechazar pedido
                  </div>
                  <button
                    onClick={closeRejectModal}
                    disabled={actionLoading !== null}
                    className="inline-flex items-center justify-center rounded-full p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                    aria-label="Cerrar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-6 py-5">
                  <label className="block text-sm font-semibold text-gray-900 font-[family-name:var(--font-poppins)] mb-2">
                    Motivo del rechazo
                  </label>
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-[family-name:var(--font-poppins)] outline-none focus:ring-2 focus:ring-[#004e28]/20 focus:border-[#004e28]/40"
                    placeholder="Describe el motivo..."
                    disabled={actionLoading !== null}
                  />
                  <div className="mt-2 text-xs text-gray-500 font-[family-name:var(--font-poppins)]">
                    Mínimo 10 caracteres.
                  </div>

                  <div className="mt-5 flex items-center justify-end gap-3">
                    <button
                      onClick={closeRejectModal}
                      disabled={actionLoading !== null}
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)] text-gray-700 hover:bg-gray-50 border border-gray-200 disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={submitRejection}
                      disabled={actionLoading !== null || rejectNote.trim().length < 10}
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)] text-white disabled:opacity-60"
                      style={{ backgroundColor: "#ef4444" }}
                    >
                      {actionLoading === "reject" ? (
                        rejectSpinnerVisible ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Confirmando...
                          </>
                        ) : (
                          "Confirmando..."
                        )
                      ) : (
                        "Confirmar Rechazo"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {isRefundApproveModalOpen ? (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
              onClick={closeRefundApproveModal}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden border border-gray-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div className="text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                    Aprobar Reembolso
                  </div>
                  <button
                    onClick={closeRefundApproveModal}
                    disabled={actionLoading !== null}
                    className="inline-flex items-center justify-center rounded-full p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                    aria-label="Cerrar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-6 py-5">
                  <label className="block text-sm font-semibold text-gray-900 font-[family-name:var(--font-poppins)] mb-2">
                    Nota (opcional)
                  </label>
                  <textarea
                    value={refundApproveNote}
                    onChange={(e) => setRefundApproveNote(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-[family-name:var(--font-poppins)] outline-none focus:ring-2 focus:ring-[#004e28]/20 focus:border-[#004e28]/40"
                    placeholder="Agrega una nota si aplica..."
                    disabled={actionLoading !== null}
                  />

                  {modalError ? (
                    <div className="mt-3 text-sm text-red-600 font-[family-name:var(--font-poppins)]">
                      {modalError}
                    </div>
                  ) : null}

                  <div className="mt-5 flex items-center justify-end gap-3">
                    <button
                      onClick={closeRefundApproveModal}
                      disabled={actionLoading !== null}
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)] text-gray-700 hover:bg-gray-50 border border-gray-200 disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={submitRefundApprove}
                      disabled={actionLoading !== null}
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)] text-white disabled:opacity-60"
                      style={{ backgroundColor: "#004e28" }}
                    >
                      {actionLoading === "refund_approve" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Procesando...
                        </>
                      ) : (
                        "Aprobar Reembolso"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {isRefundRejectModalOpen ? (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
              onClick={closeRefundRejectModal}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden border border-gray-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div className="text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                    Rechazar Reembolso
                  </div>
                  <button
                    onClick={closeRefundRejectModal}
                    disabled={actionLoading !== null}
                    className="inline-flex items-center justify-center rounded-full p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                    aria-label="Cerrar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-6 py-5">
                  <label className="block text-sm font-semibold text-gray-900 font-[family-name:var(--font-poppins)] mb-2">
                    Motivo (obligatorio)
                  </label>
                  <textarea
                    value={refundRejectReason}
                    onChange={(e) => setRefundRejectReason(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-[family-name:var(--font-poppins)] outline-none focus:ring-2 focus:ring-[#004e28]/20 focus:border-[#004e28]/40"
                    placeholder="Escribe el motivo..."
                    disabled={actionLoading !== null}
                  />

                  {modalError ? (
                    <div className="mt-3 text-sm text-red-600 font-[family-name:var(--font-poppins)]">
                      {modalError}
                    </div>
                  ) : null}

                  <div className="mt-5 flex items-center justify-end gap-3">
                    <button
                      onClick={closeRefundRejectModal}
                      disabled={actionLoading !== null}
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)] text-gray-700 hover:bg-gray-50 border border-gray-200 disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={submitRefundReject}
                      disabled={actionLoading !== null || !refundRejectReason.trim()}
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)] text-white disabled:opacity-60"
                      style={{ backgroundColor: "#ef4444" }}
                    >
                      {actionLoading === "refund_reject" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Procesando...
                        </>
                      ) : (
                        "Rechazar Reembolso"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {isRefundFinalizeModalOpen ? (
            <div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
              onClick={closeRefundFinalizeModal}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="w-full max-w-xl rounded-2xl bg-white shadow-xl overflow-hidden border border-gray-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <div className="text-base font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                    Finalizar Reembolso
                  </div>
                  <button
                    onClick={closeRefundFinalizeModal}
                    disabled={actionLoading !== null}
                    className="inline-flex items-center justify-center rounded-full p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                    aria-label="Cerrar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 font-[family-name:var(--font-poppins)] mb-2">
                      Nota (opcional)
                    </label>
                    <textarea
                      value={refundFinalizeNote}
                      onChange={(e) => setRefundFinalizeNote(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-[family-name:var(--font-poppins)] outline-none focus:ring-2 focus:ring-[#004e28]/20 focus:border-[#004e28]/40"
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
                      helperText="Arrastra y suelta o haz clic para adjuntar (imagen o PDF)"
                    />
                  </div>

                  {modalError ? (
                    <div className="text-sm text-red-600 font-[family-name:var(--font-poppins)]">
                      {modalError}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={closeRefundFinalizeModal}
                      disabled={actionLoading !== null}
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)] text-gray-700 hover:bg-gray-50 border border-gray-200 disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={submitRefundFinalize}
                      disabled={actionLoading !== null || !refundFinalizeFile}
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)] text-white disabled:opacity-60"
                      style={{ backgroundColor: "#3b82f6" }}
                    >
                      {actionLoading === "refund_mark_refunded" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Procesando...
                        </>
                      ) : (
                        "Finalizar Reembolso"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
