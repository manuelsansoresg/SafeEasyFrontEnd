"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { orderService, Order } from "@/services/orderService";
import { 
  Loader2, 
  MessageSquare, 
  ChevronLeft, 
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { fetchWithAuth } from "@/lib/api";

export default function AdminOrdersPage() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [supplierId, setSupplierId] = useState<number | null>(null);

  useEffect(() => {
    const isSupplier = user?.role === "supplier" || user?.role === "provider";
    if (!isSupplier) {
      setSupplierId(null);
      return;
    }

    if (!user?.id) return;

    const loadSupplierId = async () => {
      try {
        const res = await fetchWithAuth(`/api/suppliers?user_id=${user.id}&limit=100`);
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const items = Array.isArray(data) ? data : (data as any)?.items || [];
        const found = items.find((s: any) => Number(s.user_id) === Number(user.id));
        if (found?.id) {
          setSupplierId(Number(found.id));
          setPage(1);
        }
      } catch {
      }
    };

    loadSupplierId();
  }, [user?.id, user?.role]);

  useEffect(() => {
    const isSupplier = user?.role === "supplier" || user?.role === "provider";
    if (isSupplier && !supplierId) return;
    fetchOrders();
  }, [page, supplierId, user?.role]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await orderService.getOrders(
        page,
        limit,
        supplierId && Number.isFinite(supplierId) ? supplierId : undefined
      );
      setOrders(data);
    } catch (error) {
      console.error("Error fetching orders:", error);
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
    const raw = (order as any).total_amount ?? order.product?.price;
    const n = typeof raw === "string" ? Number(raw) : Number(raw);
    if (!Number.isFinite(n)) return "-";
    return formatCurrency(n);
  };

  const getOrderPaymentStatus = (order: Order) => {
    const s = (order as any).payment_status || (order as any).status;
    return typeof s === "string" && s.trim() ? s : "-";
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Órdenes</h1>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Producto</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Monto</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Pago</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Proveedor</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Creado</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center">
                    <div className="flex justify-center items-center">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No hay órdenes encontradas.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      #{order.id}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {order.product?.title || "Producto desconocido"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {getOrderAmount(order)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                        {getOrderPaymentStatus(order)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex flex-col">
                        <span className="text-gray-900">
                          {order.supplier?.name || "Proveedor desconocido"}
                        </span>
                        <span className="text-xs text-gray-400">ID: {order.supplier_id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex flex-col">
                        <span className="text-gray-900">{order.buyer?.name || `Usuario #${order.buyer_id}`}</span>
                        <span className="text-xs text-gray-400">{order.buyer?.email || "-"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Link 
                        href={`/admin/messages?conversation_id=${order.conversation_id}`}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <MessageSquare className="w-4 h-4 mr-1.5" />
                        Chat
                      </Link>
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
    </div>
  );
}
