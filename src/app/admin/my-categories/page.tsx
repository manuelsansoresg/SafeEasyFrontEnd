"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Edit2, FolderTree, Loader2, Plus, Power, Tags, Trash2, X } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import { resolveCurrentSupplier } from "@/lib/currentSupplier";
import { supplierCategoriesService } from "@/services/supplierCategoriesService";
import { useAuthStore } from "@/store/useAuthStore";
import type { DrooopyCategory, SupplierCategory, SupplierSubcategory } from "@/types/supplierCategories";

const fieldClassName = "h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-[#168e00] focus:ring-4 focus:ring-[#168e00]/10 disabled:cursor-not-allowed disabled:bg-gray-50";
type ToastState = { type: "success" | "error" | "info"; message: string } | null;

function CategoryModal({ supplierId, globalCategories, current, onClose, onSaved }: {
  supplierId: number;
  globalCategories: DrooopyCategory[];
  current: SupplierCategory | null;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [name, setName] = useState(current?.name ?? "");
  const [categoryId, setCategoryId] = useState<number | null>(current?.category_id ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Escribe un nombre para la categoría.");
    if (!categoryId) return setError("Selecciona una categoría de Drooopy.");
    setSaving(true);
    setError("");
    try {
      if (current) {
        await supplierCategoriesService.update(current.id, { name: name.trim(), category_id: categoryId, subcategory_id: null });
        await onSaved("La categoría se actualizó.");
      } else {
        await supplierCategoriesService.create({ supplier_id: supplierId, name: name.trim(), category_id: categoryId, subcategory_id: null });
        await onSaved("La categoría se creó.");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar la categoría.");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={current ? "Editar categoría" : "Nueva categoría"} className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4"><div><h2 className="font-[family-name:var(--font-varela-round)] text-xl text-[#004e28]">{current ? "Editar categoría" : "Nueva categoría"}</h2><p className="mt-1 text-sm text-gray-500">Organiza tu catálogo con nombres propios.</p></div><button type="button" onClick={onClose} disabled={saving} aria-label="Cerrar" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={19} /></button></div>
        <form onSubmit={submit} className="space-y-4 p-5">
          {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <label className="block space-y-2"><span className="text-sm font-semibold text-gray-700">Nombre *</span><input autoFocus value={name} onChange={(event) => { setName(event.target.value); setError(""); }} maxLength={100} className={fieldClassName} /></label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-gray-700">Categoría de Drooopy *</span>
            <span className="block text-xs leading-relaxed text-gray-500">
              Selecciona la opción que mejor describe tu categoría. Esto nos ayuda a mostrarla en el lugar correcto.
            </span>
            <select value={categoryId ?? ""} onChange={(event) => { setCategoryId(event.target.value ? Number(event.target.value) : null); setError(""); }} className={fieldClassName}><option value="">Selecciona una categoría</option>{globalCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          </label>
          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700">Cancelar</button><button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}Guardar</button></div>
        </form>
      </section>
    </div>
  );
}

function PrivateSubcategoriesModal({ category, onClose, onChanged, onFeedback }: {
  category: SupplierCategory;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onFeedback: (toast: NonNullable<ToastState>) => void;
}) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Escribe un nombre para la subcategoría.");
    setBusyId("new"); setError("");
    try {
      await supplierCategoriesService.createSubcategory(category.id, { name: name.trim(), subcategory_id: null });
      setName(""); await onChanged(); onFeedback({ type: "success", message: "La subcategoría se creó." });
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "No se pudo crear la subcategoría."); }
    finally { setBusyId(null); }
  }

  async function update(item: SupplierSubcategory, changes: { name?: string; is_active?: boolean }) {
    setBusyId(item.id); setError("");
    try { await supplierCategoriesService.updateSubcategory(item.id, changes); setEditingId(null); await onChanged(); onFeedback({ type: "success", message: "La subcategoría se actualizó." }); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "No se pudo actualizar la subcategoría."); }
    finally { setBusyId(null); }
  }

  async function remove(item: SupplierSubcategory) {
    if (!window.confirm(`¿Eliminar “${item.name}”?\n\nEsta acción no se puede deshacer.`)) return;
    setDeletingId(item.id); setError("");
    try { await supplierCategoriesService.deleteSubcategory(item.id); await onChanged(); onFeedback({ type: "success", message: "La subcategoría se eliminó." }); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "No se pudo eliminar la subcategoría."); }
    finally { setDeletingId(null); }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && busyId === null && deletingId === null) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={`Subcategorías de ${category.name}`} className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4"><div><h2 className="font-[family-name:var(--font-varela-round)] text-xl text-[#004e28]">Subcategorías de {category.name}</h2><p className="mt-1 text-sm text-gray-500">Administra las subcategorías de esta categoría.</p></div><button type="button" onClick={onClose} disabled={busyId !== null || deletingId !== null} aria-label="Cerrar" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={19} /></button></div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row"><input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className={`${fieldClassName} flex-1`} placeholder="Nombre de la nueva subcategoría" /><button type="submit" disabled={busyId !== null || deletingId !== null} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busyId === "new" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}Agregar</button></form>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
            {category.subcategories.length ? category.subcategories.map((item) => {
              const itemIsBusy = busyId === item.id || deletingId === item.id;
              return (
                <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  {editingId === item.id ? <input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} maxLength={100} className={`${fieldClassName} flex-1`} /> : <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-gray-900">{item.name}</p><p className={`text-xs ${item.is_active ? "text-[#168e00]" : "text-gray-400"}`}>{item.is_active ? "Activa" : "Inactiva"}</p></div>}
                  <div className="flex flex-wrap gap-2">
                    {editingId === item.id ? <button type="button" disabled={itemIsBusy || !editingName.trim()} onClick={() => void update(item, { name: editingName.trim() })} className="rounded-lg bg-[#168e00] px-3 py-2 text-xs font-semibold text-white">Guardar</button> : <button type="button" disabled={itemIsBusy} onClick={() => { setEditingId(item.id); setEditingName(item.name); }} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700">Editar</button>}
                    <button type="button" disabled={itemIsBusy} onClick={() => void update(item, { is_active: !item.is_active })} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700">{busyId === item.id ? <Loader2 size={16} className="animate-spin" /> : item.is_active ? "Desactivar" : "Activar"}</button>
                    <button type="button" disabled={itemIsBusy} onClick={() => void remove(item)} aria-label={`Eliminar ${item.name}`} className="rounded-lg border border-red-100 p-2 text-red-600">{deletingId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}</button>
                  </div>
                </div>
              );
            }) : <p className="p-6 text-center text-sm text-gray-500">Todavía no has creado subcategorías.</p>}
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
  const [globalCategories, setGlobalCategories] = useState<DrooopyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [editorId, setEditorId] = useState<number | "new" | null>(null);
  const [subcategoriesId, setSubcategoriesId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const supplier = await resolveCurrentSupplier(user);
      if (!supplier) throw new Error("No se encontró el proveedor asociado a tu cuenta.");
      setSupplierId(supplier.id);
      const [ownResult, globalResult] = await Promise.allSettled([
        supplierCategoriesService.list(supplier.id, undefined, true),
        supplierCategoriesService.listGlobalCategories(),
      ]);
      const messages: string[] = [];
      if (ownResult.status === "fulfilled") setCategories(ownResult.value); else { setCategories([]); messages.push("No se pudieron cargar tus categorías."); }
      if (globalResult.status === "fulfilled") setGlobalCategories(globalResult.value); else { setGlobalCategories([]); messages.push("No se pudieron cargar las categorías de Drooopy."); }
      setError(messages.join(" "));
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "No se pudieron cargar tus categorías."); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(null), 4000); return () => window.clearTimeout(timeout); }, [toast]);

  const editingCategory = editorId === "new" ? null : categories.find((item) => item.id === editorId) ?? null;
  const subcategoriesCategory = categories.find((item) => item.id === subcategoriesId) ?? null;
  const globalNames = useMemo(() => new Map(globalCategories.map((item) => [item.id, item.name])), [globalCategories]);

  async function saved(message: string) { setEditorId(null); await load(); setToast({ type: "success", message }); }
  async function updateCategory(category: SupplierCategory, changes: { is_active?: boolean }) { setBusyId(category.id); try { await supplierCategoriesService.update(category.id, changes); await load(); setToast({ type: "success", message: changes.is_active ? "La categoría se activó." : "La categoría se desactivó." }); } catch (requestError) { setToast({ type: "error", message: requestError instanceof Error ? requestError.message : "No se pudo actualizar la categoría." }); } finally { setBusyId(null); } }
  async function removeCategory(category: SupplierCategory) {
    const confirmed = window.confirm(
      `¿Eliminar “${category.name}”?\n\nEsta categoría se eliminará definitivamente junto con sus subcategorías que no estén siendo utilizadas. Esta acción no se puede deshacer.`,
    );
    if (!confirmed) return;
    setDeletingCategoryId(category.id);
    try {
      await supplierCategoriesService.delete(category.id);
      await load();
      setToast({ type: "success", message: "La categoría se eliminó." });
    } catch (requestError) {
      setToast({ type: "error", message: requestError instanceof Error ? requestError.message : "No se pudo eliminar la categoría." });
    } finally {
      setDeletingCategoryId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHero title="Mis categorías" subtitle="Organiza tus productos o servicios con categorías y subcategorías propias." actions={<div className="flex flex-wrap gap-3"><button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700"><ArrowLeft size={17} />Volver</button><button type="button" onClick={() => setEditorId("new")} disabled={!supplierId || loading || !globalCategories.length} className="inline-flex items-center gap-2 rounded-xl bg-[#004e28] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Plus size={18} />Nueva categoría</button></div>} />
      {error ? <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-medium text-red-700">{error}<button type="button" onClick={() => void load()} className="ml-3 font-semibold underline">Intentar de nuevo</button></div> : null}
      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">{loading ? <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-gray-500"><Loader2 size={24} className="animate-spin" />Cargando tus categorías...</div> : categories.length ? <div className="divide-y divide-gray-100">{categories.map((category) => {
        const categoryIsBusy = busyId === category.id || deletingCategoryId === category.id;
        return <article key={category.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center"><div className="min-w-0 flex-1"><h2 className="font-semibold text-gray-900">{category.name}</h2><p className="mt-1 text-sm text-gray-500">Categoría principal: {category.category?.name ?? globalNames.get(category.category_id) ?? "No disponible"} · {category.subcategories.length} {category.subcategories.length === 1 ? "subcategoría" : "subcategorías"}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${category.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>{category.is_active ? "Activa" : "Inactiva"}</span><div className="flex flex-wrap gap-2"><button type="button" disabled={categoryIsBusy} onClick={() => setEditorId(category.id)} className="rounded-lg border border-gray-200 p-2 text-gray-600 disabled:opacity-50" aria-label={`Editar ${category.name}`}><Edit2 size={16} /></button><button type="button" disabled={categoryIsBusy} onClick={() => setSubcategoriesId(category.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 disabled:opacity-50"><FolderTree size={16} />Subcategorías</button><button type="button" disabled={categoryIsBusy} onClick={() => void updateCategory(category, { is_active: !category.is_active })} className="rounded-lg border border-gray-200 p-2 text-gray-600 disabled:opacity-50" aria-label={category.is_active ? `Desactivar ${category.name}` : `Activar ${category.name}`}>{busyId === category.id ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}</button><button type="button" disabled={categoryIsBusy} onClick={() => void removeCategory(category)} className="rounded-lg border border-red-100 p-2 text-red-600 disabled:opacity-50" aria-label={`Eliminar ${category.name}`}>{deletingCategoryId === category.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}</button></div></article>;
      })}</div> : <div className="p-10 text-center"><Tags size={26} className="mx-auto text-[#168e00]" /><h2 className="mt-3 text-lg font-semibold text-[#004e28]">Crea tu primera categoría</h2></div>}</section>
      {editorId !== null && supplierId ? <CategoryModal supplierId={supplierId} globalCategories={globalCategories} current={editingCategory} onClose={() => setEditorId(null)} onSaved={saved} /> : null}
      {subcategoriesCategory ? <PrivateSubcategoriesModal category={subcategoriesCategory} onClose={() => setSubcategoriesId(null)} onChanged={load} onFeedback={setToast} /> : null}
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
