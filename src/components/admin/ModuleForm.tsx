"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Loader2, X } from "lucide-react";
import { moduleService } from "@/services/moduleService";
import type {
  ModuleAvailability,
  ModuleBillingPeriod,
  ModuleCreatePayload,
  ModuleUpdatePayload,
} from "@/types/module";

const inputClass =
  "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

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
  availability: ModuleAvailability;
  displayOrder: string;
};

const initialState: FormState = {
  code: "",
  name: "",
  description: "",
  isActive: true,
  hasPrice: false,
  price: "",
  billingPeriod: "",
  availability: "all",
  displayOrder: "0",
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
  const [loading, setLoading] = useState(id !== null);
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
    if (id === null) {
      setForm(initialState);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setLoadError("");

      try {
        const record = await moduleService.detail(
          id as number,
          controller.signal,
        );

        if (controller.signal.aborted) return;

        setForm({
          code: record.code,
          name: record.name,
          description: record.description ?? "",
          isActive: record.is_active,
          hasPrice: record.has_price,
          price:
            record.price === null
              ? ""
              : String(record.price),
          billingPeriod: record.billing_period ?? "",
          availability: record.availability,
          displayOrder: String(record.display_order),
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

    const displayOrder = Number(form.displayOrder);
    if (
      !Number.isInteger(displayOrder) ||
      displayOrder < 0
    ) {
      setError(
        "El orden debe ser un número entero mayor o igual a 0.",
      );
      return;
    }

    let price: number | null = null;
    let billingPeriod: ModuleBillingPeriod | null = null;

    if (form.hasPrice) {
      price = Number(form.price);

      if (!Number.isFinite(price) || price <= 0) {
        setError(
          "Captura un precio mayor a 0 para el módulo.",
        );
        return;
      }

      if (!form.billingPeriod) {
        setError(
          "Selecciona el periodo de cobro del módulo.",
        );
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
      availability: form.availability,
      display_order: displayOrder,
    };

    setSaving(true);

    try {
      if (id === null) {
        const payload: ModuleCreatePayload = {
          code,
          ...common,
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
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-xl backdrop:bg-black/40 sm:p-6"
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2
            id="module-form-title"
            className="font-[family-name:var(--font-varela-round)] text-xl font-bold text-[#004e28]"
          >
            {id === null
              ? "Nuevo módulo"
              : "Editar módulo"}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Configura disponibilidad, precio y estado.
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
          <Loader2
            size={20}
            className="animate-spin"
          />
          Cargando módulo...
        </p>
      ) : loadError ? (
        <div
          role="alert"
          className="space-y-3 rounded-xl bg-red-50 p-4"
        >
          <p className="text-sm text-red-700">
            {loadError}
          </p>
          <button
            type="button"
            onClick={() =>
              setRetry((value) => value + 1)
            }
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <form
          onSubmit={submit}
          className="space-y-5"
        >
          <fieldset
            disabled={saving}
            className="space-y-5"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="module-name"
                  className="text-sm font-semibold text-gray-700"
                >
                  Nombre *
                </label>
                <input
                  id="module-name"
                  required
                  autoFocus={id === null}
                  value={form.name}
                  onChange={(event) =>
                    handleNameChange(
                      event.target.value,
                    )
                  }
                  className={inputClass}
                  placeholder="Menú"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="module-code"
                  className="text-sm font-semibold text-gray-700"
                >
                  Código *
                </label>
                <input
                  id="module-code"
                  required
                  disabled={id !== null}
                  value={form.code}
                  onChange={(event) =>
                    update(
                      "code",
                      normalizeCode(
                        event.target.value,
                      ),
                    )
                  }
                  className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-500`}
                  placeholder="menu"
                />
                {id !== null ? (
                  <p className="text-xs text-gray-500">
                    El código no se puede modificar
                    porque identifica al módulo en el
                    backend.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="module-description"
                className="text-sm font-semibold text-gray-700"
              >
                Descripción
              </label>
              <textarea
                id="module-description"
                rows={3}
                maxLength={2000}
                value={form.description}
                onChange={(event) =>
                  update(
                    "description",
                    event.target.value,
                  )
                }
                className={inputClass}
                placeholder="Describe brevemente para qué sirve este módulo."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="module-order"
                  className="text-sm font-semibold text-gray-700"
                >
                  Orden *
                </label>
                <input
                  id="module-order"
                  type="number"
                  min={0}
                  step={1}
                  required
                  value={form.displayOrder}
                  onChange={(event) =>
                    update(
                      "displayOrder",
                      event.target.value,
                    )
                  }
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="module-availability"
                  className="text-sm font-semibold text-gray-700"
                >
                  Disponible para *
                </label>
                <select
                  id="module-availability"
                  value={form.availability}
                  onChange={(event) =>
                    update(
                      "availability",
                      event.target
                        .value as ModuleAvailability,
                    )
                  }
                  className={inputClass}
                >
                  <option value="all">
                    Todos los proveedores
                  </option>
                  <option value="selected">
                    Proveedores seleccionados
                  </option>
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <label className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={form.hasPrice}
                  onChange={(event) => {
                    const checked =
                      event.target.checked;

                    setForm((current) => ({
                      ...current,
                      hasPrice: checked,
                      price: checked
                        ? current.price
                        : "",
                      billingPeriod: checked
                        ? current.billingPeriod
                        : "",
                    }));
                  }}
                  className="h-4 w-4 accent-[#168e00]"
                />
                Este módulo tiene costo
              </label>

              {form.hasPrice ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="module-price"
                      className="text-sm font-semibold text-gray-700"
                    >
                      Precio *
                    </label>
                    <input
                      id="module-price"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={form.price}
                      onChange={(event) =>
                        update(
                          "price",
                          event.target.value,
                        )
                      }
                      className={inputClass}
                      placeholder="599.00"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="module-period"
                      className="text-sm font-semibold text-gray-700"
                    >
                      Periodo *
                    </label>
                    <select
                      id="module-period"
                      required
                      value={form.billingPeriod}
                      onChange={(event) =>
                        update(
                          "billingPeriod",
                          event.target
                            .value as ModuleBillingPeriod,
                        )
                      }
                      className={inputClass}
                    >
                      <option value="">
                        Selecciona...
                      </option>
                      <option value="monthly">
                        Mensual
                      </option>
                      <option value="yearly">
                        Anual
                      </option>
                      <option value="one_time">
                        Pago único
                      </option>
                    </select>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">
                  Los proveedores elegibles podrán
                  activar el módulo sin pago.
                </p>
              )}
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-gray-200 p-4">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  update(
                    "isActive",
                    event.target.checked,
                  )
                }
                className="h-4 w-4 accent-[#168e00]"
              />
              <span>
                <span className="block text-sm font-semibold text-gray-700">
                  Módulo activo
                </span>
                <span className="block text-xs text-gray-500">
                  Si se desactiva, deja de operar
                  globalmente.
                </span>
              </span>
            </label>
          </fieldset>

          {form.availability === "selected" ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              Después de guardar, usa la acción
              &quot;Elegibles&quot; para seleccionar
              qué proveedores pueden ver este módulo.
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
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
              {saving ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              ) : null}
              {saving
                ? "Guardando..."
                : id === null
                  ? "Crear módulo"
                  : "Guardar cambios"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
