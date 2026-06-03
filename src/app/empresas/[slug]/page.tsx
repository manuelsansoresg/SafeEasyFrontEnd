"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Supplier, CarouselImage, Certificate } from "@/lib/products";
import { MapPin, Phone, Mail, CheckCircle, ChevronLeft, ChevronRight, Store, Star, Check, MessageCircle, FileText, Award, X, Calendar, ExternalLink, Play, Clock, ArrowDown, Volume2, VolumeX, Search } from "lucide-react";
import StarRating from "@/components/StarRating";
import { ProductCard } from "@/components/ProductCard";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import { parseMapLocation } from "@/lib/googleMaps";
import DOMPurify from "isomorphic-dompurify";

const SupplierLocationMap = dynamic(() => import("@/components/supplier/SupplierLocationMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#eef2ef]" />,
});

const pickSupplierImage = (source: Supplier | null, keys: string[]) => {
  if (!source || typeof source !== "object") return null;
  const record = source as unknown as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

const pickSupplierMapLocation = (source: Supplier | null) => {
  if (!source || typeof source !== "object") return null;
  const record = source as unknown as Record<string, unknown>;
  const address = record.address && typeof record.address === "object" ? (record.address as Record<string, unknown>) : null;

  return (
    parseMapLocation(record.map_location) ||
    parseMapLocation(record.location) ||
    parseMapLocation(record.supplier_map_location) ||
    parseMapLocation(record.supplierLocation) ||
    parseMapLocation(record.coordinates) ||
    parseMapLocation(address?.map_location) ||
    parseMapLocation(address?.location) ||
    parseMapLocation({
      lat: record.lat ?? record.latitude ?? record.map_lat ?? record.mapLatitude,
      lng: record.lng ?? record.longitude ?? record.map_lng ?? record.mapLongitude,
    })
  );
};

// --- THEME CONSTANTS (From user request) ---
const THEME = {
  primaryDark: "#004e28", // Barra principal, Titulos
  primary: "#168e00",     // Subtitulos, Botones
  bgAlt: "#f2f3f4",       // Fondos contraste
  textMain: "#000000",
  textInv: "#ffffff"
};

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
        setPlaying(false);
      }
    }, 0);
  };

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl">
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
          className="relative w-full h-full group"
          aria-label="Reproducir video"
        >
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={poster} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
          ) : (
            <div className="w-full h-full bg-gray-900" />
          )}
          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
            <span className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#168e00] text-white shadow-lg transform group-hover:scale-110 transition-transform duration-300">
              <Play size={32} className="ml-1" />
            </span>
          </div>
        </button>
      )}

      {error && (
        <div className="w-full h-full bg-gray-900 text-white flex flex-col items-center justify-center gap-2">
          <div className="text-sm opacity-80">No se pudo reproducir el video.</div>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2 bg-white text-[#004e28] rounded-full text-sm font-bold hover:bg-gray-100 transition-colors"
          >
            Ver archivo
          </a>
        </div>
      )}
    </div>
  );
}

function Carousel({ images }: { images: CarouselImage[] }) {
    const [currentIndex, setCurrentIndex] = useState(0);
  
    useEffect(() => {
      if (images.length <= 1) return;
      const interval = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
      }, 5000);
      return () => clearInterval(interval);
    }, [images.length]);
  
    const getImageUrl = (path: string) => {
      if (!path) return "/placeholder.png";
      if (path.startsWith('http')) return path;
      const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://drooopy.com/api').replace(/\/+$/, '');
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      return `${baseUrl}${cleanPath}`.replace(/([^:])\/{2,}/g, '$1/');
    };
  
    if (!images || images.length === 0) return null;
  
    return (
      <div className="relative w-full h-full overflow-hidden">
        {images.map((img, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentIndex ? "opacity-100" : "opacity-0"
            }`}
          >
            <img
              src={getImageUrl(img.image)}
              alt={`Slide ${index + 1}`}
              className="w-full h-full object-cover"
            />
            {/* Dark overlay specifically for carousel images to ensure text readability */}
            <div className="absolute inset-0 bg-black/40" />
          </div>
        ))}
        
        {images.length > 1 && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-2 z-30">
                {images.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className={`w-3 h-3 rounded-full transition-all duration-300 ${
                            idx === currentIndex ? "bg-[#168e00] w-8" : "bg-white/50 hover:bg-white"
                        }`}
                        aria-label={`Ir a slide ${idx + 1}`}
                    />
                ))}
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



import { SupplierProductCarousel } from "@/components/supplier/SupplierProductCarousel";

export default function SupplierPage() {
  const { slug } = useParams();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [activeTab, setActiveTab] = useState<'main' | 'products'>('main');
  const [loading, setLoading] = useState(true);
  const headerVideoRef = useRef<HTMLVideoElement>(null);
  const supplierViewSentRef = useRef<Set<string>>(new Set());
  const [isHeaderVideoPlaying, setIsHeaderVideoPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    if (headerVideoRef.current) {
      if (isHeaderVideoPlaying) {
        headerVideoRef.current.play().catch(e => console.log("Auto-play prevented", e));
      } else {
        headerVideoRef.current.pause();
      }
    }
  }, [isHeaderVideoPlaying]);

  // Header Video Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsHeaderVideoPlaying(entry.isIntersecting);
        });
      },
      { threshold: 0.5 }
    );

    if (headerVideoRef.current) {
      observer.observe(headerVideoRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 50;
  const [hasMore, setHasMore] = useState(false);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string | null>(null);
  const [selectedSubcategorySlug, setSelectedSubcategorySlug] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [ratings, setRatings] = useState<SupplierRating[]>([]);

  const mapLocation = pickSupplierMapLocation(supplier);
  const supplierLogo = pickSupplierImage(supplier, ["logo", "logo_url", "image", "image_url", "logo_path"]);
  
  const [ratingsTotal, setRatingsTotal] = useState(0);
  const [ratingsSkip, setRatingsSkip] = useState(0);
  const ratingsLimit = 50;
  const [ratingsLoading, setRatingsLoading] = useState(false);
  const [ratingsLoadingMore, setRatingsLoadingMore] = useState(false);
  const [ratingsError, setRatingsError] = useState<string | null>(null);
  const [ratingsHasMore, setRatingsHasMore] = useState(false);
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
      setLoading(true);
      setSupplier(null);
      fetchSupplier(slug as string);
      setPage(1);
      setSelectedCategorySlug(null);
      setSelectedSubcategorySlug(null);
    }
  }, [slug]);

  useEffect(() => {
    if (supplier?.id) {
      // Robust Identifier Logic: Prefer URL slug -> Supplier Slug -> Supplier ID
      const identifier = (slug as string) || supplier.slug || String(supplier.id);
      
      console.log("Fetching products for identifier:", identifier);
      fetchProducts(identifier, 1, false);
      fetchRatings(identifier, 0, false);
    }
  }, [supplier?.id, supplier?.slug, slug, token]);

  useEffect(() => {
    const id = supplier?.id;
    if (!id) return;
    const key = String(id);
    if (supplierViewSentRef.current.has(key)) return;
    supplierViewSentRef.current.add(key);

    const encodedId = encodeURIComponent(key);
    const tryUrls = [
      `/proxy/suppliers/${encodedId}/views`,
      `/proxy/suppliers/${encodedId}/views/`,
      `/proxy/v1/suppliers/${encodedId}/views`,
      `/proxy/v1/suppliers/${encodedId}/views/`,
    ];

    (async () => {
      for (const url of tryUrls) {
        try {
          const res = await fetch(url, { method: "POST" });
          if (res.ok) break;
          if (res.status === 404 || res.status === 405) continue;
          break;
        } catch {
          break;
        }
      }
    })();
  }, [supplier?.id]);

  const fetchSupplier = async (slug: string) => {
    try {
      const encoded = encodeURIComponent(slug);

      const isSupplierValue = (v: unknown): v is Supplier => {
        if (!v || typeof v !== "object") return false;
        const o = v as Record<string, unknown>;
        return typeof o.id === "number" && typeof o.name === "string";
      };

      const getSlugValue = (v: unknown) => {
        if (!v || typeof v !== "object") return null;
        const o = v as Record<string, unknown>;
        return typeof o.slug === "string" ? o.slug : null;
      };

      const tryFetchJson = async (url: string) => {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return null;
        return res.json();
      };

      let data: unknown = null;

      const primary = await tryFetchJson(`/proxy/suppliers/${encoded}/`);
      if (primary) {
        data = primary;
      } else {
        const secondary = await tryFetchJson(`/proxy/suppliers/${encoded}`);
        if (secondary) data = secondary;
      }

      if (!data && isNaN(Number(slug))) {
        const listResult = await tryFetchJson(`/proxy/suppliers/?slug=${encoded}`);
        if (listResult) data = listResult;
      }

      let resolved: Supplier | null = null;

      if (Array.isArray(data)) {
        const exact = data.find((s) => {
          const sSlug = getSlugValue(s);
          return sSlug ? sSlug.toLowerCase() === String(slug).toLowerCase() : false;
        });
        const candidate = exact ?? data[0] ?? null;
        resolved = isSupplierValue(candidate) ? candidate : null;
      } else if (isSupplierValue(data)) {
        resolved = data;
      } else if (data && typeof data === "object") {
        const obj = data as Record<string, unknown>;
        const items = obj.items || obj.results || obj.data;
        if (Array.isArray(items)) {
          const exact = items.find((s) => {
            const sSlug = getSlugValue(s);
            return sSlug ? sSlug.toLowerCase() === String(slug).toLowerCase() : false;
          });
          const candidate = exact ?? items[0] ?? null;
          resolved = isSupplierValue(candidate) ? candidate : null;
        }
      }

      setSupplier(resolved);
    } catch (error) {
      console.error("Error fetching supplier", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async (supplierSlug: string, currentPage: number, append: boolean = false) => {
    try {
      if (!append) setProductsLoading(true);
      setProductsError(null);

      const skip = (currentPage - 1) * limit;
      const params = new URLSearchParams();
      params.set("skip", String(skip));
      params.set("limit", String(limit));

      const res = await fetch(`/proxy/products/by-supplier/${supplierSlug}?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        // Fallback: Try with ID if slug failed, or vice versa (basic retry logic could go here)
        console.error("Error fetching supplier products by slug, trying ID", res.status);
        if (supplier?.id) {
             const resId = await fetch(`/proxy/products/by-supplier/${supplier.id}?${params.toString()}`, {
                cache: "no-store",
              });
             if (resId.ok) {
                 const dataId = await resId.json();
                 const itemsId = Array.isArray(dataId) ? dataId : (dataId.items || dataId.results || []);
                 const newProductsId = itemsId as SupplierProduct[];
                 syncFavorites(newProductsId);
                 setProducts(prev => append ? [...prev, ...newProductsId] : newProductsId);
                 setHasMore(Array.isArray(itemsId) && itemsId.length === limit);
                 setProductsLoading(false);
                 return;
             }
        }
        
        if (!append) setProducts([]);
        setHasMore(false);
        setProductsError("No se pudieron cargar los productos.");
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
      setProductsError("Error de conexión.");
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

      const res = await fetch(`/proxy/suppliers/${supplierSlug}/ratings?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        setRatings([]);
        return;
      }

      const data = (await res.json()) as SupplierRatingsResponse | { ratings?: SupplierRating[]; total?: number; skip?: number; limit?: number };
      const ratingsList = Array.isArray((data as SupplierRatingsResponse).ratings)
        ? (data as SupplierRatingsResponse).ratings
        : Array.isArray((data as any).ratings)
        ? (data as any).ratings
        : [];

      const total = typeof (data as SupplierRatingsResponse).total === "number" ? (data as SupplierRatingsResponse).total : ratingsList.length;

      setRatings((prev) => {
        const next = append ? [...prev, ...ratingsList] : ratingsList;
        return next;
      });

      setRatingsTotal(total);
    } catch (error) {
      console.error("Error fetching ratings", error);
    } finally {
      setRatingsLoading(false);
      setRatingsLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!slug) return;
    if (page === 1) return;
    // @ts-ignore
    const identifier = (slug as string) || supplier?.slug || String(supplier?.id);
    fetchProducts(identifier, page, true);
  }, [page, slug]);

  const getImageUrl = (path: string | null) => {
    if (!path) return "/placeholder.png";
    if (path.startsWith('http')) return path;
    const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://drooopy.com/api').replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`.replace(/([^:])\/{2,}/g, '$1/');
  };

  const sanitizeHtml = (html: string) => {
    if (!html) return "";
    return DOMPurify.sanitize(html);
  };

  // --- BUSINESS HOURS HELPERS ---
  const DAYS_MAP: Record<number, string> = {
    1: "Lunes",
    2: "Martes",
    3: "Miércoles",
    4: "Jueves",
    5: "Viernes",
    6: "Sábado",
    0: "Domingo",
  };

  const formatTime = (time: string | null) => {
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours, 10);
    const m = parseInt(minutes, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsMuted(prev => !prev);
  };

  const getBusinessStatus = () => {
      if (!supplier?.business_hours || supplier.business_hours.length === 0) return { isOpen: false, status: "Sin Horario" };
      
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimeVal = currentHours * 60 + currentMinutes;

      const todaySchedule = supplier.business_hours.find(h => h.day_of_week === currentDay);

      if (!todaySchedule || todaySchedule.is_closed) return { isOpen: false, status: "Cerrado Ahora" };
      if (!todaySchedule.open_time || !todaySchedule.close_time) return { isOpen: false, status: "Cerrado" };

      const [openH, openM] = todaySchedule.open_time.split(":").map(Number);
      const [closeH, closeM] = todaySchedule.close_time.split(":").map(Number);
      
      const openTimeVal = openH * 60 + openM;
      const closeTimeVal = closeH * 60 + closeM;

      if (currentTimeVal >= openTimeVal && currentTimeVal <= closeTimeVal) {
          return { isOpen: true, status: "Abierto Ahora" };
      }
      
      return { isOpen: false, status: "Cerrado Ahora" };
  };

  const groupBusinessHours = () => {
      if (!supplier?.business_hours || supplier.business_hours.length === 0) return [];
      
      // Sort: Monday (1) to Sunday (0)
      const sorted = [...supplier.business_hours].sort((a, b) => {
          const aOrder = a.day_of_week === 0 ? 7 : a.day_of_week;
          const bOrder = b.day_of_week === 0 ? 7 : b.day_of_week;
          return aOrder - bOrder;
      });

      const groups: { start: number; end: number; open: string; close: string; isClosed: boolean }[] = [];
      
      if (sorted.length === 0) return [];

      let current = {
          start: sorted[0].day_of_week,
          end: sorted[0].day_of_week,
          open: sorted[0].open_time || "",
          close: sorted[0].close_time || "",
          isClosed: sorted[0].is_closed
      };

      for (let i = 1; i < sorted.length; i++) {
          const h = sorted[i];
          const prevDayOrder = current.end === 0 ? 7 : current.end;
          const currDayOrder = h.day_of_week === 0 ? 7 : h.day_of_week;
          
          const isConsecutive = currDayOrder === prevDayOrder + 1;
          const isSameTime = (h.open_time || "") === current.open && (h.close_time || "") === current.close && h.is_closed === current.isClosed;

          if (isConsecutive && isSameTime) {
              current.end = h.day_of_week;
          } else {
              groups.push(current);
              current = {
                  start: h.day_of_week,
                  end: h.day_of_week,
                  open: h.open_time || "",
                  close: h.close_time || "",
                  isClosed: h.is_closed
              };
          }
      }
      groups.push(current);
      return groups;
  };

  const businessStatus = getBusinessStatus();
  const groupedHours = groupBusinessHours();

  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategorySlug ? product.category?.slug === selectedCategorySlug : true;
    const matchesSubcategory = selectedSubcategorySlug ? product.subcategory?.slug === selectedSubcategorySlug : true;
    const matchesSearch = searchQuery 
      ? product.title.toLowerCase().includes(searchQuery.toLowerCase()) 
      : true;
    return matchesCategory && matchesSubcategory && matchesSearch;
  });

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f2f3f4]">
        <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#004e28]"></div>
            <p className="text-[#004e28] font-bold animate-pulse font-[family-name:var(--font-varela-round)]">Cargando Experiencia...</p>
        </div>
      </div>
    );

  if (!supplier) return null;

  return (
    <div className="min-h-screen bg-[#ffffff] font-sans selection:bg-[#168e00] selection:text-white">
      
      {/* --- HERO SECTION --- */}
      <section className="relative w-full h-[90vh] bg-black overflow-hidden group">
         {/* Media Background */}
         {supplier.header_media_type === 'video' && supplier.header_video ? (
             <video 
               ref={headerVideoRef}
               src={getImageUrl(supplier.header_video)} 
               autoPlay 
               muted={isMuted} 
               loop 
               playsInline
               className="absolute inset-0 w-full h-full object-cover opacity-90 scale-105 group-hover:scale-100 transition-transform duration-[30s] ease-linear"
             />
         ) : (
             <div className="absolute inset-0 w-full h-full">
                <Carousel images={(supplier.carousel_images || []).slice(0, 3)} />
             </div>
         )}

         {/* Gradient Overlay - Theme Based */}
         <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#004e28]/90 z-10" />
         <div className="absolute inset-0 bg-gradient-to-r from-[#004e28]/80 to-transparent z-10" />

         {/* Content */}
         <div className="absolute inset-0 z-20 flex flex-col justify-center px-6 md:px-20 lg:px-32 items-center md:items-start text-center md:text-left pb-28 md:pb-0">
             <div className="animate-in fade-in slide-in-from-left-10 duration-1000 w-full max-w-4xl">
                {supplierLogo && (
                    <div className="mb-8 w-24 h-24 md:w-32 md:h-32 bg-white/10 backdrop-blur-md rounded-3xl p-4 border border-white/20 shadow-2xl mx-auto md:mx-0">
                        <img src={getImageUrl(supplierLogo)} alt={supplier.name} className="w-full h-full object-contain drop-shadow-md" />
                    </div>
                )}
                
                <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-9xl font-black text-white mb-6 tracking-tighter drop-shadow-2xl font-[family-name:var(--font-varela-round)] uppercase leading-[0.9]">
                   {supplier.name}
                </h1>
                
                <p className="text-base sm:text-xl md:text-2xl text-gray-100 max-w-2xl font-light leading-relaxed drop-shadow-lg font-[family-name:var(--font-poppins)] border-l-0 md:border-l-4 border-[#168e00] pl-0 md:pl-6 mb-10 mx-auto md:mx-0">
                   {supplier.short_description || "Innovación y calidad en cada producto. Tu socio estratégico de confianza."}
                </p>

                <div className="flex flex-col sm:flex-row flex-wrap gap-4 items-stretch sm:items-center justify-center md:justify-start w-full mb-8">
                    <a href="#productos" className="w-full sm:w-auto px-8 py-4 bg-[#168e00] hover:bg-[#137a00] text-white rounded-full font-bold text-lg transition-all shadow-[0_0_30px_-5px_rgba(22,142,0,0.6)] hover:shadow-[0_0_40px_-5px_rgba(22,142,0,0.8)] hover:-translate-y-1 inline-flex items-center justify-center gap-2 font-[family-name:var(--font-varela-round)]">
                        Ver Catálogo <ArrowDown size={20} />
                    </a>
                    <a href="#contacto" className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border border-white/30 rounded-full font-bold text-lg transition-all hover:-translate-y-1 inline-flex items-center justify-center font-[family-name:var(--font-varela-round)]">
                        Contactar Ahora
                    </a>
                </div>
             </div>
         </div>

         {/* Floating Stats Bar */}
         <div className="absolute bottom-0 left-0 w-full z-30 border-t border-white/10 bg-black/20 backdrop-blur-xl">
             <div className="container mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-8 items-center">
                 <div className="text-center md:text-left">
                     <div className="text-[#168e00] text-3xl font-black font-[family-name:var(--font-varela-round)]">{supplier.average_rating ? supplier.average_rating.toFixed(1) : "5.0"}</div>
                     <div className="text-white/60 text-xs uppercase tracking-widest font-bold">Calificación</div>
                 </div>
                 <div className="text-center md:text-left">
                     <div className="text-white text-3xl font-black font-[family-name:var(--font-varela-round)]">{supplier.sales_count ? `+${supplier.sales_count}` : "+500"}</div>
                     <div className="text-white/60 text-xs uppercase tracking-widest font-bold">Ventas Exitosas</div>
                 </div>
                 <div className="text-center md:text-left">
                     <div className="text-white text-2xl md:text-3xl font-black font-[family-name:var(--font-varela-round)] flex flex-col items-center md:items-start justify-center md:justify-start leading-none gap-1">
                        <span>Atención</span>
                        <span className="text-[#168e00]">Personalizada</span>
                     </div>
                 </div>
                {supplier.is_verified ? (
                  <div className="hidden md:flex items-center justify-end">
                    <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                      <div className="w-8 h-8 rounded-full bg-[#168e00] flex items-center justify-center text-white">
                        <Check size={18} strokeWidth={4} />
                      </div>
                      <span className="text-white font-bold text-sm uppercase tracking-wider">Empresa Verificada</span>
                    </div>
                  </div>
                ) : null}
             </div>
         </div>

         {/* Audio Toggle */}
         {supplier.header_media_type === 'video' && supplier.header_video && (
             <button 
                onClick={toggleMute}
                className="absolute bottom-24 right-6 z-40 p-3 bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-full text-white transition-all hover:scale-110 border border-white/20"
                aria-label={isMuted ? "Activar sonido" : "Silenciar"}
             >
                 {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
             </button>
         )}
      </section>

      {/* --- TABS NAVIGATION --- */}
      <div className="sticky top-[0px] md:top-[0px] z-40 bg-white border-b border-gray-100 shadow-sm backdrop-blur-md bg-white/90">
        <div className="container mx-auto px-4 md:px-8">
           <div className="flex gap-8 overflow-x-auto no-scrollbar">
              <button 
                onClick={() => setActiveTab('main')} 
                className={`py-4 px-2 border-b-2 font-bold transition-colors whitespace-nowrap ${activeTab === 'main' ? 'border-[#168e00] text-[#004e28]' : 'border-transparent text-gray-500 hover:text-[#004e28]'}`}
              >
                Página Principal
              </button>
              <button 
                onClick={() => setActiveTab('products')} 
                className={`py-4 px-2 border-b-2 font-bold transition-colors whitespace-nowrap ${activeTab === 'products' ? 'border-[#168e00] text-[#004e28]' : 'border-transparent text-gray-500 hover:text-[#004e28]'}`}
              >
                Productos
              </button>
           </div>
        </div>
      </div>

      {/* --- PRODUCTS SECTION (Tab Content) --- */}
      {activeTab === 'products' && (
      <section id="productos" className="relative py-24 bg-[#f2f3f4] overflow-hidden">
        {/* Decorative Background Blob */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#004e28]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="container mx-auto px-4 md:px-8 relative z-10">
            <div className="flex flex-col md:flex-row items-center justify-between mb-16 gap-6">
                <div>
                    <h2 className="text-4xl md:text-5xl font-black text-[#004e28] mb-4 font-[family-name:var(--font-varela-round)]">
                        Productos
                    </h2>
                    <p className="text-gray-500 max-w-xl text-lg">
                        Explora nuestra selección premium de productos diseñados para transformar tu negocio. Calidad garantizada en cada pedido.
                    </p>
                </div>
                
                <div className="w-full md:w-auto">
                    <div className="relative w-full md:w-96 group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-[#168e00] transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar en este proveedor..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-11 pr-4 py-4 bg-white border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#168e00]/20 focus:border-[#168e00] transition-all shadow-sm hover:shadow-md"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            >
                                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {productsLoading && products.length === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {[1,2,3,4].map(i => (
                        <div key={i} className="aspect-[4/5] bg-gray-200 rounded-[2rem] animate-pulse" />
                    ))}
                </div>
            ) : productsError ? (
                <div className="text-center py-20 bg-white rounded-[3rem] shadow-sm">
                    <p className="text-xl text-red-500 font-bold mb-4">{productsError}</p>
                    <button 
                        onClick={() => fetchProducts((slug as string) || supplier.slug || String(supplier.id), 1, false)}
                        className="px-6 py-3 bg-[#004e28] text-white rounded-full hover:bg-[#168e00] transition-colors"
                    >
                        Reintentar Carga
                    </button>
                </div>
            ) : products.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-[3rem] shadow-sm">
                    <p className="text-xl text-gray-400 font-bold">No hay productos disponibles en este momento.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 md:gap-10">
                    {filteredProducts.map((product) => (
                        <div key={product.id} className="h-full">
                            <ProductCard
                                id={String(product.id)}
                                title={product.title}
                                price={product.price}
                                image={product.thumbnail_url || product.subcategory?.thumbnail_url || ""}
                                minOrder={`${product.stock > 0 ? "1" : "10"} pzas`}
                                slug={product.slug}
                                rating={product.average_rating || 5.0}
                                sales={product.stock} // Using stock as proxy for sales visual
                                supplier={supplier}
                            />
                        </div>
                    ))}
                </div>
            )}
            
            {/* Infinite Scroll Trigger */}
            <div ref={observerTarget} className="h-20 w-full flex items-center justify-center mt-12">
                {productsLoading && <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#004e28]" />}
            </div>
        </div>
      </section>
      )}

      {/* --- MAIN TAB CONTENT --- */}
      {activeTab === 'main' && (
      <>
        {/* Recommended Carousels */}
        <div className="container mx-auto px-4 md:px-8 py-12 space-y-8 bg-gray-50/30">
             <SupplierProductCarousel supplierId={supplier.id} kind="most_searched" title="Más Buscados" />
             <SupplierProductCarousel supplierId={supplier.id} kind="most_purchased" title="Más Comprados" />
             <SupplierProductCarousel supplierId={supplier.id} kind="best_rated" title="Mejor Calificados" />
        </div>

      {/* --- NUESTRA ESENCIA (Storytelling) --- */}
      <section className="py-24 bg-white relative overflow-hidden">
         <div className="container mx-auto px-6 md:px-12">
             <div className="bg-[#f2f3f4] rounded-[3rem] p-8 md:p-16 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5" />
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center relative z-10">
                     <div className="order-2 md:order-1">
                         <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-[0_20px_50px_-20px_rgba(0,0,0,0.3)] transform md:-rotate-2 hover:rotate-0 transition-transform duration-700">
                             {supplier.about_media ? (
                                <img src={getImageUrl(supplier.about_media)} alt="Nosotros" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                                    <Store size={64} className="text-gray-400" />
                                </div>
                            )}
                            {/* Overlay Text */}
                            <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#004e28] to-transparent p-8">
                                <p className="text-white font-bold font-[family-name:var(--font-varela-round)] text-xl">Nuestra Misión</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="order-1 md:order-2">
                        <h2 className="text-3xl md:text-5xl font-black text-[#004e28] mb-8 font-[family-name:var(--font-varela-round)] leading-tight">
                            Más que un proveedor,<br/>
                            <span className="text-[#168e00]">tu aliado estratégico.</span>
                        </h2>
                        <div className="text-gray-600 w-full">
                          <div className="ql-snow w-full">
                            <div
                              className="ql-editor"
                              style={{ padding: 0, color: "inherit", fontSize: "inherit", background: "transparent" }}
                              dangerouslySetInnerHTML={{
                                __html: sanitizeHtml(supplier.about || "Comprometidos con la excelencia y el servicio al cliente."),
                              }}
                            />
                          </div>
                        </div>
                         
                         <div className="mt-10 flex items-center gap-4">
                             <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-[#168e00] shadow-md">
                                 <Award size={32} />
                             </div>
                             <div>
                                 <p className="text-[#004e28] font-bold text-lg">Certificado de Calidad</p>
                                  <p className="text-sm text-gray-500">Verificado por Drooopy</p>
                             </div>
                         </div>
                     </div>
                 </div>
             </div>
         </div>
      </section>

      {/* --- CERTIFICATES SECTION --- */}
      {supplier.certificates && supplier.certificates.length > 0 && (
        <section className="py-20 bg-[#f9fafb]">
            <div className="container mx-auto px-6 md:px-12">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-black text-[#004e28] mb-4 font-[family-name:var(--font-varela-round)]">
                        Calidad Certificada
                    </h2>
                    <p className="text-gray-500 max-w-2xl mx-auto">
                        Nuestros procesos y productos cumplen con los más altos estándares internacionales.
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    {supplier.certificates.map((cert) => (
                        <div key={cert.id} className="group relative bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 text-center border border-gray-100">
                            <div className="h-32 mb-4 flex items-center justify-center p-2 bg-gray-50 rounded-xl">
                                <img 
                                    src={getImageUrl(cert.image || cert.image_url || "/placeholder-cert.png")} 
                                    alt={cert.name || "Certificado"} 
                                    className="max-h-full max-w-full object-contain grayscale group-hover:grayscale-0 transition-all duration-500" 
                                />
                            </div>
                            <h3 className="font-bold text-[#004e28] mb-1 font-[family-name:var(--font-varela-round)] line-clamp-1">{cert.name || "Certificado"}</h3>
                            <p className="text-xs text-gray-500 line-clamp-2">{cert.description}</p>
                            
                            {/* Zoom Effect Overlay */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center backdrop-blur-sm cursor-pointer">
                                <span className="text-white font-bold px-4 py-2 border border-white/30 rounded-full bg-white/10 backdrop-blur-md">
                                    Ver Certificado
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
      )}

      {/* --- RATINGS SECTION --- */}
      <section className="py-24 bg-white border-t border-gray-100">
          <div className="container mx-auto px-6 md:px-12">
              <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-8">
                  <div>
                      <h2 className="text-3xl md:text-4xl font-black text-[#004e28] mb-2 font-[family-name:var(--font-varela-round)]">
                          Opiniones Verificadas
                      </h2>
                      <div className="flex items-center gap-2 text-[#168e00]">
                          <span className="font-bold text-xl">{supplier.average_rating ? supplier.average_rating.toFixed(1) : "5.0"}</span>
                          <StarRating rating={supplier.average_rating || 5} size={20} />
                          <span className="text-gray-400 text-sm">({ratingsTotal} reseñas)</span>
                      </div>
                  </div>
                  
                  <button className="px-6 py-3 bg-white border-2 border-[#004e28] text-[#004e28] font-bold rounded-full hover:bg-[#004e28] hover:text-white transition-all font-[family-name:var(--font-varela-round)]">
                      Escribir una Reseña
                  </button>
              </div>

              {ratingsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {[1,2,3].map(i => (
                          <div key={i} className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
                      ))}
                  </div>
              ) : ratings.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {ratings.map((rating) => (
                          <div key={rating.id} className="bg-[#f9fafb] p-8 rounded-[2rem] relative">
                              <div className="flex items-center gap-4 mb-4">
                                  <div className="w-12 h-12 rounded-full bg-[#004e28] flex items-center justify-center text-white font-bold text-xl">
                                      {rating.user_name ? rating.user_name.charAt(0).toUpperCase() : "U"}
                                  </div>
                                  <div>
                                      <p className="font-bold text-gray-900">{rating.user_name || "Usuario Anónimo"}</p>
                                      <StarRating rating={rating.rating} size={14} />
                                  </div>
                              </div>
                              <p className="text-gray-600 italic mb-6">"{rating.comment}"</p>
                              <div className="flex items-center gap-3 mt-auto pt-4 border-t border-gray-200">
                                  <img 
                                    src={getImageUrl(rating.product_thumbnail_url || rating.product_image || null)} 
                                    alt="" 
                                    className="w-10 h-10 rounded-lg object-cover bg-white"
                                  />
                                  <div className="text-xs text-gray-400">
                                      <p className="line-clamp-1">Sobre: {rating.product_title}</p>
                                      <p>{rating.created_at ? new Date(rating.created_at).toLocaleDateString() : ""}</p>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              ) : (
                  <div className="text-center py-16 bg-[#f9fafb] rounded-[3rem]">
                      <MessageCircle size={48} className="mx-auto text-gray-300 mb-4" />
                      <p className="text-gray-500 text-lg">Aún no hay reseñas para este proveedor.</p>
                      <p className="text-gray-400 text-sm">¡Sé el primero en compartir tu experiencia!</p>
                  </div>
              )}
          </div>
      </section>

      {/* --- CONTACT & MAP (Dark Mode / Expert UI) --- */}
      <section id="contacto" className="relative bg-[#004e28] text-white py-24 overflow-hidden">
          {/* Background Elements */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
          
          <div className="container mx-auto px-4 md:px-8 max-w-6xl relative z-10">
              
              {/* TOP ROW: Info & Hours */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                  {/* Info Card */}
                  <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-8 rounded-[2rem] hover:bg-white/10 transition-colors">
                      <h3 className="text-2xl font-bold mb-6 font-[family-name:var(--font-varela-round)] flex items-center gap-3">
                          <MessageCircle className="text-[#168e00]" /> Contáctanos
                      </h3>
                      <div className="space-y-4">
                          {supplier.phone && (
                              <div className="flex items-center gap-4 group">
                                  <div className="w-10 h-10 rounded-full bg-[#168e00]/20 flex items-center justify-center group-hover:bg-[#168e00] transition-colors">
                                      <Phone size={18} className="text-[#168e00] group-hover:text-white" />
                                  </div>
                                  <span className="font-medium text-lg">{supplier.phone}</span>
                              </div>
                          )}
                          {supplier.email && (
                              <div className="flex items-center gap-4 group">
                                  <div className="w-10 h-10 rounded-full bg-[#168e00]/20 flex items-center justify-center group-hover:bg-[#168e00] transition-colors">
                                      <Mail size={18} className="text-[#168e00] group-hover:text-white" />
                                  </div>
                                  <span className="font-medium text-lg">{supplier.email}</span>
                              </div>
                          )}
                          {supplier.address && (
                              <div className="flex items-center gap-4 group">
                                  <div className="w-10 h-10 rounded-full bg-[#168e00]/20 flex items-center justify-center group-hover:bg-[#168e00] transition-colors">
                                      <MapPin size={18} className="text-[#168e00] group-hover:text-white" />
                                  </div>
                                  <span className="font-medium text-lg">{supplier.address}</span>
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Hours Card */}
                  <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-8 rounded-[2rem]">
                      <h3 className="text-2xl font-bold mb-6 font-[family-name:var(--font-varela-round)] flex items-center gap-3">
                          <Clock style={{ color: supplier.primary_color || '#168e00' }} /> Horarios de Atención
                      </h3>
                      <div className="space-y-4 text-gray-300">
                          {groupedHours.length > 0 ? (
                              groupedHours.map((group, idx) => (
                                  <div key={idx} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0">
                                      <span>
                                          {group.start === group.end 
                                              ? DAYS_MAP[group.start] 
                                              : `${DAYS_MAP[group.start]} - ${DAYS_MAP[group.end]}`}
                                      </span>
                                      <span className="font-bold text-white">
                                          {group.isClosed ? "Cerrado" : `${formatTime(group.open)} - ${formatTime(group.close)}`}
                                      </span>
                                  </div>
                              ))
                          ) : (
                              <div className="text-center text-white/60 italic">Horarios no disponibles</div>
                          )}

                          <div className="mt-4 flex items-center gap-3">
                              {businessStatus.isOpen ? (
                                  <div 
                                    className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide text-white inline-flex items-center gap-2"
                                    style={{ backgroundColor: supplier.primary_color || '#168e00' }}
                                  >
                                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                      Abierto Ahora
                                  </div>
                              ) : (
                                  <div className="px-3 py-1 bg-red-500/20 border border-red-500/50 rounded-full text-xs font-bold uppercase tracking-wide text-red-200 inline-flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full bg-red-500" />
                                      Cerrado Ahora
                                  </div>
                              )}
                              <span className="text-sm text-white/60">Tiempo de respuesta: ~10 min</span>
                          </div>
                      </div>
                  </div>
              </div>

              {/* MIDDLE ROW: Map (Full Width) */}
              <div className="w-full h-[400px] bg-white/5 backdrop-blur-md rounded-[2rem] overflow-hidden border border-white/10 relative shadow-2xl mb-12 group">
                  {mapLocation ? (
                      <SupplierLocationMap
                          location={mapLocation}
                          supplierName={supplier.name}
                      />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/30 bg-black/20">
                          <div className="text-center">
                              <MapPin size={48} className="mx-auto mb-2 opacity-50" />
                              <p>Ubicación no disponible</p>
                          </div>
                      </div>
                  )}

                  {/* Floating Location Badge */}
                  <a
                    href={mapLocation ? `https://www.google.com/maps/search/?api=1&query=${mapLocation.lat},${mapLocation.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(supplier.address || '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute bottom-4 left-4 z-[500] bg-white/90 backdrop-blur text-[#004e28] px-4 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 group-hover:scale-105 transition-transform"
                  >
                      <MapPin size={16} /> Ver Ubicación Exacta
                  </a>
              </div>

              {/* BOTTOM ROW: CTA (Full Width) */}
              <div className="bg-[#168e00] rounded-[2rem] p-8 md:p-12 text-center relative overflow-hidden shadow-[0_0_50px_-10px_rgba(22,142,0,0.4)]">
                  <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                  <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                      <div className="text-left">
                          <h3 className="text-2xl md:text-3xl font-black mb-2 font-[family-name:var(--font-varela-round)]">¿Tienes preguntas sobre nuestros productos?</h3>
                          <p className="text-white/80 text-lg">Estamos listos para atenderte y resolver todas tus dudas al instante.</p>
                      </div>
                      <a 
                        href={`https://wa.me/${supplier.phone?.replace(/[^0-9]/g, '')}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="whitespace-nowrap px-8 py-4 bg-white text-[#004e28] rounded-full font-bold text-lg hover:bg-gray-100 transition-all shadow-xl hover:-translate-y-1 flex items-center gap-2"
                      >
                          <MessageCircle size={24} />
                          Enviar Mensaje
                      </a>
                  </div>
              </div>

          </div>
      </section>
      </>
      )}
    </div>
  );
}
