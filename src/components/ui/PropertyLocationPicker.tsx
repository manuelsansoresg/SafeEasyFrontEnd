"use client";

import { useEffect, useId, useState } from "react";
import { CheckCircle2, Loader2, MapPin, Search, X } from "lucide-react";
import { icon } from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIconRetina from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { fetchWithAuth } from "@/lib/api";
import { validPropertyCoordinates, type PropertyCoordinates, type PropertyLocation } from "@/lib/propertyLocation";

const merida: PropertyCoordinates = { lat: 20.9674, lng: -89.5926 };
const pointZoom = 17;
const pin = icon({
  iconUrl: markerIcon.src,
  iconRetinaUrl: markerIconRetina.src,
  shadowUrl: markerShadow.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

type Props = {
  value: PropertyLocation | null;
  onChange: (value: PropertyLocation | null) => void;
  disabled?: boolean;
};

function MapPoint({ value, onChange, disabled, focus }: Props & { focus: PropertyCoordinates | null }) {
  const map = useMapEvents({
    click({ latlng }) {
      if (disabled) return;
      const { lat, lng } = latlng.wrap();
      onChange({ lat, lng, address: null });
    },
  });

  useEffect(() => {
    if (focus) map.setView(focus, pointZoom);
  }, [focus, map]);

  if (!value) return null;

  return (
    <Marker
      position={value}
      icon={pin}
      title="Ubicación del inmueble"
      alt="Ubicación del inmueble"
      draggable={!disabled}
      eventHandlers={{
        dragend({ target }) {
          const { lat, lng } = target.getLatLng().wrap();
          onChange({ lat, lng, address: value.address });
        },
      }}
    />
  );
}

export default function PropertyLocationPicker({ value, onChange, disabled }: Props) {
  const searchId = useId();
  const addressId = useId();
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<PropertyCoordinates | null>(null);
  const [search, setSearch] = useState<{
    query: string;
    results: PropertyLocation[];
    failed?: boolean;
  } | null>(null);
  const [selectionError, setSelectionError] = useState("");
  const term = query.trim();
  const currentSearch = search?.query === term ? search : null;
  const searching = term.length >= 4 && !currentSearch && !disabled;
  const results = currentSearch?.results ?? [];

  useEffect(() => {
    if (term.length < 4 || disabled) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetchWithAuth(`/api/property-address-search/?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Address search failed");
        const { results }: { results: PropertyLocation[] } = await response.json();
        if (!controller.signal.aborted) setSearch({ query: term, results });
      } catch {
        if (!controller.signal.aborted) setSearch({ query: term, results: [], failed: true });
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term, disabled]);

  function choosePoint(point: PropertyLocation | null, recenter = false) {
    if (point && !validPropertyCoordinates(point.lat, point.lng)) {
      setSelectionError("Ese punto no es válido. Selecciona otra ubicación en el mapa.");
      return;
    }
    setSelectionError("");
    setQuery("");
    setSearch(null);
    if (recenter) setFocus(point);
    onChange(point);
  }

  return (
    <section aria-labelledby={titleId} className="col-span-2 min-w-0 space-y-3 rounded-xl border border-gray-200 p-3 sm:p-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <MapPin size={18} className="text-primary" aria-hidden="true" />
        <h2 id={titleId} className="font-semibold text-primary">Ubicación del inmueble</h2>
        <span className="text-sm text-gray-500">(Opcional)</span>
      </div>
      <p className="text-sm text-gray-600">Busca una dirección o toca el mapa para colocar el marcador. Arrástralo para ajustar el punto.</p>
      <div className="space-y-1.5">
        <label htmlFor={searchId} className="text-sm font-medium text-gray-700">Buscar dirección</label>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute top-3.5 left-3 text-gray-500" aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            autoComplete="off"
            maxLength={160}
            disabled={disabled}
            value={query}
            placeholder="Calle, colonia o código postal"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
            className="h-11 w-full rounded-xl border border-gray-200 pr-4 pl-9 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        {results.length > 0 && !disabled && (
          <ul aria-label="Sugerencias de dirección" className="max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
            {results.map((point, index) => (
              <li key={`${point.lat},${point.lng},${index}`}>
                <button type="button" onClick={() => choosePoint(point, true)} className="min-h-11 w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 focus-visible:bg-gray-50">
                  {point.address}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div aria-live="polite" className="text-sm text-gray-600">
          {searching && <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Buscando direcciones…</span>}
          {currentSearch?.failed && "No pudimos buscar direcciones. Puedes elegir el punto en el mapa."}
          {currentSearch && !currentSearch.failed && !results.length && "Sin coincidencias. Prueba otra dirección o elige un punto en el mapa."}
        </div>
      </div>
      <div className="isolate h-[280px] overflow-hidden rounded-lg border border-gray-300 sm:h-[340px]">
        <MapContainer center={value ?? merida} zoom={value ? pointZoom : 13} scrollWheelZoom={false} className="h-full w-full">
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          <MapPoint value={value} onChange={choosePoint} focus={focus} disabled={disabled} />
        </MapContainer>
      </div>
      <p className="text-xs text-gray-500">Búsqueda de direcciones por <a href="https://www.geoapify.com/" className="underline" target="_blank" rel="noreferrer">Geoapify</a>.</p>
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
