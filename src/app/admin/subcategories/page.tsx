"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2,
  Layers,
  Search,
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

export default function AdminSubcategoriesPage() {
  const { token } = useAuthStore();
  
  // -- State --
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categories, setCategories] = useState<Record<number, string>>({});
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

  // -- API Calls --

  async function fetchSubcategories() {
    try {
      const response = await fetchWithAuth(`/api/subcategories/?skip=${skip}&limit=${limit}`);
      if (response.ok) {
        const data = await response.json();
        setSubcategories(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching subcategories:", error);
    }
  }

  async function fetchCategories() {
    try {
        // Fetch all categories to map IDs to names
        const response = await fetchWithAuth(`/api/categories/?skip=0&limit=1000`);
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
                const map: Record<number, string> = {};
                data.forEach((cat: Category) => {
                    map[cat.id] = cat.name;
                });
                setCategories(map);
            }
        }
    } catch (error) {
        console.error("Error fetching categories:", error);
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
  }, [skip, limit, token]);

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
  const filteredSubcategories = subcategories.filter(sub => 
    sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (categories[sub.category_id] && categories[sub.category_id].toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
        <div className="p-4 border-b border-gray-100 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text"
              placeholder="Buscar subcategorías..." 
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
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
              ) : filteredSubcategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron subcategorías
                  </td>
                </tr>
              ) : (
                filteredSubcategories.map((subcategory) => (
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
      </div>
    </div>
  );
}
