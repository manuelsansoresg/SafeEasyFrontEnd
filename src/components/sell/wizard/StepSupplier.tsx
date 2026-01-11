'use client';

import { useState } from 'react';

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

    try {
      const data = new FormData();
      // Add text fields
      Object.entries(formData).forEach(([key, value]) => {
        data.append(key, value);
      });
      
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
        throw new Error(errData.detail || 'Error al guardar la información de la empresa');
      }

      const result = await response.json();
      onSuccess(result.id);

    } catch (err: any) {
      setError(err.message);
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
             <label className="block text-sm font-medium text-gray-700">Descripción Detallada</label>
             <textarea name="description" rows={4} required value={formData.description} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
           </div>

           <div>
             <label className="block text-sm font-medium text-gray-700">Sobre Nosotros (Historia)</label>
             <textarea name="about" rows={4} required value={formData.about} onChange={handleChange} className="w-full px-3 py-2 border rounded-md" />
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-2">Logo</label>
               <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setLogo)} className="w-full" />
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-2">Imagen "Sobre Nosotros"</label>
               <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, setAboutImage)} className="w-full" />
             </div>
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
