"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, X } from "lucide-react";
import { subscriptionsService } from "@/services/subscriptionsService";
import type { Plan, Subscription, SubscriptionStatus, UpdateSubscriptionStatusPayload } from "@/types/subscriptions";

type Props = {
  open: boolean;
  subscription: Subscription | null;
  onClose: () => void;
  onSaved: () => void;
};

const toDateInputValue = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function EditSubscriptionModal({ open, subscription, onClose, onSaved }: Props) {
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  const initial = useMemo(() => {
    if (!subscription) {
      return {
        status: "expired" as SubscriptionStatus,
        planId: "",
        endDate: "",
        note: "",
      };
    }
    return {
      status: subscription.status,
      planId: String(subscription.plan_id ?? ""),
      endDate: toDateInputValue(subscription.end_date),
      note: "",
    };
  }, [subscription]);

  const [status, setStatus] = useState<SubscriptionStatus>(initial.status);
  const [planId, setPlanId] = useState<string>(initial.planId);
  const [endDate, setEndDate] = useState<string>(initial.endDate);
  const [note, setNote] = useState<string>(initial.note);

  useEffect(() => {
    setStatus(initial.status);
    setPlanId(initial.planId);
    setEndDate(initial.endDate);
    setNote(initial.note);
    setError(null);
  }, [initial]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoadingPlans(true);
    subscriptionsService
      .listPlans()
      .then((data) => {
        if (!mounted) return;
        setPlans(data);
      })
      .catch((e) => {
        console.error("Failed to load plans:", e);
        if (!mounted) return;
        setPlans([]);
        setError("No se pudieron cargar los planes.");
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingPlans(false);
      });
    return () => {
      mounted = false;
    };
  }, [open]);

  const handleSave = async () => {
    if (!subscription) return;
    setSaving(true);
    setError(null);
    try {
      const payload: UpdateSubscriptionStatusPayload = { status };
      const parsedPlanId = Number(planId);
      if (Number.isFinite(parsedPlanId) && parsedPlanId > 0) payload.plan_id = parsedPlanId;
      if (endDate) {
        const iso = new Date(`${endDate}T00:00:00`).toISOString();
        payload.end_date = iso;
      }
      if (note.trim()) payload.note = note.trim();

      await subscriptionsService.updateStatus(subscription.id, payload);
      onSaved();
      onClose();
    } catch (e: unknown) {
      console.error("Failed to update subscription:", e);
      setError(e instanceof Error ? e.message : "Error al guardar cambios.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-gray-900">Editar estado</div>
            <div className="text-sm text-gray-500">
              Suscripción <span className="font-medium text-gray-900">#{subscription?.id}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado actual</div>
              <div className="mt-1 font-medium text-gray-900">{subscription?.status === "active" ? "Activo" : "Expirado"}</div>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Expira</div>
              <div className="mt-1 font-medium text-gray-900">{toDateInputValue(subscription?.end_date) || "-"}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Nuevo estado</label>
              <select
                className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                value={status}
                onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}
                disabled={saving}
              >
                <option value="active">Activo</option>
                <option value="expired">Expirado</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Plan</label>
              <select
                className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:bg-gray-50"
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                disabled={saving || loadingPlans}
              >
                <option value="">Sin cambio</option>
                {plans.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.title} ({p.duration === "monthly" ? "Mensual" : "Anual"}) · ${String(p.price)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Fecha expiración</label>
              <input
                type="date"
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Nota (opcional)</label>
              <textarea
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[42px]"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
              <X size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={saving || !subscription}
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
