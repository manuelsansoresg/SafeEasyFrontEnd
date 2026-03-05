"use client";

import { useEffect } from "react";
import { useLocationStore } from "@/store/useLocationStore";
import { getCookie } from "cookies-next";

export function LocationProvider() {
  const { setAddress, setError } = useLocationStore();

  useEffect(() => {
    // Intentar leer la cookie directamente del navegador si el helper falla
    const city = getCookie("user_city") || document.cookie.split('; ').find(row => row.startsWith('user_city='))?.split('=')[1];
    
    if (city && city !== "undefined") {
      const cleanCity = decodeURIComponent(city as string);
      console.log("📍 Ubicación recuperada:", cleanCity);
      setAddress(cleanCity, (getCookie("user_country") as string) || "MX");
    } else {
       console.log("⚠️ No se detectó ubicación en cookies cliente");
       
       // Fallback for local development
       if (process.env.NODE_ENV === 'development') {
           console.log("🔧 Modo Desarrollo: Usando ubicación simulada (Mérida, MX)");
           setAddress("Mérida", "Mexico");
       }
    }
  }, [setAddress]);

  return null;
}
