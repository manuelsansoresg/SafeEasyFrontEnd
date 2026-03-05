"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Supplier, CarouselImage, Certificate } from "@/lib/products";
import { MapPin, Phone, Mail, CheckCircle, ChevronLeft, ChevronRight, Store, Star, Check, MessageCircle, FileText, Award, X, Calendar, ExternalLink, Play } from "lucide-react";
import StarRating from "@/components/StarRating";
import { ProductCard } from "@/components/ProductCard";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import MapPicker from "@/components/ui/MapPicker";
import DOMPurify from "isomorphic-dompurify";

function InlineVideo({ src, poster }: { src: string; poster?: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);

  const getMime = () => {
    const lower = src.toLowerCase();
    if (lower.endsWith(".mp4")) return "video/mp4";
    if (lower.endsWith(".webm")) return "video/webm";
    if (lower.endsWith(".ogg")) return "video/ogg";
    if (lower.endsWith(".mov")) return "video/quicktime";
    return undefined;
  };
  const altMp4 = src.toLowerCase().endsWith(".mov")
    ? src.slice(0, -4) + ".mp4"
    : null;

  const startPlayback = () => {
    setShowPlayer(true);
    // Attempt playback on next tick once the video is mounted
    setTimeout(async () => {
      if (!videoRef.current) return;
      try {
        videoRef.current.muted = true;
        videoRef.current.load();
        const p = videoRef.current.play();
        if (p && typeof p.then === "function") {
          await p;
          setPlaying(true);
        }
      } catch {
        // Keep player visible with controls so user can try manual play.
        setPlaying(false);
      }
    }, 0);
  };

  return (
    <div className="relative w-full">
      {showPlayer && !error && (
        <video
          ref={videoRef}
          className="w-full h-full object-cover block"
          preload="metadata"
          playsInline
          controls
          onError={() => setError(true)}
          poster={poster}
        >
          <source src={src} type={getMime()} />
          {altMp4 ? <source src={altMp4} type="video/mp4" /> : null}
        </video>
      )}

      {!showPlayer && !error && (
        <button
          type="button"
          onClick={startPlayback}
          className="relative w-full aspect-video overflow-hidden"
          aria-label="Reproducir video"
        >
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gray-900" />
          )}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <span className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/90 text-gray-900 shadow-lg">
              <Play size={28} />
            </span>
          </div>
        </button>
      )}

      {error && (
        <div className="w-full h-64 md:h-80 bg-gray-900 text-white flex flex-col items-center justify-center gap-2">
          <div className="text-sm opacity-80">No se pudo reproducir el video aquí.</div>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white text-gray-900 rounded-full text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Ver archivo
          </a>
        </div>
      )}
    </div>
  );
}

interface SupplierProductCategory {
  id: number;
  name: string;
  description: string;
  icon: string | null;
  is_active: boolean;
  slug: string;
}

interface SupplierProductSubcategory {
  id: number;
  name: string;
  category_id: number;
  is_active: boolean;
  slug: string;
  image: string | null;
  thumbnail_url: string | null;
}

interface SupplierProduct {
  id: number;
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
  average_rating?: number;
  thumbnail_url?: string | null;
  category?: SupplierProductCategory;
  subcategory?: SupplierProductSubcategory;
}

interface SupplierRating {
  id: number;
  rating: number;
  comment: string;
  user_name: string | null;
  product_id: string;
  product_title: string;
  product_slug: string;
  product_image?: string | null;
  product_thumbnail_url?: string | null;
  created_at?: string;
}

interface SupplierRatingsResponse {
  supplier_slug: string;
  total: number;
  skip: number;
  limit: number;
  ratings: SupplierRating[];
}



export default function SupplierPage() {
  const { slug } = useParams();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("inicio");
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 50;
  const [hasMore, setHasMore] = useState(false);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const [selectedSubcategorySlug, setSelectedSubcategorySlug] = useState<string | null>(null);
  const [ratings, setRatings] = useState<SupplierRating[]>([]);

  const mapLocation = supplier?.map_location ? (() => {
    try {
      return typeof supplier.map_location === 'string' 
        ? JSON.parse(supplier.map_location) 
        : supplier.map_location;
    } catch {
      return null;
    }
  })() : null;
  const [ratingsTotal, setRatingsTotal] = useState(0);
  const [ratingsSkip, setRatingsSkip] = useState(0);
  const ratingsLimit = 50;
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingsLoadingMore, setRatingsLoadingMore] = useState(false);
  const [ratingsError, setRatingsError] = useState<string | null>(null);
  const [ratingsHasMore, setRatingsHasMore] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  const { syncFavorites } = useFavoritesStore();
  const { token } = useAuthStore();
  
  const observerTarget = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !productsLoading) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, productsLoading]);

  useEffect(() => {
    if (slug) {
      fetchSupplier(slug as string);
      setPage(1);
      setSelectedCategorySlug(null);
      setSelectedSubcategorySlug(null);
    }
  }, [slug]);

  useEffect(() => {
    if (slug) {
      fetchProducts(slug as string, 1, false);
      fetchRatings(slug as string, 0, false);
    }
  }, [slug, token]);

  const fetchSupplier = async (slug: string) => {
    try {
      const res = await fetch(`/api/suppliers/${slug}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setSupplier(data);
      }
    } catch (error) {
      console.error("Error fetching supplier", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (supplierSlug: string, currentPage: number, append: boolean = false) => {
    try {
      if (!append) {
         setProductsLoading(true);
      }
      setProductsError(null);

      const skip = (currentPage - 1) * limit;
      const params = new URLSearchParams();
      params.set("skip", String(skip));
      params.set("limit", String(limit));

      const res = await fetchWithAuth(`/api/products/by-supplier/${supplierSlug}?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        console.error("Error fetching supplier products", res.status, res.statusText);
        if (!append) setProducts([]);
        setHasMore(false);
        setProductsError("No fue posible cargar los productos.");
        return;
      }

      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.items || data.results || []);
      const newProducts = items as SupplierProduct[];
      
      syncFavorites(newProducts);

      setProducts(prev => append ? [...prev, ...newProducts] : newProducts);
      setHasMore(Array.isArray(items) && items.length === limit);
    } catch (error) {
      console.error("Error fetching supplier products", error);
      setProductsError("Ocurrió un error al cargar los productos.");
      if (!append) setProducts([]);
      setHasMore(false);
    } finally {
      setProductsLoading(false);
    }
  };

  const fetchRatings = async (supplierSlug: string, skip: number = 0, append: boolean = false) => {
    try {
      if (append) {
        setRatingsLoadingMore(true);
      } else {
        setRatingsLoading(true);
      }
      setRatingsError(null);

      const params = new URLSearchParams();
      params.set("skip", String(skip));
      params.set("limit", String(ratingsLimit));

      const res = await fetch(`/api/suppliers/${supplierSlug}/ratings?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Error fetching supplier ratings", res.status, res.statusText, text);
        setRatings([]);
        setRatingsTotal(0);
        setRatingsSkip(0);
        setRatingsHasMore(false);
        setRatingsError("No fue posible cargar las calificaciones.");
        return;
      }

      const data = (await res.json()) as SupplierRatingsResponse | { ratings?: SupplierRating[]; total?: number; skip?: number; limit?: number };
      const ratingsList = Array.isArray((data as SupplierRatingsResponse).ratings)
        ? (data as SupplierRatingsResponse).ratings
        : Array.isArray((data as any).ratings)
        ? (data as any).ratings
        : [];

      const total = typeof (data as SupplierRatingsResponse).total === "number" ? (data as SupplierRatingsResponse).total : ratingsList.length;
      const responseSkip = typeof (data as SupplierRatingsResponse).skip === "number" ? (data as SupplierRatingsResponse).skip : skip;
      const responseLimit = typeof (data as SupplierRatingsResponse).limit === "number" ? (data as SupplierRatingsResponse).limit : ratingsLimit;

      setRatings((prev) => {
        const next = append ? [...prev, ...ratingsList] : ratingsList;
        const hasMore = total > next.length && ratingsList.length >= responseLimit;
        setRatingsHasMore(hasMore);
        return next;
      });

      setRatingsTotal(total);
      setRatingsSkip(responseSkip);
    } catch (error) {
      console.error("Error fetching supplier ratings", error);
      setRatings([]);
      setRatingsTotal(0);
      setRatingsSkip(0);
      setRatingsHasMore(false);
      setRatingsError("Ocurrió un error al cargar las calificaciones.");
    } finally {
      setRatingsLoading(false);
      setRatingsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!slug) return;
    if (page === 1) return;
    fetchProducts(slug as string, page, true);
  }, [page, slug]);

  const sanitizeHtml = (html: string) => {
    if (!html) return "";
    return DOMPurify.sanitize(html);
  };

  const categories = (() => {
    const map = new Map<string, SupplierProductCategory>();
    products.forEach((product) => {
      if (product.category) {
        map.set(product.category.slug, product.category);
      }
    });
    return Array.from(map.values());
  })();

  const subcategories = (() => {
    const map = new Map<string, SupplierProductSubcategory>();
    products.forEach((product) => {
      if (
        product.subcategory &&
        (!selectedCategorySlug || product.category?.slug === selectedCategorySlug)
      ) {
        map.set(product.subcategory.slug, product.subcategory);
      }
    });
    return Array.from(map.values());
  })();

  const getRatingLabel = (rating: number) => {
    if (rating >= 4.5) return "Excelente";
    if (rating >= 4.0) return "Muy Bueno";
    if (rating >= 3.0) return "Bueno";
    if (rating >= 2.0) return "Regular";
    return "Malo";
  };

  const getImageUrl = (path: string | null) => {
    if (!path) return "/placeholder.png";
    if (path.startsWith('http')) return path;
    const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://drooopy.com/api').replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`.replace(/([^:])\/{2,}/g, '$1/');
  };

  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategorySlug ? product.category?.slug === selectedCategorySlug : true;
    const matchesSubcategory = selectedSubcategorySlug ? product.subcategory?.slug === selectedSubcategorySlug : true;
    return matchesCategory && matchesSubcategory;
  });

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );

  if (!supplier)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Empresa no encontrada</h2>
          <p className="text-gray-500">No pudimos encontrar la empresa que buscas.</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b md:sticky md:top-16 md:z-40 transition-all duration-300">
        <div className="container mx-auto px-4 py-4 flex flex-col md:flex-row items-center gap-4 md:gap-6">
          <div className="w-20 h-20 md:w-24 md:h-24 relative shrink-0 bg-white border rounded-xl overflow-hidden shadow-sm">
            {supplier.logo ? (
              <img src={supplier.logo} alt={supplier.name} className="w-full h-full object-contain p-2" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-300">
                <Store size={32} />
              </div>
            )}
          </div>

          <div className="flex-1 text-center md:text-left space-y-1">
            <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center justify-center md:justify-start gap-2 flex-wrap">
                  {supplier.name}
                  {supplier.certificates && supplier.certificates.length > 0 && (
                    <div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-medium border border-blue-100 uppercase tracking-wide">
                      <CheckCircle size={12} />
                      <span>Certificado</span>
                    </div>
                  )}
                </h1>
                <p className="text-gray-500 text-sm md:text-base max-w-2xl line-clamp-1">
                  {supplier.short_description || "Empresa destacada en SafeEasy"}
                </p>
                
                {supplier.city && supplier.country && (
                  <div className="flex items-center justify-center md:justify-start gap-1.5 text-gray-400 text-xs mt-1">
                    <MapPin size={14} />
                    <span>
                      {supplier.city}, {supplier.state}, {supplier.country}
                    </span>
                  </div>
                )}
              </div>

              <div className="hidden md:flex flex-col items-end bg-gray-50/50 p-2 rounded-lg border border-gray-100 min-w-[140px]">
                <div className="flex items-center gap-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-gray-900">
                      {supplier.average_rating ? supplier.average_rating.toFixed(1) : "0.0"}
                    </span>
                    <span className="text-gray-400 text-xs font-medium">/5</span>
                  </div>
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                </div>
                <div className="font-medium text-gray-700 text-xs">
                  {supplier.average_rating ? getRatingLabel(supplier.average_rating) : "Sin calificaciones"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {supplier.carousel_images && supplier.carousel_images.length > 0 && (
        <section id="inicio" className="scroll-mt-32">
          <div className="relative w-full bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
            <div className="w-full max-w-none lg:max-w-7xl xl:max-w-[1400px] mx-auto px-0 sm:px-4 lg:px-8 py-6 md:py-10">
              <div className="w-full rounded-none sm:rounded-2xl md:rounded-3xl overflow-hidden relative shadow-2xl shadow-black/40 bg-gray-900 group">
                <div className="relative w-full pb-[56.25%] md:pb-[50%] lg:pb-[45%] xl:pb-[40%]">
                  <div className="absolute inset-0">
                    <Carousel images={supplier.carousel_images} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="container mx-auto px-4 py-10 space-y-16 overflow-x-hidden">
        <section className="space-y-8">
          {supplier.description && (
            <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold mb-6 text-gray-900 border-b pb-4">Descripción de la Empresa</h2>
              <div className="prose prose-lg max-w-none w-full text-gray-600 prose-headings:text-gray-800 prose-a:text-primary">
                <div
                  className="whitespace-normal max-w-full description-html"
                  style={{ 
                    textAlign: "left", 
                    wordBreak: "normal", 
                    overflowWrap: "normal",
                    hyphens: "none",
                    WebkitHyphens: "none"
                  }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(supplier.description) }}
                />
              </div>
            </div>
          )}
        </section>

        <section id="productos" className="scroll-mt-32">
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Productos</h2>
                <p className="text-gray-500 text-sm md:text-base">
                  Explora los productos que ofrece {supplier.name}.
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Categorías
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategorySlug(null);
                    setSelectedSubcategorySlug(null);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    !selectedCategorySlug
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-gray-700 border-gray-200 hover:border-primary/50"
                  }`}
                >
                  Todas
                </button>
                {categories.map((category) => (
                  <button
                    key={category.slug}
                    type="button"
                    onClick={() => {
                      setSelectedCategorySlug(category.slug);
                      setSelectedSubcategorySlug(null);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      selectedCategorySlug === category.slug
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-gray-700 border-gray-200 hover:border-primary/50"
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>

              {selectedCategorySlug && subcategories.length > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Subcategorías
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedSubcategorySlug(null)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      !selectedSubcategorySlug
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-gray-700 border-gray-200 hover:border-primary/50"
                    }`}
                  >
                    Todas
                  </button>
                  {subcategories.map((subcategory) => (
                    <button
                      key={subcategory.slug}
                      type="button"
                      onClick={() => setSelectedSubcategorySlug(subcategory.slug)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        selectedSubcategorySlug === subcategory.slug
                          ? "bg-primary text-white border-primary"
                          : "bg-white text-gray-700 border-gray-200 hover:border-primary/50"
                      }`}
                    >
                      {subcategory.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {productsLoading && page === 1 ? (
              <div className="flex justify-center py-10">
                <div className="flex items-center gap-3 text-gray-500">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Cargando productos...</span>
                </div>
              </div>
            ) : productsError ? (
              <div className="py-8 text-center text-sm text-red-500">
                {productsError}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                No se encontraron productos para esta empresa.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      id={String(product.id)}
                      title={product.title}
                      price={product.price}
                      image={product.thumbnail_url || ""}
                      minOrder="1 pieza"
                      slug={product.slug}
                      rating={Number(product.average_rating || 0)}
                      supplier={supplier}
                    />
                  ))}
                </div>

                {hasMore && (
                  <div ref={observerTarget} className="flex justify-center py-8">
                    {productsLoading && (
                      <div className="flex items-center gap-3 text-gray-500">
                        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">Cargando más productos...</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <section id="certificados" className="scroll-mt-32">
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Certificados</h2>
                <p className="text-gray-500 text-sm md:text-base">
                  Documentación y certificaciones de {supplier.name}.
                </p>
              </div>
            </div>

            {supplier.certificates && supplier.certificates.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {supplier.certificates.map((cert: Certificate) => {
                  const isPdf = (cert.image || cert.path || cert.url || "").toLowerCase().endsWith('.pdf');
                  return (
                    <div 
                      key={cert.id} 
                      className="group cursor-pointer"
                      onClick={() => setSelectedCertificate(cert)}
                    >
                      <div className="aspect-[3/4] rounded-xl overflow-hidden border border-gray-200 bg-gray-50 relative mb-3 transition-all group-hover:shadow-md group-hover:border-primary/30">
                        {isPdf ? (
                           <div className="w-full h-full flex flex-col items-center justify-center p-4">
                             <FileText className="w-12 h-12 text-red-500 mb-2" />
                             <span className="text-xs text-center font-medium text-gray-500">Documento PDF</span>
                           </div>
                        ) : (
                          <img 
                            src={getImageUrl(cert.thumbnail || cert.image || cert.path || cert.url || "")} 
                            alt={cert.name || cert.description}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        )}
                        
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-sm">
                             <ExternalLink size={20} className="text-primary" />
                          </div>
                        </div>
                      </div>
                      <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 group-hover:text-primary transition-colors">
                        {cert.name || cert.description}
                      </h3>
                      {cert.certificate_date && (
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(cert.certificate_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-900 font-medium">No hay certificados disponibles.</p>
                <p className="text-sm text-gray-500">Este proveedor aún no ha subido certificaciones.</p>
              </div>
            )}
          </div>
        </section>

        {mapLocation && (
          <section id="ubicacion" className="scroll-mt-32 relative z-10">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Ubicación</h2>
                  <p className="text-gray-500 text-sm md:text-base">
                    Localización de {supplier.name}.
                  </p>
                </div>
              </div>
              <MapPicker location={mapLocation} readOnly height="400px" zoom={17} />
              <div className="mt-4 text-sm text-gray-500 flex items-center gap-2">
                <MapPin size={16} />
                <span>
                  {[supplier.address, supplier.exterior_number, supplier.interior_number, supplier.neighborhood, supplier.city, supplier.state, supplier.country]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
            </div>
          </section>
        )}

        <section id="calificaciones" className="scroll-mt-32">
          <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Calificaciones</h2>
                <p className="text-gray-500 text-sm md:text-base">
                  Opiniones de compradores sobre {supplier.name}.
                </p>
              </div>
              <div className="flex flex-col items-center bg-gray-50 p-4 rounded-xl border border-gray-100 min-w-[180px]">
                <div className="flex items-center gap-2">
                  <StarRating rating={Number(supplier.average_rating || 0)} size={18} />
                  <span className="text-xs text-gray-500 font-medium">/5</span>
                </div>
                <div className="mt-1 text-lg font-bold text-gray-900">
                  {supplier.average_rating ? supplier.average_rating.toFixed(1) : "0.0"}
                </div>
                <div className="text-sm font-semibold text-gray-800">
                  {supplier.average_rating ? getRatingLabel(supplier.average_rating) : "Sin calificaciones"}
                </div>
                <div className="text-primary text-xs mt-1">
                  {supplier.rating_count || 0} calificaciones
                </div>
              </div>
            </div>

            {ratingsLoading && ratings.length === 0 ? (
              <div className="flex justify-center py-10">
                <div className="flex items-center gap-3 text-gray-500">
                  <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Cargando calificaciones...</span>
                </div>
              </div>
            ) : ratingsError ? (
              <div className="py-8 text-center text-sm text-red-500">
                {ratingsError}
              </div>
            ) : ratings.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-900 font-medium">Aún no hay calificaciones para este proveedor.</p>
                <p className="text-sm text-gray-500">Cuando los compradores dejen su opinión, aparecerá aquí.</p>
              </div>
            ) : (
              <>
                <div className="space-y-8">
                  {ratings.map((rating) => (
                    <div key={rating.id} className="border-b border-gray-100 pb-8 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 uppercase">
                            {rating.user_name ? rating.user_name[0] : "U"}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 text-sm">
                                {rating.user_name || "Usuario"}
                              </span>
                             
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <StarRating rating={rating.rating} size={14} />
                              <span className="text-xs text-gray-400 font-medium">
                                {rating.rating.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </div>
                        {rating.created_at && (
                          <span className="text-xs text-gray-400 font-medium">
                            {new Date(rating.created_at).toLocaleDateString("es-MX", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-600 text-sm leading-relaxed pl-[52px] mb-4">{rating.comment}</p>
                      <div className="pl-[52px]">
                        <Link
                          href={`/product/${rating.product_slug}`}
                          className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 transition-colors"
                        >
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                            {rating.product_thumbnail_url || rating.product_image ? (
                              <img
                                src={rating.product_thumbnail_url || rating.product_image || ""}
                                alt={rating.product_title}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300 text-xl">
                                <Store size={24} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 line-clamp-2">
                              {rating.product_title}
                            </p>
                          </div>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                {ratingsHasMore && (
                  <div className="flex justify-center mt-8">
                    <button
                      type="button"
                      disabled={ratingsLoadingMore}
                      onClick={() => {
                        if (slug) {
                          fetchRatings(slug as string, ratingsSkip + ratingsLimit, true);
                        }
                      }}
                      className="px-6 py-2 rounded-full border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {ratingsLoadingMore ? "Cargando más..." : "Ver más calificaciones"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <section id="nosotros" className="scroll-mt-32 relative z-[1]">
          <div className="bg-white p-4 md:p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Sobre Nosotros</h2>

            {(() => {
              const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
              const buildUrl = (url: string | null | undefined) => {
                if (!url) return null;
                if (url.startsWith("http://") || url.startsWith("https://")) return url;
                if (apiBase && url.startsWith("/")) {
                  const base = apiBase.replace(/\/+$/, '');
                  return `${base}${url}`.replace(/([^:])\/{2,}/g, '$1/');
                }
                return url;
              };
              const raw =
                (supplier as any).about_media_url ||
                (supplier as any).about_media ||
                (supplier as any).about_image_url ||
                (supplier as any).about_image;
              const thumbRaw =
                (supplier as any).about_media_thumbnail || null;
              const mediaSrc = buildUrl(raw);
              const posterSrc = buildUrl(thumbRaw);
              if (!mediaSrc) return null;
              const lower = mediaSrc.toLowerCase();
              const isVideo = /\.(mp4|webm|ogg|mov)(\?|#|$)/.test(lower);
              return (
                <div className="w-full mb-6 rounded-xl overflow-hidden shadow-md">
                  {isVideo ? (
                    <div className="relative w-full md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto">
                      <div className="relative w-full pb-[56.25%]">
                        <div className="absolute inset-0">
                          <InlineVideo src={mediaSrc} poster={posterSrc || undefined} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaSrc}
                      alt="Acerca de nosotros"
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              );
            })()}

            <div className="prose prose-lg max-w-none w-full text-gray-600">
              {supplier.about ? (
                <div
                  className="whitespace-normal max-w-full about-html"
                  style={{ 
                    textAlign: "left", 
                    wordBreak: "normal", 
                    overflowWrap: "normal",
                    hyphens: "none",
                    WebkitHyphens: "none"
                  }}
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(supplier.about),
                  }}
                />
              ) : (
                <p className="italic text-gray-400">Información detallada no disponible.</p>
              )}
            </div>

            
          </div>
        </section>

        <section id="contacto" className="scroll-mt-32">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-6 text-gray-900">Información de Contacto</h2>
                <div className="space-y-6">
                  {supplier.address && (
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <MapPin className="text-primary" size={20} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Dirección</p>
                        <p className="text-gray-600 mt-1">
                          {supplier.address} {supplier.exterior_number} {supplier.interior_number}
                        </p>
                        <p className="text-gray-600">{supplier.neighborhood}</p>
                        <p className="text-gray-600">
                          {supplier.city}, {supplier.state}, {supplier.country}
                        </p>
                      </div>
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Phone className="text-primary" size={20} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Teléfono</p>
                        <p className="text-gray-600 mt-1">{supplier.phone}</p>
                      </div>
                    </div>
                  )}
                  {supplier.email && (
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Mail className="text-primary" size={20} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Correo Electrónico</p>
                        <p className="text-gray-600 mt-1">{supplier.email}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-primary text-white p-8 rounded-2xl shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                  <h2 className="text-xl font-bold mb-4">¿Tienes preguntas?</h2>
                  <p className="mb-6 opacity-90">
                    Contáctanos directamente para obtener más información sobre nuestros productos y servicios.
                  </p>

                  {supplier.phone ? (
                    <a 
                      href={`https://wa.me/${supplier.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center py-3 bg-white text-primary font-bold rounded-xl hover:bg-gray-100 transition-colors shadow-sm"
                    >
                      Enviar Mensaje
                    </a>
                  ) : (
                    <button disabled className="w-full py-3 bg-white/70 text-primary/50 font-bold rounded-xl cursor-not-allowed shadow-sm">
                      Enviar Mensaje
                    </button>
                  )}
                </div>

                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {selectedCertificate && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedCertificate(null)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-lg text-gray-900">
                {selectedCertificate.name || "Detalle del Certificado"}
              </h3>
              <button 
                onClick={() => setSelectedCertificate(null)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-gray-100 rounded-xl overflow-hidden border border-gray-200 flex items-center justify-center min-h-[300px]">
                   {(selectedCertificate.image || selectedCertificate.path || selectedCertificate.url || "").toLowerCase().endsWith('.pdf') ? (
                      <div className="text-center p-8">
                         <FileText className="w-24 h-24 text-red-500 mx-auto mb-4" />
                         <p className="text-gray-900 font-medium mb-4">Este certificado es un documento PDF</p>
                         <a 
                           href={getImageUrl(selectedCertificate.image || selectedCertificate.path || selectedCertificate.url || "")}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-colors"
                         >
                           <ExternalLink size={18} />
                           Abrir Documento
                         </a>
                      </div>
                   ) : (
                     <img 
                       src={getImageUrl(selectedCertificate.image || selectedCertificate.path || selectedCertificate.url || "")} 
                       alt={selectedCertificate.name || selectedCertificate.description}
                       className="w-full h-full object-contain"
                     />
                   )}
                </div>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Descripción</h4>
                    <p className="text-gray-700 leading-relaxed">
                      {selectedCertificate.description}
                    </p>
                  </div>
                  
                  {selectedCertificate.place && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Lugar de Expedición</h4>
                      <div className="flex items-center gap-2 text-gray-700">
                        <MapPin size={18} className="text-gray-400" />
                        <span>{selectedCertificate.place}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    {selectedCertificate.certificate_date && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Fecha de Emisión</h4>
                        <div className="flex items-center gap-2 text-gray-700">
                          <Calendar size={18} className="text-gray-400" />
                          <span>{new Date(selectedCertificate.certificate_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )}
                    
                    {selectedCertificate.expiration_date && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Fecha de Vencimiento</h4>
                        <div className="flex items-center gap-2 text-gray-700">
                          <Calendar size={18} className="text-gray-400" />
                          <span>{new Date(selectedCertificate.expiration_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {selectedCertificate.link && (
                    <div>
                       <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Enlace de Verificación</h4>
                       <a 
                         href={selectedCertificate.link} 
                         target="_blank" 
                         rel="noopener noreferrer"
                         className="text-primary hover:underline break-all flex items-start gap-2"
                       >
                         <ExternalLink size={16} className="mt-1 shrink-0" />
                         {selectedCertificate.link}
                       </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Carousel({ images }: { images: CarouselImage[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [images.length]);

  if (images.length === 0) return null;

  const getImageUrl = (path: string | null) => {
    if (!path) return '/placeholder.png';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    
    const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://drooopy.com/api').replace(/\/+$/, '');
    let cleanPath = path.startsWith('/') ? path : `/${path}`;
    
    // Ensure path doesn't start with /static/ if we're adding it manually, 
    // or if the logic implies it needs to be there. 
    // The original logic removed leading slash and added static/ if missing.
    // Let's preserve that intent but cleaner.
    
    let pathSegment = path.startsWith('/') ? path.substring(1) : path;
    if (!pathSegment.startsWith('static/') && !pathSegment.startsWith('http')) {
        pathSegment = `static/${pathSegment}`;
    }
    
    return `${baseUrl}/${pathSegment}`.replace(/([^:])\/{2,}/g, '$1/');
  };

  const nextSlide = () => setCurrent((c) => (c + 1) % images.length);
  const prevSlide = () => setCurrent((c) => (c - 1 + images.length) % images.length);

  return (
    <div className="relative w-full h-full">
      {images.map((item, idx) => (
        <div
          key={idx}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            idx === current ? "opacity-100 z-10" : "opacity-0 z-0"
          }`}
        >
          <img 
            src={getImageUrl(item.image || item.thumbnail)} 
            alt={item.title || `Slide ${idx}`} 
            className="w-full h-full object-cover" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
          
          <div className="absolute bottom-8 left-8 right-8 text-white z-20">
             {item.title && item.title.trim() !== '' && item.title.trim().toLowerCase() !== 'string' && (
                <h3 className="text-2xl font-bold mb-2 drop-shadow-md">{item.title}</h3>
             )}
             {item.description && item.description.trim() !== '' && item.description.trim().toLowerCase() !== 'string' && (
                <p className="text-white/90 line-clamp-2 drop-shadow-md max-w-3xl">{item.description}</p>
             )}
          </div>
        </div>
      ))}

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/30 hover:bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-black/30 hover:bg-black/50 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100"
          >
            <ChevronRight size={24} />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {images.map((_, idx) => (
              <button
                key={idx}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  idx === current ? "bg-white w-6" : "bg-white/50 hover:bg-white/80"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrent(idx);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
