"use client";

import type { ComponentType } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { CheckCircle, Eye, FlaskConical, ImageIcon, KeyRound, Loader2, Package, Repeat2, ShieldCheck, X } from "lucide-react";

export type PlanDuration = "monthly" | "yearly";

export interface Plan {
  id: number;
  title: string;
  description: string;
  price: number;
  display_order?: number | null;
  duration: PlanDuration;
  is_active: boolean;
  is_listed?: boolean;
  is_renewable?: boolean;
  is_demo?: boolean;
  allowed_once_per_supplier?: boolean;
  access_code?: string | null;
  max_active_products?: number | null;
  max_images_per_product?: number | null;
}

interface PlanFormData {
  title: string;
  description: string;
  price: string;
  display_order: string;
  duration: PlanDuration;
  is_active: boolean;
  is_listed: boolean;
  is_renewable: boolean;
  is_demo: boolean;
  allowed_once_per_supplier: boolean;
  access_code: string;
  max_active_products: string;
  max_images_per_product: string;
}

const initialFormData: PlanFormData = {
  title: "",
  description: "",
  price: "",
  display_order: "0",
  duration: "yearly",
  is_active: true,
  is_listed: true,
  is_renewable: true,
  is_demo: false,
  allowed_once_per_supplier: false,
  access_code: "",
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

type PlanToggleKey = "is_active" | "is_listed" | "is_renewable" | "is_demo" | "allowed_once_per_supplier";

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
      display_order: initialData.display_order != null ? String(initialData.display_order) : "0",
      duration: initialData.duration || "yearly",
      is_active: Boolean(initialData.is_active),
      is_listed: initialData.is_listed ?? true,
      is_renewable: initialData.is_renewable ?? true,
      is_demo: initialData.is_demo ?? false,
      allowed_once_per_supplier: initialData.allowed_once_per_supplier ?? false,
      access_code: initialData.access_code || "",
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

    const parsedDisplayOrder = Number(formData.display_order);
    if (!formData.display_order.trim()) {
      setLoading(false);
      setError("Captura el orden en el que debe mostrarse este plan.");
      return;
    }
    if (!Number.isInteger(parsedDisplayOrder) || parsedDisplayOrder < 0) {
      setLoading(false);
      setError("El orden debe ser un número entero mayor o igual a 0.");
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
        display_order: parsedDisplayOrder,
        duration: formData.duration,
        is_active: formData.is_active,
        is_listed: formData.is_listed,
        is_renewable: formData.is_renewable,
        is_demo: formData.is_demo,
        allowed_once_per_supplier: formData.allowed_once_per_supplier,
        ...(formData.is_demo ? { access_code: formData.access_code.trim() } : {}),
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

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Orden</label>
            <input
              type="number"
              min={0}
              step={1}
              required
              inputMode="numeric"
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="Ej. 1"
              value={formData.display_order}
              onChange={(e) => setFormData((prev) => ({ ...prev, display_order: e.target.value }))}
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

          <PlanToggle
            id="is_active"
            title="Plan activo"
            description="Permite que el plan pueda usarse en los flujos de compra."
            checked={formData.is_active}
            onChange={(checked) => setFormData((prev) => ({ ...prev, is_active: checked }))}
          />
        </div>

        <section className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Visibilidad y reglas de compra</h2>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Define dónde aparece el plan y cuándo puede volver a comprarse.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <PlanToggle
              id="is_listed"
              title="Mostrar en listado"
              description="Si está activo, el plan aparece en el listado público o normal. Apágalo para demos ocultas o campañas."
              icon={Eye}
              checked={formData.is_listed}
              onChange={(checked) => setFormData((prev) => ({ ...prev, is_listed: checked }))}
            />

            <PlanToggle
              id="is_renewable"
              title="Permite renovar"
              description="Permite usar este plan para extender una suscripción activa. Desactívalo para demos o promociones de una sola vez."
              icon={Repeat2}
              checked={formData.is_renewable}
              onChange={(checked) => setFormData((prev) => ({ ...prev, is_renewable: checked }))}
            />

            <PlanToggle
              id="is_demo"
              title="Plan demo"
              description="Marca una prueba especial. El backend puede impedir que un proveedor compre otra demo si ya tuvo una."
              icon={FlaskConical}
              checked={formData.is_demo}
              onChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  is_demo: checked,
                  access_code: checked ? prev.access_code : "",
                }))
              }
            />

            <PlanToggle
              id="allowed_once_per_supplier"
              title="Una vez por proveedor"
              description="Limita este plan específico a una sola compra por proveedor, aunque no sea el único plan demo."
              icon={ShieldCheck}
              checked={formData.allowed_once_per_supplier}
              onChange={(checked) => setFormData((prev) => ({ ...prev, allowed_once_per_supplier: checked }))}
            />
          </div>

          {formData.is_demo ? (
            <div className="space-y-2">
              <label htmlFor="access_code" className="text-sm font-medium text-gray-700">
                Código de acceso
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="access_code"
                  type="text"
                  className="w-full rounded-xl border border-gray-200 py-2 pl-10 pr-4 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Ej. DEMO10"
                  value={formData.access_code}
                  onChange={(e) => setFormData((prev) => ({ ...prev, access_code: e.target.value }))}
                />
              </div>
              <p className="text-xs leading-5 text-gray-500">
                Código opcional para mostrar este plan solo a usuarios con un enlace o código especial. Si se deja vacío, el plan puede aparecer en el listado normal según su visibilidad.
              </p>
            </div>
          ) : null}
        </section>

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

function PlanToggle({
  id,
  title,
  description,
  checked,
  onChange,
  icon: Icon = CheckCircle,
}: {
  id: PlanToggleKey;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-h-[92px] cursor-pointer items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 transition-colors hover:border-primary/20 hover:bg-primary/5"
    >
      <input
        type="checkbox"
        id={id}
        className="mt-0.5 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Icon size={16} className={checked ? "text-primary" : "text-gray-400"} />
          <span>{title}</span>
        </div>
        <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
      </div>
    </label>
  );
}
