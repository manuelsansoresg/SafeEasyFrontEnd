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
    const id = window.setTimeout(() => {
      map.invalidateSize();
    }, 120);
    return () => window.clearTimeout(id);
  }, [map]);

  return null;
}

export default function SupplierLocationMap({ location, supplierName }: SupplierLocationMapProps) {
  const markerIcon = useMemo(
    () =>
      L.divIcon({
        className: "supplier-location-marker",
        html: '<span class="supplier-location-marker__dot"></span>',
        iconSize: [42, 42],
        iconAnchor: [21, 21],
        popupAnchor: [0, -18],
      }),
    [],
  );

  return (
    <div className="supplier-location-map h-full w-full">
      <MapContainer
        center={location}
        zoom={15}
        scrollWheelZoom={false}
        dragging
        zoomControl={true}
        attributionControl={false}
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        <Marker position={location} icon={markerIcon}>
          <Popup>{supplierName}</Popup>
        </Marker>
        <ResizeMap />
      </MapContainer>

      <style jsx global>{`
        .supplier-location-map .leaflet-container {
          background: #eef2ef;
          font-family: inherit;
        }

        .supplier-location-map .leaflet-tile-pane {
          filter: saturate(0.78) contrast(1.03) brightness(1.02);
        }

        .supplier-location-map .leaflet-popup-content-wrapper,
        .supplier-location-map .leaflet-popup-tip {
          border-radius: 12px;
          box-shadow: 0 16px 40px rgba(0, 78, 40, 0.18);
        }

        .supplier-location-map .leaflet-popup-content {
          margin: 10px 14px;
          color: #004e28;
          font-weight: 800;
        }

        .supplier-location-map .leaflet-control-zoom {
          border: 0;
          overflow: hidden;
          border-radius: 14px;
          box-shadow: 0 14px 35px rgba(0, 78, 40, 0.18);
        }

        .supplier-location-map .leaflet-control-zoom a {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border: 0;
          color: #004e28;
          font-weight: 900;
          background: rgba(255, 255, 255, 0.94);
        }

        .supplier-location-map .leaflet-control-zoom a:hover {
          color: #168e00;
          background: #ffffff;
        }

        .supplier-location-marker {
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: rgba(22, 142, 0, 0.16);
          box-shadow: 0 0 0 8px rgba(22, 142, 0, 0.12);
        }

        .supplier-location-marker__dot {
          width: 18px;
          height: 18px;
          border-radius: 999px;
          border: 4px solid #ffffff;
          background: #168e00;
          box-shadow: 0 12px 30px rgba(0, 78, 40, 0.35);
        }
      `}</style>
    </div>
  );
}
