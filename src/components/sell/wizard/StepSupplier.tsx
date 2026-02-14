'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import FileUpload from '@/components/ui/FileUpload';
import MapPicker from '@/components/ui/MapPicker';
import dynamic from 'next/dynamic';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });

interface StepSupplierProps {
  userId: number;
  token: string;
  onSuccess: (supplierId: number) => void;
}

export default function StepSupplier({ userId, token, onSuccess }: StepSupplierProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    short_name: '',
    rfc: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    country: 'Mexico',
    is_active: true,
    short_description: '',
    description: '',
    address: '',
    exterior_number: '',
    interior_number: '',
    neighborhood: '',
    zip_code: '',
    cross_street_1: '',
    cross_street_2: '',
    about: '',
    transfer_accepted: false,
    transfer_clabe: '',
    transfer_bank: '',
    transfer_name: '',
  });

  const [mapLocation, setMapLocation] = useState<{lat: number, lng: number} | null>(null);

  const [logo, setLogo] = useState<File | null>(null);
  const [aboutImage, setAboutImage] = useState<File | null>(null);

  useEffect(() => {
    // Check if supplier already exists for this user to avoid 500 Duplicate Key errors
    const checkExisting = async () => {
      if (!userId || !token) return;
      try {
        const res = await fetch('/api/suppliers', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const items = Array.isArray(data) ? data : data.items || [];
          const existing = items.find((s: any) => Number(s.user_id) === Number(userId));
          
          if (existing) {
            console.log("Supplier already exists, advancing...", existing);
            onSuccess(existing.id);
          }
        }
      } catch (e) {
        console.error("Error checking existing supplier", e);
      }
    };
    
    checkExisting();
  }, [userId, token, onSuccess]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const target = e.target;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    
    setFormData({ ...formData, [target.name]: value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (f: File | null) => void) => {
    if (e.target.files && e.target.files[0]) {
      setter(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!userId) {
      setError("Error: No se ha identificado el usuario. Por favor intente registrarse nuevamente.");
      setLoading(false);
      return;
    }

    try {
      const data = new FormData();
      
      // Helper to append - sends empty string if value is falsy, which is safer for some backends
      const append = (key: string, value: string) => {
        data.append(key, value ? value.trim() : '');
      };

      // Add text fields
      append('name', formData.name);
      
      // Generate slug
      let slug = formData.short_name 
        ? formData.short_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        : formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      
      // If slug is empty (e.g. name was only special chars), use 'empresa'
      if (!slug) slug = 'empresa';
      
      // Append a timestamp to ensure uniqueness in case of retries/duplicates
      // Ideally backend handles duplicates, but to avoid 500s during dev:
      // const uniqueSlug = `${slug}-${Date.now()}`; 
      // User requested clean urls, so let's try sending the clean slug first.
      // If the user is retrying, maybe we should let them know if it fails.
      data.append('short_name', slug);

      append('rfc', formData.rfc);
      append('phone', formData.phone);
      append('email', formData.email);
      append('city', formData.city);
      append('state', formData.state);
      append('country', formData.country);
      append('short_description', formData.short_description);
      append('description', formData.description);
      append('address', formData.address);
      append('exterior_number', formData.exterior_number);
      append('interior_number', formData.interior_number);
      append('neighborhood', formData.neighborhood);
      append('zip_code', formData.zip_code);
      append('cross_street_1', formData.cross_street_1);
      append('cross_street_2', formData.cross_street_2);
      append('about', formData.about);

      if (mapLocation) {
        data.append('map_location', JSON.stringify(mapLocation));
      }
      
      // Add user_id
      data.append('user_id', userId.toString());
      data.append('is_active', String(formData.is_active));

      // Transfer data
      if (formData.transfer_accepted) {
          if (!formData.transfer_clabe || !/^\d{18}$/.test(formData.transfer_clabe)) {
              setError("La CLABE debe tener 18 dígitos numéricos.");
              setLoading(false);
              return;
          }
          if (!formData.transfer_bank) {
              setError("El nombre del banco es obligatorio si acepta transferencias.");
              setLoading(false);
              return;
          }
          if (!formData.transfer_name) {
              setError("El nombre del beneficiario es obligatorio si acepta transferencias.");
              setLoading(false);
              return;
          }

          data.append('transfer_accepted', 'true');
          data.append('transfer_clabe', formData.transfer_clabe);
          data.append('transfer_bank', formData.transfer_bank);
          data.append('transfer_name', formData.transfer_name);
      } else {
          data.append('transfer_accepted', 'false');
      }

      // Add files
      if (logo) data.append('logo', logo);
      if (aboutImage) data.append('about_image', aboutImage);

      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Content-Type is set automatically for FormData
        },
        body: data,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        let errorMessage = `Error ${response.status}: ${response.statusText}`;
        
        if (errData.detail) {
            if (typeof errData.detail === 'string') {
                errorMessage = errData.detail;
            } else if (Array.isArray(errData.detail)) {
                // Pydantic/FastAPI validation errors
                errorMessage = errData.detail.map((err: any) => `${err.loc.join('.')} : ${err.msg}`).join(', ');
            } else {
                errorMessage = JSON.stringify(errData.detail);
            }
        }

        // Include backend_response if available (from proxy)
        if (errData.backend_response) {
            errorMessage += ` | Detalles: ${typeof errData.backend_response === 'string' ? errData.backend_response : JSON.stringify(errData.backend_response)}`;
        }
        
        // Show error in UI instead of throwing to avoid Next.js overlay
        setError(errorMessage);
        setLoading(false);
        return; 
      }

      const result = await response.json();
      onSuccess(result.id);

    } catch (err: any) {
      console.error("Error submitting supplier:", err);
      setError(err.message || "Ocurrió un error inesperado");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl mx-auto">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
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
                required 
                value={formData.name} 
                onChange={handleChange} 
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Corto (Slug)</label>
              <input 
                type="text" 
                name="short_name" 
                value={formData.short_name} 
                onChange={handleChange} 
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
                  onChange={handleChange} 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input 
                  type="text" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleChange} 
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
                onChange={handleChange} 
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
              />
            </div>

            <div>
              <label className="flex items-center space-x-2 cursor-pointer mt-4">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
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
                  onChange={handleChange} 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                />
              </div>
              <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                 <input 
                   type="text" 
                   name="state" 
                   value={formData.state} 
                   onChange={handleChange} 
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
                  onChange={handleChange} 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                />
              </div>
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Colonia</label>
                <input 
                  type="text" 
                  name="neighborhood" 
                  value={formData.neighborhood} 
                  onChange={handleChange} 
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
                onChange={handleChange} 
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Exterior</label>
                <input 
                  type="text" 
                  name="exterior_number" 
                  value={formData.exterior_number} 
                  onChange={handleChange} 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Interior</label>
                <input 
                  type="text" 
                  name="interior_number" 
                  value={formData.interior_number} 
                  onChange={handleChange} 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">C.P.</label>
                <input 
                  type="text" 
                  name="zip_code" 
                  value={formData.zip_code} 
                  onChange={handleChange} 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entre calle 1</label>
                <input 
                  type="text" 
                  name="cross_street_1" 
                  value={formData.cross_street_1} 
                  onChange={handleChange} 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                  placeholder="Ej. Calle 35"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entre calle 2</label>
                <input 
                  type="text" 
                  name="cross_street_2" 
                  value={formData.cross_street_2} 
                  onChange={handleChange} 
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                  placeholder="Ej. Calle 37"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación en Mapa</label>
              <MapPicker 
                location={mapLocation} 
                onChange={setMapLocation}
                height="300px"
                addressContext={{
                  street: formData.address,
                  exteriorNumber: formData.exterior_number,
                  neighborhood: formData.neighborhood,
                  postalCode: formData.zip_code,
                  city: formData.city,
                  state: formData.state,
                  country: formData.country
                }}
              />
              <p className="text-xs text-gray-500 mt-1">Busca una dirección o haz clic en el mapa para establecer la ubicación.</p>
            </div>
          </div>

          {/* Full Width: Description, Files & Transfer Data */}
          <div className="md:col-span-2 space-y-4 pt-4">
             <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">Perfil Detallado</h3>
             
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Descripción Corta (SEO)</label>
               <input 
                 type="text" 
                 name="short_description" 
                 value={formData.short_description} 
                 onChange={handleChange} 
                 className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50" 
                 maxLength={160} 
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
                   helperText="Recomendado: Formato cuadrado, mín. 400x400px"
               />
               <FileUpload
                   label="Imagen 'Sobre Nosotros'"
                   value={aboutImage}
                   onChange={setAboutImage}
                   helperText="Imagen representativa para su perfil"
               />
             </div>

             <div className="pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Datos Bancarios para Transferencias</h3>
                
                <div className="flex items-center gap-2 mb-4">
                    <input 
                        type="checkbox" 
                        id="transfer_accepted"
                        name="transfer_accepted" 
                        checked={formData.transfer_accepted} 
                        onChange={handleChange}
                        className="h-5 w-5 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <label htmlFor="transfer_accepted" className="text-gray-700 font-medium select-none cursor-pointer">
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
                                onChange={handleChange} 
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="Nombre completo del titular de la cuenta"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                            <input 
                                type="text" 
                                name="transfer_bank" 
                                value={formData.transfer_bank} 
                                onChange={handleChange} 
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
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
                                    setFormData({ ...formData, transfer_clabe: val });
                                }} 
                                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
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
           disabled={loading}
           className="bg-primary text-white font-bold py-3 px-8 rounded-lg hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
         >
           {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Guardando...
            </>
           ) : (
             'Guardar y Continuar'
           )}
         </button>
      </div>
    </form>
  );
}
