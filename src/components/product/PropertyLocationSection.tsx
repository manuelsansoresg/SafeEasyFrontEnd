"use client";

import { useEffect, useId, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Navigation } from "lucide-react";
import type { LatLngLiteral } from "@/lib/googleMaps";

const LocationMap = dynamic(() => import("@/components/supplier/SupplierLocationMap"), { ssr: false });

export interface PublicPropertyLocationFields {
  is_real_estate?: boolean;
  property_latitude?: number | null;
  property_longitude?: number | null;
  property_address?: string | null;
}

export function getPublicPropertyLocation(product: PublicPropertyLocationFields | null) {
  if (product?.is_real_estate !== true) return null;
  const { property_latitude: lat, property_longitude: lng, property_address } = product;
  if (typeof lat !== "number" || !Number.isFinite(lat) || Math.abs(lat) > 90 ||
      typeof lng !== "number" || !Number.isFinite(lng) || Math.abs(lng) > 180) return null;

  return { lat, lng, address: property_address?.trim() };
}

export default function PropertyLocationSection({
  location,
  propertyName,
}: {
  location: LatLngLiteral & { address?: string };
  propertyName: string;
}) {
  const titleId = useId();
  const mapFrame = useRef<HTMLDivElement>(null);
  const [showMap, setShowMap] = useState(false);
  const { lat, lng, address } = location;
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;

  useEffect(() => {
    if (!mapFrame.current) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = window.requestAnimationFrame(() => setShowMap(true));
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setShowMap(true);
      observer.disconnect();
    }, { rootMargin: "240px 0px" });
    observer.observe(mapFrame.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section aria-labelledby={titleId} className="min-w-0 space-y-4 border-t border-gray-100 p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 id={titleId} className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <MapPin size={20} className="shrink-0 text-primary" aria-hidden="true" />
            Ubicación del inmueble
          </h3>
          {address && <p className="mt-1 break-words text-sm text-gray-600">{address}</p>}
        </div>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Cómo llegar (abre Google Maps en otra pestaña)"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-primary transition-colors hover:border-primary/30 hover:bg-primary/5"
        >
          <Navigation size={16} aria-hidden="true" />
          Cómo llegar
        </a>
      </div>
      <div
        ref={mapFrame}
        className="isolate h-64 w-full overflow-hidden rounded-xl border border-gray-200 bg-[#eef2ef] sm:h-[340px]"
      >
        {showMap && <LocationMap key={`${lat},${lng}`} location={location} supplierName={propertyName} variant="property" />}
      </div>
    </section>
  );
}
