"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import GoogleMapPicker from "@/components/ui/GoogleMapPicker";
import { LatLngLiteral, parseMapLocation } from "@/lib/googleMaps";
import { Loader2, CheckCircle, Eye, EyeOff, User, Mail, Lock, Shield } from "lucide-react";

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
    country: "México"
  });
  const [mapLocation, setMapLocation] = useState<LatLngLiteral | null>(null);

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
          country: String(data.country || "México"),
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
      if (mapLocation) payload.map_location = JSON.stringify(mapLocation);

      const response = await fetchWithAuth(`/api/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error al actualizar perfil (${response.status})`);
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-full text-primary">
          <User size={32} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Mi Perfil</h1>
          <p className="text-gray-500">Administra tu información personal y de acceso.</p>
        </div>
      </div>

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
                <label className="text-sm font-medium text-gray-700">Ciudad</label>
                <input
                  value={addressData.city}
                  onChange={(e) => setAddressData(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="Mérida"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Estado</label>
                <input
                  value={addressData.state}
                  onChange={(e) => setAddressData(prev => ({ ...prev, state: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="Yucatán"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">País</label>
                <input
                  value={addressData.country}
                  onChange={(e) => setAddressData(prev => ({ ...prev, country: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="México"
                />
              </div>
            </div>
            <div className="pt-2">
              <GoogleMapPicker
                location={mapLocation}
                onChange={setMapLocation}
                addressContext={{
                  street: addressData.address,
                  exteriorNumber: addressData.exterior_number,
                  neighborhood: addressData.neighborhood,
                  postalCode: addressData.cp,
                  city: addressData.city,
                  state: addressData.state,
                  country: addressData.country
                }}
                height="280px"
                className="rounded-xl overflow-hidden"
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
