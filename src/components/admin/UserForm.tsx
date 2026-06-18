"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { supplierCatalogService, type SupplierCatalogOption } from "@/services/supplierCatalogService";
import { fetchWithAuth } from "@/lib/api";

interface User {
  id: number;
  email: string;
  is_active: boolean;
  is_superuser?: boolean;
  name?: string;
  full_name?: string;
  role?: string;
  city?: string;
  state?: string;
  country?: string;
  city_id?: number | null;
  state_id?: number | null;
  country_id?: number | null;
}

interface UserFormData {
  email: string;
  name: string;
  password: string;
  is_active: boolean;
  role: string;
  city: string;
  state: string;
  country: string;
}

interface UserPayload {
  email: string;
  name: string;
  last_name?: string;
  second_last_name?: string;
  is_active: boolean;
  role: string;
  city_id?: number;
  state_id?: number;
  country_id?: number;
  password?: string;
}

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

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const name = parts[0] ?? "";
  const lastName = parts.length > 1 ? parts[1] : "";
  const secondLastName = parts.length > 2 ? parts.slice(2).join(" ") : "";

  return {
    name,
    last_name: lastName,
    second_last_name: secondLastName,
  };
}

const initialFormData: UserFormData = {
  email: "",
  name: "",
  password: "",
  is_active: true,
  role: "client",
  city: "",
  state: "",
  country: DEFAULT_COUNTRY_NAME,
};

interface UserFormProps {
  initialData?: User;
  isEditMode?: boolean;
  isProfileMode?: boolean;
  fixedRole?: string;
  returnPath?: string;
  submitLabel?: string;
}

export default function UserForm({
  initialData,
  isEditMode = false,
  isProfileMode = false,
  fixedRole,
  returnPath = "/admin/users",
  submitLabel = "Guardar Usuario",
}: UserFormProps) {
  const { token } = useAuthStore();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState<UserFormData>(
    initialData
      ? {
          email: initialData.email,
          name: initialData.full_name || initialData.name || "",
          password: "", // Password usually not returned
          is_active: initialData.is_active,
          role: fixedRole || initialData.role || "client",
          city: initialData.city || "",
          state: initialData.state || "",
          country: initialData.country || DEFAULT_COUNTRY_NAME,
        }
      : { ...initialFormData, role: fixedRole || initialFormData.role }
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState({
    countries: false,
    states: false,
    cities: false,
  });
  const [countries, setCountries] = useState<SupplierCatalogOption[]>([DEFAULT_COUNTRY_OPTION]);
  const [states, setStates] = useState<SupplierCatalogOption[]>([]);
  const [cities, setCities] = useState<SupplierCatalogOption[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(initialData?.country_id ?? DEFAULT_COUNTRY_ID);
  const [selectedStateId, setSelectedStateId] = useState<number | null>(initialData?.state_id ?? null);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(initialData?.city_id ?? null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadCountries = async () => {
      setCatalogLoading((prev) => ({ ...prev, countries: true }));
      try {
        const items = await supplierCatalogService.countries();
        if (!active) return;

        const countryOptions = items.length > 0 ? items : [DEFAULT_COUNTRY_OPTION];
        const currentCountry = formData.country || DEFAULT_COUNTRY_NAME;
        const selectedCountry =
          (initialData?.country_id ? countryOptions.find((item) => item.id === initialData.country_id) : null) ??
          countryOptions.find((item) => normalizeCatalogText(item.name) === normalizeCatalogText(currentCountry)) ??
          countryOptions.find((item) => normalizeCatalogText(item.name) === normalizeCatalogText(DEFAULT_COUNTRY_NAME)) ??
          DEFAULT_COUNTRY_OPTION;

        setCountries(countryOptions);
        setSelectedCountryId(selectedCountry.id);
        setFormData((prev) => ({ ...prev, country: selectedCountry.name }));
        setCatalogError(null);
      } catch {
        if (!active) return;
        setCountries([DEFAULT_COUNTRY_OPTION]);
        setSelectedCountryId(DEFAULT_COUNTRY_ID);
        setFormData((prev) => ({ ...prev, country: DEFAULT_COUNTRY_NAME }));
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
    const currentState = formData.state;

    const loadStates = async () => {
      setCatalogLoading((prev) => ({ ...prev, states: true }));
      try {
        const items = await supplierCatalogService.states(selectedCountryId);
        if (!active) return;

        setStates(items);
        const selectedState =
          (initialData?.state_id ? items.find((item) => item.id === initialData.state_id) : null) ??
          (currentState
          ? items.find((item) => normalizeCatalogText(item.name) === normalizeCatalogText(currentState))
          : null);

        if (selectedState) {
          setSelectedStateId(selectedState.id);
          setFormData((prev) => ({ ...prev, state: selectedState.name }));
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
    const currentCity = formData.city;

    const loadCities = async () => {
      setCatalogLoading((prev) => ({ ...prev, cities: true }));
      try {
        const items = await supplierCatalogService.cities(selectedStateId);
        if (!active) return;

        setCities(items);
        const selectedCity =
          (initialData?.city_id ? items.find((item) => item.id === initialData.city_id) : null) ??
          (currentCity
          ? items.find((item) => normalizeCatalogText(item.name) === normalizeCatalogText(currentCity))
          : null);

        if (selectedCity) {
          setSelectedCityId(selectedCity.id);
          setFormData((prev) => ({ ...prev, city: selectedCity.name }));
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
    setSelectedCityId(null);
    setStates([]);
    setCities([]);
    setFormData((prev) => ({
      ...prev,
      country: country?.name ?? "",
      state: "",
      city: "",
    }));
  };

  const handleStateSelectChange = (state: SupplierCatalogOption | null) => {
    setCatalogError(null);
    setSelectedStateId(state?.id ?? null);
    setSelectedCityId(null);
    setCities([]);
    setFormData((prev) => ({
      ...prev,
      state: state?.name ?? "",
      city: "",
    }));
  };

  const handleCitySelectChange = (city: SupplierCatalogOption | null) => {
    setCatalogError(null);
    setSelectedCityId(city?.id ?? null);
    setFormData((prev) => ({ ...prev, city: city?.name ?? "" }));
  };

  const buildBasePayload = (): UserPayload => ({
    email: formData.email.trim(),
    ...splitFullName(formData.name),
    is_active: formData.is_active,
    role: fixedRole || formData.role,
  });

  const buildLocationPayload = () => {
    const payload: Pick<UserPayload, "city_id" | "state_id" | "country_id"> = {};

    if (selectedCityId) payload.city_id = selectedCityId;
    if (selectedStateId) payload.state_id = selectedStateId;
    if (selectedCountryId) payload.country_id = selectedCountryId;

    return payload;
  };

  const readErrorMessage = async (response: Response) => {
    let errorMessage = `Error ${response.status}: Error al guardar usuario`;
    const friendlyDuplicateMessage =
      "Ese correo ya existe en el sistema. Usa otro correo o edita el usuario existente.";
    try {
      const text = await response.text();
      try {
        const errorData = JSON.parse(text);
        if (errorData.detail) {
          const detail = typeof errorData.detail === "string"
            ? errorData.detail
            : JSON.stringify(errorData.detail);
          errorMessage = `Error ${response.status}: ${detail}`;
        }
      } catch {
        errorMessage = `Error ${response.status}: ${text || response.statusText}`;
      }
    } catch {
      errorMessage = `Error ${response.status}: ${response.statusText}`;
    }

    const normalizedMessage = errorMessage.toLowerCase();
    if (
      response.status === 400 &&
      (normalizedMessage.includes("already exists") ||
        normalizedMessage.includes("duplicate") ||
        normalizedMessage.includes("unique") ||
        normalizedMessage.includes("username") ||
        normalizedMessage.includes("email") ||
        normalizedMessage.includes("correo") ||
        normalizedMessage.includes("no pudimos completar el registro"))
    ) {
      return friendlyDuplicateMessage;
    }

    return errorMessage;
  };

  const submitUserPayload = async (url: string, method: "POST" | "PUT", payload: UserPayload) => {
    return fetchWithAuth(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("No hay sesión activa");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const url = isEditMode && initialData ? `/api/users/${initialData.id}` : "/api/users/";
      const method = isEditMode ? "PUT" : "POST";

      const locationPayload = buildLocationPayload();
      const payload: UserPayload = {
        ...buildBasePayload(),
        ...locationPayload,
      };

      // Only include password if it's provided (or if creating a new user)
      if (formData.password) {
        payload.password = formData.password;
      } else if (!isEditMode) {
        throw new Error("La contraseña es obligatoria para nuevos usuarios");
      }

      let response = await submitUserPayload(url, method, payload);

      if (!response.ok && !isEditMode && Object.keys(locationPayload).length > 0) {
        await readErrorMessage(response);

        const fallbackPayload: UserPayload = {
          ...buildBasePayload(),
          password: payload.password,
        };

        response = await submitUserPayload(url, method, fallbackPayload);
      }

      if (!response.ok) {
        const errorMessage = await readErrorMessage(response);
        throw new Error(errorMessage);
      }

      router.push(returnPath);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al guardar usuario");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Nombre Completo</label>
          <input
            type="text"
            name="name"
            required
            value={formData.name}
            onChange={handleInputChange}
            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            name="email"
            required
            value={formData.email}
            onChange={handleInputChange}
            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Contraseña {isEditMode && <span className="text-gray-400 font-normal">(Dejar en blanco para no cambiar)</span>}
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              required={!isEditMode && !isProfileMode}
              value={formData.password}
              onChange={handleInputChange}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {!isProfileMode && (
          <>
            {!fixedRole && <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Rol</label>
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="client">Cliente</option>
                <option value="admin">Administrador</option>
              </select>
            </div>}

            <div className="col-span-2 space-y-2 flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                name="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <label htmlFor="is_active" className="text-sm font-medium text-gray-700 select-none cursor-pointer">
                Usuario Activo
              </label>
            </div>
          </>
        )}
      </div>

      <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Ubicación</h2>
          <p className="mt-1 text-sm text-gray-500">Estos datos se guardan en el usuario.</p>
        </div>

        {catalogError ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-600">
            {catalogError}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">País</label>
            <select
              name="country"
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
              id="admin-user-state"
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
              id="admin-user-city"
              value={cities.find((city) => normalizeCatalogText(city.name) === normalizeCatalogText(formData.city)) ?? null}
              options={cities}
              onChange={handleCitySelectChange}
              placeholder={catalogLoading.cities ? "Cargando ciudades..." : selectedStateId ? "Selecciona una ciudad" : "Selecciona un estado primero"}
              searchPlaceholder="Buscar ciudad..."
              disabled={!selectedStateId || catalogLoading.cities}
              className="rounded-xl border-gray-200 focus:ring-primary/20"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={() => router.push(returnPath)}
          className="cursor-pointer px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
          disabled={isSubmitting}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="cursor-pointer px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Guardando...
            </>
          ) : (
            <>
              <CheckCircle size={18} />
              {submitLabel}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
