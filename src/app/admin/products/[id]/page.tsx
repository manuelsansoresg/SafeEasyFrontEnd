"use client";

import { useState, useEffect } from "react";
import ProductForm from "@/components/admin/ProductForm";
import { PageHero } from "@/components/ui/PageHero";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import { getSupplierSlug, isAdminRole, isSupplierRole, resolveCurrentSupplier } from "@/lib/currentSupplier";

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  sku: string;
  is_active: boolean;
  supplier_id: number;
  category_id: number;
  subcategory_id: number;
  slug: string;
  thumbnail_url?: string;
}

const EDIT_PRODUCT_CACHE_KEY = "admin-edit-product";

function unwrapProducts(data: unknown): Product[] {
  if (Array.isArray(data)) return data as Product[];
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const candidates = [record.items, record.results, record.data, record.products];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as Product[];
  }
  return [];
}

export default function EditProductPage() {
  const params = useParams();
  const id = params.id;
  const { token, user } = useAuthStore();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!token || !id) return;
      
      try {
        const isAdminUser = isAdminRole(user?.role);
        const isSupplierUser = isSupplierRole(user?.role) && !isAdminUser;
        const currentSupplier = isSupplierUser ? await resolveCurrentSupplier(user) : null;
        if (isSupplierUser && !currentSupplier?.id) {
          setError("No se encontró el proveedor asociado a tu cuenta.");
          return;
        }

        const assertCanEdit = (item: Product | null) => {
          if (!item) return null;
          if (currentSupplier?.id && Number(item.supplier_id) !== Number(currentSupplier.id)) {
            setError("No puedes editar un producto que pertenece a otro proveedor.");
            return null;
          }
          return item;
        };

        const readCachedProduct = () => {
          try {
            const raw = window.sessionStorage.getItem(EDIT_PRODUCT_CACHE_KEY);
            if (!raw) return null;
            const cached = JSON.parse(raw) as Product;
            const matches = String(cached.id) === String(id) || String(cached.slug) === String(id);
            return matches ? cached : null;
          } catch {
            return null;
          }
        };

        // Try to fetch specific product first
        const encodedId = encodeURIComponent(String(id));
        let response: Response | null = null;
        const detailUrls = [
          `/api/products/${encodedId}`,
          `/api/products/${encodedId}/`,
        ];

        for (const url of detailUrls) {
          response = await fetchWithAuth(url);
          if (response.ok) break;
        }
        
        if (response?.ok) {
          const data = await response.json();
          const allowedProduct = assertCanEdit(data);
          if (allowedProduct) {
            setProduct(allowedProduct);
            return;
          }
        } else {
            console.warn(`Direct fetch failed (${response.status}), trying fallback via list...`);
            
            const listUrl = currentSupplier?.id
              ? `/api/products/by-supplier/${encodeURIComponent(getSupplierSlug(currentSupplier))}?skip=0&limit=1000`
              : `/api/products/?skip=0&limit=1000`;

            const listResponse = await fetchWithAuth(listUrl);

            if (listResponse.ok) {
                const listData = await listResponse.json();
                const listItems = unwrapProducts(listData);
                const found = listItems.length > 0
                    ? listItems.find((p: Product) => String(p.id) === String(id) || String(p.slug) === String(id))
                    : null;
                
                const allowedProduct = assertCanEdit(found ?? null);
                if (allowedProduct) {
                    setProduct(allowedProduct);
                    return;
                } else {
                    console.warn(`Product ${id} not found in fallback list (checked ${listItems.length} items)`);
                }
            } else {
                console.warn(`Fallback list fetch failed: ${listResponse.status}`);
            }

            const cachedProduct = assertCanEdit(readCachedProduct());
            if (cachedProduct) {
              setProduct(cachedProduct);
              return;
            }

            // If we are here, both direct and fallback failed.
            // We don't use console.error to avoid Next.js overlay for expected API limitations
            const text = await response.text();
            console.warn("Direct fetch error response:", text); 
            
            // Set a user-friendly error
            setError(`No se pudo cargar el producto. El servidor no permite acceso directo (${response.status}) y no se encontró en el listado.`);
        }
      } catch (err: unknown) {
        console.error(err);
        const message = err instanceof Error ? err.message : String(err);
        setError(`Connection error: ${message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
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
        <p className="text-red-500 mb-4">{error || "Producto no encontrado"}</p>
        <Link href="/admin/products" className="text-primary hover:underline">
          Volver a la lista
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Editar Producto"
        subtitle={`Modifica los datos del producto ${product.title}.`}
        actions={
          <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      <ProductForm initialData={product} isEditMode={true} />
    </div>
  );
}
