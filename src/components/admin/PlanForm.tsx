"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { CheckCircle, ImageIcon, Loader2, Package, X } from "lucide-react";

export type PlanDuration = "monthly" | "yearly";

export interface Plan {
  id: number;
  title: string;
  description: string;
  price: number;
  duration: PlanDuration;
  is_active: boolean;
  max_active_products?: number | null;
  max_images_per_product?: number | null;
}

interface PlanFormData {
  title: string;
  description: string;
  price: string;
  duration: PlanDuration;
  is_active: boolean;
  max_active_products: string;
  max_images_per_product: string;
}

const initialFormData: PlanFormData = {
  title: "",
  description: "",
  price: "",
  duration: "yearly",
  is_active: true,
  max_active_products: "",
  max_images_per_product: "",
};

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return `${base.replace(/\/$/, "")}${path}`;
};

const authHeaders = (token: string) => ({
  "Authorization": `Bearer ${token.replace(/^bearer\s+/i, "").trim()}`,
});

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
      max_active_products: initialData.max_active_products != null ? String(initialData.max_active_products) : "",
      max_images_per_product: initialData.max_images_per_product != null ? String(initialData.max_images_per_product) : "",
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

    const parsedMaxActiveProducts = Number(formData.max_active_products);
    if (!formData.max_active_products.trim()) {
      setLoading(false);
      setError("Captura cuántos productos activos permite este plan.");
      return;
    }
    if (!Number.isInteger(parsedMaxActiveProducts) || parsedMaxActiveProducts < 0) {
      setLoading(false);
      setError("Los productos activos deben ser un número entero mayor o igual a 0.");
      return;
    }

    const parsedMaxImagesPerProduct = Number(formData.max_images_per_product);
    if (!formData.max_images_per_product.trim()) {
      setLoading(false);
      setError("Captura cuántas imágenes permite cada producto.");
      return;
    }
    if (!Number.isInteger(parsedMaxImagesPerProduct) || parsedMaxImagesPerProduct < 1) {
      setLoading(false);
      setError("Las imágenes por producto deben ser un número entero mayor o igual a 1.");
      return;
    }

    try {
      const method = initialData ? "PUT" : "POST";

      const payload = {
        title: formData.title,
        description: formData.description,
        price: parsedPrice,
        duration: formData.duration,
        is_active: formData.is_active,
        max_active_products: parsedMaxActiveProducts,
        max_images_per_product: parsedMaxImagesPerProduct,
      };

      const body = JSON.stringify(payload);
      const urls = initialData
        ? [apiUrl(`/plans/${initialData.id}`), apiUrl(`/plans/${initialData.id}/`)]
        : [apiUrl(`/plans/`), apiUrl(`/plans`)];

      let response: Response | null = null;
      for (const url of urls) {
        response = await fetch(url, {
          method,
          headers: {
            ...authHeaders(token),
            "Content-Type": "application/json",
          },
          body,
        });
        if (response.ok) break;
        if (response.status !== 404 && response.status !== 405 && response.status < 500) break;
      }

      if (response?.ok) {
        router.push("/admin/plans");
        router.refresh();
      } else {
        const data = await response?.json().catch(() => null);
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="max_active_products" className="text-sm font-medium text-gray-700">
              Productos activos
            </label>
            <div className="relative">
              <Package className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                id="max_active_products"
                type="number"
                min={0}
                step={1}
                required
                inputMode="numeric"
                className="w-full rounded-xl border border-gray-200 py-2 pl-10 pr-4 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Ej. 50"
                value={formData.max_active_products}
                onChange={(e) => setFormData((prev) => ({ ...prev, max_active_products: e.target.value }))}
              />
            </div>
            <p className="text-xs leading-5 text-gray-500">Cantidad máxima de productos activos para este plan.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="max_images_per_product" className="text-sm font-medium text-gray-700">
              Imágenes por producto
            </label>
            <div className="relative">
              <ImageIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                id="max_images_per_product"
                type="number"
                min={1}
                step={1}
                required
                inputMode="numeric"
                className="w-full rounded-xl border border-gray-200 py-2 pl-10 pr-4 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Ej. 8"
                value={formData.max_images_per_product}
                onChange={(e) => setFormData((prev) => ({ ...prev, max_images_per_product: e.target.value }))}
              />
            </div>
            <p className="text-xs leading-5 text-gray-500">Incluye la imagen principal y las imágenes extra.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Duración</label>
            <select
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-4 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
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
