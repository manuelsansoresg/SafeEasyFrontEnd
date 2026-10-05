"use client";

import GoogleMapPicker from "@/components/ui/GoogleMapPicker";
import { isValidDeliveryLocation, type DeliveryAddress, type GooglePlaceSelection } from "@/lib/deliveryAddress";
import type { LatLngLiteral } from "@/lib/googleMaps";

type Props = {
  address: DeliveryAddress;
  resolvingAddress: boolean;
  onLocationChange: (location: LatLngLiteral) => void;
  onPlaceChange: (place: GooglePlaceSelection) => void;
  isAuthenticated: boolean;
  saveToProfile: boolean;
  onSaveToProfileChange: (checked: boolean) => void;
  mapHeight?: string;
};

function shortAddressLines(address: DeliveryAddress) {
  const street = [address.address.trim(), address.exterior_number.trim() ? `#${address.exterior_number.trim()}` : ""]
    .filter(Boolean).join(" ");
  const area = [address.city.trim(), address.state.trim(), address.country.trim()].filter(Boolean).join(", ");
  return [street, address.neighborhood.trim(), area].filter(Boolean);
}

export function DeliveryAddressEditor({
  address, resolvingAddress, onLocationChange, onPlaceChange,
  isAuthenticated, saveToProfile, onSaveToProfileChange, mapHeight = "240px",
}: Props) {
  const summary = shortAddressLines(address);

  return (
    <div className="min-w-0 space-y-3">
      <div>
        <p className="text-sm font-bold text-[#004e28]">Dirección de entrega</p>
        {resolvingAddress ? (
          <p className="mt-1 text-sm text-gray-600" role="status">Obteniendo dirección...</p>
        ) : summary.length ? (
          <div className="mt-1 break-words text-sm leading-5 text-gray-700">
            {summary.map((line, index) => <p key={index}>{line}</p>)}
          </div>
        ) : (
          <p className="mt-1 text-sm text-gray-600">
            {isValidDeliveryLocation(address.location)
              ? "No pudimos obtener el nombre de tu dirección. Busca una dirección para continuar."
              : "Selecciona una dirección en el mapa."}
          </p>
        )}
      </div>

      <GoogleMapPicker
        location={address.location}
        onChange={onLocationChange}
        onPlaceChange={onPlaceChange}
        height={mapHeight}
        className="max-w-full"
      />

      <p className="text-xs leading-5 text-gray-500">
        Puedes mover el pin para indicar el punto exacto de entrega.
      </p>

      {isAuthenticated ? (
        <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={saveToProfile} onChange={(event) => onSaveToProfileChange(event.target.checked)} className="mt-1 accent-[#168e00]" />
          <span>Guardar esta dirección en mi perfil al finalizar la compra</span>
        </label>
      ) : null}
    </div>
  );
}
