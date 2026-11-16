"use client";

import { catalogLabels } from "@/lib/catalogLabels";
import { useState, useEffect } from "react";
import ProductForm, { type EditableProduct } from "@/components/admin/ProductForm";
import { PageHero } from "@/components/ui/PageHero";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import { isAdminRole, isSupplierRole, resolveCurrentSupplier } from "@/lib/currentSupplier";

const EDIT_PRODUCT_CACHE_KEY = "admin-edit-product";

function unwrapProducts(data: unknown): EditableProduct[] {
  if (Array.isArray(data)) return data as EditableProduct[];
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const candidates = [record.items, record.results, record.data, record.products];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as EditableProduct[];
  }
  return [];
}

export default function EditProductPage() {
  const params = useParams();
  const id = params.id;
  const { token, user } = useAuthStore();
  
  const [product, setProduct] = useState<EditableProduct | null>(null);
  const [hasFreshProductData, setHasFreshProductData] = useState(false);
  const [isRealEstate, setIsRealEstate] = useState(false);
  const catalog = catalogLabels(isRealEstate ? "inmuebles" : null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || typeof id !== "string") return;
    const productKey = id;
    const controller = new AbortController();
    const options = { cache: "no-store" as const, signal: controller.signal };
    const matches = (item: EditableProduct) => String(item.id) === productKey || item.slug === productKey;

    async function fetchProduct() {
      try {
        const isAdminUser = isAdminRole(user?.role);
        const isSupplierUser = isSupplierRole(user?.role) && !isAdminUser;
        const supplier = isSupplierUser ? await resolveCurrentSupplier(user, options) : null;
        if (controller.signal.aborted) return;
        if (isSupplierUser && !supplier) {
          setError("No se encontró el proveedor asociado a tu cuenta.");
          return;
        }

        function applyProduct(item: EditableProduct, fresh: boolean) {
          if (controller.signal.aborted) return;
          if (supplier && Number(item.supplier_id) !== Number(supplier.id)) {
            setError("Esta publicación pertenece a otro proveedor.");
            return;
          }
          setError(null);
          setProduct(item);
          setIsRealEstate(item.is_real_estate === true);
          setHasFreshProductData(fresh);
        }

        const detail = await fetchWithAuth(`/api/products/${encodeURIComponent(productKey)}`, options);
        if (detail.ok) {
          applyProduct(await detail.json(), true);
          return;
        }

        // Product detail accepts a slug and only returns public, active items.
        // The authenticated list also supports inactive items and UUID matches.
        const limit = 100;
        const inactive = isAdminUser || isSupplierUser ? "&include_inactive=true" : "";
        for (let skip = 0; !controller.signal.aborted; skip += limit) {
          const response = await fetchWithAuth(`/api/products/?skip=${skip}&limit=${limit}${inactive}`, options);
          if (!response.ok) break;
          const items = unwrapProducts(await response.json());
          const found = items.find(matches);
          if (found) {
            applyProduct(found, true);
            return;
          }
          if (items.length < limit) break;
        }

        if (controller.signal.aborted) return;
        try {
          const raw = window.sessionStorage.getItem(EDIT_PRODUCT_CACHE_KEY);
          if (raw) {
            const cached: EditableProduct = JSON.parse(raw);
            if (matches(cached)) {
              applyProduct(cached, false);
              return;
            }
          }
        } catch {
          // A cached list item is only a fallback for the general form fields.
        }
        setError(`No se pudo cargar la publicación desde el servidor (${detail.status}).`);
      } catch (err: unknown) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void fetchProduct();
    return () => controller.abort();
  }, [id, token, user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error || catalog.notFound}</p>
        <Link href="/admin/products" className="text-primary hover:underline">
          Volver a la lista
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title={catalog.isRealEstate ? "Editar propiedad" : "Editar Producto"}
        subtitle={catalog.isRealEstate ? "Modifica los datos de esta propiedad." : `Modifica los datos del producto ${product.title}.`}
        actions={
          <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      <ProductForm
        key={product.id}
        initialData={product}
        isEditMode
        hasFreshProductData={hasFreshProductData}
        onRealEstateChange={setIsRealEstate}
      />
    </div>
  );
}
