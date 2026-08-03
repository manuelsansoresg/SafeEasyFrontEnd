"use client";

import type { ComponentType } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CheckCircle, ChevronDown, Eye, FlaskConical, FolderTree, ImageIcon, Images, KeyRound, Loader2, Package, Repeat2, Search, ShieldCheck, X } from "lucide-react";

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
  is_directory?: boolean;
  allowed_once_per_supplier?: boolean;
  access_code?: string | null;
  max_active_products?: number | null;
  max_images_per_product?: number | null;
  max_gallery_images?: number | null;
  seller_commission_type?: "percentage" | "fixed" | null;
  seller_commission_value?: number | null;
  subscription_linked_commission_user_id?: number | null;
  subscription_linked_commission_type?: "percentage" | "fixed" | null;
  subscription_linked_commission_value?: number | null;
  subscription_linked_commission_is_active?: boolean | null;
}

type AdminUser = {
  id: number;
  email: string;
  name?: string;
  full_name?: string;
};

const formatUserLabel = (user: AdminUser) => {
  const displayName = user.full_name || user.name || user.email || `Usuario #${user.id}`;
  return user.email && displayName !== user.email ? `${displayName} (${user.email})` : displayName;
};

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
  is_directory: boolean;
  allowed_once_per_supplier: boolean;
  access_code: string;
  max_active_products: string;
  max_images_per_product: string;
  max_gallery_images: string;
  seller_commission_type: "percentage" | "fixed";
  seller_commission_value: string;
  subscription_linked_commission_user_id: string;
  subscription_linked_commission_type: "percentage" | "fixed";
  subscription_linked_commission_value: string;
  subscription_linked_commission_is_active: boolean;
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
  is_directory: false,
  allowed_once_per_supplier: false,
  access_code: "",
  max_active_products: "",
  max_images_per_product: "",
  max_gallery_images: "",
  seller_commission_type: "percentage",
  seller_commission_value: "0",
  subscription_linked_commission_user_id: "",
  subscription_linked_commission_type: "percentage",
  subscription_linked_commission_value: "0",
  subscription_linked_commission_is_active: false,
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

type PlanToggleKey =
  | "is_active"
  | "is_listed"
  | "is_renewable"
  | "is_demo"
  | "is_directory"
  | "allowed_once_per_supplier";

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
      is_directory: initialData.is_directory ?? false,
      allowed_once_per_supplier: initialData.allowed_once_per_supplier ?? false,
      access_code: initialData.access_code || "",
      max_active_products: initialData.max_active_products != null ? String(initialData.max_active_products) : "",
      max_images_per_product: initialData.max_images_per_product != null ? String(initialData.max_images_per_product) : "",
      max_gallery_images: initialData.max_gallery_images != null ? String(initialData.max_gallery_images) : "",
      seller_commission_type: initialData.seller_commission_type === "fixed" ? "fixed" : "percentage",
      seller_commission_value: String(initialData.seller_commission_value ?? 0),
      subscription_linked_commission_user_id: initialData.subscription_linked_commission_user_id?.toString() || "",
      subscription_linked_commission_type: initialData.subscription_linked_commission_type === "fixed" ? "fixed" : "percentage",
      subscription_linked_commission_value: String(initialData.subscription_linked_commission_value ?? 0),
      subscription_linked_commission_is_active: Boolean(initialData.subscription_linked_commission_is_active),
    };
  });

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userSelectOpen, setUserSelectOpen] = useState(false);

  const selectedLinkedUser = useMemo(
    () => users.find((u) => String(u.id) === formData.subscription_linked_commission_user_id),
    [formData.subscription_linked_commission_user_id, users],
  );

  const linkedUserDisplayValue = userSelectOpen
    ? userSearch
    : selectedLinkedUser
      ? formatUserLabel(selectedLinkedUser)
      : formData.subscription_linked_commission_user_id
        ? `Usuario #${formData.subscription_linked_commission_user_id}`
        : "";

  useEffect(() => {
    if (!token || !userSelectOpen) return;
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      setUsersLoading(true);
      try {
        const params = new URLSearchParams({ skip: "0", limit: "20" });
        if (userSearch.trim()) params.set("search", userSearch.trim());
        const res = await fetchWithAuth(`/api/users/?${params.toString()}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const items = Array.isArray(data) ? data : data?.items ?? data?.results ?? data?.data ?? data?.users ?? [];
        setUsers(items as AdminUser[]);
      } catch (err) {
        if ((err as { name?: string })?.name !== "AbortError") setUsers([]);
      } finally {
        setUsersLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [token, userSelectOpen, userSearch]);

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

    const parsedMaxActiveProducts = formData.is_directory
      ? null
      : Number(formData.max_active_products);
    if (!formData.is_directory) {
      if (!formData.max_active_products.trim()) {
        setLoading(false);
        setError("Captura cuántos productos activos permite este plan.");
        return;
      }
      if (!Number.isInteger(parsedMaxActiveProducts) || (parsedMaxActiveProducts as number) < 0) {
        setLoading(false);
        setError("Los productos activos deben ser un número entero mayor o igual a 0.");
        return;
      }
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

    const parsedMaxGalleryImages = formData.is_directory
      ? Number(formData.max_gallery_images)
      : null;
    if (formData.is_directory) {
      if (!formData.max_gallery_images.trim()) {
        setLoading(false);
        setError("Captura cuántas imágenes puede tener la galería del directorio.");
        return;
      }
      if (!Number.isInteger(parsedMaxGalleryImages) || (parsedMaxGalleryImages as number) < 1) {
        setLoading(false);
        setError("Las imágenes de galería deben ser un número entero mayor o igual a 1.");
        return;
      }
    }

    const sellerComm = Number(formData.seller_commission_value);
    const linkedComm = Number(formData.subscription_linked_commission_value);
    const linkedUserId = Number.parseInt(formData.subscription_linked_commission_user_id, 10);
    if (!Number.isFinite(sellerComm) || sellerComm < 0 || (formData.seller_commission_type === "percentage" && sellerComm > 100)) {
      setLoading(false);
      setError(
        formData.seller_commission_type === "percentage"
          ? "La comisión del vendedor debe estar entre 0 y 100."
          : "Comisión del vendedor inválida.",
      );
      return;
    }
    if (formData.subscription_linked_commission_is_active) {
      if (!Number.isFinite(linkedUserId) || linkedUserId <= 0) {
        setLoading(false);
        setError("Selecciona un usuario para la comisión por usuario.");
        return;
      }
      if (!Number.isFinite(linkedComm) || linkedComm < 0 || (formData.subscription_linked_commission_type === "percentage" && linkedComm > 100)) {
        setLoading(false);
        setError(
          formData.subscription_linked_commission_type === "percentage"
            ? "La comisión por usuario debe estar entre 0 y 100."
            : "Comisión por usuario inválida.",
        );
        return;
      }
    }

    try {
      const method = initialData ? "PUT" : "POST";

      const linkedActive = formData.subscription_linked_commission_is_active;
      const parsedLinkedUserId = linkedActive && Number.isFinite(linkedUserId) && linkedUserId > 0 ? linkedUserId : null;
      const parsedLinkedType = linkedActive ? formData.subscription_linked_commission_type : null;
      const parsedLinkedValue = linkedActive && Number.isFinite(linkedComm) ? linkedComm : 0;

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
        is_directory: formData.is_directory,
        allowed_once_per_supplier: formData.allowed_once_per_supplier,
        ...(formData.is_demo ? { access_code: formData.access_code.trim() } : {}),
        ...(formData.is_directory
          ? { max_gallery_images: parsedMaxGalleryImages }
          : { max_active_products: parsedMaxActiveProducts }),
        max_images_per_product: parsedMaxImagesPerProduct,
        seller_commission_type: formData.seller_commission_type,
        seller_commission_value: Number.isFinite(sellerComm) ? sellerComm : 0,
        subscription_linked_commission_user_id: parsedLinkedUserId,
        subscription_linked_commission_type: parsedLinkedType,
        subscription_linked_commission_value: parsedLinkedValue,
        subscription_linked_commission_is_active: linkedActive,
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
          {formData.is_directory ? (
            <div className="space-y-2">
              <label htmlFor="max_gallery_images" className="text-sm font-medium text-gray-700">
                Imágenes en galería
              </label>
              <div className="relative">
                <Images className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  id="max_gallery_images"
                  type="number"
                  min={1}
                  step={1}
                  required
                  inputMode="numeric"
                  className="w-full rounded-xl border border-gray-200 py-2 pl-10 pr-4 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Ej. 12"
                  value={formData.max_gallery_images}
                  onChange={(e) => setFormData((prev) => ({ ...prev, max_gallery_images: e.target.value }))}
                />
              </div>
              <p className="text-xs leading-5 text-gray-500">Cantidad máxima de imágenes que el proveedor puede subir a la galería de su directorio.</p>
            </div>
          ) : (
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
          )}

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
              id="is_directory"
              title="Plan directorio"
              description="Convierte el perfil del proveedor en un escaparate de servicios: muestra su información y galería, sin productos ni opción de compra."
              icon={FolderTree}
              checked={formData.is_directory}
              onChange={(checked) => setFormData((prev) => ({ ...prev, is_directory: checked }))}
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

        <section className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Comisión por venta de suscripción</h2>
            <p className="mt-1 text-xs leading-5 text-gray-500">
              Monto que recibirá el vendedor cuando venda esta suscripción a un proveedor. Se configura por plan.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Tipo de comisión del vendedor</label>
              <select
                value={formData.seller_commission_type}
                onChange={(e) => setFormData((prev) => ({ ...prev, seller_commission_type: e.target.value === "fixed" ? "fixed" : "percentage" }))}
                className="h-11 w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="percentage">Porcentaje</option>
                <option value="fixed">Valor fijo</option>
              </select>
              <p className="text-xs leading-5 text-gray-500">Aplica sobre el precio de este plan.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Valor de comisión del vendedor</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={formData.seller_commission_type === "percentage" ? 100 : undefined}
                step="0.01"
                value={formData.seller_commission_value}
                onChange={(e) => setFormData((prev) => ({ ...prev, seller_commission_value: e.target.value }))}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
                placeholder={formData.seller_commission_type === "percentage" ? "5" : "100.00"}
              />
              <p className="text-xs leading-5 text-gray-500">
                {formData.seller_commission_type === "percentage"
                  ? "Porcentaje que recibirá el vendedor (0 a 100)."
                  : "Monto fijo que recibirá el vendedor (MXN)."}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Comisión por usuario</h3>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Comisión especial para una suscripción vinculada a un usuario específico.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-medium text-gray-700">
                <span>Activar comisión</span>
                <input
                  type="checkbox"
                  checked={formData.subscription_linked_commission_is_active}
                  onChange={(e) => setFormData((prev) => ({ ...prev, subscription_linked_commission_is_active: e.target.checked }))}
                  className="peer sr-only"
                />
                <span className="relative h-6 w-11 rounded-full bg-gray-300 transition-colors after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30" />
              </label>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2 md:col-span-3">
                <label className="text-sm font-medium text-gray-700">Usuario vinculado</label>
                <div
                  className="relative"
                  onBlur={() => {
                    window.setTimeout(() => {
                      setUserSelectOpen(false);
                      setUserSearch("");
                    }, 150);
                  }}
                >
                  <Search className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    value={linkedUserDisplayValue}
                    onFocus={() => {
                      setUserSelectOpen(true);
                      setUserSearch("");
                    }}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setUserSelectOpen(true);
                    }}
                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-10 pr-11 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                    placeholder="Buscar usuario por nombre o correo"
                    disabled={!formData.subscription_linked_commission_is_active}
                    role="combobox"
                    aria-expanded={userSelectOpen}
                    aria-controls="linked-user-options"
                    aria-haspopup="listbox"
                    aria-autocomplete="list"
                  />
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    size={18}
                  />

                  {userSelectOpen && formData.subscription_linked_commission_is_active ? (
                    <div className="absolute z-20 mt-2 max-h-64 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                      <div id="linked-user-options" role="listbox" className="max-h-64 overflow-y-auto py-1">
                        {usersLoading ? (
                          <div className="px-4 py-3 text-sm text-gray-500">Buscando usuarios...</div>
                        ) : users.length > 0 ? (
                          users.map((linkedUser) => (
                            <button
                              key={linkedUser.id}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, subscription_linked_commission_user_id: String(linkedUser.id) }));
                                setUserSearch("");
                                setUserSelectOpen(false);
                              }}
                              role="option"
                              aria-selected={String(linkedUser.id) === formData.subscription_linked_commission_user_id}
                              className={cn(
                                "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-primary/5",
                                String(linkedUser.id) === formData.subscription_linked_commission_user_id
                                  ? "bg-primary/5 text-primary"
                                  : "text-gray-700",
                              )}
                            >
                              <span className="truncate">{formatUserLabel(linkedUser)}</span>
                              {String(linkedUser.id) === formData.subscription_linked_commission_user_id ? (
                                <CheckCircle className="shrink-0" size={16} />
                              ) : null}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-gray-500">No se encontraron usuarios.</div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
                <p className="text-xs leading-5 text-gray-500">Busca y selecciona el usuario que recibirá esta comisión.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Tipo de comisión por usuario</label>
                <select
                  value={formData.subscription_linked_commission_type}
                  onChange={(e) => setFormData((prev) => ({ ...prev, subscription_linked_commission_type: e.target.value === "fixed" ? "fixed" : "percentage" }))}
                  disabled={!formData.subscription_linked_commission_is_active}
                  className="h-11 w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="percentage">Porcentaje</option>
                  <option value="fixed">Valor fijo</option>
                </select>
                <p className="text-xs leading-5 text-gray-500">Aplica sobre la suscripción vendida por el usuario vinculado.</p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Valor de comisión por usuario</label>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={formData.subscription_linked_commission_type === "percentage" ? 100 : undefined}
                  step="0.01"
                  value={formData.subscription_linked_commission_value}
                  onChange={(e) => setFormData((prev) => ({ ...prev, subscription_linked_commission_value: e.target.value }))}
                  disabled={!formData.subscription_linked_commission_is_active}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                  placeholder={formData.subscription_linked_commission_type === "percentage" ? "5" : "500.00"}
                />
                <p className="text-xs leading-5 text-gray-500">
                  {formData.subscription_linked_commission_type === "percentage"
                    ? "Porcentaje que recibirá el usuario vinculado (0 a 100)."
                    : "Monto fijo que recibirá el usuario vinculado (MXN)."}
                </p>
              </div>
            </div>
          </div>
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
