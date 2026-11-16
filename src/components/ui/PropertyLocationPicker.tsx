"use client";

import { useId, useMemo, useState } from "react";
import { CheckCircle2, MapPin, X } from "lucide-react";
import GoogleMapPicker from "@/components/ui/GoogleMapPicker";
import { validPropertyCoordinates, type PropertyLocation } from "@/lib/propertyLocation";

type Props = {
  value: PropertyLocation | null;
  onChange: (value: PropertyLocation | null) => void;
  disabled?: boolean;
};

export default function PropertyLocationPicker({ value, onChange, disabled }: Props) {
  const addressId = useId();
  const titleId = useId();
  const lat = value?.lat;
  const lng = value?.lng;
  const mapPoint = useMemo(() => lat != null && lng != null ? { lat, lng } : null, [lat, lng]);
  const [selectionError, setSelectionError] = useState("");

  function choosePoint(point: PropertyLocation | null) {
    if (point && !validPropertyCoordinates(point.lat, point.lng)) {
      setSelectionError("Ese punto no es válido. Selecciona otra ubicación en el mapa.");
      return;
    }
    setSelectionError("");
    onChange(point);
  }

  return (
    <section aria-labelledby={titleId} className="col-span-2 min-w-0 space-y-3 rounded-xl border border-gray-200 p-3 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <MapPin size={18} className="text-primary" aria-hidden="true" />
        <h2 id={titleId} className="font-semibold text-primary">Ubicación del inmueble</h2>
        <span className="text-sm text-gray-500">(Opcional)</span>
      </div>
      <p className="text-sm text-gray-600">Busca una dirección y elige una sugerencia para acercarte. Luego toca el mapa para marcar la ubicación exacta del inmueble.</p>
      <GoogleMapPicker
        location={mapPoint}
        readOnly={disabled}
        height="300px"
        previewPlaces
        onChange={(point, source) => choosePoint({ ...point, address: source === "drag" ? value?.address ?? null : null })}
      />
      {selectionError && <p role="alert" className="text-sm text-red-600">{selectionError}</p>}
      {value && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="status" className="min-w-0 flex-1 text-sm text-gray-700">
            <p className="flex items-center gap-2 font-medium text-primary"><CheckCircle2 size={16} /> Punto seleccionado</p>
            <p>{value.lat.toFixed(6)}, {value.lng.toFixed(6)}</p>
          </div>
          <button type="button" disabled={disabled} onClick={() => choosePoint(null)} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
            <X size={16} aria-hidden="true" /> Quitar ubicación
          </button>
        </div>
      )}
      {value && (
        <div className="space-y-1.5">
          <label htmlFor={addressId} className="text-sm font-medium text-gray-700">Dirección del inmueble (opcional)</label>
          <input
            id={addressId}
            type="text"
            maxLength={500}
            disabled={disabled}
            value={value.address ?? ""}
            onChange={(event) => onChange({ ...value, address: event.target.value })}
            placeholder="Calle, número y colonia"
            className="h-11 w-full rounded-xl border border-gray-200 px-4 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}
    </section>
  );
}
