"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import { 
  Loader2, 
  CheckCircle, 
  X, 
  Upload, 
  Image as ImageIcon
} from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
import slugify from "slugify";

interface Category {
  id: number;
  name: string;
}

interface Subcategory {
  id: number;
  name: string;
  category_id: number;
  is_active: boolean;
  slug: string;
  image: string | null;
}

interface SubcategoryFormData {
  name: string;
  category_id: number | "";
  is_active: boolean;
  slug: string;
  image: File | null;
}

const initialFormData: SubcategoryFormData = {
  name: "",
  category_id: "",
  is_active: true,
  slug: "",
  image: null,
};

interface SubcategoryFormProps {
  initialData?: Subcategory;
}

export default function SubcategoryForm({ initialData }: SubcategoryFormProps) {
  const router = useRouter();
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<SubcategoryFormData>(
    initialData ? {
      name: initialData.name,
      category_id: initialData.category_id,
      is_active: initialData.is_active,
      slug: initialData.slug,
      image: null, // We don't populate file input with URL
    } : initialFormData
  );

  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialData?.image || null
  );

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
        const response = await fetchWithAuth(`/api/categories/?skip=0&limit=1000`);
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
                setCategories(data);
            }
        }
    } catch (err) {
        console.error("Error fetching categories:", err);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    // Only auto-generate slug if it's a new entry or user hasn't manually edited slug (simplified logic: just always update if creating)
    // Or if we follow ProductForm pattern:
    const slug = slugify(name, { lower: true, strict: true });
    setFormData(prev => ({ ...prev, name, slug }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({ ...prev, image: file }));
      // Create preview
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!formData.category_id) {
        setError("Debes seleccionar una categoría principal");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = initialData 
        ? `/api/subcategories/${initialData.id}` 
        : `/api/subcategories/`;
      
      const method = initialData ? "PUT" : "POST";

      // Use FormData for multipart/form-data
      const data = new FormData();
      data.append("name", formData.name);
      data.append("category_id", String(formData.category_id));
      data.append("slug", formData.slug);
      data.append("is_active", String(formData.is_active));
      
      if (formData.image) {
        data.append("image", formData.image);
      }

      const response = await fetchWithAuth(url, {
        method,
        body: data, 
        // fetchWithAuth automatically handles Content-Type for FormData (by not setting it, letting browser set boundary)
        // BUT we need to make sure fetchWithAuth doesn't force application/json if body is not string
        // Checking fetchWithAuth implementation:
        // if (!headers['Content-Type'] && typeof options.body === 'string') { headers['Content-Type'] = 'application/json'; }
        // So passing FormData (object) is fine, it won't set application/json.
      });

      if (response.ok) {
        router.push("/admin/subcategories");
        router.refresh();
      } else {
        const resData = await response.json();
        setError(resData.detail || "Error al guardar la subcategoría");
      }
    } catch (err) {
      console.error("Error saving subcategory:", err);
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Name & Slug */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Nombre</label>
                <input
                    type="text"
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="Ej. Smartphones"
                    value={formData.name}
                    onChange={handleNameChange}
                />
            </div>
            <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Slug</label>
                <input
                    type="text"
                    required
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 focus:outline-none transition-all"
                    placeholder="ej-smartphones"
                    value={formData.slug}
                    readOnly
                />
            </div>
        </div>

        {/* Category Select */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Categoría Principal</label>
          <select
            required
            className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none bg-white"
            value={formData.category_id}
            onChange={(e) => setFormData({ ...formData, category_id: Number(e.target.value) })}
          >
            <option value="">Selecciona una categoría</option>
            {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                    {cat.name}
                </option>
            ))}
          </select>
        </div>

        {/* Image Upload */}
        <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Imagen</label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-4 hover:bg-gray-50 transition-colors relative">
                {previewUrl ? (
                    <div className="relative w-40 h-40 rounded-lg overflow-hidden border border-gray-200">
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                        <button 
                            type="button"
                            onClick={() => {
                                setFormData(prev => ({ ...prev, image: null }));
                                setPreviewUrl(null);
                            }}
                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400 gap-2">
                        <ImageIcon size={40} />
                        <span className="text-sm">Haz clic para subir una imagen</span>
                    </div>
                )}
                
                <input 
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleImageChange}
                />
            </div>
        </div>

        {/* Active Status */}
        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <input
            type="checkbox"
            id="is_active"
            className="w-5 h-5 rounded text-primary focus:ring-primary border-gray-300"
            checked={formData.is_active}
            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
          />
          <label htmlFor="is_active" className="text-sm font-medium text-gray-700 cursor-pointer select-none">
            Subcategoría Activa
          </label>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
            <X size={20} />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Button */}
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
              {initialData ? "Actualizar Subcategoría" : "Crear Subcategoría"}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
