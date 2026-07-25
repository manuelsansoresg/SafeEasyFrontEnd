"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Save, X } from "lucide-react";
import { subscriptionsService } from "@/services/subscriptionsService";
import type {
  Plan,
  Subscription,
  SubscriptionAssignmentType,
  UpdateManualSubscriptionPayload,
} from "@/types/subscriptions";

type Props = {
  open: boolean;
  subscription: Subscription | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

const assignmentTypeOptions: Array<{
  value: SubscriptionAssignmentType;
  label: string;
}> = [
  { value: "courtesy", label: "Cortesía" },
  { value: "external_payment", label: "Pago externo" },
  { value: "migration", label: "Migración" },
  { value: "support", label: "Soporte" },
  { value: "other", label: "Otro" },
];

const formSchema = z.object({
  status: z.enum(["active", "expired", "cancelled"]),
  plan_id: z.number().int().positive("Selecciona un plan."),
  start_date: z.string(),
  end_date: z.string().min(1, "Captura la fecha de vencimiento."),
  assignment_type: z.enum(["courtesy", "external_payment", "migration", "support", "other"]),
  note: z.string().trim().min(3, "Escribe el motivo del cambio."),
});

type FormValues = z.infer<typeof formSchema>;

const toDateTimeInputValue = (iso: string | null | undefined) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const toIso = (value: string) => new Date(value).toISOString();

const getInitialValues = (subscription: Subscription | null): FormValues => ({
  status: subscription?.status ?? "active",
  plan_id: subscription?.plan_id ?? 0,
  start_date: toDateTimeInputValue(subscription?.start_date),
  end_date: toDateTimeInputValue(subscription?.end_date),
  assignment_type: "support",
  note: "",
});

export default function EditSubscriptionModal({
  open,
  subscription,
  onClose,
  onSaved,
}: Props) {
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  const initialValues = useMemo(() => getInitialValues(subscription), [subscription]);
  const { register, handleSubmit, reset } = useForm<FormValues>({
    mode: "onSubmit",
    reValidateMode: "onBlur",
    defaultValues: initialValues,
  });

  useEffect(() => {
    reset(initialValues);
    setError(null);
  }, [initialValues, reset]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoadingPlans(true);
    subscriptionsService
      .listPlans()
      .then((data) => {
        if (mounted) setPlans(data);
      })
      .catch((loadError) => {
        console.error("Failed to load plans:", loadError);
        if (mounted) setError("No se pudieron cargar los planes.");
      })
      .finally(() => {
        if (mounted) setLoadingPlans(false);
      });
    return () => {
      mounted = false;
    };
  }, [open]);

  const submit = async (values: FormValues) => {
    if (!subscription) return;
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Revisa los datos del formulario.");
      return;
    }

    const payload: UpdateManualSubscriptionPayload = {
      assignment_type: parsed.data.assignment_type,
      note: parsed.data.note,
    };

    if (parsed.data.status !== subscription.status) {
      payload.status = parsed.data.status;
    }
    if (parsed.data.plan_id !== subscription.plan_id) {
      payload.plan_id = parsed.data.plan_id;
    }

    const currentStart = toDateTimeInputValue(subscription.start_date);
    if (parsed.data.start_date && parsed.data.start_date !== currentStart) {
      payload.start_date = toIso(parsed.data.start_date);
    }

    const currentEnd = toDateTimeInputValue(subscription.end_date);
    if (parsed.data.end_date !== currentEnd) {
      payload.end_date = toIso(parsed.data.end_date);
    }

    if (
      payload.status === undefined &&
      payload.plan_id === undefined &&
      payload.start_date === undefined &&
      payload.end_date === undefined
    ) {
      setError("Realiza al menos un cambio antes de guardar.");
      return;
    }

    if (
      parsed.data.start_date &&
      new Date(parsed.data.end_date).getTime() <= new Date(parsed.data.start_date).getTime()
    ) {
      setError("La fecha de vencimiento debe ser posterior a la fecha de inicio.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await subscriptionsService.updateManual(subscription.id, payload);
      await onSaved();
      onClose();
    } catch (saveError) {
      console.error("Failed to update subscription:", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo modificar la subscripción.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const currentStatus =
    subscription?.status === "active"
      ? "Activa"
      : subscription?.status === "cancelled"
        ? "Cancelada"
        : "Expirada";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-subscription-title"
    >
      <form
        onSubmit={handleSubmit(submit)}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div>
            <h2 id="edit-subscription-title" className="text-lg font-semibold text-gray-900">
              Modificar subscripción
            </h2>
            <p className="text-sm text-gray-500">
              Suscripción <span className="font-medium text-gray-900">#{subscription?.id}</span>
              {subscription?.supplier_name ? ` · ${subscription.supplier_name}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Estado actual
              </div>
              <div className="mt-1 font-medium text-gray-900">{currentStatus}</div>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Plan actual
              </div>
              <div className="mt-1 font-medium text-gray-900">
                {subscription?.plan?.title || `Plan #${subscription?.plan_id}`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="edit_subscription_status" className="text-sm font-medium text-gray-700">
                Estado
              </label>
              <select
                id="edit_subscription_status"
                {...register("status")}
                disabled={saving}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="active">Activa</option>
                <option value="expired">Expirada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="edit_subscription_plan" className="text-sm font-medium text-gray-700">
                Plan
              </label>
              <select
                id="edit_subscription_plan"
                {...register("plan_id", { valueAsNumber: true })}
                disabled={saving || loadingPlans}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-gray-50"
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title} · {plan.duration === "monthly" ? "Mensual" : "Anual"}
                    {plan.is_active ? "" : " (inactivo)"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="edit_subscription_start" className="text-sm font-medium text-gray-700">
                Inicio de vigencia
              </label>
              <input
                id="edit_subscription_start"
                type="datetime-local"
                {...register("start_date")}
                disabled={saving}
                className="h-11 w-full rounded-xl border border-gray-200 px-4 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {!subscription?.start_date ? (
                <p className="text-xs text-gray-500">
                  Déjalo vacío si no deseas establecer una fecha de inicio.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="edit_subscription_end" className="text-sm font-medium text-gray-700">
                Fin de vigencia
              </label>
              <input
                id="edit_subscription_end"
                type="datetime-local"
                {...register("end_date")}
                disabled={saving}
                className="h-11 w-full rounded-xl border border-gray-200 px-4 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="edit_assignment_type" className="text-sm font-medium text-gray-700">
              Motivo administrativo
            </label>
            <select
              id="edit_assignment_type"
              {...register("assignment_type")}
              disabled={saving}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {assignmentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="edit_subscription_note" className="text-sm font-medium text-gray-700">
              Nota de auditoría
            </label>
            <textarea
              id="edit_subscription_note"
              {...register("note")}
              disabled={saving}
              rows={3}
              placeholder="Describe por qué se realiza este cambio"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-xs leading-5 text-gray-500">
              Es obligatoria y quedará guardada permanentemente en el historial.
            </p>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <X size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 p-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || loadingPlans || !subscription}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Guardar cambio
          </button>
        </div>
      </form>
    </div>
  );
}
