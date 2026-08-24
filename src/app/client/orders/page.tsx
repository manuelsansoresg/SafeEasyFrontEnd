"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import { orderService, Order, OrderHistoryItem, OrderRefund } from "@/services/orderService";
import FileUpload from "@/components/ui/FileUpload";
import { PageHero } from "@/components/ui/PageHero";
import StarRating from "@/components/StarRating";
import {
  Loader2,
  Package,
  X,
  Image as ImageIcon,
  Copy,
  CheckCircle,
  AlertTriangle,
  BadgeCheck,
  Check,
  Clock,
  FileText,
  MapPin,
  PackageCheck,
  Search,
  SlidersHorizontal,
  Store,
  Truck,
} from "lucide-react";

function getImageUrl(path: string | null | undefined) {
  if (!path) return "/placeholder.png";
  if (path.startsWith("http") || path.startsWith("https") || path.startsWith("data:")) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api").replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`.replace(/([^:])\/{2,}/g, "$1/");
}

function formatMoney(value: string | number | undefined) {
  const numberValue =
    typeof value === "number" ? value : typeof value === "string" ? Number(String(value).replace(/[^\d.-]/g, "")) : 0;
  const safe = Number.isFinite(numberValue) ? numberValue : 0;
  return safe.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function getOrderStatusRaw(order: Order) {
  if (isExpiredCheckout(order)) return "expired";
  return (order.fulfillment_status || order.visual_status || order.payment_status || order.status || "pending")
    .toString()
    .trim();
}

function isExpiredCheckout(order: Order) {
  return [order.status, order.payment_status, order.fulfillment_status, order.visual_status].some(
    (value) => normalizeStatusKey(String(value || "")) === "expired"
  );
}

function getOrderStatusKey(order: Order) {
  return getOrderStatusRaw(order).toLowerCase();
}

function isPendingStatus(value: string) {
  const v = (value || "").toLowerCase();
  return v === "pending" || v === "pendiente";
}

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
  if (
    v === "preparing" ||
    v === "start_preparing" ||
    v === "started_preparing" ||
    v === "in_preparation" ||
    v === "en_preparacion" ||
    v === "en_preparación"
  )
    return "preparing";
  if (v === "ready_for_pickup" || v === "ready_pickup" || v === "listo_para_recoger" || v === "listo_para_recojer")
    return "ready_for_pickup";
  if (v === "en_route_to_pickup" || v === "going_to_pickup" || v === "camino_a_recoger") return "en_route_to_pickup";
  if (v === "picked_up" || v === "pickup_completed" || v === "recogido") return "picked_up";
  if (v === "en_route_to_delivery" || v === "out_for_delivery" || v === "camino_a_entregar") return "in_transit";
  if (v === "in_transit" || v === "transit" || v === "en_camino") return "in_transit";
  if (v === "rejected" || v === "rechazado" || v === "payment_rejected" || v === "pago_rechazado")
    return "payment_rejected";
  if (v === "cancelled" || v === "cancelado") return "cancelled";
  if (v === "expired" || v === "expirado" || v === "checkout_expired" || v === "checkout_expirado") return "expired";
  if (v === "receipt_uploaded" || v === "comprobante_subido") return "receipt_uploaded";
  if (v === "created" || v === "creado") return "created";
  if (v === "refund_requested" || v === "reembolso_solicitado") return "refund_requested";
  if (v === "refund_refunded" || v === "refunded" || v === "reembolsado") return "refund_refunded";
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
    preparing: "En preparación",
    ready_for_pickup: "Listo para recoger",
    en_route_to_pickup: "En camino a recoger",
    picked_up: "Producto recogido",
    in_transit: "En camino",
    receipt_uploaded: "Comprobante subido",
    payment_rejected: "Pago rechazado",
    cancelled: "Cancelado",
    expired: "Checkout expirado",
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
    [/(^|[^a-z0-9_])payment_rejected([^a-z0-9_]|$)/gi, "$1Pago rechazado$2"],
    [/(^|[^a-z0-9_])receipt_uploaded([^a-z0-9_]|$)/gi, "$1Comprobante subido$2"],
    [/(^|[^a-z0-9_])verified([^a-z0-9_]|$)/gi, "$1Verificado$2"],
    [/(^|[^a-z0-9_])paid([^a-z0-9_]|$)/gi, "$1Pago verificado$2"],
    [/(^|[^a-z0-9_])pending([^a-z0-9_]|$)/gi, "$1Pendiente$2"],
    [/(^|[^a-z0-9_])created([^a-z0-9_]|$)/gi, "$1Creado$2"],
    [/(^|[^a-z0-9_])completed([^a-z0-9_]|$)/gi, "$1Completado$2"],
    [/(^|[^a-z0-9_])shipped([^a-z0-9_]|$)/gi, "$1Enviado$2"],
    [/(^|[^a-z0-9_])expired([^a-z0-9_]|$)/gi, "$1Checkout expirado$2"],
    [/(^|[^a-z0-9_])cancelled([^a-z0-9_]|$)/gi, "$1Cancelado$2"],
  ];

  let out = raw;
  for (const [re, rep] of replacements) out = out.replace(re, rep);
  return out;
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

function formatOrderDate(value: string | undefined | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }).replace(/\./g, "");
}

function isDateInRange(value: string | undefined | null, range: string) {
  if (range === "all") return true;
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (range === "today") return d >= start;
  if (range === "week") {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() - 7);
    return d >= weekStart;
  }
  if (range === "month") {
    const monthStart = new Date(start.getFullYear(), start.getMonth(), 1);
    return d >= monthStart;
  }
  return true;
}

function isOrderReadyForDelivery(order: Order) {
  const key = normalizeStatusKey(getOrderStatusRaw(order));
  return key === "ready_for_pickup" || key === "en_route_to_pickup" || key === "picked_up" || key === "shipped" || key === "in_transit";
}

function isCompletedOrder(order: Order, latestHistoryKey?: string) {
  const key = normalizeStatusKey(latestHistoryKey || getOrderStatusRaw(order));
  return key === "completed" || key === "delivered" || key === "verified";
}

function getOrderRatingId(order: Order) {
  const record = order as unknown as Record<string, unknown>;
  const raw =
    record.rating_id ??
    record.product_rating_id ??
    record.review_id ??
    record.rated_at ??
    record.rating ??
    record.review ??
    record.has_rating ??
    record.is_rated;
  return raw === undefined || raw === null || raw === false ? null : String(raw);
}

function getOrderStatusGroup(order: Order) {
  const key = normalizeStatusKey(getOrderStatusRaw(order));
  if (isOrderReadyForDelivery(order)) return "ready";
  if (key === "completed" || key === "verified") return "completed";
  if (key === "expired") return "expired";
  if (key === "cancelled" || key === "payment_rejected") return "cancelled";
  if (key.startsWith("refund_")) return "refund";
  return "pending";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return fallback;
}

function DeliveryTypePill({ order }: { order: Order }) {
  const mode = getDeliveryTypeKey(order);
  const label = mode === "shipping" ? "Envío" : "Recoger";
  const bg = "#004e2814";
  const fg = "#004e28";
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
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 800 420" preserveAspectRatio="none" aria-hidden="true">
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
      <div className="relative h-[220px]" />
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
          const bg = done || active ? `${baseColor}14` : "#f3f4f6";
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

function StatusBadge({ value }: { value: string }) {
  const normalized = normalizeStatusKey(value);
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    pending: { bg: "#f2f3f4", fg: "#111827", label: "Pendiente" },
    pendiente: { bg: "#f2f3f4", fg: "#111827", label: "Pendiente" },
    receipt_uploaded: { bg: "#3b82f6", fg: "#ffffff", label: "Comprobante subido" },
    comprobante_subido: { bg: "#3b82f6", fg: "#ffffff", label: "Comprobante subido" },
    "comprobante subido": { bg: "#3b82f6", fg: "#ffffff", label: "Comprobante subido" },
    paid: { bg: "#168e00", fg: "#ffffff", label: "Pago verificado" },
    pagado: { bg: "#168e00", fg: "#ffffff", label: "Pago verificado" },
    validado: { bg: "#168e00", fg: "#ffffff", label: "Pago verificado" },
    validated: { bg: "#168e00", fg: "#ffffff", label: "Pago verificado" },
    shipped: { bg: "#fbbf24", fg: "#000000", label: "Enviado" },
    enviado: { bg: "#fbbf24", fg: "#000000", label: "Enviado" },
    ready_for_pickup: { bg: "#f2f3f4", fg: "#111827", label: "Listo para recoger" },
    en_route_to_pickup: { bg: "#004e2814", fg: "#004e28", label: "En camino a recoger" },
    picked_up: { bg: "#004e2814", fg: "#004e28", label: "Producto recogido" },
    in_transit: { bg: "#004e2814", fg: "#004e28", label: "En camino" },
    completed: { bg: "#004e28", fg: "#ffffff", label: "Completado" },
    completado: { bg: "#004e28", fg: "#ffffff", label: "Completado" },
    verified: { bg: "#004e28", fg: "#ffffff", label: "Verificado" },
    verificado: { bg: "#004e28", fg: "#ffffff", label: "Verificado" },
    rejected: { bg: "#ef4444", fg: "#ffffff", label: "Pago rechazado" },
    rechazado: { bg: "#ef4444", fg: "#ffffff", label: "Pago rechazado" },
    payment_rejected: { bg: "#ef4444", fg: "#ffffff", label: "Pago rechazado" },
    "pago rechazado": { bg: "#ef4444", fg: "#ffffff", label: "Pago rechazado" },
    cancelled: { bg: "#6b7280", fg: "#ffffff", label: "Cancelado" },
    cancelado: { bg: "#6b7280", fg: "#ffffff", label: "Cancelado" },
    expired: { bg: "#f2f3f4", fg: "#000000", label: "Checkout expirado" },
    expirado: { bg: "#f2f3f4", fg: "#000000", label: "Checkout expirado" },
    checkout_expired: { bg: "#f2f3f4", fg: "#000000", label: "Checkout expirado" },
    created: { bg: "#f2f3f4", fg: "#111827", label: "Creado" },
    creado: { bg: "#f2f3f4", fg: "#111827", label: "Creado" },
    refund_requested: { bg: "#f59e0b", fg: "#000000", label: "Reembolso solicitado" },
    refund_approved: { bg: "#004e28", fg: "#ffffff", label: "Reembolso aprobado" },
    refund_rejected: { bg: "#ef4444", fg: "#ffffff", label: "Reembolso rechazado" },
    refund_refunded: { bg: "#3b82f6", fg: "#ffffff", label: "Reembolsado" },
  };

  const meta = map[normalized] || { bg: "#f2f3f4", fg: "#111827", label: toSpanishStatusLabel(value) || "—" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap font-[family-name:var(--font-poppins)]"
      style={{ backgroundColor: meta.bg, color: meta.fg }}
      title={toSpanishStatusLabel(value)}
    >
      {meta.label}
    </span>
  );
}

function Timeline({ items, loading }: { items: OrderHistoryItem[]; loading: boolean }) {
  const rows = useMemo(() => {
    const normalize = (h: OrderHistoryItem) => {
      const rawAt = h.created_at || h.timestamp || h.date || "";
      const at = rawAt ? new Date(rawAt) : null;
      const ts = at && !Number.isNaN(at.getTime()) ? at.getTime() : 0;
      const timeLabel =
        at && !Number.isNaN(at.getTime())
          ? at.toLocaleString("es-MX", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })
          : rawAt || "";

      const rawEvent =
        (typeof h.status === "string" && h.status) ||
        (typeof h.event === "string" && h.event) ||
        (typeof h.action === "string" && h.action) ||
        "";

      const description = (h.description || h.message || "").toString().trim();
      const actor =
        (typeof h.actor === "string" && h.actor) ||
        (h.user && typeof h.user === "object"
          ? (typeof h.user.name === "string" && h.user.name) || (typeof h.user.role === "string" && h.user.role)
          : "") ||
        "";

      const title = rawEvent ? toSpanishHistoryText(rawEvent) : description ? "Actualización" : "Evento";
      const detail = description ? toSpanishHistoryText(description) : "";
      return { timeLabel, title, detail, actor, ts };
    };

    return [...items]
      .map((i) => normalize(i))
      .sort((a, b) => {
        return b.ts - a.ts;
      });
  }, [items]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 font-[family-name:var(--font-poppins)]">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando historial...
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="text-sm text-gray-500 font-[family-name:var(--font-poppins)]">Aún no hay movimientos.</div>
    );
  }

  return (
    <div className="max-h-[380px] overflow-y-auto pr-2">
      <div className="space-y-4">
        {rows.map((row, idx) => {
          const isLast = idx === rows.length - 1;
          return (
            <div key={idx} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="h-2 w-2 rounded-full bg-[#004e28]" />
                {!isLast ? <div className="w-px flex-1 bg-gray-200 mt-1" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-500 font-[family-name:var(--font-poppins)]">
                  {row.timeLabel}
                  {row.actor ? <span className="text-gray-300"> • </span> : null}
                  {row.actor ? <span className="text-gray-500">{row.actor}</span> : null}
                </div>
                <div className="mt-1 text-sm font-semibold text-gray-900 font-[family-name:var(--font-poppins)]">
                  {row.title}
                </div>
                {row.detail ? (
                  <div className="mt-1 text-sm text-gray-700 font-[family-name:var(--font-poppins)]">{row.detail}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ClientOrdersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<OrderHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refundLoading, setRefundLoading] = useState(false);
  const [activeRefund, setActiveRefund] = useState<OrderRefund | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundEvidence, setRefundEvidence] = useState<File | null>(null);
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState<string | null>(null);
  const [refundRequestedByOrderId, setRefundRequestedByOrderId] = useState<Record<string, true>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [ordersPage, setOrdersPage] = useState(1);
  const [ratedOrdersById, setRatedOrdersById] = useState<Record<string, true>>({});
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const ordersLimit = 10;

  const refundRequestedStorageKey = "safeeasy:refund_requested_v1";
  const ratedOrdersStorageKey = "safeeasy:rated_orders_v1";

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(refundRequestedStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
      setRefundRequestedByOrderId(parsed as Record<string, true>);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(ratedOrdersStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
      setRatedOrdersById(parsed as Record<string, true>);
    } catch {}
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await orderService.getMyOrders();
      setOrders(data);
    } catch (e: unknown) {
      setError(getErrorMessage(e, "No se pudieron cargar tus pedidos."));
    } finally {
      setLoading(false);
    }
  };

  const pickLatestRefund = (items: OrderRefund[]) => {
    if (!items.length) return null;
    const scored = [...items]
      .map((r) => {
        const rawAt = r.updated_at || r.created_at || "";
        const at = rawAt ? new Date(rawAt) : null;
        const ts = at && !Number.isNaN(at.getTime()) ? at.getTime() : 0;
        const hasFile = Boolean(r.file_url || r.evidence_url || r.file);
        return { r, ts, hasFile };
      })
      .sort((a, b) => {
        if (a.hasFile !== b.hasFile) return a.hasFile ? -1 : 1;
        return b.ts - a.ts;
      });
    return scored[0]?.r ?? null;
  };

  const getLatestHistoryStatusKey = (items: OrderHistoryItem[]) => {
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
        return { ts, key: normalizeStatusKey(candidate), rawEvent, description };
      })
      .sort((a, b) => b.ts - a.ts);
    return scored[0]?.key || "";
  };

  const openModal = async (order: Order) => {
    setSelectedOrder(order);
    setModalError(null);
    setModalSuccess(null);
    setRatingValue(0);
    setRatingComment("");
    setRatingError(null);
    setRatingSubmitting(false);
    setHistory([]);
    setHistoryLoading(true);
    setRefundLoading(true);
    setActiveRefund(null);
    try {
      const [historyResult, refundsResult] = await Promise.allSettled([
        orderService.getOrderHistory(order.id),
        orderService.getOrderRefunds(order.id),
      ]);

      if (historyResult.status === "fulfilled") {
        setHistory(historyResult.value);
      } else {
        setHistory([]);
      }

      if (refundsResult.status === "fulfilled") {
        setActiveRefund(pickLatestRefund(refundsResult.value));
      } else {
        setActiveRefund(null);
      }
    } catch (e: unknown) {
      setModalError(getErrorMessage(e, "No se pudo cargar el historial."));
    } finally {
      setHistoryLoading(false);
      setRefundLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedOrder(null);
    setHistory([]);
    setHistoryLoading(false);
    setRefundLoading(false);
    setActiveRefund(null);
    setModalError(null);
    setModalSuccess(null);
    setUploading(false);
    setPreviewUrl(null);
    setReceiptFile(null);
    setIsRefundModalOpen(false);
    setRefundReason("");
    setRefundEvidence(null);
    setRefundSubmitting(false);
    setRefundError(null);
    setRefundSuccess(null);
    setRatingValue(0);
    setRatingComment("");
    setRatingError(null);
    setRatingSubmitting(false);
  };

  useEffect(() => {
    loadOrders();
  }, [user?.id]);

  const handleCopy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setModalSuccess("CLABE copiada. Pega esta información en tu app bancaria.");
      setTimeout(() => setModalSuccess(null), 3000);
    } catch {
      setModalError("No se pudo copiar. Intenta seleccionarla manualmente.");
      setTimeout(() => setModalError(null), 3000);
    }
  };

  const handleFileChange = async (file: File | null) => {
    if (!file || !selectedOrder) return;
    setUploading(true);
    setModalError(null);
    setModalSuccess(null);

    try {
      await orderService.uploadOrderReceipt(selectedOrder.id, file);
      setModalSuccess("Comprobante enviado con éxito.");
      const updatedOrders = await orderService.getMyOrders();
      setOrders(updatedOrders);
      const updatedOrder = updatedOrders.find((o) => o.id === selectedOrder.id) || null;
      if (updatedOrder) setSelectedOrder(updatedOrder);
      setReceiptFile(null);

      const hasReceiptEvent = (items: OrderHistoryItem[]) => {
        return items.some((h) => {
          const v = ((h.status || h.event || h.action || "") as string).toLowerCase();
          return v.includes("receipt") || v.includes("comprobante");
        });
      };

      let last: OrderHistoryItem[] = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        last = await orderService.getOrderHistory(selectedOrder.id);
        setHistory(last);
        if (hasReceiptEvent(last)) break;
        await new Promise((r) => setTimeout(r, 900));
      }

      setTimeout(() => setModalSuccess(null), 3500);
    } catch (e: unknown) {
      setModalError(getErrorMessage(e, "No se pudo subir el comprobante."));
    } finally {
      setUploading(false);
    }
  };

  const canRequestRefund = useMemo(() => {
    if (!selectedOrder) return false;
    const isCompleted = normalizeStatusKey(getOrderStatusRaw(selectedOrder)) === "completed";
    const alreadyRequested = Boolean(refundRequestedByOrderId[String(selectedOrder.id)]);
    return isCompleted && !alreadyRequested;
  }, [selectedOrder, refundRequestedByOrderId]);

  const refundAlreadyRequested = useMemo(() => {
    if (!selectedOrder) return false;
    return Boolean(refundRequestedByOrderId[String(selectedOrder.id)]);
  }, [selectedOrder, refundRequestedByOrderId]);

  const latestHistoryKey = useMemo(() => getLatestHistoryStatusKey(history), [history]);

  const isRefundRequestedInHistory = latestHistoryKey === "refund_requested";
  const isRefundFinalizedInHistory = latestHistoryKey === "refund_refunded";

  const selectedOrderAlreadyRated = useMemo(() => {
    if (!selectedOrder) return false;
    return Boolean(getOrderRatingId(selectedOrder) || ratedOrdersById[String(selectedOrder.id)]);
  }, [selectedOrder, ratedOrdersById]);

  const canRateSelectedOrder = useMemo(() => {
    if (!selectedOrder) return false;
    return isCompletedOrder(selectedOrder, latestHistoryKey) && !selectedOrderAlreadyRated;
  }, [selectedOrder, latestHistoryKey, selectedOrderAlreadyRated]);

  const refundProofUrl = useMemo(() => {
    const raw = activeRefund?.file_url || activeRefund?.evidence_url || activeRefund?.file || null;
    if (!raw) return null;
    return getImageUrl(raw);
  }, [activeRefund]);

  const footerMessage = useMemo(() => {
    if (isRefundRequestedInHistory) return "Reembolso en revisión por el proveedor.";
    if (isRefundFinalizedInHistory) return "Tu reembolso ha sido finalizado con éxito.";
    if (refundAlreadyRequested) return "Reembolso en revisión por el proveedor.";
    return null;
  }, [isRefundRequestedInHistory, isRefundFinalizedInHistory, refundAlreadyRequested]);

  const openRefundModal = () => {
    if (!selectedOrder) return;
    setRefundReason("");
    setRefundEvidence(null);
    setRefundError(null);
    setRefundSuccess(null);
    setRefundSubmitting(false);
    setIsRefundModalOpen(true);
  };

  const closeRefundModal = () => {
    if (refundSubmitting) return;
    setIsRefundModalOpen(false);
    setRefundReason("");
    setRefundEvidence(null);
    setRefundError(null);
    setRefundSuccess(null);
  };

  const markOrderRated = (orderId: number) => {
    setRatedOrdersById((prev) => {
      const next = { ...prev, [String(orderId)]: true as const };
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(ratedOrdersStorageKey, JSON.stringify(next));
        }
      } catch {}
      return next;
    });
  };

  const submitOrderRating = async () => {
    if (!selectedOrder || !user) return;
    if (!canRateSelectedOrder) return;
    if (ratingValue === 0) {
      setRatingError("Selecciona una puntuación.");
      return;
    }

    const comment = ratingComment.trim();
    if (!comment) {
      setRatingError("Escribe un comentario breve sobre tu experiencia.");
      return;
    }

    setRatingSubmitting(true);
    setRatingError(null);
    setModalSuccess(null);
    setModalError(null);

    try {
      const productId = selectedOrder.product?.id || selectedOrder.product_id;
      if (!productId) throw new Error("No encontramos el producto de este pedido.");

      const payload = {
        rating: ratingValue,
        comment,
        product_id: productId,
        user_id: user.id,
        is_approved: true,
      };

      const response = await fetchWithAuth(`/api/products/${productId}/ratings`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        let detail = "";
        try {
          const data = JSON.parse(errorText) as Record<string, unknown>;
          detail =
            (typeof data.detail === "string" && data.detail) ||
            (typeof data.message === "string" && data.message) ||
            "";
        } catch {}

        if (detail === "You have already rated this product") {
          detail = "Ya calificaste este producto anteriormente.";
        }

        throw new Error(detail || "No se pudo guardar tu calificación.");
      }

      markOrderRated(selectedOrder.id);
      setRatingValue(0);
      setRatingComment("");
      setModalSuccess("Calificación enviada. Gracias por compartir tu experiencia.");

      const updatedOrders = await orderService.getMyOrders();
      setOrders(updatedOrders);
      const updatedOrder = updatedOrders.find((o) => o.id === selectedOrder.id) || null;
      if (updatedOrder) setSelectedOrder(updatedOrder);

      setTimeout(() => setModalSuccess(null), 3500);
    } catch (e: unknown) {
      setRatingError(getErrorMessage(e, "No se pudo guardar tu calificación."));
    } finally {
      setRatingSubmitting(false);
    }
  };

  const handleRefundEvidenceChange = (file: File | null) => {
    setRefundError(null);
    setRefundSuccess(null);
    setRefundEvidence(file);
  };

  const submitRefund = async () => {
    if (!selectedOrder) return;
    const reason = refundReason.trim();
    if (!reason) {
      setRefundError("Por favor escribe el motivo del reembolso.");
      return;
    }

    setRefundSubmitting(true);
    setRefundError(null);
    setRefundSuccess(null);
    try {
      await orderService.requestOrderRefund(selectedOrder.id, reason, refundEvidence);
      setRefundSuccess("Solicitud de reembolso enviada.");
      setModalSuccess("Solicitud de reembolso enviada.");
      setRefundRequestedByOrderId((prev) => {
        const next = { ...prev, [String(selectedOrder.id)]: true as const };
        try {
          if (typeof window !== "undefined") {
            window.localStorage.setItem(refundRequestedStorageKey, JSON.stringify(next));
          }
        } catch {}
        return next;
      });

      const updatedOrders = await orderService.getMyOrders();
      setOrders(updatedOrders);
      const updatedOrder = updatedOrders.find((o) => o.id === selectedOrder.id) || null;
      if (updatedOrder) setSelectedOrder(updatedOrder);

      try {
        const items = await orderService.getOrderHistory(selectedOrder.id);
        setHistory(items);
      } catch {}

      setTimeout(() => setModalSuccess(null), 3500);
      setTimeout(() => closeRefundModal(), 600);
    } catch (e: unknown) {
      setRefundError(getErrorMessage(e, "No se pudo solicitar el reembolso."));
    } finally {
      setRefundSubmitting(false);
    }
  };

  const readyOrders = useMemo(() => {
    return [...orders]
      .filter(isOrderReadyForDelivery)
      .sort((a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime());
  }, [orders]);

  const regularOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...orders]
      .filter((order) => {
        if (isOrderReadyForDelivery(order)) return false;
        const mode = getDeliveryTypeKey(order);
        if (deliveryFilter !== "all" && mode !== deliveryFilter) return false;
        if (statusFilter !== "all" && getOrderStatusGroup(order) !== statusFilter) return false;
        if (!isDateInRange(order.created_at, dateFilter)) return false;
        if (!q) return true;
        const haystack = [
          order.id,
          order.product?.title,
          order.supplier?.name,
          getOrderStatusRaw(order),
          mode === "shipping" ? "envio" : "recoger",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        return new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime();
      });
  }, [orders, searchQuery, deliveryFilter, statusFilter, dateFilter]);

  useEffect(() => {
    setOrdersPage(1);
  }, [searchQuery, deliveryFilter, statusFilter, dateFilter]);

  const totalRegularPages = Math.max(1, Math.ceil(regularOrders.length / ordersLimit));
  const safeOrdersPage = Math.min(ordersPage, totalRegularPages);
  const ordersStart = (safeOrdersPage - 1) * ordersLimit;
  const ordersEnd = ordersStart + ordersLimit;
  const paginatedRegularOrders = regularOrders.slice(ordersStart, ordersEnd);
  const visibleOrders = [...readyOrders, ...paginatedRegularOrders];
  const visibleOrdersStart = regularOrders.length ? ordersStart + 1 : 0;
  const visibleOrdersEnd = Math.min(ordersEnd, regularOrders.length);

  useEffect(() => {
    if (ordersPage > totalRegularPages) setOrdersPage(totalRegularPages);
  }, [ordersPage, totalRegularPages]);

  const renderOrdersTable = (items: Order[], emptyMessage: string) => {
    if (!items.length) {
      return (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow font-[family-name:var(--font-poppins)]">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Pedidos
          </div>
          <div className="px-6 py-8 text-center text-sm text-gray-500">
            {emptyMessage}
          </div>
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left font-[family-name:var(--font-poppins)]">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">ID</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Entrega</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Monto</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Proveedor</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Creado</th>
                <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((order) => (
                <tr key={order.id} className="transition-colors hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <span>#{order.id}</span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <DeliveryTypePill order={order} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatMoney(order.total_amount ?? order.product?.price ?? 0)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <StatusBadge value={getOrderStatusRaw(order)} />
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex flex-col">
                      <span className="text-gray-900">{order.supplier?.name || "Proveedor desconocido"}</span>
                      <span className="text-xs text-gray-400">ID: {order.supplier_id || order.supplier?.id || "-"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatOrderDate(order.created_at)}</td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex flex-wrap gap-2">
                      {isCompletedOrder(order) ? (
                        getOrderRatingId(order) || ratedOrdersById[String(order.id)] ? (
                          <span className="inline-flex items-center justify-center rounded-md border border-[#004e28]/20 bg-[#004e28]/10 px-3 py-2 text-xs font-semibold text-[#004e28]">
                            Calificado
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openModal(order)}
                            className="inline-flex items-center justify-center rounded-md px-3 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
                            style={{ backgroundColor: "#168e00" }}
                          >
                            Calificar
                          </button>
                        )
                      ) : null}
                      <button
                        onClick={() => router.push(`/client/orders/${order.id}`)}
                        className="inline-flex items-center justify-center rounded-md px-4 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
                        style={{ backgroundColor: "#004e28" }}
                      >
                        Ver detalle
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-gray-100">
          {items.map((order) => {
            const image = getImageUrl(order.product?.thumbnail_url || order.product?.image || null);
            return (
              <div key={order.id} className="bg-white p-5">
                <div className="flex items-start gap-4">
                  <div
                    className="h-16 w-16 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 bg-cover bg-center shrink-0"
                    style={{ backgroundImage: `url(${image})` }}
                    role="img"
                    aria-label={order.product?.title || "Producto"}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold uppercase tracking-[0.12em] text-gray-400">ID Orden</div>
                    <div className="text-lg font-extrabold text-[#004e28]">#{order.id}</div>
                    <div className="mt-1 line-clamp-2 text-sm font-bold text-gray-900">{order.product?.title || "Producto"}</div>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">Monto</div>
                    <div className="mt-1 font-bold text-gray-900">{formatMoney(order.total_amount ?? order.product?.price ?? 0)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">Fecha</div>
                    <div className="mt-1 text-gray-600">{formatOrderDate(order.created_at)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">Tipo</div>
                    <div className="mt-1"><DeliveryTypePill order={order} /></div>
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">Estado</div>
                    <div className="mt-1"><StatusBadge value={getOrderStatusRaw(order)} /></div>
                  </div>
                </div>
                <div className="mt-5 grid gap-2">
                  {isCompletedOrder(order) ? (
                    getOrderRatingId(order) || ratedOrdersById[String(order.id)] ? (
                      <div className="rounded-xl border border-[#004e28]/20 bg-[#004e28]/10 px-4 py-3 text-center text-sm font-bold text-[#004e28]">
                        Calificado
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openModal(order)}
                        className="w-full rounded-xl bg-[#168e00] px-4 py-3 text-sm font-bold text-white"
                      >
                        Calificar
                      </button>
                    )
                  ) : null}
                  <button
                    onClick={() => router.push(`/client/orders/${order.id}`)}
                    className="w-full rounded-xl bg-[#004e28] px-4 py-3 text-sm font-bold text-white"
                  >
                    Ver detalle
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[420px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#004e28]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
        <div className="flex items-center gap-3 text-red-600 font-[family-name:var(--font-poppins)]">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
        </div>
        <button
          onClick={loadOrders}
          className="mt-6 inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white font-[family-name:var(--font-poppins)]"
          style={{ backgroundColor: "#004e28" }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Mis Pedidos"
        subtitle="Revisa el estado de tus compras y sube tu comprobante cuando sea necesario."
        actions={
          <>
          <span className="bg-[#004e28]/10 text-[#004e28] px-3 py-1 rounded-full text-sm font-semibold font-[family-name:var(--font-poppins)]">
            Mostrando {visibleOrdersStart}-{visibleOrdersEnd} de {regularOrders.length} pedidos
          </span>
          {readyOrders.length ? (
            <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-sm font-semibold font-[family-name:var(--font-poppins)]">
              {readyOrders.length} listos
            </span>
          ) : null}
          </>
        }
      />

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[380px] text-center p-8 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="w-16 h-16 bg-[#004e28]/10 rounded-full flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-[#004e28]" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2 font-[family-name:var(--font-varela-round)]">
            Aún no tienes pedidos
          </h2>
          <p className="text-gray-500 max-w-md font-[family-name:var(--font-poppins)]">
            Cuando realices una compra, aparecerá aquí para que puedas darle seguimiento.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por orden o proveedor"
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-[#004e28]/40 focus:ring-4 focus:ring-[#004e28]/10 font-[family-name:var(--font-poppins)]"
                />
              </label>
              <label className="relative block">
                <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm font-semibold text-gray-700 outline-none transition focus:border-[#004e28]/40 focus:ring-4 focus:ring-[#004e28]/10 font-[family-name:var(--font-poppins)]"
                >
                  <option value="all">Todos los estados</option>
                  <option value="pending">Pendientes</option>
                  <option value="completed">Completados</option>
                  <option value="refund">Reembolsos</option>
                  <option value="expired">Expirados</option>
                  <option value="cancelled">Cancelados</option>
                </select>
              </label>
              <label className="relative block">
                <Truck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  value={deliveryFilter}
                  onChange={(e) => setDeliveryFilter(e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm font-semibold text-gray-700 outline-none transition focus:border-[#004e28]/40 focus:ring-4 focus:ring-[#004e28]/10 font-[family-name:var(--font-poppins)]"
                >
                  <option value="all">Todos los tipos</option>
                  <option value="shipping">Envío</option>
                  <option value="pickup">Recoger</option>
                </select>
              </label>
              <label className="relative block">
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm font-semibold text-gray-700 outline-none transition focus:border-[#004e28]/40 focus:ring-4 focus:ring-[#004e28]/10 font-[family-name:var(--font-poppins)]"
                >
                  <option value="all">Todas las fechas</option>
                  <option value="today">Hoy</option>
                  <option value="week">Últimos 7 días</option>
                  <option value="month">Este mes</option>
                </select>
              </label>
            </div>
          </div>

          <section className="space-y-3">
            {renderOrdersTable(visibleOrders, "No hay pedidos que coincidan con los filtros.")}
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-6 py-4 font-[family-name:var(--font-poppins)] shadow">
              <button
                disabled={safeOrdersPage === 1}
                onClick={() => setOrdersPage((page) => Math.max(1, page - 1))}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-700">Página {safeOrdersPage}</span>
              <button
                disabled={safeOrdersPage >= totalRegularPages || regularOrders.length === 0}
                onClick={() => setOrdersPage((page) => Math.min(totalRegularPages, page + 1))}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </section>
        </div>
      )}

      {selectedOrder ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative px-8 pt-7 pb-5 border-b border-gray-100">
              <button
                onClick={closeModal}
                className="absolute right-4 top-4 inline-flex items-center justify-center rounded-full p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                  Pedido #{selectedOrder.id}
                </h2>
                <StatusBadge value={isRefundFinalizedInHistory ? "refund_refunded" : getOrderStatusRaw(selectedOrder)} />
              </div>
              <div className="mt-1 text-sm text-gray-500 font-[family-name:var(--font-poppins)]">
                {selectedOrder.product?.title || "Producto"} • {formatMoney(selectedOrder.total_amount ?? 0)}
              </div>
            </div>

            <div className="px-8 py-6 space-y-6">
              {(() => {
                const mode = getDeliveryTypeKey(selectedOrder);
                const title = getDeliveryTitle(mode);
                const etaLabel = formatEtaLabel(selectedOrder, mode);
                const rawStatus = getOrderStatusRaw(selectedOrder);
                const currentKey = latestHistoryKey || normalizeStatusKey(rawStatus);
                const progressRank = getProgressRank(currentKey);
                const steps = getBaseProgressSteps(mode);
                const anyOrder = selectedOrder as unknown as Record<string, unknown>;
                const addressRaw =
                  (typeof anyOrder.delivery_address === "string" && anyOrder.delivery_address) ||
                  (typeof anyOrder.shipping_address === "string" && anyOrder.shipping_address) ||
                  (typeof anyOrder.address === "string" && anyOrder.address) ||
                  (typeof anyOrder.pickup_address === "string" && anyOrder.pickup_address) ||
                  "";
                const address = addressRaw && addressRaw.trim() ? addressRaw.trim() : mode === "shipping" ? selectedOrder.supplier?.name || "Sucursal" : selectedOrder.supplier?.name || "Tienda";
                const shippingGradient = "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)";
                const pickupGradient = "linear-gradient(135deg, #004e28 0%, #0b6b3a 100%)";
                const headerBg = mode === "shipping" ? shippingGradient : pickupGradient;
                return (
                  <div className="overflow-hidden rounded-2xl border border-gray-100">
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
                              {title}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold font-[family-name:var(--font-poppins)]">
                              {toSpanishStatusLabel(isRefundFinalizedInHistory ? "refund_refunded" : rawStatus)}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold font-[family-name:var(--font-poppins)]">
                              {selectedOrder.supplier?.name || "Proveedor"}
                            </span>
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
                    <div className="bg-white px-6 py-5 space-y-5">
                      <ProgressStepper steps={steps} currentRank={progressRank} />
                      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
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
                                  <span className="font-mono">{String(anyOrder.delivery_code || "—")}</span>
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
                              <span
                                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold font-[family-name:var(--font-poppins)]"
                                style={{
                                  backgroundColor: currentKey === "completed" || currentKey === "verified" ? "#004e2814" : "#3b82f614",
                                  color: currentKey === "completed" || currentKey === "verified" ? "#004e28" : "#3b82f6",
                                  border: `1px solid ${currentKey === "completed" || currentKey === "verified" ? "#004e2833" : "#3b82f633"}`,
                                }}
                              >
                                {toSpanishStatusLabel(currentKey)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {modalSuccess ? (
                <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-green-700 flex items-center gap-2 font-[family-name:var(--font-poppins)]">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">{modalSuccess}</span>
                </div>
              ) : null}
              {modalError ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-red-700 flex items-center gap-2 font-[family-name:var(--font-poppins)]">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">{modalError}</span>
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-sm font-bold text-gray-900 font-[family-name:var(--font-varela-round)] mb-3">
                    Evidencia de Pago
                  </div>

                  {selectedOrder.receipt_url ? (
                    <button
                      type="button"
                      onClick={() => setPreviewUrl(getImageUrl(selectedOrder.receipt_url))}
                      className="w-full text-left rounded-xl border border-gray-100 bg-white p-3 hover:bg-gray-50 transition-colors"
                      aria-label="Ver comprobante"
                      title="Ver comprobante"
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#f2f3f4]">
                        <img
                          src={getImageUrl(selectedOrder.receipt_url)}
                          alt="Comprobante de pago"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    </button>
                  ) : (
                    <div className="rounded-xl border border-gray-100 bg-white p-6">
                      <div className="flex flex-col items-center justify-center text-center gap-2">
                        <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                        <div className="text-sm text-gray-400 font-[family-name:var(--font-poppins)]">
                          Esperando que subas el comprobante
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-5">
                  <div className="text-sm font-bold text-gray-900 font-[family-name:var(--font-varela-round)] mb-3">
                    Acciones
                  </div>

                  {isPendingStatus(getOrderStatusKey(selectedOrder)) ? (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="text-sm font-semibold text-gray-900 font-[family-name:var(--font-poppins)]">
                          Datos de Transferencia
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-gray-700 font-[family-name:var(--font-poppins)]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-gray-500">Beneficiario</span>
                            <span className="font-semibold text-gray-900">
                              {selectedOrder.supplier?.transfer_name || "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-gray-500">Banco</span>
                            <span className="font-semibold text-gray-900">
                              {selectedOrder.supplier?.transfer_bank || "—"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-gray-500">CLABE</span>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">
                                {selectedOrder.supplier?.transfer_clabe || "—"}
                              </span>
                              <button
                                onClick={() => handleCopy(selectedOrder.supplier?.transfer_clabe || "")}
                                disabled={!selectedOrder.supplier?.transfer_clabe}
                                className="inline-flex items-center justify-center rounded-lg px-2 py-1 text-xs font-semibold font-[family-name:var(--font-poppins)] disabled:opacity-50"
                                style={{
                                  backgroundColor: "#ffffff",
                                  color: "#004e28",
                                  border: "1px solid #e5e7eb",
                                }}
                              >
                                <Copy className="w-3.5 h-3.5 mr-1" />
                                Copiar
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <FileUpload
                          label="Comprobante (imagen)"
                          accept="image/*"
                          value={receiptFile}
                          currentImageUrl={selectedOrder.receipt_url || null}
                          disabled={uploading || !!selectedOrder.receipt_url}
                          onChange={(f) => {
                            setReceiptFile(f);
                            if (f) handleFileChange(f);
                          }}
                          helperText="Arrastra y suelta o haz clic para seleccionar"
                        />
                        <div className="mt-2 text-xs text-gray-500 font-[family-name:var(--font-poppins)]">
                          Sube una foto clara del comprobante para que el proveedor valide tu pago.
                        </div>
                        {uploading ? (
                          <div className="mt-2 text-xs text-gray-500 font-[family-name:var(--font-poppins)] flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Subiendo...
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 font-[family-name:var(--font-poppins)]">
                      No hay acciones pendientes para este pedido.
                    </div>
                  )}
                </div>
              </div>

              {isCompletedOrder(selectedOrder, latestHistoryKey) ? (
                <div className="rounded-xl border border-gray-100 bg-white p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-sm font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                        Calificar proveedor
                      </div>
                      <div className="mt-1 text-sm text-gray-500 font-[family-name:var(--font-poppins)]">
                        Comparte tu experiencia con {selectedOrder.supplier?.name || "este proveedor"} en este pedido.
                      </div>
                    </div>
                    {selectedOrderAlreadyRated ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[#004e28]/20 bg-[#004e28]/10 px-3 py-1 text-xs font-semibold text-[#004e28] font-[family-name:var(--font-poppins)]">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Calificación enviada
                      </span>
                    ) : null}
                  </div>

                  {canRateSelectedOrder ? (
                    <div className="mt-5 space-y-4">
                      <div>
                        <div className="mb-2 text-sm font-semibold text-gray-900 font-[family-name:var(--font-poppins)]">
                          Puntuación
                        </div>
                        <StarRating
                          rating={ratingValue}
                          interactive
                          size={30}
                          onRatingChange={(value) => {
                            setRatingValue(value);
                            setRatingError(null);
                          }}
                        />
                      </div>

                      <div>
                        <div className="mb-2 text-sm font-semibold text-gray-900 font-[family-name:var(--font-poppins)]">
                          Comentario
                        </div>
                        <textarea
                          value={ratingComment}
                          onChange={(e) => {
                            setRatingComment(e.target.value);
                            setRatingError(null);
                          }}
                          rows={3}
                          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 font-[family-name:var(--font-poppins)] outline-none transition focus:border-[#004e28]/40 focus:ring-4 focus:ring-[#004e28]/10"
                          placeholder="Cuéntanos cómo fue la atención, entrega y calidad del servicio..."
                          disabled={ratingSubmitting}
                        />
                      </div>

                      {ratingError ? (
                        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 font-[family-name:var(--font-poppins)]">
                          {ratingError}
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={submitOrderRating}
                        disabled={ratingSubmitting || ratingValue === 0}
                        className="inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-bold text-white font-[family-name:var(--font-poppins)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
                        style={{ backgroundColor: "#168e00" }}
                      >
                        {ratingSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Enviando...
                          </>
                        ) : (
                          "Enviar calificación"
                        )}
                      </button>
                    </div>
                  ) : selectedOrderAlreadyRated ? (
                    <div className="mt-4 rounded-xl bg-[#f2f3f4] px-4 py-3 text-sm text-gray-600 font-[family-name:var(--font-poppins)]">
                      Este pedido ya fue calificado. Gracias por ayudar a otros clientes.
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="h-px bg-gray-100" />

              <div className="rounded-xl border border-gray-100 bg-white p-5">
                <div className="text-sm font-bold text-gray-900 font-[family-name:var(--font-varela-round)] mb-3">
                  Historial
                </div>
                <Timeline items={history} loading={historyLoading} />
              </div>

              {canRequestRefund ? (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={openRefundModal}
                    className="w-full md:w-auto inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold font-[family-name:var(--font-poppins)] text-white disabled:opacity-60"
                    style={{ backgroundColor: "#ef4444" }}
                  >
                    Solicitar Reembolso
                  </button>
                </div>
              ) : footerMessage ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-gray-600 font-[family-name:var(--font-poppins)]">
                    {footerMessage}
                  </div>
                  {isRefundFinalizedInHistory && !refundLoading && refundProofUrl ? (
                    <button
                      type="button"
                      onClick={() => window.open(refundProofUrl, "_blank", "noopener,noreferrer")}
                      className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)]"
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
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {selectedOrder && isRefundModalOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4"
          onClick={closeRefundModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative px-6 pt-6 pb-4 border-b border-gray-100">
              <button
                onClick={closeRefundModal}
                className="absolute right-3 top-3 inline-flex items-center justify-center rounded-full p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                aria-label="Cerrar"
                disabled={refundSubmitting}
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-lg font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                Solicitar Reembolso
              </h3>
              <div className="mt-1 text-sm text-gray-500 font-[family-name:var(--font-poppins)]">
                Pedido #{selectedOrder.id}
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {refundSuccess ? (
                <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-green-700 flex items-center gap-2 font-[family-name:var(--font-poppins)]">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">{refundSuccess}</span>
                </div>
              ) : null}
              {refundError ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-red-700 flex items-center gap-2 font-[family-name:var(--font-poppins)]">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">{refundError}</span>
                </div>
              ) : null}

              <div>
                <div className="text-sm font-semibold text-gray-900 font-[family-name:var(--font-poppins)] mb-2">
                  Motivo
                </div>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full min-h-[120px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 font-[family-name:var(--font-poppins)] focus:outline-none focus:ring-2 focus:ring-[#004e28]/30"
                  placeholder="Describe el motivo del reembolso..."
                  disabled={refundSubmitting}
                />
              </div>

              <div>
                <div className="text-sm font-semibold text-gray-900 font-[family-name:var(--font-poppins)] mb-2">
                  Evidencia (imagen)
                </div>
                <FileUpload
                  accept="image/*"
                  value={refundEvidence}
                  disabled={refundSubmitting}
                  onChange={handleRefundEvidenceChange}
                  helperText="Arrastra y suelta o haz clic para seleccionar"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={closeRefundModal}
                disabled={refundSubmitting}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)] disabled:opacity-60"
                style={{
                  backgroundColor: "#ffffff",
                  color: "#111827",
                  border: "1px solid #e5e7eb",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitRefund}
                disabled={refundSubmitting}
                className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)] text-white disabled:opacity-60"
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

      {previewUrl ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4"
          onClick={() => setPreviewUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-3xl rounded-2xl bg-white shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative px-5 py-4 border-b border-gray-100">
              <div className="text-sm font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">
                Comprobante
              </div>
              <button
                onClick={() => setPreviewUrl(null)}
                className="absolute right-3 top-3 inline-flex items-center justify-center rounded-full p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 bg-[#f2f3f4]">
              <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-white">
                <img src={previewUrl} alt="Comprobante" className="h-full w-full object-contain" />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
