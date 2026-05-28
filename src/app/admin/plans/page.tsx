"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { Toast } from "@/components/ui/Toast";
import { PageHero } from "@/components/ui/PageHero";
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

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return `${base.replace(/\/$/, "")}${path}`;
};

const authHeaders = (token: string) => ({
  "Authorization": `Bearer ${token.replace(/^bearer\s+/i, "").trim()}`,
});

const unwrapPlans = (data: unknown): Plan[] => {
  if (Array.isArray(data)) return data as Plan[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const items = record.items ?? record.results ?? record.data ?? record.plans;
    if (Array.isArray(items)) return items as Plan[];
  }
  return [];
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

        const response = await fetch(apiUrl(`/plans/?${params.toString()}`), {
          signal: controller.signal,
          headers: {
            ...authHeaders(token),
            Accept: "application/json",
          },
        });
        if (!isMounted) return;
        if (response.ok) {
          const data = await response.json();
          setPlans(unwrapPlans(data));
        } else {
          setPlans([]);
          setToast({ type: "error", message: "No se pudieron cargar los planes." });
        }
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
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
      const response = await fetch(apiUrl(`/plans/${id}`), {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (response.ok) {
        setToast({ type: "success", message: "Plan eliminado correctamente." });
        const params = new URLSearchParams();
        params.set("skip", String(skip));
        params.set("limit", String(limit));
        if (searchTerm.trim()) params.set("search", searchTerm.trim());
        if (onlyActive) params.set("only_active", "true");
        const refresh = await fetch(apiUrl(`/plans/?${params.toString()}`), {
          headers: {
            ...authHeaders(token),
            Accept: "application/json",
          },
        });
        if (refresh.ok) {
          const data = await refresh.json();
          setPlans(unwrapPlans(data));
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

      <PageHero
        title="Planes"
        subtitle="Gestiona los planes disponibles."
        eyebrow="Contenido"
        actions={
        <Link
          href="/admin/plans/create"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
        >
          <Plus size={20} />
          Nuevo Plan
        </Link>
        }
      />

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

        <div className="hidden overflow-x-auto md:block">
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
        <div className="divide-y divide-gray-100 md:hidden">
          {loading ? (
            <div className="px-4 py-8 text-center text-gray-500">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={20} />
                Cargando planes...
              </div>
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">No se encontraron planes</div>
          ) : (
            filteredPlans.map((plan) => (
              <article key={plan.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words text-sm font-semibold text-gray-900">{plan.title}</h3>
                    <p className="mt-1 line-clamp-3 break-words text-sm leading-6 text-gray-500">{plan.description || "-"}</p>
                  </div>
                  {plan.is_active ? (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-green-100 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                      <CheckCircle size={12} />
                      Activo
                    </span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
                      <XCircle size={12} />
                      Inactivo
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-gray-50 p-2">
                    <div className="font-semibold uppercase tracking-wide text-gray-400">Precio</div>
                    <div className="mt-1 font-semibold text-gray-900">{formatPrice(plan.price)}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-2">
                    <div className="font-semibold uppercase tracking-wide text-gray-400">Duración</div>
                    <div className="mt-1 text-gray-700">{formatDuration(plan.duration)}</div>
                  </div>
                </div>

                <div className="mt-3 flex justify-end gap-2">
                  <Link
                    href={`/admin/plans/${plan.id}`}
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-primary/5 hover:text-primary"
                    title="Editar"
                  >
                    <Edit2 size={18} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => deletePlan(plan.id)}
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
