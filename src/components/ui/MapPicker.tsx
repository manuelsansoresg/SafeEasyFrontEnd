"use client";

import GoogleMapPicker from "./GoogleMapPicker";

interface MapPickerProps {
  location?: { lat: number; lng: number } | null;
  onChange?: (location: { lat: number; lng: number }) => void;
  readOnly?: boolean;
  height?: string;
  zoom?: number;
  addressContext?: {
    street?: string;
    exteriorNumber?: string;
    neighborhood?: string;
    postalCode?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  onSearchQueryChange?: (query: string) => void;
  className?: string;
}

export default function MapPicker(props: MapPickerProps) {
  return <GoogleMapPicker {...props} />;
}
