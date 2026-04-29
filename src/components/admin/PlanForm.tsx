"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import { CheckCircle, Loader2, X } from "lucide-react";

export type PlanDuration = "monthly" | "yearly";

export interface Plan {
  id: number;
  title: string;
  description: string;
  price: number;
  duration: PlanDuration;
  is_active: boolean;
}

interface PlanFormData {
  title: string;
  description: string;
  price: string;
  duration: PlanDuration;
  is_active: boolean;
}

const initialFormData: PlanFormData = {
  title: "",
  description: "",
  price: "",
  duration: "yearly",
  is_active: true,
};

interface PlanFormProps {
  initialData?: Plan;
}

export default function PlanForm({ initialData }: PlanFormProps) {
  const router = useRouter();
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<PlanFormData>(() => {
    if (!initialData) return initialFormData;
    return {
      title: initialData.title || "",
      description: initialData.description || "",
      price: String(initialData.price ?? ""),
      duration: initialData.duration || "yearly",
      is_active: Boolean(initialData.is_active),
    };
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setError(null);

    const parsedPrice = Number(formData.price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setLoading(false);
      setError("El precio debe ser un número válido mayor o igual a 0.");
      return;
    }

    try {
      const url = initialData ? `/api/plans/${initialData.id}` : `/api/plans/`;
      const method = initialData ? "PUT" : "POST";

      const payload = {
        title: formData.title,
        description: formData.description,
        price: parsedPrice,
        duration: formData.duration,
        is_active: formData.is_active,
      };

      const response = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        router.push("/admin/plans");
        router.refresh();
      } else {
        const data = await response.json().catch(() => null);
        setError((data && (data.detail || data.message)) || "Error al guardar el plan");
      }
    } catch (err) {
      console.error("Error saving plan:", err);
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Título</label>
            <input
              type="text"
              required
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="Ej. Plan Pro"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Precio</label>
            <input
              type="number"
              min={0}
              step="0.01"
              required
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="0.00"
              value={formData.price}
              onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Descripción</label>
          <textarea
            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[100px]"
            placeholder="Descripción breve del plan..."
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Duración</label>
            <select
              className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              value={formData.duration}
              onChange={(e) => setFormData((prev) => ({ ...prev, duration: e.target.value as PlanDuration }))}
            >
              <option value="monthly">Mensual</option>
              <option value="yearly">Anual</option>
            </select>
          </div>

          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 mt-7 md:mt-0">
            <input
              type="checkbox"
              id="is_active"
              className="w-5 h-5 rounded text-primary focus:ring-primary border-gray-300"
              checked={formData.is_active}
              onChange={(e) => setFormData((prev) => ({ ...prev, is_active: e.target.checked }))}
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
              Plan Activo
            </label>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
            <X size={20} />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white py-3 rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 flex items-center justify-center gap-2 font-medium disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Guardando...
            </>
          ) : (
            <>
              <CheckCircle size={20} />
              {initialData ? "Actualizar Plan" : "Crear Plan"}
            </>
          )}
        </button>
      </form>
    </div>
  );
}

