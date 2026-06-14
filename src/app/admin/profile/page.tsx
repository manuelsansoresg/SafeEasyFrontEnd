"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import { PageHero } from "@/components/ui/PageHero";
import { Loader2, CheckCircle, Eye, EyeOff, User, Mail, Lock, Shield } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const { user, token } = useAuthStore();
  const router = useRouter();
  
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

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!user || !token) return;

      setLoading(true);
      setError(null);

      try {
        // Test both APIs as requested to see which one works best
        if (process.env.NODE_ENV === "development") console.log("Testing profile APIs...");
        
        const [resMe, resId] = await Promise.allSettled([
          fetchWithAuth('/api/users/me'),
          fetchWithAuth(`/api/users/${user.id}`)
        ]);

        let profileData = null;
        let usedSource = "";

        // Check /api/users/me
        if (resMe.status === 'fulfilled' && resMe.value.ok) {
            const data = await resMe.value.json();
            if (process.env.NODE_ENV === "development") console.log("/api/users/me response:", data);
            if (data && (data.email || data.name)) {
                profileData = data;
                usedSource = "/api/users/me";
            }
        }

        // Check /api/users/{id} if me didn't yield good data or just to compare
        if (resId.status === 'fulfilled' && resId.value.ok) {
            const data = await resId.value.json();
            if (process.env.NODE_ENV === "development") console.log(`/api/users/${user.id} response:`, data);
            
            // If we haven't found data yet, or if this one seems more complete (e.g. has name where other didn't)
            if (!profileData || (!profileData.name && data.name)) {
                profileData = data;
                usedSource = `/api/users/${user.id}`;
            }
        }

        if (profileData) {
            if (process.env.NODE_ENV === "development") console.log(`Using data from ${usedSource}:`, profileData);
            setFormData(prev => ({
                ...prev,
                name: profileData.full_name || profileData.name || "",
                email: profileData.email || ""
            }));
        } else {
            setError("No se pudieron cargar los datos del perfil. Intente recargar.");
            console.error("Both APIs failed to return usable profile data");
        }

      } catch (err: any) {
        console.error("Error fetching profile:", err);
        setError(err.message || "Error al cargar perfil");
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
      const payload: any = {
        name: formData.name,
        email: formData.email,
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

      const updatedUser = await response.json();
      if (process.env.NODE_ENV === "development") console.log("Profile updated:", updatedUser);
      
      setSuccessMessage("Perfil actualizado correctamente");
      
      // Update store user data if needed (though store usually persists login data)
      // Note: We might want to update the global auth store state here if the name changed
      
      // Clear password fields
      setFormData(prev => ({
        ...prev,
        password: "",
        confirmPassword: ""
      }));

    } catch (err: any) {
      console.error("Update error:", err);
      setError(err.message || "Error al guardar los cambios");
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
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="Tu nombre completo"
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
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="tu@email.com"
              />
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">Seguridad</h2>
            <p className="text-sm text-gray-500">Deja los campos de contraseña vacíos si no deseas cambiarla.</p>

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
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
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
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Guardando cambios...
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
