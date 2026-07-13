"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { cn } from "@/lib/utils";
import { PageHero } from "@/components/ui/PageHero";
import { CheckCircle, ChevronDown, Loader2, Search } from "lucide-react";

type AdminSettings = {
  min_distance_km: number;
  extra_cost_per_km: number;
  commission_type: "percentage" | "fixed";
  commission_value: number;
  seller_commission_type: "percentage" | "fixed";
  seller_commission_value: number;
  subscription_linked_commission_user_id: number | null;
  subscription_linked_commission_type: "percentage" | "fixed";
  subscription_linked_commission_value: number;
  subscription_linked_commission_is_active: boolean;
};

type AdminUser = {
  id: number;
  email: string;
  name?: string;
  full_name?: string;
  role?: string;
};

const DEFAULT_SETTINGS: AdminSettings = {
  min_distance_km: 0,
  extra_cost_per_km: 0,
  commission_type: "percentage",
  commission_value: 10,
  seller_commission_type: "percentage",
  seller_commission_value: 5,
  subscription_linked_commission_user_id: null,
  subscription_linked_commission_type: "percentage",
  subscription_linked_commission_value: 0,
  subscription_linked_commission_is_active: false,
};

const parseNumber = (value: unknown, fallback: number) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const v = Number.parseFloat(value);
    if (Number.isFinite(v)) return v;
  }
  return fallback;
};

const pickSettingsRecord = (data: unknown): Record<string, unknown> | null => {
  if (!data || typeof data !== "object") return null;
  const rec = data as Record<string, unknown>;
  const nested =
    (rec.settings && typeof rec.settings === "object" ? (rec.settings as Record<string, unknown>) : null) ||
    (rec.data && typeof rec.data === "object" ? (rec.data as Record<string, unknown>) : null) ||
    null;
  return nested || rec;
};

const parseBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "si", "sí"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return fallback;
};

const parseNullableId = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const unwrapUsers = (data: unknown): AdminUser[] => {
  if (Array.isArray(data)) return data as AdminUser[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const items = record.items ?? record.results ?? record.data ?? record.users;
    if (Array.isArray(items)) return items as AdminUser[];
  }
  return [];
};

const formatUserLabel = (user: AdminUser) => {
  const displayName = user.full_name || user.name || user.email || `Usuario #${user.id}`;
  return user.email && displayName !== user.email ? `${displayName} (${user.email})` : displayName;
};

const getResponseMessage = async (res: Response, fallback: string) => {
  const data: unknown = await res.json().catch(() => ({}));
  const rec = (data && typeof data === "object" ? (data as Record<string, unknown>) : {}) as Record<string, unknown>;
  return (
    (typeof rec.detail === "string" && rec.detail) ||
    (typeof rec.message === "string" && rec.message) ||
    (typeof rec.error === "string" && rec.error) ||
    fallback
  );
};

const applySettings = (
  settings: AdminSettings,
  setters: {
    setCommissionType: (value: "percentage" | "fixed") => void;
    setCommissionValue: (value: string) => void;
    setSellerCommissionType: (value: "percentage" | "fixed") => void;
    setSellerCommissionValue: (value: string) => void;
    setMinDistanceKm: (value: string) => void;
    setExtraCostPerKm: (value: string) => void;
    setSubscriptionLinkedCommissionUserId: (value: string) => void;
    setSubscriptionLinkedCommissionType: (value: "percentage" | "fixed") => void;
    setSubscriptionLinkedCommissionValue: (value: string) => void;
    setSubscriptionLinkedCommissionIsActive: (value: boolean) => void;
  },
) => {
  setters.setCommissionType(settings.commission_type);
  setters.setCommissionValue(String(settings.commission_value));
  setters.setSellerCommissionType(settings.seller_commission_type);
  setters.setSellerCommissionValue(String(settings.seller_commission_value));
  setters.setMinDistanceKm(String(settings.min_distance_km));
  setters.setExtraCostPerKm(String(settings.extra_cost_per_km));
  setters.setSubscriptionLinkedCommissionUserId(settings.subscription_linked_commission_user_id?.toString() || "");
  setters.setSubscriptionLinkedCommissionType(settings.subscription_linked_commission_type);
  setters.setSubscriptionLinkedCommissionValue(String(settings.subscription_linked_commission_value));
  setters.setSubscriptionLinkedCommissionIsActive(settings.subscription_linked_commission_is_active);
};

export default function ConfiguracionPage() {
  const router = useRouter();
  const { user, token } = useAuthStore();

  const isAdmin = user?.role === "admin" || user?.role === "superuser";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<null | { type: "success" | "error"; message: string }>(null);

  const [commissionType, setCommissionType] = useState<"percentage" | "fixed">("percentage");
  const [commissionValue, setCommissionValue] = useState<string>("");
  const [sellerCommissionType, setSellerCommissionType] = useState<"percentage" | "fixed">("percentage");
  const [sellerCommissionValue, setSellerCommissionValue] = useState<string>("");
  const [subscriptionLinkedCommissionUserId, setSubscriptionLinkedCommissionUserId] = useState<string>("");
  const [subscriptionLinkedCommissionType, setSubscriptionLinkedCommissionType] = useState<"percentage" | "fixed">("percentage");
  const [subscriptionLinkedCommissionValue, setSubscriptionLinkedCommissionValue] = useState<string>("");
  const [subscriptionLinkedCommissionIsActive, setSubscriptionLinkedCommissionIsActive] = useState(false);
  const [minDistanceKm, setMinDistanceKm] = useState<string>("");
  const [extraCostPerKm, setExtraCostPerKm] = useState<string>("");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userSelectOpen, setUserSelectOpen] = useState(false);

  const canSubmit = useMemo(() => {
    const comm = Number.parseFloat(commissionValue);
    const sellerComm = Number.parseFloat(sellerCommissionValue);
    const linkedComm = Number.parseFloat(subscriptionLinkedCommissionValue);
    const linkedUserId = Number.parseInt(subscriptionLinkedCommissionUserId, 10);
    const min = Number.parseFloat(minDistanceKm);
    const extra = Number.parseFloat(extraCostPerKm);
    const commOk =
      Number.isFinite(comm) && comm >= 0 && (commissionType === "fixed" || (commissionType === "percentage" && comm <= 100));
    const sellerCommOk =
      Number.isFinite(sellerComm) &&
      sellerComm >= 0 &&
      (sellerCommissionType === "fixed" || (sellerCommissionType === "percentage" && sellerComm <= 100));
    const linkedCommOk =
      !subscriptionLinkedCommissionIsActive ||
      (Number.isFinite(linkedComm) &&
        linkedComm >= 0 &&
        Number.isFinite(linkedUserId) &&
        linkedUserId > 0 &&
        (subscriptionLinkedCommissionType === "fixed" ||
          (subscriptionLinkedCommissionType === "percentage" && linkedComm <= 100)));
    return (
      commOk &&
      sellerCommOk &&
      linkedCommOk &&
      Number.isFinite(min) &&
      min >= 0 &&
      Number.isFinite(extra) &&
      extra >= 0 &&
      !saving &&
      !loading
    );
  }, [
    commissionValue,
    commissionType,
    sellerCommissionValue,
    sellerCommissionType,
    subscriptionLinkedCommissionIsActive,
    subscriptionLinkedCommissionType,
    subscriptionLinkedCommissionUserId,
    subscriptionLinkedCommissionValue,
    minDistanceKm,
    extraCostPerKm,
    saving,
    loading,
  ]);

  const selectedLinkedUser = useMemo(
    () => users.find((linkedUser) => String(linkedUser.id) === subscriptionLinkedCommissionUserId),
    [subscriptionLinkedCommissionUserId, users],
  );

  const linkedUserDisplayValue =
    userSelectOpen
      ? userSearch
      : selectedLinkedUser
        ? formatUserLabel(selectedLinkedUser)
        : subscriptionLinkedCommissionUserId
          ? `Usuario #${subscriptionLinkedCommissionUserId}`
          : "";

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!token) return;
    if (user && !isAdmin) {
      router.replace("/admin/dashboard");
    }
  }, [token, user, isAdmin, router]);

  useEffect(() => {
    if (!token || !isAdmin) return;
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      setUsersLoading(true);
      try {
        const params = new URLSearchParams({ skip: "0", limit: "20" });
        if (userSearch.trim()) params.set("search", userSearch.trim());
        const res = await fetchWithAuth(`/api/users/?${params.toString()}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data: unknown = await res.json().catch(() => null);
        setUsers(unwrapUsers(data));
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [token, isAdmin, userSearch]);

  const loadSettings = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth("/api/admin/settings", { headers: { Accept: "application/json" } });
      if (!res.ok) {
        applySettings(DEFAULT_SETTINGS, {
          setCommissionType,
          setCommissionValue,
          setSellerCommissionType,
          setSellerCommissionValue,
          setMinDistanceKm,
          setExtraCostPerKm,
          setSubscriptionLinkedCommissionUserId,
          setSubscriptionLinkedCommissionType,
          setSubscriptionLinkedCommissionValue,
          setSubscriptionLinkedCommissionIsActive,
        });
        setError(null);
        return;
      }
      const data: unknown = await res.json().catch(() => null);
      const src = pickSettingsRecord(data) || {};

      const settings: AdminSettings = {
        min_distance_km: Math.max(0, parseNumber(src.min_distance_km, 0)),
        extra_cost_per_km: Math.max(0, parseNumber(src.extra_cost_per_km, 0)),
        commission_type: (String(src.commission_type ?? "").trim() === "fixed" ? "fixed" : "percentage") as
          | "percentage"
          | "fixed",
        commission_value: Math.max(0, parseNumber(src.commission_value, 0)),
        seller_commission_type: (String(src.seller_commission_type ?? "").trim() === "fixed" ? "fixed" : "percentage") as
          | "percentage"
          | "fixed",
        seller_commission_value: Math.max(0, parseNumber(src.seller_commission_value, DEFAULT_SETTINGS.seller_commission_value)),
        subscription_linked_commission_user_id: parseNullableId(src.subscription_linked_commission_user_id),
        subscription_linked_commission_type: (String(src.subscription_linked_commission_type ?? "").trim() === "fixed"
          ? "fixed"
          : "percentage") as "percentage" | "fixed",
        subscription_linked_commission_value: Math.max(
          0,
          parseNumber(src.subscription_linked_commission_value, DEFAULT_SETTINGS.subscription_linked_commission_value),
        ),
        subscription_linked_commission_is_active: parseBoolean(
          src.subscription_linked_commission_is_active,
          DEFAULT_SETTINGS.subscription_linked_commission_is_active,
        ),
      };

      applySettings(settings, {
        setCommissionType,
        setCommissionValue,
        setSellerCommissionType,
        setSellerCommissionValue,
        setMinDistanceKm,
        setExtraCostPerKm,
        setSubscriptionLinkedCommissionUserId,
        setSubscriptionLinkedCommissionType,
        setSubscriptionLinkedCommissionValue,
        setSubscriptionLinkedCommissionIsActive,
      });
    } catch {
      applySettings(DEFAULT_SETTINGS, {
        setCommissionType,
        setCommissionValue,
        setSellerCommissionType,
        setSellerCommissionValue,
        setMinDistanceKm,
        setExtraCostPerKm,
        setSubscriptionLinkedCommissionUserId,
        setSubscriptionLinkedCommissionType,
        setSubscriptionLinkedCommissionValue,
        setSubscriptionLinkedCommissionIsActive,
      });
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [token, isAdmin]);

  const saveSettings = async () => {
    const comm = Number.parseFloat(commissionValue);
    const sellerComm = Number.parseFloat(sellerCommissionValue);
    const linkedComm = Number.parseFloat(subscriptionLinkedCommissionValue);
    const linkedUserId = Number.parseInt(subscriptionLinkedCommissionUserId, 10);
    const min = Number.parseFloat(minDistanceKm);
    const extra = Number.parseFloat(extraCostPerKm);
    if (!Number.isFinite(comm) || comm < 0 || (commissionType === "percentage" && comm > 100)) {
      setToast({
        type: "error",
        message: commissionType === "percentage" ? "La comisión debe estar entre 0 y 100." : "Comisión inválida.",
      });
      return;
    }
    if (!Number.isFinite(sellerComm) || sellerComm < 0 || (sellerCommissionType === "percentage" && sellerComm > 100)) {
      setToast({
        type: "error",
        message:
          sellerCommissionType === "percentage"
            ? "La comisión por venta de suscripción debe estar entre 0 y 100."
            : "Comisión por venta de suscripción inválida.",
      });
      return;
    }
    if (subscriptionLinkedCommissionIsActive && (!Number.isFinite(linkedUserId) || linkedUserId <= 0)) {
      setToast({ type: "error", message: "Selecciona un usuario para la comisión por usuario." });
      return;
    }
    if (
      subscriptionLinkedCommissionIsActive &&
      (!Number.isFinite(linkedComm) ||
        linkedComm < 0 ||
        (subscriptionLinkedCommissionType === "percentage" && linkedComm > 100))
    ) {
      setToast({
        type: "error",
        message:
          subscriptionLinkedCommissionType === "percentage"
            ? "La comisión por usuario debe estar entre 0 y 100."
            : "Comisión por usuario inválida.",
      });
      return;
    }
    if (!Number.isFinite(min) || min < 0) {
      setToast({ type: "error", message: "Distancia mínima inválida." });
      return;
    }
    if (!Number.isFinite(extra) || extra < 0) {
      setToast({ type: "error", message: "Costo extra por km inválido." });
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const body = {
        min_distance_km: min,
        extra_cost_per_km: extra,
        commission_type: commissionType,
        commission_value: comm,
        seller_commission_type: sellerCommissionType,
        seller_commission_value: sellerComm,
        subscription_linked_commission_user_id: Number.isFinite(linkedUserId) && linkedUserId > 0 ? linkedUserId : null,
        subscription_linked_commission_type: subscriptionLinkedCommissionType,
        subscription_linked_commission_value: Number.isFinite(linkedComm) ? linkedComm : 0,
        subscription_linked_commission_is_active: subscriptionLinkedCommissionIsActive,
      };

      const res = await fetchWithAuth("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(body),
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const msg = await getResponseMessage(res, "No se pudo guardar la configuración.");
        setToast({ type: "error", message: msg });
        return;
      }

      setToast({ type: "success", message: "Configuración guardada correctamente." });
    } catch {
      setToast({ type: "error", message: "Error de conexión al guardar la configuración." });
    } finally {
      setSaving(false);
    }
  };

  if (!token) {
    return (
      <div className="space-y-6">
        <PageHero title="Configuración General" subtitle="Gestiona los parámetros generales de la plataforma." />
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-gray-500">Inicia sesión para ver esta sección.</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHero title="Configuración General" subtitle="Gestiona los parámetros generales de la plataforma." />
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-gray-500">No autorizado.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero title="Configuración General" subtitle="Gestiona los parámetros generales de la plataforma." />

      {toast ? (
        <div
          className={cn(
            "p-4 rounded-xl border flex items-center gap-2",
            toast.type === "success"
              ? "bg-green-50 text-green-700 border-green-100"
              : "bg-red-50 text-red-700 border-red-100",
          )}
        >
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      ) : null}

      {error ? <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100">{error}</div> : null}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="text-gray-500">Cargando configuración...</div>
        ) : (
          <div className="space-y-8">
            <section className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Comisión de la plataforma</h2>
                <p className="mt-1 text-sm text-gray-500">Porcentaje o monto que retiene Drooopy sobre operaciones generales.</p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Tipo de comisión</label>
                  <select
                    value={commissionType}
                    onChange={(e) => setCommissionType(e.target.value === "fixed" ? "fixed" : "percentage")}
                    className="h-11 w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    <option value="percentage">Porcentaje</option>
                    <option value="fixed">Valor fijo</option>
                  </select>
                  <p className="text-xs text-gray-500">Selecciona si se calcula como porcentaje o monto fijo.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Valor de comisión</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={commissionType === "percentage" ? 100 : undefined}
                    step="0.01"
                    value={commissionValue}
                    onChange={(e) => setCommissionValue(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder={commissionType === "percentage" ? "10" : "50.00"}
                  />
                  <p className="text-xs text-gray-500">
                    {commissionType === "percentage" ? "Porcentaje de comisión (0 a 100)." : "Monto fijo de comisión (MXN)."}
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-5 rounded-2xl border border-primary/10 bg-primary/5 p-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Comisión por venta de suscripción</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Monto que recibirá el vendedor cuando venda una suscripción a un proveedor.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Tipo de comisión del vendedor</label>
                  <select
                    value={sellerCommissionType}
                    onChange={(e) => setSellerCommissionType(e.target.value === "fixed" ? "fixed" : "percentage")}
                    className="h-11 w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    <option value="percentage">Porcentaje</option>
                    <option value="fixed">Valor fijo</option>
                  </select>
                  <p className="text-xs text-gray-500">Aplica sobre el precio de la suscripción vendida.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Valor de comisión del vendedor</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={sellerCommissionType === "percentage" ? 100 : undefined}
                    step="0.01"
                    value={sellerCommissionValue}
                    onChange={(e) => setSellerCommissionValue(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                    placeholder={sellerCommissionType === "percentage" ? "5" : "100.00"}
                  />
                  <p className="text-xs text-gray-500">
                    {sellerCommissionType === "percentage"
                      ? "Porcentaje que recibirá el vendedor (0 a 100)."
                      : "Monto fijo que recibirá el vendedor (MXN)."}
                  </p>
                </div>
              </div>

              <div className="border-t border-primary/10 pt-5">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Comisión por usuario</h3>
                    <p className="mt-1 text-xs text-gray-600">
                      Comisión especial para una suscripción vinculada a un usuario específico.
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-medium text-gray-700">
                    <span>Activar comisión</span>
                    <input
                      type="checkbox"
                      checked={subscriptionLinkedCommissionIsActive}
                      onChange={(e) => setSubscriptionLinkedCommissionIsActive(e.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="relative h-6 w-11 rounded-full bg-gray-300 transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
                  </label>
                </div>

                <div className="grid gap-5 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-3">
                    <label className="text-sm font-medium text-gray-700">Usuario vinculado</label>
                    <div
                      className="relative"
                      onBlur={() => {
                        window.setTimeout(() => {
                          setUserSelectOpen(false);
                          setUserSearch("");
                        }, 150);
                      }}
                    >
                      <Search className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="text"
                        value={linkedUserDisplayValue}
                        onFocus={() => {
                          setUserSelectOpen(true);
                          setUserSearch("");
                        }}
                        onChange={(e) => {
                          setUserSearch(e.target.value);
                          setUserSelectOpen(true);
                        }}
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-10 pr-11 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                        placeholder="Buscar usuario por nombre o correo"
                        disabled={!subscriptionLinkedCommissionIsActive}
                        role="combobox"
                        aria-expanded={userSelectOpen}
                        aria-controls="linked-user-options"
                        aria-haspopup="listbox"
                        aria-autocomplete="list"
                      />
                      <ChevronDown
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                        size={18}
                      />

                      {userSelectOpen && subscriptionLinkedCommissionIsActive ? (
                        <div className="absolute z-20 mt-2 max-h-64 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                          <div id="linked-user-options" role="listbox" className="max-h-64 overflow-y-auto py-1">
                            {usersLoading ? (
                              <div className="px-4 py-3 text-sm text-gray-500">Buscando usuarios...</div>
                            ) : users.length > 0 ? (
                              users.map((linkedUser) => (
                                <button
                                  key={linkedUser.id}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => {
                                    setSubscriptionLinkedCommissionUserId(String(linkedUser.id));
                                    setUserSearch("");
                                    setUserSelectOpen(false);
                                  }}
                                  role="option"
                                  aria-selected={String(linkedUser.id) === subscriptionLinkedCommissionUserId}
                                  className={cn(
                                    "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-primary/5",
                                    String(linkedUser.id) === subscriptionLinkedCommissionUserId
                                      ? "bg-primary/5 text-primary"
                                      : "text-gray-700",
                                  )}
                                >
                                  <span className="truncate">{formatUserLabel(linkedUser)}</span>
                                  {String(linkedUser.id) === subscriptionLinkedCommissionUserId ? (
                                    <CheckCircle className="shrink-0" size={16} />
                                  ) : null}
                                </button>
                              ))
                            ) : (
                              <div className="px-4 py-3 text-sm text-gray-500">No se encontraron usuarios.</div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <p className="text-xs text-gray-500">Busca y selecciona el usuario que recibirá esta comisión.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Tipo de comisión por usuario</label>
                    <select
                      value={subscriptionLinkedCommissionType}
                      onChange={(e) => setSubscriptionLinkedCommissionType(e.target.value === "fixed" ? "fixed" : "percentage")}
                      disabled={!subscriptionLinkedCommissionIsActive}
                      className="h-11 w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="percentage">Porcentaje</option>
                      <option value="fixed">Valor fijo</option>
                    </select>
                    <p className="text-xs text-gray-500">Aplica sobre la suscripción vendida por el usuario vinculado.</p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-gray-700">Valor de comisión por usuario</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={subscriptionLinkedCommissionType === "percentage" ? 100 : undefined}
                      step="0.01"
                      value={subscriptionLinkedCommissionValue}
                      onChange={(e) => setSubscriptionLinkedCommissionValue(e.target.value)}
                      disabled={!subscriptionLinkedCommissionIsActive}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                      placeholder={subscriptionLinkedCommissionType === "percentage" ? "5" : "500.00"}
                    />
                    <p className="text-xs text-gray-500">
                      {subscriptionLinkedCommissionType === "percentage"
                        ? "Porcentaje que recibirá el usuario vinculado (0 a 100)."
                        : "Monto fijo que recibirá el usuario vinculado (MXN)."}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Costo de envío</h2>
                <p className="mt-1 text-sm text-gray-500">Reglas para calcular el costo adicional por distancia.</p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Distancia Mínima de Cobro (km)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.1"
                    value={minDistanceKm}
                    onChange={(e) => setMinDistanceKm(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="2"
                  />
                  <p className="text-xs text-gray-500">Los kilómetros por debajo de este valor no se cobran extra.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Costo Extra por Kilómetro</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={extraCostPerKm}
                    onChange={(e) => setExtraCostPerKm(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="10.0"
                  />
                  <p className="text-xs text-gray-500">
                    Este monto se sumará por cada kilómetro adicional a la distancia mínima.
                  </p>
                </div>
              </div>
            </section>

            <div className="flex justify-end pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={saveSettings}
                disabled={!canSubmit}
                className="w-full bg-primary text-white py-3 rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 flex items-center justify-center gap-2 font-medium disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
