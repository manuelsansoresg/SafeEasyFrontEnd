"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Palette } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
import { resolveSupplierTheme, type SupplierThemeSource } from "@/lib/supplierTheme";

const fields = [
  { key: "primary_color", theme: "primary", label: "Color principal" },
  { key: "header_background_color", theme: "headerBackground", label: "Fondo del encabezado" },
  { key: "page_background_color", theme: "pageBackground", label: "Fondo general" },
  { key: "card_background_color", theme: "cardBackground", label: "Fondo de tarjetas" },
] as const;

export function SupplierPaletteEditor({ supplier, onSaved }: {
  supplier: SupplierThemeSource & { id: number };
  onSaved: () => Promise<void>;
}) {
  const effective = resolveSupplierTheme(supplier);
  const [colors, setColors] = useState(effective);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dirty = fields.some(({ theme }) => colors[theme].toLowerCase() !== effective[theme].toLowerCase());

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dirty || saving) return;
    setMessage("");
    setError("");
    if (fields.some(({ theme }) => !/^#[0-9a-f]{6}$/i.test(colors[theme]))) {
      setError("Utiliza colores con formato hexadecimal, por ejemplo #175d9d.");
      return;
    }
    setSaving(true);
    try {
      const body = new FormData();
      for (const { key, theme } of fields) {
        if (colors[theme].toLowerCase() !== effective[theme].toLowerCase()) body.append(key, colors[theme]);
      }
      const response = await fetchWithAuth(`/api/suppliers/${supplier.id}`, { method: "PUT", body });
      if (!response.ok) throw new Error("No se pudo guardar la paleta. Revisa tus permisos e inténtalo de nuevo.");
      const payload = await response.json();
      const confirmed = payload?.supplier ?? payload?.data ?? payload;
      if (fields.some(({ key, theme }) => body.has(key) && String(confirmed?.[key] ?? "").toLowerCase() !== colors[theme].toLowerCase())) {
        throw new Error("El servidor no confirmó los colores enviados. Recarga el proveedor para revisar los valores guardados.");
      }
      await onSaved();
      setMessage("Paleta guardada correctamente.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo guardar la paleta.");
    } finally {
      setSaving(false);
    }
  }

  return <form onSubmit={save} className="mb-8 border-b border-gray-100 pb-8">
    <h3 className="flex items-center gap-2 font-semibold text-[#004e28]"><Palette size={19} aria-hidden="true" />Paleta de colores</h3>
    <p className="mt-2 text-sm leading-6 text-gray-500">Estos colores se aplican al portal público. Si aún no has personalizado la paleta, mostramos los colores originales de Drooopy sin guardarlos automáticamente.</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      {fields.map(({ key, theme, label }) => <div key={key}>
        <label htmlFor={`palette-${supplier.id}-${key}`} className="mb-2 block text-sm font-medium text-gray-700">{label}</label>
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2">
          <input type="color" aria-label={`Seleccionar ${label.toLowerCase()}`} value={/^#[0-9a-f]{6}$/i.test(colors[theme]) ? colors[theme] : effective[theme]} onChange={e => setColors(current => ({ ...current, [theme]: e.target.value }))} disabled={saving} className="h-9 w-10 shrink-0 cursor-pointer bg-transparent" />
          <input id={`palette-${supplier.id}-${key}`} value={colors[theme]} maxLength={7} onChange={e => setColors(current => ({ ...current, [theme]: e.target.value }))} disabled={saving} spellCheck={false} className="min-w-0 flex-1 bg-transparent py-1 text-sm text-gray-800 outline-none focus-visible:ring-2 focus-visible:ring-[#168e00]" />
        </div>
      </div>)}
    </div>
    <button type="submit" disabled={!dirty || saving} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#004e28] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#168e00] disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}{saving ? "Guardando…" : "Guardar colores"}</button>
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    {message ? <p role="status" className="mt-3 text-sm text-[#004e28]">{message}</p> : null}
  </form>;
}
