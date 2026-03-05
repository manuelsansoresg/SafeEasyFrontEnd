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
            const cityCookie = getCookie("user_city");
            let city = typeof cityCookie === 'string' ? cityCookie : undefined;
            
            if (!city) {
                city = document.cookie.split('; ').find(row => row.startsWith('user_city='))?.split('=')[1];
            }
            
            if (city && city !== "undefined") {
              try {
                  // Corrección robusta de encoding (ISO-8859-1 a UTF-8)
                  // "MÃ©rida" es como se ve "Mérida" cuando se interpreta UTF-8 como ISO
                  let cleanCity = city;
                  
                  // 1. Decodificar URI components por si viene encoded
                  try {
                    cleanCity = decodeURIComponent(city);
                  } catch (e) { /* ignorar */ }

                  // 2. Corregir caracteres mal interpretados (latin1 vs utf8)
                  try {
                    // Si contiene caracteres típicos de error de encoding
                    if (cleanCity.includes('Ã')) {
                        // @ts-ignore
                        const bytes = Uint8Array.from(cleanCity.split('').map(c => c.charCodeAt(0)));
                        cleanCity = new TextDecoder('utf-8').decode(bytes);
                    }
                  } catch (e) {
                      console.log("No se pudo corregir encoding avanzado, usando valor original");
                  }

                  console.log("📍 Ubicación recuperada (Original):", city);
                  console.log("📍 Ubicación recuperada (Corregida):", cleanCity);
                  
                  const countryCookie = getCookie("user_country");
                  const country = typeof countryCookie === 'string' ? countryCookie : "MX";
                  setAddress(cleanCity, country);
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
