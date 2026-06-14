"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import GoogleMapPicker from "@/components/ui/GoogleMapPicker";
import { PageHero } from "@/components/ui/PageHero";
import { LatLngLiteral, parseMapLocation } from "@/lib/googleMaps";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { supplierCatalogService, type SupplierCatalogOption } from "@/services/supplierCatalogService";
import { Loader2, CheckCircle, Eye, EyeOff, User, Mail, Lock, Shield, Store, ArrowRight } from "lucide-react";

const DEFAULT_COUNTRY_ID = 1;
const DEFAULT_COUNTRY_NAME = "Mexico";
const DEFAULT_COUNTRY_OPTION: SupplierCatalogOption = {
  id: DEFAULT_COUNTRY_ID,
  name: DEFAULT_COUNTRY_NAME,
};

function normalizeCatalogText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export default function ProfilePage() {
  const { user, token } = useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [addressData, setAddressData] = useState({
    address: "",
    exterior_number: "",
    interior_number: "",
    cp: "",
    neighborhood: "",
    city: "Mérida",
    state: "Yucatán",
    country: DEFAULT_COUNTRY_NAME
  });
  const [mapLocation, setMapLocation] = useState<LatLngLiteral | null>(null);
  const [catalogLoading, setCatalogLoading] = useState({
    countries: false,
    states: false,
    cities: false,
  });
  const [countries, setCountries] = useState<SupplierCatalogOption[]>([DEFAULT_COUNTRY_OPTION]);
  const [states, setStates] = useState<SupplierCatalogOption[]>([]);
  const [cities, setCities] = useState<SupplierCatalogOption[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(DEFAULT_COUNTRY_ID);
  const [selectedStateId, setSelectedStateId] = useState<number | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user || !token) return;

      setLoading(true);
      setError(null);

      try {
        const res = await fetchWithAuth("/api/users/me", { headers: { Accept: "application/json" } });
        if (!res.ok) {
          setError("No se pudieron cargar los datos del perfil. Intente recargar.");
          return;
        }
        const profileData: unknown = await res.json().catch(() => null);
        if (!profileData || typeof profileData !== "object") {
          setError("No se pudieron cargar los datos del perfil. Intente recargar.");
          return;
        }
        const data = profileData as Record<string, unknown>;

        setFormData((prev) => ({
          ...prev,
          name: String(data.full_name || data.name || ""),
          email: String(data.email || ""),
        }));

        setAddressData((prev) => ({
          ...prev,
          address: String(data.address || data.street || ""),
          exterior_number: String(data.exterior_number || data.outdoor_number || ""),
          interior_number: String(data.interior_number || data.indoor_number || ""),
          cp: String(data.cp || data.zip_code || data.postal_code || ""),
          neighborhood: String(data.neighborhood || data.colonia || ""),
          city: String(data.city || "Mérida"),
          state: String(data.state || "Yucatán"),
          country: String(data.country || DEFAULT_COUNTRY_NAME),
        }));

        const loc = parseMapLocation(data.map_location || null);
        if (loc) setMapLocation(loc);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al cargar perfil";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [user, token]);

  useEffect(() => {
    let active = true;

    const loadCountries = async () => {
      setCatalogLoading((prev) => ({ ...prev, countries: true }));
      try {
        const items = await supplierCatalogService.countries();
        if (!active) return;

        const countryOptions = items.length > 0 ? items : [DEFAULT_COUNTRY_OPTION];
        const selectedCountry =
          countryOptions.find((item) => normalizeCatalogText(item.name) === normalizeCatalogText(addressData.country)) ??
          countryOptions.find((item) => normalizeCatalogText(item.name) === normalizeCatalogText(DEFAULT_COUNTRY_NAME)) ??
          DEFAULT_COUNTRY_OPTION;

        setCountries(countryOptions);
        setSelectedCountryId(selectedCountry.id);
        setAddressData((prev) => ({ ...prev, country: selectedCountry.name }));
        setCatalogError(null);
      } catch {
        if (!active) return;
        setCountries([DEFAULT_COUNTRY_OPTION]);
        setSelectedCountryId(DEFAULT_COUNTRY_ID);
        setAddressData((prev) => ({ ...prev, country: DEFAULT_COUNTRY_NAME }));
        setCatalogError(null);
      } finally {
        if (active) setCatalogLoading((prev) => ({ ...prev, countries: false }));
      }
    };

    loadCountries();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedCountryId) {
      setStates([]);
      setCities([]);
      return;
    }

    let active = true;
    const currentState = addressData.state;

    const loadStates = async () => {
      setCatalogLoading((prev) => ({ ...prev, states: true }));
      try {
        const items = await supplierCatalogService.states(selectedCountryId);
        if (!active) return;

        setStates(items);
        const selectedState = currentState
          ? items.find((item) => normalizeCatalogText(item.name) === normalizeCatalogText(currentState))
          : null;

        if (selectedState) {
          setSelectedStateId(selectedState.id);
          setAddressData((prev) => ({ ...prev, state: selectedState.name }));
        }
        setCatalogError(null);
      } catch {
        if (!active) return;
        setStates([]);
        setCatalogError("No pudimos cargar los estados.");
      } finally {
        if (active) setCatalogLoading((prev) => ({ ...prev, states: false }));
      }
    };

    loadStates();
    return () => {
      active = false;
    };
  }, [selectedCountryId]);

  useEffect(() => {
    if (!selectedStateId) {
      setCities([]);
      return;
    }

    let active = true;
    const currentCity = addressData.city;

    const loadCities = async () => {
      setCatalogLoading((prev) => ({ ...prev, cities: true }));
      try {
        const items = await supplierCatalogService.cities(selectedStateId);
        if (!active) return;

        setCities(items);
        const selectedCity = currentCity
          ? items.find((item) => normalizeCatalogText(item.name) === normalizeCatalogText(currentCity))
          : null;

        if (selectedCity) {
          setAddressData((prev) => ({ ...prev, city: selectedCity.name }));
        }
        setCatalogError(null);
      } catch {
        if (!active) return;
        setCities([]);
        setCatalogError("No pudimos cargar las ciudades.");
      } finally {
        if (active) setCatalogLoading((prev) => ({ ...prev, cities: false }));
      }
    };

    loadCities();
    return () => {
      active = false;
    };
  }, [selectedStateId]);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const countryId = Number(e.target.value);
    const country = countries.find((item) => item.id === countryId);
    setCatalogError(null);
    setSelectedCountryId(e.target.value && Number.isFinite(countryId) ? countryId : null);
    setSelectedStateId(null);
    setStates([]);
    setCities([]);
    setAddressData((prev) => ({
      ...prev,
      country: country?.name ?? "",
      state: "",
      city: "",
    }));
  };

  const handleStateSelectChange = (state: SupplierCatalogOption | null) => {
    setCatalogError(null);
    setSelectedStateId(state?.id ?? null);
    setCities([]);
    setAddressData((prev) => ({
      ...prev,
      state: state?.name ?? "",
      city: "",
    }));
  };

  const handleCitySelectChange = (city: SupplierCatalogOption | null) => {
    setCatalogError(null);
    setAddressData((prev) => ({ ...prev, city: city?.name ?? "" }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError(null);
    setSuccessMessage(null);

    if (formData.password && formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        email: formData.email,
        address: addressData.address,
        exterior_number: addressData.exterior_number,
        interior_number: addressData.interior_number,
        cp: addressData.cp,
        neighborhood: addressData.neighborhood,
        city: addressData.city,
        state: addressData.state,
        country: addressData.country,
      };

      if (formData.password) {
        payload.password = formData.password;
      }

      const response = await fetchWithAuth(`/api/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error al actualizar perfil (${response.status})`);
      }

      const updatedData = await response.json().catch(() => null);
      if (process.env.NODE_ENV === "development") console.log("[Profile] PUT response body:", updatedData);

      if (mapLocation) {
        await fetchWithAuth(`/api/users/${user.id}/map-location`, {
          method: "PATCH",
          body: JSON.stringify({ map_location: `${mapLocation.lat},${mapLocation.lng}` }),
        });
      }

      setSuccessMessage("Perfil actualizado correctamente");
      
      // Update store user data if needed (though store usually persists login data)
      // Note: We might want to update the global auth store state here if the name changed
      
      // Clear password fields
      setFormData(prev => ({
        ...prev,
        password: "",
        confirmPassword: ""
      }));

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al guardar los cambios";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 font-[family-name:var(--font-poppins)]">
      <PageHero title="Mi Perfil" subtitle="Administra tu información personal y de acceso." />

      <section className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm">
        <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Store size={24} />
            </div>
            <div>
              <p className="font-[family-name:var(--font-varela-round)] text-xl font-bold text-gray-950">
                ¿Quieres vender en Drooopy?
              </p>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                Activa tu empresa con tu misma cuenta. Solo elige un paquete, registra el nombre de tu empresa y continúa al pago.
              </p>
            </div>
          </div>
          <Link
            href="/client/become-supplier"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-bold text-white transition hover:bg-secondary"
          >
            Volverme proveedor
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2">
            <Shield size={20} />
            {error}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 text-green-600 rounded-xl border border-green-100 flex items-center gap-2">
            <CheckCircle size={20} />
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Información Básica</h2>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <User size={16} className="text-gray-400" />
                Nombre Completo
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Mail size={16} className="text-gray-400" />
                Correo Electrónico
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Dirección de Entrega</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-gray-700">Calle</label>
                <input
                  value={addressData.address}
                  onChange={(e) => setAddressData(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="Calle"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Número ext.</label>
                <input
                  value={addressData.exterior_number}
                  onChange={(e) => setAddressData(prev => ({ ...prev, exterior_number: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="123"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Número int.</label>
                <input
                  value={addressData.interior_number}
                  onChange={(e) => setAddressData(prev => ({ ...prev, interior_number: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="A"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">C.P.</label>
                <input
                  value={addressData.cp}
                  onChange={(e) => setAddressData(prev => ({ ...prev, cp: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="97000"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Colonia</label>
                <input
                  value={addressData.neighborhood}
                  onChange={(e) => setAddressData(prev => ({ ...prev, neighborhood: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="Colonia"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">País</label>
                <select
                  value={selectedCountryId ?? ""}
                  onChange={handleCountryChange}
                  disabled={catalogLoading.countries}
                  className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
                >
                  <option value="">{catalogLoading.countries ? "Cargando países..." : "Selecciona un país"}</option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Estado</label>
                <SearchableSelect
                  id="profile-state"
                  value={states.find((state) => state.id === selectedStateId) ?? null}
                  options={states}
                  onChange={handleStateSelectChange}
                  placeholder={catalogLoading.states ? "Cargando estados..." : selectedCountryId ? "Selecciona un estado" : "Selecciona un país primero"}
                  searchPlaceholder="Buscar estado..."
                  disabled={!selectedCountryId || catalogLoading.states}
                  className="rounded-xl border-gray-200 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Ciudad</label>
                <SearchableSelect
                  id="profile-city"
                  value={cities.find((city) => normalizeCatalogText(city.name) === normalizeCatalogText(addressData.city)) ?? null}
                  options={cities}
                  onChange={handleCitySelectChange}
                  placeholder={catalogLoading.cities ? "Cargando ciudades..." : selectedStateId ? "Selecciona una ciudad" : "Selecciona un estado primero"}
                  searchPlaceholder="Buscar ciudad..."
                  disabled={!selectedStateId || catalogLoading.cities}
                  className="rounded-xl border-gray-200 focus:ring-primary/20"
                />
              </div>
            </div>
            {catalogError ? (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
                {catalogError}
              </div>
            ) : null}
            <div className="pt-2">
              <GoogleMapPicker
                location={mapLocation}
                onChange={setMapLocation}
                height="280px"
                className="rounded-xl overflow-hidden"
                addressLabel={addressData.address}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Seguridad</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Lock size={16} className="text-gray-400" />
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Dejar en blanco para mantener actual"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Lock size={16} className="text-gray-400" />
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Repite la contraseña"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90 text-white font-medium py-2.5 px-6 rounded-xl shadow-lg shadow-primary/30 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Guardando...
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  Guardar Cambios
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
