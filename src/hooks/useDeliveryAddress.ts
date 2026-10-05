"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import {
  addressFromGooglePlace, deliveryAddressChanged, emptyDeliveryAddress,
  isValidDeliveryLocation, parseUserDeliveryAddress,
  reverseGeocodeDeliveryLocation, type DeliveryAddress, type DeliveryAddressField,
  type GooglePlaceSelection,
} from "@/lib/deliveryAddress";
import type { LatLngLiteral } from "@/lib/googleMaps";
import { supplierCatalogService, type SupplierCatalogOption } from "@/services/supplierCatalogService";
import { useAuthHydrated, useAuthStore } from "@/store/useAuthStore";

function profileId(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const nested = record.user && typeof record.user === "object" ? record.user as Record<string, unknown>
    : record.data && typeof record.data === "object" ? record.data as Record<string, unknown> : record;
  const id = Number(nested.id ?? record.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function normalizedName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function matchingId(options: SupplierCatalogOption[], name: string) {
  return options.find((option) => normalizedName(option.name) === normalizedName(name))?.id ?? null;
}

async function changedGeoIds(current: DeliveryAddress, saved: DeliveryAddress) {
  const geoFields = ["country", "state", "city"] as const;
  if (geoFields.every((field) => current[field].trim() === saved[field].trim())) return {};
  const result: { country_id?: number | null; state_id?: number | null; city_id?: number | null } = {};
  if (!current.country.trim()) return { country_id: null, state_id: null, city_id: null };
  const countries = await supplierCatalogService.countries();
  const countryId = matchingId(countries, current.country);
  if (!countryId) throw new Error("No pudimos encontrar el país en el catálogo. Corrige la dirección o desmarca la opción de guardarla.");
  result.country_id = countryId;
  if (!current.state.trim()) return { ...result, state_id: null, city_id: null };
  const states = await supplierCatalogService.states(countryId);
  const stateId = matchingId(states, current.state);
  if (!stateId) throw new Error("No pudimos encontrar el estado en el catálogo. Corrige la dirección o desmarca la opción de guardarla.");
  result.state_id = stateId;
  if (!current.city.trim()) return { ...result, city_id: null };
  const cities = await supplierCatalogService.cities(stateId);
  const cityId = matchingId(cities, current.city);
  if (!cityId) throw new Error("No pudimos encontrar la ciudad en el catálogo. Corrige la dirección o desmarca la opción de guardarla.");
  result.city_id = cityId;
  return result;
}

export function useDeliveryAddress() {
  const authHydrated = useAuthHydrated();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [address, setAddress] = useState<DeliveryAddress>(emptyDeliveryAddress);
  const [savedAddress, setSavedAddress] = useState<DeliveryAddress>(emptyDeliveryAddress);
  const [loadedUserId, setLoadedUserId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const editedRef = useRef(false);
  const addressRequestRef = useRef(0);
  const addressTimerRef = useRef<number | null>(null);
  const loading = Boolean(authHydrated && isAuthenticated && userId && loadedUserId !== userId && !loadError);

  const cancelAddressResolution = useCallback(() => {
    addressRequestRef.current += 1;
    if (addressTimerRef.current != null) window.clearTimeout(addressTimerRef.current);
    addressTimerRef.current = null;
    setResolvingAddress(false);
  }, []);

  const resolveAddress = useCallback((location: LatLngLiteral, delayMs = 0, savedFields?: DeliveryAddress) => {
    const requestId = ++addressRequestRef.current;
    if (addressTimerRef.current != null) window.clearTimeout(addressTimerRef.current);
    addressTimerRef.current = null;
    setResolvingAddress(true);
    const run = async () => {
      try {
        const place = await reverseGeocodeDeliveryLocation(location);
        if (requestId === addressRequestRef.current) {
          const resolved = addressFromGooglePlace(place);
          setAddress(savedFields ? {
            ...resolved,
            exterior_number: resolved.exterior_number || savedFields.exterior_number,
            interior_number: savedFields.interior_number,
            neighborhood: resolved.neighborhood || savedFields.neighborhood,
            cp: resolved.cp || savedFields.cp,
            city: resolved.city || savedFields.city,
            state: resolved.state || savedFields.state,
            country: resolved.country || savedFields.country,
          } : resolved);
        }
      } catch {
        // La ubicación sigue siendo válida para cotizar aunque Google no devuelva texto.
      } finally {
        if (requestId === addressRequestRef.current) setResolvingAddress(false);
      }
    };
    if (delayMs > 0) addressTimerRef.current = window.setTimeout(() => { addressTimerRef.current = null; void run(); }, delayMs);
    else void run();
  }, []);

  useEffect(() => useAuthStore.subscribe((next, previous) => {
    if (next.isAuthenticated === previous.isAuthenticated && next.user?.id === previous.user?.id) return;
    editedRef.current = false;
    addressRequestRef.current += 1;
    if (addressTimerRef.current != null) window.clearTimeout(addressTimerRef.current);
    addressTimerRef.current = null;
    setAddress(emptyDeliveryAddress());
    setSavedAddress(emptyDeliveryAddress());
    setLoadedUserId(null);
    setLoadError(null);
    setResolvingAddress(false);
  }), []);

  useEffect(() => () => {
    addressRequestRef.current += 1;
    if (addressTimerRef.current != null) window.clearTimeout(addressTimerRef.current);
  }, []);

  useEffect(() => {
    if (!authHydrated || !isAuthenticated || !userId) return;
    const controller = new AbortController();
    fetchWithAuth("/api/users/me", { headers: { Accept: "application/json" }, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("No pudimos cargar tu dirección guardada.");
        return response.json() as Promise<unknown>;
      })
      .then((profile) => {
        if (controller.signal.aborted) return;
        const parsed = parseUserDeliveryAddress(profile);
        if (!editedRef.current) {
          setAddress(parsed);
          if (isValidDeliveryLocation(parsed.location) && !parsed.address.trim()) {
            resolveAddress(parsed.location, 0, parsed);
          }
        }
        setSavedAddress(parsed);
        setLoadedUserId(profileId(profile) ?? userId);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "No pudimos cargar tu dirección guardada.");
      });
    return () => controller.abort();
  }, [authHydrated, isAuthenticated, userId, resolveAddress]);

  const setField = useCallback((field: DeliveryAddressField, value: string) => {
    editedRef.current = true;
    cancelAddressResolution();
    setAddress((current) => ({ ...current, [field]: value }));
  }, [cancelAddressResolution]);
  const setLocationAndResolve = useCallback((location: LatLngLiteral) => {
    editedRef.current = true;
    setAddress({ ...emptyDeliveryAddress(), location });
    resolveAddress(location, 350);
  }, [resolveAddress]);
  const replaceAddress = useCallback((next: DeliveryAddress) => { editedRef.current = true; cancelAddressResolution(); setAddress(next); }, [cancelAddressResolution]);
  const selectPlace = useCallback((place: GooglePlaceSelection) => {
    editedRef.current = true;
    cancelAddressResolution();
    setAddress(addressFromGooglePlace(place));
  }, [cancelAddressResolution]);
  const resetToSaved = useCallback(() => {
    cancelAddressResolution();
    setAddress(savedAddress);
    if (isValidDeliveryLocation(savedAddress.location) && !savedAddress.address.trim()) {
      resolveAddress(savedAddress.location, 0, savedAddress);
    }
  }, [cancelAddressResolution, resolveAddress, savedAddress]);
  const hasChanges = deliveryAddressChanged(savedAddress, address);

  const saveToProfile = useCallback(async () => {
    if (!isAuthenticated || !userId || !hasChanges) return;
    if (loadError) throw new Error("No pudimos comprobar tu dirección guardada. Desmarca la opción de guardarla en tu perfil para continuar.");
    const targetId = loadedUserId ?? userId;
    const geoIds = await changedGeoIds(address, savedAddress);
    const payload = {
      address: address.address.trim(), exterior_number: address.exterior_number.trim(),
      interior_number: address.interior_number.trim(), neighborhood: address.neighborhood.trim(),
      cp: address.cp.trim(), city: address.city.trim(), state: address.state.trim(),
      country: address.country.trim(),
      ...geoIds,
      ...(address.location ? { map_location: `${address.location.lat},${address.location.lng}` } : {}),
    };
    let response: Response;
    try {
      response = await fetchWithAuth(`/api/users/${targetId}`, {
        method: "PUT", headers: { Accept: "application/json" }, body: JSON.stringify(payload),
      });
    } catch {
      throw new Error("No pudimos guardar tu nueva dirección. Reintenta o desmarca la opción de guardarla en tu perfil.");
    }
    if (!response.ok) throw new Error("No pudimos guardar tu nueva dirección. Reintenta o desmarca la opción de guardarla en tu perfil.");
    setSavedAddress(address);
  }, [address, hasChanges, isAuthenticated, loadError, loadedUserId, savedAddress, userId]);

  return {
    address, setField, setLocationAndResolve, replaceAddress, selectPlace, resetToSaved, hasChanges,
    saveToProfile, loading, resolvingAddress, loadError, isAuthenticated, userId: loadedUserId ?? userId,
  };
}
