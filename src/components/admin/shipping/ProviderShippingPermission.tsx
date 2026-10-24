"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Loader2 } from "lucide-react";
import { shippingSettingsService } from "@/services/shippingSettingsService";

export function ProviderShippingPermission() {
  const id = useId();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setBusy(true);
    setError("");
    try {
      const value = await shippingSettingsService.getPermission(signal);
      if (!signal?.aborted) setAllowed(value);
    } catch (err) {
      if (!signal?.aborted) {
        setAllowed(null);
        setError(err instanceof Error ? err.message : "No se pudo cargar el permiso.");
      }
    } finally {
      if (!signal?.aborted) setBusy(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const toggle = async () => {
    if (allowed === null || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      setAllowed(await shippingSettingsService.setPermission(!allowed));
      setMessage("Permiso de tarifas por proveedor guardado correctamente.");
    } catch (err) {
      // A lost response may follow a committed write. Reconcile with the server.
      const failure = err instanceof Error ? err.message : "No se pudo guardar el permiso.";
      try {
        setAllowed(await shippingSettingsService.getPermission());
      } catch {
        setAllowed(null);
      }
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-gray-100 pt-5" aria-busy={busy}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p id={`${id}-label`} className="text-sm font-semibold text-[#004e28]">Permitir que los proveedores configuren sus costos de envío</p>
          <p id={`${id}-description`} className="max-w-3xl text-sm leading-6 text-gray-500">Cuando esta opción está activada, cada proveedor puede establecer sus propias tarifas de envío. Si está desactivada, todos los negocios utilizan las tarifas configuradas por el administrador.</p>
        </div>
        {allowed === null ? <span className="mt-1 flex h-7 w-12 shrink-0 items-center justify-center text-gray-500">{busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : "—"}</span> : <button type="button" role="switch" aria-checked={allowed === true} aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`} disabled={busy || allowed === null} onClick={() => void toggle()} className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${allowed ? "bg-[#168e00]" : "bg-gray-300"}`}>
          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm transition-transform ${allowed ? "translate-x-6" : "translate-x-1"}`}>{busy ? <Loader2 size={12} className="animate-spin text-[#004e28]" aria-hidden="true" /> : null}</span>
        </button>}
      </div>
      <p className="text-xs text-gray-500" role="status">{busy ? "Consultando o guardando permiso…" : allowed === null ? "Estado sin confirmar." : allowed ? "Activado · Cada proveedor puede guardar sus tarifas." : "Desactivado · Se utilizan las tarifas de Drooopy."}</p>
      {message ? <p role="status" className="text-sm text-[#168e00]">{message}</p> : null}
      {error ? <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error} <button type="button" disabled={busy} onClick={() => void load()} className="min-h-11 font-semibold underline">Volver a consultar</button></div> : null}
    </div>
  );
}
