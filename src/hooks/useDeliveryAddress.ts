"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import {
  addressFromGooglePlace, deliveryAddressChanged, emptyDeliveryAddress,
  parseUserDeliveryAddress, type DeliveryAddress, type DeliveryAddressField,
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
  const editedRef = useRef(false);
  const loading = Boolean(authHydrated && isAuthenticated && userId && loadedUserId !== userId && !loadError);

  useEffect(() => useAuthStore.subscribe((next, previous) => {
    if (next.isAuthenticated === previous.isAuthenticated && next.user?.id === previous.user?.id) return;
    editedRef.current = false;
    setAddress(emptyDeliveryAddress());
    setSavedAddress(emptyDeliveryAddress());
    setLoadedUserId(null);
    setLoadError(null);
  }), []);

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
        if (!editedRef.current) setAddress(parsed);
        setSavedAddress(parsed);
        setLoadedUserId(profileId(profile) ?? userId);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "No pudimos cargar tu dirección guardada.");
      });
    return () => controller.abort();
  }, [authHydrated, isAuthenticated, userId]);

  const setField = useCallback((field: DeliveryAddressField, value: string) => {
    editedRef.current = true;
    setAddress((current) => ({ ...current, [field]: value }));
  }, []);
  const setLocation = useCallback((location: LatLngLiteral) => {
    editedRef.current = true;
    setAddress((current) => ({ ...current, location }));
  }, []);
  const replaceAddress = useCallback((next: DeliveryAddress) => { editedRef.current = true; setAddress(next); }, []);
  const selectPlace = useCallback((place: GooglePlaceSelection) => {
    editedRef.current = true;
    setAddress(addressFromGooglePlace(place));
  }, []);
  const resetToSaved = useCallback(() => setAddress(savedAddress), [savedAddress]);
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
    address, setField, setLocation, replaceAddress, selectPlace, resetToSaved, hasChanges,
    saveToProfile, loading, loadError, isAuthenticated, userId: loadedUserId ?? userId,
  };
}
