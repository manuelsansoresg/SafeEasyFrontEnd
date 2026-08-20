'use client';

import { useState, useEffect, useRef } from 'react';
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
  image_movil?: string;
  thumbnail_movil?: string;
}

const carouselSubmissionsInFlight = new Set<string>();
const recentCarouselSubmissions = new Map<string, number>();
const DUPLICATE_SUBMISSION_WINDOW_MS = 15_000;

const getCarouselSubmissionKey = (supplierId: number, editingId: number | null, file: File) =>
  `${supplierId}:${editingId ?? "new"}:${file.size}:${file.lastModified}:${file.name}`;

const isRecentCarouselSubmission = (key: string) => {
  const now = Date.now();
  for (const [storedKey, expiresAt] of recentCarouselSubmissions) {
    if (expiresAt <= now) recentCarouselSubmissions.delete(storedKey);
  }
  return carouselSubmissionsInFlight.has(key) || (recentCarouselSubmissions.get(key) ?? 0) > now;
};

export default function StepCarousel({ supplierId, slug, token, onNext }: StepCarouselProps) {
  const submitInFlightRef = useRef(false);
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
  const [image, setImage] = useState<File | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  const toRecord = (value: unknown) =>
    value && typeof value === "object" ? (value as Record<string, unknown>) : null;

  const pickCarouselImageUrl = (item: CarouselItem) =>
    item.thumbnail || item.image_url || item.url || item.path || item.image || null;

  const normalizeCarouselItem = (value: unknown): CarouselItem | null => {
    const rec = toRecord(value);
    if (!rec) return null;

    const imageValue =
      rec.image_url ??
      rec.imageUrl ??
      rec.image ??
      rec.url ??
      rec.path ??
      rec.thumbnail ??
      rec.file_url ??
      rec.fileUrl;
    if (typeof imageValue !== "string" || !imageValue.trim()) return null;

    return {
      id: Number(rec.id ?? rec.carousel_id ?? rec.carouselId ?? Date.now()),
      title: typeof rec.title === "string" ? rec.title : "",
      description: typeof rec.description === "string" ? rec.description : "",
      image_url: typeof rec.image_url === "string" ? rec.image_url : undefined,
      url: typeof rec.url === "string" ? rec.url : undefined,
      path: typeof rec.path === "string" ? rec.path : undefined,
      image: typeof rec.image === "string" ? rec.image : undefined,
      thumbnail: typeof rec.thumbnail === "string" ? rec.thumbnail : undefined,
      image_movil:
        typeof rec.image_movil === "string"
          ? rec.image_movil
          : typeof rec.image_mobile === "string"
            ? rec.image_mobile
            : undefined,
      thumbnail_movil:
        typeof rec.thumbnail_movil === "string"
          ? rec.thumbnail_movil
          : typeof rec.mobile_thumbnail === "string"
            ? rec.mobile_thumbnail
            : undefined,
    };
  };

  const parseCarouselItems = (payload: unknown, depth = 0): CarouselItem[] => {
    if (depth > 4 || payload == null) return [];

    if (Array.isArray(payload)) {
      return payload
        .map(normalizeCarouselItem)
        .filter((item): item is CarouselItem => item !== null);
    }

    const root = toRecord(payload);
    if (!root) return [];

    const keys = [
      "carousel_images",
      "carouselImages",
      "carousel",
      "images",
      "items",
      "results",
      "data",
      "result",
      "supplier",
    ];

    for (const key of keys) {
      const found = parseCarouselItems(root[key], depth + 1);
      if (found.length > 0) return found;
    }

    const single = normalizeCarouselItem(root);
    return single ? [single] : [];
  };

  const parseSupplierHeader = (payload: unknown) => {
    const root = toRecord(payload);
    const data = toRecord(root?.data) ?? toRecord(root?.supplier) ?? root;
    return {
      headerMediaType: typeof data?.header_media_type === "string" ? data.header_media_type : null,
      headerVideo: typeof data?.header_video === "string" ? data.header_video : null,
    };
  };

  const fetchItems = async () => {
    setFetching(true);
    try {
      const urls = [
        `/api/suppliers/${supplierId}`,
        `/api/suppliers/${supplierId}/`,
        `/api/backend/suppliers/${supplierId}`,
        `/api/backend/suppliers/${supplierId}/`,
        ...(slug
          ? [
              `/api/suppliers/${encodeURIComponent(slug)}`,
              `/api/suppliers/${encodeURIComponent(slug)}/`,
              `/api/backend/suppliers/${encodeURIComponent(slug)}`,
              `/api/backend/suppliers/${encodeURIComponent(slug)}/`,
            ]
          : []),
      ];

      for (const url of urls) {
        const res = await fetchWithAuth(url);
        if (!res.ok) continue;

        const data: unknown = await res.json().catch(() => null);
        const carouselItems = parseCarouselItems(data);
        setItems(carouselItems);

        const { headerMediaType, headerVideo } = parseSupplierHeader(data);
        if (headerMediaType === 'video') {
          setActiveTab('video');
        } else if (headerMediaType === 'image') {
          setActiveTab('image');
        }
        setSavedVideoUrl(headerVideo);
        return;
      }
    } catch (e) {
      console.warn("Error fetching carousel items", e);
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
        console.warn("Error updating media type preference", e);
    }
  };

  const handleVideoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!headerVideo) return;
    if (submitInFlightRef.current) return;

    submitInFlightRef.current = true;
    
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
        console.debug("[StepCarousel] Video Upload FormData debug", debugEntries);

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
            console.warn("Video upload error data:", errorData);
            
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
        submitInFlightRef.current = false;
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
    setCurrentImageUrl(getImageUrl(pickCarouselImageUrl(item)));
    setImage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setImage(null);
    setCurrentImageUrl(null);
  };

  const handleImageChange = (file: File | null) => {
    if (file) {
      // Validate file size (e.g., 4MB limit)
      if (file.size > 4 * 1024 * 1024) {
        setError("La imagen es demasiado grande. El tamaño máximo permitido es 4MB.");
        return;
      }
    }
    setImage(file);
    if (file) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const editingItem = editingId ? items.find((item) => item.id === editingId) : null;
    const hasCurrentImage = Boolean(editingItem && pickCarouselImageUrl(editingItem));

    if (!image && !hasCurrentImage) {
      setError("Selecciona una imagen para continuar.");
      return;
    }
    if (!image) {
      setError("Selecciona una nueva imagen para guardar el cambio.");
      return;
    }

    const submissionKey = getCarouselSubmissionKey(supplierId, editingId, image);
    if (isRecentCarouselSubmission(submissionKey)) {
      setError("Esta imagen ya se está procesando. Espera un momento antes de volver a intentarlo.");
      return;
    }
    if (submitInFlightRef.current) return;

    submitInFlightRef.current = true;
    carouselSubmissionsInFlight.add(submissionKey);
    recentCarouselSubmissions.set(submissionKey, Date.now() + DUPLICATE_SUBMISSION_WINDOW_MS);
    
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
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
        headers: {
          "X-Idempotency-Key": `carousel-${supplierId}-${editingId ?? "new"}-${image.size}-${image.lastModified}`,
        },
        retryOnAuthFailure: false,
      });

      if (!res.ok) {
        let errorMessage = `Error al ${editingId ? 'actualizar' : 'crear'} elemento`;
        try {
          const errorData = await res.json();
          console.warn("Error response data:", errorData);

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

      const savedPayload: unknown = await res.json().catch(() => null);
      const savedItems = parseCarouselItems(savedPayload);
      if (savedItems.length > 0) {
        setItems((prev) => {
          if (editingId) {
            return prev.map((item) => (item.id === editingId ? { ...item, ...savedItems[0] } : item));
          }
          const exists = prev.some((item) => item.id === savedItems[0].id);
          return exists ? prev : [...prev, savedItems[0]].slice(0, 3);
        });
      }

      // Siempre refrescamos desde el backend para tener lo mismo que /suppliers/{id}
      await fetchItems();
      
      // Reset formulario y salir de edición para permitir seguir editando otros
      handleCancelEdit();
      
    } catch (err: unknown) {
      recentCarouselSubmissions.delete(submissionKey);
      const message = err instanceof Error ? err.message : "Ocurrió un error al guardar";
      setError(
        /abort|timeout|timed out/i.test(message)
          ? "La imagen está tardando más de lo esperado. Inténtalo nuevamente en un momento."
          : message,
      );
    } finally {
      carouselSubmissionsInFlight.delete(submissionKey);
      submitInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleDelete = async (itemId: number) => {
    if (!confirm('¿Eliminar esta imagen? Esta acción no se puede deshacer.')) return;
    
    try {
      // Updated to match the requested endpoint structure: DELETE /suppliers/carousel/{carousel_id}
      const res = await fetchWithAuth(`/api/suppliers/carousel/${itemId}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        throw new Error(`No se pudo eliminar la imagen (${res.status}).`);
      }

      await fetchItems();
      if (editingId === itemId) {
        handleCancelEdit();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la imagen.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 text-center">
        <h2 className="font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28]">Encabezado de la empresa</h2>
        <p className="mt-2 text-sm text-gray-500">Selecciona el tipo de contenido que quieres mostrar en la parte superior de tu perfil.</p>
      </div>
      
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
                Usar video
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
                Usar imágenes (carrusel)
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
                Sube un video corto y claro para presentar tu negocio.
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
                            <p className="text-xs text-blue-700/70">Procura que sea breve y que el elemento principal se vea claramente.</p>
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
                Puedes agregar hasta 3 imágenes para destacar tu negocio.
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

                <p className="text-gray-600 mb-6 text-sm">
                    Elige una buena imagen. Drooopy la adaptará automáticamente para computadora y celular.
                </p>
                
                {error && <div className="text-red-500 mb-4 bg-red-50 p-3 rounded-lg border border-red-100">{error}</div>}
                
                <form id="image-form" onSubmit={handleSubmit} className="grid grid-cols-1 gap-5">
                <div className="mx-auto w-full max-w-2xl">
                    <FileUpload
                        key={`cover-${editingId ?? 'new'}`}
                        label={currentImageUrl ? "Cambiar imagen (opcional)" : "Agregar imagen"}
                        value={image}
                        onChange={handleImageChange}
                        currentImageUrl={currentImageUrl}
                        removeBehavior="clear_selection"
                        disabled={loading}
                        helperText="JPG, PNG o WebP, máximo 4 MB. Nosotros nos encargamos del resto."
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
                        className={`relative border rounded-2xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-all bg-white ${
                        editingId === item.id ? 'ring-2 ring-primary border-primary' : 'border-gray-200'
                        }`}
                    >
                        <div className="bg-gray-100 p-2">
                          <figure className="min-w-0">
                            <div className="relative h-44 overflow-hidden rounded-xl bg-gray-200">
                              <img
                                src={getImageUrl(pickCarouselImageUrl(item))}
                                alt={item.title ? `Imagen de ${item.title}` : "Imagen destacada del negocio"}
                                className="h-full w-full object-cover"
                              />
                            </div>
                          </figure>
                        </div>
                        
                        <div className="p-5 flex-grow">
                        {item.title && item.title.trim() !== '' && item.title.trim().toLowerCase() !== 'string' && (
                            <h4 className="font-bold text-gray-800 text-lg mb-1">{item.title}</h4>
                        )}
                        {item.description && item.description.trim() !== '' && item.description.trim().toLowerCase() !== 'string' && (
                            <p className="text-sm text-gray-600 line-clamp-2">{item.description}</p>
                        )}
                        </div>
                        
                        <div className="flex gap-2 border-t border-gray-100 px-5 py-3">
                        <button 
                            type="button"
                            onClick={() => handleEdit(item)}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-[#004e28] transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00] focus-visible:ring-offset-2"
                        >
                            <Edit2 size={16} aria-hidden="true" />
                            Editar
                        </button>
                        <button 
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                        >
                            <Trash2 size={16} aria-hidden="true" />
                            Eliminar
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
          aria-busy={activeTab === 'video' ? isVideoLoading : loading}
          disabled={activeTab === 'video' ? (isVideoLoading || !headerVideo) : (loading || (!editingId && items.length >= 3))}
          className="bg-primary text-white font-bold py-3 px-8 rounded-lg hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
        >
          {(activeTab === 'video' ? isVideoLoading : loading) ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Procesando imagen...
            </>
          ) : (
            "Guardar"
          )}
        </button>
      </div>
    </div>
  );
}
