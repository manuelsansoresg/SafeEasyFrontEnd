import { fetchWithAuth } from "@/lib/api";
import { parseMapLocation, type LatLngLiteral } from "@/lib/googleMaps";
import type { Order } from "@/services/orderService";

type LocationDetails = {
  address: string;
  coordinates: LatLngLiteral | null;
  acceptsCourier: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function isCoordinateLikeString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(trimmed)) return true;
  try {
    const parsed = JSON.parse(trimmed);
    return Boolean(parseMapLocation(parsed));
  } catch {
    return false;
  }
}

function pickAddressText(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed && !isCoordinateLikeString(trimmed) ? trimmed : "";
}

function buildAddressFromRecord(record: Record<string, unknown>) {
  const parts = [
    pickString(record, ["address", "street"]),
    pickString(record, ["exterior_number", "external_number", "number"]),
    pickString(record, ["interior_number"]) ? `Int. ${pickString(record, ["interior_number"])}` : "",
    pickString(record, ["neighborhood", "colonia"]),
    pickString(record, ["cp", "zip_code", "postal_code"]),
    pickString(record, ["city"]),
    pickString(record, ["state"]),
    pickString(record, ["country"]),
  ].filter(Boolean);

  return parts.join(", ");
}

export function extractCoordinates(value: unknown): LatLngLiteral | null {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      return parseMapLocation(JSON.parse(value));
    } catch {
      return parseMapLocation(value);
    }
  }

  const record = asRecord(value);
  if (!record) return null;

  const nested = record.map_location || record.location || record.coordinates || null;
  if (nested) return parseMapLocation(nested);

  const lat = Number(record.lat ?? record.latitude);
  const lng = Number(record.lng ?? record.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export function getBuyerAddress(order: Order) {
  const record = order as unknown as Record<string, unknown>;
  const raw = pickString(record, ["buyer_address", "delivery_address", "shipping_address", "address"]);
  if (raw) return raw;

  const buyer = asRecord(record.buyer);
  return buyer ? buildAddressFromRecord(buyer) : "";
}

export function getSupplierAddress(order: Order) {
  const record = order as unknown as Record<string, unknown>;
  const raw = pickString(record, ["pickup_address", "supplier_address", "store_address"]);
  if (raw) return raw;

  const supplier = asRecord(record.supplier);
  if (!supplier) return "";

  const mapAddress = pickAddressText(supplier.map_location || supplier.location);
  if (mapAddress) return mapAddress;

  return buildAddressFromRecord(supplier) || pickString(supplier, ["name"]);
}

export function getOrderBuyerCoordinates(order: Order) {
  const record = order as unknown as Record<string, unknown>;
  const deliveryAddress = asRecord(record.delivery_address);
  const deliveryAddressCoords = deliveryAddress
    ? extractCoordinates(deliveryAddress.location || deliveryAddress.map_location || deliveryAddress.coordinates)
    : null;
  const buyer = asRecord(record.buyer);
  if (buyer) {
    const coords = extractCoordinates(buyer.map_location || buyer.location || buyer.coordinates);
    if (coords) return coords;
  }

  return (
    extractCoordinates(record.dropoff) ||
    deliveryAddressCoords ||
    extractCoordinates(
      record.buyer_map_location ||
      record.buyerLocation ||
      record.delivery_location ||
      record.shipping_location ||
      record.map_location,
    )
  );
}

export function getOrderSupplierCoordinates(order: Order) {
  const record = order as unknown as Record<string, unknown>;
  const orderPickup = extractCoordinates(record.pickup);
  if (orderPickup) return orderPickup;

  const supplier = asRecord(record.supplier);
  if (supplier) {
    const coords = extractCoordinates(supplier.map_location || supplier.location || supplier.coordinates);
    if (coords) return coords;
  }

  return extractCoordinates(record.supplier_map_location || record.supplierLocation || record.supplier_location);
}

export async function fetchSupplierLocation(supplierId: number): Promise<LocationDetails> {
  const urls = [`/api/suppliers/${supplierId}`, `/api/suppliers/${supplierId}/`, `/api/v1/suppliers/${supplierId}`, `/api/v1/suppliers/${supplierId}/`];

  for (const url of urls) {
    const res = await fetchWithAuth(url, { headers: { Accept: "application/json" } }).catch(() => null);
    if (!res || !res.ok) continue;

    const data: unknown = await res.json().catch(() => null);
    const record = asRecord(data) || {};
    const nested = asRecord(record.supplier) || asRecord(record.data) || record;
    const mapAddress = pickAddressText(nested.map_location || nested.location);
    const acceptsCourierRaw = nested.accepts_courier;
    const acceptsCourier = typeof acceptsCourierRaw === "boolean" ? acceptsCourierRaw : false;

    return {
      address: mapAddress || buildAddressFromRecord(nested) || pickString(nested, ["name"]),
      coordinates: extractCoordinates(nested.map_location || nested.location || nested.coordinates),
      acceptsCourier,
    };
  }

  return { address: "", coordinates: null, acceptsCourier: false };
}
