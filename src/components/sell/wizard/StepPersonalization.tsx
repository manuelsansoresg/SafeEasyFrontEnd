'use client';

import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/lib/api';
import { Loader2 } from 'lucide-react';

interface StepPersonalizationProps {
  supplierId: number;
  token: string;
  onNext?: () => void;
  initialData?: any;
}

export default function StepPersonalization({ supplierId, token, onNext, initialData }: StepPersonalizationProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [currentSupplier, setCurrentSupplier] = useState<any>(null); // Store full supplier object
  const [formData, setFormData] = useState({
    page_background_color: '#ffffff',
    card_background_color: '#ffffff',
    header_background_color: '#ffffff',
  });

  useEffect(() => {
    if (initialData) {
        console.log('[StepPersonalization] Using initialData provided by parent');
        setCurrentSupplier(initialData);
        setFormData({
            page_background_color: initialData.page_background_color || initialData.background_color || '#ffffff',
            card_background_color: initialData.card_background_color || '#ffffff',
            header_background_color: initialData.header_background_color || '#ffffff',
        });
        setSlug(initialData.slug);
    } else {
        fetchSupplier();
    }
  }, [supplierId, initialData]);

  const fetchSupplier = async () => {
    if (!supplierId) {
      console.error('[StepPersonalization] Missing supplierId');
      return;
    }
    console.log(`[StepPersonalization] Fetching supplier data for ID: ${supplierId}`);
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/suppliers/${supplierId}`);
      if (res.ok) {
        const data = await res.json();
        console.log('[StepPersonalization] Supplier data fetched successfully:', data);
        setCurrentSupplier(data); // Store full data
        setFormData({
          page_background_color: data.page_background_color || data.background_color || '#ffffff',
          card_background_color: data.card_background_color || '#ffffff',
          header_background_color: data.header_background_color || '#ffffff',
        });
        setSlug(data.slug);
      } else {
        const errText = await res.text();
        console.error(`[StepPersonalization] Failed to fetch supplier: ${res.status}`, errText);
        alert(`Error al cargar datos del proveedor (${res.status}): ${errText}`);
      }
    } catch (error) {
      console.error('[StepPersonalization] Exception fetching supplier:', error);
      alert(`Error de conexión al cargar proveedor: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    console.log(`[StepPersonalization] Starting update for supplierId: ${supplierId}`);
    try {
      if (!currentSupplier) {
        throw new Error('No se ha cargado la información del proveedor. Recargue la página.');
      }
      
      const currentData = currentSupplier;
      
      // Build FormData to match SupplierForm implementation
      
      // Build FormData to match SupplierForm implementation
      const data = new FormData();
      
      const appendIfPresent = (key: string, value: any) => {
        if (value !== null && value !== undefined && value !== "") {
          data.append(key, String(value).trim());
        }
      };

      appendIfPresent('name', currentData.name);
      appendIfPresent('slug', currentData.slug);
      appendIfPresent('short_name', currentData.short_name);
      appendIfPresent('rfc', currentData.rfc);
      appendIfPresent('phone', currentData.phone);
      appendIfPresent('email', currentData.email);
      appendIfPresent('city', currentData.city);
      appendIfPresent('state', currentData.state);
      appendIfPresent('country', currentData.country);
      
      if (currentData.is_active !== undefined) {
        data.append('is_active', String(currentData.is_active));
      }

      appendIfPresent('about', currentData.about);
      appendIfPresent('short_description', currentData.short_description);
      appendIfPresent('description', currentData.description);
      appendIfPresent('address', currentData.address);
      appendIfPresent('exterior_number', currentData.exterior_number);
      appendIfPresent('interior_number', currentData.interior_number);
      appendIfPresent('neighborhood', currentData.neighborhood);
      
      if (currentData.user_id) {
         data.append('user_id', String(currentData.user_id));
      }

      // Handle boolean for transfer_accepted
      data.append('transfer_accepted', currentData.transfer_accepted ? 'true' : 'false');
      
      appendIfPresent('transfer_clabe', currentData.transfer_clabe);
      appendIfPresent('transfer_bank', currentData.transfer_bank);
      appendIfPresent('transfer_name', currentData.transfer_name);
      appendIfPresent('map_location', currentData.map_location);
      
      // New fields
      appendIfPresent('page_background_color', formData.page_background_color);
      appendIfPresent('card_background_color', formData.card_background_color);
      appendIfPresent('header_background_color', formData.header_background_color);

      // We do not append files (logo, etc) as we are not changing them here. 
      // If the backend requires them, this might fail, but usually updates are partial or optional files.

      console.log("Sending PUT request to:", `/api/suppliers/${supplierId}`);
      // Log FormData entries for debugging
      for (let [key, value] of data.entries()) {
        console.log(`${key}: ${value}`);
      }
      
      // Use direct fetch instead of fetchWithAuth to debug token/header issues
      const token = localStorage.getItem('auth-storage') 
        ? JSON.parse(localStorage.getItem('auth-storage') || '{}').state?.token 
        : null;

      const updateRes = await fetch(`/api/suppliers/${supplierId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        body: data, 
      });

      if (updateRes.ok) {
        // Success
        if (onNext) onNext();
        else {
            // Optional: Show a success message if not proceeding to next step
            alert('Personalización guardada correctamente');
        }
      } else {
        const errorText = await updateRes.text();
        console.error('Failed to update supplier. Status:', updateRes.status);
        console.error('Response body:', errorText);
        alert(`Error al guardar: Status ${updateRes.status}\nDetalle: ${errorText}`);
      }
    } catch (error) {
      console.error('Error updating supplier:', error);
      alert(`Error de excepción: ${error}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Personalización del Sitio</h2>
      <p className="text-gray-600 mb-6">
        Elija los colores que mejor representen su marca. Estos se reflejarán en su página pública de proveedor.
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
          <label className="block text-base font-semibold text-gray-900 mb-4">
            Color de Fondo del Encabezado
          </label>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <input
              type="color"
              name="header_background_color"
              value={formData.header_background_color}
              onChange={handleChange}
              className="h-16 w-32 p-1 rounded border border-gray-300 cursor-pointer shadow-sm"
            />
            <div className="flex-1 w-full">
              <input
                type="text"
                name="header_background_color"
                value={formData.header_background_color}
                onChange={handleChange}
                placeholder="#ffffff"
                className="w-full rounded-md border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-primary/50 focus:border-primary uppercase"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
              <p className="text-sm text-gray-500 mt-2">
                Este color se aplicará al encabezado superior donde aparece su logo.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
          <label className="block text-base font-semibold text-gray-900 mb-4">
            Color de Fondo General
          </label>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <input
              type="color"
              name="page_background_color"
              value={formData.page_background_color}
              onChange={handleChange}
              className="h-16 w-32 p-1 rounded border border-gray-300 cursor-pointer shadow-sm"
            />
            <div className="flex-1 w-full">
              <input
                type="text"
                name="page_background_color"
                value={formData.page_background_color}
                onChange={handleChange}
                placeholder="#ffffff"
                className="w-full rounded-md border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-primary/50 focus:border-primary uppercase"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
              <p className="text-sm text-gray-500 mt-2">
                Este color se aplicará al fondo principal de su perfil.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6 rounded-lg border border-gray-100">
          <label className="block text-base font-semibold text-gray-900 mb-4">
            Color de Fondo de las Tarjetas
          </label>
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <input
              type="color"
              name="card_background_color"
              value={formData.card_background_color}
              onChange={handleChange}
              className="h-16 w-32 p-1 rounded border border-gray-300 cursor-pointer shadow-sm"
            />
            <div className="flex-1 w-full">
              <input
                type="text"
                name="card_background_color"
                value={formData.card_background_color}
                onChange={handleChange}
                placeholder="#ffffff"
                className="w-full rounded-md border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-primary/50 focus:border-primary uppercase"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
              <p className="text-sm text-gray-500 mt-2">
                Este color se aplicará a los contenedores de información (tarjetas de productos, contacto, etc).
              </p>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary text-white font-bold py-3 px-8 rounded-lg hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
}
