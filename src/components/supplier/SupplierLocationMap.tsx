"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLngLiteral } from "@/lib/googleMaps";

type SupplierLocationMapProps = {
  location: LatLngLiteral;
  supplierName: string;
};

function ResizeMap() {
  const map = useMap();

  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(id);
  }, [map]);

  return null;
}

export default function SupplierLocationMap({
  location,
  supplierName,
}: SupplierLocationMapProps) {
  const googleMapsUrl = useMemo(() => {
    const query = encodeURIComponent(`${location.lat},${location.lng}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }, [location.lat, location.lng]);

  const markerIcon = useMemo(
    () =>
      L.divIcon({
        className: "supplier-location-marker",
        html: '<span class="supplier-location-marker__pulse"></span><span class="supplier-location-marker__dot"></span>',
        iconSize: [48, 48],
        iconAnchor: [24, 24],
        popupAnchor: [0, -20],
      }),
    [],
  );

  const openGoogleMaps = () => {
    window.open(googleMapsUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="supplier-location-map relative h-full w-full">
      <MapContainer
        center={location}
        zoom={15}
        scrollWheelZoom={false}
        dragging
        zoomControl
        attributionControl
        className="h-full w-full"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
        />

        <Marker
          position={location}
          icon={markerIcon}
          title={`Abrir ubicación de ${supplierName} en Google Maps`}
          alt={`Ubicación exacta de ${supplierName}`}
          eventHandlers={{ click: openGoogleMaps }}
        >
          <Popup>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="supplier-location-popup-link"
            >
              <strong>{supplierName}</strong>
              <span>Abrir ubicación exacta en Google Maps</span>
            </a>
          </Popup>
        </Marker>

        <ResizeMap />
      </MapContainer>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[400] h-16 bg-gradient-to-b from-white/25 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[400] h-20 bg-gradient-to-t from-[#004e28]/10 to-transparent" />

      <style jsx global>{`
        .supplier-location-map .leaflet-container {
          background: #eef2ef;
          font-family: inherit;
        }

        .supplier-location-map .leaflet-tile-pane {
          filter: saturate(0.45) contrast(0.96) brightness(1.06)
            sepia(0.04) hue-rotate(82deg);
        }

        .supplier-location-map .leaflet-popup-content-wrapper,
        .supplier-location-map .leaflet-popup-tip {
          border: 1px solid rgba(0, 78, 40, 0.08);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.97);
          box-shadow: 0 16px 40px rgba(0, 78, 40, 0.2);
        }

        .supplier-location-map .leaflet-popup-content {
          margin: 0;
          color: #004e28;
        }

        .supplier-location-popup-link {
          display: flex;
          min-width: 190px;
          flex-direction: column;
          gap: 3px;
          padding: 12px 14px;
          color: #004e28 !important;
          text-decoration: none !important;
        }

        .supplier-location-popup-link strong {
          font-size: 0.875rem;
        }

        .supplier-location-popup-link span {
          color: #168e00;
          font-size: 0.72rem;
          font-weight: 700;
        }

        .supplier-location-map .leaflet-control-zoom {
          overflow: hidden;
          border: 0;
          border-radius: 14px;
          box-shadow: 0 14px 35px rgba(0, 78, 40, 0.18);
        }

        .supplier-location-map .leaflet-control-zoom a {
          display: grid;
          width: 36px;
          height: 36px;
          place-items: center;
          border: 0;
          background: rgba(255, 255, 255, 0.95);
          color: #004e28;
          font-weight: 900;
        }

        .supplier-location-map .leaflet-control-zoom a:hover {
          background: #ffffff;
          color: #168e00;
        }

        .supplier-location-map .leaflet-control-attribution {
          border-top-left-radius: 10px;
          background: rgba(255, 255, 255, 0.9);
          color: #59675f;
          font-size: 9px;
        }

        .supplier-location-map .leaflet-control-attribution a {
          color: #004e28;
          font-weight: 700;
        }

        .supplier-location-marker {
          position: relative;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: rgba(22, 142, 0, 0.15);
          box-shadow: 0 0 0 8px rgba(22, 142, 0, 0.1);
          cursor: pointer;
        }

        .supplier-location-marker__pulse {
          position: absolute;
          inset: 5px;
          border: 2px solid rgba(22, 142, 0, 0.55);
          border-radius: 999px;
          animation: supplier-location-pulse 2s ease-out infinite;
        }

        .supplier-location-marker__dot {
          position: relative;
          width: 19px;
          height: 19px;
          border: 4px solid #ffffff;
          border-radius: 999px;
          background: #168e00;
          box-shadow: 0 10px 26px rgba(0, 78, 40, 0.42);
        }

        @keyframes supplier-location-pulse {
          0% {
            opacity: 0.8;
            transform: scale(0.65);
          }
          80%,
          100% {
            opacity: 0;
            transform: scale(1.35);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .supplier-location-marker__pulse {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
