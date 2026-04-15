"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LatLngLiteral, loadGoogleMaps } from "@/lib/googleMaps";
import { Loader2, Search } from "lucide-react";

type AddressDetails = {
  street?: string;
  exteriorNumber?: string;
  neighborhood?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  country?: string;
};

type Props = {
  location?: LatLngLiteral | null;
  onChange?: (location: LatLngLiteral) => void;
  readOnly?: boolean;
  height?: string;
  zoom?: number;
  addressContext?: AddressDetails;
  className?: string;
};

const buildQuery = (ctx?: AddressDetails) => {
  if (!ctx) return "";
  const parts: string[] = [];
  const street = String(ctx.street || "").trim();
  const ext = String(ctx.exteriorNumber || "").trim();
  if (street) parts.push(`${street} ${ext}`.trim());
  const neigh = String(ctx.neighborhood || "").trim();
  if (neigh) parts.push(neigh);
  const cp = String(ctx.postalCode || "").trim();
  if (cp) parts.push(cp);
  const city = String(ctx.city || "").trim();
  if (city) parts.push(city);
  const state = String(ctx.state || "").trim();
  if (state) parts.push(state);
  const country = String(ctx.country || "").trim();
  if (country) parts.push(country);
  return parts.join(", ");
};

export default function GoogleMapPicker({
  location,
  onChange,
  readOnly,
  height = "300px",
  zoom = 15,
  addressContext,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const clickListenerRef = useRef<any>(null);
  const dragListenerRef = useRef<any>(null);
  const placeListenerRef = useRef<any>(null);
  const onChangeRef = useRef<Props["onChange"]>(onChange);
  const [ready, setReady] = useState(false);
  const [searching, setSearching] = useState(false);

  const defaultCenter = useMemo<LatLngLiteral>(() => {
    return { lat: 20.96737, lng: -89.592585 };
  }, []);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!containerRef.current) return;
      try {
        const g = await loadGoogleMaps(["places"]);
        if (cancelled) return;

        const center = location || defaultCenter;
        const map = new g.maps.Map(containerRef.current, {
          center,
          zoom,
          disableDefaultUI: true,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });

        mapRef.current = map;
        markerRef.current = new g.maps.Marker({
          map,
          position: location || null,
          draggable: !readOnly,
        });

        const input = inputRef.current;
        if (input && g.maps.places?.Autocomplete) {
          const autocomplete = new g.maps.places.Autocomplete(input, {
            fields: ["geometry", "formatted_address", "name"],
            componentRestrictions: { country: "mx" },
          });
          placeListenerRef.current = autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            const loc = place?.geometry?.location;
            if (!loc) return;
            const lat = Number(loc.lat());
            const lng = Number(loc.lng());
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            onChangeRef.current?.({ lat, lng });
          });
        }

        setReady(true);
      } catch {
        setReady(false);
      }
    };

    init();
    return () => {
      cancelled = true;
      try {
        if (clickListenerRef.current?.remove) clickListenerRef.current.remove();
      } catch {}
      try {
        if (dragListenerRef.current?.remove) dragListenerRef.current.remove();
      } catch {}
      try {
        if (placeListenerRef.current?.remove) placeListenerRef.current.remove();
      } catch {}
    };
  }, [defaultCenter, zoom]);

  useEffect(() => {
    const g = (window as any).google;
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!g?.maps || !map || !marker) return;

    const center = location || defaultCenter;
    marker.setDraggable?.(!readOnly);
    marker.setPosition?.(location || null);
    map.setCenter?.(center);
  }, [defaultCenter, location, readOnly]);

  useEffect(() => {
    const g = (window as any).google;
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!g?.maps || !map || !marker) return;

    try {
      if (clickListenerRef.current?.remove) clickListenerRef.current.remove();
    } catch {}
    try {
      if (dragListenerRef.current?.remove) dragListenerRef.current.remove();
    } catch {}

    if (!readOnly) {
      marker.setDraggable?.(true);
      dragListenerRef.current = marker.addListener("dragend", (e: any) => {
        const lat = Number(e?.latLng?.lat?.());
        const lng = Number(e?.latLng?.lng?.());
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        onChangeRef.current?.({ lat, lng });
      });

      clickListenerRef.current = map.addListener("click", (e: any) => {
        const lat = Number(e?.latLng?.lat?.());
        const lng = Number(e?.latLng?.lng?.());
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        onChangeRef.current?.({ lat, lng });
      });
    } else {
      marker.setDraggable?.(false);
      clickListenerRef.current = map.addListener("click", () => {
        const pos = marker.getPosition?.();
        const lat = Number(pos?.lat?.());
        const lng = Number(pos?.lng?.());
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, "_blank");
      });
    }
  }, [readOnly]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const suggested = buildQuery(addressContext);
    if (suggested && !input.value) input.value = suggested;
  }, [addressContext]);

  const canSearchFromForm = useMemo(() => {
    if (readOnly) return false;
    const q = buildQuery(addressContext);
    return q.trim().length > 0;
  }, [addressContext, readOnly]);

  const searchFromForm = async () => {
    if (!canSearchFromForm) return;
    try {
      setSearching(true);
      const g = await loadGoogleMaps(["places"]);
      const geocoder = new g.maps.Geocoder();
      const query = buildQuery(addressContext);
      const res = await new Promise<any>((resolve) => {
        geocoder.geocode({ address: query, region: "MX" }, (results: any, status: any) => {
          resolve({ results, status });
        });
      });
      if (res?.status !== "OK") return;
      const first = res?.results?.[0];
      const loc = first?.geometry?.location;
      if (!loc) return;
      const lat = Number(loc.lat());
      const lng = Number(loc.lng());
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      onChange?.({ lat, lng });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className={cn("w-full rounded-lg border border-gray-200 overflow-hidden bg-white", className)}>
      <div className="relative" style={{ height }}>
        <div className="absolute left-3 right-3 top-3 z-10">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Buscar dirección"
              className="w-full rounded-md border border-gray-300 bg-white px-9 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              disabled={!ready}
            />
          </div>
          {canSearchFromForm ? (
            <button
              type="button"
              disabled={!ready || searching}
              onClick={searchFromForm}
              className={cn(
                "mt-2 w-full rounded-md px-3 py-2 text-sm font-semibold",
                !ready || searching ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-primary text-white hover:bg-primary/90",
              )}
            >
              {searching ? "Buscando..." : "Buscar con datos del formulario"}
            </button>
          ) : null}
        </div>
        <div ref={containerRef} className="h-full w-full" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}
