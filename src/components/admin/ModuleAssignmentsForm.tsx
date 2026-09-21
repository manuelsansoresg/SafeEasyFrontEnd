"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Edit2,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { moduleService } from "@/services/moduleService";
import type {
  ModuleAdminDetail,
  ModuleBillingPeriod,
  SupplierModuleAssignment,
  SupplierModuleStatus,
  SupplierSummary,
} from "@/types/module";

const inputClass =
  "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const selectClass =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-4 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const messageOf = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "No se pudo completar la operación.";

type AssignmentFormState = {
  supplierId: string;
  status: SupplierModuleStatus;
  isEnabled: boolean;
  startsAt: string;
  expiresAt: string;
  pricePaid: string;
  billingPeriod: ModuleBillingPeriod | "";
};

const emptyForm: AssignmentFormState = {
  supplierId: "",
  status: "active",
  isEnabled: false,
  startsAt: "",
  expiresAt: "",
  pricePaid: "",
  billingPeriod: "",
};

function supplierLabel(
  supplier: SupplierSummary | undefined,
  supplierId: number,
) {
  if (!supplier) return `Proveedor #${supplierId}`;

  return (
    supplier.name ||
    supplier.short_name ||
    supplier.slug ||
    `Proveedor #${supplierId}`
  );
}

function toDateTimeLocal(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (part: number) =>
    String(part).padStart(2, "0");

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1,
  )}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function toIsoOrNull(value: string) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function statusLabel(status: SupplierModuleStatus) {
  switch (status) {
    case "active":
      return "Activo";
    case "pending":
      return "Pendiente";
    case "expired":
      return "Vencido";
    case "cancelled":
      return "Cancelado";
    default:
      return status;
  }
}

function statusClass(status: SupplierModuleStatus) {
  switch (status) {
    case "active":
      return "border-green-100 bg-green-50 text-green-700";
    case "pending":
      return "border-amber-100 bg-amber-50 text-amber-700";
    case "expired":
      return "border-gray-200 bg-gray-50 text-gray-600";
    case "cancelled":
      return "border-red-100 bg-red-50 text-red-700";
  }
}

function periodLabel(
  period: ModuleBillingPeriod | null,
) {
  if (period === "monthly") return "Mensual";
  if (period === "yearly") return "Anual";
  if (period === "one_time") return "Pago único";
  return "Sin periodo";
}

export function ModuleAssignmentsForm({
  moduleId,
  moduleName,
  onClose,
  onSaved,
}: {
  moduleId: number;
  moduleName: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] =
    useState<ModuleAdminDetail | null>(null);
  const [suppliers, setSuppliers] = useState<
    SupplierSummary[]
  >([]);
  const [assignments, setAssignments] = useState<
    SupplierModuleAssignment[]
  >([]);
  const [form, setForm] =
    useState<AssignmentFormState>(emptyForm);
  const [editingId, setEditingId] = useState<
    number | null
  >(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  async function load(
    signal?: AbortSignal,
    keepForm = false,
  ) {
    setLoading(true);
    setError("");

    try {
      const [
        moduleDetail,
        assignmentItems,
        supplierItems,
      ] = await Promise.all([
        moduleService.detail(moduleId, signal),
        moduleService.listAssignments(
          moduleId,
          signal,
        ),
        moduleService.suppliers("", signal),
      ]);

      if (signal?.aborted) return;

      setDetail(moduleDetail);
      setAssignments(assignmentItems);
      setSuppliers(supplierItems);

      if (!keepForm && editingId === null) {
        setForm((current) => ({
          ...current,
          pricePaid:
            moduleDetail.price === null
              ? ""
              : String(moduleDetail.price),
          billingPeriod:
            moduleDetail.billing_period ?? "",
        }));
      }
    } catch (loadError) {
      if (!signal?.aborted) {
        setError(messageOf(loadError));
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleId, retry]);

  const supplierById = useMemo(
    () =>
      new Map(
        suppliers.map((supplier) => [
          supplier.id,
          supplier,
        ]),
      ),
    [suppliers],
  );

  const assignedSupplierIds = useMemo(
    () =>
      new Set(
        assignments.map(
          (assignment) =>
            assignment.supplier_id,
        ),
      ),
    [assignments],
  );

  const availableSuppliers = useMemo(() => {
    if (editingId !== null) return suppliers;

    return suppliers.filter(
      (supplier) =>
        !assignedSupplierIds.has(supplier.id),
    );
  }, [
    assignedSupplierIds,
    editingId,
    suppliers,
  ]);

  const supplierOptions = useMemo(
    () =>
      availableSuppliers.map((supplier) => ({
        id: supplier.id,
        name: supplierLabel(supplier, supplier.id),
      })),
    [availableSuppliers],
  );

  const selectedSupplier = useMemo(() => {
    const supplierId = Number(form.supplierId);
    if (!Number.isInteger(supplierId)) return null;

    return (
      supplierOptions.find(
        (option) => option.id === supplierId,
      ) ?? null
    );
  }, [form.supplierId, supplierOptions]);

  const filteredAssignments = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return assignments;

    return assignments.filter((assignment) => {
      const supplier = supplierById.get(
        assignment.supplier_id,
      );

      return [
        supplierLabel(
          supplier,
          assignment.supplier_id,
        ),
        assignment.supplier_id,
        statusLabel(assignment.effective_status),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [assignments, search, supplierById]);

  function resetForm() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      pricePaid:
        detail?.price === null ||
        detail?.price === undefined
          ? ""
          : String(detail.price),
      billingPeriod:
        detail?.billing_period ?? "",
    });
    setError("");
  }

  function editAssignment(
    assignment: SupplierModuleAssignment,
  ) {
    setEditingId(assignment.id);
    setForm({
      supplierId: String(
        assignment.supplier_id,
      ),
      status: assignment.status,
      isEnabled: assignment.is_enabled,
      startsAt: toDateTimeLocal(
        assignment.starts_at,
      ),
      expiresAt: toDateTimeLocal(
        assignment.expires_at,
      ),
      pricePaid:
        assignment.price_paid === null
          ? ""
          : String(assignment.price_paid),
      billingPeriod:
        assignment.billing_period ?? "",
    });
    setError("");
  }

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (saving) return;

    const supplierId = Number(form.supplierId);

    if (
      !Number.isInteger(supplierId) ||
      supplierId <= 0
    ) {
      setError("Selecciona un proveedor.");
      return;
    }

    let pricePaid: number | null = null;

    if (form.pricePaid.trim()) {
      pricePaid = Number(form.pricePaid);

      if (
        !Number.isFinite(pricePaid) ||
        pricePaid < 0
      ) {
        setError(
          "El precio pagado debe ser 0 o mayor.",
        );
        return;
      }
    }

    const startsAt = toIsoOrNull(
      form.startsAt,
    );
    const expiresAt = toIsoOrNull(
      form.expiresAt,
    );

    if (
      startsAt &&
      expiresAt &&
      new Date(expiresAt).getTime() <=
        new Date(startsAt).getTime()
    ) {
      setError(
        "La fecha de vencimiento debe ser posterior a la fecha de inicio.",
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      await moduleService.grantSupplier(
        moduleId,
        supplierId,
        {
          status: form.status,
          is_enabled:
            form.status === "active"
              ? form.isEnabled
              : false,
          starts_at: startsAt,
          expires_at: expiresAt,
          price_paid: pricePaid,
          billing_period:
            form.billingPeriod || null,
        },
      );

      onSaved(
        editingId === null
          ? "Módulo asignado al proveedor."
          : "Asignación actualizada.",
      );

      const controller =
        new AbortController();

      const [
        moduleDetail,
        assignmentItems,
      ] = await Promise.all([
        moduleService.detail(
          moduleId,
          controller.signal,
        ),
        moduleService.listAssignments(
          moduleId,
          controller.signal,
        ),
      ]);

      setDetail(moduleDetail);
      setAssignments(assignmentItems);
      setEditingId(null);
      setForm({
        ...emptyForm,
        pricePaid:
          moduleDetail.price === null
            ? ""
            : String(moduleDetail.price),
        billingPeriod:
          moduleDetail.billing_period ?? "",
      });
    } catch (saveError) {
      setError(messageOf(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="module-assignments-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-xl backdrop:bg-black/40 sm:p-6"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2
            id="module-assignments-title"
            className="font-[family-name:var(--font-varela-round)] text-xl font-bold text-[#004e28]"
          >
            Asignaciones del módulo
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {moduleName}
          </p>
        </div>

        <button
          type="button"
          aria-label="Cerrar"
          disabled={saving}
          onClick={onClose}
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
          Cargando asignaciones...
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Buscar asignación..."
                  className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
              >
                <Plus size={17} />
                Nueva asignación
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200">
              {filteredAssignments.length ===
              0 ? (
                <p className="p-8 text-center text-sm text-gray-500">
                  No hay asignaciones para este
                  módulo.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredAssignments.map(
                    (assignment) => {
                      const supplier =
                        supplierById.get(
                          assignment.supplier_id,
                        );

                      return (
                        <article
                          key={assignment.id}
                          className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900">
                              {supplierLabel(
                                supplier,
                                assignment.supplier_id,
                              )}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                              <span>
                                ID proveedor #
                                {
                                  assignment.supplier_id
                                }
                              </span>
                              <span>·</span>
                              <span>
                                {periodLabel(
                                  assignment.billing_period,
                                )}
                              </span>
                              {assignment.price_paid !==
                              null ? (
                                <>
                                  <span>·</span>
                                  <span>
                                    {new Intl.NumberFormat(
                                      "es-MX",
                                      {
                                        style:
                                          "currency",
                                        currency:
                                          "MXN",
                                      },
                                    ).format(
                                      Number(
                                        assignment.price_paid,
                                      ),
                                    )}
                                  </span>
                                </>
                              ) : null}
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(
                                  assignment.effective_status,
                                )}`}
                              >
                                {statusLabel(
                                  assignment.effective_status,
                                )}
                              </span>

                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                                  assignment.is_enabled
                                    ? "border-green-100 bg-green-50 text-green-700"
                                    : "border-gray-200 bg-gray-50 text-gray-600"
                                }`}
                              >
                                {assignment.is_enabled
                                  ? "Activado por proveedor"
                                  : "No activado"}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              editAssignment(
                                assignment,
                              )
                            }
                            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5 disabled:opacity-50"
                          >
                            <Edit2 size={16} />
                            Editar
                          </button>
                        </article>
                      );
                    },
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
            <h3 className="font-semibold text-[#004e28]">
              {editingId === null
                ? "Asignar proveedor"
                : "Editar asignación"}
            </h3>

            <form
              onSubmit={submit}
              className="mt-4 space-y-4"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="assignment-supplier"
                  className="text-sm font-semibold text-gray-700"
                >
                  Proveedor *
                </label>
                <SearchableSelect
                  id="assignment-supplier"
                  disabled={
                    saving || editingId !== null
                  }
                  value={selectedSupplier}
                  options={supplierOptions}
                  onChange={(option) =>
                    setForm((current) => ({
                      ...current,
                      supplierId:
                        option === null
                          ? ""
                          : String(option.id),
                    }))
                  }
                  placeholder="Selecciona un proveedor"
                  searchPlaceholder="Buscar proveedor..."
                  emptyLabel="No se encontraron proveedores"
                  className={`${selectClass} disabled:bg-gray-100`}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="assignment-status"
                  className="text-sm font-semibold text-gray-700"
                >
                  Estado *
                </label>
                <select
                  id="assignment-status"
                  value={form.status}
                  onChange={(event) => {
                    const status =
                      event.target
                        .value as SupplierModuleStatus;

                    setForm((current) => ({
                      ...current,
                      status,
                      isEnabled:
                        status === "active"
                          ? current.isEnabled
                          : false,
                    }));
                  }}
                  className={selectClass}
                >
                  <option value="active">
                    Activo
                  </option>
                  <option value="pending">
                    Pendiente
                  </option>
                  <option value="expired">
                    Vencido
                  </option>
                  <option value="cancelled">
                    Cancelado
                  </option>
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="assignment-start"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Inicio
                  </label>
                  <input
                    id="assignment-start"
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        startsAt:
                          event.target.value,
                      }))
                    }
                    className={`${inputClass} bg-white`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="assignment-expire"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Vencimiento
                  </label>
                  <input
                    id="assignment-expire"
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        expiresAt:
                          event.target.value,
                      }))
                    }
                    className={`${inputClass} bg-white`}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="assignment-price"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Precio pagado
                  </label>
                  <input
                    id="assignment-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.pricePaid}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        pricePaid:
                          event.target.value,
                      }))
                    }
                    className={`${inputClass} bg-white`}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="assignment-period"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Periodo
                  </label>
                  <select
                    id="assignment-period"
                    value={form.billingPeriod}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        billingPeriod:
                          event.target
                            .value as ModuleBillingPeriod | "",
                      }))
                    }
                    className={selectClass}
                  >
                    <option value="">
                      Sin periodo
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

              <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
                <input
                  type="checkbox"
                  checked={form.isEnabled}
                  disabled={
                    form.status !== "active"
                  }
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isEnabled:
                        event.target.checked,
                    }))
                  }
                  className="h-4 w-4 accent-[#168e00]"
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-700">
                    Activarlo ahora
                  </span>
                  <span className="block text-xs text-gray-500">
                    Si queda desmarcado, el
                    proveedor conserva el derecho
                    pero todavía no lo tendrá
                    habilitado.
                  </span>
                </span>
              </label>

              {error ? (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2 pt-2">
                {editingId !== null ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={resetForm}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancelar edición
                  </button>
                ) : null}

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex min-w-36 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/20 hover:bg-primary/90 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                    />
                  ) : null}
                  {saving
                    ? "Guardando..."
                    : editingId === null
                      ? "Asignar"
                      : "Actualizar"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {!loading && error && detail === null ? (
        <div className="mt-4 rounded-xl bg-red-50 p-4">
          <p
            role="alert"
            className="text-sm text-red-700"
          >
            {error}
          </p>
          <button
            type="button"
            onClick={() =>
              setRetry((value) => value + 1)
            }
            className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Reintentar
          </button>
        </div>
      ) : null}
    </dialog>
  );
}
