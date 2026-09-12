"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { MenuSection, MenuSectionPayload } from "@/types/menu";

type Props = {
  open: boolean;
  section?: MenuSection | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (payload: MenuSectionPayload) => Promise<void> | void;
};

export function MenuSectionForm({ open, section, saving = false, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(section?.name ?? "");
    setDescription(section?.description ?? "");
    setDisplayOrder(String(section?.display_order ?? 0));
    setIsActive(section?.is_active ?? true);
    setError(null);
  }, [open, section]);

  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Escribe el nombre de la sección.");
      return;
    }
    await onSubmit({
      name: cleanName,
      description: description.trim() || null,
      is_active: isActive,
      display_order: Math.max(0, Number(displayOrder) || 0),
    });
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#168e00]">Sección</p>
            <h2 className="text-2xl font-bold text-gray-900">{section ? "Editar sección" : "Nueva sección"}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100"><X size={21} /></button>
        </div>

        {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Nombre *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" placeholder="Ej. Platos fuertes" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Descripción</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">Orden</span>
            <input type="number" min="0" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" />
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-5 w-5 accent-[#168e00]" />
            <span className="font-semibold text-gray-800">Sección activa</span>
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
