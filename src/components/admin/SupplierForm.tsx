"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle, Upload } from "lucide-react";

interface Supplier {
  id: number;
  name: string;
  short_name?: string;
  rfc?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  country: string;
  is_active: boolean;
  user_id: number;
  // Extended fields
  short_description?: string;
  description?: string;
  address?: string;
  exterior_number?: string;
  interior_number?: string;
  neighborhood?: string;
  logo_url?: string; // Assuming backend returns URL
  about?: string;
  about_image_url?: string;
}

interface SupplierFormProps {
  initialData?: Supplier;
  isEditMode?: boolean;
}

export default function SupplierForm({ initialData, isEditMode = false }: SupplierFormProps) {
  const { token, user } = useAuthStore();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    short_name: initialData?.short_name || "",
    rfc: initialData?.rfc || "",
    phone: initialData?.phone || "",
    email: initialData?.email || "",
    city: initialData?.city || "",
    state: initialData?.state || "",
    country: initialData?.country || "Mexico",
    is_active: initialData?.is_active ?? true,
    // Extended
    short_description: initialData?.short_description || "",
    description: initialData?.description || "",
    address: initialData?.address || "",
    exterior_number: initialData?.exterior_number || "",
    interior_number: initialData?.interior_number || "",
    neighborhood: initialData?.neighborhood || "",
    about: initialData?.about || "",
  });

  const [logo, setLogo] = useState<File | null>(null);
  const [aboutImage, setAboutImage] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (f: File | null) => void) => {
    if (e.target.files && e.target.files[0]) {
      setter(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !user) {
        setError("No hay sesión activa");
        return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const data = new FormData();
      
      // Append all form fields
      Object.entries(formData).forEach(([key, value]) => {
        // Convert boolean to string for FormData if needed, or backend handles it
        data.append(key, String(value));
      });
      
      // Always ensure user_id is present
      data.append('user_id', String(user.id));

      // Append files if new ones selected
      if (logo) data.append('logo', logo);
      if (aboutImage) data.append('about_image', aboutImage);

      const url = isEditMode && initialData
        ? `/api/suppliers/${initialData.id}` 
        : "/api/suppliers";
      
      // If editing, we might need PUT or PATCH. 
      // Since we are using FormData (multipart), some backends prefer POST with method override or just POST for updates if designed that way.
      // However, typical REST uses PUT. But `fetch` with FormData and PUT works.
      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
            'Authorization': `Bearer ${token}`
            // No Content-Type, browser sets it with boundary
        },
        body: data
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Error ${response.status}: ${response.statusText}`);
      }

      setSuccess(true);
      if (!isEditMode) {
        router.push("/admin/suppliers");
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ocurrió un error al guardar");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded relative flex items-center gap-2">
          <CheckCircle size={20} />
          <span>Información guardada correctamente</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Basic Info */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Datos Generales</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Empresa</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Corto (Slug)</label>
            <input
              type="text"
              name="short_name"
              value={formData.short_name}
              onChange={handleInputChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">RFC</label>
              <input
                type="text"
                name="rfc"
                value={formData.rfc}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Público</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          
           <div>
            <label className="flex items-center space-x-2 cursor-pointer mt-4">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleInputChange}
                className="rounded text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-gray-700">Cuenta Activa</span>
            </label>
          </div>
        </div>

        {/* Right Column: Address */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Ubicación</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Colonia</label>
              <input
                type="text"
                name="neighborhood"
                value={formData.neighborhood}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Calle</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleInputChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. Exterior</label>
              <input
                type="text"
                name="exterior_number"
                value={formData.exterior_number}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. Interior</label>
              <input
                type="text"
                name="interior_number"
                value={formData.interior_number}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>

        {/* Full Width: Description & Files */}
        <div className="md:col-span-2 space-y-4 pt-4">
           <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Perfil Detallado</h3>

           <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción Corta (SEO)</label>
            <input
              type="text"
              name="short_description"
              value={formData.short_description}
              onChange={handleInputChange}
              maxLength={160}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción Completa</label>
            <textarea
              name="description"
              rows={4}
              value={formData.description}
              onChange={handleInputChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sobre Nosotros (Historia)</label>
            <textarea
              name="about"
              rows={4}
              value={formData.about}
              onChange={handleInputChange}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="border border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50">
               <span className="font-medium text-gray-700 mb-2">Logo de la Empresa</span>
               {initialData?.logo_url && !logo && (
                 <div className="mb-4">
                   {/* eslint-disable-next-line @next/next/no-img-element */}
                   <img src={initialData.logo_url} alt="Logo actual" className="h-20 object-contain" />
                 </div>
               )}
               <label className="cursor-pointer bg-white border border-gray-300 rounded-md px-4 py-2 hover:bg-gray-50 flex items-center gap-2">
                 <Upload size={16} />
                 <span>Seleccionar archivo</span>
                 <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, setLogo)} />
               </label>
               {logo && <span className="text-xs text-gray-500 mt-2">{logo.name}</span>}
            </div>

            <div className="border border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50">
               <span className="font-medium text-gray-700 mb-2">Imagen "Sobre Nosotros"</span>
               {initialData?.about_image_url && !aboutImage && (
                 <div className="mb-4">
                   {/* eslint-disable-next-line @next/next/no-img-element */}
                   <img src={initialData.about_image_url} alt="Imagen actual" className="h-20 object-contain" />
                 </div>
               )}
               <label className="cursor-pointer bg-white border border-gray-300 rounded-md px-4 py-2 hover:bg-gray-50 flex items-center gap-2">
                 <Upload size={16} />
                 <span>Seleccionar archivo</span>
                 <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, setAboutImage)} />
               </label>
               {aboutImage && <span className="text-xs text-gray-500 mt-2">{aboutImage.name}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-6">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-primary text-white font-bold py-3 px-8 rounded-lg hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Guardando...
            </>
          ) : (
            "Guardar Cambios"
          )}
        </button>
      </div>
    </form>
  );
}
