"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { moduleService } from "@/services/moduleService";
import { subscriptionsService } from "@/services/subscriptionsService";
import type {
  ModuleBillingPeriod,
  ModuleCreatePayload,
  ModuleUpdatePayload,
} from "@/types/module";
import type { Plan } from "@/types/subscriptions";

const inputClass =
  "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const selectClass =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-4 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const messageOf = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "No se pudo guardar el módulo. Inténtalo de nuevo.";

type FormState = {
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  hasPrice: boolean;
  price: string;
  billingPeriod: ModuleBillingPeriod | "";
  displayOrder: string;
  planIds: number[];
};

const initialState: FormState = {
  code: "",
  name: "",
  description: "",
  isActive: true,
  hasPrice: false,
  price: "",
  billingPeriod: "",
  displayOrder: "0",
  planIds: [],
};

function normalizeCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function planLabel(plan: Plan) {
  const suffix = plan.is_active === false ? " · Inactivo" : "";
  return `${plan.title}${suffix}`;
}

export function ModuleForm({
  id,
  onClose,
  onSaved,
}: {
  id: number | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<FormState>(initialState);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planSearch, setPlanSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setLoadError("");

      try {
        const [planItems, detail] = await Promise.all([
          subscriptionsService.listPlans(),
          id === null
            ? Promise.resolve(null)
            : moduleService.detail(id, controller.signal),
        ]);

        if (controller.signal.aborted) return;

        setPlans(
          [...planItems].sort((a, b) =>
            a.title.localeCompare(b.title, "es"),
          ),
        );

        if (!detail) {
          setForm(initialState);
          return;
        }

        setForm({
          code: detail.code,
          name: detail.name,
          description: detail.description ?? "",
          isActive: detail.is_active,
          hasPrice: detail.has_price,
          price: detail.price === null ? "" : String(detail.price),
          billingPeriod: detail.billing_period ?? "",
          displayOrder: String(detail.display_order),
          planIds: detail.plan_ids ?? [],
        });
      } catch (loadErrorValue) {
        if (!controller.signal.aborted) {
          setLoadError(messageOf(loadErrorValue));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [id, retry]);

  const filteredPlans = useMemo(() => {
    const query = planSearch.trim().toLowerCase();
    if (!query) return plans;
    return plans.filter((plan) =>
      [plan.title, plan.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [planSearch, plans]);

  function close() {
    if (saving) return;
    onClose();
  }

  function update<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleNameChange(value: string) {
    setForm((current) => ({
      ...current,
      name: value,
      code:
        id === null && !current.code.trim()
          ? normalizeCode(value)
          : current.code,
    }));
  }

  function togglePlan(planId: number) {
    setForm((current) => ({
      ...current,
      planIds: current.planIds.includes(planId)
        ? current.planIds.filter((idValue) => idValue !== planId)
        : [...current.planIds, planId].sort((a, b) => a - b),
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setError("");

    const name = form.name.trim();
    const code = normalizeCode(form.code);

    if (name.length < 2) {
      setError("El nombre debe tener al menos 2 caracteres.");
      return;
    }

    if (
      id === null &&
      !/^[a-z][a-z0-9_]{1,49}$/.test(code)
    ) {
      setError(
        "El código debe iniciar con una letra, usar solo minúsculas, números o guion bajo y tener al menos 2 caracteres.",
      );
      return;
    }

    if (form.planIds.length === 0) {
      setError("Selecciona al menos un plan para este módulo.");
      return;
    }

    const displayOrder = Number(form.displayOrder);
    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      setError("El orden debe ser un número entero mayor o igual a 0.");
      return;
    }

    let price: number | null = null;
    let billingPeriod: ModuleBillingPeriod | null = null;

    if (form.hasPrice) {
      price = Number(form.price);

      if (!Number.isFinite(price) || price <= 0) {
        setError("Captura un precio mayor a 0 para el módulo.");
        return;
      }

      if (!form.billingPeriod) {
        setError("Selecciona el periodo de cobro del módulo.");
        return;
      }

      billingPeriod = form.billingPeriod;
    }

    const common: ModuleUpdatePayload = {
      name,
      description: form.description.trim() || null,
      is_active: form.isActive,
      has_price: form.hasPrice,
      price,
      billing_period: billingPeriod,
      // El backend lo conserva, pero la elegibilidad real se resuelve
      // mediante plan_ids + proveedores adicionales.
      availability: "selected",
      display_order: displayOrder,
      plan_ids: form.planIds,
    };

    setSaving(true);

    try {
      if (id === null) {
        const payload: ModuleCreatePayload = {
          code,
          name,
          description: form.description.trim() || null,
          is_active: form.isActive,
          has_price: form.hasPrice,
          price,
          billing_period: billingPeriod,
          availability: "selected",
          display_order: displayOrder,
          plan_ids: form.planIds,
        };

        await moduleService.create(payload);
        onSaved("Módulo creado correctamente.");
      } else {
        await moduleService.update(id, common);
        onSaved("Módulo actualizado correctamente.");
      }

      onClose();
    } catch (saveError) {
      setError(messageOf(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="module-form-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-xl backdrop:bg-black/40 sm:p-6"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2
            id="module-form-title"
            className="font-[family-name:var(--font-varela-round)] text-xl font-bold text-[#004e28]"
          >
            {id === null ? "Nuevo módulo" : "Editar módulo"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Elige los planes que lo incluyen y define si es gratis o de pago.
          </p>
        </div>

        <button
          type="button"
          aria-label="Cerrar"
          disabled={saving}
          onClick={close}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
        >
          <X size={20} />
        </button>
      </div>

      {loading ? (
        <p
          role="status"
          className="flex items-center justify-center gap-2 py-10 text-gray-500"
        >
          <Loader2 size={20} className="animate-spin" />
          Cargando módulo...
        </p>
      ) : loadError ? (
        <div role="alert" className="space-y-3 rounded-xl bg-red-50 p-4">
          <p className="text-sm text-red-700">{loadError}</p>
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <fieldset disabled={saving} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="module-name" className="text-sm font-semibold text-gray-700">
                  Nombre *
                </label>
                <input
                  id="module-name"
                  required
                  autoFocus={id === null}
                  value={form.name}
                  onChange={(event) => handleNameChange(event.target.value)}
                  className={inputClass}
                  placeholder="Menú"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="module-code" className="text-sm font-semibold text-gray-700">
                  Código *
                </label>
                <input
                  id="module-code"
                  required
                  disabled={id !== null}
                  value={form.code}
                  onChange={(event) => update("code", normalizeCode(event.target.value))}
                  className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-500`}
                  placeholder="menu"
                />
                {id !== null ? (
                  <p className="text-xs text-gray-500">
                    El código identifica al módulo en el backend y no se modifica.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="module-description" className="text-sm font-semibold text-gray-700">
                Descripción
              </label>
              <textarea
                id="module-description"
                rows={3}
                maxLength={2000}
                value={form.description}
                onChange={(event) => update("description", event.target.value)}
                className={inputClass}
                placeholder="Describe brevemente para qué sirve este módulo."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="module-order" className="text-sm font-semibold text-gray-700">
                  Orden *
                </label>
                <input
                  id="module-order"
                  type="number"
                  min={0}
                  step={1}
                  required
                  value={form.displayOrder}
                  onChange={(event) => update("displayOrder", event.target.value)}
                  className={inputClass}
                />
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 sm:self-end">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => update("isActive", event.target.checked)}
                  className="h-4 w-4 accent-[#168e00]"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-700">Módulo activo</span>
                  <span className="block text-xs text-gray-500">Disponible globalmente.</span>
                </span>
              </label>
            </div>

            <section className="rounded-2xl border border-[#004e28]/10 bg-[#f8faf8] p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-black text-[#004e28]">Planes que incluyen este módulo *</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Todo módulo debe pertenecer por lo menos a un plan. Los proveedores adicionales se configuran después desde la lista de módulos.
                  </p>
                </div>
                <span className="rounded-full bg-[#168e00]/10 px-3 py-1.5 text-xs font-bold text-[#0b6d00]">
                  {form.planIds.length} seleccionados
                </span>
              </div>

              <label className="relative mt-4 block">
                <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  value={planSearch}
                  onChange={(event) => setPlanSearch(event.target.value)}
                  placeholder="Buscar plan..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10"
                />
              </label>

              <div className="mt-3 max-h-56 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                {filteredPlans.length === 0 ? (
                  <p className="p-5 text-center text-sm text-gray-500">No se encontraron planes.</p>
                ) : (
                  filteredPlans.map((plan) => {
                    const checked = form.planIds.includes(plan.id);
                    return (
                      <label key={plan.id} className="flex cursor-pointer items-start gap-3 p-3.5 hover:bg-gray-50">
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                            checked ? "border-[#168e00] bg-[#168e00] text-white" : "border-gray-300"
                          }`}
                        >
                          {checked ? <Check size={14} /> : null}
                        </span>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => togglePlan(plan.id)}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-gray-900">{planLabel(plan)}</span>
                          {plan.description ? (
                            <span className="mt-0.5 block line-clamp-2 text-xs text-gray-500">{plan.description}</span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </section>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <label className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={form.hasPrice}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setForm((current) => ({
                      ...current,
                      hasPrice: checked,
                      price: checked ? current.price : "",
                      billingPeriod: checked ? current.billingPeriod : "",
                    }));
                  }}
                  className="h-4 w-4 accent-[#168e00]"
                />
                Este módulo tiene costo adicional
              </label>

              {form.hasPrice ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="module-price" className="text-sm font-semibold text-gray-700">
                      Precio *
                    </label>
                    <input
                      id="module-price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={form.price}
                      onChange={(event) => update("price", event.target.value)}
                      className={inputClass}
                      placeholder="199.00"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="module-period" className="text-sm font-semibold text-gray-700">
                      Periodo *
                    </label>
                    <select
                      id="module-period"
                      required
                      value={form.billingPeriod}
                      onChange={(event) => update("billingPeriod", event.target.value as ModuleBillingPeriod)}
                      className={selectClass}
                    >
                      <option value="">Selecciona...</option>
                      <option value="monthly">Mensual</option>
                      <option value="yearly">Anual</option>
                      <option value="one_time">Pago único</option>
                    </select>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">
                  Los proveedores elegibles podrán activarlo sin realizar un pago.
                </p>
              )}
            </div>
          </fieldset>

          {error ? (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={close}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-w-40 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saving ? "Guardando..." : id === null ? "Crear módulo" : "Guardar cambios"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
