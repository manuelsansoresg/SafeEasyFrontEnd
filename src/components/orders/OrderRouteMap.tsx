"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, MapPin } from "lucide-react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLngLiteral } from "@/lib/googleMaps";

type DeliveryTypeKey = "shipping" | "pickup";
type RoutePoint = [number, number];
type GeocodeHit = { lat?: string; lon?: string };

const DEFAULT_CENTER: RoutePoint = [20.9674, -89.5926];
const geocodeCache = new Map<string, LatLngLiteral | null>();

const tileAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

function toPoint(value?: LatLngLiteral | null): RoutePoint | null {
  if (!value || !Number.isFinite(value.lat) || !Number.isFinite(value.lng)) return null;
  return [value.lat, value.lng];
}

function makeMarkerIcon(color: string, ringColor: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:30px;height:30px;border-radius:9999px;background:${ringColor};box-shadow:0 12px 24px rgba(15,23,42,.24);padding:6px;"><span style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:4px solid white;"></span></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function normalizeAddressQuery(value: string) {
  return value
    .replace(/ᶜ/g, "c")
    .replace(/C\.\s*/gi, "Calle ")
    .replace(/Yuc\./gi, "Yucatán")
    .replace(/México/gi, "Mexico")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueQueries(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildGeocodeQueries(address: string) {
  const normalized = normalizeAddressQuery(address);
  const postalCode = normalized.match(/\b\d{5}\b/)?.[0] || "";
  const parts = normalized.split(",").map((part) => part.trim()).filter(Boolean);
  const cityPart = parts.find((part) => /m[eé]rida/i.test(part)) || "Mérida";
  const statePart = parts.find((part) => /yucat[aá]n/i.test(part)) || "Yucatán";
  const streetNumber = normalized.match(/(?:calle\s*)?(\d+)\s*([a-z])\s+(\d+)/i);
  const streetVariants = streetNumber
    ? [
        `Calle ${streetNumber[1]}${streetNumber[2]} ${streetNumber[3]}, ${postalCode}, ${cityPart}, ${statePart}, Mexico`,
        `Calle ${streetNumber[1]}-${streetNumber[2]} ${streetNumber[3]}, ${postalCode}, ${cityPart}, ${statePart}, Mexico`,
        `Calle ${streetNumber[1]} ${streetNumber[2]} ${streetNumber[3]}, ${postalCode}, ${cityPart}, ${statePart}, Mexico`,
      ]
    : [];

  return uniqueQueries([
    normalized,
    ...streetVariants,
    postalCode ? `${postalCode}, ${cityPart}, ${statePart}, Mexico` : "",
    `${cityPart}, ${statePart}, Mexico`,
  ]);
}

async function fetchFirstGeocodeHit(query: string, signal: AbortSignal): Promise<LatLngLiteral | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=mx&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  const data: unknown = await res.json();
  const first = Array.isArray(data) ? (data[0] as GeocodeHit | undefined) : undefined;
  const lat = Number(first?.lat);
  const lng = Number(first?.lon);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

async function geocodeAddress(address: string, signal: AbortSignal): Promise<LatLngLiteral | null> {
  const query = address.trim();
  if (!query) return null;

  const cacheKey = query.toLowerCase();
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey) ?? null;

  for (const candidate of buildGeocodeQueries(query)) {
    const coords = await fetchFirstGeocodeHit(candidate, signal);
    if (coords) {
      geocodeCache.set(cacheKey, coords);
      return coords;
    }
  }

  geocodeCache.set(cacheKey, null);
  return null;
}

async function resolvePoint(
  coordinates: LatLngLiteral | null | undefined,
  address: string | undefined,
  signal: AbortSignal,
): Promise<LatLngLiteral | null> {
  if (coordinates) return coordinates;
  if (!address) return null;
  return geocodeAddress(address, signal);
}

function FitMap({ points }: { points: RoutePoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points, { padding: [44, 44], maxZoom: 15 });
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [map, points]);

  return null;
}

export default function OrderRouteMap({
  mode,
  label,
  origin,
  destination,
  originAddress,
  destinationAddress,
}: {
  mode: DeliveryTypeKey;
  label: string;
  origin?: LatLngLiteral | null;
  destination?: LatLngLiteral | null;
  originAddress?: string;
  destinationAddress?: string;
}) {
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [resolvedOrigin, setResolvedOrigin] = useState<LatLngLiteral | null>(null);
  const [resolvedDestination, setResolvedDestination] = useState<LatLngLiteral | null>(null);
  const [loading, setLoading] = useState(false);

  const originPoint = useMemo(() => toPoint(resolvedOrigin), [resolvedOrigin]);
  const destinationPoint = useMemo(() => toPoint(resolvedDestination), [resolvedDestination]);
  const markerPoint = destinationPoint || originPoint;
  const primaryPoint = markerPoint || DEFAULT_CENTER;
  const isShipping = mode === "shipping";
  const originLat = origin?.lat;
  const originLng = origin?.lng;
  const destinationLat = destination?.lat;
  const destinationLng = destination?.lng;

  useEffect(() => {
    const controller = new AbortController();

    async function resolveAndFetchRoute() {
      setLoading(true);
      try {
        const originCoordinates = Number.isFinite(originLat) && Number.isFinite(originLng)
          ? { lat: Number(originLat), lng: Number(originLng) }
          : null;
        const destinationCoordinates = Number.isFinite(destinationLat) && Number.isFinite(destinationLng)
          ? { lat: Number(destinationLat), lng: Number(destinationLng) }
          : null;

        if (!isShipping) {
          const pickupPoint = await resolvePoint(
            originCoordinates || destinationCoordinates,
            originAddress || destinationAddress || label,
            controller.signal,
          );
          setResolvedOrigin(pickupPoint);
          setResolvedDestination(null);
          setRoute([]);
          return;
        }

        const [nextOrigin, nextDestination] = await Promise.all([
          resolvePoint(originCoordinates, originAddress, controller.signal),
          resolvePoint(destinationCoordinates, destinationAddress || label, controller.signal),
        ]);

        setResolvedOrigin(nextOrigin);
        setResolvedDestination(nextDestination);

        if (!nextOrigin || !nextDestination) {
          setRoute([]);
          return;
        }

        const url = `https://router.project-osrm.org/route/v1/driving/${nextOrigin.lng},${nextOrigin.lat};${nextDestination.lng},${nextDestination.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json();
        const coordinates = data?.routes?.[0]?.geometry?.coordinates;
        if (!Array.isArray(coordinates)) {
          setRoute([]);
          return;
        }
        setRoute(coordinates.map(([lng, lat]: [number, number]) => [lat, lng]));
      } catch {
        if (!controller.signal.aborted) setRoute([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    resolveAndFetchRoute();
    return () => controller.abort();
  }, [destinationAddress, destinationLat, destinationLng, isShipping, label, originAddress, originLat, originLng]);

  const visiblePoints = useMemo(() => {
    if (route.length > 1) return route;
    return [originPoint, destinationPoint].filter(Boolean) as RoutePoint[];
  }, [destinationPoint, originPoint, route]);

  const googleMapsUrl = useMemo(() => {
    const target = isShipping ? resolvedDestination : resolvedOrigin || resolvedDestination;
    if (target && Number.isFinite(target.lat) && Number.isFinite(target.lng)) {
      return `https://www.google.com/maps/search/?api=1&query=${target.lat},${target.lng}`;
    }

    const query = isShipping ? destinationAddress || label : originAddress || label;
    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : "";
  }, [destinationAddress, isShipping, label, originAddress, resolvedDestination, resolvedOrigin]);

  const openGoogleMaps = () => {
    if (!googleMapsUrl) return;
    window.open(googleMapsUrl, "_blank", "noopener,noreferrer");
  };

  const destinationIcon = useMemo(() => makeMarkerIcon("#16a34a", "rgba(22,163,74,.22)"), []);
  const originIcon = useMemo(() => makeMarkerIcon("#64748b", "rgba(100,116,139,.2)"), []);
  const mapStatus = !isShipping && markerPoint
    ? "Ubicación de la tienda"
    : route.length > 1
      ? "Ruta calculada"
      : loading
        ? isShipping ? "Calculando ruta" : "Cargando ubicación"
        : markerPoint
          ? "Ruta no disponible"
          : "Coordenadas no disponibles";

  return (
    <div className="relative isolate z-0 h-[360px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#eef2ed] shadow-[0_16px_36px_rgba(15,23,42,.08)] lg:h-[420px]">
      <MapContainer center={primaryPoint} zoom={13} zoomControl={false} scrollWheelZoom={false} className="order-route-map h-full w-full">
        <TileLayer
          attribution={tileAttribution}
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        <FitMap points={visiblePoints.length ? visiblePoints : [primaryPoint]} />

        {route.length > 1 ? (
          <>
            <Polyline positions={route} pathOptions={{ color: "#ffffff", weight: 11, opacity: 0.95 }} />
            <Polyline positions={route} pathOptions={{ color: "#1a73e8", weight: 6, opacity: 0.95 }} />
          </>
        ) : null}

        {isShipping && originPoint ? (
          <Marker position={originPoint} icon={originIcon}>
            <Popup>{originAddress || "Proveedor"}</Popup>
          </Marker>
        ) : null}

        {markerPoint ? (
          <Marker position={markerPoint} icon={destinationIcon}>
            <Popup>{isShipping ? label : originAddress || label}</Popup>
          </Marker>
        ) : null}
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-white/35 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-36 bg-gradient-to-t from-slate-950/18 to-transparent" />

      <button
        type="button"
        onClick={openGoogleMaps}
        disabled={!googleMapsUrl}
        className="absolute right-3 top-3 z-[1000] inline-flex items-center gap-2 rounded-full border border-[#004e28]/15 bg-white px-3 py-2 text-xs font-bold text-[#004e28] shadow-[0_10px_24px_rgba(15,23,42,.22)] transition-colors hover:bg-[#f2f3f4] disabled:cursor-not-allowed disabled:opacity-60"
        aria-label={isShipping ? "Abrir dirección del cliente en Google Maps" : "Abrir punto de recolección en Google Maps"}
        title={isShipping ? "Abrir dirección del cliente en Google Maps" : "Abrir punto de recolección en Google Maps"}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Abrir en Maps
      </button>

      <div className="absolute bottom-4 left-4 right-4 z-20 sm:right-auto sm:max-w-[360px]">
        <div className="rounded-2xl border border-white/80 bg-white/95 px-4 py-3 shadow-[0_14px_32px_rgba(15,23,42,.18)] backdrop-blur">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <MapPin className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                {isShipping ? "Dirección de entrega" : "Punto de recolección"}
              </div>
              <div className="mt-1 truncate text-sm font-semibold text-slate-900">{label}</div>
              <div className="mt-1 text-xs text-slate-500">{mapStatus}</div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm backdrop-blur">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {isShipping ? "Calculando ruta" : "Cargando ubicación"}
        </div>
      ) : null}

      <style jsx global>{`
        .order-route-map .leaflet-tile-pane {
          filter: saturate(0.82) contrast(0.96) brightness(1.04);
        }

        .order-route-map .leaflet-control-attribution {
          border-top-left-radius: 10px;
          background: rgba(255, 255, 255, 0.86);
          color: #64748b;
          font-size: 10px;
        }
      `}</style>
    </div>
  );
}
