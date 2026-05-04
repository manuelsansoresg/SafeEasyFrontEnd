"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";
import { cn } from "@/lib/utils";
import { CheckCircle, Loader2 } from "lucide-react";

type AdminSettings = {
  min_distance_km: number;
  extra_cost_per_km: number;
  commission_type: "percentage" | "fixed";
  commission_value: number;
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
  const [minDistanceKm, setMinDistanceKm] = useState<string>("");
  const [extraCostPerKm, setExtraCostPerKm] = useState<string>("");

  const canSubmit = useMemo(() => {
    const comm = Number.parseFloat(commissionValue);
    const min = Number.parseFloat(minDistanceKm);
    const extra = Number.parseFloat(extraCostPerKm);
    const commOk =
      Number.isFinite(comm) && comm >= 0 && (commissionType === "fixed" || (commissionType === "percentage" && comm <= 100));
    return commOk && Number.isFinite(min) && min >= 0 && Number.isFinite(extra) && extra >= 0 && !saving && !loading;
  }, [commissionValue, commissionType, minDistanceKm, extraCostPerKm, saving, loading]);

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
        const data: unknown = await res.json().catch(() => ({}));
        const rec = (data && typeof data === "object" ? (data as Record<string, unknown>) : {}) as Record<string, unknown>;
        const msg =
          (typeof rec.detail === "string" && rec.detail) ||
          (typeof rec.message === "string" && rec.message) ||
          "No se pudo cargar la configuración.";
        setError(msg);
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
      };

      setCommissionType(settings.commission_type);
      setCommissionValue(String(settings.commission_value));
      setMinDistanceKm(String(settings.min_distance_km));
      setExtraCostPerKm(String(settings.extra_cost_per_km));
    } catch {
      setError("Error de conexión al cargar la configuración.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, [token, isAdmin]);

  const saveSettings = async () => {
    const comm = Number.parseFloat(commissionValue);
    const min = Number.parseFloat(minDistanceKm);
    const extra = Number.parseFloat(extraCostPerKm);
    if (!Number.isFinite(comm) || comm < 0 || (commissionType === "percentage" && comm > 100)) {
      setToast({
        type: "error",
        message: commissionType === "percentage" ? "La comisión debe estar entre 0 y 100." : "Comisión inválida.",
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
      };
      const res = await fetchWithAuth("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(body),
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        const rec = (data && typeof data === "object" ? (data as Record<string, unknown>) : {}) as Record<string, unknown>;
        const msg =
          (typeof rec.detail === "string" && rec.detail) ||
          (typeof rec.message === "string" && rec.message) ||
          "No se pudo guardar la configuración.";
        setToast({ type: "error", message: msg });
        return;
      }

      setToast({ type: "success", message: "Configuración guardada correctamente." });
      await loadSettings();
    } catch {
      setToast({ type: "error", message: "Error de conexión al guardar la configuración." });
    } finally {
      setSaving(false);
    }
  };

  if (!token) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800">Configuración General</h1>
        <p className="text-gray-500 mt-2">Inicia sesión para ver esta sección.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800">Configuración General</h1>
        <p className="text-gray-500 mt-2">No autorizado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Configuración General</h1>
        <p className="text-gray-500 mt-1">Gestiona los parámetros generales de la plataforma.</p>
      </div>

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
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Tipo de comisión</label>
              <select
                value={commissionType}
                onChange={(e) => setCommissionType(e.target.value === "fixed" ? "fixed" : "percentage")}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none bg-white"
              >
                <option value="percentage">Porcentaje</option>
                <option value="fixed">Valor fijo</option>
              </select>
              <p className="text-xs text-gray-500">Selecciona si la comisión se calcula como porcentaje o como monto fijo.</p>
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
                {commissionType === "percentage"
                  ? "Porcentaje de comisión (0 a 100)."
                  : "Monto fijo de comisión (MXN)."}
              </p>
            </div>

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
