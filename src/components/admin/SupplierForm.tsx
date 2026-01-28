"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle } from "lucide-react";
import FileUpload from "@/components/ui/FileUpload";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

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
  logo?: string;
  logo_url?: string;
  about?: string;
  about_image?: string;
  about_image_url?: string;
  transfer_accepted?: boolean;
  transfer_clabe?: string;
  transfer_bank?: string;
  transfer_name?: string;
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
    transfer_accepted: initialData?.transfer_accepted || false,
    transfer_clabe: initialData?.transfer_clabe || "",
    transfer_bank: initialData?.transfer_bank || "",
    transfer_name: initialData?.transfer_name || "",
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
      const slug = formData.short_name 
        ? formData.short_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        : formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      const isEdit = isEditMode && initialData;

      let response: Response;

      const buildFormData = () => {
        const data = new FormData();

        const appendIfPresent = (key: string, value: any) => {
          if (value !== null && value !== undefined && value !== "") {
            data.append(key, String(value).trim());
          }
        };

        // Transfer Data Validation
        if (formData.transfer_accepted) {
             if (!formData.transfer_clabe || !/^\d{18}$/.test(formData.transfer_clabe)) {
                 setError("La CLABE debe tener 18 dígitos numéricos.");
                 setIsSubmitting(false);
                 throw new Error("Validación fallida"); 
             }
             if (!formData.transfer_bank) {
                 setError("El nombre del banco es obligatorio.");
                 setIsSubmitting(false);
                 throw new Error("Validación fallida");
             }
             if (!formData.transfer_name) {
                 setError("El nombre del beneficiario es obligatorio.");
                 setIsSubmitting(false);
                 throw new Error("Validación fallida");
             }
             
             data.append('transfer_accepted', 'true');
             data.append('transfer_clabe', formData.transfer_clabe);
             data.append('transfer_bank', formData.transfer_bank);
             data.append('transfer_name', formData.transfer_name);
        } else {
            data.append('transfer_accepted', 'false');
            // Optional: clear other fields if not accepted, depends on backend
        }

        appendIfPresent("name", formData.name);
        data.append("short_name", slug);

        appendIfPresent("rfc", formData.rfc);
        appendIfPresent("phone", formData.phone);
        appendIfPresent("email", formData.email);
        appendIfPresent("city", formData.city);
        appendIfPresent("state", formData.state);
        appendIfPresent("country", formData.country);
        data.append("is_active", String(formData.is_active));
        appendIfPresent("short_description", formData.short_description);
        appendIfPresent("description", formData.description);
        appendIfPresent("address", formData.address);
        appendIfPresent("exterior_number", formData.exterior_number);
        appendIfPresent("interior_number", formData.interior_number);
        appendIfPresent("neighborhood", formData.neighborhood);
        appendIfPresent("about", formData.about);
        data.append("user_id", String(user.id));

        if (logo) data.append("logo", logo);
        if (aboutImage) data.append("about_image", aboutImage);

        return data;
      };

      if (isEdit) {
        const url = `/api/suppliers/${initialData.id}/`;
        const data = buildFormData();

        response = await fetch(url, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: data,
        });
      } else {
        const data = buildFormData();

        response = await fetch("/api/suppliers", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: data,
        });
      }

      if (!response.ok) {
        const errData = await response
          .json()
          .catch(
            () =>
              ({
                detail: undefined,
                backend_response: undefined,
              }) as { detail?: unknown; backend_response?: unknown }
          );
        let errorMessage = `Error ${response.status}: ${response.statusText}`;
        
        if (errData.detail) {
          if (typeof errData.detail === 'string') {
            errorMessage = errData.detail;
          } else if (Array.isArray(errData.detail)) {
            const items = errData.detail as { loc: string[]; msg: string }[];
            errorMessage = items
              .map((err) => `${err.loc.join('.')} : ${err.msg}`)
              .join(', ');
          } else {
            errorMessage = JSON.stringify(errData.detail);
          }
        }

        if (errData.backend_response) {
          const backend =
            typeof errData.backend_response === 'string'
              ? errData.backend_response
              : JSON.stringify(errData.backend_response);
          errorMessage += ` | Detalles: ${backend}`;
        }

        setError(errorMessage);
        setIsSubmitting(false);
        return;
      }

      setSuccess(true);
      if (!isEditMode) {
        router.push("/admin/suppliers");
      }
      router.refresh();
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

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción Completa (HTML)</label>
            <div className="border border-gray-300 rounded-md overflow-hidden bg-white">
              <ReactQuill
                theme="snow"
                value={formData.description}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: value,
                  }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sobre Nosotros (Historia, HTML)</label>
            <div className="border border-gray-300 rounded-md overflow-hidden bg-white">
              <ReactQuill
                theme="snow"
                value={formData.about}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    about: value,
                  }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <FileUpload
              label="Logo de la Empresa"
              value={logo}
              onChange={setLogo}
              currentImageUrl={initialData?.logo || initialData?.logo_url || undefined}
              helperText="Recomendado: Formato cuadrado, mín. 400x400px"
            />

            <FileUpload
              label="Imagen 'Sobre Nosotros'"
              value={aboutImage}
              onChange={setAboutImage}
              currentImageUrl={initialData?.about_image || initialData?.about_image_url || undefined}
              helperText="Imagen representativa para su perfil"
            />
          </div>

          <div className="pt-6 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Datos Bancarios para Transferencias</h3>
            
            <div className="flex items-center gap-2 mb-4">
                <input 
                    type="checkbox" 
                    id="transfer_accepted_admin"
                    name="transfer_accepted" 
                    checked={formData.transfer_accepted} 
                    onChange={handleInputChange}
                    className="h-5 w-5 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <label htmlFor="transfer_accepted_admin" className="text-gray-700 font-medium select-none cursor-pointer">
                    Acepto recibir pagos por transferencia bancaria
                </label>
            </div>

            {formData.transfer_accepted && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 rounded-lg">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Beneficiario</label>
                        <input 
                            type="text" 
                            name="transfer_name" 
                            value={formData.transfer_name} 
                            onChange={handleInputChange} 
                            className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="Nombre completo del titular de la cuenta"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                        <input 
                            type="text" 
                            name="transfer_bank" 
                            value={formData.transfer_bank} 
                            onChange={handleInputChange} 
                            className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="Ej. BBVA, Santander"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CLABE Interbancaria</label>
                        <input 
                            type="text" 
                            name="transfer_clabe" 
                            value={formData.transfer_clabe} 
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 18);
                                setFormData(prev => ({ ...prev, transfer_clabe: val }));
                            }} 
                            className="w-full px-3 py-2 border rounded-md border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                            placeholder="18 dígitos"
                        />
                        <p className="text-xs text-gray-500 mt-1">Debe contener exactamente 18 dígitos.</p>
                    </div>
                </div>
            )}
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
