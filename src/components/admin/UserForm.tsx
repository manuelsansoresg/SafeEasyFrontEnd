"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";

interface User {
  id: number;
  email: string;
  is_active: boolean;
  is_superuser?: boolean;
  name?: string;
  full_name?: string;
  role?: string;
}

interface UserFormData {
  email: string;
  name: string;
  password: string;
  is_active: boolean;
  role: string;
}

interface UserPayload {
  email: string;
  name: string;
  is_active: boolean;
  role: string;
  password?: string;
}

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return `${base.replace(/\/$/, "")}${path}`;
};

const initialFormData: UserFormData = {
  email: "",
  name: "",
  password: "",
  is_active: true,
  role: "client",
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
        }
      : { ...initialFormData, role: fixedRole || initialFormData.role }
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const url = isEditMode && initialData ? apiUrl(`/users/${initialData.id}`) : apiUrl("/users/");
      const method = isEditMode ? "PUT" : "POST";

      const payload: UserPayload = {
        email: formData.email,
        name: formData.name,
        is_active: formData.is_active,
        role: fixedRole || formData.role,
      };

      // Only include password if it's provided (or if creating a new user)
      if (formData.password) {
        payload.password = formData.password;
      } else if (!isEditMode) {
        throw new Error("La contraseña es obligatoria para nuevos usuarios");
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${token.replace(/^bearer\s+/i, "").trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorMessage = "Error al guardar usuario";
        try {
            const text = await response.text();
            try {
                const errorData = JSON.parse(text);
                if (errorData.detail) {
                    errorMessage = typeof errorData.detail === 'string' 
                        ? errorData.detail 
                        : JSON.stringify(errorData.detail);
                }
            } catch {
                errorMessage = `Error ${response.status}: ${text || response.statusText}`;
            }
        } catch {
            errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
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
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
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
