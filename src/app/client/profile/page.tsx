"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
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
        console.log("Testing profile APIs...");
        
        const [resMe, resId] = await Promise.allSettled([
          fetchWithAuth('/api/users/me'),
          fetchWithAuth(`/api/users/${user.id}`)
        ]);

        let profileData = null;
        let usedSource = "";

        // Check /api/users/me
        if (resMe.status === 'fulfilled' && resMe.value.ok) {
            const data = await resMe.value.json();
            console.log("/api/users/me response:", data);
            if (data && (data.email || data.name)) {
                profileData = data;
                usedSource = "/api/users/me";
            }
        }

        // Check /api/users/{id} if me didn't yield good data or just to compare
        if (resId.status === 'fulfilled' && resId.value.ok) {
            const data = await resId.value.json();
            console.log(`/api/users/${user.id} response:`, data);
            
            // If we haven't found data yet, or if this one seems more complete (e.g. has name where other didn't)
            if (!profileData || (!profileData.name && data.name)) {
                profileData = data;
                usedSource = `/api/users/${user.id}`;
            }
        }

        if (profileData) {
            console.log(`Using data from ${usedSource}:`, profileData);
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
      console.log("Profile updated:", updatedUser);
      
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
