"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { MenuItem, MenuItemPayload } from "@/types/menu";

type Props = {
  open: boolean;
  item?: MenuItem | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (payload: MenuItemPayload) => Promise<void> | void;
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
    setError(null);
  }, [open, item]);

  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Escribe el nombre del platillo o elemento.");
      return;
    }
    await onSubmit({
      name: cleanName,
      description: description.trim() || null,
      price: price.trim() === "" ? null : Number(price),
      old_price: oldPrice.trim() === "" ? null : Number(oldPrice),
      label: label.trim() || null,
      is_active: isActive,
      is_available: isAvailable,
      display_order: Math.max(0, Number(displayOrder) || 0),
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/40 p-4 sm:p-6">
      <form
        onSubmit={submit}
        className="mx-auto my-4 w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl sm:my-8"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#168e00]">Elemento</p>
            <h2 className="text-2xl font-bold text-gray-900">{item ? "Editar elemento" : "Nuevo elemento"}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100"><X size={21} /></button>
        </div>

        {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Nombre *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" placeholder="Ej. Poc Chuc" />
          </label>
          <label className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Descripción</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Precio</span>
            <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Precio anterior</span>
            <input type="number" min="0" step="0.01" value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Etiqueta</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" placeholder="Ej. Especial, Nuevo" />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Orden</span>
            <input type="number" min="0" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" />
          </label>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-5 w-5 accent-[#168e00]" />
            <div><p className="font-semibold text-gray-800">Activo</p><p className="text-xs text-gray-500">Visible públicamente.</p></div>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4">
            <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} className="h-5 w-5 accent-[#168e00]" />
            <div><p className="font-semibold text-gray-800">Disponible</p><p className="text-xs text-gray-500">Desactívalo para mostrarlo agotado.</p></div>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-gray-100 pt-5">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-gray-200 px-5 py-3 font-semibold text-gray-600">Cancelar</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-semibold text-white disabled:opacity-50">
            {saving ? <Loader2 size={18} className="animate-spin" /> : null}
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
