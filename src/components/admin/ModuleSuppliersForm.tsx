"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { moduleService } from "@/services/moduleService";
import type {
  ModuleAdminDetail,
  SupplierSummary,
} from "@/types/module";

const messageOf = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "No se pudieron cargar los proveedores.";

function supplierLabel(supplier: SupplierSummary) {
  return (
    supplier.name ||
    supplier.short_name ||
    supplier.slug ||
    `Proveedor #${supplier.id}`
  );
}

export function ModuleSuppliersForm({
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
  const [selectedIds, setSelectedIds] = useState<
    Set<number>
  >(new Set());
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

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const [moduleDetail, supplierItems] =
          await Promise.all([
            moduleService.detail(
              moduleId,
              controller.signal,
            ),
            moduleService.suppliers(
              "",
              controller.signal,
            ),
          ]);

        if (controller.signal.aborted) return;

        setDetail(moduleDetail);
        setSuppliers(supplierItems);
        setSelectedIds(
          new Set(
            moduleDetail.allowed_supplier_ids,
          ),
        );
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(messageOf(loadError));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [moduleId, retry]);

  const filteredSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return suppliers;

    return suppliers.filter((supplier) => {
      const text = [
        supplier.name,
        supplier.short_name,
        supplier.slug,
        supplier.city,
        supplier.state,
        supplier.country,
        supplier.email,
        supplier.user_email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(query);
    });
  }, [search, suppliers]);

  const knownIds = useMemo(
    () => new Set(suppliers.map((item) => item.id)),
    [suppliers],
  );

  const unknownSelectedIds = useMemo(
    () =>
      [...selectedIds].filter(
        (id) => !knownIds.has(id),
      ),
    [knownIds, selectedIds],
  );

  function toggleSupplier(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  async function save() {
    if (
      !detail ||
      detail.availability !== "selected" ||
      saving
    ) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await moduleService.setAllowedSuppliers(
        moduleId,
        [...selectedIds].sort(
          (a, b) => a - b,
        ),
      );

      onSaved(
        "Proveedores elegibles actualizados.",
      );
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
      aria-labelledby="module-suppliers-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-xl backdrop:bg-black/40 sm:p-6"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2
            id="module-suppliers-title"
            className="font-[family-name:var(--font-varela-round)] text-xl font-bold text-[#004e28]"
          >
            Proveedores elegibles
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
          Cargando proveedores...
        </p>
      ) : error && !detail ? (
        <div className="space-y-3 rounded-xl bg-red-50 p-4">
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
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Reintentar
          </button>
        </div>
      ) : detail?.availability !== "selected" ? (
        <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          Este módulo está disponible para todos los
          proveedores. Cambia su disponibilidad a
          &quot;Proveedores seleccionados&quot; antes
          de administrar elegibles.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                placeholder="Buscar proveedor..."
                className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <span className="whitespace-nowrap rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
              {selectedIds.size} seleccionados
            </span>
          </div>

          {unknownSelectedIds.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Se conservan también los proveedores
              seleccionados que no aparecen en el
              listado actual:{" "}
              {unknownSelectedIds
                .map((id) => `#${id}`)
                .join(", ")}
              .
            </div>
          ) : null}

          <div className="max-h-[48dvh] divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
            {filteredSuppliers.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-500">
                No se encontraron proveedores.
              </p>
            ) : (
              filteredSuppliers.map((supplier) => {
                const checked = selectedIds.has(
                  supplier.id,
                );

                return (
                  <label
                    key={supplier.id}
                    className="flex cursor-pointer items-start gap-3 p-4 transition hover:bg-gray-50"
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        checked
                          ? "border-primary bg-primary text-white"
                          : "border-gray-300 bg-white"
                      }`}
                    >
                      {checked ? (
                        <Check size={14} />
                      ) : null}
                    </span>

                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() =>
                        toggleSupplier(supplier.id)
                      }
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-gray-900">
                        {supplierLabel(supplier)}
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        ID #{supplier.id}
                        {supplier.city
                          ? ` · ${supplier.city}`
                          : ""}
                        {supplier.state
                          ? `, ${supplier.state}`
                          : ""}
                        {supplier.is_active === false
                          ? " · Inactivo"
                          : ""}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>

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
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="inline-flex min-w-40 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              ) : null}
              {saving
                ? "Guardando..."
                : "Guardar elegibles"}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
