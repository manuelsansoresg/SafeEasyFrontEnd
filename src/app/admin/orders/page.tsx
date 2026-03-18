"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { orderService, Order, OrderHistoryItem } from "@/services/orderService";
import { chatService } from "@/services/chatService";
import { useChat } from "@/context/ChatContext";
import { 
  Loader2, 
  MessageSquare,
  ChevronLeft, 
  ChevronRight,
  X,
  Image as ImageIcon
} from "lucide-react";

function normalizeStatusKey(value: string) {
  const raw = String(value || "").trim();
  const v = raw.toLowerCase().trim().replace(/\s+/g, "_");

  if (v === "pending" || v === "pendiente") return "pending";
  if (v === "paid" || v === "pagado" || v === "pago_verificado" || v === "validado" || v === "validated")
    return "paid";
  if (v === "verified" || v === "verificado") return "verified";
  if (v === "completed" || v === "completado" || v === "delivered" || v === "entregado") return "completed";
  if (v === "shipped" || v === "enviado") return "shipped";
  if (v === "rejected" || v === "rechazado" || v === "payment_rejected" || v === "pago_rechazado")
    return "payment_rejected";
  if (v === "cancelled" || v === "cancelado") return "cancelled";
  if (v === "receipt_uploaded" || v === "comprobante_subido") return "receipt_uploaded";
  if (v === "created" || v === "creado") return "created";

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
  };
  return map[key] || raw;
}

function StatusBadge({ value }: { value: string }) {
  const raw = (value || "").trim();
  const normalized = normalizeStatusKey(raw);

  const isPaid = normalized === "paid";
  const isCompleted = normalized === "completed" || normalized === "verified";

  const bg = isCompleted ? "#004e28" : isPaid ? "#168e00" : "#f2f3f4";
  const fg = isCompleted || isPaid ? "#ffffff" : "#000000";

  const label = toSpanishStatusLabel(raw) || "—";

  return (
    <span
      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold font-[family-name:var(--font-poppins)]"
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

  const base = isCompleted
    ? "#004e28"
    : isPaid
      ? "#168e00"
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
  const bg = base === "#fbbf24" ? "#fff7ed" : `${base}14`;

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold font-[family-name:var(--font-poppins)]"
      style={{ backgroundColor: bg, color: base }}
    >
      {label}
    </span>
  );
}

export default function AdminOrdersPage() {
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
      const msg =
        error && typeof error === "object" && "message" in error
          ? String((error as any).message)
          : "No se pudieron cargar las órdenes.";
      setError(msg || "No se pudieron cargar las órdenes.");
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
    const s = order.visual_status || order.payment_status || order.status;
    return typeof s === "string" && s.trim() ? s : "-";
  };

  const isReceiptPending = (order: Order) => {
    const status = String(order.status || "").toLowerCase();
    const payment = String(order.payment_status || "").toLowerCase();
    const visual = String(order.visual_status || "").toLowerCase();
    return (
      status === "comprobante_subido" ||
      status === "receipt_uploaded" ||
      payment === "comprobante_subido" ||
      payment === "receipt_uploaded" ||
      visual === "comprobante_subido" ||
      visual === "comprobante subido" ||
      visual === "receipt_uploaded"
    );
  };

  const getReceiptUrl = (order: Order) => {
    const url = order.receipt_url;
    return typeof url === "string" && url.trim() ? url : "";
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
  }: {
    items: OrderHistoryItem[];
    loading: boolean;
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
      const fallbackText = toSpanishStatusLabel(fallbackTextRaw);
      const title = meta.label || fallbackText || "Actualización";

      const detail =
        meta.label && fallbackText && fallbackText !== meta.label ? fallbackText : "";

      const actor =
        (typeof h.actor === "string" && h.actor) ||
        (h.user && typeof h.user === "object"
          ? (typeof h.user.name === "string" && h.user.name) || (typeof h.user.role === "string" && h.user.role)
          : "") ||
        "";

      return { timeLabel, title, detail, statusRaw, meta, actor };
    });

    return (
      <div className="max-h-[520px] overflow-y-auto pr-2">
        <div className="space-y-4">
          {rows.map((row, idx) => {
            const isLast = idx === rows.length - 1;
            return (
              <div key={idx} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-2 w-2 rounded-full bg-[#004e28]" />
                  {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 font-[family-name:var(--font-poppins)]">
                    {row.timeLabel}
                    {row.actor ? <span className="text-gray-300"> • </span> : null}
                    {row.actor ? <span className="text-gray-500">{row.actor}</span> : null}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-900 font-[family-name:var(--font-poppins)] truncate">
                    {row.title}
                  </div>
                  {row.detail ? (
                    <div className="mt-1 text-sm text-gray-700 font-[family-name:var(--font-poppins)]">
                      {row.detail}
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
    try {
      const items = await orderService.getOrderHistory(order.id);
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

  const closeManageModal = () => {
    setSelectedOrder(null);
    setHistory([]);
    setHistoryLoading(false);
    setModalError(null);
    setActionLoading(null);
    setIsRejectModalOpen(false);
    setRejectNote("");
    setRejectSpinnerVisible(false);
    if (rejectSpinnerTimerRef.current) {
      window.clearTimeout(rejectSpinnerTimerRef.current);
      rejectSpinnerTimerRef.current = null;
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
      const nextStatus =
        updated && typeof (updated as any).status === "string" ? String((updated as any).status) : newStatus;
      const nextVisualStatus =
        updated && typeof (updated as any).visual_status === "string"
          ? String((updated as any).visual_status)
          : updated && typeof (updated as any).status === "string"
            ? String((updated as any).status)
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
          return at - bt;
        });
        setHistory(sorted);
      } catch {
      }
    } catch (e) {
      setModalError("No se pudo actualizar el estatus.");
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

  return (
    <div className="p-6">
      {toastMessage ? (
        <div className="fixed right-4 top-4 z-[80]">
          <div className="rounded-xl bg-[#004e28] px-4 py-3 text-sm font-semibold text-white shadow-xl font-[family-name:var(--font-poppins)]">
            {toastMessage}
          </div>
        </div>
      ) : null}
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
                  <td colSpan={isAdminUser ? 8 : 7} className="px-6 py-8 text-center">
                    <div className="flex justify-center items-center">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={isAdminUser ? 8 : 7} className="px-6 py-8 text-center text-gray-500">
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
                          onClick={() => openManageModal(order)}
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
                <MinimalStatusPill value={getOrderPaymentStatus(selectedOrder)} />
              </div>
              <div className="mt-1 text-sm text-gray-500 font-[family-name:var(--font-poppins)]">
                #{selectedOrder.id} • {selectedOrder.product?.title || "Producto"}
              </div>
            </div>

            <div className="px-8 py-6">
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
                </div>

                <div className="rounded-xl border border-gray-100 bg-white p-5">
                  <div className="text-sm font-bold text-gray-900 font-[family-name:var(--font-varela-round)] mb-3">
                    Acciones
                  </div>

                  {(() => {
                    const statusKey = String(
                      selectedOrder.visual_status || selectedOrder.status || selectedOrder.payment_status || ""
                    )
                      .trim()
                      .toLowerCase();

                    const isPending = statusKey === "pending" || statusKey === "pendiente";
                    const isPaid = statusKey === "paid" || statusKey === "pagado";
                    const isFinal =
                      statusKey === "verified" ||
                      statusKey === "verificado" ||
                      statusKey === "completed" ||
                      statusKey === "completado";
                    const canReject = isPending || isPaid;

                    return (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {isPending ? (
                            <button
                              onClick={() => applyStatus("paid")}
                              disabled={actionLoading !== null || !getReceiptUrl(selectedOrder)}
                              className="inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-semibold font-[family-name:var(--font-poppins)] disabled:opacity-60"
                              style={{
                                backgroundColor: "#004e2814",
                                color: "#004e28",
                                border: "1px solid #004e2833",
                              }}
                              title={
                                !getReceiptUrl(selectedOrder)
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
                <Timeline items={history} loading={historyLoading} />
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
        </div>
      )}
    </div>
  );
}
