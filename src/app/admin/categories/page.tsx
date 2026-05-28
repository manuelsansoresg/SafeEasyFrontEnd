"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2,
  Grid,
  Search,
  CheckCircle,
  XCircle,
  type LucideIcon
} from "lucide-react";
import Link from "next/link";
import * as Icons from "lucide-react";
import { Toast } from "@/components/ui/Toast";
import { PageHero } from "@/components/ui/PageHero";

interface Category {
  id: number;
  name: string;
  description: string;
  icon: string | null;
  is_active: boolean;
  slug: string;
}

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return `${base.replace(/\/$/, "")}${path}`;
};

const authHeaders = (token: string) => ({
  "Authorization": `Bearer ${token.replace(/^bearer\s+/i, "").trim()}`,
});

const unwrapCategories = (data: unknown): Category[] => {
  if (Array.isArray(data)) return data as Category[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const items = record.items ?? record.results ?? record.data ?? record.categories;
    if (Array.isArray(items)) return items as Category[];
  }
  return [];
};

export default function AdminCategoriesPage() {
  const { token } = useAuthStore();
  
  // -- State --
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Pagination
  const [skip, setSkip] = useState(0);
  const [limit] = useState(100);
  const [toast, setToast] = useState<null | { type: "success" | "error" | "info"; message: string }>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);
  
  // -- Effects --

  useEffect(() => {
    fetchCategories();
  }, [skip, limit, token]);

  // -- API Calls --

  const fetchCategories = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await fetch(apiUrl(`/categories/?skip=${skip}&limit=${limit}`), {
        headers: {
          ...authHeaders(token),
          Accept: "application/json",
        },
      });
      if (response.ok) {
        const data = await response.json();
        setCategories(unwrapCategories(data));
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteCategory = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar esta categoría?")) return;
    if (!token) return;
    try {
      const response = await fetch(apiUrl(`/categories/${id}`), {
        method: 'DELETE',
        headers: authHeaders(token),
      });
      if (response.ok) {
        fetchCategories();
      } else {
        setToast({ type: "error", message: "Error al eliminar categoría." });
      }
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  // Filter categories
  const filteredCategories = categories.filter(category => 
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Helper to render dynamic icon
  const renderIcon = (iconName: string | null) => {
    if (!iconName) return <Grid size={20} />;
    
    const IconComponent = (Icons as unknown as Record<string, LucideIcon>)[iconName];
    return IconComponent ? <IconComponent size={20} /> : <Grid size={20} />;
  };

  return (
    <div className="space-y-6">
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
      <PageHero
        title="Categorías"
        subtitle="Gestiona las categorías de productos."
        eyebrow="Contenido"
        actions={
        <Link 
          href="/admin/categories/create" 
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
        >
          <Plus size={20} />
          Nueva Categoría
        </Link>
        }
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text"
              placeholder="Buscar categorías..." 
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoría</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Descripción</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={20} />
                      Cargando categorías...
                    </div>
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron categorías
                  </td>
                </tr>
              ) : (
                filteredCategories.map((category) => (
                  <tr key={category.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                          {renderIcon(category.icon)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{category.name}</div>
                          <div className="text-xs text-gray-400 font-mono">{category.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {category.description || "-"}
                    </td>
                    <td className="px-6 py-4">
                      {category.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100">
                          <CheckCircle size={12} />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100">
                          <XCircle size={12} />
                          Inactivo
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link 
                          href={`/admin/categories/${category.id}`}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </Link>
                        <button 
                          onClick={() => deleteCategory(category.id)}
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
          {loading ? (
            <div className="px-4 py-8 text-center text-gray-500">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={20} />
                Cargando categorías...
              </div>
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">No se encontraron categorías</div>
          ) : (
            filteredCategories.map((category) => (
              <article key={category.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {renderIcon(category.icon)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-semibold text-gray-900">{category.name}</h3>
                        <p className="mt-1 break-words font-mono text-xs text-gray-400">{category.slug}</p>
                      </div>
                      {category.is_active ? (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-green-100 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                          <CheckCircle size={12} />
                          Activo
                        </span>
                      ) : (
                        <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-gray-100 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
                          <XCircle size={12} />
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="mt-3 line-clamp-3 break-words text-sm leading-6 text-gray-600">{category.description || "-"}</p>
                    <div className="mt-3 flex justify-end gap-2">
                      <Link
                        href={`/admin/categories/${category.id}`}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-primary/5 hover:text-primary"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => deleteCategory(category.id)}
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
      </div>
    </div>
  );
}
