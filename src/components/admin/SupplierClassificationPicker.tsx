"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Check, ChevronDown, Loader2, Plus, Tags, X } from "lucide-react";
import { supplierCategoriesService } from "@/services/supplierCategoriesService";
import type {
  DrooopyCategory,
  DrooopySubcategory,
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

function categoryOptionValue(value: SupplierClassification) {
  if (value.supplierCategoryId) return `mine:${value.supplierCategoryId}`;
  if (value.categoryId) return `drooopy:${value.categoryId}`;
  return "";
}

function parseCategoryOption(value: string): SupplierClassification {
  const [scope, rawId] = value.split(":");
  const id = Number(rawId);
  if (!Number.isFinite(id) || id <= 0) return emptyClassification;
  if (scope === "mine") {
    return { categoryId: null, subcategoryId: null, supplierCategoryId: id, supplierSubcategoryId: null };
  }
  if (scope === "drooopy") {
    return { categoryId: id, subcategoryId: null, supplierCategoryId: null, supplierSubcategoryId: null };
  }
  return emptyClassification;
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
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [subcategories, setSubcategories] = useState<DrooopySubcategory[]>([]);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    nameInput.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    setSubcategories([]);
    setSubcategoryId(null);
    if (!categoryId) return;
    const controller = new AbortController();
    setLoadingSubcategories(true);
    supplierCategoriesService.listGlobalSubcategories(categoryId, controller.signal)
      .then(setSubcategories)
      .catch(() => {
        if (!controller.signal.aborted) setError("No se pudieron cargar las subcategorías.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSubcategories(false);
      });
    return () => controller.abort();
  }, [categoryId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Escribe un nombre para tu categoría.");
    if (!categoryId) return setError("Selecciona una categoría de Drooopy.");
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
            <p className="mt-1 text-sm text-gray-500">Crea un nombre propio y relaciónalo con Drooopy.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Cerrar" className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"><X size={19} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          {error ? <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p> : null}
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-gray-700">Nombre *</span>
            <input ref={nameInput} value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className={fieldClassName} placeholder="Ej. Hamburguesas" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-gray-700">Categoría de Drooopy *</span>
            <select value={categoryId ?? ""} onChange={(event) => { setError(""); setCategoryId(event.target.value ? Number(event.target.value) : null); }} className={fieldClassName}>
              <option value="">Selecciona una categoría</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-gray-700">Subcategoría de Drooopy <span className="font-normal text-gray-400">(opcional)</span></span>
            <select value={subcategoryId ?? ""} onChange={(event) => setSubcategoryId(event.target.value ? Number(event.target.value) : null)} disabled={!categoryId || loadingSubcategories} className={fieldClassName}>
              <option value="">{loadingSubcategories ? "Cargando subcategorías..." : "Sin subcategoría relacionada"}</option>
              {subcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
            </select>
          </label>
          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={saving || loadingSubcategories} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#004e28] disabled:cursor-not-allowed disabled:opacity-50">
              {saving ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />} Crear y seleccionar
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
  const [globalCategories, setGlobalCategories] = useState<DrooopyCategory[]>([]);
  const [globalSubcategories, setGlobalSubcategories] = useState<DrooopySubcategory[]>([]);
  const [loadedCatalogKey, setLoadedCatalogKey] = useState("");
  const [loadedGlobalCategoryId, setLoadedGlobalCategoryId] = useState<number | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const catalogKey = `${supplierId ?? "none"}:${refreshKey}`;
  const loadingCategories = loadedCatalogKey !== catalogKey;
  const loadingSubcategories = Boolean(
    value.categoryId
    && !value.supplierCategoryId
    && loadedGlobalCategoryId !== value.categoryId,
  );

  const selectedCategoryValue = categoryOptionValue(value);
  const selectedOwnCategory = value.supplierCategoryId
    ? ownCategories.find((category) => category.id === value.supplierCategoryId)
    : null;
  const availableSubcategories = value.supplierCategoryId
    ? (selectedOwnCategory?.subcategories ?? []).filter(
        (subcategory) => subcategory.is_active !== false || subcategory.id === value.supplierSubcategoryId,
      )
    : globalSubcategories;

  const selectedLabel = useMemo(() => {
    if (value.supplierCategoryId) {
      const category = ownCategories.find((item) => item.id === value.supplierCategoryId);
      const subcategory = category?.subcategories.find((item) => item.id === value.supplierSubcategoryId);
      return [category?.name, subcategory?.name].filter(Boolean).join(" › ");
    }
    const category = globalCategories.find((item) => item.id === value.categoryId);
    const subcategory = globalSubcategories.find((item) => item.id === value.subcategoryId);
    return [category?.name, subcategory?.name].filter(Boolean).join(" › ");
  }, [globalCategories, globalSubcategories, ownCategories, value]);

  useEffect(() => {
    const controller = new AbortController();
    const ownRequest = supplierId
      ? supplierCategoriesService.list(supplierId, controller.signal)
      : Promise.resolve([] as SupplierCategory[]);
    Promise.allSettled([
      supplierCategoriesService.listGlobalCategories(controller.signal),
      ownRequest,
    ]).then(([globalResult, ownResult]) => {
      if (controller.signal.aborted) return;
      const nextErrors: string[] = [];
      if (globalResult.status === "fulfilled") setGlobalCategories(globalResult.value);
      else {
        setGlobalCategories([]);
        nextErrors.push("No se pudieron cargar las categorías de Drooopy.");
      }
      if (ownResult.status === "fulfilled") setOwnCategories(ownResult.value);
      else {
        setOwnCategories([]);
        nextErrors.push("No se pudieron cargar tus categorías.");
      }
      setErrors(nextErrors);
      setLoadedCatalogKey(catalogKey);
    });
    return () => controller.abort();
  }, [catalogKey, supplierId]);

  useEffect(() => {
    if (!value.categoryId || value.supplierCategoryId) return;
    const controller = new AbortController();
    supplierCategoriesService.listGlobalSubcategories(value.categoryId, controller.signal)
      .then((items) => {
        setGlobalSubcategories(items);
        setLoadedGlobalCategoryId(value.categoryId);
        setErrors((current) => current.filter((message) => message !== "No se pudieron cargar las subcategorías."));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setGlobalSubcategories([]);
          setLoadedGlobalCategoryId(value.categoryId);
          setErrors((current) => [...current.filter((message) => message !== "No se pudieron cargar las subcategorías."), "No se pudieron cargar las subcategorías."]);
        }
      });
    return () => controller.abort();
  }, [refreshKey, value.categoryId, value.supplierCategoryId]);

  async function categoryCreated(created: SupplierCategory) {
    if (!supplierId) return;
    try {
      setOwnCategories(await supplierCategoriesService.list(supplierId));
    } catch {
      setOwnCategories((current) => [...current.filter((item) => item.id !== created.id), created]);
      setErrors((current) => [...current, "La categoría se creó, pero no se pudieron actualizar tus categorías."]);
    }
    onChange({ categoryId: null, subcategoryId: null, supplierCategoryId: created.id, supplierSubcategoryId: null });
    setShowCreate(false);
    onFeedback?.("Tu categoría se creó y quedó seleccionada.");
  }

  function selectSubcategory(rawId: string) {
    const id = rawId ? Number(rawId) : null;
    if (value.supplierCategoryId) {
      onChange({ categoryId: null, subcategoryId: null, supplierCategoryId: value.supplierCategoryId, supplierSubcategoryId: id });
    } else {
      onChange({ categoryId: value.categoryId, subcategoryId: id, supplierCategoryId: null, supplierSubcategoryId: null });
    }
  }

  return (
    <div className="space-y-2 md:col-span-2">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="supplier-classification" className="text-sm font-medium text-gray-700">Categoría *</label>
          <div className="relative">
            <Tags aria-hidden="true" size={18} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[#168e00]" />
            <select id="supplier-classification" value={selectedCategoryValue} onChange={(event) => onChange(parseCategoryOption(event.target.value))} disabled={disabled || loadingCategories} aria-describedby={errors.length ? "supplier-classification-error" : undefined} className={`${fieldClassName} appearance-none pl-11 pr-10`}>
              <option value="">{loadingCategories ? "Cargando categorías..." : "Selecciona una categoría"}</option>
              {ownCategories.some((category) => category.is_active !== false || category.id === value.supplierCategoryId) ? (
                <optgroup label="MIS CATEGORÍAS">
                  {ownCategories.filter((category) => category.is_active !== false || category.id === value.supplierCategoryId).map((category) => <option key={`mine-${category.id}`} value={`mine:${category.id}`}>{category.name}</option>)}
                </optgroup>
              ) : null}
              {globalCategories.length ? (
                <optgroup label="CATEGORÍAS DE DROOOPY">
                  {globalCategories.map((category) => <option key={`drooopy-${category.id}`} value={`drooopy:${category.id}`}>{category.name}</option>)}
                </optgroup>
              ) : null}
            </select>
            <ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-medium text-gray-700">Subcategoría <span className="font-normal text-gray-400">(opcional)</span></span>
          <span className="relative block">
            <select value={value.supplierCategoryId ? value.supplierSubcategoryId ?? "" : value.subcategoryId ?? ""} onChange={(event) => selectSubcategory(event.target.value)} disabled={disabled || !selectedCategoryValue || loadingSubcategories} className={`${fieldClassName} appearance-none pr-10`}>
              <option value="">{loadingSubcategories ? "Cargando subcategorías..." : "Subcategoría (opcional)"}</option>
              {availableSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
            </select>
            <ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
          </span>
        </label>
      </div>
      {selectedLabel ? <p className="text-xs font-medium text-[#004e28]">Seleccionada: {selectedLabel}</p> : null}
      {errors.length ? <p id="supplier-classification-error" role="alert" className="text-sm text-red-600">{errors.join(" ")}</p> : null}
      {errors.length && !loadingCategories ? <button type="button" onClick={() => { setLoadedGlobalCategoryId(null); setRefreshKey((current) => current + 1); }} className="text-sm font-semibold text-[#004e28] underline decoration-[#168e00]/40 underline-offset-4 hover:text-[#168e00]">Volver a cargar categorías</button> : null}
      <button type="button" onClick={() => setShowCreate(true)} disabled={disabled || loadingCategories || !supplierId || globalCategories.length === 0} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#168e00] transition hover:text-[#004e28] disabled:cursor-not-allowed disabled:text-gray-400">
        <Plus size={16} /> Crear mi propia categoría
      </button>
      {showCreate && supplierId ? <CreateCategoryModal supplierId={supplierId} categories={globalCategories} onClose={() => setShowCreate(false)} onCreated={(category) => void categoryCreated(category)} /> : null}
    </div>
  );
}
