"use client";

import { useEffect } from "react";
import { useLocationStore } from "@/store/useLocationStore";
import { getCookie } from "cookies-next";

export function LocationProvider() {
  const { setAddress, setError, setLocation } = useLocationStore();

  useEffect(() => {
    // Try to get location from cookies (set by Middleware/Cloudflare)
    const city = getCookie("user_city");
    const country = getCookie("user_country");

    if (city) {
      console.log("📍 Ubicación desde Cloudflare/Vercel:", city);
      // We set state as null because we don't have lat/long, only city text
      setAddress(city as string, (country as string) || "");
    } else {
       // Fallback: If no cookie (dev environment), use browser geolocation
       console.log("⚠️ No se detectó ubicación en headers (Cloudflare/Vercel). Intentando navegador...");
       
       if (navigator.geolocation) {
         navigator.geolocation.getCurrentPosition(
           (position) => {
             const { latitude, longitude } = position.coords;
             console.log("📍 Ubicación desde Navegador:", latitude, longitude);
             setLocation(latitude, longitude);
           },
           (error) => {
             console.error("Error obteniendo ubicación del navegador:", error);
             setError(error.message);
           }
         );
       } else {
         console.error("Geolocalización no soportada por el navegador.");
       }
    }
  }, [setAddress, setError, setLocation]);

  return null;
}
