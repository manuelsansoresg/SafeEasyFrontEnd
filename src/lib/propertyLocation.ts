export type PropertyCoordinates = { lat: number; lng: number };
export type PropertyLocation = PropertyCoordinates & { address: string | null };

export type ProductPropertyLocation = {
  is_real_estate?: boolean;
  property_latitude?: number | null;
  property_longitude?: number | null;
  property_address?: string | null;
};

export function validPropertyCoordinates(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === "number" && Number.isFinite(lng) && lng >= -180 && lng <= 180;
}

export function readPropertyLocation(product?: ProductPropertyLocation): PropertyLocation | null {
  const lat = product?.property_latitude;
  const lng = product?.property_longitude;
  if (lat == null || lng == null || !validPropertyCoordinates(lat, lng)) return null;

  return { lat, lng, address: product?.property_address ?? null };
}

export function appendPropertyLocation(
  payload: FormData,
  location: PropertyLocation | null,
  original?: ProductPropertyLocation,
) {
  if (!location) {
    if (original && [original.property_latitude, original.property_longitude, original.property_address]
      .some((value) => value != null)) {
      payload.append("clear_property_location", "true");
    }
    return;
  }

  if (!validPropertyCoordinates(location.lat, location.lng)) {
    throw new Error("Selecciona un punto válido en el mapa antes de guardar la ubicación.");
  }

  payload.append("property_latitude", String(location.lat));
  payload.append("property_longitude", String(location.lng));
  const address = location.address?.trim();
  if (address || original?.property_address) {
    // The update endpoint treats an explicitly empty address as an address-only removal.
    payload.append("property_address", address ?? "");
  }
}
