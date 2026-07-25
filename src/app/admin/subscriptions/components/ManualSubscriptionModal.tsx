"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { CalendarDays, Loader2, Plus, ShieldCheck, X } from "lucide-react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  SubscriptionRequestError,
  subscriptionsService,
} from "@/services/subscriptionsService";
import type {
  Plan,
  SubscriptionAssignmentType,
  SupplierSubscriptionOption,
} from "@/types/subscriptions";

type Props = {
  open: boolean;
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

const formSchema = z
  .object({
    supplier_id: z.number().int().positive("Selecciona un proveedor."),
    plan_id: z.number().int().positive("Selecciona un plan."),
    start_date: z.string().min(1, "Captura la fecha de inicio."),
    end_date: z.string().min(1, "Captura la fecha de vencimiento."),
    assignment_type: z.enum(["courtesy", "external_payment", "migration", "support", "other"]),
    note: z.string().trim().min(3, "Escribe el motivo de la asignación."),
    status: z.enum(["active", "expired", "cancelled"]),
  })
  .refine(
    (data) => new Date(data.end_date).getTime() > new Date(data.start_date).getTime(),
    {
      message: "La fecha de vencimiento debe ser posterior a la fecha de inicio.",
      path: ["end_date"],
    },
  );

type FormValues = z.infer<typeof formSchema>;

const toLocalDateTimeInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const getDefaultValues = (): FormValues => {
  const start = new Date();
  start.setSeconds(0, 0);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);

  return {
    supplier_id: 0,
    plan_id: 0,
    start_date: toLocalDateTimeInput(start),
    end_date: toLocalDateTimeInput(end),
    assignment_type: "courtesy",
    note: "",
    status: "active",
  };
};

export default function ManualSubscriptionModal({ open, onClose, onSaved }: Props) {
  const [suppliers, setSuppliers] = useState<SupplierSubscriptionOption[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { control, register, handleSubmit, reset, setValue } = useForm<FormValues>({
    mode: "onSubmit",
    reValidateMode: "onBlur",
    defaultValues: getDefaultValues(),
  });

  const supplierId = useWatch({ control, name: "supplier_id" });
  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === supplierId) ?? null,
    [supplierId, suppliers],
  );

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    reset(getDefaultValues());
    setError(null);
    setLoadingOptions(true);

    Promise.all([
      subscriptionsService.listSupplierOptions(),
      subscriptionsService.listPlans(),
    ])
      .then(([nextSuppliers, nextPlans]) => {
        if (!mounted) return;
        setSuppliers(nextSuppliers);
        setPlans(nextPlans);
      })
      .catch((loadError) => {
        console.error("Failed to load manual subscription options:", loadError);
        if (!mounted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar proveedores y planes.",
        );
      })
      .finally(() => {
        if (mounted) setLoadingOptions(false);
      });

    return () => {
      mounted = false;
    };
  }, [open, reset]);

  const submit = async (values: FormValues) => {
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Revisa los datos del formulario.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await subscriptionsService.assignManual({
        ...parsed.data,
        start_date: new Date(parsed.data.start_date).toISOString(),
        end_date: new Date(parsed.data.end_date).toISOString(),
      });
      await onSaved();
      onClose();
    } catch (saveError) {
      console.error("Failed to assign manual subscription:", saveError);
      if (saveError instanceof SubscriptionRequestError && saveError.status === 409) {
        setError(
          "Este proveedor ya tiene una subscripción. Utiliza la opción Editar para modificarla.",
        );
      } else {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "No se pudo asignar la subscripción.",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-subscription-title"
    >
      <form
        onSubmit={handleSubmit(submit)}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-gray-100 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 id="manual-subscription-title" className="text-lg font-semibold text-gray-900">
                Asignar subscripción
              </h2>
              <p className="text-sm text-gray-500">
                Activa manualmente un plan para un proveedor.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Cerrar"
          >
            <X size={19} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            Esta asignación no genera un pago. El motivo quedará registrado en el historial de auditoría.
          </div>

          <input type="hidden" {...register("supplier_id", { valueAsNumber: true })} />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="manual_supplier" className="text-sm font-medium text-gray-700">
                Proveedor
              </label>
              <SearchableSelect
                id="manual_supplier"
                value={selectedSupplier}
                options={suppliers.map((supplier) => ({
                  id: supplier.id,
                  name: supplier.short_name
                    ? `${supplier.name} · ${supplier.short_name}`
                    : supplier.name,
                }))}
                onChange={(option) =>
                  setValue("supplier_id", option?.id ?? 0, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                placeholder={loadingOptions ? "Cargando proveedores..." : "Selecciona un proveedor"}
                searchPlaceholder="Buscar proveedor..."
                emptyLabel="No se encontraron proveedores"
                disabled={loadingOptions || saving}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="manual_plan" className="text-sm font-medium text-gray-700">
                Plan
              </label>
              <select
                id="manual_plan"
                {...register("plan_id", { valueAsNumber: true })}
                disabled={loadingOptions || saving}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-gray-50"
              >
                <option value={0}>
                  {loadingOptions ? "Cargando planes..." : "Selecciona un plan"}
                </option>
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
              <label htmlFor="manual_start_date" className="text-sm font-medium text-gray-700">
                Inicio de vigencia
              </label>
              <div className="relative">
                <CalendarDays
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  id="manual_start_date"
                  type="datetime-local"
                  {...register("start_date")}
                  disabled={saving}
                  className="h-11 w-full rounded-xl border border-gray-200 py-2 pl-10 pr-3 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="manual_end_date" className="text-sm font-medium text-gray-700">
                Fin de vigencia
              </label>
              <div className="relative">
                <CalendarDays
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  id="manual_end_date"
                  type="datetime-local"
                  {...register("end_date")}
                  disabled={saving}
                  className="h-11 w-full rounded-xl border border-gray-200 py-2 pl-10 pr-3 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="manual_assignment_type" className="text-sm font-medium text-gray-700">
                Tipo de asignación
              </label>
              <select
                id="manual_assignment_type"
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
              <label htmlFor="manual_status" className="text-sm font-medium text-gray-700">
                Estado inicial
              </label>
              <select
                id="manual_status"
                {...register("status")}
                disabled={saving}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="active">Activa</option>
                <option value="expired">Expirada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="manual_note" className="text-sm font-medium text-gray-700">
              Motivo de la asignación
            </label>
            <textarea
              id="manual_note"
              {...register("note")}
              disabled={saving}
              rows={3}
              placeholder="Ej. Cortesía anual autorizada por dirección"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-xs leading-5 text-gray-500">
              Este texto será visible en el historial y no podrá modificarse.
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
            disabled={saving || loadingOptions}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
            Asignar y guardar
          </button>
        </div>
      </form>
    </div>
  );
}
