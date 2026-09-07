"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Edit2,
  FolderTree,
  Loader2,
  Plus,
  Power,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import { resolveCurrentSupplier } from "@/lib/currentSupplier";
import { supplierCategoriesService } from "@/services/supplierCategoriesService";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  DrooopyCategory,
  SupplierCategory,
  SupplierSubcategory,
} from "@/types/supplierCategories";

const fieldClassName = "h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-[#168e00] focus:ring-4 focus:ring-[#168e00]/10 disabled:cursor-not-allowed disabled:bg-gray-50";
type ToastState = { type: "success" | "error" | "info"; message: string } | null;

function CategoryModal({
  supplierId,
  categories,
  current,
  onClose,
  onSaved,
}: {
  supplierId: number;
  categories: DrooopyCategory[];
  current: SupplierCategory | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(current?.name ?? "");
  const [categoryId, setCategoryId] = useState<number | null>(current?.category_id ?? categories[0]?.id ?? null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(current?.subcategory_id ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedCategory = categories.find((category) => category.id === categoryId);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Escribe un nombre para la categoría.");
      return;
    }
    if (!current && !categoryId) {
      setError("Selecciona una clasificación de Drooopy.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (current) {
        await supplierCategoriesService.update(current.id, { name: name.trim() });
        onSaved("La categoría se actualizó.");
      } else {
        await supplierCategoriesService.create({
          supplier_id: supplierId,
          name: name.trim(),
          category_id: categoryId!,
          subcategory_id: subcategoryId,
        });
        onSaved("La categoría se creó.");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar la categoría.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="category-modal-title" className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id="category-modal-title" className="font-[family-name:var(--font-varela-round)] text-xl text-[#004e28]">{current ? "Editar categoría" : "Nueva categoría"}</h2>
            <p className="mt-1 text-sm text-gray-500">{current ? "Actualiza el nombre que usas en tu catálogo." : "Crea una organización propia para tu catálogo."}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Cerrar" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={19} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-5">
          {error ? <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p> : null}
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-gray-700">Nombre</span>
            <input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={120} className={fieldClassName} placeholder="Ej. Menú" />
          </label>
          {!current ? (
            <>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-700">Clasificación en Drooopy</span>
                <select value={categoryId ?? ""} onChange={(event) => { setCategoryId(event.target.value ? Number(event.target.value) : null); setSubcategoryId(null); }} className={fieldClassName}>
                  <option value="">Selecciona una clasificación</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-gray-700">Subcategoría relacionada <span className="font-normal text-gray-400">(opcional)</span></span>
                <select value={subcategoryId ?? ""} onChange={(event) => setSubcategoryId(event.target.value ? Number(event.target.value) : null)} disabled={!categoryId} className={fieldClassName}>
                  <option value="">Sin subcategoría relacionada</option>
                  {(selectedCategory?.subcategories ?? []).map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
                </select>
              </label>
            </>
          ) : null}
          <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#004e28] disabled:opacity-50">{saving ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />} Guardar</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function SubcategoriesModal({ category, onClose, onChanged, onFeedback }: {
  category: SupplierCategory;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onFeedback: (toast: NonNullable<ToastState>) => void;
}) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Escribe un nombre para la subcategoría.");
    setBusyId("new");
    setError("");
    try {
      await supplierCategoriesService.createSubcategory(category.id, { name: name.trim() });
      setName("");
      await onChanged();
      onFeedback({ type: "success", message: "La subcategoría se creó." });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo crear la subcategoría.");
    } finally {
      setBusyId(null);
    }
  }

  async function update(item: SupplierSubcategory, changes: { name?: string; is_active?: boolean }) {
    setBusyId(item.id);
    setError("");
    try {
      await supplierCategoriesService.updateSubcategory(item.id, changes);
      setEditingId(null);
      await onChanged();
      onFeedback({ type: "success", message: "La subcategoría se actualizó." });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo actualizar la subcategoría.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: SupplierSubcategory) {
    if (!window.confirm(`¿Eliminar “${item.name}”?`)) return;
    setBusyId(item.id);
    setError("");
    try {
      await supplierCategoriesService.deleteSubcategory(item.id);
      await onChanged();
      onFeedback({ type: "success", message: "La subcategoría se eliminó." });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo eliminar la subcategoría.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && busyId === null) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="subcategories-modal-title" className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div><h2 id="subcategories-modal-title" className="font-[family-name:var(--font-varela-round)] text-xl text-[#004e28]">Subcategorías de {category.name}</h2><p className="mt-1 text-sm text-gray-500">Añade niveles opcionales para organizar mejor tu catálogo.</p></div>
          <button type="button" onClick={onClose} disabled={busyId !== null} aria-label="Cerrar" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={19} /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {error ? <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p> : null}
          <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row">
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} className={fieldClassName} placeholder="Nombre de la nueva subcategoría" />
            <button type="submit" disabled={busyId !== null} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#004e28] disabled:opacity-50">{busyId === "new" ? <Loader2 size={17} className="animate-spin" /> : <Plus size={17} />} Agregar</button>
          </form>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
            {category.subcategories.length === 0 ? <p className="p-6 text-center text-sm text-gray-500">Todavía no has creado subcategorías.</p> : category.subcategories.map((item) => (
              <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                {editingId === item.id ? <input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} className={`${fieldClassName} flex-1`} /> : <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{item.name}</p><p className={`mt-0.5 text-xs font-medium ${item.is_active === false ? "text-gray-400" : "text-[#168e00]"}`}>{item.is_active === false ? "Inactiva" : "Activa"}</p></div>}
                <div className="flex flex-wrap gap-2">
                  {editingId === item.id ? <button type="button" disabled={busyId !== null || !editingName.trim()} onClick={() => void update(item, { name: editingName.trim() })} className="rounded-lg bg-[#168e00] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Guardar</button> : <button type="button" disabled={busyId !== null} onClick={() => { setEditingId(item.id); setEditingName(item.name); }} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">Editar</button>}
                  <button type="button" disabled={busyId !== null} onClick={() => void update(item, { is_active: item.is_active === false })} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">{item.is_active === false ? "Activar" : "Desactivar"}</button>
                  <button type="button" disabled={busyId !== null} onClick={() => void remove(item)} aria-label={`Eliminar ${item.name}`} className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50">{busyId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function MyCategoriesPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [categories, setCategories] = useState<SupplierCategory[]>([]);
  const [drooopyCategories, setDrooopyCategories] = useState<DrooopyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [editorId, setEditorId] = useState<number | "new" | null>(null);
  const [subcategoriesId, setSubcategoriesId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supplier = await resolveCurrentSupplier(user);
      if (!supplier) throw new Error("No se encontró el proveedor asociado a tu cuenta.");
      const typeId = Number(supplier.business_type_id ?? supplier.business_type?.id);
      if (!Number.isFinite(typeId) || typeId <= 0) throw new Error("Configura primero el tipo de negocio de tu empresa.");
      setSupplierId(supplier.id);
      const [own, global] = await Promise.all([
        supplierCategoriesService.list(supplier.id),
        supplierCategoriesService.allowedCategories(typeId),
      ]);
      setCategories(own);
      setDrooopyCategories(global);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar tus categorías.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const editingCategory = editorId === "new" ? null : categories.find((category) => category.id === editorId) ?? null;
  const subcategoriesCategory = categories.find((category) => category.id === subcategoriesId) ?? null;
  const classificationNames = useMemo(() => new Map(drooopyCategories.map((category) => [category.id, category])), [drooopyCategories]);

  async function saved(message: string) {
    setEditorId(null);
    await load();
    setToast({ type: "success", message });
  }

  async function toggle(category: SupplierCategory) {
    setBusyId(category.id);
    try {
      await supplierCategoriesService.update(category.id, { is_active: category.is_active === false });
      await load();
      setToast({ type: "success", message: category.is_active === false ? "La categoría se activó." : "La categoría se desactivó." });
    } catch (requestError) {
      setToast({ type: "error", message: requestError instanceof Error ? requestError.message : "No se pudo actualizar la categoría." });
    } finally { setBusyId(null); }
  }

  async function remove(category: SupplierCategory) {
    if (!window.confirm(`¿Eliminar “${category.name}”? Si está en uso, podrás desactivarla en su lugar.`)) return;
    setBusyId(category.id);
    try {
      await supplierCategoriesService.delete(category.id);
      await load();
      setToast({ type: "success", message: "La categoría se eliminó o desactivó correctamente." });
    } catch (requestError) {
      setToast({ type: "error", message: requestError instanceof Error ? requestError.message : "No se pudo eliminar la categoría." });
    } finally { setBusyId(null); }
  }

  return (
    <div className="space-y-6">
      <PageHero title="Mis categorías" subtitle="Organiza tus productos y servicios con nombres propios, sin cambiar cómo Drooopy los clasifica." actions={<div className="flex flex-wrap gap-3"><button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"><ArrowLeft size={17} /> Volver</button><button type="button" onClick={() => setEditorId("new")} disabled={!supplierId || loading || drooopyCategories.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-[#004e28] px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#004e28]/15 transition hover:bg-[#168e00] disabled:opacity-50"><Plus size={18} /> Nueva categoría</button></div>} />

      {error ? <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-medium text-red-700"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-3 font-semibold underline">Intentar de nuevo</button></div> : null}
      {!error ? <section className="overflow-hidden rounded-[1.4rem] border border-[#004e28]/10 bg-white shadow-[0_18px_55px_-42px_rgba(0,78,40,0.65)]">
        {loading ? <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-gray-500"><Loader2 size={26} className="animate-spin text-[#168e00]" /> Cargando tus categorías...</div> : categories.length === 0 ? <div className="p-10 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#168e00]/10 text-[#168e00]"><Tags size={26} /></span><h2 className="mt-4 font-[family-name:var(--font-varela-round)] text-xl text-[#004e28]">Crea tu primera categoría</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">Puedes crearla aquí o directamente mientras publicas un producto o servicio.</p></div> : <>
          <div className="hidden overflow-x-auto md:block"><table className="w-full text-left"><thead><tr className="border-b border-gray-100 bg-gray-50/70 text-xs uppercase tracking-wide text-gray-500"><th className="px-6 py-4">Nombre</th><th className="px-6 py-4">Clasificación Drooopy</th><th className="px-6 py-4">Subcategorías propias</th><th className="px-6 py-4">Estado</th><th className="px-6 py-4 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-gray-100">{categories.map((category) => {
            const globalCategory = category.category ?? category.global_category ?? classificationNames.get(category.category_id);
            const globalSubcategory = category.subcategory ?? category.global_subcategory ?? globalCategory?.subcategories?.find((item) => item.id === category.subcategory_id);
            return <tr key={category.id} className="transition hover:bg-[#f2f3f4]/50"><td className="px-6 py-5"><p className="font-semibold text-gray-900">{category.name}</p></td><td className="px-6 py-5 text-sm text-gray-600">{globalCategory?.name ?? "Clasificación no disponible"}{globalSubcategory ? <><ChevronRight size={14} className="mx-1 inline" />{globalSubcategory.name}</> : null}</td><td className="px-6 py-5 text-sm text-gray-600">{category.subcategories.length} {category.subcategories.length === 1 ? "subcategoría" : "subcategorías"}</td><td className="px-6 py-5"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${category.is_active === false ? "bg-gray-100 text-gray-500" : "bg-emerald-50 text-emerald-700"}`}>{category.is_active === false ? "Inactiva" : "Activa"}</span></td><td className="px-6 py-5"><div className="flex justify-end gap-2"><button type="button" onClick={() => setEditorId(category.id)} className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50" aria-label={`Editar ${category.name}`}><Edit2 size={16} /></button><button type="button" onClick={() => setSubcategoriesId(category.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"><FolderTree size={16} /> Subcategorías</button><button type="button" disabled={busyId !== null} onClick={() => void toggle(category)} className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50" aria-label={category.is_active === false ? `Activar ${category.name}` : `Desactivar ${category.name}`}><Power size={16} /></button><button type="button" disabled={busyId !== null} onClick={() => void remove(category)} className="rounded-lg border border-red-100 p-2 text-red-600 hover:bg-red-50" aria-label={`Eliminar ${category.name}`}>{busyId === category.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}</button></div></td></tr>;
          })}</tbody></table></div>
          <div className="divide-y divide-gray-100 md:hidden">{categories.map((category) => { const globalCategory = category.category ?? category.global_category ?? classificationNames.get(category.category_id); const globalSubcategory = category.subcategory ?? category.global_subcategory ?? globalCategory?.subcategories?.find((item) => item.id === category.subcategory_id); return <article key={category.id} className="space-y-4 p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-gray-900">{category.name}</h2><p className="mt-1 text-sm text-gray-500">{globalCategory?.name ?? "Clasificación no disponible"}{globalSubcategory ? ` › ${globalSubcategory.name}` : ""}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${category.is_active === false ? "bg-gray-100 text-gray-500" : "bg-emerald-50 text-emerald-700"}`}>{category.is_active === false ? "Inactiva" : "Activa"}</span></div><p className="text-sm text-gray-600">{category.subcategories.length} {category.subcategories.length === 1 ? "subcategoría propia" : "subcategorías propias"}</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setEditorId(category.id)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700">Editar</button><button type="button" onClick={() => setSubcategoriesId(category.id)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700">Administrar subcategorías</button><button type="button" onClick={() => void toggle(category)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700">{category.is_active === false ? "Activar" : "Desactivar"}</button><button type="button" onClick={() => void remove(category)} className="rounded-lg border border-red-100 px-3 py-2 text-xs font-semibold text-red-600">Eliminar</button></div></article>; })}</div>
        </>}
      </section> : null}

      {editorId !== null && supplierId ? <CategoryModal supplierId={supplierId} categories={drooopyCategories} current={editingCategory} onClose={() => setEditorId(null)} onSaved={(message) => void saved(message)} /> : null}
      {subcategoriesCategory ? <SubcategoriesModal category={subcategoriesCategory} onClose={() => setSubcategoriesId(null)} onChanged={load} onFeedback={setToast} /> : null}
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
