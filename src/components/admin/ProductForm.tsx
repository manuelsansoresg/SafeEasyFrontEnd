"use client";

import { useState, useEffect, useRef, type ClipboardEvent } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
import { fetchWithAuth } from "@/lib/api";
import { isAdminRole, isSupplierRole, resolveCurrentSupplier } from "@/lib/currentSupplier";
import { getSpanishErrorMessage } from "@/lib/errorMessages";
import { isSubscriptionActive } from "@/lib/subscriptionAccess";
import { subscriptionsService } from "@/services/subscriptionsService";
import type { Subscription } from "@/types/subscriptions";
import { 
  Loader2, 
  CheckCircle, 
  X, 
  Eye
} from "lucide-react";
import slugify from "slugify";
import 'react-quill-new/dist/quill.snow.css';
import FileUpload from "@/components/ui/FileUpload";
import MultiFileUpload from "@/components/ui/MultiFileUpload";
import { Toast } from "@/components/ui/Toast";
import { SupplierClassificationPicker } from "@/components/admin/SupplierClassificationPicker";
import type { SupplierClassification } from "@/types/supplierCategories";

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

const fieldClassName = "h-11 w-full rounded-xl border border-gray-200 px-4 text-gray-900 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

const pasteAsPlainText = (event: ClipboardEvent<HTMLDivElement>) => {
  const text = event.clipboardData.getData("text/plain");
  if (!text) return;
  event.preventDefault();
  document.execCommand("insertText", false, text);
};

// --- Interfaces ---

interface Supplier {
  id: number;
  name: string;
  short_name?: string;
  slug?: string;
  rfc?: string;
  user_id: number; 
  business_type_id?: number | null;
  business_type?: { id: number } | null;
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
  category_id: number | null;
  subcategory_id: number | null;
  supplier_category_id?: number | null;
  supplier_subcategory_id?: number | null;
  slug: string;
  image?: string | null;
  thumbnail_url?: string | null;
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
  supplier_category_id: number | null;
  supplier_subcategory_id: number | null;
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
  supplier_category_id: null,
  supplier_subcategory_id: null,
};

interface ProductFormProps {
  initialData?: Product;
  isEditMode?: boolean;
}

async function readProductError(response: Response, fallback: string) {
  const body = await response.text().catch(() => "");
  try {
    return getSpanishErrorMessage(JSON.parse(body), fallback);
  } catch {
    return body && !body.trimStart().startsWith("<") ? body : `${fallback} (${response.status})`;
  }
}

export default function ProductForm({ initialData, isEditMode = false }: ProductFormProps) {
  const { token, user } = useAuthStore();
  const router = useRouter();
  const isAdminUser = isAdminRole(user?.role);
  const isSupplierUser = isSupplierRole(user?.role) && !isAdminUser;
  
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
          supplier_category_id: initialData.supplier_category_id ?? null,
          supplier_subcategory_id: initialData.supplier_subcategory_id ?? null,
        }
      : initialFormData
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const [savedProduct, setSavedProduct] = useState<Product | null>(null);
  const product = savedProduct ?? initialData;
  const editing = isEditMode || savedProduct !== null;
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<null | { type: "success" | "error" | "info"; message: string }>(null);
  const classification: SupplierClassification = {
    categoryId: formData.supplier_category_id ? null : formData.category_id,
    subcategoryId: formData.supplier_category_id ? null : formData.subcategory_id,
    supplierCategoryId: formData.supplier_category_id,
    supplierSubcategoryId: formData.supplier_subcategory_id,
  };
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const [planAllowsProducts, setPlanAllowsProducts] = useState(false);
  const activeSubscription = isSubscriptionActive(subscription);
  const canManageProducts = !isSupplierUser || planAllowsProducts;
  const imageLimit = isSupplierUser && activeSubscription ? subscription?.plan?.max_images_per_product ?? null : null;
  const isCreationBlockedBySubscription = isSupplierUser && (subscriptionLoading || !canManageProducts);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!token || !isSupplierUser) return;
    let cancelled = false;

    const loadSubscription = async () => {
      setSubscriptionLoading(true);
      setSubscriptionError(null);
      try {
        const data = await subscriptionsService.getMySubscription();
        if (!cancelled) setSubscription(data);
        const allowed = await subscriptionsService.canManageProducts(data);
        if (!cancelled) setPlanAllowsProducts(allowed);
      } catch (error) {
        console.error("Error loading supplier subscription:", error);
        if (!cancelled) {
          setPlanAllowsProducts(false);
          setSubscriptionError(error instanceof Error ? error.message : "No pudimos validar tu suscripción.");
        }
      } finally {
        if (!cancelled) setSubscriptionLoading(false);
      }
    };

    loadSubscription();
    return () => {
      cancelled = true;
    };
  }, [isSupplierUser, token]);
  
  // Media Upload
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [mediaList, setMediaList] = useState<ProductMedia[]>([]);
  const [mediaCountKnown, setMediaCountKnown] = useState(!initialData);

  // Cover Image
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(initialData?.thumbnail_url ?? initialData?.image ?? null);
  const hasCover = Boolean(product?.image === undefined ? product?.thumbnail_url : product.image);
  const currentImages = Number(hasCover) + mediaList.filter((media) => media.type === "image").length;
  const coverAddsImage = Boolean(coverImage) && !hasCover;
  const imageLimitMessage = `El límite de tu plan es de ${imageLimit} imágenes por producto, incluida la portada.`;

  const exceedsImageLimit = (files: File[], addsCover: boolean) => {
    const addedImages = Number(addsCover) + files.filter((file) => !file.type.toLowerCase().startsWith("video/")).length;
    return imageLimit != null && addedImages > 0 && (
      imageLimit === 0 || (mediaCountKnown && currentImages + addedImages > imageLimit)
    );
  };

  const changeAdditionalFiles = (files: File[]) => {
    if (files.length > selectedFiles.length && exceedsImageLimit(files, coverAddsImage)) {
      setToast({ type: "error", message: imageLimitMessage });
      return;
    }
    setSelectedFiles(files);
  };

  const changeCover = (file: File | null) => {
    if (file && !hasCover && exceedsImageLimit(selectedFiles, true)) {
      setToast({ type: "error", message: imageLimitMessage });
      return;
    }
    setCoverImage(file);
  };

  // Aux Data
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
    if (!token || !isSupplierUser) return;
    let cancelled = false;

    const setOwnSupplier = async () => {
      try {
        const supplier = await resolveCurrentSupplier(user);
        if (cancelled) return;
        if (!supplier?.id) {
          setError("No se encontró el proveedor asociado a tu cuenta.");
          return;
        }
        setSuppliers([supplier as Supplier]);
        setFormData((prev) => ({ ...prev, supplier_id: supplier.id }));
        setSelectedSupplierDisplay(supplier.name);
      } catch (error) {
        console.error("Error resolving supplier:", error);
        if (!cancelled) setError("No se pudo cargar la información de tu negocio.");
      }
    };

    setOwnSupplier();
    return () => {
      cancelled = true;
    };
  }, [isSupplierUser, token, user]);

  // Initial Data Setup
  useEffect(() => {
    if (initialData && token) {
        // If editing, we might need to fetch the supplier name to display it nicely
        // But for now we just show the ID if we don't have the name, or fetch all suppliers and find it.
        // Also fetch subcategories for the selected category
        // Try to find supplier name if possible (or just load suppliers and find it)
        // We will load suppliers when the modal opens, but we can try to load them now or just wait.
        setSelectedSupplierDisplay(`ID: ${initialData.supplier_id}`);
        fetchMedia(initialData.id);
        
        setCoverPreview(initialData.thumbnail_url ?? initialData.image ?? null);
    }
  }, [initialData, token]);

  // Fetch suppliers when modal opens
  useEffect(() => {
    if (isSupplierModalOpen) {
      fetchSuppliers();
    }
  }, [isSupplierModalOpen, supplierSkip, token]);

  // -- API Calls --

  const fetchSuppliers = async () => {
    if (!token) return;
    if (isSupplierUser) return;
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
      if (process.env.NODE_ENV === "development") console.log(`Fetching media for product ${productId}...`);
      const response = await fetchWithAuth(`/api/products/${productId}/media`, { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        if (process.env.NODE_ENV === "development") console.log("Media fetched:", data);
        setMediaList(Array.isArray(data) ? data : []);
        setMediaCountKnown(Array.isArray(data));
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
        setToast({ type: "error", message: "Error al eliminar la imagen." });
      }
    } catch (error) {
      console.error("Error deleting media:", error);
      setToast({ type: "error", message: "Error al eliminar la imagen." });
    }
  };

  const getMediaUrl = (media: ProductMedia) => {
    if (!media.url) return "/placeholder.png";
    if (media.url.startsWith("http")) return media.url;
    return media.url;
  };

  // -- Handlers --

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
    setFormData(prev => ({
      ...prev,
      supplier_id: supplier.id,
      category_id: null,
      subcategory_id: null,
      supplier_category_id: null,
      supplier_subcategory_id: null,
    }));
    setSelectedSupplierDisplay(supplier.name);
    setIsSupplierModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    if (!token) {
        setError("No hay sesión activa");
        return;
    }
    if (isCreationBlockedBySubscription) {
      setError(subscriptionError || "Tu suscripción actual no habilita la administración de productos.");
      return;
    }

    if (exceedsImageLimit(selectedFiles, coverAddsImage)) {
      setError(imageLimitMessage);
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);
    setError(null);
    setUploadProgress(null);

    try {
      // Validate
      if (!formData.supplier_id) throw new Error("Debes seleccionar un proveedor");
      if (!formData.category_id && !formData.supplier_category_id) throw new Error("Debes seleccionar una categoría");
      if (!formData.title) throw new Error("El título es obligatorio");

      // Validate IDs
      if (formData.supplier_id <= 0) {
        throw new Error("Por favor selecciona un proveedor válido");
      }
      if (formData.category_id !== null && formData.category_id <= 0) {
        throw new Error("Por favor selecciona una categoría válida");
      }

      // Generate slug from title with random suffix to ensure uniqueness and avoid 500 errors
      const randomSuffix = Math.floor(Math.random() * 10000);
      const slug = savedProduct?.slug || slugify(`${formData.title}-${randomSuffix}`, { lower: true, strict: true });

      const payload = new FormData();
      payload.append('title', formData.title);
      payload.append('description', formData.description);
      payload.append('price', String(formData.price));
      payload.append('stock', String(formData.stock));
      payload.append('sku', formData.sku);
      payload.append('is_active', String(formData.is_active));
      if (formData.supplier_id) payload.append('supplier_id', String(formData.supplier_id));
      if (formData.supplier_category_id) {
        payload.append('supplier_category_id', String(formData.supplier_category_id));
        if (editing) {
          payload.append('category_id', '0');
          payload.append('subcategory_id', '0');
        }
        if (formData.supplier_subcategory_id) {
          payload.append('supplier_subcategory_id', String(formData.supplier_subcategory_id));
        } else if (editing) {
          payload.append('supplier_subcategory_id', '0');
        }
      } else if (formData.category_id) {
        payload.append('category_id', String(formData.category_id));
        if (formData.supplier_subcategory_id) {
          payload.append('supplier_subcategory_id', String(formData.supplier_subcategory_id));
          if (editing) payload.append('subcategory_id', '0');
        } else if (formData.subcategory_id) {
          payload.append('subcategory_id', String(formData.subcategory_id));
        } else if (editing) {
          payload.append('subcategory_id', '0');
        }
        if (editing) {
          payload.append('supplier_category_id', '0');
          if (!formData.supplier_subcategory_id) {
            payload.append('supplier_subcategory_id', '0');
          }
        }
      }
      payload.append('slug', slug);

      if (coverImage) {
        payload.append('image', coverImage);
      } else if (coverPreview === null && product?.thumbnail_url) {
         if (editing) {
              payload.append('delete_image', 'true');
         }
      }

      if (process.env.NODE_ENV === "development") console.log("Sending payload (FormData)");

      const url = editing && product
        ? `/api/products/${product.id}`
        : '/api/products/';
      
      const method = editing ? 'PUT' : 'POST';

      const response = await fetchWithAuth(url, {
        method,
        body: payload
      });

      if (!response.ok) {
        throw new Error(await readProductError(response, "Error al guardar producto"));
      }

      const persisted: Product = await response.json();
      const productId = product?.id ?? persisted.id;
      setSavedProduct(persisted);
      setCoverPreview(persisted.thumbnail_url ?? persisted.image ?? null);
      setCoverImage(null);

      // Handle Media Upload
      if (selectedFiles.length > 0) {
        setUploadProgress("Subiendo imágenes...");
        let uploaded = 0;
        try {
          for (const file of selectedFiles) {
            const mediaFormData = new FormData();
            mediaFormData.append("file", file);
            const mediaResponse = await fetchWithAuth(`/api/products/${productId}/media`, {
              method: "POST",
              body: mediaFormData,
            });
            if (!mediaResponse.ok) {
              throw new Error(await readProductError(mediaResponse, "No se pudo subir el archivo."));
            }
            uploaded += 1;
          }
        } catch (err) {
          setSelectedFiles(selectedFiles.slice(uploaded));
          setMediaCountKnown(false);
          await fetchMedia(productId);
          const detail = err instanceof Error ? err.message : "Error de conexión.";
          const partial = uploaded ? ` Se subieron ${uploaded} de ${selectedFiles.length} archivos.` : "";
          throw new Error(`El producto se guardó, pero quedaron archivos pendientes.${partial} ${detail}`);
        }
      }

      router.push('/admin/products');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <>
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        {isCreationBlockedBySubscription ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Tu subscripción no está activa. Tus productos no deben mostrarse para compra y necesitas renovar tu plan para subir productos nuevos.
          </div>
        ) : null}

        {isSupplierUser && !subscriptionLoading && !canManageProducts ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {subscriptionError || "Tu suscripción actual no habilita la administración de productos."}
          </p>
        ) : null}
        {subscriptionLoading && isSupplierUser ? (
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            <Loader2 size={16} className="animate-spin" />
            Validando subscripción...
          </div>
        ) : null}

        {error && (
          <div role="alert" className="p-4 bg-red-50 text-red-600 text-sm rounded-xl">
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
            <FileUpload
                label="Imagen de Portada"
                value={coverImage}
                onChange={changeCover}
                disabled={isSubmitting}
                currentImageUrl={coverPreview}
                helperText="Formatos: JPG, PNG, WEBP. Máx: 2MB."
            />
          </div>

          <div className="col-span-2 space-y-2">
            <label className="text-sm font-medium text-gray-700">Descripción *</label>
            <div className="bg-white" onPasteCapture={pasteAsPlainText}>
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
              className={fieldClassName}
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
                className="h-11 w-full rounded-xl border border-gray-200 pl-8 pr-4 text-gray-900 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
              className={fieldClassName}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Proveedor *</label>
            <div className="flex gap-2">
              <div className="flex h-11 flex-1 items-center rounded-xl border border-gray-200 bg-gray-50 px-4 text-gray-700 truncate">
                {selectedSupplierDisplay || <span className="text-gray-400">Seleccionar proveedor...</span>}
              </div>
              {isAdminUser ? (
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(true)}
                  className="h-11 rounded-xl bg-gray-100 px-4 text-gray-600 transition-colors hover:bg-gray-200"
                >
                  Buscar
                </button>
              ) : null}
            </div>
          </div>

          <SupplierClassificationPicker
            supplierId={formData.supplier_id}
            value={classification}
            onChange={(next) => setFormData((current) => ({
              ...current,
              category_id: next.categoryId,
              subcategory_id: next.subcategoryId,
              supplier_category_id: next.supplierCategoryId,
              supplier_subcategory_id: next.supplierSubcategoryId,
            }))}
            onFeedback={(message) => setToast({ type: "success", message })}
            disabled={isSubmitting}
          />
          
          <div className="col-span-2 space-y-2">
             {imageLimit != null && (
               <div className="space-y-1 text-sm text-gray-600" aria-live="polite">
                 <p>{mediaCountKnown ? `${currentImages} de ${imageLimit} imágenes utilizadas` : imageLimitMessage}</p>
                 {mediaCountKnown && currentImages > imageLimit && (
                   <p className="text-amber-800">Superaste el límite actual. Puedes reemplazar la portada o eliminar imágenes existentes.</p>
                 )}
                 {mediaCountKnown && currentImages === imageLimit && (
                   <p className="text-amber-800">Has alcanzado el límite de imágenes de tu plan.</p>
                 )}
               </div>
             )}
             <MultiFileUpload
                label="Imágenes / Videos (Opcional)"
                value={selectedFiles}
                onChange={changeAdditionalFiles}
                maxFiles={null}
                disabled={isSubmitting}
                helperText="Las imágenes adicionales cuentan para el límite de tu plan."
             />

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
                      <div className="absolute inset-0 bg-black/40 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
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
                          disabled={isSubmitting}
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
            disabled={isSubmitting || subscriptionLoading || isCreationBlockedBySubscription}
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
