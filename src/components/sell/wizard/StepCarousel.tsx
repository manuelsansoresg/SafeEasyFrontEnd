'use client';

import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';

interface StepCarouselProps {
  supplierId: number;
  token: string;
  onNext: () => void;
}

interface CarouselItem {
  id: number;
  title: string;
  description: string;
  image_url: string; // Assuming backend returns URL
}

export default function StepCarousel({ supplierId, token, onNext }: StepCarouselProps) {
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<File | null>(null);

  const fetchItems = async () => {
    setFetching(true);
    try {
      const res = await fetch(`/api/suppliers/${supplierId}/carousel`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Error fetching carousel items", e);
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
      setError("La imagen es obligatoria");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('image', image);

      const res = await fetch(`/api/suppliers/${supplierId}/carousel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Error al subir imagen');
      }

      // Refresh list
      await fetchItems();
      
      // Reset form
      setTitle('');
      setDescription('');
      setImage(null);
      // Reset file input manually if needed or just use key
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (itemId: number) => {
    if (!confirm('¿Estás seguro de eliminar esta imagen?')) return;
    
    try {
      // Assuming endpoint structure. If failed, might need adjustments.
      // Usually it's /api/suppliers/{sid}/carousel/{id} or /api/carousel/{id}
      // I'll try the nested one first as per prompt pattern.
      const res = await fetch(`/api/suppliers/${supplierId}/carousel/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        fetchItems();
      } else {
        // Fallback: maybe it's just /api/carousel/{id}? 
        // But let's stick to the prompt's implied structure.
        console.error("Failed to delete");
      }
    } catch (e) {
      console.error("Error deleting", e);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-6">Imágenes del Carrusel</h2>
      <p className="text-gray-600 text-center mb-8">
        Sube hasta 5 imágenes para destacar tu empresa. (Mínimo 1 recomendada)
      </p>

      {/* Upload Form */}
      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-8">
        <h3 className="font-bold text-lg mb-4">Agregar Nueva Imagen</h3>
        {error && <div className="text-red-500 mb-4">{error}</div>}
        
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Título</label>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              className="w-full px-3 py-2 border rounded-md" 
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Imagen</label>
            <input 
              type="file" 
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] || null)} 
              className="w-full" 
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Descripción</label>
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="w-full px-3 py-2 border rounded-md" 
              rows={2}
            />
          </div>
          <div className="md:col-span-2">
            <button 
              type="submit" 
              disabled={loading || items.length >= 5}
              className="bg-secondary text-primary font-bold py-2 px-6 rounded-lg hover:bg-secondary/80 disabled:opacity-50"
            >
              {loading ? 'Subiendo...' : 'Agregar Imagen'}
            </button>
            {items.length >= 5 && <span className="ml-4 text-sm text-red-500">Máximo 5 imágenes alcanzado.</span>}
          </div>
        </form>
      </div>

      {/* List */}
      <div className="space-y-4 mb-8">
        {fetching ? (
          <p className="text-center text-gray-500">Cargando imágenes...</p>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-400 italic">No hay imágenes subidas aún.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => (
              <div key={item.id} className="relative group border rounded-lg overflow-hidden flex flex-col">
                <div className="h-40 bg-gray-200">
                  {/* Using img tag for simplicity, or Next Image if domain allowed */}
                  <img src={item.image_url || '/placeholder.png'} alt={item.title} className="w-full h-full object-cover" />
                </div>
                <div className="p-4">
                  <h4 className="font-bold">{item.title}</h4>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </div>
                <button 
                  onClick={() => handleDelete(item.id)}
                  className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Eliminar"
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
          Continuar
        </button>
      </div>
    </div>
  );
}
