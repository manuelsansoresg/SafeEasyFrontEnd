"use client";

import { useEffect } from "react";
import { useLocationStore } from "@/store/useLocationStore";
import { getCookie } from "cookies-next";

export function LocationProvider() {
  const { setAddress, setError } = useLocationStore();

  useEffect(() => {
    // Try to get location from cookies (set by Middleware/Cloudflare)
    const city = getCookie("user_city");
    const country = getCookie("user_country");

    if (city) {
      console.log("📍 Ubicación desde Cloudflare/Vercel:", city);
      // We set state as null because we don't have lat/long, only city text
      setAddress(city as string, (country as string) || "");
    } else {
       console.log("⚠️ No se detectó ubicación en headers (Cloudflare/Vercel)");
       
       // Fallback for local development
       if (process.env.NODE_ENV === 'development') {
           console.log("� Modo Desarrollo: Usando ubicación simulada (Mérida, MX)");
           setAddress("Mérida", "Mexico");
       }
    }
  }, [setAddress, setError]);

  return null;
}
