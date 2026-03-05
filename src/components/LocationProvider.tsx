"use client";

import { useEffect } from "react";
import { useLocationStore } from "@/store/useLocationStore";
import { getCookie } from "cookies-next";

export function LocationProvider() {
  const { setAddress, setError } = useLocationStore();

  useEffect(() => {
            // Verificar si el middleware se ejecutó (busca la cookie de debug)
            const mwDebug = getCookie("mw_debug");
            const mwHeaders = getCookie("mw_debug_headers");
            
            if (mwDebug) {
              console.log("✅ Middleware está corriendo correctamente.");
              if (mwHeaders) {
                console.log("🔍 Headers recibidos por Middleware:", JSON.parse(decodeURIComponent(mwHeaders as string)));
              }
            } else {
              console.warn("⚠️ Middleware NO parece estar corriendo o no pudo setear cookies (mw_debug no encontrada).");
            }

            // Intentar leer la cookie directamente del navegador si el helper falla
            const city = getCookie("user_city") || document.cookie.split('; ').find(row => row.startsWith('user_city='))?.split('=')[1];
            
            if (city && city !== "undefined") {
              try {
                  // Doble decode por si acaso, algunos navegadores o frameworks codifican extra
                  const cleanCity = decodeURIComponent(decodeURIComponent(city as string));
                  console.log("📍 Ubicación recuperada:", cleanCity);
                  setAddress(cleanCity, (getCookie("user_country") as string) || "MX");
              } catch(e) {
                  console.error("Error decoding city cookie:", e);
                  // Fallback sin decode si falla
                  setAddress(city as string, (getCookie("user_country") as string) || "MX");
              }
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
