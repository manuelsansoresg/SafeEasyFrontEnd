"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { BriefcaseBusiness, Check, Loader2, X } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
import type { BusinessTypePublic } from "@/types/businessType";

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return `${base.replace(/\/$/, "")}${path}`;
};

function listItems(payload: unknown): BusinessTypePublic[] {
  if (Array.isArray(payload)) return payload as BusinessTypePublic[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const items = record.items ?? record.results ?? record.data ?? record.business_types;
    if (Array.isArray(items)) return items as BusinessTypePublic[];
  }
  return [];
}

async function responseMessage(response: Response) {
  const payload: unknown = await response.json().catch(() => null);
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const detail = record.detail ?? record.message;
    if (typeof detail === "string") return detail;
  }
  return "No se pudo actualizar el tipo de negocio. Inténtalo de nuevo.";
}

export function BusinessTypePickerModal({ supplierId, currentId, onClose, onSaved }: {
  supplierId: number;
  currentId: number | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [options, setOptions] = useState<BusinessTypePublic[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(currentId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

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
      setError("");
      try {
        const response = await fetchWithAuth(apiUrl("/business-types"), {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await responseMessage(response));
        const payload: unknown = await response.json();
        if (!controller.signal.aborted) {
          setOptions(listItems(payload).filter((item) => item.is_active === true));
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("No se pudieron cargar los tipos de negocio.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  function close() {
    if (!saving) onClose();
  }

  async function save() {
    if (selectedId === null || selectedId === currentId || saving) return;
    if (currentId !== null && !confirming) {
      setConfirming(true);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("business_type_id", String(selectedId));
      const response = await fetchWithAuth(apiUrl(`/suppliers/${supplierId}`), {
        method: "PUT",
        body: formData,
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      await onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo actualizar el tipo de negocio.");
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="business-type-picker-title" onCancel={(event) => { event.preventDefault(); close(); }}
      className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-2xl border border-gray-100 bg-white p-0 shadow-xl backdrop:bg-black/40">
      <div className="flex max-h-[90dvh] flex-col">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 p-5 sm:p-6">
          <div>
            <h2 id="business-type-picker-title" className="font-[family-name:var(--font-varela-round)] text-xl text-[#004e28]">Selecciona tu tipo de negocio</h2>
            <p className="mt-1 text-sm text-gray-600">Elige la opción que mejor describe tu negocio.</p>
          </div>
          <button type="button" disabled={saving} onClick={close} aria-label="Cerrar" className="shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {loading ? <p role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500"><Loader2 size={20} className="animate-spin text-[#168e00]" />Cargando tipos de negocio...</p>
            : error && options.length === 0 ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
            : options.length === 0 ? <p className="rounded-xl bg-gray-50 p-5 text-center text-sm text-gray-500">No hay tipos de negocio disponibles.</p>
            : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {options.map((option) => {
                const selected = selectedId === option.id;
                return <button key={option.id} type="button" aria-pressed={selected} disabled={saving} onClick={() => { setSelectedId(option.id); setConfirming(false); setError(""); }} className={`relative flex min-h-24 items-center gap-3 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00] focus-visible:ring-offset-2 ${selected ? "border-[#168e00] bg-[#168e00]/[0.06] shadow-sm" : "border-gray-200 bg-white hover:border-[#168e00]/40 hover:bg-[#fbfdfb]"}`}>
                  <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                    {option.icon_url ? <Image src={option.icon_url} alt="" fill sizes="48px" className="object-contain p-1.5" /> : <BriefcaseBusiness size={22} className="text-gray-400" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1 break-words text-sm font-semibold text-gray-900">{option.name}</span>
                  {selected ? <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#168e00] text-white"><Check size={13} aria-hidden="true" /></span> : null}
                </button>;
              })}
            </div>}

          {confirming ? <div role="alert" className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-gray-900">¿Cambiar el tipo de negocio?</p>
            <p className="mt-1 text-sm leading-6 text-gray-700">Este cambio puede modificar las categorías disponibles para tus productos o servicios.</p>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" disabled={saving} onClick={() => setConfirming(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancelar</button>
              <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#004e28] disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : null}{saving ? "Guardando..." : "Cambiar tipo"}</button>
            </div>
          </div> : null}
          {error && options.length > 0 ? <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        </div>

        {!loading && options.length > 0 && !confirming ? <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-gray-100 p-5 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" disabled={saving} onClick={close} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
          <button type="button" disabled={saving || selectedId === null || selectedId === currentId} onClick={() => void save()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#004e28] disabled:cursor-not-allowed disabled:opacity-50">Guardar tipo</button>
        </div> : null}
      </div>
    </dialog>
  );
}
