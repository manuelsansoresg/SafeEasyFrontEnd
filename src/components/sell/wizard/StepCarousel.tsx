'use client';

import { useState, useEffect } from 'react';
import { Trash2, Edit2, X, Video, Image as ImageIcon, Loader2 } from 'lucide-react';
import FileUpload from '@/components/ui/FileUpload';
import { fetchWithAuth } from '@/lib/api';

interface StepCarouselProps {
  supplierId: number;
  slug?: string;
  token: string;
  onNext: () => void;
}

interface CarouselItem {
  id: number;
  title: string;
  description: string;
  image_url?: string;
  url?: string;
  path?: string;
  image?: string;
  thumbnail?: string;
}

export default function StepCarousel({ supplierId, slug, token, onNext }: StepCarouselProps) {
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New State for Media Type Toggle
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [headerVideo, setHeaderVideo] = useState<File | null>(null);
  const [savedVideoUrl, setSavedVideoUrl] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [isDeletingVideo, setIsDeletingVideo] = useState(false);

  // Form State (Carousel)
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  const fetchItems = async () => {
    setFetching(true);
    try {
      const identifier = slug || supplierId;
      const res = await fetchWithAuth(`/api/suppliers/${identifier}`);
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data.carousel_images) ? data.carousel_images : []);
        
        // Set initial media type and video url
        if (data.header_media_type === 'video') {
            setActiveTab('video');
        } else {
            setActiveTab('image');
        }
        setSavedVideoUrl(data.header_video || null);
      }
    } catch (e) {
      console.error("Error fetching carousel items", e);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (slug || supplierId) {
      fetchItems();
    }
  }, [slug, supplierId]);

  const getImageUrl = (path: string | null) => {
    if (!path) return '/placeholder.png';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    
    // Use the env var or fallback
    const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://drooopy.com/api').replace(/\/$/, '');
    
    // Remove leading slash for consistency
    let cleanPath = path.startsWith('/') ? path.substring(1) : path;
    
    // If path doesn't start with static, assume it needs it (common in FastAPI/backend setups)
    // Also check if it's already a full URL or if it's a relative path from static
    if (!cleanPath.startsWith('static/') && !cleanPath.startsWith('http')) {
        cleanPath = `static/${cleanPath}`;
    }
    
    return `${baseUrl}/${cleanPath}`;
  };

  const handleTabChange = async (tab: 'image' | 'video') => {
    setActiveTab(tab);
    // Update preference immediately
    try {
        const formData = new FormData();
        formData.append('header_media_type', tab);
        
        await fetchWithAuth(`/api/suppliers/${supplierId}`, {
            method: 'PUT',
            body: formData
        });
    } catch (e) {
        console.error("Error updating media type preference", e);
    }
  };

  const handleVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headerVideo) return;
    
    setIsVideoLoading(true);
    setError(null);
    try {
        const formData = new FormData();
        formData.append('header_media_type', 'video');
        formData.append('header_video', headerVideo);
        // Redundant field for backend compatibility (same pattern as StepSupplier)
        formData.append('header_media', headerVideo);

        const debugEntries: Array<{ key: string; value: unknown }> = [];
        formData.forEach((v, k) => {
            if (v instanceof File) {
                debugEntries.push({
                    key: k,
                    value: {
                        name: v.name,
                        type: v.type,
                        size: v.size,
                    },
                });
            } else {
                debugEntries.push({ key: k, value: v });
            }
        });
        console.log("[StepCarousel] Video Upload FormData debug", debugEntries);

        const res = await fetchWithAuth(`/api/suppliers/${supplierId}`, {
            method: 'PUT',
            body: formData
        });
        
        if (res.ok) {
            const data = await res.json();
            setSavedVideoUrl(data.header_video);
            setHeaderVideo(null); // Clear file input
            // Optionally fetchItems to refresh everything
            await fetchItems();
        } else {
            const errorData = await res.json().catch(() => ({}));
            console.error("Video upload error data:", errorData);
            
            let errorMessage = 'Error al subir video';

            // Check for proxy debug info first
            if (errorData.backend_response) {
                try {
                    // backend_response might be a JSON string or object
                    const backendError = typeof errorData.backend_response === 'string' 
                        ? JSON.parse(errorData.backend_response) 
                        : errorData.backend_response;
                    
                    if (backendError.detail) {
                         errorMessage = typeof backendError.detail === 'string' 
                            ? backendError.detail 
                            : JSON.stringify(backendError.detail);
                    } else if (backendError.message) {
                        errorMessage = backendError.message;
                    } else {
                        errorMessage = typeof errorData.backend_response === 'string' 
                            ? errorData.backend_response 
                            : JSON.stringify(errorData.backend_response);
                    }
                } catch (e) {
                    // If parsing backend_response fails, just use it as string
                    errorMessage = String(errorData.backend_response);
                }
            } 
            // Fallback to standard error fields
            else if (errorData.detail) {
                errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
            } else if (errorData.message) {
                errorMessage = errorData.message;
            }

            throw new Error(errorMessage);
        }
    } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Error al subir video");
    } finally {
        setIsVideoLoading(false);
    }
  };

  const handleDeleteHeaderVideo = async () => {
    if (!savedVideoUrl) return;
    if (!window.confirm("¿Deseas eliminar el video de encabezado actual?")) return;

    setIsDeletingVideo(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/suppliers/${supplierId}/header-video`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        const rec = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
        const message =
          (typeof rec.detail === "string" && rec.detail) ||
          (typeof rec.message === "string" && rec.message) ||
          `Error al eliminar video (${res.status})`;
        throw new Error(message);
      }

      setSavedVideoUrl(null);
      setHeaderVideo(null);
      await fetchItems();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "message" in err && typeof (err as Record<string, unknown>).message === "string"
          ? String((err as Record<string, unknown>).message)
          : "No se pudo eliminar el video.";
      setError(message);
    } finally {
      setIsDeletingVideo(false);
    }
  };

  const handleEdit = (item: CarouselItem) => {
    setEditingId(item.id);
    setTitle(item.title || '');
    setDescription(item.description || '');
    setCurrentImageUrl(getImageUrl(item.thumbnail || item.image_url || item.url || item.path || item.image || null));
    setImage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setImage(null);
    setCurrentImageUrl(null);
  };

  const handleImageChange = (file: File | null) => {
    if (file) {
      // Validate file size (e.g., 2MB limit)
      if (file.size > 2 * 1024 * 1024) {
        setError("La imagen es demasiado grande. El tamaño máximo permitido es 2MB.");
        return;
      }
    }
    setImage(file);
    if (file) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!image && !editingId) {
      setError("La imagen es obligatoria para nuevos elementos");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      if (image) {
        formData.append('image', image);
      }

      const url = editingId 
        ? `/api/suppliers/carousel/${editingId}`
        : `/api/suppliers/${supplierId}/carousel`;
      
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetchWithAuth(url, {
        method: method,
        body: formData,
      });

      if (!res.ok) {
        let errorMessage = `Error al ${editingId ? 'actualizar' : 'crear'} elemento`;
        try {
          const errorData = await res.json();
          console.log("Error response data:", errorData); // Debug log

          // Check for proxy debug info first
          if (errorData.backend_response) {
            try {
                // backend_response might be a JSON string or object
                const backendError = typeof errorData.backend_response === 'string' 
                    ? JSON.parse(errorData.backend_response) 
                    : errorData.backend_response;
                
                if (backendError.detail) {
                     errorMessage = typeof backendError.detail === 'string' 
                        ? backendError.detail 
                        : JSON.stringify(backendError.detail);
                } else if (backendError.message) {
                    errorMessage = backendError.message;
                } else {
                    errorMessage = typeof errorData.backend_response === 'string' 
                        ? errorData.backend_response 
                        : JSON.stringify(errorData.backend_response);
                }
            } catch (e) {
                // If parsing backend_response fails, just use it as string
                errorMessage = String(errorData.backend_response);
            }
          } 
          // Fallback to standard error fields
          else if (errorData.detail) {
            errorMessage = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
          } else if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          // If not JSON, try text
          const textError = await res.text().catch(() => null);
          if (textError) errorMessage = textError;
        }
        throw new Error(errorMessage);
      }

      // Siempre refrescamos desde el backend para tener lo mismo que /suppliers/{slug}
      await fetchItems();
      
      // Reset formulario y salir de edición para permitir seguir editando otros
      handleCancelEdit();
      
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ocurrió un error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (itemId: number) => {
    if (!confirm('¿Estás seguro de eliminar esta imagen?')) return;
    
    try {
      // Updated to match the requested endpoint structure: DELETE /suppliers/carousel/{carousel_id}
      const res = await fetchWithAuth(`/api/suppliers/carousel/${itemId}`, {
        method: 'DELETE',
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
      <h2 className="text-2xl font-bold text-center mb-6">Encabezado de la Empresa</h2>
      
      {/* Type Toggle */}
      <div className="flex justify-center mb-8">
        <div className="bg-gray-100 p-1 rounded-xl inline-flex">
            <button
                onClick={() => handleTabChange('video')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'video'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                <Video size={18} />
                Video
            </button>
            <button
                onClick={() => handleTabChange('image')}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'image'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                <ImageIcon size={18} />
                Imagen (Carrusel)
            </button>
        </div>
      </div>

      {activeTab === 'video' ? (
        /* Video Section */
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-8 transition-all">
             <h3 className="font-bold text-lg text-primary mb-4">
                Video de Encabezado
             </h3>
             <p className="text-gray-600 mb-6 text-sm">
                Sube un video corto para mostrar en el encabezado de tu perfil. Resolución recomendada: 1920x1080 px (16:9), con el contenido principal centrado para adaptarse a escritorio y móvil.
             </p>

             {error && <div className="text-red-500 mb-4 bg-red-50 p-3 rounded-lg border border-red-100">{error}</div>}

             <form id="video-form" onSubmit={handleVideoSubmit} className="space-y-6">
                <FileUpload
                    label={savedVideoUrl ? "Cambiar Video Actual" : "Subir Video"}
                    value={headerVideo}
                    onChange={setHeaderVideo}
                    accept="video/*"
                    helperText="Formatos recomendados: MP4, WEBM. Máximo 10MB. Duración sugerida: 8 a 15 segundos."
                />
                
                {savedVideoUrl && !headerVideo && (
                    <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                          <div>
                            <p className="text-sm text-blue-800 font-medium">Video Actual:</p>
                            <p className="text-xs text-blue-700/70">Hero recomendado: 1920x1080 px, archivo ligero y sujeto principal centrado.</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleDeleteHeaderVideo}
                            disabled={isDeletingVideo}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                          >
                            {isDeletingVideo ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            Eliminar video
                          </button>
                        </div>
                        <video 
                            src={getImageUrl(savedVideoUrl)} 
                            controls 
                            className="w-full max-h-64 rounded-lg bg-black object-contain"
                        />
                    </div>
                )}
             </form>
        </div>
      ) : (
        /* Carousel Section (Existing) */
        <>
            <p className="text-gray-600 text-center mb-8">
                Sube hasta 3 imágenes para destacar tu empresa. (Mínimo 1 recomendada)
            </p>

            {/* Upload Form */}
            <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-8 transition-all">
                <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg text-primary">
                    {editingId ? 'Editar Imagen' : 'Agregar Nueva Imagen'}
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
                
                <form id="image-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700">Título</label>
                    <input 
                    type="text" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
                    placeholder="Ej. Bienvenidos a mi tienda"
                    />
                </div>
                
                <div className="md:col-span-2">
                    <FileUpload
                        label={editingId ? "Cambiar Imagen (Opcional)" : "Imagen del Carrusel"}
                        value={image}
                        onChange={handleImageChange}
                        currentImageUrl={currentImageUrl}
                        helperText="1920x600px recomendado. Máx 2MB. Formatos: JPG, PNG, WEBP."
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1 text-gray-700">Descripción</label>
                    <textarea 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all" 
                    rows={2}
                    placeholder="Una breve descripción para tus clientes..."
                    />
                </div>
                {!editingId && items.length >= 3 && (
                    <div className="md:col-span-2 text-center mt-2">
                    <span className="text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                        Máximo 3 imágenes alcanzado.
                    </span>
                    </div>
                )}
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
                    <p className="text-gray-400">No hay imágenes subidas aún.</p>
                </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {items.map((item) => (
                    <div 
                        key={item.id} 
                        className={`relative group border rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-all bg-white ${
                        editingId === item.id ? 'ring-2 ring-primary border-primary' : 'border-gray-200'
                        }`}
                    >
                        <div className="h-48 bg-gray-100 relative overflow-hidden">
                        <img 
                            src={getImageUrl(item.thumbnail || item.image_url || item.url || item.path || item.image || null)} 
                            alt={item.title} 
                            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" 
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>
                        
                        <div className="p-5 flex-grow">
                        {item.title && item.title.trim() !== '' && item.title.trim().toLowerCase() !== 'string' && (
                            <h4 className="font-bold text-gray-800 text-lg mb-1">{item.title}</h4>
                        )}
                        {item.description && item.description.trim() !== '' && item.description.trim().toLowerCase() !== 'string' && (
                            <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                        )}
                        </div>
                        
                        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => handleEdit(item)}
                            className="p-2 bg-white text-blue-600 rounded-full shadow-sm hover:bg-blue-50 transition-colors"
                            title="Editar"
                        >
                            <Edit2 size={16} />
                        </button>
                        <button 
                            onClick={() => handleDelete(item.id)}
                            className="p-2 bg-white text-red-600 rounded-full shadow-sm hover:bg-red-50 transition-colors"
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
        </>
      )}

      <div className="flex justify-end pt-4 border-t border-gray-100 gap-3">
        {activeTab === 'image' && editingId && (
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
          form={activeTab === 'video' ? 'video-form' : 'image-form'}
          disabled={activeTab === 'video' ? (isVideoLoading || !headerVideo) : (loading || (!editingId && items.length >= 3))}
          className="bg-primary text-white font-bold py-3 px-8 rounded-lg hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
        >
          {(activeTab === 'video' ? isVideoLoading : loading) ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Guardando...
            </>
          ) : (
            "Guardar"
          )}
        </button>
      </div>
    </div>
  );
}
