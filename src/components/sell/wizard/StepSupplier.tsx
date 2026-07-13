'use client';

import { useState, useEffect, type ClipboardEvent } from 'react';
import { Loader2, Truck, Store } from 'lucide-react';
import FileUpload from '@/components/ui/FileUpload';
import MapPicker from '@/components/ui/MapPicker';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { supplierCatalogService, type SupplierCatalogOption } from '@/services/supplierCatalogService';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
const DEFAULT_COUNTRY_ID = 1;
const DEFAULT_COUNTRY_NAME = 'Mexico';
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

const pasteAsPlainText = (event: ClipboardEvent<HTMLDivElement>) => {
  const text = event.clipboardData.getData("text/plain");
  if (!text) return;
  event.preventDefault();
  document.execCommand("insertText", false, text);
};

interface StepSupplierProps {
  userId: number;
  token: string;
  onSuccess: (supplierId: number) => void;
}

type SupplierListItem = {
  id: number;
  user_id?: number | string | null;
};

type ValidationError = {
  loc?: Array<string | number>;
  msg?: string;
};

type ErrorPayload = {
  detail?: string | ValidationError[] | unknown;
  backend_response?: string | unknown;
};

const pickSupplierItems = (payload: unknown): SupplierListItem[] => {
  const items: unknown[] = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).items)
      ? ((payload as Record<string, unknown>).items as unknown[])
      : [];

  return items.filter((item): item is SupplierListItem => {
    if (!item || typeof item !== "object") return false;
    const record = item as Record<string, unknown>;
    return Number.isFinite(Number(record.id));
  });
};

export default function StepSupplier({ userId, token, onSuccess }: StepSupplierProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const [formData, setFormData] = useState({
    name: '',
    rfc: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    country: DEFAULT_COUNTRY_NAME,
    is_active: true,
    short_description: '',
    address: '',
    exterior_number: '',
    interior_number: '',
    neighborhood: '',
    zip_code: '',
    cp: '',
    cross_street_1: '',
    cross_street_2: '',
    title_about: '',
    subtitle_about: '',
    about: '',
    transfer_accepted: false,
    transfer_clabe: '',
    transfer_bank: '',
    transfer_name: '',
    has_store: true,
    accepts_delivery: true,
    accepts_pickup: true,
    accepts_courier: false,
  });

  const [mapLocation, setMapLocation] = useState<{lat: number, lng: number} | null>(null);

  const [logo, setLogo] = useState<File | null>(null);
  const [aboutImage, setAboutImage] = useState<File | null>(null);

  const inputClassName = "h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500";

  useEffect(() => {
    // Check if supplier already exists for this user to avoid 500 Duplicate Key errors
    const checkExisting = async () => {
      if (!userId || !token) return;
      try {
        // Try to fetch by user_id first
        let res = await fetch(`/api/suppliers?user_id=${userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        let data: unknown = await res.json();
        let items = pickSupplierItems(data);
        let existing = items.find((supplier) => Number(supplier.user_id) === Number(userId));

        if (!existing) {
             // Fallback to fetching list with higher limit
             res = await fetch('/api/suppliers?limit=100', {
                headers: { Authorization: `Bearer ${token}` }
             });
             if (res.ok) {
                data = await res.json();
                items = pickSupplierItems(data);
                existing = items.find((supplier) => Number(supplier.user_id) === Number(userId));
             }
        }
          
        if (existing) {
            if (process.env.NODE_ENV === "development") console.log("Supplier already exists, advancing...", existing);
            onSuccess(existing.id);
        }
      } catch (e) {
        console.error("Error checking existing supplier", e);
      }
    };
    
    checkExisting();
  }, [userId, token, onSuccess]);

  useEffect(() => {
    let active = true;

    const loadCountries = async () => {
      setCatalogLoading((prev) => ({ ...prev, countries: true }));
      try {
        const items = await supplierCatalogService.countries();
        if (!active) return;
        const countryOptions = items.length > 0 ? items : [DEFAULT_COUNTRY_OPTION];
        setCountries(countryOptions);
        setCatalogError(null);
        const defaultCountry = countryOptions.find((item) => item.name.toLowerCase() === DEFAULT_COUNTRY_NAME.toLowerCase()) ?? DEFAULT_COUNTRY_OPTION;
        setSelectedCountryId(defaultCountry.id);
        setFormData((prev) => ({ ...prev, country: defaultCountry.name }));
      } catch (e) {
        console.error("Error loading supplier countries", e);
        if (active) {
          setCountries([DEFAULT_COUNTRY_OPTION]);
          setSelectedCountryId(DEFAULT_COUNTRY_ID);
          setFormData((prev) => ({ ...prev, country: DEFAULT_COUNTRY_NAME }));
          setCatalogError(null);
        }
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

    const loadStates = async () => {
      setCatalogLoading((prev) => ({ ...prev, states: true }));
      try {
        const items = await supplierCatalogService.states(selectedCountryId);
        if (!active) return;
        setStates(items);
        if (items.length === 0) setCatalogError("No encontramos estados para el país seleccionado.");
      } catch (e) {
        console.error("Error loading supplier states", e);
        if (active) setStates([]);
        if (active) setCatalogError("No pudimos cargar los estados.");
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

    const loadCities = async () => {
      setCatalogLoading((prev) => ({ ...prev, cities: true }));
      try {
        const items = await supplierCatalogService.cities(selectedStateId);
        if (!active) return;
        setCities(items);
        if (items.length === 0) setCatalogError("No encontramos ciudades para el estado seleccionado.");
      } catch (e) {
        console.error("Error loading supplier cities", e);
        if (active) setCities([]);
        if (active) setCatalogError("No pudimos cargar las ciudades.");
      } finally {
        if (active) setCatalogLoading((prev) => ({ ...prev, cities: false }));
      }
    };

    loadCities();
    return () => {
      active = false;
    };
  }, [selectedStateId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    if (target.name === 'cp') {
      setFormData({ ...formData, cp: String(value), zip_code: String(value) });
      return;
    }
    if (target.name === 'zip_code') {
      setFormData({ ...formData, zip_code: String(value), cp: String(value) });
      return;
    }
    if (target.name === 'has_store') {
      const hasStore = Boolean(value);
      setFormData({
        ...formData,
        has_store: hasStore,
        accepts_delivery: hasStore ? formData.accepts_delivery : false,
        accepts_pickup: hasStore ? formData.accepts_pickup : false,
        accepts_courier: hasStore && formData.accepts_delivery ? formData.accepts_courier : false,
      });
      return;
    }
    if (target.name === 'accepts_delivery') {
      const acceptsDelivery = Boolean(value);
      setFormData({
        ...formData,
        accepts_delivery: acceptsDelivery,
        accepts_courier: acceptsDelivery ? formData.accepts_courier : false,
      });
      return;
    }
    if (target.name === 'accepts_courier' && !formData.accepts_delivery) return;
    setFormData({ ...formData, [target.name]: value });
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const rawCountryId = e.target.value;
    const countryId = Number(rawCountryId);
    const country = countries.find((item) => item.id === countryId);
    setCatalogError(null);
    setSelectedCountryId(rawCountryId && Number.isFinite(countryId) ? countryId : null);
    setSelectedStateId(null);
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
    setCities([]);
    setFormData((prev) => ({
      ...prev,
      state: state?.name ?? "",
      city: "",
    }));
  };

  const handleCitySelectChange = (city: SupplierCatalogOption | null) => {
    setCatalogError(null);
    setFormData((prev) => ({
      ...prev,
      city: city?.name ?? "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!userId) {
      setError("Error: No se ha identificado el usuario. Por favor intente registrarse nuevamente.");
      setLoading(false);
      return;
    }
    if (formData.has_store && !formData.accepts_delivery && !formData.accepts_pickup) {
      setError("Selecciona al menos una opción de entrega.");
      setLoading(false);
      return;
    }

    try {
      const data = new FormData();
      
      // Helper to append - sends empty string if value is falsy, which is safer for some backends
      const append = (key: string, value: string) => {
        data.append(key, value ? value.trim() : '');
      };

      // Add text fields
      append('name', formData.name);

      append('rfc', formData.rfc);
      append('phone', formData.phone);
      append('email', formData.email);
      append('city', formData.city);
      append('state', formData.state);
      append('country', formData.country);
      append('short_description', formData.short_description);
      append('address', formData.address);
      append('exterior_number', formData.exterior_number);
      append('interior_number', formData.interior_number);
      append('neighborhood', formData.neighborhood);
      append('zip_code', formData.zip_code);
      append('cp', formData.cp);
      append('cross_street_1', formData.cross_street_1);
      append('cross_street_2', formData.cross_street_2);
      append('title_about', formData.title_about);
      append('subtitle_about', formData.subtitle_about);
      append('about', formData.about);

      data.append('accepts_delivery', String(formData.accepts_delivery));
      data.append('accepts_pickup', String(formData.accepts_pickup));
      data.append('accepts_courier', String(formData.accepts_courier));
      data.append('has_store', String(formData.has_store));

      if (mapLocation) {
        data.append('map_location', JSON.stringify(mapLocation));
      }
      
      // Add user_id
      data.append('user_id', userId.toString());
      data.append('is_active', String(formData.is_active));

      // Transfer data
      if (formData.transfer_accepted) {
          if (!formData.transfer_clabe || !/^\d{18}$/.test(formData.transfer_clabe)) {
              setError("La CLABE debe tener 18 dígitos numéricos.");
              setLoading(false);
              return;
          }
          if (!formData.transfer_bank) {
              setError("El nombre del banco es obligatorio si acepta transferencias.");
              setLoading(false);
              return;
          }
          if (!formData.transfer_name) {
              setError("El nombre del beneficiario es obligatorio si acepta transferencias.");
              setLoading(false);
              return;
          }

          data.append('transfer_accepted', 'true');
          data.append('transfer_clabe', formData.transfer_clabe);
          data.append('transfer_bank', formData.transfer_bank);
          data.append('transfer_name', formData.transfer_name);
      } else {
          data.append('transfer_accepted', 'false');
      }

      if (logo) data.append('logo', logo);
      if (aboutImage) {
        data.append('about_media', aboutImage);
        data.append('about_image', aboutImage);
      }

      const debugEntries: Array<{ key: string; value: unknown }> = [];
      data.forEach((v, k) => {
        if (v instanceof File) {
          debugEntries.push({
            key: k,
            value: {
              name: v.name,
              type: v.type,
              size: v.size,
            },
          });
        } else {
          debugEntries.push({ key: k, value: v });
        }
      });
      if (process.env.NODE_ENV === "development") console.log("[StepSupplier] FormData debug", debugEntries);

      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Content-Type is set automatically for FormData
        },
        body: data,
      });

      if (!response.ok) {
        const errData: ErrorPayload = await response.json().catch(() => ({}));
        let errorMessage = `Error ${response.status}: ${response.statusText}`;
        
        if (errData.detail) {
            if (typeof errData.detail === 'string') {
                errorMessage = errData.detail;
            } else if (Array.isArray(errData.detail)) {
                // Pydantic/FastAPI validation errors
                errorMessage = errData.detail.map((err) => `${err.loc?.join('.') ?? 'campo'} : ${err.msg ?? 'valor inválido'}`).join(', ');
            } else {
                errorMessage = JSON.stringify(errData.detail);
            }
        }

        // Include backend_response if available (from proxy)
        if (errData.backend_response) {
            errorMessage += ` | Detalles: ${typeof errData.backend_response === 'string' ? errData.backend_response : JSON.stringify(errData.backend_response)}`;
        }
        
        // Show error in UI instead of throwing to avoid Next.js overlay
        setError(errorMessage);
        setLoading(false);
        return; 
      }

      const result = await response.json();
      onSuccess(result.id);

    } catch (err: unknown) {
      console.error("Error submitting supplier:", err);
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column: Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Datos Generales</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Empresa</label>
              <input 
                type="text" 
                name="name" 
                required 
                value={formData.name} 
                onChange={handleChange} 
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RFC</label>
                <input 
                  type="text" 
                  name="rfc" 
                  value={formData.rfc} 
                  onChange={handleChange} 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input 
                  type="text" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleChange} 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Público</label>
              <input 
                type="email" 
                name="email" 
                value={formData.email} 
                onChange={handleChange} 
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
              />
            </div>

            <div className="pt-4 mt-2 border-t border-gray-200 space-y-3">
              <h4 className="text-base font-semibold text-gray-900">Opciones de Entrega</h4>
              <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  name="has_store"
                  checked={formData.has_store}
                  onChange={handleChange}
                  className="mt-1 rounded text-primary focus:ring-primary"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <Store size={16} className="text-primary" />
                    Tendré tienda
                  </span>
                  <span className="block text-xs text-gray-500 mt-1">Activa las opciones de entrega para tu sucursal.</span>
                </span>
              </label>

              {formData.has_store && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    name="accepts_delivery"
                    checked={formData.accepts_delivery}
                    onChange={handleChange}
                    className="mt-1 rounded text-primary focus:ring-primary"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <Truck size={16} className="text-primary" />
                      Envío a domicilio
                    </span>
                    <span className="block text-xs text-gray-500 mt-1">Mostrar esta opción en el carrito.</span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    name="accepts_pickup"
                    checked={formData.accepts_pickup}
                    onChange={handleChange}
                    className="mt-1 rounded text-primary focus:ring-primary"
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                      <Store size={16} className="text-primary" />
                      Recoger en tienda
                    </span>
                    <span className="block text-xs text-gray-500 mt-1">Permitir recolección en sucursal.</span>
                  </span>
                </label>
                  </div>

                  {formData.accepts_delivery && (
                    <div className="mt-3">
                      <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          name="accepts_courier"
                          checked={formData.accepts_courier}
                          onChange={handleChange}
                          className="mt-1 rounded text-primary focus:ring-primary"
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                            Aceptar envíos
                          </span>
                          <span className="block text-xs text-gray-500 mt-1">Habilitar envíos con dirección, distancia y costo.</span>
                        </span>
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right Column: Address */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Ubicación</h3>
            {catalogError ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {catalogError}
              </p>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
                <select
                  name="country"
                  value={selectedCountryId ?? ""}
                  onChange={handleCountryChange}
                  disabled={catalogLoading.countries}
                  className={inputClassName}
                >
                  <option value="">{catalogLoading.countries ? "Cargando países..." : "Selecciona un país"}</option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                 <SearchableSelect
                   id="wizard-supplier-state"
                   value={states.find((state) => state.id === selectedStateId) ?? null}
                   options={states}
                   onChange={handleStateSelectChange}
                   placeholder={catalogLoading.states ? "Cargando estados..." : selectedCountryId ? "Selecciona un estado" : "Selecciona un país primero"}
                   searchPlaceholder="Buscar estado..."
                   emptyLabel="No hay estados"
                   disabled={!selectedCountryId || catalogLoading.states}
                 />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                <SearchableSelect
                  id="wizard-supplier-city"
                  value={cities.find((city) => normalizeCatalogText(city.name) === normalizeCatalogText(formData.city)) ?? null}
                  options={cities}
                  onChange={handleCitySelectChange}
                  placeholder={catalogLoading.cities ? "Cargando ciudades..." : selectedStateId ? "Selecciona una ciudad" : "Selecciona un estado primero"}
                  searchPlaceholder="Buscar ciudad..."
                  emptyLabel="No hay ciudades"
                  disabled={!selectedStateId || catalogLoading.cities}
                />
              </div>
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Colonia</label>
                <input 
                  type="text" 
                  name="neighborhood" 
                  value={formData.neighborhood} 
                  onChange={handleChange} 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Calle</label>
              <input 
                type="text" 
                name="address" 
                value={formData.address} 
                onChange={handleChange} 
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Exterior</label>
                <input 
                  type="text" 
                  name="exterior_number" 
                  value={formData.exterior_number} 
                  onChange={handleChange} 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Interior</label>
                <input 
                  type="text" 
                  name="interior_number" 
                  value={formData.interior_number} 
                  onChange={handleChange} 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">C.P.</label>
                <input 
                  type="text" 
                  name="cp" 
                  value={formData.cp} 
                  onChange={handleChange} 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entre calle 1</label>
                <input 
                  type="text" 
                  name="cross_street_1" 
                  value={formData.cross_street_1} 
                  onChange={handleChange} 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                  placeholder="Ej. Calle 35"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entre calle 2</label>
                <input 
                  type="text" 
                  name="cross_street_2" 
                  value={formData.cross_street_2} 
                  onChange={handleChange} 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                  placeholder="Ej. Calle 37"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación en Mapa</label>
              <MapPicker 
                location={mapLocation} 
                onChange={setMapLocation}
                height="300px"
              />
              <p className="text-xs text-gray-500 mt-1">Busca una dirección o haz clic en el mapa para establecer la ubicación.</p>
            </div>
          </div>

          {/* Full Width: Description, Files & Transfer Data */}
          <div className="md:col-span-2 space-y-4 pt-4">
             <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Perfil Detallado</h3>
             
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Descripción Corta (SEO)</label>
               <input 
                 type="text" 
                 name="short_description" 
                 value={formData.short_description} 
                 onChange={handleChange} 
                 className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                 maxLength={160} 
               />
             </div>
  
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                <h4 className="mb-4 text-sm font-semibold text-[#004e28]">Sobre Nosotros</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                    <input
                      type="text"
                      name="title_about"
                      value={formData.title_about}
                      onChange={handleChange}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="Ej. Más que un proveedor"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo</label>
                    <input
                      type="text"
                      name="subtitle_about"
                      value={formData.subtitle_about}
                      onChange={handleChange}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="Ej. Tu aliado estratégico"
                    />
                  </div>
                </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Historia (HTML)</label>
                <div className="border border-gray-300 rounded-md overflow-hidden bg-white" onPasteCapture={pasteAsPlainText}>
                  <ReactQuill
                    theme="snow"
                    value={formData.about}
                    onChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        about: value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
  
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
               <FileUpload
                   label="Logo de la Empresa"
                   value={logo}
                   onChange={setLogo}
                   helperText="Recomendado: Formato cuadrado, mín. 400x400px"
               />
               <FileUpload
                   label="Imagen 'Sobre Nosotros'"
                   value={aboutImage}
                   onChange={setAboutImage}
                   accept="image/*"
                   helperText="Formatos recomendados: JPG/PNG"
               />
             </div>

             <div className="pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Datos Bancarios para Transferencias</h3>
                
                <div className="flex items-center gap-2 mb-4">
                    <input 
                        type="checkbox" 
                        id="transfer_accepted"
                        name="transfer_accepted" 
                        checked={formData.transfer_accepted} 
                        onChange={handleChange}
                        className="h-5 w-5 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <label htmlFor="transfer_accepted" className="text-gray-700 font-medium select-none cursor-pointer">
                        Acepto recibir pagos por transferencia bancaria
                    </label>
                </div>
    
                {formData.transfer_accepted && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 rounded-lg">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Beneficiario</label>
                            <input 
                                type="text" 
                                name="transfer_name" 
                                value={formData.transfer_name} 
                                onChange={handleChange} 
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="Nombre completo del titular de la cuenta"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                            <input 
                                type="text" 
                                name="transfer_bank" 
                                value={formData.transfer_bank} 
                                onChange={handleChange} 
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="Ej. BBVA, Santander"
                            />
                        </div>
    
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">CLABE Interbancaria</label>
                            <input 
                                type="text" 
                                name="transfer_clabe" 
                                value={formData.transfer_clabe} 
                                onChange={(e) => {
                                    const val = e.target.value.replace(/\D/g, '').slice(0, 18);
                                    setFormData({ ...formData, transfer_clabe: val });
                                }} 
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                                placeholder="18 dígitos"
                            />
                            <p className="text-xs text-gray-500 mt-1">Debe contener exactamente 18 dígitos.</p>
                        </div>
                    </div>
                )}
              </div>
          </div>
        </div>
        <div className="flex justify-end pt-6">
         <button
           type="submit"
           disabled={loading}
           className="bg-primary text-white font-bold py-3 px-8 rounded-lg hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
         >
           {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Guardando...
            </>
           ) : (
             'Guardar y Continuar'
           )}
         </button>
      </div>
    </form>
  );
}
