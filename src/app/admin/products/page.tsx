"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import { isAdminRole, isSupplierRole, resolveCurrentSupplier } from "@/lib/currentSupplier";
import { isSubscriptionActive } from "@/lib/subscriptionAccess";
import { subscriptionsService } from "@/services/subscriptionsService";
import type { Subscription } from "@/types/subscriptions";
import DOMPurify from "isomorphic-dompurify";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2,
  Package,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Toast } from "@/components/ui/Toast";
import { PageHero } from "@/components/ui/PageHero";

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

const EDIT_PRODUCT_CACHE_KEY = "admin-edit-product";

export default function AdminProductsPage() {
  const { token, user } = useAuthStore();
  const isAdminUser = isAdminRole(user?.role);
  const isSupplierUser = isSupplierRole(user?.role) && !isAdminUser;
  
  // -- State --
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search
  const [search, setSearch] = useState("");

  // Pagination
  const [skip, setSkip] = useState(0);
  const [limit] = useState(50);
  const [totalProducts, setTotalProducts] = useState(0);
  const [toast, setToast] = useState<null | { type: "success" | "error" | "info"; message: string }>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const canCreateProduct = !isSupplierUser || isSubscriptionActive(subscription);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);
  
  // -- Effects --

  useEffect(() => {
    fetchProducts();
  }, [skip, limit, token, user?.id, user?.role]); // Removed search from dependency array to avoid auto-fetch on every keystroke if we want manual or debounced. 
  // However, for simplicity and UX, often debounce is better. 
  // Let's stick to manual search or debounced. 
  // User didn't specify, but I'll add a search handler or just put it in the dependency if I use a debounce.
  // For now, I'll add a separate useEffect for search with a timeout or just update the fetch function.
  
  // Actually, let's keep it simple: Fetch when search changes? 
  // Or maybe add a "Search" button or just 'Enter' key?
  // I will add 'search' to the fetchProducts call and maybe trigger it on enter or blur.
  // But wait, if I change 'search' state, I want to re-fetch.
  // Let's use a debounced effect for search.

  useEffect(() => {
    const timer = setTimeout(() => {
        setSkip(0); // Reset pagination on search
        fetchProducts();
    }, 500);
    return () => clearTimeout(timer);
  }, [search]); // Trigger on search change

  useEffect(() => {
    if (!token || !isSupplierUser) return;
    let cancelled = false;

    const loadSubscription = async () => {
      setSubscriptionLoading(true);
      try {
        const data = await subscriptionsService.getMySubscription();
        if (!cancelled) setSubscription(data);
      } catch (error) {
        console.error("Error loading supplier subscription:", error);
        if (!cancelled) setSubscription(null);
      } finally {
        if (!cancelled) setSubscriptionLoading(false);
      }
    };

    loadSubscription();
    return () => {
      cancelled = true;
    };
  }, [isSupplierUser, token]);

  // -- API Calls --

  const fetchProducts = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
      });
      if (search) {
        queryParams.append('search', search);
      }

      let url = `/api/products/?${queryParams.toString()}`;
      let supplierId: number | null = null;

      if (isSupplierUser) {
        const supplier = await resolveCurrentSupplier(user);
        supplierId = supplier?.id ?? null;
        if (!supplierId) {
          setProducts([]);
          setTotalProducts(0);
          setError("No se encontró el proveedor asociado a tu cuenta.");
          return;
        }

        const supplierParams = new URLSearchParams(queryParams);
        supplierParams.set("skip", "0");
        supplierParams.set("limit", "1000");
        supplierParams.set("include_inactive", "true");
        url = `/api/products/?${supplierParams.toString()}`;
      }

      const response = await fetchWithAuth(url);

      if (response.ok) {
        const data = await response.json();
        const items = unwrapProducts(data);
        if (supplierId) {
          const supplierProducts = items.filter((product) => Number(product.supplier_id) === Number(supplierId));
          setTotalProducts(supplierProducts.length);
          setProducts(supplierProducts.slice(skip, skip + limit));
        } else {
          setTotalProducts(items.length);
          setProducts(items);
        }
      } else {
        const text = await response.text().catch(() => "");
        setError(`No se pudieron cargar los productos (${response.status}). ${text}`.trim());
        setProducts([]);
        setTotalProducts(0);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      setError("No se pudieron cargar los productos.");
      setProducts([]);
      setTotalProducts(0);
    } finally {
      setLoading(false);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar este producto?")) return;
    if (!token) return;
    try {
      const response = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchProducts();
      } else {
        setToast({ type: "error", message: "Error al eliminar producto." });
      }
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const cacheProductForEdit = (product: Product) => {
    try {
      window.sessionStorage.setItem(EDIT_PRODUCT_CACHE_KEY, JSON.stringify(product));
    } catch {
      // If sessionStorage is unavailable, the edit page will use its API fallbacks.
    }
  };

  return (
    <div className="space-y-6">
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
      <PageHero
        title="Productos"
        subtitle="Gestiona el catálogo de productos."
        actions={
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text"
                    placeholder="Buscar producto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                />
            </div>
            
            {canCreateProduct ? (
              <Link 
                href="/admin/products/create"
                className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 shrink-0"
              >
                <Plus size={20} />
                <span className="hidden sm:inline">Nuevo Producto</span>
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-500 rounded-xl shadow-sm shrink-0"
              >
                {subscriptionLoading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                <span className="hidden sm:inline">Renueva para subir</span>
              </button>
            )}
        </div>
        }
      />

      {!canCreateProduct && !subscriptionLoading ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Tu subscripción no está activa. Tus productos no deben mostrarse para compra y no puedes subir productos nuevos hasta renovar tu plan.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : (
          <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-[80px]">Imagen</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[200px]">Nombre</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Precio</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Stock</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Estado</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                      No hay productos registrados.
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center border border-gray-200">
                          {product.thumbnail_url ? (
                            <img 
                              src={product.thumbnail_url} 
                              alt={product.title} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="text-gray-300" size={24} />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-800">{product.title}</div>
                        <div 
                          className="text-xs text-gray-400 truncate max-w-[200px]" 
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description).substring(0, 100) + (product.description.length > 100 ? '...' : '') }} 
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{product.sku}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">${product.price}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{product.stock}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border",
                          product.is_active ? "bg-green-50 text-green-700 border-green-100" : "bg-gray-50 text-gray-600 border-gray-100"
                        )}>
                          {product.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link 
                            href={`/admin/products/${product.slug || product.id}`}
                            onClick={() => cacheProductForEdit(product)}
                            className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </Link>
                          <button 
                            onClick={() => deleteProduct(product.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-gray-100 md:hidden">
            {products.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No hay productos registrados.
              </div>
            ) : (
              products.map((product) => (
                <article key={product.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-100 flex items-center justify-center">
                      {product.thumbnail_url ? (
                        <img
                          src={product.thumbnail_url}
                          alt={product.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package className="text-gray-300" size={26} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words text-sm font-semibold text-gray-900">{product.title}</h3>
                          <div
                            className="mt-1 line-clamp-2 break-words text-xs leading-5 text-gray-500"
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(product.description).substring(0, 110) + (product.description.length > 110 ? "..." : ""),
                            }}
                          />
                        </div>
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium",
                            product.is_active
                              ? "border-green-100 bg-green-50 text-green-700"
                              : "border-gray-100 bg-gray-50 text-gray-600"
                          )}
                        >
                          {product.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                        <div className="rounded-xl bg-gray-50 p-2">
                          <div className="font-semibold uppercase tracking-wide text-gray-400">SKU</div>
                          <div className="mt-1 break-words text-gray-700">{product.sku || "-"}</div>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-2">
                          <div className="font-semibold uppercase tracking-wide text-gray-400">Precio</div>
                          <div className="mt-1 font-semibold text-gray-900">${product.price}</div>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-2">
                          <div className="font-semibold uppercase tracking-wide text-gray-400">Stock</div>
                          <div className="mt-1 text-gray-700">{product.stock}</div>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end gap-2">
                        <Link
                          href={`/admin/products/${product.slug || product.id}`}
                          onClick={() => cacheProductForEdit(product)}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-primary/5 hover:text-primary"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => deleteProduct(product.id)}
                          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
          </>
        )}
        
        {/* Simple Pagination Controls */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <button
            disabled={skip === 0}
            onClick={() => setSkip(Math.max(0, skip - limit))}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-500">
            Página {Math.floor(skip / limit) + 1}
          </span>
          <button
            disabled={isSupplierUser ? skip + limit >= totalProducts : products.length < limit}
            onClick={() => setSkip(skip + limit)}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
