"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

import { AddressDetails } from "./MapPickerClient";

const MapPickerClient = dynamic(
  () => import("./MapPickerClient"),
  { 
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 border rounded-lg">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }
);

interface MapPickerProps {
  location?: { lat: number; lng: number } | null;
  onChange?: (location: { lat: number; lng: number }) => void;
  readOnly?: boolean;
  height?: string;
  zoom?: number;
  addressContext?: AddressDetails;
  className?: string;
}

export default function MapPicker(props: MapPickerProps) {
  return <MapPickerClient {...props} />;
}
