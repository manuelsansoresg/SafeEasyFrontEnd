"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import { shippingSettingsService, type SupplierShippingSettings as Settings } from "@/services/shippingSettingsService";

const inputClass = "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 focus:border-[#168e00] focus:outline-none focus:ring-2 focus:ring-[#168e00]/20 disabled:cursor-not-allowed disabled:bg-[#f2f3f4]";
const money = (value: string | number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value));

export function SupplierShippingSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [distance, setDistance] = useState("");
  const [cost, setCost] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const apply = useCallback((data: Settings) => {
    setSettings(data);
    setDistance(String(data.min_distance_km ?? data.effective_min_distance_km));
    setCost(String(data.extra_cost_per_km ?? data.effective_extra_cost_per_km));
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const data = await shippingSettingsService.getMine(signal);
      if (!signal?.aborted) apply(data);
    } catch (err) {
      if (!signal?.aborted) {
        setSettings(null);
        setError(err instanceof Error ? err.message : "No se pudieron cargar las tarifas.");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings?.allow_provider_shipping_configuration || saving) return;
    setError("");
    setMessage("");
    const min = Number(distance);
    const extra = Number(cost);
    if (!/^\d+$/.test(distance) || !Number.isInteger(min) || min < 0 || min > 1000) {
      setError("La distancia mínima debe ser un número entero entre 0 y 1000 km.");
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(cost) || !Number.isFinite(extra) || extra < 0 || extra > 100000) {
      setError("El costo debe estar entre $0 y $100,000 MXN y tener como máximo dos decimales.");
      return;
    }
    setSaving(true);
    try {
      apply(await shippingSettingsService.saveMine({ min_distance_km: min, extra_cost_per_km: extra }));
      setMessage("Configuración de envío guardada correctamente.");
    } catch (err) {
      const failure = err instanceof Error ? err.message : "No se pudo guardar la configuración.";
      // Re-read permission and persisted values, including after an uncertain network failure.
      try {
        apply(await shippingSettingsService.getMine());
      } catch {
        setSettings(null);
      }
      setError(failure);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5" aria-busy={loading || saving}>
      {loading ? <p role="status" className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={18} className="animate-spin" aria-hidden="true" />Cargando configuración de envío…</p> : null}
      {error ? <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error} <button type="button" disabled={loading || saving} onClick={() => void load()} className="min-h-11 font-semibold underline">Volver a cargar</button></div> : null}
      {message ? <p role="status" className="flex items-center gap-2 rounded-xl bg-green-50 p-4 text-sm text-[#168e00]"><CheckCircle size={18} aria-hidden="true" />{message}</p> : null}
      {!loading && settings ? <>
        <div className="space-y-2 rounded-xl bg-[#f2f3f4] p-4 text-sm leading-6">
          <p className="font-medium text-[#004e28]">{!settings.allow_provider_shipping_configuration ? "Los costos de envío son administrados actualmente por Drooopy." : settings.source === "global" ? "Actualmente utilizas las tarifas predeterminadas de Drooopy. Los valores del formulario no se guardan como configuración individual hasta que presiones Guardar configuración." : "Tu negocio utiliza su configuración individual de envío."}</p>
          <p className="text-gray-600">Tarifa vigente: distancia mínima de {settings.effective_min_distance_km} km y {money(settings.effective_extra_cost_per_km)} por kilómetro.</p>
          {!settings.allow_provider_shipping_configuration && settings.min_distance_km !== null && settings.extra_cost_per_km !== null ? <p className="text-gray-600">Tu configuración guardada ({settings.min_distance_km} km y {money(settings.extra_cost_per_km)} por kilómetro) se conserva para cuando Drooopy vuelva a permitir tarifas individuales.</p> : null}
        </div>
        {settings.allow_provider_shipping_configuration ? <form onSubmit={save} className="space-y-5">
          <fieldset disabled={saving} className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="supplier-shipping-distance" className="text-sm font-medium text-black">Distancia Mínima de Cobro (km)</label>
              <input id="supplier-shipping-distance" type="number" inputMode="numeric" min={0} max={1000} step={1} required value={distance} onChange={(event) => { setDistance(event.target.value); setMessage(""); }} aria-describedby="supplier-shipping-distance-help" className={inputClass} />
              <p id="supplier-shipping-distance-help" className="text-xs leading-5 text-gray-500">Distancia mínima utilizada para calcular el costo de envío. Si el recorrido es menor, se cobrará como mínimo la distancia configurada.</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="supplier-shipping-cost" className="text-sm font-medium text-black">Costo Extra por Kilómetro (MXN)</label>
              <input id="supplier-shipping-cost" type="number" inputMode="decimal" min={0} max={100000} step="0.01" required value={cost} onChange={(event) => { setCost(event.target.value); setMessage(""); }} aria-describedby="supplier-shipping-cost-help" className={inputClass} />
              <p id="supplier-shipping-cost-help" className="text-xs leading-5 text-gray-500">Importe que se cobra por cada kilómetro, respetando la distancia mínima configurada.</p>
            </div>
          </fieldset>
          <div className="border-t border-gray-100 pt-5 sm:flex sm:justify-end">
            <button type="submit" disabled={saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#168e00] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#004e28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">{saving ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <CheckCircle size={18} aria-hidden="true" />}{saving ? "Guardando…" : "Guardar configuración"}</button>
          </div>
        </form> : null}
      </> : null}
    </div>
  );
}
