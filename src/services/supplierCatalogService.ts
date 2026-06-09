import { fetchWithAuth } from "@/lib/api";

export interface SupplierCatalogOption {
  id: number;
  name: string;
}

const MEXICO_STATE_OPTIONS: SupplierCatalogOption[] = [
  { id: 1, name: "Aguascalientes" },
  { id: 2, name: "Baja California" },
  { id: 3, name: "Baja California Sur" },
  { id: 4, name: "Campeche" },
  { id: 5, name: "Coahuila" },
  { id: 6, name: "Colima" },
  { id: 7, name: "Chiapas" },
  { id: 8, name: "Chihuahua" },
  { id: 9, name: "Ciudad de México" },
  { id: 10, name: "Durango" },
  { id: 11, name: "Guanajuato" },
  { id: 12, name: "Guerrero" },
  { id: 13, name: "Hidalgo" },
  { id: 14, name: "Jalisco" },
  { id: 15, name: "México" },
  { id: 16, name: "Michoacán" },
  { id: 17, name: "Morelos" },
  { id: 18, name: "Nayarit" },
  { id: 19, name: "Nuevo León" },
  { id: 20, name: "Oaxaca" },
  { id: 21, name: "Puebla" },
  { id: 22, name: "Querétaro" },
  { id: 23, name: "Quintana Roo" },
  { id: 24, name: "San Luis Potosí" },
  { id: 25, name: "Sinaloa" },
  { id: 26, name: "Sonora" },
  { id: 27, name: "Tabasco" },
  { id: 28, name: "Tamaulipas" },
  { id: 29, name: "Tlaxcala" },
  { id: 30, name: "Veracruz" },
  { id: 31, name: "Yucatán" },
  { id: 32, name: "Zacatecas" },
];

const pickArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const items =
      record.items ??
      record.results ??
      record.data ??
      record.countries ??
      record.states ??
      record.cities ??
      record.municipalities ??
      record.municipios;
    if (Array.isArray(items)) return items;
  }
  return [];
};

const normalizeOption = (value: unknown): SupplierCatalogOption | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = Number(
    record.id ??
    record.country_id ??
    record.state_id ??
    record.city_id ??
    record.municipality_id ??
    record.countryId ??
    record.stateId ??
    record.cityId ??
    record.municipalityId ??
    record.id_pais ??
    record.id_estado ??
    record.id_ciudad ??
    record.id_municipio ??
    record.pais_id ??
    record.estado_id ??
    record.ciudad_id ??
    record.municipio_id ??
    record.value,
  );
  const name =
    (typeof record.name === "string" && record.name.trim()) ||
    (typeof record.nombre === "string" && record.nombre.trim()) ||
    (typeof record.label === "string" && record.label.trim()) ||
    (typeof record.country === "string" && record.country.trim()) ||
    (typeof record.country_name === "string" && record.country_name.trim()) ||
    (typeof record.countryName === "string" && record.countryName.trim()) ||
    (typeof record.pais === "string" && record.pais.trim()) ||
    (typeof record.nombre_pais === "string" && record.nombre_pais.trim()) ||
    (typeof record.state === "string" && record.state.trim()) ||
    (typeof record.state_name === "string" && record.state_name.trim()) ||
    (typeof record.stateName === "string" && record.stateName.trim()) ||
    (typeof record.estado === "string" && record.estado.trim()) ||
    (typeof record.nombre_estado === "string" && record.nombre_estado.trim()) ||
    (typeof record.city === "string" && record.city.trim()) ||
    (typeof record.city_name === "string" && record.city_name.trim()) ||
    (typeof record.cityName === "string" && record.cityName.trim()) ||
    (typeof record.ciudad === "string" && record.ciudad.trim()) ||
    (typeof record.nombre_ciudad === "string" && record.nombre_ciudad.trim()) ||
    (typeof record.municipality === "string" && record.municipality.trim()) ||
    (typeof record.municipality_name === "string" && record.municipality_name.trim()) ||
    (typeof record.municipalityName === "string" && record.municipalityName.trim()) ||
    (typeof record.municipio === "string" && record.municipio.trim()) ||
    (typeof record.nombre_municipio === "string" && record.nombre_municipio.trim()) ||
    "";

  if (!Number.isFinite(id) || !name) return null;
  return { id, name };
};

const fetchCatalog = async (path: string): Promise<SupplierCatalogOption[]> => {
  const res = await fetchWithAuth(path);
  if (!res.ok) return [];
  const payload: unknown = await res.json();
  return pickArray(payload).map(normalizeOption).filter((item): item is SupplierCatalogOption => Boolean(item));
};

export const supplierCatalogService = {
  countries: () => fetchCatalog("/api/suppliers/catalogs/countries"),
  states: async (countryId: number) => {
    const items = await fetchCatalog(`/api/suppliers/catalogs/states?country_id=${countryId}`);
    if (items.length > 0) return items;
    return countryId === 1 ? MEXICO_STATE_OPTIONS : [];
  },
  cities: (stateId: number) => fetchCatalog(`/api/suppliers/catalogs/cities?state_id=${stateId}`),
};
