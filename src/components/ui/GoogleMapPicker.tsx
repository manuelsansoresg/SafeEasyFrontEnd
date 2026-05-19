"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { LatLngLiteral, loadGoogleMaps } from "@/lib/googleMaps";
import { Loader2, Search } from "lucide-react";

type Props = {
  location?: LatLngLiteral | null;
  onChange?: (location: LatLngLiteral) => void;
  readOnly?: boolean;
  height?: string;
  zoom?: number;
  className?: string;
};

type RemovableListener = { remove?: () => void };
type GoogleLatLng = { lat?: () => number; lng?: () => number };
type GoogleMapMouseEvent = { latLng?: GoogleLatLng };
type GoogleMapInstance = {
  setCenter?: (center: LatLngLiteral) => void;
  addListener?: (eventName: string, handler: (event?: GoogleMapMouseEvent) => void) => RemovableListener;
};
type GoogleMarkerInstance = {
  setDraggable?: (draggable: boolean) => void;
  setPosition?: (location: LatLngLiteral | null) => void;
  getPosition?: () => GoogleLatLng | null;
  addListener?: (eventName: string, handler: (event?: GoogleMapMouseEvent) => void) => RemovableListener;
};
type GooglePlace = { geometry?: { location?: GoogleLatLng }; formatted_address?: string };
type GoogleAutocompleteInstance = {
  addListener: (eventName: string, handler: () => void) => RemovableListener;
  getPlace: () => GooglePlace;
};
type GoogleMapsApi = {
  maps?: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
    Marker: new (options: Record<string, unknown>) => GoogleMarkerInstance;
    places?: {
      Autocomplete: new (input: HTMLInputElement, options: Record<string, unknown>) => GoogleAutocompleteInstance;
    };
  };
};

export default function GoogleMapPicker({
  location,
  onChange,
  readOnly,
  height = "300px",
  zoom = 15,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const markerRef = useRef<GoogleMarkerInstance | null>(null);
  const clickListenerRef = useRef<RemovableListener | null>(null);
  const dragListenerRef = useRef<RemovableListener | null>(null);
  const placeListenerRef = useRef<RemovableListener | null>(null);
  const onChangeRef = useRef<Props["onChange"]>(onChange);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        const g = (await loadGoogleMaps(["places"])) as GoogleMapsApi;
        if (cancelled || !g.maps) return;

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
            const lat = Number(loc.lat?.());
            const lng = Number(loc.lng?.());
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            onChangeRef.current?.({ lat, lng });
          });
        }

        setReady(true);
      } catch (err) {
        console.error("[GoogleMapPicker] Error cargando Google Maps:", err);
        setLoadError(err instanceof Error ? err.message : "No se pudo cargar Google Maps");
      }
    };

    init();
    return () => {
      cancelled = true;
      try { clickListenerRef.current?.remove?.(); } catch {}
      try { dragListenerRef.current?.remove?.(); } catch {}
      try { placeListenerRef.current?.remove?.(); } catch {}
    };
  }, []);

  useEffect(() => {
    const g = (window as Window & { google?: GoogleMapsApi }).google;
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!g?.maps || !map || !marker) return;

    const center = location || defaultCenter;
    marker.setDraggable?.(!readOnly);
    marker.setPosition?.(location || null);
    map.setCenter?.(center);
  }, [defaultCenter, location, readOnly]);

  useEffect(() => {
    const g = (window as Window & { google?: GoogleMapsApi }).google;
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!g?.maps || !map || !marker) return;

    try { clickListenerRef.current?.remove?.(); } catch {}
    try { dragListenerRef.current?.remove?.(); } catch {}

    if (!readOnly) {
      marker.setDraggable?.(true);
      dragListenerRef.current = marker.addListener?.("dragend", (e) => {
        const lat = Number(e?.latLng?.lat?.());
        const lng = Number(e?.latLng?.lng?.());
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        onChangeRef.current?.({ lat, lng });
      }) ?? null;

      clickListenerRef.current = map.addListener?.("click", (e) => {
        const lat = Number(e?.latLng?.lat?.());
        const lng = Number(e?.latLng?.lng?.());
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        onChangeRef.current?.({ lat, lng });
      }) ?? null;
    } else {
      marker.setDraggable?.(false);
      clickListenerRef.current = map.addListener?.("click", () => {
        const pos = marker.getPosition?.();
        const lat = Number(pos?.lat?.());
        const lng = Number(pos?.lng?.());
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, "_blank");
      }) ?? null;
    }
  }, [readOnly]);

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
              disabled={!ready || readOnly}
            />
          </div>
        </div>
        <div ref={containerRef} className="h-full w-full" />
        {!ready && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 p-4 text-center z-20">
            <p className="text-sm font-medium text-red-600 mb-2">No se pudo cargar el mapa</p>
            <p className="text-xs text-gray-500">{loadError}</p>
          </div>
        )}
      </div>
    </div>
  );
}
