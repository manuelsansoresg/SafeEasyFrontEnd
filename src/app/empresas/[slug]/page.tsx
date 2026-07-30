"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, notFound } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Supplier, CarouselImage, Certificate } from "@/lib/products";
import { MapPin, Phone, Mail, CheckCircle, ChevronLeft, ChevronRight, Store, Star, Check, MessageCircle, X, Calendar, Play, Clock, ArrowDown, Volume2, VolumeX, Search, BriefcaseBusiness, Facebook, Instagram, X as XIcon } from "lucide-react";
import StarRating from "@/components/StarRating";
import { ProductCard } from "@/components/ProductCard";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import { parseMapLocation } from "@/lib/googleMaps";
import {
  filterProductsByActiveSupplierSubscription,
  supplierHasDirectorySubscription,
  supplierHasActiveSubscription,
} from "@/lib/subscriptionAccess";
import DOMPurify from "isomorphic-dompurify";
import { useSupplierPageModeStore } from "@/store/useSupplierPageModeStore";
import { useChromeVisibilityStore } from "@/store/useChromeVisibilityStore";
import { servicesService } from "@/services/servicesService";
import type { SupplierService } from "@/types/services";
import { DirectoryRatingsSection } from "@/components/supplier/DirectoryRatingsSection";
import { DirectoryContactButton } from "@/components/supplier/DirectoryContactButton";
import { DirectoryTopNav } from "@/components/supplier/DirectoryTopNav";
import { DirectoryGallerySection } from "@/components/supplier/DirectoryGallerySection";

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

type SocialPlatform = "facebook" | "instagram" | "x";

type SocialLink = {
  platform: SocialPlatform;
  label: string;
  url: string;
};

const SOCIAL_DEFS: Array<{ platform: SocialPlatform; label: string; field: keyof Supplier }> = [
  { platform: "facebook", label: "Facebook", field: "facebook_url" },
  { platform: "instagram", label: "Instagram", field: "instagram_url" },
  { platform: "x", label: "X (Twitter)", field: "x_url" },
];

const sanitizeSocialUrl = (raw: unknown): string | null => {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;
  // Acepta URLs con o sin esquema. Si no trae, prueba con https://.
  const candidates = [trimmed, /^https?:\/\//i.test(trimmed) ? null : `https://${trimmed}`].filter(
    (value): value is string => Boolean(value),
  );
  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
      }
    } catch {
      // try next candidate
    }
  }
  return null;
};

const pickSocialLinks = (source: Supplier | null): SocialLink[] => {
  if (!source) return [];
  const links: SocialLink[] = [];
  for (const def of SOCIAL_DEFS) {
    const value = (source as unknown as Record<string, unknown>)[def.field as string];
    const safe = sanitizeSocialUrl(value);
    if (safe) links.push({ platform: def.platform, label: def.label, url: safe });
  }
  return links;
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
      <div className="relative w-full h-full overflow-hidden bg-black">
        {images.map((img, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === currentIndex ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="absolute inset-0 bg-black" />
            <img
              src={getImageUrl(img.image)}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-125 object-cover opacity-70 blur-3xl saturate-125"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-black/35" />
            <img
              src={getImageUrl(img.image)}
              alt={`Slide ${index + 1}`}
              className="relative z-10 h-full w-full object-contain drop-shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            />
            <div className="absolute inset-0 z-20 bg-gradient-to-r from-black/75 via-black/15 to-black/20" />
            <div className="absolute inset-x-0 bottom-0 z-20 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
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

function DirectoryServiceCard({
  service,
}: {
  service: SupplierService;
}) {
  const imageUrl =
    service.cover_thumbnail_url ||
    service.cover_image_url ||
    "/placeholder.png";

  return (
    <article className="group flex flex-col">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#e9efeb]">
        <Image
          src={imageUrl}
          alt={`Servicio ${service.title}`}
          fill
          unoptimized
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>

      <div className="mt-5 flex flex-col">
        <h3 className="text-lg font-bold leading-snug text-[#004e28] font-[family-name:var(--font-varela-round)]">
          {service.title}
        </h3>
        {service.description ? (
          <p className="mt-2 line-clamp-4 text-sm leading-6 text-gray-600">
            {service.description}
          </p>
        ) : null}
        <p className="mt-3 text-sm font-bold text-[#168e00]">
          Desde{" "}
          {new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency: "MXN",
          }).format(service.price)}
        </p>
        <Link
          href={`/servicios/${service.id}`}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-[#168e00] transition-colors hover:text-[#004e28]"
        >
          Ver más
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </div>
    </article>
  );
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

const unwrapSupplierProducts = (data: unknown): SupplierProduct[] => {
  if (Array.isArray(data)) return data as SupplierProduct[];
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  const candidates = [record.items, record.results, record.data, record.products];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate as SupplierProduct[];
  }
  return [];
};



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
        headerVideoRef.current.play().catch((e) => {
          if (process.env.NODE_ENV === "development") console.log("Auto-play prevented", e);
        });
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
  const [services, setServices] = useState<SupplierService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);
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
  const setDirectoryMode = useSupplierPageModeStore((state) => state.setDirectoryMode);
  const setHideForDirectory = useChromeVisibilityStore((state) => state.setHideForDirectory);
  const resetChromeVisibility = useChromeVisibilityStore((state) => state.reset);
  
  const observerTarget = useRef<HTMLDivElement | null>(null);

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
      
      if (process.env.NODE_ENV === "development") console.log("Fetching products for identifier:", identifier);
      if (supplierHasDirectorySubscription(supplier)) {
        setProducts([]);
        setProductsLoading(false);
        setHasMore(false);
      } else {
        fetchProducts(identifier, 1, false);
      }
      fetchRatings(identifier, 0, false);
      if (supplierHasDirectorySubscription(supplier)) {
        setServicesLoading(true);
        setServicesError(null);
        servicesService
          .listPublic({ supplierId: supplier.id, skip: 0, limit: 100 })
          .then(setServices)
          .catch((requestError) => {
            setServices([]);
            setServicesError(
              requestError instanceof Error
                ? requestError.message
                : "No se pudieron cargar los servicios.",
            );
          })
          .finally(() => setServicesLoading(false));
      } else {
        setServices([]);
        setServicesError(null);
      }
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

      const res = await fetch(`/proxy/products/by-supplier/${encodeURIComponent(supplierSlug)}?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const supplierId = Number(supplier?.id);
        if (!Number.isFinite(supplierId)) {
          if (!append) setProducts([]);
          setHasMore(false);
          setProductsError(
            supplierHasDirectorySubscription(supplier)
              ? "No se pudieron cargar los servicios."
              : "No se pudieron cargar los productos.",
          );
          return;
        }

        const fallbackParams = new URLSearchParams();
        fallbackParams.set("skip", "0");
        fallbackParams.set("limit", "500");
        fallbackParams.set("supplier_id", String(supplierId));

        const fallback = await fetch(`/proxy/products/?${fallbackParams.toString()}`, {
          cache: "no-store",
        });

        if (!fallback.ok) {
          if (!append) setProducts([]);
          setHasMore(false);
          setProductsError(
            supplierHasDirectorySubscription(supplier)
              ? "No se pudieron cargar los servicios."
              : "No se pudieron cargar los productos.",
          );
          return;
        }

        const fallbackData = await fallback.json();
        const ownProducts = filterProductsByActiveSupplierSubscription(
          unwrapSupplierProducts(fallbackData).filter((product) => Number(product.supplier_id) === supplierId)
        );
        const pageStart = (currentPage - 1) * limit;
        const pageItems = ownProducts.slice(pageStart, pageStart + limit);

        syncFavorites(pageItems);
        setProducts((prev) => (append ? [...prev, ...pageItems] : pageItems));
        setHasMore(ownProducts.length > pageStart + limit);
        return;
      }

      const data = await res.json();
      const newProducts = filterProductsByActiveSupplierSubscription(unwrapSupplierProducts(data));
      
      syncFavorites(newProducts);

      setProducts(prev => append ? [...prev, ...newProducts] : newProducts);
      setHasMore(newProducts.length === limit);
    } catch (error) {
      console.error("Error fetching supplier products", error);
      setProductsError(
        supplierHasDirectorySubscription(supplier)
          ? "No se pudieron cargar los servicios."
          : "No se pudieron cargar los productos.",
      );
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

  const sanitizeDescriptionHtml = (html: string) => {
    if (!html) return "";
    return DOMPurify.sanitize(html, {
      FORBID_ATTR: ["class", "style"],
    });
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
  const isDirectory = supplierHasDirectorySubscription(supplier);

  const filteredProducts = products.filter((product) => {
    const matchesCategory = selectedCategorySlug ? product.category?.slug === selectedCategorySlug : true;
    const matchesSubcategory = selectedSubcategorySlug ? product.subcategory?.slug === selectedSubcategorySlug : true;
    const matchesSearch = searchQuery 
      ? product.title.toLowerCase().includes(searchQuery.toLowerCase()) 
      : true;
    return matchesCategory && matchesSubcategory && matchesSearch;
  });
  const filteredServices = services.filter((service) =>
    searchQuery
      ? service.title.toLocaleLowerCase("es").includes(
          searchQuery.toLocaleLowerCase("es"),
        )
      : true,
  );
  const normalizeWhatsAppPhone = (phone: string): string => {
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("52") && digits.length >= 12) return digits;
  if (digits.startsWith("52")) return digits;
  return `52${digits}`;
};

const contactHref = supplier?.phone
    ? `https://wa.me/${normalizeWhatsAppPhone(supplier.phone)}`
    : supplier?.email
      ? `mailto:${supplier.email}`
      : null;
  const hasCustomAboutTitle = Boolean(
    supplier?.title_about?.trim() &&
      supplier.title_about.trim().toLowerCase() !== "más que un proveedor,",
  );
  const hasCustomAboutSubtitle = Boolean(
    supplier?.subtitle_about?.trim() &&
      supplier.subtitle_about.trim().toLowerCase() !== "tu aliado estratégico.",
  );
  const hasContactInfo = Boolean(
    supplier?.phone || supplier?.email || supplier?.address,
  );
  const hasBusinessHours = groupedHours.length > 0;
  const hasLocation = Boolean(mapLocation || supplier?.address);
  const socialLinks = pickSocialLinks(supplier);
  const hasSocial = socialLinks.length > 0;
  const hasContactSection =
    hasContactInfo || hasBusinessHours || hasLocation;
  const hasHeroHighlights = Boolean(
    (Number(supplier?.rating_count) > 0 &&
      Number(supplier?.average_rating) > 0) ||
      Number(supplier?.sales_count) > 0 ||
      supplier?.is_verified,
  );
  const useDirectoryPresentation = false;
  useEffect(() => {
    setDirectoryMode(isDirectory);
    return () => setDirectoryMode(false);
  }, [isDirectory, setDirectoryMode]);

  // Cuando el proveedor es directorio, ocultamos el chrome de Drooopy
  // (Header/Footer/MobileNav) y mostraremos el DirectoryTopNav propio del proveedor.
  // El reset en cleanup garantiza que al salir de /empresas/* el chrome vuelva.
  useEffect(() => {
    if (isDirectory) {
      setHideForDirectory(true);
    }
    return () => {
      resetChromeVisibility();
    };
  }, [isDirectory, setHideForDirectory, resetChromeVisibility]);

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

  // Solo los proveedores con una suscripción activa (de cualquier tipo) tienen
  // un perfil público. Si no hay suscripción vigente, 404 — no hay espacio.
  if (!supplierHasActiveSubscription(supplier)) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[#ffffff] font-sans selection:bg-[#168e00] selection:text-white">

      {isDirectory ? (
        <DirectoryTopNav
          supplierName={supplier.name}
          logoUrl={supplierLogo}
          showAbout={Boolean(
            supplier.about ||
              supplier.about_media ||
              hasCustomAboutTitle ||
              hasCustomAboutSubtitle,
          )}
          showServices={Boolean(isDirectory)}
        />
      ) : null}

      {/* --- HERO SECTION --- */}
      <section
        id="inicio"
        className="relative h-[92svh] min-h-[760px] w-full scroll-mt-20 overflow-hidden bg-black group md:h-[90vh] md:min-h-[680px]"
      >
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

         {/* Soft readability overlay without tinting the media */}
         <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent z-10" />
         <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/45 to-transparent z-10" />

         {/* Content */}
         <div className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6 pb-28 text-center md:items-start md:px-20 md:pb-0 md:text-left lg:px-32">
             <div className="animate-in fade-in slide-in-from-left-10 w-full max-w-4xl duration-1000">
                {supplierLogo && (
                    <div className="mx-auto mb-8 h-24 w-24 rounded-3xl border border-white/20 bg-white/10 p-4 shadow-2xl backdrop-blur-md md:mx-0 md:h-32 md:w-32">
                        <img src={getImageUrl(supplierLogo)} alt={supplier.name} className="w-full h-full object-contain drop-shadow-md" />
                    </div>
                )}
                
                <h1 className="mb-6 text-4xl font-black uppercase leading-[0.9] tracking-tighter text-white drop-shadow-2xl font-[family-name:var(--font-varela-round)] sm:text-5xl md:text-7xl lg:text-9xl">
                   {supplier.name}
                </h1>
                
                {supplier.short_description ? (
                  <p className="mx-auto mb-10 max-w-2xl border-l-0 border-[#168e00] pl-0 text-base font-light leading-relaxed text-gray-100 drop-shadow-lg font-[family-name:var(--font-poppins)] sm:text-xl md:mx-0 md:border-l-4 md:pl-6 md:text-2xl">
                    {supplier.short_description}
                  </p>
                ) : null}

                <div className="mb-8 flex w-full flex-col flex-wrap items-stretch justify-center gap-4 sm:flex-row sm:items-center md:justify-start">
                      {!isDirectory ? (
                        <a href={isDirectory ? "#servicios" : "#productos"} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#168e00] px-8 py-4 text-lg font-bold text-white shadow-[0_0_30px_-5px_rgba(22,142,0,0.6)] transition-all hover:-translate-y-1 hover:bg-[#137a00] hover:shadow-[0_0_40px_-5px_rgba(22,142,0,0.8)] font-[family-name:var(--font-varela-round)] sm:w-auto">
                            {isDirectory ? "Servicios" : "Ver Catálogo"} <ArrowDown size={20} />
                        </a>
                      ) : null}
                      {isDirectory ? (
                        <DirectoryContactButton
                          supplierId={supplier.id}
                          supplierName={supplier.name}
                          supplierSlug={supplier.slug}
                          supplierImage={supplierLogo}
                          returnPath={`/empresas/${supplier.slug || supplier.id}`}
                        />
                      ) : null}
                      {hasContactSection ? (
                        <a href="#contacto" className="inline-flex w-full items-center justify-center rounded-full border border-white/30 bg-white/10 px-8 py-4 text-lg font-bold text-white backdrop-blur-md transition-all hover:-translate-y-1 hover:bg-white/20 font-[family-name:var(--font-varela-round)] sm:w-auto">
                          {isDirectory ? "Contacto" : "Contactar Ahora"}
                        </a>
                      ) : null}
                </div>
             </div>
         </div>

         {/* Floating Stats Bar */}
         {hasHeroHighlights ? (
         <div className="absolute bottom-0 left-0 z-30 w-full border-t border-white/10 bg-black/20 backdrop-blur-xl">
             <div className="container mx-auto flex flex-wrap items-center gap-10 px-6 py-6 md:gap-16">
                 {Number(supplier.rating_count) > 0 && Number(supplier.average_rating) > 0 ? (
                   <div className="text-center md:text-left">
                       <div className="text-3xl font-black text-[#168e00] font-[family-name:var(--font-varela-round)]">{supplier.average_rating?.toFixed(1)}</div>
                       <div className="text-white/60 text-xs uppercase tracking-widest font-bold">Calificación</div>
                   </div>
                 ) : null}
                 {Number(supplier.sales_count) > 0 ? (
                   <div className="text-center md:text-left">
                       <div className="text-3xl font-black text-white font-[family-name:var(--font-varela-round)]">
                         {supplier.sales_count}
                       </div>
                       <div className="text-white/60 text-xs uppercase tracking-widest font-bold">
                         Ventas
                       </div>
                   </div>
                 ) : null}
                {supplier.is_verified ? (
                  <div className="flex items-center">
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
         ) : null}

         {/* Audio Toggle */}
         {supplier.header_media_type === 'video' && supplier.header_video && (
             <button 
                onClick={toggleMute}
                className="absolute bottom-24 right-6 z-40 rounded-full border border-white/20 bg-black/40 p-3 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-black/60"
                aria-label={isMuted ? "Activar sonido" : "Silenciar"}
             >
                 {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
             </button>
         )}
      </section>

      {/* --- TABS NAVIGATION (solo tienda; directorio usa DirectoryTopNav propio) --- */}
      {!isDirectory ? (
      <div className="sticky top-[0px] md:top-[0px] z-40 bg-white border-b border-gray-100 shadow-sm backdrop-blur-md bg-white/90">
        <div className="container mx-auto px-4 md:px-8">
           <div className="flex gap-8 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setActiveTab('main')}
                className={`py-4 px-2 border-b-2 font-bold transition-colors whitespace-nowrap ${activeTab === 'main' ? 'border-[#168e00] text-[#004e28]' : 'border-transparent text-gray-500 hover:text-[#004e28]'}`}
              >
                Página Principal
              </button>
              {!isDirectory ? (
              <button
                onClick={() => setActiveTab('products')}
                className={`py-4 px-2 border-b-2 font-bold transition-colors whitespace-nowrap ${activeTab === 'products' ? 'border-[#168e00] text-[#004e28]' : 'border-transparent text-gray-500 hover:text-[#004e28]'}`}
              >
                Productos
              </button>
              ) : null}
           </div>
        </div>
      </div>
      ) : null}

      {activeTab === "main" && supplier.description?.trim() ? (
        <section
          aria-labelledby="supplier-description-title"
          className="relative overflow-hidden bg-gradient-to-b from-white to-[#f7f9f8] py-14 md:py-20"
        >
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <article className="max-w-4xl">
              <span
                aria-hidden="true"
                className="mb-7 block h-1 w-14 rounded-full bg-[#168e00]"
              />
              <h2
                id="supplier-description-title"
                className="font-[family-name:var(--font-varela-round)] text-3xl font-bold text-[#004e28] md:text-5xl"
              >
                Conoce a {supplier.name}
              </h2>
              <div className="ql-snow mt-7 w-full">
                <div
                  className="ql-editor max-w-none p-0 text-base leading-8 text-gray-700 [&_a]:font-semibold [&_a]:text-[#168e00] [&_a]:underline-offset-4 [&_a:hover]:underline [&_li]:mb-2 [&_p]:mb-5 [&_p:last-child]:mb-0 md:text-lg md:leading-9"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeDescriptionHtml(
                      supplier.description.trim(),
                    ),
                  }}
                />
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {isDirectory && (supplier.about || supplier.about_media || hasCustomAboutTitle || hasCustomAboutSubtitle) ? (
        <section
          id="nosotros"
          className="relative scroll-mt-20 bg-white py-16 md:py-24"
        >
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <div className={`grid items-center gap-10 md:gap-16 ${supplier.about_media ? "md:grid-cols-2" : ""}`}>
              {supplier.about_media ? (
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-[0_20px_50px_-20px_rgba(0,0,0,0.25)]">
                  <img
                    src={getImageUrl(supplier.about_media)}
                    alt={supplier.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}

              <div>
                {hasCustomAboutTitle || hasCustomAboutSubtitle ? (
                  <h2 className="mb-6 text-3xl font-black leading-tight text-[#004e28] font-[family-name:var(--font-varela-round)] md:text-4xl">
                    {hasCustomAboutTitle ? supplier.title_about : null}
                    {hasCustomAboutTitle && hasCustomAboutSubtitle ? <br /> : null}
                    {hasCustomAboutSubtitle ? (
                      <span className="text-[#168e00]">{supplier.subtitle_about}</span>
                    ) : null}
                  </h2>
                ) : null}
                {supplier.about ? (
                  <div className="text-base leading-8 text-gray-600 md:text-lg md:leading-9">
                    <div className="ql-snow w-full">
                      <div
                        className="ql-editor"
                        style={{ padding: 0, color: "inherit", fontSize: "inherit", background: "transparent" }}
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(supplier.about || "") }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {isDirectory ? (
        <section
          id="servicios"
          className="relative scroll-mt-20 overflow-hidden bg-[#f2f3f4] py-20"
        >
          <div className="pointer-events-none absolute -right-64 -top-64 h-[620px] w-[620px] rounded-full bg-[#168e00]/5 blur-3xl" />
          <div className="relative z-10 mx-auto max-w-6xl px-5 md:px-8">
            <div className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <span className="mb-3 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-[#168e00]">
                  <BriefcaseBusiness size={17} />
                  Directorio empresarial
                </span>
                <h2 className="font-[family-name:var(--font-varela-round)] text-3xl font-black text-[#004e28] md:text-5xl">
                  Servicios
                </h2>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  Conoce las soluciones profesionales disponibles y encuentra
                  la opción adecuada para ti.
                </p>
              </div>

              {services.length > 4 ? (
                <label className="relative block w-full md:w-80">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    size={19}
                  />
                  <span className="sr-only">Buscar servicios</span>
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar servicios..."
                    className="w-full rounded-2xl border border-gray-200 bg-white py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-[#168e00] focus:ring-4 focus:ring-[#168e00]/10"
                  />
                </label>
              ) : null}
            </div>

            {servicesLoading ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="aspect-[4/5] animate-pulse rounded-[2rem] bg-white"
                  />
                ))}
              </div>
            ) : servicesError ? (
              <div className="rounded-[2rem] bg-white px-6 py-14 text-center shadow-sm">
                <p className="font-semibold text-red-600">{servicesError}</p>
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="rounded-[2rem] bg-white px-6 py-14 text-center shadow-sm">
                <p className="font-semibold text-gray-500">
                  {searchQuery
                    ? "No encontramos servicios con ese nombre."
                    : "No hay servicios disponibles en este momento."}
                </p>
              </div>
            ) : (
              <div
                className="grid gap-x-10 gap-y-12"
                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 300px))" }}
              >
                {filteredServices.map((service) => (
                  <DirectoryServiceCard key={service.id} service={service} />
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* --- INTRO SECTION (Directory) --- */}
      {isDirectory && (supplier.intro_title?.trim() || supplier.intro_description?.trim() || supplier.intro_image_url) ? (
        <section
          id="intro"
          className="relative scroll-mt-20 overflow-hidden bg-[#004e28] py-16 text-white md:py-24"
        >
          <div className="pointer-events-none absolute -left-40 top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full bg-[#168e00]/15 blur-3xl" />
          <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 md:grid-cols-2 md:px-8">
            <div className="order-2 md:order-1">
              {supplier.intro_title?.trim() ? (
                <h2 className="font-[family-name:var(--font-varela-round)] text-3xl font-black leading-tight md:text-4xl lg:text-5xl">
                  {supplier.intro_title.trim()}
                </h2>
              ) : null}
              {supplier.intro_description?.trim() ? (
                <p className="mt-5 max-w-xl whitespace-pre-line text-base leading-8 text-white/85 md:text-lg md:leading-9">
                  {supplier.intro_description.trim()}
                </p>
              ) : null}
            </div>

            {supplier.intro_image_url ? (
              <div className="order-1 md:order-2">
                <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-3xl border border-white/10 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getImageUrl(supplier.intro_image_url)}
                    alt={supplier.intro_title?.trim() || supplier.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* --- PRODUCTS SECTION (Tab Content) --- */}
      {!isDirectory && activeTab === 'products' && (
      <section id={isDirectory ? "servicios" : "productos"} className={`relative scroll-mt-20 overflow-hidden ${isDirectory ? "bg-[#f2f3f4] py-20" : "bg-[#f2f3f4] py-24"}`}>
        {/* Decorative Background Blob */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#004e28]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className={`container mx-auto px-4 md:px-8 relative z-10 ${isDirectory ? "max-w-6xl" : ""}`}>
            <div className={`flex flex-col md:flex-row items-center justify-between gap-6 ${isDirectory ? "mb-10" : "mb-16"}`}>
                <div className="max-w-2xl">
                    <h2 className={`${isDirectory ? "text-3xl md:text-4xl" : "text-4xl md:text-5xl"} font-black text-[#004e28] mb-4 font-[family-name:var(--font-varela-round)]`}>
                        {isDirectory ? "Servicios" : "Productos"}
                    </h2>
                </div>
                
                {products.length > 4 ? (
                <div className="w-full md:w-auto">
                    <div className="relative w-full md:w-96 group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-[#168e00] transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder={isDirectory ? "Buscar servicios..." : "Buscar productos..."}
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
                ) : null}
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
            ) : !isDirectory && products.length === 0 ? (
                <div className="rounded-[3rem] bg-white py-20 text-center shadow-sm">
                    <p className="text-xl font-bold text-gray-400">
                      No hay productos disponibles en este momento.
                    </p>
                </div>
            ) : (
                <div className={`grid gap-8 md:gap-10 ${isDirectory ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
                    {filteredProducts.map((product) => (
                      <div key={product.id} className="h-full">
                        <ProductCard
                          id={String(product.id)}
                          title={product.title}
                          price={product.price}
                          image={
                            product.thumbnail_url ||
                            product.subcategory?.thumbnail_url ||
                            ""
                          }
                          minOrder={`${product.stock > 0 ? "1" : "10"} pzas`}
                          slug={product.slug}
                          rating={product.average_rating || 5.0}
                          sales={product.stock}
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
        {!isDirectory ? (
        <div className="container mx-auto px-4 md:px-8 py-12 space-y-8 bg-gray-50/30">
             <SupplierProductCarousel supplierId={supplier.id} kind="most_searched" title="Más Buscados" />
             <SupplierProductCarousel supplierId={supplier.id} kind="most_purchased" title="Más Comprados" />
             <SupplierProductCarousel supplierId={supplier.id} kind="best_rated" title="Mejor Calificados" />
        </div>
        ) : null}

      {/* --- CERTIFICATES SECTION --- */}
      {supplier.certificates && supplier.certificates.length > 0 && (
        <section className="py-20 bg-[#f9fafb]">
            <div className={isDirectory ? "mx-auto max-w-6xl px-5 md:px-8" : "container mx-auto px-6 md:px-12"}>
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-black text-[#004e28] mb-4 font-[family-name:var(--font-varela-round)]">
                        {supplier.certificates_title || 'Calidad Certificada'}
                    </h2>
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
      {isDirectory ? (
        <DirectoryRatingsSection slug={supplier.slug || String(slug)} />
      ) : (
        <section id="experiencia" className="scroll-mt-20 border-t border-gray-100 bg-white py-24">
          <div className={`container mx-auto px-6 md:px-12 ${useDirectoryPresentation ? "max-w-6xl" : ""}`}>
              <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-8">
                  <div>
                      <h2 className="text-3xl md:text-4xl font-black text-[#004e28] mb-2 font-[family-name:var(--font-varela-round)]">
                          Opiniones Verificadas
                      </h2>
                      <div className="flex items-center gap-2 text-[#168e00]">
                          <span className="font-bold text-xl">{supplier.average_rating?.toFixed(1)}</span>
                          <StarRating rating={supplier.average_rating || 0} size={20} />
                          <span className="text-gray-400 text-sm">({ratingsTotal} reseñas)</span>
                      </div>
                  </div>

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
                              <p className="text-gray-600 italic mb-6">&quot;{rating.comment}&quot;</p>
                              <div className="flex items-center gap-3 mt-auto pt-4 border-t border-gray-200">
                                  <img
                                    src={getImageUrl(rating.product_thumbnail_url || rating.product_image || null)}
                                    alt=""
                                    className="w-10 h-10 rounded-lg object-cover bg-white"
                                  />
                                  <div className="text-xs text-gray-400">
                                      <p className="line-clamp-1">
                                        Sobre: {rating.product_title}
                                      </p>
                                      <p>{rating.created_at ? new Date(rating.created_at).toLocaleDateString() : ""}</p>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              ) : (
                  <div className="text-center py-16 bg-[#f9fafb] rounded-[3rem]">
                      <MessageCircle size={48} className="mx-auto text-gray-300 mb-4" />
                      <p className="text-gray-500 text-lg">Aún no hay reseñas.</p>
                      <p className="text-gray-400 text-sm">¡Sé el primero en compartir tu experiencia!</p>
                  </div>
              )}
          </div>
      </section>
      )}

      {/* --- GALLERY SECTION (Directory) --- */}
      {isDirectory ? (
        <DirectoryGallerySection supplierId={supplier.id} />
      ) : null}

      {/* --- CONTACT & MAP (Dark Mode / Expert UI) --- */}
      <section
        id="contacto"
        className={`relative overflow-hidden ${
          useDirectoryPresentation ? "bg-[#f2f3f4] py-16 text-[#000000] md:py-20" : "bg-[#004e28] py-24 text-white"
        }`}
      >
          {/* Background Elements */}
          <div className={`absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] via-transparent to-transparent ${useDirectoryPresentation ? "from-[#168e00]/10" : "from-white opacity-10"}`} />
          
          <div className="container mx-auto px-4 md:px-8 max-w-6xl relative z-10">
              
              {/* TOP ROW: Info & Hours */}
              <div className={`mb-12 grid grid-cols-1 gap-8 ${hasContactInfo && hasBusinessHours ? "md:grid-cols-2" : ""}`}>
                  {/* Info Card */}
                  {hasContactInfo || hasSocial ? (
                  <div className={`rounded-[2rem] transition-colors ${useDirectoryPresentation ? "overflow-hidden border border-[#004e28]/10 bg-white shadow-[0_24px_60px_-40px_rgba(0,78,40,0.7)]" : "bg-white/5 backdrop-blur-lg border border-white/10 p-8 hover:bg-white/10"}`}>
                      <h3 className={`text-2xl font-bold font-[family-name:var(--font-varela-round)] flex items-center gap-3 ${useDirectoryPresentation ? "bg-[#004e28] px-8 py-6 text-white" : "mb-6"}`}>
                          <MessageCircle className="text-[#168e00]" /> Contáctanos
                      </h3>
                      <div className={`space-y-4 ${useDirectoryPresentation ? "p-8" : ""}`}>
                          {supplier.phone && (
                              <div className="flex min-w-0 items-center gap-4 group">
                                  <div className="w-10 h-10 shrink-0 rounded-full bg-[#168e00]/20 flex items-center justify-center group-hover:bg-[#168e00] transition-colors">
                                      <Phone size={18} className="text-[#168e00] group-hover:text-white" />
                                  </div>
                                  <span className="min-w-0 break-words text-base font-medium sm:text-lg">{supplier.phone}</span>
                              </div>
                          )}
                          {supplier.email && (
                              <div className="flex min-w-0 items-center gap-4 group">
                                  <div className="w-10 h-10 shrink-0 rounded-full bg-[#168e00]/20 flex items-center justify-center group-hover:bg-[#168e00] transition-colors">
                                      <Mail size={18} className="text-[#168e00] group-hover:text-white" />
                                  </div>
                                  <span className="min-w-0 break-all text-base font-medium leading-snug sm:text-lg">{supplier.email}</span>
                              </div>
                          )}
                          {supplier.address && (
                              <div className="flex min-w-0 items-center gap-4 group">
                                  <div className="w-10 h-10 shrink-0 rounded-full bg-[#168e00]/20 flex items-center justify-center group-hover:bg-[#168e00] transition-colors">
                                      <MapPin size={18} className="text-[#168e00] group-hover:text-white" />
                                  </div>
                                  <span className="min-w-0 break-words text-base font-medium sm:text-lg">{supplier.address}</span>
                              </div>
                          )}

                          {hasSocial ? (
                            <div className={`pt-4 mt-2 ${useDirectoryPresentation ? "border-t border-[#004e28]/10" : "border-t border-white/10"}`}>
                              <p className={`mb-3 text-xs font-bold uppercase tracking-widest ${useDirectoryPresentation ? "text-[#168e00]" : "text-white/70"}`}>
                                Síguenos
                              </p>
                              <div className="flex flex-wrap items-center gap-3">
                                {socialLinks.map((link) => (
                                  <a
                                    key={link.platform}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`${link.label} — se abre en una pestaña nueva`}
                                    className={`inline-flex h-12 w-12 items-center justify-center rounded-full transition-all hover:-translate-y-0.5 ${
                                      useDirectoryPresentation
                                        ? "bg-[#004e28]/10 text-[#004e28] hover:bg-[#004e28] hover:text-white"
                                        : "bg-white/10 text-white hover:bg-white hover:text-[#004e28]"
                                    }`}
                                  >
                                    {link.platform === "facebook" ? (
                                      <Facebook size={20} />
                                    ) : link.platform === "instagram" ? (
                                      <Instagram size={20} />
                                    ) : (
                                      <XIcon size={18} />
                                    )}
                                  </a>
                                ))}
                              </div>
                            </div>
                          ) : null}
                      </div>
                  </div>
                  ) : null}

                  {/* Hours Card */}
                  {hasBusinessHours ? (
                  <div className={`rounded-[2rem] ${useDirectoryPresentation ? "overflow-hidden border border-[#004e28]/10 bg-white shadow-[0_24px_60px_-40px_rgba(0,78,40,0.7)]" : "bg-white/5 backdrop-blur-lg border border-white/10 p-8"}`}>
                      <h3 className={`text-2xl font-bold font-[family-name:var(--font-varela-round)] flex items-center gap-3 ${useDirectoryPresentation ? "bg-[#004e28] px-8 py-6 text-white" : "mb-6"}`}>
                          <Clock style={{ color: supplier.primary_color || '#168e00' }} /> Horarios de Atención
                      </h3>
                      <div className={`space-y-4 ${useDirectoryPresentation ? "p-8 text-[#59675f]" : "text-gray-300"}`}>
                          {groupedHours.map((group, idx) => (
                                  <div key={idx} className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${useDirectoryPresentation ? "rounded-2xl bg-[#f2f3f4] px-5 py-4" : "border-b border-white/5 pb-2 last:border-0"}`}>
                                      <span className={useDirectoryPresentation ? "font-semibold text-[#004e28]" : ""}>
                                          {group.start === group.end 
                                              ? DAYS_MAP[group.start] 
                                              : `${DAYS_MAP[group.start]} - ${DAYS_MAP[group.end]}`}
                                      </span>
                                      <span className={`font-bold ${useDirectoryPresentation ? "w-fit rounded-xl bg-white px-4 py-2 text-[#168e00] shadow-sm" : "text-white"}`}>
                                          {group.isClosed ? "Cerrado" : `${formatTime(group.open)} - ${formatTime(group.close)}`}
                                      </span>
                                  </div>
                              ))}

                          <div className={`flex items-center gap-3 ${useDirectoryPresentation ? "pt-3" : "mt-4"}`}>
                              {businessStatus.isOpen ? (
                                  <div 
                                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide text-white"
                                    style={{ backgroundColor: supplier.primary_color || '#168e00' }}
                                  >
                                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                      Abierto Ahora
                                  </div>
                              ) : (
                                  <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide ${useDirectoryPresentation ? "border-red-200 bg-red-50 text-red-700" : "border-red-500/50 bg-red-500/20 text-red-200"}`}>
                                      <div className="w-2 h-2 rounded-full bg-red-500" />
                                      Cerrado Ahora
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
                  ) : null}
              </div>

              {/* MIDDLE ROW: Map (Full Width) */}
              {mapLocation ? (
              <div className={`w-full h-[400px] rounded-[2rem] overflow-hidden relative mb-12 group ${useDirectoryPresentation ? "border border-[#004e28]/10 bg-white shadow-[0_24px_70px_-44px_rgba(0,78,40,0.7)]" : "bg-white/5 backdrop-blur-md border border-white/10 shadow-2xl"}`}>
                  <SupplierLocationMap
                      location={mapLocation}
                      supplierName={supplier.name}
                  />

                  {/* Floating Location Badge */}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${mapLocation.lat},${mapLocation.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-4 left-4 z-[500] flex items-center gap-2 rounded-xl bg-white/90 px-4 py-2 text-sm font-bold text-[#004e28] shadow-lg backdrop-blur transition-transform group-hover:scale-105"
                    >
                        <MapPin size={16} /> Ver Ubicación Exacta
                    </a>
              </div>
              ) : null}

              {/* BOTTOM ROW: CTA (Full Width) */}
              {(contactHref || isDirectory) ? (
              <div className="bg-[#168e00] rounded-[2rem] p-8 md:p-12 text-center relative overflow-hidden shadow-[0_0_50px_-10px_rgba(22,142,0,0.4)]">
                  <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                  <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                      <div className="text-left">
                          <h3 className="text-2xl md:text-3xl font-black mb-2 font-[family-name:var(--font-varela-round)]">
                            ¿Tienes preguntas sobre nuestros {isDirectory ? "servicios" : "productos"}?
                          </h3>
                          <p className="text-white/80 text-lg">Estamos listos para atenderte y resolver todas tus dudas al instante.</p>
                      </div>
                      {isDirectory ? (
                        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                          {supplier.phone ? (
                            <a
                              href={`https://wa.me/${normalizeWhatsAppPhone(supplier.phone)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-14 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-white px-8 py-4 text-base font-bold text-[#004e28] shadow-xl transition-all hover:-translate-y-1 hover:bg-gray-100"
                            >
                              <Phone size={21} />
                              WhatsApp
                            </a>
                          ) : (
                            <span
                              aria-disabled="true"
                              title="El proveedor todavía no ha configurado un número de WhatsApp"
                              className="inline-flex min-h-14 cursor-not-allowed items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/30 bg-white/15 px-8 py-4 text-base font-bold text-white/75"
                            >
                              <Phone size={21} />
                              WhatsApp sin configurar
                            </span>
                          )}
                          <DirectoryContactButton
                            supplierId={supplier.id}
                            supplierName={supplier.name}
                            supplierSlug={supplier.slug}
                            supplierImage={supplierLogo}
                            returnPath={`/empresas/${supplier.slug || supplier.id}`}
                            className="inline-flex min-h-14 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/20 bg-[#004e28] px-8 py-4 text-base font-bold text-white shadow-xl transition-all hover:-translate-y-1 hover:bg-[#003b1f] disabled:cursor-wait disabled:opacity-70"
                          />
                        </div>
                      ) : contactHref ? (
                        <a
                          href={contactHref}
                          target={contactHref.startsWith("http") ? "_blank" : undefined}
                          rel={contactHref.startsWith("http") ? "noopener noreferrer" : undefined}
                          className="flex items-center gap-2 whitespace-nowrap rounded-full bg-white px-8 py-4 text-lg font-bold text-[#004e28] shadow-xl transition-all hover:-translate-y-1 hover:bg-gray-100"
                        >
                            <MessageCircle size={24} />
                            {supplier.phone ? "Enviar mensaje" : "Enviar correo"}
                        </a>
                      ) : null}
                  </div>
              </div>
              ) : null}

          </div>
      </section>
      </>
      )}
    </div>
  );
}
