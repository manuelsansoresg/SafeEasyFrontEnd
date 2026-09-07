"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Check, ChevronDown, Loader2, Plus, Tags, X } from "lucide-react";
import { supplierCategoriesService } from "@/services/supplierCategoriesService";
import type {
  DrooopyCategory,
  DrooopySubcategory,
  SupplierCategory,
  SupplierClassification,
  SupplierSubcategory,
} from "@/types/supplierCategories";

const fieldClassName =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 transition focus:border-[#168e00] focus:outline-none focus:ring-4 focus:ring-[#168e00]/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

const EMPTY: SupplierClassification = {
  categoryId: null,
  subcategoryId: null,
  supplierCategoryId: null,
  supplierSubcategoryId: null,
};

function categoryValue(value: SupplierClassification) {
  if (value.supplierCategoryId) return `mine:${value.supplierCategoryId}`;
  if (value.categoryId) return `drooopy:${value.categoryId}`;
  return "";
}

function parseCategory(value: string): SupplierClassification {
  const [kind, rawId] = value.split(":");
  const id = Number(rawId);
  if (!Number.isFinite(id) || id <= 0) return EMPTY;
  return kind === "mine"
    ? { categoryId: null, subcategoryId: null, supplierCategoryId: id, supplierSubcategoryId: null }
    : { categoryId: id, subcategoryId: null, supplierCategoryId: null, supplierSubcategoryId: null };
}

function ModalShell({ title, subtitle, saving, error, onClose, onSubmit, children }: {
  title: string;
  subtitle: string;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div><h2 className="font-[family-name:var(--font-varela-round)] text-xl text-[#004e28]">{title}</h2><p className="mt-1 text-sm text-gray-500">{subtitle}</p></div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Cerrar" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"><X size={19} /></button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 p-5">
          {error ? <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p> : null}
          {children}
          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#004e28] disabled:opacity-50">{saving ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}Crear y seleccionar</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CreateCategoryModal({ supplierId, categories, onClose, onCreated }: {
  supplierId: number;
  categories: DrooopyCategory[];
  onClose: () => void;
  onCreated: (category: SupplierCategory) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Escribe un nombre para tu categoría.");
    if (!categoryId) return setError("Selecciona una categoría de Drooopy.");
    setSaving(true);
    setError("");
    try {
      onCreated(await supplierCategoriesService.create({ supplier_id: supplierId, name: name.trim(), category_id: categoryId, subcategory_id: null }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo crear la categoría.");
    } finally { setSaving(false); }
  }

  return (
    <ModalShell title="Crear mi categoría" subtitle="Elige un nombre y la categoría de Drooopy donde se mostrará." saving={saving} error={error} onClose={onClose} onSubmit={submit}>
      <label className="block space-y-2"><span className="text-sm font-semibold text-gray-700">Nombre *</span><input ref={inputRef} value={name} onChange={(event) => { setName(event.target.value); setError(""); }} maxLength={100} className={fieldClassName} placeholder="Ej. Bolsas artesanales" /></label>
      <label className="block space-y-2">
        <span className="text-sm font-semibold text-gray-700">Categoría de Drooopy *</span>
        <span className="block text-xs leading-relaxed text-gray-500">
          Selecciona la opción que mejor describe tu categoría. Esto nos ayuda a mostrarla en el lugar correcto.
        </span>
        <select value={categoryId ?? ""} onChange={(event) => { setCategoryId(event.target.value ? Number(event.target.value) : null); setError(""); }} className={fieldClassName}><option value="">Selecciona una categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
      </label>
    </ModalShell>
  );
}

function CreateSubcategoryModal({ categoryName, onClose, onCreate }: {
  categoryName: string;
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Escribe un nombre para tu subcategoría.");
    setSaving(true);
    setError("");
    try { await onCreate(name.trim()); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "No se pudo crear la subcategoría."); }
    finally { setSaving(false); }
  }

  return (
    <ModalShell title="Crear mi subcategoría" subtitle={`Categoría: ${categoryName}`} saving={saving} error={error} onClose={onClose} onSubmit={submit}>
      <label className="block space-y-2"><span className="text-sm font-semibold text-gray-700">Nombre *</span><input ref={inputRef} value={name} onChange={(event) => { setName(event.target.value); setError(""); }} maxLength={100} className={fieldClassName} placeholder="Ej. Bolsas Premium" /></label>
    </ModalShell>
  );
}

export function SupplierClassificationPicker({ supplierId, value, onChange, onFeedback, disabled = false }: {
  supplierId: number | null;
  value: SupplierClassification;
  onChange: (value: SupplierClassification) => void;
  onFeedback?: (message: string) => void;
  disabled?: boolean;
}) {
  const [ownCategories, setOwnCategories] = useState<SupplierCategory[]>([]);
  const [globalCategories, setGlobalCategories] = useState<DrooopyCategory[]>([]);
  const [globalSubcategories, setGlobalSubcategories] = useState<DrooopySubcategory[]>([]);
  const [ownGlobalSubcategories, setOwnGlobalSubcategories] = useState<SupplierSubcategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showCreateSubcategory, setShowCreateSubcategory] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const selectedCategory = value.supplierCategoryId
    ? ownCategories.find((item) => item.id === value.supplierCategoryId) ?? null
    : null;
  const selectedGlobalCategory = value.categoryId
    ? globalCategories.find((item) => item.id === value.categoryId) ?? null
    : null;
  const selectedCategoryValue = categoryValue(value);
  const selectedSubcategoryValue = value.supplierSubcategoryId
    ? `mine:${value.supplierSubcategoryId}`
    : value.subcategoryId ? `drooopy:${value.subcategoryId}` : "";

  const selectedLabel = useMemo(() => {
    if (selectedCategory) {
      const child = selectedCategory.subcategories.find((item) => item.id === value.supplierSubcategoryId);
      return [selectedCategory.name, child?.name].filter(Boolean).join(" › ");
    }
    const child = value.supplierSubcategoryId
      ? ownGlobalSubcategories.find((item) => item.id === value.supplierSubcategoryId)
      : globalSubcategories.find((item) => item.id === value.subcategoryId);
    return [selectedGlobalCategory?.name, child?.name].filter(Boolean).join(" › ");
  }, [globalSubcategories, ownGlobalSubcategories, selectedCategory, selectedGlobalCategory, value.subcategoryId, value.supplierSubcategoryId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingCategories(true);
    const ownRequest = supplierId ? supplierCategoriesService.list(supplierId, controller.signal) : Promise.resolve([] as SupplierCategory[]);
    Promise.allSettled([supplierCategoriesService.listGlobalCategories(controller.signal), ownRequest]).then(([globalResult, ownResult]) => {
      if (controller.signal.aborted) return;
      const nextErrors: string[] = [];
      if (globalResult.status === "fulfilled") setGlobalCategories(globalResult.value);
      else { setGlobalCategories([]); nextErrors.push("No se pudieron cargar las categorías de Drooopy."); }
      if (ownResult.status === "fulfilled") setOwnCategories(ownResult.value);
      else { setOwnCategories([]); nextErrors.push("No se pudieron cargar tus categorías."); }
      setErrors(nextErrors);
      setLoadingCategories(false);
    });
    return () => controller.abort();
  }, [refreshKey, supplierId]);

  useEffect(() => {
    if (!value.categoryId || value.supplierCategoryId) {
      setGlobalSubcategories([]);
      setOwnGlobalSubcategories([]);
      setLoadingSubcategories(false);
      return;
    }
    const controller = new AbortController();
    setLoadingSubcategories(true);
    const ownRequest = supplierId
      ? supplierCategoriesService.listGlobalSupplierSubcategories(supplierId, value.categoryId, controller.signal)
      : Promise.resolve([] as SupplierSubcategory[]);
    Promise.allSettled([
      supplierCategoriesService.listGlobalSubcategories(value.categoryId, controller.signal),
      ownRequest,
    ]).then(([globalResult, ownResult]) => {
      if (controller.signal.aborted) return;
      if (globalResult.status === "fulfilled") setGlobalSubcategories(globalResult.value);
      else setGlobalSubcategories([]);
      if (ownResult.status === "fulfilled") setOwnGlobalSubcategories(ownResult.value);
      else setOwnGlobalSubcategories([]);
      setErrors((current) => {
        const next = current.filter(
          (message) =>
            message !== "No se pudieron cargar las subcategorías." &&
            message !== "No se pudieron cargar tus subcategorías.",
        );
        if (globalResult.status === "rejected") next.push("No se pudieron cargar las subcategorías.");
        if (ownResult.status === "rejected") next.push("No se pudieron cargar tus subcategorías.");
        return [...new Set(next)];
      });
      setLoadingSubcategories(false);
    });
    return () => controller.abort();
  }, [refreshKey, supplierId, value.categoryId, value.supplierCategoryId]);

  function changeSubcategory(rawValue: string) {
    const [kind, rawId] = rawValue.split(":");
    const id = rawValue ? Number(rawId) : null;
    if (selectedCategory) {
      onChange({ categoryId: null, subcategoryId: null, supplierCategoryId: selectedCategory.id, supplierSubcategoryId: id });
      return;
    }
    if (!value.categoryId) return;
    onChange(kind === "mine"
      ? { categoryId: value.categoryId, subcategoryId: null, supplierCategoryId: null, supplierSubcategoryId: id }
      : { categoryId: value.categoryId, subcategoryId: id, supplierCategoryId: null, supplierSubcategoryId: null });
  }

  async function categoryCreated(created: SupplierCategory) {
    if (!supplierId) return;
    setOwnCategories(await supplierCategoriesService.list(supplierId).catch(() => [created]));
    onChange({ categoryId: null, subcategoryId: null, supplierCategoryId: created.id, supplierSubcategoryId: null });
    setShowCreateCategory(false);
    onFeedback?.("Tu categoría se creó y quedó seleccionada.");
  }

  async function createSubcategory(name: string) {
    if (!supplierId) return;
    if (selectedCategory) {
      const created = await supplierCategoriesService.createSubcategory(selectedCategory.id, { name, subcategory_id: null });
      const updated = await supplierCategoriesService.list(supplierId);
      setOwnCategories(updated);
      onChange({ categoryId: null, subcategoryId: null, supplierCategoryId: selectedCategory.id, supplierSubcategoryId: created.id });
    } else if (value.categoryId) {
      const categoryId = value.categoryId;
      const created = await supplierCategoriesService.createGlobalSubcategory({ supplier_id: supplierId, category_id: categoryId, name });
      setOwnGlobalSubcategories(await supplierCategoriesService.listGlobalSupplierSubcategories(supplierId, categoryId));
      onChange({ categoryId, subcategoryId: null, supplierCategoryId: null, supplierSubcategoryId: created.id });
    }
    setShowCreateSubcategory(false);
    onFeedback?.("Tu subcategoría se creó y quedó seleccionada.");
  }

  const privateChildren = selectedCategory?.subcategories.filter((item) => item.is_active !== false || item.id === value.supplierSubcategoryId) ?? [];
  const categoryName = selectedCategory?.name ?? selectedGlobalCategory?.name ?? "";

  return (
    <div className="space-y-3 md:col-span-2">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="supplier-classification" className="text-sm font-medium text-gray-700">Categoría *</label>
          <div className="relative"><Tags size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[#168e00]" /><select id="supplier-classification" value={selectedCategoryValue} onChange={(event) => { onChange(parseCategory(event.target.value)); setShowCreateSubcategory(false); }} disabled={disabled || loadingCategories} className={`${fieldClassName} appearance-none pl-11 pr-10`}><option value="">{loadingCategories ? "Cargando categorías..." : "Selecciona una categoría"}</option>{ownCategories.length ? <optgroup label="MIS CATEGORÍAS">{ownCategories.map((category) => <option key={`mine-${category.id}`} value={`mine:${category.id}`}>{category.name}</option>)}</optgroup> : null}{globalCategories.length ? <optgroup label="CATEGORÍAS DE DROOOPY">{globalCategories.map((category) => <option key={`drooopy-${category.id}`} value={`drooopy:${category.id}`}>{category.name}</option>)}</optgroup> : null}</select><ChevronDown size={18} aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" /></div>
        </div>
        <div className="space-y-2">
          <label htmlFor="supplier-subclassification" className="text-sm font-medium text-gray-700">Subcategoría <span className="font-normal text-gray-400">(opcional)</span></label>
          <div className="relative"><select id="supplier-subclassification" value={selectedSubcategoryValue} onChange={(event) => changeSubcategory(event.target.value)} disabled={disabled || !selectedCategoryValue || loadingSubcategories} className={`${fieldClassName} appearance-none pr-10`}><option value="">{loadingSubcategories ? "Cargando subcategorías..." : "Sin subcategoría"}</option>{selectedCategory ? (privateChildren.length ? <optgroup label="MIS SUBCATEGORÍAS">{privateChildren.map((item) => <option key={`mine-${item.id}`} value={`mine:${item.id}`}>{item.name}</option>)}</optgroup> : null) : <>{ownGlobalSubcategories.length ? <optgroup label="MIS SUBCATEGORÍAS">{ownGlobalSubcategories.map((item) => <option key={`mine-${item.id}`} value={`mine:${item.id}`}>{item.name}</option>)}</optgroup> : null}{globalSubcategories.length ? <optgroup label="SUBCATEGORÍAS DE DROOOPY">{globalSubcategories.map((item) => <option key={`drooopy-${item.id}`} value={`drooopy:${item.id}`}>{item.name}</option>)}</optgroup> : null}</>}</select><ChevronDown size={18} aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" /></div>
        </div>
      </div>
      {selectedLabel ? <p className="text-xs font-medium text-[#004e28]">Seleccionada: {selectedLabel}</p> : null}
      {errors.length ? <p role="alert" className="text-sm text-red-600">{errors.join(" ")}</p> : null}
      {errors.length ? <button type="button" onClick={() => setRefreshKey((current) => current + 1)} className="text-sm font-semibold text-[#004e28] underline">Volver a cargar</button> : null}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        <button type="button" onClick={() => setShowCreateCategory(true)} disabled={disabled || loadingCategories || !supplierId || !globalCategories.length} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#168e00] hover:text-[#004e28] disabled:text-gray-400"><Plus size={16} />Crear mi categoría</button>
        {selectedCategoryValue ? <button type="button" onClick={() => setShowCreateSubcategory(true)} disabled={disabled || !supplierId} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#168e00] hover:text-[#004e28] disabled:text-gray-400"><Plus size={16} />Crear mi subcategoría</button> : null}
      </div>
      {showCreateCategory && supplierId ? <CreateCategoryModal supplierId={supplierId} categories={globalCategories} onClose={() => setShowCreateCategory(false)} onCreated={(category) => void categoryCreated(category)} /> : null}
      {showCreateSubcategory && categoryName ? <CreateSubcategoryModal categoryName={categoryName} onClose={() => setShowCreateSubcategory(false)} onCreate={createSubcategory} /> : null}
    </div>
  );
}
