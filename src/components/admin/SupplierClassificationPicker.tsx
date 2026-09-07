"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Check, ChevronDown, Loader2, Plus, Tags, X } from "lucide-react";
import { BusinessTypePickerModal } from "@/components/admin/company/BusinessTypePickerModal";
import { fetchWithAuth } from "@/lib/api";
import { supplierCategoriesService } from "@/services/supplierCategoriesService";
import type {
  DrooopyCategory,
  SupplierCategory,
  SupplierClassification,
} from "@/types/supplierCategories";

const fieldClassName =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 transition focus:border-[#168e00] focus:outline-none focus:ring-4 focus:ring-[#168e00]/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

const emptyClassification: SupplierClassification = {
  categoryId: null,
  subcategoryId: null,
  supplierCategoryId: null,
  supplierSubcategoryId: null,
};

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function categoryOptionValue(value: SupplierClassification) {
  if (value.supplierCategoryId) {
    return `mine:${value.supplierCategoryId}`;
  }
  if (value.categoryId) {
    return `drooopy:${value.categoryId}`;
  }
  return "";
}

function parseCategoryOption(value: string): SupplierClassification {
  const [scope, parent] = value.split(":");
  const parentId = Number(parent);
  if (!Number.isFinite(parentId)) return emptyClassification;
  if (scope === "mine") {
    return {
      categoryId: null,
      subcategoryId: null,
      supplierCategoryId: parentId,
      supplierSubcategoryId: null,
    };
  }
  if (scope === "drooopy") {
    return {
      categoryId: parentId,
      subcategoryId: null,
      supplierCategoryId: null,
      supplierSubcategoryId: null,
    };
  }
  return emptyClassification;
}

async function getSupplierBusinessType(supplierId: number, signal?: AbortSignal) {
  const response = await fetchWithAuth(`/api/suppliers/${supplierId}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error(`No se pudo consultar el tipo de negocio (${response.status}).`);
  }
  const payload: unknown = await response.json();
  const root = recordOf(payload);
  const supplier = recordOf(root?.supplier) ?? recordOf(root?.data) ?? root;
  const id = Number(supplier?.business_type_id ?? recordOf(supplier?.business_type)?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function CreateCategoryModal({
  supplierId,
  categories,
  onClose,
  onCreated,
}: {
  supplierId: number;
  categories: DrooopyCategory[];
  onClose: () => void;
  onCreated: (category: SupplierCategory) => void;
}) {
  const nameInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(categories[0]?.id ?? null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedCategory = categories.find((category) => category.id === categoryId);

  useEffect(() => {
    nameInput.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, saving]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Escribe un nombre para tu categoría.");
      return;
    }
    if (!categoryId) {
      setError("Selecciona una clasificación de Drooopy.");
      return;
    }
    if (subcategoryId && !selectedCategory?.subcategories?.some((item) => item.id === subcategoryId)) {
      setError("La subcategoría relacionada no corresponde a la clasificación seleccionada.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const created = await supplierCategoriesService.create({
        supplier_id: supplierId,
        name: name.trim(),
        category_id: categoryId,
        subcategory_id: subcategoryId,
      });
      onCreated(created);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo crear la categoría.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="create-own-category-title" className="w-full max-w-lg overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id="create-own-category-title" className="font-[family-name:var(--font-varela-round)] text-xl text-[#004e28]">Crear mi categoría</h2>
            <p className="mt-1 text-sm text-gray-500">Organízala con un nombre familiar para tu negocio.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Cerrar" className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"><X size={19} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          {error ? <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p> : null}
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-gray-700">Nombre *</span>
            <input ref={nameInput} value={name} onChange={(event) => setName(event.target.value)} maxLength={120} className={fieldClassName} placeholder="Ej. Menú, Temporada o Refacciones" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-gray-700">Categoría de Drooopy *</span>
            <select value={categoryId ?? ""} onChange={(event) => { setCategoryId(event.target.value ? Number(event.target.value) : null); setSubcategoryId(null); }} className={fieldClassName}>
              <option value="">Selecciona una clasificación</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-gray-700">Subcategoría de Drooopy <span className="font-normal text-gray-400">(opcional)</span></span>
            <select value={subcategoryId ?? ""} onChange={(event) => setSubcategoryId(event.target.value ? Number(event.target.value) : null)} disabled={!categoryId} className={fieldClassName}>
              <option value="">Sin subcategoría relacionada</option>
              {(selectedCategory?.subcategories ?? []).map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
            </select>
          </label>
          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={saving || categories.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#004e28] disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}
              Crear y seleccionar
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function SupplierClassificationPicker({
  supplierId,
  value,
  onChange,
  onFeedback,
  disabled = false,
}: {
  supplierId: number | null;
  value: SupplierClassification;
  onChange: (value: SupplierClassification) => void;
  onFeedback?: (message: string) => void;
  disabled?: boolean;
}) {
  const [ownCategories, setOwnCategories] = useState<SupplierCategory[]>([]);
  const [drooopyCategories, setDrooopyCategories] = useState<DrooopyCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showBusinessType, setShowBusinessType] = useState(false);
  const [missingBusinessType, setMissingBusinessType] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const selectedCategoryValue = categoryOptionValue(value);
  const selectedOwnCategory = value.supplierCategoryId
    ? ownCategories.find((category) => category.id === value.supplierCategoryId)
    : null;
  const selectedDrooopyCategory = value.categoryId
    ? drooopyCategories.find((category) => category.id === value.categoryId)
    : null;
  const availableSubcategories = value.supplierCategoryId
    ? (selectedOwnCategory?.subcategories ?? []).filter(
        (subcategory) => subcategory.is_active !== false || subcategory.id === value.supplierSubcategoryId,
      )
    : selectedDrooopyCategory?.subcategories ?? [];

  const selectedLabel = useMemo(() => {
    if (value.supplierCategoryId) {
      const category = ownCategories.find((item) => item.id === value.supplierCategoryId);
      const subcategory = category?.subcategories.find((item) => item.id === value.supplierSubcategoryId);
      return [category?.name, subcategory?.name].filter(Boolean).join(" › ");
    }
    const category = drooopyCategories.find((item) => item.id === value.categoryId);
    const subcategory = category?.subcategories?.find((item) => item.id === value.subcategoryId);
    return [category?.name, subcategory?.name].filter(Boolean).join(" › ");
  }, [drooopyCategories, ownCategories, value]);

  useEffect(() => {
    if (!supplierId) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      setOwnCategories([]);
      setDrooopyCategories([]);
      setMissingBusinessType(false);
      const messages: string[] = [];
      const [ownResult, typeResult] = await Promise.allSettled([
        supplierCategoriesService.list(supplierId!, controller.signal),
        getSupplierBusinessType(supplierId!, controller.signal),
      ]);

      if (controller.signal.aborted) return;
      if (ownResult.status === "fulfilled") {
        setOwnCategories(ownResult.value);
      } else {
        messages.push(ownResult.reason instanceof Error ? ownResult.reason.message : "No se pudieron cargar tus categorías.");
      }

      if (typeResult.status === "rejected") {
        messages.push(typeResult.reason instanceof Error ? typeResult.reason.message : "No se pudo consultar el tipo de negocio.");
      } else if (!typeResult.value) {
        setMissingBusinessType(true);
      } else {
        try {
          const globalCategories = await supplierCategoriesService.allowedCategories(typeResult.value, controller.signal);
          setDrooopyCategories(globalCategories);
          if (globalCategories.length === 0) {
            messages.push("No hay categorías de Drooopy asignadas a tu tipo de negocio.");
          }
        } catch (requestError) {
          if (!controller.signal.aborted) {
            messages.push(requestError instanceof Error ? requestError.message : "No se pudieron cargar las categorías de Drooopy.");
          }
        }
      }

      if (!controller.signal.aborted) {
        setError(messages.join(" "));
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [refreshKey, supplierId]);

  async function categoryCreated(created: SupplierCategory) {
    if (!supplierId) return;
    try {
      setOwnCategories(await supplierCategoriesService.list(supplierId));
    } catch (requestError) {
      setOwnCategories((current) => [...current.filter((item) => item.id !== created.id), created]);
      setError(requestError instanceof Error
        ? `La categoría se creó, pero no se pudo actualizar el listado. ${requestError.message}`
        : "La categoría se creó, pero no se pudo actualizar el listado.");
    }
    onChange({
      categoryId: null,
      subcategoryId: null,
      supplierCategoryId: created.id,
      supplierSubcategoryId: null,
    });
    setShowCreate(false);
    onFeedback?.("Tu categoría se creó y quedó seleccionada.");
  }

  async function businessTypeSaved() {
    if (!supplierId) return;
    setShowBusinessType(false);
    setRefreshKey((current) => current + 1);
    onFeedback?.("El tipo de negocio se configuró. Actualizando categorías...");
  }

  function selectSubcategory(rawId: string) {
    const id = rawId ? Number(rawId) : null;
    if (value.supplierCategoryId) {
      onChange({
        categoryId: null,
        subcategoryId: null,
        supplierCategoryId: value.supplierCategoryId,
        supplierSubcategoryId: id,
      });
      return;
    }
    onChange({
      categoryId: value.categoryId,
      subcategoryId: id,
      supplierCategoryId: null,
      supplierSubcategoryId: null,
    });
  }

  return (
    <div className="space-y-2 md:col-span-2">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="supplier-classification" className="text-sm font-medium text-gray-700">Categoría *</label>
          <div className="relative">
            <Tags aria-hidden="true" size={18} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[#168e00]" />
            <select
              id="supplier-classification"
              value={selectedCategoryValue}
              onChange={(event) => onChange(parseCategoryOption(event.target.value))}
              disabled={disabled || loading || !supplierId}
              aria-describedby={error ? "supplier-classification-error" : undefined}
              className={`${fieldClassName} appearance-none pl-11 pr-10`}
            >
              <option value="">{!supplierId ? "Selecciona primero un proveedor" : loading ? "Cargando categorías..." : "Selecciona una categoría"}</option>
              {drooopyCategories.length ? (
                <optgroup label="CATEGORÍAS DE DROOOPY">
                  {drooopyCategories.map((category) => (
                    <option key={`drooopy-${category.id}`} value={`drooopy:${category.id}`}>{category.name}</option>
                  ))}
                </optgroup>
              ) : null}
              {ownCategories.some((category) => category.is_active !== false || category.id === value.supplierCategoryId) ? (
                <optgroup label="MIS CATEGORÍAS">
                  {ownCategories
                    .filter((category) => category.is_active !== false || category.id === value.supplierCategoryId)
                    .map((category) => (
                      <option key={`mine-${category.id}`} value={`mine:${category.id}`}>{category.name}</option>
                    ))}
                </optgroup>
              ) : null}
            </select>
            <ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-gray-700">Subcategoría <span className="font-normal text-gray-400">(opcional)</span></span>
          <span className="relative block">
            <select
              value={value.supplierCategoryId ? value.supplierSubcategoryId ?? "" : value.subcategoryId ?? ""}
              onChange={(event) => selectSubcategory(event.target.value)}
              disabled={disabled || loading || !selectedCategoryValue}
              className={`${fieldClassName} appearance-none pr-10`}
            >
              <option value="">Subcategoría (opcional)</option>
              {availableSubcategories.map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
          </span>
        </label>
      </div>
      {selectedLabel ? <p className="text-xs font-medium text-[#004e28]">Seleccionada: {selectedLabel}</p> : null}
      {error ? <p id="supplier-classification-error" role="alert" className="text-sm text-red-600">{error}</p> : null}
      {error && supplierId && !loading ? (
        <button type="button" onClick={() => setRefreshKey((current) => current + 1)} className="text-sm font-semibold text-[#004e28] underline decoration-[#168e00]/40 underline-offset-4 hover:text-[#168e00]">
          Volver a cargar categorías
        </button>
      ) : null}
      {missingBusinessType ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">Configura el tipo de negocio para cargar las categorías de Drooopy.</p>
          <button type="button" onClick={() => setShowBusinessType(true)} disabled={disabled || loading} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[#004e28] hover:text-[#168e00] disabled:opacity-50">
            <Tags size={16} /> Configurar tipo de negocio
          </button>
        </div>
      ) : null}
      <button type="button" onClick={() => setShowCreate(true)} disabled={disabled || loading || !supplierId || drooopyCategories.length === 0} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#168e00] transition hover:text-[#004e28] disabled:cursor-not-allowed disabled:text-gray-400">
        <Plus size={16} /> Crear mi propia categoría
      </button>

      {showCreate && supplierId ? (
        <CreateCategoryModal supplierId={supplierId} categories={drooopyCategories} onClose={() => setShowCreate(false)} onCreated={(category) => void categoryCreated(category)} />
      ) : null}
      {showBusinessType && supplierId ? (
        <BusinessTypePickerModal
          supplierId={supplierId}
          currentId={null}
          onClose={() => setShowBusinessType(false)}
          onSaved={businessTypeSaved}
        />
      ) : null}
    </div>
  );
}
