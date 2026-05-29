"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Image as ImageIcon
} from "lucide-react";
import Link from "next/link";
import { Toast } from "@/components/ui/Toast";
import { PageHero } from "@/components/ui/PageHero";

interface Subcategory {
  id: number;
  name: string;
  category_id: number;
  is_active: boolean;
  slug: string;
  image: string | null;
}

interface Category {
  id: number;
  name: string;
}

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return `${base.replace(/\/$/, "")}${path}`;
};

const unwrapList = <T,>(data: unknown, key: string): T[] => {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const items = record.items ?? record.results ?? record.data ?? record[key];
    if (Array.isArray(items)) return items as T[];
  }
  return [];
};

const readTotal = (data: unknown): number | null => {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const value = record.total ?? record.count;
  const total = typeof value === "number" ? value : Number(value);
  return Number.isFinite(total) ? total : null;
};

export default function AdminSubcategoriesPage() {
  const { token } = useAuthStore();
  
  // -- State --
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categories, setCategories] = useState<Record<number, string>>({});
  const [categoryOptions, setCategoryOptions] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  
  // Pagination
  const [skip, setSkip] = useState(0);
  const [limit] = useState(20);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [toast, setToast] = useState<null | { type: "success" | "error" | "info"; message: string }>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  // -- API Calls --

  async function fetchSubcategories() {
    try {
      const params = new URLSearchParams({
        skip: String(skip),
        limit: String(limit),
      });
      if (selectedCategoryId) params.set("category_id", selectedCategoryId);
      if (searchTerm.trim()) params.set("search", searchTerm.trim());

      const response = await fetchWithAuth(apiUrl(`/subcategories/?${params.toString()}`));
      if (!response.ok) {
        setSubcategories([]);
        setTotalCount(null);
        setHasNextPage(false);
        return;
      }

      const data: unknown = await response.json().catch(() => null);
      const pageItems = unwrapList<Subcategory>(data, "subcategories");
      const total = readTotal(data);

      setSubcategories(pageItems);
      setTotalCount(total);
      setHasNextPage(total !== null ? skip + pageItems.length < total : pageItems.length === limit);
    } catch (error) {
      console.error("Error fetching subcategories:", error);
      setSubcategories([]);
      setTotalCount(null);
      setHasNextPage(false);
      setToast({ type: "error", message: "No se pudieron cargar las subcategorías." });
    }
  }

  async function fetchCategories() {
    try {
      const response = await fetchWithAuth(apiUrl(`/categories/?skip=0&limit=1000`));
      if (!response.ok) return;

      const data: unknown = await response.json().catch(() => null);
      const categoryList = unwrapList<Category>(data, "categories");
      const map: Record<number, string> = {};
      categoryList.forEach((cat) => {
        map[cat.id] = cat.name;
      });
      setCategories(map);
      setCategoryOptions(categoryList);
    } catch (error) {
      console.error("Error fetching categories:", error);
      setToast({ type: "error", message: "No se pudieron cargar las categorías." });
    }
  }

  // -- Effects --

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchSubcategories(), fetchCategories()]);
      setLoading(false);
    };
    if (token) {
      init();
    }
  }, [limit, token, skip, selectedCategoryId, searchTerm]);

  const deleteSubcategory = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar esta subcategoría?")) return;
    if (!token) return;
    try {
      const response = await fetchWithAuth(`/api/subcategories/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchSubcategories();
      } else {
        setToast({ type: "error", message: "Error al eliminar subcategoría." });
      }
    } catch (error) {
      console.error("Error deleting subcategory:", error);
    }
  };

  // Filter subcategories
  const currentPage = Math.floor(skip / limit) + 1;
  const totalPages = totalCount !== null ? Math.max(1, Math.ceil(totalCount / limit)) : null;
  const shownStart = subcategories.length === 0 ? 0 : skip + 1;
  const shownEnd = skip + subcategories.length;

  return (
    <div className="space-y-6">
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
      <PageHero
        title="Subcategorías"
        subtitle="Gestiona las subcategorías de productos."
        eyebrow="Contenido"
        actions={
        <Link 
          href="/admin/subcategories/create" 
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
        >
          <Plus size={20} />
          Nueva Subcategoría
        </Link>
        }
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text"
              placeholder="Buscar subcategorías..." 
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSkip(0);
              }}
            />
          </div>
          <div className="relative w-full lg:w-72">
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setSkip(0);
              }}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-2 pr-10 text-sm text-gray-700 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Todas las categorías</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </select>
            <ChevronRight className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-gray-400" size={18} />
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Imagen</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Categoría Principal</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={20} />
                      Cargando subcategorías...
                    </div>
                  </td>
                </tr>
              ) : subcategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron subcategorías
                  </td>
                </tr>
              ) : (
                subcategories.map((subcategory) => (
                  <tr key={subcategory.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                        <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center border border-gray-200">
                            {subcategory.image ? (
                                <img src={subcategory.image} alt={subcategory.name} className="w-full h-full object-cover" />
                            ) : (
                                <ImageIcon className="text-gray-400" size={20} />
                            )}
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{subcategory.name}</div>
                        <div className="text-xs text-gray-400 font-mono">{subcategory.slug}</div>
                    </td>
                    <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-100">
                            {categories[subcategory.category_id] || `ID: ${subcategory.category_id}`}
                        </span>
                    </td>
                    <td className="px-6 py-4">
                      {subcategory.is_active ? (
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
                          href={`/admin/subcategories/${subcategory.id}`}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={18} />
                        </Link>
                        <button 
                          onClick={() => deleteSubcategory(subcategory.id)}
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
                Cargando subcategorías...
              </div>
            </div>
          ) : subcategories.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">No se encontraron subcategorías</div>
          ) : (
            subcategories.map((subcategory) => (
              <article key={subcategory.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                    {subcategory.image ? (
                      <img src={subcategory.image} alt={subcategory.name} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="text-gray-400" size={22} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-semibold text-gray-900">{subcategory.name}</h3>
                        <p className="mt-1 break-words font-mono text-xs text-gray-400">{subcategory.slug}</p>
                      </div>
                      {subcategory.is_active ? (
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
                    <div className="mt-3 inline-flex max-w-full rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-sm font-medium text-blue-700">
                      <span className="truncate">{categories[subcategory.category_id] || `ID: ${subcategory.category_id}`}</span>
                    </div>
                    <div className="mt-3 flex justify-end gap-2">
                      <Link
                        href={`/admin/subcategories/${subcategory.id}`}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-primary/5 hover:text-primary"
                        title="Editar"
                      >
                        <Edit2 size={18} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => deleteSubcategory(subcategory.id)}
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
        <div className="flex flex-col gap-3 border-t border-gray-100 p-4 text-sm text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Mostrando {shownStart} - {shownEnd}
            {totalCount !== null ? ` de ${totalCount}` : ""} subcategorías
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <button
              type="button"
              onClick={() => setSkip((value) => Math.max(0, value - limit))}
              disabled={loading || skip === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={18} />
              Anterior
            </button>
            <span className="whitespace-nowrap">
              Página {currentPage}
              {totalPages !== null ? ` de ${totalPages}` : ""}
            </span>
            <button
              type="button"
              onClick={() => setSkip((value) => value + limit)}
              disabled={loading || !hasNextPage}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Siguiente
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
