"use client";

import { useState } from "react";
import GoogleMapPicker from "@/components/ui/GoogleMapPicker";
import { formatDeliveryAddress, type DeliveryAddress, type DeliveryAddressField, type GooglePlaceSelection } from "@/lib/deliveryAddress";
import type { LatLngLiteral } from "@/lib/googleMaps";

const fields: Array<{ key: DeliveryAddressField; label: string; placeholder: string; wide?: boolean }> = [
  { key: "address", label: "Calle", placeholder: "Calle y nombre", wide: true },
  { key: "exterior_number", label: "No. exterior", placeholder: "331" },
  { key: "interior_number", label: "No. interior", placeholder: "Opcional" },
  { key: "cp", label: "C.P.", placeholder: "97149" },
  { key: "neighborhood", label: "Colonia", placeholder: "Colonia" },
  { key: "city", label: "Ciudad", placeholder: "Ciudad" },
  { key: "state", label: "Estado", placeholder: "Estado" },
  { key: "country", label: "País", placeholder: "País" },
];

type Props = {
  address: DeliveryAddress;
  onFieldChange: (field: DeliveryAddressField, value: string) => void;
  onLocationChange: (location: LatLngLiteral) => void;
  onPlaceChange: (place: GooglePlaceSelection) => void;
  isAuthenticated: boolean;
  saveToProfile: boolean;
  onSaveToProfileChange: (checked: boolean) => void;
  mapHeight?: string;
};

export function DeliveryAddressEditor({
  address, onFieldChange, onLocationChange, onPlaceChange,
  isAuthenticated, saveToProfile, onSaveToProfileChange, mapHeight = "240px",
}: Props) {
  const [editing, setEditing] = useState(false);
  const showFields = editing || !address.address.trim();
  const summary = formatDeliveryAddress(address);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-800">Dirección de entrega</p>
          {summary ? <p className="mt-1 text-sm leading-5 text-gray-600">{summary}</p> : <p className="mt-1 text-sm text-gray-500">Agrega tu dirección y marca el punto exacto.</p>}
        </div>
        {address.address.trim() ? (
          <button type="button" onClick={() => setEditing((value) => !value)} className="shrink-0 text-sm font-semibold text-[#168e00] hover:underline">
            {showFields ? "Ocultar campos" : "Cambiar dirección"}
          </button>
        ) : null}
      </div>

      {showFields ? (
        <div className="grid grid-cols-2 gap-3 rounded-2xl bg-[#f2f3f4] p-3 sm:grid-cols-4">
          {fields.map((field) => (
            <label key={field.key} className={`min-w-0 text-xs font-semibold text-gray-700 ${field.wide ? "col-span-2" : ""}`}>
              {field.label}
              <input
                value={address[field.key]}
                onChange={(event) => onFieldChange(field.key, event.target.value)}
                placeholder={field.placeholder}
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-900 outline-none focus:border-[#168e00]"
              />
            </label>
          ))}
        </div>
      ) : null}

      <p className="text-xs text-gray-500">Puedes buscar una dirección o ajustar el punto exacto en el mapa. Editar los campos no mueve el pin.</p>
      <GoogleMapPicker
        location={address.location}
        onChange={onLocationChange}
        onPlaceChange={(place) => { setEditing(true); onPlaceChange(place); }}
        height={mapHeight}
        className="max-w-full"
      />

      {isAuthenticated ? (
        <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={saveToProfile} onChange={(event) => onSaveToProfileChange(event.target.checked)} className="mt-1 accent-[#168e00]" />
          <span>Guardar esta dirección en mi perfil al finalizar la compra</span>
        </label>
      ) : null}
    </div>
  );
}
