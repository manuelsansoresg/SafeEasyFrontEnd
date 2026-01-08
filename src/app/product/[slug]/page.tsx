"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { 
  MessageCircle, 
  Truck, 
  Check, 
  ShieldCheck, 
  Play, 
  ZoomIn, 
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Package,
  CreditCard
} from "lucide-react";
import Link from "next/link";

// Interfaces
interface ProductMedia {
  id: number;
  product_id: string;
  type: "image" | "video";
  filename: string;
  path: string;
  url: string;
  thumbnail_url: string | null;
  is_primary: boolean;
  position: number;
}

interface ProductDetail {
  id: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  sku: string;
  is_active: boolean;
  supplier_id: number;
  category_id: number;
  subcategory_id: number;
  slug: string;
  image: string | null;
  thumbnail_url: string | null;
  category: {
    id: number;
    name: string;
    description: string;
    icon: string | null;
    is_active: boolean;
    slug: string;
  };
  subcategory: {
    id: number;
    name: string;
    category_id: number;
    is_active: boolean;
    slug: string;
    image: string | null;
    thumbnail_url: string | null;
  };
  media: ProductMedia[];
}

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  useEffect(() => {
    if (slug) {
      fetchProduct();
    }
  }, [slug]);

  const fetchProduct = async () => {
    try {
      // Use local proxy to avoid CORS and ensure correct backend targeting
      const baseUrl = '/api';
      console.log(`[ProductDetail] Fetching slug: ${slug} from ${baseUrl}`);

      // Strategy 1: Try direct fetch (ID or Slug supported?)
      let res = await fetch(`${baseUrl}/products/${slug}`, {
        headers: { 'Accept': 'application/json' }
      });
      
      // Strategy 2: If direct fetch fails (404/500), try searching by slug
      if (!res.ok) {
        console.warn(`[ProductDetail] Direct fetch failed (${res.status}). Trying search fallback...`);
        
        // Use the listing endpoint with search
        const searchUrl = `${baseUrl}/products/?search=${encodeURIComponent(slug)}&limit=1`;
        const searchRes = await fetch(searchUrl, {
             headers: { 'Accept': 'application/json' }
        });
        
        if (searchRes.ok) {
            const searchData = await searchRes.json();
            if (Array.isArray(searchData) && searchData.length > 0) {
                const productSummary = searchData[0];
                // Check slug match to avoid fuzzy search false positives
                if (productSummary.slug === slug) {
                     console.log(`[ProductDetail] Found product by search. ID: ${productSummary.id}. Fetching details...`);
                     // Now fetch details by ID
                     res = await fetch(`${baseUrl}/products/${productSummary.id}`, {
                        headers: { 'Accept': 'application/json' }
                     });
                }
            }
        }
      }

      if (!res.ok) {
          throw new Error(`Producto no encontrado (${res.status})`);
      }
      
      const data = await res.json();
      setProduct(data);
    } catch (err) {
      console.error("[ProductDetail] Error:", err);
      setError(err instanceof Error ? err.message : "Error al cargar el producto");
    } finally {
      setLoading(false);
    }
  };

  const getFullImageUrl = (path: string | null) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8080';
    // Remove leading slash if present in path to avoid double slashes if baseUrl has one,
    // but usually baseUrl doesn't have trailing slash.
    // If path starts with /, just concat.
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const handlePrevMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product || !product.media) return;
    setSelectedMediaIndex((prev) => (prev === 0 ? product.media.length - 1 : prev - 1));
  };

  const handleNextMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!product || !product.media) return;
    setSelectedMediaIndex((prev) => (prev === product.media.length - 1 ? 0 : prev + 1));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-gray-500 font-medium">Cargando producto...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-2xl shadow-sm">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Producto no encontrado</h2>
          <p className="text-gray-500 mb-6">{error || "El producto que buscas no existe o ha sido eliminado."}</p>
          <Link 
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-primary hover:bg-primary/90 transition-colors"
          >
            Volver al catálogo
          </Link>
        </div>
      </div>
    );
  }

  const currentMedia = product.media && product.media.length > 0 
    ? product.media[selectedMediaIndex] 
    : null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Breadcrumb - Simple version */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center text-sm text-gray-500">
            <Link href="/" className="hover:text-primary">Inicio</Link>
            <ChevronRight size={14} className="mx-2" />
            <span className="text-gray-900 truncate">{product.category?.name}</span>
            <ChevronRight size={14} className="mx-2" />
            <span className="text-gray-900 font-medium truncate">{product.title}</span>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-gray-100">
            
            {/* Left Column: Media Gallery */}
            <div className="p-6 lg:p-8 space-y-6">
              {/* Main Visualizer */}
              <div 
                className="relative aspect-square bg-gray-50 rounded-xl overflow-hidden group cursor-zoom-in border border-gray-100"
                onClick={() => setIsZoomOpen(true)}
              >
                {currentMedia ? (
                  currentMedia.type === 'video' ? (
                    <div className="w-full h-full flex items-center justify-center bg-black">
                      <video 
                        src={getFullImageUrl(currentMedia.url)} 
                        className="w-full h-full object-contain"
                        controls
                        onClick={(e) => e.stopPropagation()} // Prevent zoom on video click? User said "debe reproducirse igual" but "si le das click se agranda". Maybe separate click targets or just allow zoom.
                      />
                    </div>
                  ) : (
                    <img 
                      src={getFullImageUrl(currentMedia.url)} 
                      alt={product.title}
                      className="w-full h-full object-contain mix-blend-multiply"
                    />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <Package size={64} opacity={0.2} />
                  </div>
                )}
                
                {/* Hover overlay for zoom hint */}
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <span className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium shadow-sm flex items-center gap-2">
                    <ZoomIn size={16} />
                    Ampliar
                  </span>
                </div>
              </div>

              {/* Thumbnails */}
              {product.media && product.media.length > 1 && (
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {product.media.map((media, index) => (
                    <button
                      key={media.id}
                      onClick={() => setSelectedMediaIndex(index)}
                      className={`
                        relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all
                        ${selectedMediaIndex === index ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-gray-300'}
                      `}
                    >
                      {media.type === 'video' ? (
                        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                          <Play size={24} className="text-white" />
                        </div>
                      ) : (
                        <img 
                          src={getFullImageUrl(media.url)} 
                          alt={`View ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {media.type === 'video' && (
                        <div className="absolute top-1 right-1 w-4 h-4 bg-black/50 rounded-full flex items-center justify-center">
                           <Play size={8} className="text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Details */}
            <div className="p-6 lg:p-8 flex flex-col h-full">
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                    {product.title}
                  </h1>
                </div>

                <div className="flex items-center gap-4 mb-6 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-gray-900">SKU:</span>
                    <span className="font-mono">{product.sku}</span>
                  </div>
                  <div className="w-px h-4 bg-gray-300"></div>
                  <div className="flex items-center gap-1">
                     <span className={`inline-block w-2 h-2 rounded-full ${product.stock > 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                     <span>{product.stock > 0 ? 'En Stock' : 'Agotado'}</span>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-primary">
                      ${product.price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-sm text-gray-500 font-medium">MXN</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Precio por unidad (IVA incluido)</p>
                </div>

                {/* Stock & Quantity Placeholder (Static for now as requested "elementos que consideres como stock") */}
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 mb-8">
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Disponibilidad:</span>
                      <span className="text-sm font-bold text-gray-900">{product.stock} unidades</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ width: `${Math.min((product.stock / 100) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <Truck size={16} />
                      <span className="font-medium">Envío disponible a todo México</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <button className="flex-1 bg-primary text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                    <MessageCircle size={24} />
                    Chat con Proveedor
                  </button>
                </div>

                {/* Safety Badges */}
                <div className="grid grid-cols-2 gap-4 pt-6 border-t border-gray-100">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="text-green-600 shrink-0" size={20} />
                    <div>
                      <p className="text-sm font-bold text-gray-900">Compra Segura</p>
                      <p className="text-xs text-gray-500">Protección al comprador garantizada</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="text-blue-600 shrink-0" size={20} />
                    <div>
                      <p className="text-sm font-bold text-gray-900">Calidad Verificada</p>
                      <p className="text-xs text-gray-500">Producto revisado antes del envío</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="border-t border-gray-100 p-6 lg:p-8 bg-gray-50/50">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Package size={20} className="text-primary" />
              Descripción del Producto
            </h3>
            <div 
              className="prose prose-sm sm:prose max-w-none text-gray-600 bg-white p-6 rounded-xl border border-gray-200 shadow-sm"
              dangerouslySetInnerHTML={{ __html: product.description }}
            />
          </div>
        </div>
      </main>

      {/* Zoom Modal */}
      {isZoomOpen && currentMedia && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsZoomOpen(false)}
        >
          <button 
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
            onClick={() => setIsZoomOpen(false)}
          >
            <X size={32} />
          </button>
          
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2"
            onClick={handlePrevMedia}
          >
            <ChevronLeft size={48} />
          </button>
          
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white p-2"
            onClick={handleNextMedia}
          >
            <ChevronRight size={48} />
          </button>

          <div 
            className="max-w-5xl max-h-[90vh] w-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {currentMedia.type === 'video' ? (
              <video 
                src={getFullImageUrl(currentMedia.url)} 
                className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
                controls
                autoPlay
              />
            ) : (
              <img 
                src={getFullImageUrl(currentMedia.url)} 
                alt={product.title}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>
          
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto max-w-[90vw] p-2">
             {product.media && product.media.map((media, index) => (
               <button
                 key={media.id}
                 onClick={(e) => { e.stopPropagation(); setSelectedMediaIndex(index); }}
                 className={`w-12 h-12 rounded-md overflow-hidden border-2 transition-all ${selectedMediaIndex === index ? 'border-white scale-110' : 'border-white/30 hover:border-white/70'}`}
               >
                 {media.type === 'video' ? (
                   <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                     <Play size={16} className="text-white" />
                   </div>
                 ) : (
                   <img 
                      src={getFullImageUrl(media.url)} 
                      className="w-full h-full object-cover" 
                   />
                 )}
               </button>
             ))}
          </div>
        </div>
      )}
    </div>
  );
}
