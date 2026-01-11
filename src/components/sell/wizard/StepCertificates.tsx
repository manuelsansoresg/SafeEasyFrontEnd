'use client';

import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

interface StepCertificatesProps {
  supplierId: number;
  token: string;
  onNext: () => void;
}

interface CertificateItem {
  id: number;
  description: string;
  place: string;
  image_url?: string;
}

export default function StepCertificates({ supplierId, token, onNext }: StepCertificatesProps) {
  const [items, setItems] = useState<CertificateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [description, setDescription] = useState('');
  const [place, setPlace] = useState('');
  const [link, setLink] = useState('');
  const [certificateDate, setCertificateDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [image, setImage] = useState<File | null>(null);

  const fetchItems = async () => {
    setFetching(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/certificates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Error fetching certificates", e);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (supplierId) {
      fetchItems();
    }
  }, [supplierId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image) {
      setError("La imagen del certificado es obligatoria");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('description', description);
      formData.append('place', place);
      if (link) formData.append('link', link);
      if (certificateDate) formData.append('certificate_date', new Date(certificateDate).toISOString());
      if (expirationDate) formData.append('expiration_date', new Date(expirationDate).toISOString());
      formData.append('image', image);

      const res = await fetch(`/api/suppliers/${supplierId}/certificates`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Error al subir certificado');
      }

      await fetchItems();
      
      // Reset
      setDescription('');
      setPlace('');
      setLink('');
      setCertificateDate('');
      setExpirationDate('');
      setImage(null);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (itemId: number) => {
    if (!confirm('¿Estás seguro de eliminar este certificado?')) return;
    
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/certificates/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        fetchItems();
      }
    } catch (e) {
      console.error("Error deleting", e);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6">Certificados y Reconocimientos</h2>
      <p className="text-gray-600 text-center mb-8">
        Aumente la confianza de los compradores mostrando sus certificaciones.
      </p>

      {/* Upload Form */}
      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-8">
        <h3 className="font-bold text-lg mb-4">Agregar Certificado</h3>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Nombre/Descripción del Certificado</label>
            <input 
              type="text" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="w-full px-3 py-2 border rounded-md" 
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Entidad Emisora (Lugar)</label>
            <input 
              type="text" 
              value={place} 
              onChange={(e) => setPlace(e.target.value)} 
              className="w-full px-3 py-2 border rounded-md" 
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Imagen / Documento</label>
            <input 
              type="file" 
              accept="image/*,.pdf"
              onChange={(e) => setImage(e.target.files?.[0] || null)} 
              className="w-full" 
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Fecha de Emisión</label>
            <input 
              type="date" 
              value={certificateDate} 
              onChange={(e) => setCertificateDate(e.target.value)} 
              className="w-full px-3 py-2 border rounded-md" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Fecha de Expiración</label>
            <input 
              type="date" 
              value={expirationDate} 
              onChange={(e) => setExpirationDate(e.target.value)} 
              className="w-full px-3 py-2 border rounded-md" 
            />
          </div>

           <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Enlace de Verificación (Opcional)</label>
            <input 
              type="url" 
              value={link} 
              onChange={(e) => setLink(e.target.value)} 
              className="w-full px-3 py-2 border rounded-md" 
            />
          </div>

          <div className="md:col-span-2 mt-2">
            <button 
              type="submit" 
              disabled={loading}
              className="bg-secondary text-primary font-bold py-2 px-6 rounded-lg hover:bg-secondary/80 disabled:opacity-50"
            >
              {loading ? 'Subiendo...' : 'Agregar Certificado'}
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="space-y-4 mb-8">
        {fetching ? (
          <p className="text-center text-gray-500">Cargando certificados...</p>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-400 italic">No hay certificados subidos.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => (
              <div key={item.id} className="relative group border rounded-lg p-4 flex items-start space-x-4">
                <div className="w-16 h-16 bg-gray-100 flex-shrink-0 flex items-center justify-center">
                   {/* Placeholder for icon/image */}
                   <span className="text-xs text-gray-500">IMG</span>
                </div>
                <div className="flex-grow">
                  <h4 className="font-bold text-sm">{item.description}</h4>
                  <p className="text-xs text-gray-600">{item.place}</p>
                </div>
                <button 
                  onClick={() => handleDelete(item.id)}
                  className="text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          className="bg-primary text-white font-bold py-3 px-8 rounded-lg hover:bg-primary/90 transition-colors"
        >
          Finalizar Registro
        </button>
      </div>
    </div>
  );
}
