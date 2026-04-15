export type LatLngLiteral = { lat: number; lng: number };

declare global {
  interface Window {
    google?: any;
    __drooopyGoogleMapsPromise?: Promise<any>;
  }
}

const getApiKey = () => {
  const key = String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
  return key || null;
};

export const parseMapLocation = (value: unknown): LatLngLiteral | null => {
  const pick = (obj: any) => {
    const lat = Number(obj?.lat);
    const lng = Number(obj?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  };

  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return pick(parsed);
    } catch {
      const parts = value
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      if (parts.length !== 2) return null;
      const lat = Number(parts[0]);
      const lng = Number(parts[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat, lng };
    }
  }
  if (typeof value === "object") return pick(value as any);
  return null;
};

export const loadGoogleMaps = async (libraries: string[] = ["places"]): Promise<any> => {
  if (typeof window === "undefined") throw new Error("Google Maps solo está disponible en el navegador.");
  if (window.google?.maps) return window.google;

  if (window.__drooopyGoogleMapsPromise) return window.__drooopyGoogleMapsPromise;

  const key = getApiKey();
  if (!key) throw new Error("Falta configurar la API key de Google Maps.");

  window.__drooopyGoogleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-drooopy-google-maps="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google));
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar Google Maps.")));
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.drooopyGoogleMaps = "1";
    const libs = libraries.length ? `&libraries=${encodeURIComponent(libraries.join(","))}` : "";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}${libs}`;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("No se pudo cargar Google Maps."));
    document.head.appendChild(script);
  });

  return window.__drooopyGoogleMapsPromise;
};

export const distanceKmDriving = async (origin: LatLngLiteral, destination: LatLngLiteral): Promise<number> => {
  const g = await loadGoogleMaps(["places"]);

  return await new Promise<number>((resolve, reject) => {
    const service = new g.maps.DistanceMatrixService();
    service.getDistanceMatrix(
      {
        origins: [origin],
        destinations: [destination],
        travelMode: g.maps.TravelMode.DRIVING,
        unitSystem: g.maps.UnitSystem.METRIC,
      },
      (res: any, status: any) => {
        if (status !== "OK" || !res) {
          reject(new Error(`Google DistanceMatrix error: ${status || "unknown"}`));
          return;
        }

        const element = res.rows?.[0]?.elements?.[0];
        const valueMeters = element?.distance?.value;
        const value = Number(valueMeters);
        if (!Number.isFinite(value) || value <= 0) {
          reject(new Error("No se pudo calcular la distancia."));
          return;
        }
        resolve(value / 1000);
      },
    );
  });
};
