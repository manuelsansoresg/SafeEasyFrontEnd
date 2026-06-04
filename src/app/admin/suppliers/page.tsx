"use client";

import { useState, useEffect, Fragment, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
  CreditCard,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Toast } from "@/components/ui/Toast";
import { PageHero } from "@/components/ui/PageHero";
import { subscriptionsService } from "@/services/subscriptionsService";
import type { Plan, Subscription } from "@/types/subscriptions";

interface Supplier {
  id: number;
  name: string;
  short_name?: string;
  slug?: string;
  rfc?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  country: string;
  is_active: boolean;
  is_verified?: boolean;
  user_id: number;
}

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return `${base.replace(/\/$/, "")}${path}`;
};

const authHeaders = (token: string) => ({
  "Authorization": `Bearer ${token.replace(/^bearer\s+/i, "").trim()}`,
});

const subscriptionBadge = (subscription?: Subscription, options?: { loading?: boolean; error?: boolean }) => {
  if (options?.loading) {
    return { label: "Cargando...", className: "bg-gray-50 text-gray-500 border-gray-100" };
  }
  if (options?.error) {
    return { label: "No cargó", className: "bg-red-50 text-red-700 border-red-100" };
  }
  if (!subscription) {
    return { label: "Sin pago", className: "bg-gray-50 text-gray-600 border-gray-100" };
  }
  if (subscription.status === "active") {
    return { label: "Activa", className: "bg-green-50 text-green-700 border-green-100" };
  }
  return { label: "Pago pendiente", className: "bg-amber-50 text-amber-700 border-amber-100" };
};

const getSubscriptionSupplierId = (subscription: Subscription) => {
  const record = subscription as unknown as Record<string, unknown>;
  const nestedSupplier = record.supplier && typeof record.supplier === "object"
    ? (record.supplier as Record<string, unknown>)
    : null;
  const raw = record.supplier_id ?? record.supplierId ?? nestedSupplier?.id;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
};

export default function AdminSuppliersPage() {
  const { token, user } = useAuthStore();
  const roleKey = String(user?.role || "").toLowerCase();
  const isAdminUser = roleKey === "admin" || roleKey === "superuser";
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [subscriptionsBySupplier, setSubscriptionsBySupplier] = useState<Record<number, Subscription>>({});
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [subscriptionsError, setSubscriptionsError] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptionSupplier, setSubscriptionSupplier] = useState<Supplier | null>(null);
  const [subscriptionPlanId, setSubscriptionPlanId] = useState<number | null>(null);
  const [subscriptionPaymentMethod, setSubscriptionPaymentMethod] = useState<"card" | "card_terminal">("card_terminal");
  const [savingSubscription, setSavingSubscription] = useState(false);
  
  // Pagination
  const [skip, setSkip] = useState(0);
  const [limit] = useState(50);

  // Modal & Form
  const [toast, setToast] = useState<null | { type: "success" | "error" | "info"; message: string }>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const fetchSuppliers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(apiUrl(`/suppliers/?skip=${skip}&limit=${limit}`), {
        headers: {
          ...authHeaders(token),
          Accept: "application/json",
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const next = Array.isArray(data) ? (data as Supplier[]) : [];
        setSuppliers((prev) => {
          const prevById = new Map(prev.map((s) => [Number(s.id), s]));
          return next.map((s) => {
            const prevRow = prevById.get(Number(s.id));
            const hasIncomingVerified = typeof s.is_verified === "boolean";
            const preserved = hasIncomingVerified ? s.is_verified : prevRow?.is_verified;
            return typeof preserved === "boolean" ? { ...s, is_verified: preserved } : s;
          });
        });
        setSelectedIds((prev) => prev.filter((id) => next.some((supplier) => supplier.id === id)));
      } else {
        console.error("Failed to fetch suppliers:", response.status, response.statusText);
        try {
            const errorText = await response.text();
            console.error("Error response:", errorText);
        } catch {
            // Ignore parsing error
        }
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    } finally {
      setLoading(false);
    }
  }, [limit, skip, token]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  useEffect(() => {
    if (!token || !isAdminUser) return;
    let mounted = true;

    const loadSubscriptionData = async () => {
      setLoadingSubscriptions(true);
      setSubscriptionsError(false);
      try {
        const [subs, nextPlans] = await Promise.all([
          subscriptionsService.listSubscriptions({ skip: 0, limit: 500 }),
          subscriptionsService.listPlans(),
        ]);
        if (!mounted) return;

        const bySupplier: Record<number, Subscription> = {};
        for (const sub of subs) {
          const supplierId = getSubscriptionSupplierId(sub);
          if (!supplierId) continue;
          bySupplier[supplierId] = sub;
        }
        setSubscriptionsBySupplier(bySupplier);
        setPlans(nextPlans.filter((plan) => plan.is_active));
      } catch (error) {
        console.error("Error loading supplier subscriptions:", error);
        if (mounted) {
          setSubscriptionsError(true);
          setSubscriptionsBySupplier({});
        }
      } finally {
        if (mounted) setLoadingSubscriptions(false);
      }
    };

    loadSubscriptionData();
    return () => {
      mounted = false;
    };
  }, [isAdminUser, token]);

  const openSubscriptionModal = (supplier: Supplier) => {
    const current = subscriptionsBySupplier[supplier.id];
    const currentPlanId = current?.plan_id;
    const fallbackPlanId = plans[0]?.id ?? null;
    setSubscriptionSupplier(supplier);
    setSubscriptionPlanId(plans.some((plan) => plan.id === currentPlanId) ? currentPlanId : fallbackPlanId);
    setSubscriptionPaymentMethod("card_terminal");
  };

  const closeSubscriptionModal = () => {
    if (savingSubscription) return;
    setSubscriptionSupplier(null);
  };

  const refreshSubscriptions = async () => {
    const subs = await subscriptionsService.listSubscriptions({ skip: 0, limit: 500 });
    const bySupplier: Record<number, Subscription> = {};
    for (const sub of subs) {
      const supplierId = getSubscriptionSupplierId(sub);
      if (supplierId) bySupplier[supplierId] = sub;
    }
    setSubscriptionsBySupplier(bySupplier);
  };

  const handleSubscriptionPurchase = async () => {
    if (!subscriptionSupplier || !subscriptionPlanId) {
      setToast({ type: "error", message: "Selecciona proveedor y plan." });
      return;
    }

    setSavingSubscription(true);
    try {
      const purchase = await subscriptionsService.purchase(
        subscriptionPlanId,
        subscriptionPaymentMethod === "card_terminal" ? "card_terminal" : undefined,
        subscriptionSupplier.id
      );

      if (subscriptionPaymentMethod === "card") {
        if (!purchase.init_point) {
          throw new Error("Mercado Pago no devolvió una liga de pago.");
        }
        window.open(purchase.init_point, "_blank", "noopener,noreferrer");
        setToast({ type: "success", message: "Liga de pago generada. Se abrió Mercado Pago en una nueva pestaña." });
      } else {
        setToast({ type: "success", message: "Suscripción por terminal registrada correctamente." });
      }

      await refreshSubscriptions();
      setSubscriptionSupplier(null);
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error && typeof (error as Record<string, unknown>).message === "string"
          ? String((error as Record<string, unknown>).message)
          : "No se pudo gestionar la suscripción.";
      setToast({ type: "error", message });
    } finally {
      setSavingSubscription(false);
    }
  };

  const updateSupplierVerified = async (supplierId: number, isVerified: boolean) => {
    const tryUrls = [`/api/suppliers/${supplierId}`, `/api/suppliers/${supplierId}/`];
    const form = new FormData();
    form.append("is_verified", isVerified ? "true" : "false");
    const formOptions = { method: "PUT", headers: authHeaders(token || ""), body: form };

    let response: Response | null = null;
    let usedUrl = "";
    for (const url of tryUrls) {
      usedUrl = url;
      response = await fetch(apiUrl(url.replace(/^\/api/, "")), formOptions);
      if (response.ok) break;
    }

    if (!response || !response.ok) {
      const text = await response?.text().catch(() => "") ?? "";
      throw new Error(`No se pudo actualizar verificación (${response?.status ?? "unknown"}): ${usedUrl} ${text}`.trim());
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return response.json();
    return null;
  };

  const toggleVerified = async (supplier: Supplier) => {
    if (!token) return;
    if (!isAdminUser) return;
    const next = !Boolean(supplier.is_verified);
    const actionLabel = next ? "verificar" : "desverificar";
    const ok = window.confirm(
      `Vas a ${actionLabel} al proveedor "${supplier.name}". ¿Deseas continuar?`
    );
    if (!ok) return;
    setVerifyingId(supplier.id);
    try {
      const updated = await updateSupplierVerified(supplier.id, next);
      const updatedRec =
        updated && typeof updated === "object" ? (updated as Record<string, unknown>) : null;
      const nextValue =
        typeof updatedRec?.is_verified === "boolean"
          ? updatedRec.is_verified
          : next;
      setSuppliers((prev) => prev.map((s) => (s.id === supplier.id ? { ...s, is_verified: nextValue } : s)));
      fetchSuppliers();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e && typeof (e as Record<string, unknown>).message === "string"
          ? String((e as Record<string, unknown>).message)
          : "No se pudo actualizar la verificación del proveedor.";
      setToast({ type: "error", message: msg });
    } finally {
      setVerifyingId(null);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return [
      supplier.name,
      supplier.short_name,
      supplier.rfc,
      supplier.phone,
      supplier.email,
      supplier.city,
      supplier.state,
    ].some((value) => value?.toLowerCase().includes(term));
  });

  const allSelected = filteredSuppliers.length > 0 && filteredSuppliers.every((supplier) => selectedIds.includes(supplier.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSuppliers.map((s) => s.id));
    }
  };

  const deleteSupplierInternal = async (
    id: number
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      let numericId = Number(id);
      let targetSlug: string | undefined = undefined;

      if (!Number.isFinite(numericId)) {
        const s =
          suppliers.find((x) => String(x.id) === String(id)) ||
          suppliers.find((x) => x.slug && String(x.slug) === String(id));
        targetSlug = s?.slug;

        if (targetSlug) {
          const resolve = await fetch(apiUrl(`/suppliers/${encodeURIComponent(targetSlug)}`), {
            headers: authHeaders(token || ""),
          });
          if (resolve.ok) {
            const data = await resolve.json();
            if (data?.id && Number.isFinite(Number(data.id))) {
              numericId = Number(data.id);
            }
          }
        }
      }

      const response = await fetch(apiUrl(`/suppliers/${numericId}`), {
        method: "DELETE",
        headers: { ...authHeaders(token || ""), "X-Requested-With": "XMLHttpRequest" },
      });

      if (response.ok || response.status === 404) {
        return { success: true };
      }

      let message = `Error al eliminar (${response.status})`;
      try {
        const data = await response.json();
        if (data?.error_source === "proxy_debug") {
          const backendResp =
            typeof data.backend_response === "string"
              ? data.backend_response
              : JSON.stringify(data.backend_response);
          message = `URL: ${data.debug_target_url}\nStatus: ${data.status}\nBackend: ${backendResp}`;
        } else if (typeof data?.backend_response === "string") {
          message = data.backend_response;
        } else if (data?.detail) {
          message =
            typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
        } else if (data?.message) {
          message = data.message;
        }
      } catch {
        try {
          const text = await response.text();
          if (text) message = text;
        } catch {}
      }

      return { success: false, message };
    } catch (error) {
      console.error("Error deleting supplier:", error);
      return { success: false, message: "Error de red al eliminar proveedor" };
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este proveedor?")) return;
    
    if (!token) return;

    const result = await deleteSupplierInternal(id);
    if (result.success) {
      fetchSuppliers();
    } else if (result.message) {
      setToast({ type: "error", message: result.message });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!token) return;

    if (
      !confirm(
        `¿Estás seguro de eliminar ${selectedIds.length} proveedor(es) seleccionados?`
      )
    )
      return;

    const numericIds = selectedIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));

    if (numericIds.length === 0) {
      setToast({ type: "info", message: "No hay IDs válidos para borrar." });
      return;
    }

    try {
      const response = await fetch(apiUrl(`/suppliers/bulk-delete`), {
        method: "POST",
        body: JSON.stringify({ ids: numericIds }),
        headers: {
          ...authHeaders(token),
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        setSelectedIds([]);
        fetchSuppliers();
      } else {
        let message = `Error al eliminar (${response.status})`;
        try {
          const data = await response.json();
          if (data?.error_source === "proxy_debug") {
            const backendResp =
              typeof data.backend_response === "string"
                ? data.backend_response
                : JSON.stringify(data.backend_response);
            message = `URL: ${data.debug_target_url}\nStatus: ${data.status}\nBackend: ${backendResp}`;
          } else if (typeof data?.backend_response === "string") {
            message = data.backend_response;
          } else if (data?.detail) {
            message =
              typeof data.detail === "string"
                ? data.detail
                : JSON.stringify(data.detail);
          } else if (data?.message) {
            message = data.message;
          }
        } catch {
          try {
            const text = await response.text();
            if (text) message = text;
          } catch {}
        }
        setToast({ type: "error", message });
      }
    } catch (e) {
      console.error("Error en borrado masivo:", e);
      setToast({ type: "error", message: "Error de red al intentar borrar proveedores." });
    }
  };

  return (
    <div className="space-y-6">
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
      {subscriptionSupplier ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#168e00]">Suscripción</p>
                <h2 className="font-[family-name:var(--font-varela-round)] text-2xl font-bold text-gray-950">
                  {subscriptionSupplier.name}
                </h2>
                <p className="mt-1 text-sm text-gray-500">Elige cómo registrar o generar el pago del proveedor.</p>
              </div>
              <button
                type="button"
                onClick={closeSubscriptionModal}
                className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
                aria-label="Cerrar modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Plan</label>
                <select
                  value={subscriptionPlanId ?? ""}
                  onChange={(event) => setSubscriptionPlanId(Number(event.target.value))}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                >
                  {plans.length === 0 ? <option value="">No hay planes activos</option> : null}
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.title} · ${plan.price} · {plan.duration === "yearly" ? "Anual" : "Mensual"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-700">Método de pago</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setSubscriptionPaymentMethod("card_terminal")}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all",
                      subscriptionPaymentMethod === "card_terminal"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-gray-100 hover:border-primary/30 hover:bg-[#f2f3f4]"
                    )}
                  >
                    <div className="font-semibold">Terminal</div>
                    <div className="mt-1 text-xs text-gray-500">Registra pago por terminal.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubscriptionPaymentMethod("card")}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all",
                      subscriptionPaymentMethod === "card"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-gray-100 hover:border-primary/30 hover:bg-[#f2f3f4]"
                    )}
                  >
                    <div className="font-semibold">Tarjeta</div>
                    <div className="mt-1 text-xs text-gray-500">Genera liga de Mercado Pago.</div>
                  </button>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeSubscriptionModal}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-primary/30 hover:text-primary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingSubscription || !subscriptionPlanId || plans.length === 0}
                  onClick={handleSubscriptionPurchase}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingSubscription ? <Loader2 className="animate-spin" size={18} /> : <CreditCard size={18} />}
                  {subscriptionPaymentMethod === "card" ? "Generar liga" : "Registrar terminal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <PageHero
        title="Gestión de Proveedores"
        subtitle="Administra la lista de proveedores del sistema."
        eyebrow="Usuarios"
        actions={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={selectedIds.length === 0}
            className="cursor-pointer px-4 py-2 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-40 disabled:cursor-default transition-colors"
          >
            Eliminar seleccionados {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
          </button>
          <Link 
            href="/admin/suppliers/create"
            className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
          >
            <Plus size={20} />
            <span>Nuevo Proveedor</span>
          </Link>
        </div>
        }
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar proveedores..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : (
          <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 text-primary border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">RFC</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Teléfono</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Email</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Estado</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Suscripción</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Verificado</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-500">
                      No se encontraron proveedores.
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((supplier) => (
                    <Fragment key={supplier.id}>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(supplier.id)}
                            onChange={() => toggleSelect(supplier.id)}
                            className="h-4 w-4 text-primary border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-800">{supplier.name}</div>
                          {supplier.short_name && (
                            <div className="text-xs text-gray-400">{supplier.short_name}</div>
                          )}
                          <div className="md:hidden text-xs text-gray-500 mt-1">
                            {supplier.phone}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{supplier.rfc || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 hidden md:table-cell">{supplier.phone || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 hidden lg:table-cell">{supplier.email || '-'}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border",
                            supplier.is_active 
                              ? "bg-green-50 text-green-700 border-green-100" 
                              : "bg-gray-50 text-gray-600 border-gray-100"
                          )}>
                            {supplier.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {(() => {
                            const badge = subscriptionBadge(subscriptionsBySupplier[supplier.id], {
                              loading: loadingSubscriptions,
                              error: subscriptionsError,
                            });
                            return (
                              <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border", badge.className)}>
                                {badge.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                              supplier.is_verified
                                ? "border-green-100 bg-green-50 text-green-700"
                                : "border-gray-100 bg-gray-50 text-gray-600"
                            )}
                          >
                            {supplier.is_verified ? "Verificado" : "Sin verificar"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isAdminUser ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleVerified(supplier);
                                }}
                                disabled={verifyingId === supplier.id}
                                className={cn(
                                  "p-2 rounded-lg transition-colors",
                                  supplier.is_verified
                                    ? "text-gray-400 hover:text-primary hover:bg-primary/5"
                                    : "text-gray-400 hover:text-green-600 hover:bg-green-50",
                                  verifyingId === supplier.id ? "opacity-60 cursor-default" : ""
                                )}
                                title={supplier.is_verified ? "Desverificar" : "Verificar"}
                              >
                                {verifyingId === supplier.id ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : supplier.is_verified ? (
                                  <XCircle size={18} />
                                ) : (
                                  <CheckCircle size={18} />
                                )}
                              </button>
                            ) : null}
                            {isAdminUser ? (
                              <button
                                type="button"
                                onClick={() => openSubscriptionModal(supplier)}
                                className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                title="Gestionar suscripción"
                              >
                                <CreditCard size={18} />
                              </button>
                            ) : null}
                            <Link 
                              href={`/admin/suppliers/${supplier.id}`}
                              className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDelete(supplier.id)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-gray-100 md:hidden">
            {filteredSuppliers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No se encontraron proveedores.</div>
            ) : (
              filteredSuppliers.map((supplier) => (
                <article key={supplier.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(supplier.id)}
                      onChange={() => toggleSelect(supplier.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words text-sm font-semibold text-gray-900">{supplier.name}</h3>
                          {supplier.short_name ? <p className="mt-1 text-xs text-gray-400">{supplier.short_name}</p> : null}
                        </div>
                        <span className={cn(
                          "shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                          supplier.is_active ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-50 text-gray-600 border-gray-100"
                        )}>
                          {supplier.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-gray-50 p-2">
                          <div className="font-semibold uppercase tracking-wide text-gray-400">RFC</div>
                          <div className="mt-1 break-words text-gray-700">{supplier.rfc || "-"}</div>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-2">
                          <div className="font-semibold uppercase tracking-wide text-gray-400">Teléfono</div>
                          <div className="mt-1 break-words text-gray-700">{supplier.phone || "-"}</div>
                        </div>
                        <div className="col-span-2 rounded-xl bg-gray-50 p-2">
                          <div className="font-semibold uppercase tracking-wide text-gray-400">Email</div>
                          <div className="mt-1 break-all text-gray-700">{supplier.email || "-"}</div>
                        </div>
                        <div className="col-span-2 rounded-xl bg-gray-50 p-2">
                          <div className="font-semibold uppercase tracking-wide text-gray-400">Ubicación</div>
                          <div className="mt-1 break-words text-gray-700">{[supplier.city, supplier.state, supplier.country].filter(Boolean).join(", ") || "-"}</div>
                        </div>
                        <div className="col-span-2 rounded-xl bg-gray-50 p-2">
                          <div className="font-semibold uppercase tracking-wide text-gray-400">Suscripción</div>
                          <div className="mt-1">
                            {(() => {
                              const badge = subscriptionBadge(subscriptionsBySupplier[supplier.id], {
                                loading: loadingSubscriptions,
                                error: subscriptionsError,
                              });
                              return (
                                <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", badge.className)}>
                                  {badge.label}
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="text-xs text-gray-500">
                          {supplier.is_verified ? (
                            <span className="inline-flex items-center gap-1 text-[#168e00]">
                              <CheckCircle size={14} />
                              Verificado
                            </span>
                          ) : (
                            "Sin verificar"
                          )}
                        </div>
                        <div className="flex gap-2">
                          {isAdminUser ? (
                            <button
                              type="button"
                              onClick={() => toggleVerified(supplier)}
                              disabled={verifyingId === supplier.id}
                              className="rounded-lg p-2 text-gray-400 hover:bg-green-50 hover:text-green-600 disabled:opacity-50"
                              title={supplier.is_verified ? "Desverificar" : "Verificar"}
                            >
                              {verifyingId === supplier.id ? <Loader2 size={18} className="animate-spin" /> : supplier.is_verified ? <XCircle size={18} /> : <CheckCircle size={18} />}
                            </button>
                          ) : null}
                          {isAdminUser ? (
                            <button
                              type="button"
                              onClick={() => openSubscriptionModal(supplier)}
                              className="rounded-lg p-2 text-gray-400 hover:bg-primary/5 hover:text-primary"
                              title="Gestionar suscripción"
                            >
                              <CreditCard size={18} />
                            </button>
                          ) : null}
                          <Link href={`/admin/suppliers/${supplier.id}`} className="rounded-lg p-2 text-gray-400 hover:bg-primary/5 hover:text-primary" title="Editar">
                            <Edit2 size={18} />
                          </Link>
                          <button type="button" onClick={() => handleDelete(supplier.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500" title="Eliminar">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
          </>
        )}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Mostrando {filteredSuppliers.length} proveedores
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSkip(Math.max(0, skip - limit))}
              disabled={skip === 0}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => setSkip(skip + limit)}
              disabled={suppliers.length < limit}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
