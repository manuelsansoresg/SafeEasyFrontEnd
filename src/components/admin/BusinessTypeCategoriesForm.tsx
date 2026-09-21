"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { businessTypeService } from "@/services/businessTypeService";
import type { BusinessTypeCategory } from "@/types/businessType";

const inputClass = "w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const primaryButtonClass = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#004e28] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass = "rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
const messageOf = (error: unknown) => error instanceof Error ? error.message : "No se pudo guardar la asignación. Inténtalo de nuevo.";

export function BusinessTypeCategoriesForm({ id, name, onClose, onSaved }: {
  id: number;
  name: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [businessTypeName, setBusinessTypeName] = useState(name);
  const [categories, setCategories] = useState<BusinessTypeCategory[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
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
        const [record, allCategories] = await Promise.all([
          businessTypeService.detail(id, controller.signal),
          businessTypeService.categories(controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setBusinessTypeName(record.name);

        // Keep assigned categories visible even if one is no longer in the active catalog.
        const merged = new Map(allCategories.map((category) => [category.id, category]));
        record.categories.forEach((category) => merged.set(category.id, category));
        setCategories([...merged.values()]);

        const assignedIds = record.categories.map((category) => category.id);
        setSelected(assignedIds);
        setSavedIds(assignedIds);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(messageOf(error));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [id, retry]);

  const changed = selected.length !== savedIds.length
    || selected.some((categoryId) => !savedIds.includes(categoryId));
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filtered = categories.filter((category) => category.name.toLocaleLowerCase().includes(normalizedSearch));

  function close() {
    if (saving) return;
    if (changed && !window.confirm("¿Cerrar sin guardar los cambios pendientes?")) return;
    onClose();
  }

  async function save() {
    if (saving || !changed) return;
    setSaving(true);
    setError("");
    try {
      await businessTypeService.setCategories(id, selected);
      onSaved("Asignación de categorías guardada.");
      onClose();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="business-type-categories-title" onCancel={(event) => { event.preventDefault(); close(); }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-gray-100 bg-white p-0 shadow-xl backdrop:bg-black/40">
      <div className="flex max-h-[90dvh] flex-col">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 p-5 sm:p-6">
          <div className="min-w-0">
            <h2 id="business-type-categories-title" className="font-[family-name:var(--font-varela-round)] text-xl font-bold text-[#004e28]">Asignar categorías</h2>
            <p className="mt-1 truncate font-semibold text-gray-900">{businessTypeName}</p>
            <p className="mt-2 text-sm text-gray-600">Selecciona las categorías que podrán utilizar los negocios de este tipo.</p>
          </div>
          <button type="button" aria-label="Cerrar" disabled={saving} onClick={close} className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"><X size={20} /></button>
        </div>

        {loading ? <p role="status" className="flex items-center justify-center gap-2 p-10 text-gray-500"><Loader2 size={20} className="animate-spin" />Cargando categorías...</p>
          : loadError ? <div role="alert" className="space-y-3 p-6 text-center"><p className="text-sm text-red-700">{loadError}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className={primaryButtonClass}>Reintentar</button></div>
          : <div className="flex min-h-0 flex-1 flex-col gap-3 p-5 sm:p-6">
            <div className="relative shrink-0">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="search" aria-label="Buscar categoría" placeholder="Buscar categoría..." value={search} onChange={(event) => setSearch(event.target.value)} className={inputClass} />
            </div>
            <p className="shrink-0 text-sm font-medium text-gray-600">{selected.length} {selected.length === 1 ? "categoría seleccionada" : "categorías seleccionadas"}</p>
            <fieldset disabled={saving} aria-label="Categorías disponibles" className="min-h-0 flex-1 space-y-1 overflow-y-auto rounded-xl border border-gray-200 p-2">
              {filtered.length === 0 ? <p className="p-3 text-sm text-gray-500">No se encontraron categorías.</p> : filtered.map((category) => <label key={category.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2.5 text-sm hover:bg-gray-50">
                <input type="checkbox" checked={selected.includes(category.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, category.id] : current.filter((value) => value !== category.id))} className="h-4 w-4 shrink-0 accent-[#168e00]" />
                <span className="break-words">{category.name}{category.is_active === false ? " (Inactiva)" : ""}</span>
              </label>)}
            </fieldset>
            {error ? <p role="alert" className="shrink-0 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end">
              <button type="button" disabled={saving} onClick={close} className={secondaryButtonClass}>Cancelar</button>
              <button type="button" disabled={saving || !changed} onClick={() => void save()} className={primaryButtonClass}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : null}{saving ? "Guardando..." : "Guardar asignación"}
              </button>
            </div>
          </div>}
      </div>
    </dialog>
  );
}
