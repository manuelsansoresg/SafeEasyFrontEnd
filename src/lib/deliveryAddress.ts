import { parseMapLocation, type LatLngLiteral } from "@/lib/googleMaps";

export type DeliveryAddress = {
  address: string;
  exterior_number: string;
  interior_number: string;
  neighborhood: string;
  cp: string;
  city: string;
  state: string;
  country: string;
  location: LatLngLiteral | null;
};

export type DeliveryAddressField = Exclude<keyof DeliveryAddress, "location">;

export type GooglePlaceSelection = {
  formattedAddress: string;
  location: LatLngLiteral;
  addressComponents: Array<{ long_name: string; short_name: string; types: string[] }>;
};

export const emptyDeliveryAddress = (): DeliveryAddress => ({
  address: "", exterior_number: "", interior_number: "", neighborhood: "",
  cp: "", city: "", state: "", country: "", location: null,
});

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function field(source: Record<string, unknown>, fallback: Record<string, unknown>, keys: string[]) {
  for (const record of [source, fallback]) {
    for (const key of keys) {
      if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
    }
  }
  return "";
}

export function isValidDeliveryLocation(value: LatLngLiteral | null): value is LatLngLiteral {
  return Boolean(value && Number.isFinite(value.lat) && Number.isFinite(value.lng) && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180);
}

export function parseUserDeliveryAddress(value: unknown): DeliveryAddress {
  const record = asRecord(value) ?? {};
  const source = asRecord(record.user) ?? asRecord(record.data) ?? record;
  const location = parseMapLocation(source.map_location ?? record.map_location ?? null);
  return {
    address: field(source, record, ["address", "street"]),
    exterior_number: field(source, record, ["exterior_number", "outdoor_number"]),
    interior_number: field(source, record, ["interior_number", "indoor_number"]),
    neighborhood: field(source, record, ["neighborhood", "colonia"]),
    cp: field(source, record, ["cp", "zip_code", "postal_code"]),
    city: field(source, record, ["city"]),
    state: field(source, record, ["state"]),
    country: field(source, record, ["country"]),
    location: isValidDeliveryLocation(location) ? location : null,
  };
}

export function formatDeliveryAddress(value: DeliveryAddress): string {
  const street = [value.address.trim(), value.exterior_number.trim() ? `#${value.exterior_number.trim()}` : ""]
    .filter(Boolean).join(" ");
  const first = [street, value.interior_number.trim() ? `Int. ${value.interior_number.trim()}` : ""]
    .filter(Boolean).join(" ");
  return [first, value.neighborhood.trim(), value.cp.trim() ? `C.P. ${value.cp.trim()}` : "",
    value.city.trim(), value.state.trim(), value.country.trim()].filter(Boolean).join(", ");
}

export function deliveryAddressChanged(initial: DeliveryAddress, current: DeliveryAddress) {
  const fields: DeliveryAddressField[] = ["address", "exterior_number", "interior_number", "neighborhood", "cp", "city", "state", "country"];
  if (fields.some((key) => initial[key].trim() !== current[key].trim())) return true;
  if (!initial.location || !current.location) return initial.location !== current.location;
  return Math.abs(initial.location.lat - current.location.lat) > 0.000001 ||
    Math.abs(initial.location.lng - current.location.lng) > 0.000001;
}

export function addressFromGooglePlace(place: GooglePlaceSelection): DeliveryAddress {
  const component = (...types: string[]) => place.addressComponents.find((part) => types.some((type) => part.types.includes(type)))?.long_name ?? "";
  return {
    address: component("route") || place.formattedAddress,
    exterior_number: component("street_number"),
    interior_number: "",
    neighborhood: component("neighborhood", "sublocality_level_1", "sublocality"),
    cp: component("postal_code"),
    city: component("locality", "postal_town", "administrative_area_level_2"),
    state: component("administrative_area_level_1"),
    country: component("country"),
    location: place.location,
  };
}
