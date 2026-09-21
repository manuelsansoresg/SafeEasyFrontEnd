"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { Menu, MenuCreatePayload, MenuDay } from "@/types/menu";

const dayOptions: { value: MenuDay; label: string }[] = [
  { value: 0, label: "Lun" },
  { value: 1, label: "Mar" },
  { value: 2, label: "Mié" },
  { value: 3, label: "Jue" },
  { value: 4, label: "Vie" },
  { value: 5, label: "Sáb" },
  { value: 6, label: "Dom" },
];

type Props = {
  open: boolean;
  menu?: Menu | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (payload: MenuCreatePayload) => Promise<void> | void;
};

function toTimeInput(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "";
}

export function MenuForm({ open, menu, saving = false, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [days, setDays] = useState<MenuDay[]>([]);
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState("0");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(menu?.name ?? "");
    setDescription(menu?.description ?? "");
    setPrice(menu?.price != null ? String(menu.price) : "");
    setDateStart(menu?.date_start ?? "");
    setDateEnd(menu?.date_end ?? "");
    setDays(menu?.days_of_week ?? []);
    setTimeStart(toTimeInput(menu?.time_start));
    setTimeEnd(toTimeInput(menu?.time_end));
    setIsActive(menu?.is_active ?? true);
    setDisplayOrder(String(menu?.display_order ?? 0));
    setError(null);
  }, [open, menu]);

  const title = useMemo(() => (menu ? "Editar menú" : "Crear menú"), [menu]);

  if (!open) return null;

  const toggleDay = (day: MenuDay) => {
    setDays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setError("Escribe un nombre de al menos 2 caracteres.");
      return;
    }
    if ((timeStart && !timeEnd) || (!timeStart && timeEnd)) {
      setError("Si agregas horario debes indicar hora inicial y final.");
      return;
    }
    if (dateStart && dateEnd && dateEnd < dateStart) {
      setError("La fecha final no puede ser anterior a la fecha inicial.");
      return;
    }

    await onSubmit({
      name: cleanName,
      description: description.trim() || null,
      price: price.trim() === "" ? null : Number(price),
      date_start: dateStart || null,
      date_end: dateEnd || null,
      days_of_week: days.length ? days : null,
      time_start: timeStart || null,
      time_end: timeEnd || null,
      is_active: isActive,
      display_order: Math.max(0, Number(displayOrder) || 0),
    });
  };

  return (
    <div className="fixed inset-0 z-[20000] overflow-y-auto bg-black/40 p-4 sm:p-6">
      <div className="mx-auto my-4 w-full max-w-3xl rounded-3xl bg-white shadow-2xl sm:my-8">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#168e00]">Módulo Menú</p>
            <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Cerrar">
            <X size={22} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-6 p-6">
          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">Nombre *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10" placeholder="Ej. Menú del día" />
            </label>

            <label className="md:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">Descripción</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10" placeholder="Texto opcional para explicar este menú" />
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">Precio general</span>
              <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" placeholder="Opcional" />
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">Orden</span>
              <input type="number" min="0" step="1" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" />
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">Fecha inicial</span>
              <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" />
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">Fecha final</span>
              <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" />
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">Hora inicial</span>
              <input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" />
            </label>

            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">Hora final</span>
              <input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#168e00]" />
            </label>
          </div>

          <div>
            <span className="mb-2 block text-sm font-semibold text-gray-700">Días disponibles</span>
            <div className="flex flex-wrap gap-2">
              {dayOptions.map((day) => {
                const active = days.includes(day.value);
                return (
                  <button key={day.value} type="button" onClick={() => toggleDay(day.value)} className={active ? "rounded-full bg-[#168e00] px-4 py-2 text-sm font-semibold text-white" : "rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:border-[#168e00]/40 hover:text-[#168e00]"}>
                    {day.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-gray-400">Si no eliges días, el menú no tendrá restricción por día.</p>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-gray-200 p-4">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-5 w-5 accent-[#168e00]" />
            <div>
              <p className="font-semibold text-gray-800">Menú activo</p>
              <p className="text-sm text-gray-500">Los menús inactivos no aparecen públicamente.</p>
            </div>
          </label>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
            <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-gray-200 px-5 py-3 font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-semibold text-white hover:bg-[#117500] disabled:opacity-50">
              {saving ? <Loader2 size={18} className="animate-spin" /> : null}
              {menu ? "Guardar cambios" : "Crear menú"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
