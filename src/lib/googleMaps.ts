export type LatLngLiteral = { lat: number; lng: number };
type LatLngLike = { lat?: unknown; lng?: unknown; latitude?: unknown; longitude?: unknown };
type DistanceMatrixResponse = { rows?: Array<{ elements?: Array<{ distance?: { value?: number | string } }> }> };
type DistanceMatrixRequest = {
  origins: LatLngLiteral[];
  destinations: LatLngLiteral[];
  travelMode: string;
  unitSystem: string | number;
};
type GoogleMapsApi = {
  maps: {
    Map?: new (element: HTMLElement, options: Record<string, unknown>) => unknown;
    Marker?: new (options: Record<string, unknown>) => unknown;
    places?: {
      Autocomplete?: new (input: HTMLInputElement, options: Record<string, unknown>) => unknown;
    };
    DistanceMatrixService: new () => {
      getDistanceMatrix: (
        request: DistanceMatrixRequest,
        callback: (res: DistanceMatrixResponse | null, status: string) => void,
      ) => void;
    };
    Geocoder: new () => {
      geocode: (request: Record<string, unknown>, callback: (results: unknown[] | null, status: string) => void) => void;
    };
    TravelMode: { DRIVING: string };
    UnitSystem: { METRIC: string | number };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsApi;
    __drooopyGoogleMapsPromise?: Promise<GoogleMapsApi>;
  }
}

const getApiKey = () => {
  const key = String(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();
  return key || null;
};

export const parseMapLocation = (value: unknown): LatLngLiteral | null => {
  const pick = (obj: LatLngLike) => {
    const lat = Number(obj.lat ?? obj.latitude);
    const lng = Number(obj.lng ?? obj.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  };

  const pickFromString = (raw: string) => {
    const trimmed = raw.trim();
    const direct = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    const googleAt = trimmed.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    const googleQuery = trimmed.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    const match = direct || googleAt || googleQuery;
    if (!match) return null;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  };

  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return pick(parsed);
    } catch {
      return pickFromString(value);
    }
  }
  if (typeof value === "object") return pick(value as LatLngLike);
  return null;
};

export const loadGoogleMaps = async (libraries: string[] = ["places"]): Promise<GoogleMapsApi> => {
  if (typeof window === "undefined") throw new Error("Google Maps solo está disponible en el navegador.");
  if (window.google?.maps) return window.google;

  if (window.__drooopyGoogleMapsPromise) return window.__drooopyGoogleMapsPromise;

  const key = getApiKey();
  if (!key) throw new Error("Falta configurar la API key de Google Maps.");

  window.__drooopyGoogleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-drooopy-google-maps="1"]');
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.google) resolve(window.google);
        else reject(new Error("No se pudo cargar Google Maps."));
      });
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar Google Maps.")));
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.drooopyGoogleMaps = "1";
    const libs = libraries.length ? `&libraries=${encodeURIComponent(libraries.join(","))}` : "";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}${libs}`;
    script.onload = () => {
      if (window.google) resolve(window.google);
      else reject(new Error("No se pudo cargar Google Maps."));
    };
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
      (res, status) => {
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
