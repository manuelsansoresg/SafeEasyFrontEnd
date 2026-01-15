'use client';

import { useState, useEffect } from 'react';
import FileUpload from '@/components/ui/FileUpload';
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
    short_description: '',
    description: '',
    address: '',
    exterior_number: '',
    interior_number: '',
    neighborhood: '',
    about: '',
  });

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
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
      append('about', formData.about);
      
      // Add user_id
      data.append('user_id', userId.toString());
      data.append('is_active', 'true');

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
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6">Información de la Empresa</h2>
      
      {error && (
        <div className="bg-red-50 text-red-500 p-4 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg text-gray-900">Datos Generales</h3>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre de la Empresa</label>
            <input type="text" name="name" required value={formData.name} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre Corto (Slug)</label>
            <input type="text" name="short_name" required value={formData.short_name} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">RFC / Tax ID</label>
            <input type="text" name="rfc" required value={formData.rfc} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Teléfono</label>
            <input type="text" name="phone" required value={formData.phone} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email de Contacto</label>
            <input type="email" name="email" required value={formData.email} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg text-gray-900">Dirección</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">País</label>
              <input type="text" name="country" required value={formData.country} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
               <label className="block text-sm font-medium text-gray-700">Estado/Provincia</label>
               <input type="text" name="state" required value={formData.state} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Ciudad</label>
              <input type="text" name="city" required value={formData.city} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
            </div>
             <div>
              <label className="block text-sm font-medium text-gray-700">Colonia/Barrio</label>
              <input type="text" name="neighborhood" required value={formData.neighborhood} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Calle</label>
            <input type="text" name="address" required value={formData.address} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Num. Exterior</label>
              <input type="text" name="exterior_number" required value={formData.exterior_number} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Num. Interior</label>
              <input type="text" name="interior_number" value={formData.interior_number} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
            </div>
          </div>
        </div>

        {/* Description & Files */}
        <div className="md:col-span-2 space-y-4">
           <h3 className="font-semibold text-lg text-gray-900">Perfil y Multimedia</h3>
           
           <div>
             <label className="block text-sm font-medium text-gray-700">Descripción Corta</label>
             <input type="text" name="short_description" required value={formData.short_description} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" maxLength={150} />
           </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción Detallada (HTML)</label>
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

          <div>
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

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <FileUpload
                 label="Logo de la Empresa"
                 value={logo}
                 onChange={setLogo}
                 helperText="Recomendado: 400x400px"
             />
             <FileUpload
                 label="Imagen 'Sobre Nosotros'"
                 value={aboutImage}
                 onChange={setAboutImage}
                 helperText="Imagen representativa para su perfil"
             />
           </div>
        </div>

        <div className="md:col-span-2">
           <button
             type="submit"
             disabled={loading}
             className="w-full bg-primary text-white font-bold py-4 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
           >
             {loading ? 'Guardando...' : 'Guardar y Continuar'}
           </button>
        </div>
      </form>
    </div>
  );
}
