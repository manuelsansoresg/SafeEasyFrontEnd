"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { Toast } from "@/components/ui/Toast";
import { subscriptionsService } from "@/services/subscriptionsService";
import type { Subscription } from "@/types/subscriptions";
import EditSubscriptionModal from "@/app/admin/subscriptions/components/EditSubscriptionModal";
import EventsModal from "@/app/admin/subscriptions/components/EventsModal";
import {
  BadgeDollarSign,
  CheckCircle,
  Edit2,
  History,
  Loader2,
  Search,
  Slash,
  XCircle,
} from "lucide-react";

export default function AdminSubscriptionsPage() {
  const { token, user } = useAuthStore();
  const isAdmin = user?.role === "admin" || user?.role === "superuser";

  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [skip, setSkip] = useState(0);
  const [limit] = useState(50);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "expired">("");
  const [toast, setToast] = useState<null | { type: "success" | "error" | "info"; message: string }>(null);

  const [eventsOpen, setEventsOpen] = useState(false);
  const [eventsSubscriptionId, setEventsSubscriptionId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    setSkip(0);
  }, [statusFilter]);

  useEffect(() => {
    if (!token || !isAdmin) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const debounceId = window.setTimeout(async () => {
      setLoading(true);
      try {
        const data = await subscriptionsService.listSubscriptions({
          skip,
          limit,
          status: statusFilter || undefined,
          search: searchTerm.trim() || undefined,
        });
        if (!mounted) return;
        setSubscriptions(data);
      } catch (e) {
        console.error("Error fetching subscriptions:", e);
        if (!mounted) return;
        setSubscriptions([]);
        setToast({ type: "error", message: "No se pudieron cargar las subscripciones." });
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }, 250);

    return () => {
      mounted = false;
      window.clearTimeout(debounceId);
    };
  }, [token, isAdmin, skip, limit, searchTerm, statusFilter]);

  const visibleSubscriptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    let base = subscriptions;
    if (statusFilter) base = base.filter((s) => s.status === statusFilter);
    if (!q) return base;
    return base.filter((s) => String(s.supplier_name || "").toLowerCase().includes(q));
  }, [subscriptions, statusFilter, searchTerm]);

  const formatEndDate = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("es-MX", { year: "numeric", month: "short", day: "2-digit" }).format(d);
  };

  const openEvents = (id: number) => {
    setEventsSubscriptionId(id);
    setEventsOpen(true);
  };

  const openEdit = (sub: Subscription) => {
    setEditingSubscription(sub);
    setEditOpen(true);
  };

  const refresh = async () => {
    if (!token || !isAdmin) return;
    try {
      const data = await subscriptionsService.listSubscriptions({
        skip,
        limit,
        status: statusFilter || undefined,
        search: searchTerm.trim() || undefined,
      });
      setSubscriptions(data);
    } catch (e) {
      console.error("Error refreshing subscriptions:", e);
      setToast({ type: "error", message: "No se pudieron actualizar las subscripciones." });
    }
  };

  const markExpired = async (sub: Subscription) => {
    if (!confirm("¿Estás seguro de marcar esta subscripción como expirada?")) return;
    try {
      await subscriptionsService.updateStatus(sub.id, {
        status: "expired",
        note: "Marcado como expirado desde administración.",
      });
      setToast({ type: "success", message: "Subscripción actualizada." });
      await refresh();
    } catch (e) {
      console.error("Error updating subscription:", e);
      setToast({ type: "error", message: "Error al actualizar subscripción." });
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="bg-red-50 text-red-600 p-4 rounded-full">
          <Slash size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-800">Acceso restringido</h2>
        <p className="text-gray-500">Solo administradores pueden acceder a este módulo.</p>
        <Link
          href="/admin/dashboard"
          className="px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
        >
          Volver al Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

      <EventsModal open={eventsOpen} subscriptionId={eventsSubscriptionId} onClose={() => setEventsOpen(false)} />
      <EditSubscriptionModal
        open={editOpen}
        subscription={editingSubscription}
        onClose={() => setEditOpen(false)}
        onSaved={async () => {
          setToast({ type: "success", message: "Subscripción actualizada." });
          await refresh();
        }}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Subscripciones</h1>
          <p className="text-gray-500 mt-1">Gestiona las subscripciones de los usuarios.</p>
        </div>
        <Link
          href="/admin/plans"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
        >
          <BadgeDollarSign size={20} />
          Gestionar Planes
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar proveedor..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSkip(0);
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <select
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "" | "active" | "expired")}
            >
              <option value="">Todos</option>
              <option value="active">Activos</option>
              <option value="expired">Expirados</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Proveedor</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Expira</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={20} />
                      Cargando subscripciones...
                    </div>
                  </td>
                </tr>
              ) : visibleSubscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron subscripciones
                  </td>
                </tr>
              ) : (
                visibleSubscriptions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-700 font-mono">#{sub.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{sub.supplier_name}</div>
                      <div className="text-xs text-gray-400 font-mono">ID: {sub.supplier_id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{sub.plan?.title || `Plan #${sub.plan_id}`}</div>
                      <div className="text-sm text-gray-500">
                        {sub.plan?.duration === "monthly" ? "Mensual" : sub.plan?.duration === "yearly" ? "Anual" : "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {sub.status === "active" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                          <CheckCircle size={12} />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                          <XCircle size={12} />
                          Expirado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{formatEndDate(sub.end_date)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEvents(sub.id)}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                          title="Ver historial"
                        >
                          <History size={18} />
                        </button>
                        <button
                          onClick={() => openEdit(sub)}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                          title="Editar estado"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => markExpired(sub)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Marcar como expirado"
                        >
                          <XCircle size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setSkip((s) => Math.max(0, s - limit))}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || skip === 0}
          >
            Anterior
          </button>
          <div className="text-sm text-gray-500">Página {Math.floor(skip / limit) + 1}</div>
          <button
            type="button"
            onClick={() => setSkip((s) => s + limit)}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || subscriptions.length < limit}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
