"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { menuService } from "@/services/menuService";
import type { MenuItem, MenuItemPayload, MenuItemVariantPayload } from "@/types/menu";

export type VariantDraft = MenuItemVariantPayload & { id?: number };

export const emptyVariant = (order: number): VariantDraft => ({
  name: "", price: 0, old_price: null, is_active: true,
  is_available: true, display_order: order,
});

export function VariantFields({ variants, onChange, disabled = false }: {
  variants: VariantDraft[];
  onChange: (variants: VariantDraft[]) => void;
  disabled?: boolean;
}) {
  const update = (index: number, patch: Partial<VariantDraft>) =>
    onChange(variants.map((variant, i) => i === index ? { ...variant, ...patch } : variant));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-[#004e28]">Presentaciones</h3>
          <p className="text-xs text-gray-500">Opcional. Si agregas presentaciones, el cliente elegirá una antes de pedir.</p>
        </div>
        <button type="button" disabled={disabled} onClick={() => onChange([...variants, emptyVariant(variants.length)])}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#168e00]/30 px-3 py-2 text-xs font-bold text-[#168e00] disabled:opacity-50">
          <Plus size={15} /> Agregar
        </button>
      </div>
      {variants.map((variant, index) => (
        <div key={variant.id ?? `new-${index}`} className="rounded-2xl border border-gray-200 bg-[#f2f3f4] p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_100px_100px_70px_auto]">
            <label className="text-xs font-semibold text-gray-700">Nombre *
              <input value={variant.name} disabled={disabled} onChange={(e) => update(index, { name: e.target.value })}
                placeholder="Ej. Media orden" className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm outline-none focus:border-[#168e00]" />
            </label>
            <label className="text-xs font-semibold text-gray-700">Precio *
              <input type="number" min="0" step="0.01" value={variant.price} disabled={disabled}
                onChange={(e) => update(index, { price: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm outline-none focus:border-[#168e00]" />
            </label>
            <label className="text-xs font-semibold text-gray-700">Anterior
              <input type="number" min="0" step="0.01" value={variant.old_price ?? ""} disabled={disabled}
                onChange={(e) => update(index, { old_price: e.target.value === "" ? null : Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm outline-none focus:border-[#168e00]" />
            </label>
            <label className="text-xs font-semibold text-gray-700">Orden
              <input type="number" min="0" step="1" value={variant.display_order} disabled={disabled}
                onChange={(e) => update(index, { display_order: Number(e.target.value) })}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm outline-none focus:border-[#168e00]" />
            </label>
            <button type="button" disabled={disabled} onClick={() => onChange(variants.filter((_, i) => i !== index))}
              className="self-end rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-50" aria-label={`Eliminar presentación ${variant.name || index + 1}`}>
              <Trash2 size={18} />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-gray-700">
            <label className="flex items-center gap-2"><input type="checkbox" checked={variant.is_active} disabled={disabled}
              onChange={(e) => update(index, { is_active: e.target.checked })} className="accent-[#168e00]" /> Activa</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={variant.is_available} disabled={disabled}
              onChange={(e) => update(index, { is_available: e.target.checked })} className="accent-[#168e00]" /> Disponible</label>
          </div>
        </div>
      ))}
    </div>
  );
}

type Props = {
  open: boolean;
  item?: MenuItem | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (payload: MenuItemPayload, variants: VariantDraft[], originalVariantIds: number[]) => Promise<void> | void;
};

export function MenuItemForm({ open, item, saving = false, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [label, setLabel] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [originalVariantIds, setOriginalVariantIds] = useState<number[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [variantsLoadFailed, setVariantsLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setDescription(item?.description ?? "");
    setPrice(item?.price != null ? String(item.price) : "");
    setOldPrice(item?.old_price != null ? String(item.old_price) : "");
    setLabel(item?.label ?? "");
    setDisplayOrder(String(item?.display_order ?? 0));
    setIsActive(item?.is_active ?? true);
    setIsAvailable(item?.is_available ?? true);
    setVariants([]);
    setOriginalVariantIds([]);
    setVariantsLoadFailed(false);
    setError(null);
    if (!item) return;
    const controller = new AbortController();
    setLoadingVariants(true);
    menuService.listVariants(item.id, controller.signal)
      .then((data) => {
        setVariants(data.map(({ id, name, price, old_price, is_active, is_available, display_order }) =>
          ({ id, name, price, old_price, is_active, is_available, display_order })));
        setOriginalVariantIds(data.map((variant) => variant.id));
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setVariantsLoadFailed(true);
        setError(err instanceof Error ? err.message : "No se pudieron cargar las presentaciones.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoadingVariants(false); });
    return () => controller.abort();
  }, [open, item]);

  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return setError("Escribe el nombre del platillo o elemento.");
    const parsedPrice = price.trim() === "" ? null : Number(price);
    const parsedOldPrice = oldPrice.trim() === "" ? null : Number(oldPrice);
    if ([parsedPrice, parsedOldPrice].some((value) => value != null && (!Number.isFinite(value) || value < 0))) {
      return setError("Escribe precios válidos.");
    }
    if (variants.some((variant) => !variant.name.trim() || variant.name.trim().length > 120 || !Number.isFinite(variant.price) || variant.price < 0 ||
      (variant.old_price != null && (!Number.isFinite(variant.old_price) || variant.old_price < 0)) ||
      !Number.isInteger(variant.display_order) || variant.display_order < 0)) {
      return setError("Completa el nombre, precio y orden válidos de cada presentación.");
    }
    setError(null);
    try {
      await onSubmit({
        name: cleanName, description: description.trim() || null, price: parsedPrice,
        old_price: parsedOldPrice, label: label.trim() || null, is_active: isActive,
        is_available: isAvailable, display_order: Math.max(0, Number(displayOrder) || 0),
      }, variants.map((variant) => ({ ...variant, name: variant.name.trim() })), originalVariantIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el platillo.");
    }
  };

  return (
    <div className="fixed inset-0 z-[20000] overflow-y-auto bg-black/40 p-4 sm:p-6">
      <form onSubmit={submit} className="mx-auto my-4 w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl sm:my-8">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#168e00]">Elemento</p>
            <h2 className="text-2xl font-bold text-gray-900">{item ? "Editar elemento" : "Nuevo elemento"}</h2></div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100"><X size={21} /></button>
        </div>
        {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2"><span className="mb-1.5 block text-sm font-semibold text-gray-700">Nombre *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" placeholder="Ej. Poc Chuc" /></label>
          <label className="md:col-span-2"><span className="mb-1.5 block text-sm font-semibold text-gray-700">Descripción</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" /></label>
          <label><span className="mb-1.5 block text-sm font-semibold text-gray-700">Precio único (opcional si hay presentaciones)</span>
            <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" /></label>
          <label><span className="mb-1.5 block text-sm font-semibold text-gray-700">Precio anterior</span>
            <input type="number" min="0" step="0.01" value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" /></label>
          <label><span className="mb-1.5 block text-sm font-semibold text-gray-700">Etiqueta</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" placeholder="Ej. Especial, Nuevo" /></label>
          <label><span className="mb-1.5 block text-sm font-semibold text-gray-700">Orden</span>
            <input type="number" min="0" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" /></label>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-5 w-5 accent-[#168e00]" /><div><p className="font-semibold text-gray-800">Activo</p><p className="text-xs text-gray-500">Visible públicamente.</p></div></label>
          <label className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4"><input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} className="h-5 w-5 accent-[#168e00]" /><div><p className="font-semibold text-gray-800">Disponible</p><p className="text-xs text-gray-500">Desactívalo para mostrarlo agotado.</p></div></label>
        </div>
        <div className="mt-6 border-t border-gray-100 pt-5">
          {loadingVariants ? <p className="mb-3 flex items-center gap-2 text-sm text-gray-500"><Loader2 size={16} className="animate-spin" /> Cargando presentaciones...</p> : null}
          <VariantFields variants={variants} onChange={setVariants} disabled={saving || loadingVariants || variantsLoadFailed} />
        </div>
        <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-5">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-gray-200 px-5 py-3 font-semibold text-gray-600">Cancelar</button>
          <button type="submit" disabled={saving || loadingVariants || variantsLoadFailed} className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-semibold text-white disabled:opacity-50">
            {saving ? <Loader2 size={18} className="animate-spin" /> : null} Guardar</button>
        </div>
      </form>
    </div>
  );
}
