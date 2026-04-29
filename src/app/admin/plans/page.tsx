"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import { Toast } from "@/components/ui/Toast";
import {
  CheckCircle,
  Edit2,
  Loader2,
  Plus,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";

interface Plan {
  id: number;
  title: string;
  description: string;
  price: number;
  duration: "monthly" | "yearly";
  is_active: boolean;
}

const formatPrice = (value: unknown) => {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return "-";
  try {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(num);
  } catch {
    return `$${num.toFixed(2)}`;
  }
};

const formatDuration = (value: Plan["duration"]) => {
  if (value === "monthly") return "Mensual";
  if (value === "yearly") return "Anual";
  return value;
};

export default function AdminPlansPage() {
  const { token } = useAuthStore();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const skip = 0;
  const limit = 100;
  const [toast, setToast] = useState<null | { type: "success" | "error" | "info"; message: string }>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!token) return;
    let isMounted = true;
    const controller = new AbortController();

    const run = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("skip", String(skip));
        params.set("limit", String(limit));
        if (searchTerm.trim()) params.set("search", searchTerm.trim());
        if (onlyActive) params.set("only_active", "true");

        const response = await fetchWithAuth(`/api/plans/?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!isMounted) return;
        if (response.ok) {
          const data = await response.json();
          setPlans(Array.isArray(data) ? data : []);
        } else {
          setPlans([]);
          setToast({ type: "error", message: "No se pudieron cargar los planes." });
        }
      } catch (error: any) {
        if (error?.name === "AbortError") return;
        console.error("Error fetching plans:", error);
        if (isMounted) setToast({ type: "error", message: "Error al cargar planes." });
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const debounceId = window.setTimeout(run, 250);
    return () => {
      isMounted = false;
      window.clearTimeout(debounceId);
      controller.abort();
    };
  }, [skip, limit, token, searchTerm, onlyActive]);

  const deletePlan = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este plan?")) return;
    if (!token) return;
    try {
      const response = await fetchWithAuth(`/api/plans/${id}`, { method: "DELETE" });
      if (response.ok) {
        setToast({ type: "success", message: "Plan eliminado correctamente." });
        const params = new URLSearchParams();
        params.set("skip", String(skip));
        params.set("limit", String(limit));
        if (searchTerm.trim()) params.set("search", searchTerm.trim());
        if (onlyActive) params.set("only_active", "true");
        const refresh = await fetchWithAuth(`/api/plans/?${params.toString()}`);
        if (refresh.ok) {
          const data = await refresh.json();
          setPlans(Array.isArray(data) ? data : []);
        }
      } else {
        setToast({ type: "error", message: "Error al eliminar plan." });
      }
    } catch (error) {
      console.error("Error deleting plan:", error);
      setToast({ type: "error", message: "Error al eliminar plan." });
    }
  };

  const filteredPlans = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = onlyActive ? plans.filter((p) => p.is_active) : plans;
    if (!q) return base;
    return base.filter((p) => {
      const title = String(p.title || "").toLowerCase();
      const desc = String(p.description || "").toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }, [plans, searchTerm, onlyActive]);

  return (
    <div className="space-y-6">
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Planes</h1>
          <p className="text-gray-500 mt-1">Gestiona los planes disponibles.</p>
        </div>
        <Link
          href="/admin/plans/create"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
        >
          <Plus size={20} />
          Nuevo Plan
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar planes..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-3 px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-700 select-none w-fit">
            <input
              type="checkbox"
              className="w-4 h-4 rounded text-primary focus:ring-primary border-gray-300"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
            />
            Solo activos
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Precio</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Duración</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={20} />
                      Cargando planes...
                    </div>
                  </td>
                </tr>
              ) : filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron planes
                  </td>
                </tr>
              ) : (
                filteredPlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{plan.title}</div>
                      <div className="text-sm text-gray-500 max-w-xl truncate">{plan.description || "-"}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{formatPrice(plan.price)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {formatDuration(plan.duration)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {plan.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                          <CheckCircle size={12} />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100">
                          <XCircle size={12} />
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/plans/${plan.id}`}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </Link>
                        <button
                          onClick={() => deletePlan(plan.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
