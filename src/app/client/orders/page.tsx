"use client";

import { useEffect, useMemo, useState } from "react";
import { orderService, Order, OrderHistoryItem, OrderRefund } from "@/services/orderService";
import FileUpload from "@/components/ui/FileUpload";
import {
  Loader2,
  Package,
  X,
  Image as ImageIcon,
  Copy,
  CheckCircle,
  AlertTriangle,
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
  return (order.fulfillment_status || order.visual_status || order.payment_status || order.status || "pending")
    .toString()
    .trim();
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
  if (v === "rejected" || v === "rechazado" || v === "payment_rejected" || v === "pago_rechazado")
    return "payment_rejected";
  if (v === "cancelled" || v === "cancelado") return "cancelled";
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
    receipt_uploaded: "Comprobante subido",
    payment_rejected: "Pago rechazado",
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
  const normalized = (value || "").toLowerCase();
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
    created: { bg: "#f2f3f4", fg: "#111827", label: "Creado" },
    creado: { bg: "#f2f3f4", fg: "#111827", label: "Creado" },
    refund_requested: { bg: "#f59e0b", fg: "#000000", label: "Reembolso solicitado" },
    refund_approved: { bg: "#004e28", fg: "#ffffff", label: "Reembolso aprobado" },
    refund_rejected: { bg: "#ef4444", fg: "#ffffff", label: "Reembolso rechazado" },
    refund_refunded: { bg: "#3b82f6", fg: "#ffffff", label: "Reembolsado" },
  };

  const meta = map[normalized] || { bg: "#f2f3f4", fg: "#111827", label: value || "—" };
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

  const refundRequestedStorageKey = "safeeasy:refund_requested_v1";

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

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await orderService.getMyOrders();
      setOrders(data);
    } catch (e: any) {
      setError(e?.message || "No se pudieron cargar tus pedidos.");
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
    } catch (e: any) {
      setModalError(e?.message || "No se pudo cargar el historial.");
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
  };

  useEffect(() => {
    loadOrders();
  }, []);

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
    } catch (e: any) {
      setModalError(e?.message || "No se pudo subir el comprobante.");
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
    } catch (e: any) {
      setRefundError(e?.message || "No se pudo solicitar el reembolso.");
    } finally {
      setRefundSubmitting(false);
    }
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-[family-name:var(--font-varela-round)]">Mis Pedidos</h1>
          <p className="text-gray-500 font-[family-name:var(--font-poppins)]">
            Revisa el estado de tus compras y sube tu comprobante cuando sea necesario.
          </p>
        </div>
        <span className="bg-[#004e28]/10 text-[#004e28] px-3 py-1 rounded-full text-sm font-semibold font-[family-name:var(--font-poppins)]">
          {orders.length} pedidos
        </span>
      </div>

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {orders.map((order) => {
            const statusRaw = getOrderStatusRaw(order);
            const statusKey = getOrderStatusKey(order);
            const image =
              getImageUrl(order.product?.thumbnail_url || order.product?.image || null) || "/placeholder.png";
            return (
              <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 flex gap-4">
                  <div className="h-16 w-16 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0">
                    <img src={image} alt={order.product?.title || "Producto"} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 font-[family-name:var(--font-poppins)] line-clamp-2">
                          {order.product?.title || "Producto"}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 font-[family-name:var(--font-poppins)]">
                          Pedido #{order.id}
                        </div>
                      </div>
                      <StatusBadge value={statusRaw || statusKey} />
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-sm font-bold text-gray-900 font-[family-name:var(--font-poppins)]">
                        {formatMoney(order.total_amount ?? order.product?.price ?? 0)}
                      </div>
                      <button
                        onClick={() => openModal(order)}
                        className="inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)]"
                        style={{
                          backgroundColor: "#004e2814",
                          color: "#004e28",
                          border: "1px solid #004e2833",
                        }}
                      >
                        Ver Detalle
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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
            className="w-full max-w-4xl rounded-2xl bg-white shadow-xl overflow-hidden"
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
