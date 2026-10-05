"use client";

import { useState } from "react";
import GoogleMapPicker from "@/components/ui/GoogleMapPicker";
import type { DeliveryAddress, DeliveryAddressField, GooglePlaceSelection } from "@/lib/deliveryAddress";
import type { LatLngLiteral } from "@/lib/googleMaps";

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

function addressLines(address: DeliveryAddress) {
  const street = [address.address.trim(), address.exterior_number.trim() ? `#${address.exterior_number.trim()}` : ""]
    .filter(Boolean).join(" ");
  const first = [street, address.interior_number.trim() ? `Int. ${address.interior_number.trim()}` : ""]
    .filter(Boolean).join(" · ");
  const locality = [address.cp.trim(), [address.city.trim(), address.state.trim(), address.country.trim()]
    .filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  return [first, address.neighborhood.trim(), locality].filter(Boolean);
}

export function DeliveryAddressEditor({
  address, onFieldChange, onLocationChange, onPlaceChange,
  isAuthenticated, saveToProfile, onSaveToProfileChange, mapHeight = "240px",
}: Props) {
  const [editing, setEditing] = useState(false);
  const [manualStreetEntry, setManualStreetEntry] = useState(false);
  const hasAddress = Boolean(address.address.trim());
  const lines = addressLines(address);
  const showStreet = !hasAddress || manualStreetEntry;
  const showExterior = editing || (hasAddress && !address.exterior_number.trim());

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#004e28]">Dirección de entrega</p>
          {lines.length ? (
            <div className="mt-1 text-sm leading-5 text-gray-700">
              {lines.map((line, index) => <p key={index} className="break-words">{line}</p>)}
            </div>
          ) : (
            <p className="mt-1 text-sm text-gray-500">Busca tu dirección y marca el punto exacto de entrega.</p>
          )}
        </div>
        {hasAddress && !editing ? (
          <button type="button" onClick={() => setEditing(true)} className="shrink-0 text-sm font-semibold text-[#168e00] hover:underline">
            Cambiar dirección
          </button>
        ) : null}
      </div>

      {editing ? (
        <p className="rounded-xl bg-[#f2f3f4] px-3 py-2 text-xs leading-5 text-gray-700">
          Busca otra dirección en el mapa o mueve el pin para ajustar el punto de entrega.
        </p>
      ) : null}

      <GoogleMapPicker
        location={address.location}
        onChange={onLocationChange}
        onPlaceChange={(place) => { onPlaceChange(place); setManualStreetEntry(false); setEditing(false); }}
        height={mapHeight}
        className="max-w-full"
      />
      <p className="text-xs leading-5 text-gray-500">Puedes mover el pin para indicar el punto exacto de entrega.</p>

      {showStreet || showExterior ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {showStreet ? (
            <label className="block min-w-0 text-xs font-semibold text-gray-700">
              Calle o dirección
              <input
                value={address.address}
                onChange={(event) => { setManualStreetEntry(true); onFieldChange("address", event.target.value); }}
                onBlur={() => { if (address.address.trim()) setManualStreetEntry(false); }}
                placeholder="Nombre de la calle"
                autoComplete="street-address"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-900 outline-none focus:border-[#168e00]"
              />
            </label>
          ) : null}
          {showExterior ? (
            <label className="block min-w-0 text-xs font-semibold text-gray-700">
              Número exterior
              <input
                value={address.exterior_number}
                onChange={(event) => onFieldChange("exterior_number", event.target.value)}
                placeholder="Número de la fachada"
                autoComplete="address-line2"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-900 outline-none focus:border-[#168e00]"
              />
            </label>
          ) : null}
        </div>
      ) : null}

      <label className="block max-w-xs text-xs font-semibold text-gray-700">
        No. interior <span className="font-normal text-gray-500">(opcional)</span>
        <input
          value={address.interior_number}
          onChange={(event) => onFieldChange("interior_number", event.target.value)}
          placeholder="Departamento, local o interior"
          autoComplete="off"
          className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-normal text-gray-900 outline-none focus:border-[#168e00]"
        />
      </label>

      {editing ? (
        <button type="button" onClick={() => setEditing(false)} disabled={!address.location || !hasAddress}
          className="w-full rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#137500] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
          Usar esta ubicación
        </button>
      ) : null}

      {isAuthenticated ? (
        <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={saveToProfile} onChange={(event) => onSaveToProfileChange(event.target.checked)} className="mt-1 accent-[#168e00]" />
          <span>Guardar esta dirección en mi perfil al finalizar la compra</span>
        </label>
      ) : null}
    </div>
  );
}
