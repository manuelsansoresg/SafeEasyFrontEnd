"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
import { fetchWithAuth } from "@/lib/api";
import { 
  Loader2, 
  CheckCircle, 
  Upload, 
  X, 
  Image as ImageIcon,
  Eye
} from "lucide-react";
import slugify from "slugify";
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

// --- Interfaces ---

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface Subcategory {
  id: number;
  name: string;
  category_id: number;
  slug: string;
}

interface Supplier {
  id: number;
  name: string;
  short_name?: string;
  rfc?: string;
  user_id: number; 
}

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

interface ProductMedia {
  id: number;
  product_id: string;
  type: string;
  filename: string;
  path: string;
  url: string;
  thumbnail_url: string | null;
  is_primary: boolean;
  position: number;
}

interface ProductFormData {
  title: string;
  description: string;
  price: number | "";
  stock: number | "";
  sku: string;
  is_active: boolean;
  supplier_id: number | null;
  category_id: number | null;
  subcategory_id: number | null;
}

const initialFormData: ProductFormData = {
  title: "",
  description: "",
  price: "",
  stock: "",
  sku: "",
  is_active: true,
  supplier_id: null,
  category_id: null,
  subcategory_id: null,
};

interface ProductFormProps {
  initialData?: Product;
  isEditMode?: boolean;
}

export default function ProductForm({ initialData, isEditMode = false }: ProductFormProps) {
  const { token, user } = useAuthStore();
  const router = useRouter();
  
  // Form State
  const [formData, setFormData] = useState<ProductFormData>(
    initialData 
      ? {
          title: initialData.title,
          description: initialData.description,
          price: initialData.price,
          stock: initialData.stock,
          sku: initialData.sku,
          is_active: initialData.is_active,
          supplier_id: initialData.supplier_id,
          category_id: initialData.category_id,
          subcategory_id: initialData.subcategory_id,
        }
      : initialFormData
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Media Upload
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [mediaList, setMediaList] = useState<ProductMedia[]>([]);

  // Cover Image
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Aux Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  // Supplier Selection Modal/State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierSkip, setSupplierSkip] = useState(0);
  const [supplierLimit] = useState(20);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [selectedSupplierDisplay, setSelectedSupplierDisplay] = useState<string>("");

  // -- Effects --

  useEffect(() => {
    fetchCategories();
  }, [token]);

  // Initial Data Setup
  useEffect(() => {
    if (initialData && token) {
        // If editing, we might need to fetch the supplier name to display it nicely
        // But for now we just show the ID if we don't have the name, or fetch all suppliers and find it.
        // Also fetch subcategories for the selected category
        if (initialData.category_id) {
            fetchSubcategories(initialData.category_id);
        }
        // Try to find supplier name if possible (or just load suppliers and find it)
        // We will load suppliers when the modal opens, but we can try to load them now or just wait.
        setSelectedSupplierDisplay(`ID: ${initialData.supplier_id}`);
        fetchMedia(initialData.id);
        
        if (initialData.thumbnail_url) {
            setCoverPreview(initialData.thumbnail_url);
        }
    }
  }, [initialData, token]);

  // Fetch subcategories when category changes
  useEffect(() => {
    if (formData.category_id) {
      fetchSubcategories(formData.category_id);
    } else {
      setSubcategories([]);
    }
  }, [formData.category_id]);

  // Fetch suppliers when modal opens
  useEffect(() => {
    if (isSupplierModalOpen) {
      fetchSuppliers();
    }
  }, [isSupplierModalOpen, supplierSkip, token]);

  // -- API Calls --

  const fetchCategories = async () => {
    if (!token) return;
    try {
      const response = await fetchWithAuth(`/api/categories/?skip=0&limit=100`);
      if (response.ok) {
        const data = await response.json();
        setCategories(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchSubcategories = async (categoryId: number) => {
    if (!token) return;
    try {
      const response = await fetchWithAuth(`/api/subcategories/?category_id=${categoryId}&skip=0&limit=100`);
      if (response.ok) {
        const data = await response.json();
        setSubcategories(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Error fetching subcategories:", error);
    }
  };

  const fetchSuppliers = async () => {
    if (!token) return;
    setLoadingSuppliers(true);
    try {
      const response = await fetchWithAuth(`/api/suppliers/?skip=${supplierSkip}&limit=${supplierLimit}`);
      if (response.ok) {
        const data = await response.json();
        setSuppliers(Array.isArray(data) ? data : []);
        
        // If in edit mode and we have suppliers, try to update display name
        if (initialData && initialData.supplier_id) {
            const found = (Array.isArray(data) ? data : []).find((s: Supplier) => s.id === initialData.supplier_id);
            if (found) setSelectedSupplierDisplay(found.name);
        }
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const fetchMedia = async (productId: string) => {
    if (!token) return;
    try {
      console.log(`Fetching media for product ${productId}...`);
      const response = await fetch(`/api/products/${productId}/media`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        console.log("Media fetched:", data);
        setMediaList(Array.isArray(data) ? data : []);
      } else {
        console.error("Error fetching media:", await response.text());
      }
    } catch (error) {
      console.error("Error fetching media:", error);
    }
  };

  const handleDeleteMedia = async (mediaId: number) => {
    if (!token) return;
    if (!confirm("¿Estás seguro de eliminar esta imagen?")) return;

    try {
      const response = await fetch(`/api/products/media/${mediaId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setMediaList(prev => prev.filter(m => m.id !== mediaId));
      } else {
        alert("Error al eliminar la imagen");
      }
    } catch (error) {
      console.error("Error deleting media:", error);
      alert("Error al eliminar la imagen");
    }
  };

  const getMediaUrl = (media: ProductMedia) => {
    if (!media.url) return "/placeholder.png";
    if (media.url.startsWith("http")) return media.url;
    return media.url;
  };

  // -- Handlers --

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCoverImage(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveCover = () => {
    setCoverImage(null);
    setCoverPreview(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleEditorChange = (content: string) => {
     setFormData(prev => ({
       ...prev,
       description: content
     }));
  }

  const selectSupplier = (supplier: Supplier) => {
    setFormData(prev => ({ ...prev, supplier_id: supplier.id }));
    setSelectedSupplierDisplay(supplier.name);
    setIsSupplierModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
        setError("No hay sesión activa");
        return;
    }

    setIsSubmitting(true);
    setError(null);
    setUploadProgress(null);

    try {
      // Validate
      if (!formData.supplier_id) throw new Error("Debes seleccionar un proveedor");
      if (!formData.category_id) throw new Error("Debes seleccionar una categoría");
      if (!formData.subcategory_id) throw new Error("Debes seleccionar una subcategoría");
      if (!formData.title) throw new Error("El título es obligatorio");

      // Validate IDs
      if (formData.supplier_id <= 0) {
        throw new Error("Por favor selecciona un proveedor válido");
      }
      if (formData.category_id <= 0) {
        throw new Error("Por favor selecciona una categoría válida");
      }

      // Generate slug from title with random suffix to ensure uniqueness and avoid 500 errors
      const randomSuffix = Math.floor(Math.random() * 10000);
      const slug = slugify(`${formData.title}-${randomSuffix}`, { lower: true, strict: true });

      const payload = new FormData();
      payload.append('title', formData.title);
      payload.append('description', formData.description);
      payload.append('price', String(formData.price));
      payload.append('stock', String(formData.stock));
      payload.append('sku', formData.sku);
      payload.append('is_active', String(formData.is_active));
      if (formData.supplier_id) payload.append('supplier_id', String(formData.supplier_id));
      if (formData.category_id) payload.append('category_id', String(formData.category_id));
      if (formData.subcategory_id) payload.append('subcategory_id', String(formData.subcategory_id));
      payload.append('slug', slug);

      if (coverImage) {
        payload.append('image', coverImage);
      } else if (coverPreview === null && initialData?.thumbnail_url) {
         if (isEditMode) {
              payload.append('delete_image', 'true');
         }
      }

      console.log("Sending payload (FormData)");

      const url = isEditMode && initialData
        ? `/api/products/${initialData.id}` 
        : '/api/products/';
      
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetchWithAuth(url, {
        method,
        body: payload
      });

      if (!response.ok) {
        let errorMessage = "Error al guardar producto";
        try {
            const text = await response.text();
            try {
                const errorData = JSON.parse(text);
                if (errorData.detail && Array.isArray(errorData.detail)) {
                    errorMessage = errorData.detail.map((d: any) => `${d.loc.join('.')} - ${d.msg}`).join(', ');
                } else {
                    errorMessage = errorData.detail || errorData.message || errorMessage;
                }
            } catch {
                errorMessage = `Error ${response.status}: ${text || response.statusText}`;
            }
        } catch (e) {
            errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const savedProduct = await response.json();
      const productId = isEditMode && initialData ? initialData.id : savedProduct.id;

      // Handle Media Upload
      if (selectedFiles && selectedFiles.length > 0) {
        setUploadProgress("Subiendo imágenes...");
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          const mediaFormData = new FormData();
          mediaFormData.append('file', file);
          
          const mediaRes = await fetchWithAuth(`/api/products/${productId}/media`, {
            method: 'POST',
            body: mediaFormData
          });

          if (!mediaRes.ok) {
            console.error(`Failed to upload ${file.name}`);
          }
        }
      }

      router.push('/admin/products');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        {error && (
          <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="col-span-2 space-y-2">
            <label className="text-sm font-medium text-gray-700">Título *</label>
            <input
              type="text"
              name="title"
              required
              value={formData.title}
              onChange={handleInputChange}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <div className="col-span-2 space-y-2">
            <label className="text-sm font-medium text-gray-700">Imagen de Portada</label>
            <div className="flex items-start gap-4">
              <div className="relative w-32 h-32 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl overflow-hidden flex items-center justify-center group hover:border-primary/50 transition-colors">
                {coverPreview ? (
                  <>
                    <img 
                      src={coverPreview} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveCover}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <ImageIcon className="text-gray-300" size={32} />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <div className="flex-1 text-sm text-gray-500">
                <p>Sube una imagen de portada para el producto.</p>
                <p>Formatos permitidos: JPG, PNG, WEBP.</p>
                <p>Tamaño máximo recomendado: 2MB.</p>
              </div>
            </div>
          </div>

          <div className="col-span-2 space-y-2">
            <label className="text-sm font-medium text-gray-700">Descripción *</label>
            <div className="bg-white">
                <ReactQuill 
                  theme="snow"
                  value={formData.description} 
                  onChange={handleEditorChange}
                  style={{ height: '300px', marginBottom: '50px' }}
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, false] }],
                      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
                      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
                      [{ 'align': [] }],
                      ['link', 'image'],
                      ['clean']
                    ],
                  }}
                />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">SKU *</label>
            <input
              type="text"
              name="sku"
              required
              value={formData.sku}
              onChange={handleInputChange}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Precio *</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-400">$</span>
              <input
                type="number"
                name="price"
                required
                min="0"
                step="0.01"
                value={formData.price}
                onChange={handleInputChange}
                className="w-full pl-8 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Stock *</label>
            <input
              type="number"
              name="stock"
              required
              min="0"
              step="1"
              value={formData.stock}
              onChange={handleInputChange}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Proveedor *</label>
            <div className="flex gap-2">
              <div className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 truncate">
                {selectedSupplierDisplay || <span className="text-gray-400">Seleccionar proveedor...</span>}
              </div>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(true)}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Buscar
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Categoría *</label>
            <select
              name="category_id"
              required
              value={formData.category_id || ""}
              onChange={handleInputChange}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white"
            >
              <option value="">Seleccionar categoría</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Subcategoría *</label>
            <select
              name="subcategory_id"
              required
              value={formData.subcategory_id || ""}
              onChange={handleInputChange}
              disabled={!formData.category_id}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all bg-white disabled:bg-gray-50 disabled:text-gray-400"
            >
              <option value="">Seleccionar subcategoría</option>
              {subcategories.map(sub => (
                <option key={sub.id} value={sub.id}>{sub.name}</option>
              ))}
            </select>
          </div>
          
          <div className="col-span-2 space-y-2">
             <label className="text-sm font-medium text-gray-700">Imágenes / Videos (Opcional)</label>
             <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors">
                <input 
                  type="file" 
                  multiple 
                  id="media-upload" 
                  className="hidden" 
                  onChange={(e) => setSelectedFiles(e.target.files)}
                />
                <label htmlFor="media-upload" className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload className="text-gray-400" size={32} />
                    <span className="text-gray-600 font-medium">Click para subir archivos</span>
                    <span className="text-xs text-gray-400">Soporta imágenes y videos</span>
                </label>
                {selectedFiles && selectedFiles.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                        {Array.from(selectedFiles).map((file, i) => (
                            <div key={i} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs">
                                <ImageIcon size={14} />
                                <span className="truncate max-w-[150px]">{file.name}</span>
                            </div>
                        ))}
                    </div>
                )}
             </div>

             {/* Existing Media List */}
             {mediaList.length > 0 && (
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                 {mediaList.map((media) => (
                   <div key={media.id} className="relative group border border-gray-200 rounded-xl overflow-hidden aspect-square bg-gray-50">
                     <img 
                       src={getMediaUrl(media)} 
                       alt={media.filename}
                       className="w-full h-full object-contain p-2"
                       onError={(e) => {
                           console.error("Image load error:", getMediaUrl(media));
                           (e.target as HTMLImageElement).src = "/placeholder.png";
                       }}
                     />
                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <a 
                          href={getMediaUrl(media)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 bg-white/90 rounded-full text-gray-700 hover:text-blue-600 hover:bg-white transition-colors"
                           title="Ver imagen"
                         >
                           <Eye size={16} />
                         </a>
                         <button
                          type="button"
                          onClick={() => handleDeleteMedia(media.id)}
                          className="p-2 bg-white/90 rounded-full text-gray-700 hover:text-red-600 hover:bg-white transition-colors"
                          title="Eliminar imagen"
                        >
                          <X size={16} />
                        </button>
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>

          <div className="col-span-2 space-y-2 flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
              className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700 select-none cursor-pointer">
              Producto Activo
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => router.back()}
            className="cursor-pointer px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="cursor-pointer px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {uploadProgress || "Guardando..."}
              </>
            ) : (
              <>
                <CheckCircle size={18} />
                Guardar Producto
              </>
            )}
          </button>
        </div>
      </form>

      {/* Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Seleccionar Proveedor</h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              {loadingSuppliers ? (
                 <div className="flex justify-center py-8">
                   <Loader2 className="animate-spin text-primary" size={24} />
                 </div>
              ) : (
                <div className="space-y-2">
                    {suppliers.map(s => (
                        <div 
                          key={s.id} 
                          onClick={() => selectSupplier(s)}
                          className="p-3 border border-gray-100 rounded-xl hover:bg-primary/5 hover:border-primary cursor-pointer transition-all group"
                        >
                            <div className="font-medium text-gray-800 group-hover:text-primary">{s.name}</div>
                            <div className="text-xs text-gray-500">RFC: {s.rfc || 'N/A'}</div>
                        </div>
                    ))}
                    
                    {suppliers.length === 0 && (
                        <p className="text-center text-gray-500 py-4">No se encontraron proveedores.</p>
                    )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-between items-center">
               <button 
                 disabled={supplierSkip === 0}
                 onClick={() => setSupplierSkip(Math.max(0, supplierSkip - supplierLimit))}
                 className="text-sm text-gray-600 hover:text-primary disabled:opacity-50"
               >
                 Anterior
               </button>
               <span className="text-xs text-gray-400">
                 Página {Math.floor(supplierSkip / supplierLimit) + 1}
               </span>
               <button 
                 disabled={suppliers.length < supplierLimit}
                 onClick={() => setSupplierSkip(supplierSkip + supplierLimit)}
                 className="text-sm text-gray-600 hover:text-primary disabled:opacity-50"
               >
                 Siguiente
               </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
