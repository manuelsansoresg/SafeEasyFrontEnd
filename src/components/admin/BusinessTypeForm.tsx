"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, X } from "lucide-react";
import { businessTypeService } from "@/services/businessTypeService";
import type { BusinessTypeAdminDetail, BusinessTypeCategory, BusinessTypePayload } from "@/types/businessType";

const inputClass = "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";
const buttonClass = "rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#004e28] disabled:opacity-50 disabled:cursor-not-allowed";
const messageOf = (error: unknown) => error instanceof Error ? error.message : "No se pudo guardar. Inténtalo de nuevo.";

export function BusinessTypeForm({ id, onClose, onSaved }: {
  id: number | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<BusinessTypeAdminDetail | null>(null);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [categories, setCategories] = useState<BusinessTypeCategory[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(id !== null);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState<"general" | "categories" | null>(null);

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
    if (id === null) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const [record, allCategories] = await Promise.all([
          businessTypeService.detail(id!, controller.signal),
          businessTypeService.categories(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setDetail(record);
        setName(record.name);
        setActive(record.is_active);
        // Preserve existing assignments even if a category is absent from the catalog.
        const merged = new Map(allCategories.map((category) => [category.id, category]));
        record.categories.forEach((category) => merged.set(category.id, category));
        setCategories([...merged.values()]);
        const ids = record.categories.map((category) => category.id);
        setSelected(ids);
        setSavedIds(ids);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(messageOf(error));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [id, retry]);

  const generalChanged = !detail || name.trim() !== detail.name || active !== detail.is_active;
  const categoriesChanged = selected.length !== savedIds.length || selected.some((categoryId) => !savedIds.includes(categoryId));

  function close() {
    if (saving) return;
    if (((id === null ? name.trim().length > 0 : detail && generalChanged) || categoriesChanged)
      && !window.confirm("¿Cerrar sin guardar los cambios pendientes?")) return;
    onClose();
  }

  async function saveGeneral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!name.trim()) { setError("El nombre es obligatorio."); return; }
    setSaving("general");
    setError("");
    setSuccess("");
    try {
      if (id === null) {
        await businessTypeService.create({ name: name.trim(), is_active: active });
        onSaved("Tipo de negocio creado.");
        onClose();
      } else if (detail) {
        const changes: Partial<BusinessTypePayload> = {};
        if (name.trim() !== detail.name) changes.name = name.trim();
        if (active !== detail.is_active) changes.is_active = active;
        if (Object.keys(changes).length) {
          await businessTypeService.update(id, changes);
          setDetail({ ...detail, ...changes });
          setSuccess("Datos generales guardados.");
          onSaved("Datos generales guardados.");
        }
      }
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setSaving(null);
    }
  }

  async function saveCategories() {
    if (id === null || saving) return;
    setSaving("categories");
    setCategoryError("");
    setSuccess("");
    try {
      await businessTypeService.setCategories(id, selected);
      setSavedIds([...selected]);
      setSuccess("Categorías permitidas guardadas.");
      onSaved("Categorías permitidas guardadas.");
    } catch (error) {
      setCategoryError(messageOf(error));
    } finally {
      setSaving(null);
    }
  }

  const filtered = categories.filter((category) => category.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  return (
    <dialog ref={dialog} aria-labelledby="business-type-title" onCancel={(event) => { event.preventDefault(); close(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-xl backdrop:bg-black/40 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="business-type-title" className="text-xl font-bold text-[#004e28] font-[family-name:var(--font-varela-round)]">{id === null ? "Nuevo tipo de negocio" : "Editar tipo de negocio"}</h2>
        <button type="button" aria-label="Cerrar" disabled={!!saving} onClick={close} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"><X size={20} /></button>
      </div>
      {loading ? <p role="status" className="flex items-center gap-2 py-8 text-gray-500"><Loader2 size={20} className="animate-spin" />Cargando tipo de negocio y categorías...</p>
        : loadError ? <div role="alert" className="space-y-3"><p className="text-sm text-red-700">{loadError}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className={buttonClass}>Reintentar</button></div>
        : <div className="space-y-6">
          {success ? <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{success}</p> : null}
          <form onSubmit={saveGeneral} className="space-y-4">
            <h3 className="font-semibold text-[#004e28]">Datos generales</h3>
            {detail ? <p className="break-words text-xs text-gray-500">Identificador: {detail.slug} · {detail.suppliers_count} proveedores</p> : null}
            <fieldset disabled={!!saving} className="space-y-4">
              <div className="space-y-1.5"><label htmlFor="business-type-name" className="text-sm font-semibold">Nombre *</label><input id="business-type-name" autoFocus={id === null} required value={name} onChange={(event) => setName(event.target.value)} className={inputClass} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 accent-[#168e00]" />Activo</label>
              {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
              <button type="submit" disabled={!!saving || !generalChanged} className={buttonClass}>{saving === "general" ? "Guardando..." : id === null ? "Crear tipo" : "Guardar datos generales"}</button>
            </fieldset>
          </form>
          {detail ? <section className="space-y-3 border-t border-gray-100 pt-5" aria-labelledby="allowed-categories">
            <h3 id="allowed-categories" className="font-semibold text-[#004e28]">Categorías permitidas</h3>
            <input type="search" aria-label="Buscar categoría" placeholder="Buscar categoría..." value={search} onChange={(event) => setSearch(event.target.value)} className={inputClass} />
            <p className="text-xs text-gray-500">{selected.length} categorías seleccionadas</p>
            <fieldset disabled={!!saving} aria-label="Categorías permitidas" className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-2">
              {filtered.length === 0 ? <p className="p-3 text-sm text-gray-500">No se encontraron categorías.</p> : filtered.map((category) => <label key={category.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2.5 text-sm hover:bg-gray-50">
                <input type="checkbox" checked={selected.includes(category.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, category.id] : current.filter((value) => value !== category.id))} className="h-4 w-4 shrink-0 accent-[#168e00]" />
                <span className="break-words">{category.name}{category.is_active === false ? " (Inactiva)" : ""}</span>
              </label>)}
            </fieldset>
            {categoryError ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{categoryError}</p> : null}
            <button type="button" disabled={!!saving || !categoriesChanged} onClick={() => void saveCategories()} className={buttonClass}>{saving === "categories" ? "Guardando..." : "Guardar categorías"}</button>
          </section> : null}
        </div>}
    </dialog>
  );
}
