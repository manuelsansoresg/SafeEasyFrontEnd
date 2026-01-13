'use client';

import { useState, useEffect } from 'react';
import { Trash2, Edit2, X, Award, Calendar, Link as LinkIcon, MapPin } from 'lucide-react';
import FileUpload from '@/components/ui/FileUpload';

interface StepCertificatesProps {
  supplierId: number;
  token: string;
  onNext: () => void;
}

interface CertificateItem {
  id: number;
  description: string;
  place: string;
  link?: string;
  image_url?: string;
  url?: string;
  path?: string;
  image?: string;
  certificate_date?: string;
  expiration_date?: string;
}

export default function StepCertificates({ supplierId, token, onNext }: StepCertificatesProps) {
  const [items, setItems] = useState<CertificateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [editingId, setEditingId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [place, setPlace] = useState('');
  const [link, setLink] = useState('');
  const [certificateDate, setCertificateDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  const fetchItems = async () => {
    setFetching(true);
    try {
      // Changed to fetch supplier details directly as per instruction
      const res = await fetch(`/api/suppliers/${supplierId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        console.log("Certificate Items Response:", data);
        // The user specified that the array is in 'certificates'
        setItems(Array.isArray(data.certificates) ? data.certificates : []);
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

  const getImageUrl = (path: string | null) => {
    if (!path) return null;
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    
    // Use the env var or fallback
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://3.15.176.110:8080';
    
    // Remove leading slash for consistency
    let cleanPath = path.startsWith('/') ? path.substring(1) : path;
    
    // If path doesn't start with static, assume it needs it
    if (!cleanPath.startsWith('static/')) {
        cleanPath = `static/${cleanPath}`;
    }
    
    return `${baseUrl}/${cleanPath}`;
  };

  const handleEdit = (item: CertificateItem) => {
    setEditingId(item.id);
    setDescription(item.description || '');
    setPlace(item.place || '');
    setLink(item.link || '');
    setCertificateDate(item.certificate_date ? item.certificate_date.split('T')[0] : '');
    setExpirationDate(item.expiration_date ? item.expiration_date.split('T')[0] : '');
    setCurrentImageUrl(getImageUrl(item.image_url || item.url || item.path || item.image || null));
    setImage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDescription('');
    setPlace('');
    setLink('');
    setCertificateDate('');
    setExpirationDate('');
    setImage(null);
    setCurrentImageUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image && !editingId) {
      setError("La imagen del certificado es obligatoria para nuevos elementos");
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
      if (image) formData.append('image', image);

      const url = editingId 
        ? `/api/suppliers/certificates/${editingId}`
        : `/api/suppliers/${supplierId}/certificates`;
      
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Error al ${editingId ? 'actualizar' : 'subir'} certificado`);
      }

      await fetchItems();
      handleCancelEdit();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (itemId: number) => {
    if (!confirm('¿Estás seguro de eliminar este certificado?')) return;
    
    try {
      // Updated to match the requested endpoint structure: DELETE /suppliers/certificates/{certificate_id}
      const res = await fetch(`/api/suppliers/certificates/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.ok) {
        fetchItems();
        if (editingId === itemId) {
            handleCancelEdit();
        }
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
      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-8 transition-all">
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-primary">
                {editingId ? 'Editar Certificado' : 'Agregar Certificado'}
            </h3>
            {editingId && (
            <button 
                onClick={handleCancelEdit}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
                <X size={16} /> Cancelar Edición
            </button>
            )}
        </div>

        {error && <div className="text-red-500 mb-4 bg-red-50 p-3 rounded-lg border border-red-100">{error}</div>}
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1 text-gray-700">Nombre/Descripción del Certificado</label>
            <input 
              type="text" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
              required
              placeholder="Ej. ISO 9001:2015"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Entidad Emisora (Lugar)</label>
            <input 
              type="text" 
              value={place} 
              onChange={(e) => setPlace(e.target.value)} 
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
              required
              placeholder="Ej. Bureau Veritas"
            />
          </div>
          
          <div className="md:col-span-2">
            <FileUpload
                label={editingId ? "Cambiar Documento (Opcional)" : "Imagen / Documento del Certificado"}
                value={image}
                onChange={setImage}
                currentImageUrl={currentImageUrl}
                accept="image/*,.pdf"
                helperText="Formatos: JPG, PNG, PDF"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Fecha de Emisión</label>
            <input 
              type="date" 
              value={certificateDate} 
              onChange={(e) => setCertificateDate(e.target.value)} 
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">Fecha de Expiración</label>
            <input 
              type="date" 
              value={expirationDate} 
              onChange={(e) => setExpirationDate(e.target.value)} 
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
            />
          </div>

           <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1 text-gray-700">Enlace de Verificación (Opcional)</label>
            <input 
              type="url" 
              value={link} 
              onChange={(e) => setLink(e.target.value)} 
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
              placeholder="https://..."
            />
          </div>

          <div className="md:col-span-2 mt-2 flex justify-end gap-3">
             {editingId && (
              <button 
                type="button"
                onClick={handleCancelEdit}
                className="px-6 py-2 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            )}
            <button 
              type="submit" 
              disabled={loading}
              className="bg-primary text-white font-bold py-2 px-6 rounded-xl hover:bg-primary/90 disabled:opacity-50 shadow-lg shadow-primary/20 transition-all"
            >
              {loading ? 'Guardando...' : (editingId ? 'Actualizar Certificado' : 'Agregar Certificado')}
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="space-y-4 mb-8">
        {fetching ? (
           <div className="flex justify-center py-8">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
           </div>
        ) : items.length === 0 ? (
           <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <p className="text-gray-400">No hay certificados subidos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => (
              <div 
                key={item.id} 
                className={`relative group border rounded-xl p-5 flex flex-col gap-3 transition-all hover:shadow-md bg-white ${
                    editingId === item.id ? 'ring-2 ring-primary border-primary' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-primary/5 rounded-lg flex-shrink-0 flex items-center justify-center text-primary">
                        {(item.image_url || item.url || item.path || item.image) ? (
                            <img src={getImageUrl(item.image_url || item.url || item.path || item.image || null)!} alt="" className="w-full h-full object-cover rounded-lg" />
                        ) : (
                            <Award size={32} />
                        )}
                    </div>
                    <div className="flex-grow">
                        <h4 className="font-bold text-gray-800 line-clamp-2">{item.description}</h4>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                            <MapPin size={14} className="mr-1" />
                            {item.place}
                        </div>
                        {(item.certificate_date || item.expiration_date) && (
                            <div className="flex items-center text-xs text-gray-400 mt-1">
                                <Calendar size={12} className="mr-1" />
                                {item.certificate_date?.split('T')[0]} 
                                {item.expiration_date && ` - ${item.expiration_date.split('T')[0]}`}
                            </div>
                        )}
                        {item.link && (
                            <a href={item.link} target="_blank" rel="noopener noreferrer" className="flex items-center text-xs text-blue-500 mt-1 hover:underline">
                                <LinkIcon size={12} className="mr-1" />
                                Verificar
                            </a>
                        )}
                    </div>
                </div>

                <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                    onClick={() => handleEdit(item)}
                    className="p-2 bg-white text-blue-600 rounded-full shadow-sm hover:bg-blue-50 transition-colors border border-gray-100"
                    title="Editar"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="p-2 bg-white text-red-600 rounded-full shadow-sm hover:bg-red-50 transition-colors border border-gray-100"
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-100">
        <button
          onClick={onNext}
          className="bg-gray-800 text-white font-bold py-3 px-8 rounded-xl hover:bg-gray-900 transition-colors shadow-lg"
        >
          Finalizar Registro
        </button>
      </div>
    </div>
  );
}
