"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { Supplier, CarouselImage, Certificate } from "@/lib/products";
import { MapPin, Phone, Mail, CheckCircle, ChevronLeft, ChevronRight, Star, Check, MessageCircle, X, Calendar, Play, Clock, ArrowDown, Volume2, VolumeX, Search, BriefcaseBusiness, Facebook, Instagram, X as XIcon } from "lucide-react";
import StarRating from "@/components/StarRating";
import { ProductCard } from "@/components/ProductCard";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { fetchWithAuth } from "@/lib/api";
import { parseMapLocation } from "@/lib/googleMaps";
import {
  filterProductsByActiveSupplierSubscription,
  supplierHasDirectorySubscription,
} from "@/lib/subscriptionAccess";
import DOMPurify from "isomorphic-dompurify";
import { useSupplierPageModeStore } from "@/store/useSupplierPageModeStore";
import { useChromeVisibilityStore } from "@/store/useChromeVisibilityStore";
import { servicesService } from "@/services/servicesService";
import type { SupplierService } from "@/types/services";
import type {
  DrooopyCategory,
  DrooopySubcategory,
  SupplierCategory,
  SupplierSubcategory,
} from "@/types/supplierCategories";
import {
  buildCatalogFilterOptions,
  catalogRequestVariants,
  matchesCatalogFilters,
  type CatalogFilterOption,
  type CatalogRequestFilters,
} from "@/lib/catalogFilters";
import { SupplierCatalogFilters } from "@/components/supplier/SupplierCatalogFilters";
import { DirectoryRatingsSection } from "@/components/supplier/DirectoryRatingsSection";
import { DirectoryContactButton } from "@/components/supplier/DirectoryContactButton";
import { SupplierAboutSection } from "@/components/supplier/SupplierAboutSection";
import { SupplierTheme } from "@/components/supplier/SupplierTheme";
import { DirectoryTopNav } from "@/components/supplier/DirectoryTopNav";
import { DirectoryGallerySection } from "@/components/supplier/DirectoryGallerySection";
import type { SupplierGalleryImage } from "@/types/supplierGallery";
import { SupplierModuleNavigation } from "@/components/supplier/SupplierModuleNavigation";
import { PublicSupplierMenu } from "@/components/supplier/menu/PublicSupplierMenu";
import { DemoSupplierAgendaTab } from "@/components/agenda/DemoSupplierAgendaTab";
import { PublicSupplierAgendaTab } from "@/components/agenda/PublicSupplierAgendaTab";
import { menuService } from "@/services/menuService";
import type { Menu } from "@/types/menu";
import {
  SITE_BUILDER_READY,
  SITE_BUILDER_UPDATE,
  type SiteBuilderSection,
} from "@/lib/siteBuilder";


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
            <span className="inline-flex items-center justify-center w-20 h-20 rounded-full supplier-surface-primary bg-[var(--supplier-primary-action,#168e00)] text-[color:var(--supplier-inverse,#ffffff)] shadow-lg transform group-hover:scale-110 transition-transform duration-300">
              <Play size={32} className="ml-1" />
            </span>
          </div>
        </button>
      )}

      {error && (
        <div className="w-full h-full bg-gray-900 text-[color:var(--supplier-inverse,#ffffff)] flex flex-col items-center justify-center gap-2">
          <div className="text-sm opacity-80">No se pudo reproducir el video.</div>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2 supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] text-[var(--supplier-heading,#004e28)] rounded-full text-sm font-bold hover:bg-[var(--supplier-hover-card,#f3f4f6)] transition-colors"
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
        {images.map((img, index) => {
          const desktopSrc = getImageUrl(img.image);
          const mobileSrc = getImageUrl(img.image_movil || img.image);

          return (
            <div
              key={img.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                index === currentIndex ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="absolute inset-0 bg-neutral-950" />
              <picture className="absolute inset-0 block">
                <source media="(min-width: 768px)" srcSet={desktopSrc} />
                <img
                  src={mobileSrc}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full scale-110 object-cover opacity-80 blur-2xl saturate-125"
                />
              </picture>
              <div className="absolute inset-0 bg-black/15" />
              <picture className="relative z-10 block h-full w-full">
                <source media="(min-width: 768px)" srcSet={desktopSrc} />
                <img
                  src={mobileSrc}
                  alt={`Imagen ${index + 1} del encabezado`}
                  className="h-full w-full object-cover object-center drop-shadow-[0_24px_80px_rgba(0,0,0,0.45)] xl:object-contain"
                />
              </picture>
            </div>
          );
        })}
        
        {images.length > 1 && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-2 z-30">
                {images.map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className={`w-3 h-3 rounded-full transition-all duration-300 ${
                            idx === currentIndex ? "supplier-surface-primary bg-[var(--supplier-primary-action,#168e00)] w-8" : "bg-[var(--supplier-card-background,#ffffff)]/50 hover:bg-[var(--supplier-card-background,#ffffff)]"
                        }`}
                        aria-label={`Ir a slide ${idx + 1}`}
                    />
                ))}
            </div>
        )}
      </div>
    );
}

interface SupplierProductSubcategory extends DrooopySubcategory {
  image: string | null;
  thumbnail_url: string | null;
}

interface SupplierProduct {
  id: string | number;
  title: string;
  description: string;
  price: number;
  stock: number;
  sku: string;
  is_active: boolean;
  supplier_id: number;
  category_id: number;
  subcategory_id: number;
  supplier_category_id?: number | null;
  supplier_subcategory_id?: number | null;
  slug: string;
  average_rating?: number;
  thumbnail_url?: string | null;
  category?: DrooopyCategory | null;
  subcategory?: SupplierProductSubcategory | null;
  supplier_category?: SupplierCategory | null;
  supplier_subcategory?: SupplierSubcategory | null;
}

function DirectoryServiceCard({
  service,
  demoAgendaHref,
}: {
  service: SupplierService;
  demoAgendaHref?: string;
}) {
  const price = Number(service.price);
  const hasPrice = Number.isFinite(price) && price > 0;
  const imageUrl =
    service.cover_thumbnail_url ||
    service.cover_image_url ||
    "/placeholder.png";

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-[var(--supplier-heading,#004e28)]/10 supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] shadow-[0_18px_45px_-32px_color-mix(in_srgb,var(--supplier-shadow,#004e28)_45%,transparent)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_55px_-30px_color-mix(in_srgb,var(--supplier-shadow,#004e28)_50%,transparent)]">
      <div className="relative aspect-square w-full overflow-hidden supplier-surface-page bg-[var(--supplier-page-background,#e9efeb)]">
        <Image
          src={imageUrl}
          alt={`Servicio ${service.title}`}
          fill
          unoptimized
          sizes="(max-width: 640px) calc(100vw - 40px), (max-width: 1024px) 50vw, 384px"
          className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-[1.02]"
        />
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="line-clamp-2 min-h-12 text-lg font-bold leading-snug text-[var(--supplier-heading,#004e28)] font-[family-name:var(--font-varela-round)]">
          {service.title}
        </h3>
        {service.description ? (
          <p className="mt-2 min-h-[4.5rem] line-clamp-3 text-sm leading-6 text-gray-600">
            {service.description}
          </p>
        ) : (
          <div aria-hidden="true" className="mt-2 min-h-[4.5rem]" />
        )}
        {hasPrice ? (
          <p className="mt-3 min-h-6 text-sm font-bold text-[var(--supplier-accent,#168e00)]">
            Desde{" "}
            {new Intl.NumberFormat("es-MX", {
              style: "currency",
              currency: "MXN",
            }).format(price)}
          </p>
        ) : (
          <div aria-hidden="true" className="mt-3 min-h-6" />
        )}
        <Link
          href={demoAgendaHref || `/servicios/${service.id}`}
          className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm font-bold text-[var(--supplier-accent,#168e00)] transition-colors hover:text-[var(--supplier-heading,#004e28)]"
        >
          {demoAgendaHref ? "Probar reservación" : "Ver más"}
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

const appendCatalogParams = (
  params: URLSearchParams,
  filters: CatalogRequestFilters,
) => {
  if (filters.category) params.set("category", filters.category);
  if (filters.subcategory) params.set("subcategory", filters.subcategory);
  if (filters.supplierCategory) {
    params.set("supplier_category", filters.supplierCategory);
  }
  if (filters.supplierSubcategory) {
    params.set("supplier_subcategory", filters.supplierSubcategory);
  }
};

const mergeById = <T extends { id: number | string }>(items: T[]) =>
  [...new Map(items.map((item) => [String(item.id), item])).values()];



import { SupplierProductCarousel } from "@/components/supplier/SupplierProductCarousel";

export default function SupplierPage({ initialSupplier, initialProducts, demoMenus = [], demoServices = [], demoGalleryImages = [], isDemo = false }: {
  initialSupplier: Supplier;
  initialProducts: SupplierProduct[];
  demoMenus?: Menu[];
  demoServices?: SupplierService[];
  demoGalleryImages?: SupplierGalleryImage[];
  isDemo?: boolean;
}) {
  const { slug, tab } = useParams<{ slug: string; tab?: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isBuilderPreview = searchParams.get("builderPreview") === "1";
  const [builderSection, setBuilderSection] = useState<SiteBuilderSection | null>(null);
  const lastBuilderScrollRef = useRef<SiteBuilderSection | null>(null);
  const activeTab = tab === "menu" ? "menu" : tab === "agenda" ? "agenda" : tab === "productos" ? "products" : "main";
  const supplierBasePath = `/${isDemo ? "demos" : "empresas"}/${encodeURIComponent(String(slug))}/`;
  const navigateTab = useCallback((nextTab: 'main' | 'menu' | 'agenda' | 'products', replace = false) => {
    const basePath = nextTab === 'main' ? supplierBasePath : `${supplierBasePath}${nextTab === 'products' ? 'productos' : nextTab}/`;
    const path = isBuilderPreview ? `${basePath}?builderPreview=1` : basePath;
    if (replace) router.replace(path, { scroll: false });
    else router.push(path, { scroll: false });
  }, [isBuilderPreview, router, supplierBasePath]);
  const [supplier, setSupplier] = useState<Supplier | null>(initialSupplier);
  const [publicMenus, setPublicMenus] = useState<Menu[]>(demoMenus);
  const [publicMenusLoading, setPublicMenusLoading] = useState(!isDemo);
  const headerVideoRef = useRef<HTMLVideoElement>(null);
  const supplierViewSentRef = useRef<Set<string>>(new Set());
  const [isHeaderVideoPlaying, setIsHeaderVideoPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [shouldScrollToContact, setShouldScrollToContact] = useState(false);

  useEffect(() => {
    if (!isBuilderPreview) return;
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex,nofollow,noarchive";
    document.head.appendChild(robots);

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      if (event.data?.type !== SITE_BUILDER_UPDATE || !event.data.payload || typeof event.data.payload !== "object") return;
      setSupplier((current) => current ? { ...current, ...event.data.payload } : current);
      const nextSection = typeof event.data.activeSection === "string"
        ? event.data.activeSection as SiteBuilderSection
        : null;
      setBuilderSection(nextSection);

      document.querySelectorAll("[data-builder-active='true']").forEach((element) => {
        element.removeAttribute("data-builder-active");
      });

      if (nextSection) {
        const targetSelector: Partial<Record<SiteBuilderSection, string>> = {
          general: "#inicio",
          appearance: "#inicio",
          header: "#inicio",
          information: "#nosotros",
          hours: "#contacto",
          contact: "#contacto",
          social: "#contacto",
          sections: "#inicio",
          footer: "footer",
        };
        const target = document.querySelector(targetSelector[nextSection] || "#inicio");
        target?.setAttribute("data-builder-active", "true");
        if (lastBuilderScrollRef.current !== nextSection) {
          lastBuilderScrollRef.current = nextSection;
          window.requestAnimationFrame(() => {
            if (nextSection === "footer" && !target) {
              window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
              return;
            }
            target?.scrollIntoView({ behavior: "smooth", block: nextSection === "footer" ? "end" : "start" });
          });
        }
      } else {
        lastBuilderScrollRef.current = null;
      }
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: SITE_BUILDER_READY }, window.location.origin);
    return () => {
      window.removeEventListener("message", onMessage);
      robots.remove();
    };
  }, [isBuilderPreview]);

  const handleShowProducts = () => {
    navigateTab('products');
    tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleContactClick = () => {
    if (activeTab !== 'main') {
      navigateTab('main');
      setShouldScrollToContact(true);
    } else {
      const section = document.getElementById('contacto');
      if (section) {
        const headerOffset = 80;
        const elementPosition = section.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }
  };

  useEffect(() => {
    if (shouldScrollToContact && activeTab === 'main') {
      const timer = setTimeout(() => {
        const section = document.getElementById('contacto');
        if (section) {
          const headerOffset = 80;
          const elementPosition = section.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
        setShouldScrollToContact(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [shouldScrollToContact, activeTab]);

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

  const [products, setProducts] = useState<SupplierProduct[]>(initialProducts);
  const [productCatalog, setProductCatalog] = useState<SupplierProduct[]>(isDemo ? initialProducts : []);
  const [services, setServices] = useState<SupplierService[]>(demoServices);
  const [serviceCatalog, setServiceCatalog] = useState<SupplierService[]>(demoServices);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 50;
  const [hasMore, setHasMore] = useState(false);
  const [selectedProductCategory, setSelectedProductCategory] = useState<CatalogFilterOption | null>(null);
  const [selectedProductSubcategory, setSelectedProductSubcategory] = useState<CatalogFilterOption | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [debouncedProductSearch, setDebouncedProductSearch] = useState("");
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<CatalogFilterOption | null>(null);
  const [selectedServiceSubcategory, setSelectedServiceSubcategory] = useState<CatalogFilterOption | null>(null);
  const [serviceSearchQuery, setServiceSearchQuery] = useState("");
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
  const setDirectoryMode = useSupplierPageModeStore((state) => state.setDirectoryMode);
  const setHideForDirectory = useChromeVisibilityStore((state) => state.setHideForDirectory);
  const resetChromeVisibility = useChromeVisibilityStore((state) => state.reset);
  
  const observerTarget = useRef<HTMLDivElement | null>(null);
  const supplierId = supplier?.id ?? null;
  const supplierSlug = supplier?.slug ?? null;
  const supplierIsDirectory = supplierHasDirectorySubscription(supplier);

  const productCategories = useMemo(
    () => buildCatalogFilterOptions(productCatalog),
    [productCatalog],
  );
  const serviceCategories = useMemo(
    () => buildCatalogFilterOptions(serviceCatalog),
    [serviceCatalog],
  );
  useEffect(() => {
    const debounceId = window.setTimeout(
      () => setDebouncedProductSearch(productSearchQuery.trim()),
      350,
    );
    return () => window.clearTimeout(debounceId);
  }, [productSearchQuery]);

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
    if (isDemo) return;
    if (slug) {
      setPage(1);
      setProducts(initialProducts);
      setProductCatalog([]);
      setServices([]);
      setServiceCatalog([]);
      setSelectedProductCategory(null);
      setSelectedProductSubcategory(null);
      setProductSearchQuery("");
      setDebouncedProductSearch("");
      setSelectedServiceCategory(null);
      setSelectedServiceSubcategory(null);
      setServiceSearchQuery("");
    }
  }, [slug, initialProducts, isDemo]);

  useEffect(() => {
    if (!slug || isDemo) return;

    const controller = new AbortController();
    setPublicMenusLoading(true);
    setPublicMenus([]);

    menuService
      .publicList(String(slug), controller.signal)
      .then((menus) => { if (!controller.signal.aborted) setPublicMenus(menus); })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPublicMenus([]);
      })
      .finally(() => { if (!controller.signal.aborted) setPublicMenusLoading(false); });

    return () => controller.abort();
  }, [slug, isDemo]);

  useEffect(() => {
    if (activeTab === "menu" && !publicMenusLoading && publicMenus.length === 0) {
      navigateTab("main", true);
    }
  }, [activeTab, publicMenusLoading, publicMenus.length, navigateTab]);

  useEffect(() => {
    if (activeTab === "products" && supplierId && supplierIsDirectory) {
      navigateTab("main", true);
    }
  }, [activeTab, navigateTab, supplierId, supplierIsDirectory]);

  useEffect(() => {
    if (isDemo) return;
    if (supplierId) {
      // Robust Identifier Logic: Prefer URL slug -> Supplier Slug -> Supplier ID
      const identifier = (slug as string) || supplierSlug || String(supplierId);
      
      if (process.env.NODE_ENV === "development") console.log("Fetching products for identifier:", identifier);
      if (supplierIsDirectory) {
        setProducts([]);
        setProductsLoading(false);
        setHasMore(false);
      }
      fetchRatings(identifier, 0, false);
      if (!supplierIsDirectory) {
        setServices([]);
        setServiceCatalog([]);
        setServicesError(null);
      }
    }
  }, [slug, supplierId, supplierIsDirectory, supplierSlug, isDemo]);

  useEffect(() => {
    if (isBuilderPreview || isDemo) return;
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
  }, [isBuilderPreview, isDemo, supplier?.id]);

  const fetchProducts = useCallback(async (
    supplierSlug: string,
    currentPage: number,
    append = false,
    filters: {
      category: CatalogFilterOption | null;
      subcategory: CatalogFilterOption | null;
      search: string;
    },
    signal?: AbortSignal,
  ) => {
    try {
      setProductsLoading(true);
      setProductsError(null);

      const skip = (currentPage - 1) * limit;
      const variants = catalogRequestVariants(filters.category, filters.subcategory);
      const responses = await Promise.all(
        variants.map((variant) => {
          const params = new URLSearchParams({
            skip: String(skip),
            limit: String(limit),
          });
          if (filters.search) params.set("search", filters.search);
          appendCatalogParams(params, variant);
          return fetch(
            `/proxy/products/by-supplier/${encodeURIComponent(supplierSlug)}?${params.toString()}`,
            { cache: "no-store", signal },
          );
        }),
      );

      if (responses.some((response) => !response.ok)) {
        if (!supplierId) {
          if (!append) setProducts([]);
          setHasMore(false);
          setProductsError("No se pudieron cargar los productos.");
          return;
        }

        const fallbackParams = new URLSearchParams();
        fallbackParams.set("skip", "0");
        fallbackParams.set("limit", "500");
        fallbackParams.set("supplier_id", String(supplierId));

        const fallback = await fetch(`/proxy/products/?${fallbackParams.toString()}`, {
          cache: "no-store",
          signal,
        });

        if (!fallback.ok) {
          if (!append) setProducts([]);
          setHasMore(false);
          setProductsError("No se pudieron cargar los productos.");
          return;
        }

        const fallbackData = await fallback.json();
        const ownProducts = filterProductsByActiveSupplierSubscription(
          unwrapSupplierProducts(fallbackData).filter((product) => Number(product.supplier_id) === supplierId)
        ).filter(
          (product) =>
            matchesCatalogFilters(product, filters.category, filters.subcategory) &&
            (!filters.search ||
              product.title.toLocaleLowerCase("es").includes(
                filters.search.toLocaleLowerCase("es"),
              )),
        );
        const pageStart = (currentPage - 1) * limit;
        const pageItems = ownProducts.slice(pageStart, pageStart + limit);

        syncFavorites(pageItems);
        if (
          currentPage === 1 &&
          !filters.category &&
          !filters.subcategory &&
          !filters.search
        ) {
          setProductCatalog((previous) => mergeById([...previous, ...pageItems]));
        }
        setProducts((prev) =>
          append ? mergeById([...prev, ...pageItems]) : pageItems,
        );
        setHasMore(ownProducts.length > pageStart + limit);
        return;
      }

      const pages = await Promise.all(
        responses.map(async (response) =>
          filterProductsByActiveSupplierSubscription(
            unwrapSupplierProducts(await response.json()),
          ),
        ),
      );
      const newProducts = mergeById(pages.flat());
      
      syncFavorites(newProducts);
      if (
        currentPage === 1 &&
        !filters.category &&
        !filters.subcategory &&
        !filters.search
      ) {
        setProductCatalog((previous) => mergeById([...previous, ...newProducts]));
      }

      setProducts((prev) =>
        append ? mergeById([...prev, ...newProducts]) : newProducts,
      );
      setHasMore(pages.some((items) => items.length === limit));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Error fetching supplier products", error);
      setProductsError("No se pudieron cargar los productos.");
      if (!append) setProducts([]);
      setHasMore(false);
    } finally {
      if (!signal?.aborted) setProductsLoading(false);
    }
  }, [limit, supplierId, syncFavorites]);

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
      const ratingsList = Array.isArray(data.ratings) ? data.ratings : [];

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
    if (!supplierId || supplierIsDirectory || isDemo) return;
    const controller = new AbortController();
    const identifier = String(slug || supplierSlug || supplierId);
    const params = new URLSearchParams({ skip: "0", limit: "500" });

    fetch(
      `/proxy/products/by-supplier/${encodeURIComponent(identifier)}?${params.toString()}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) return [];
        return filterProductsByActiveSupplierSubscription(
          unwrapSupplierProducts(await response.json()),
        );
      })
      .then((items) => {
        if (!controller.signal.aborted && items.length) {
          setProductCatalog((previous) => mergeById([...previous, ...items]));
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Error fetching product filter catalog", error);
        }
      });

    return () => controller.abort();
  }, [slug, supplierId, supplierIsDirectory, supplierSlug, isDemo]);

  useEffect(() => {
    if (!supplierId || supplierIsDirectory || isDemo) return;
    const controller = new AbortController();
    const identifier = String(slug || supplierSlug || supplierId);
    setPage(1);
    setProducts([]);
    setHasMore(false);
    void fetchProducts(
      identifier,
      1,
      false,
      {
        category: selectedProductCategory,
        subcategory: selectedProductSubcategory,
        search: debouncedProductSearch,
      },
      controller.signal,
    );
    return () => controller.abort();
  }, [
    debouncedProductSearch,
    fetchProducts,
    selectedProductCategory,
    selectedProductSubcategory,
    slug,
    supplierId,
    supplierIsDirectory,
    supplierSlug,
    isDemo,
  ]);

  useEffect(() => {
    if (!slug || !supplierId || supplierIsDirectory || page === 1 || isDemo) return;
    const controller = new AbortController();
    const identifier = String(slug || supplierSlug || supplierId);
    void fetchProducts(
      identifier,
      page,
      true,
      {
        category: selectedProductCategory,
        subcategory: selectedProductSubcategory,
        search: debouncedProductSearch,
      },
      controller.signal,
    );
    return () => controller.abort();
  }, [
    debouncedProductSearch,
    fetchProducts,
    page,
    selectedProductCategory,
    selectedProductSubcategory,
    slug,
    supplierId,
    supplierIsDirectory,
    supplierSlug,
    isDemo,
  ]);

  useEffect(() => {
    if (!supplierId || !supplierIsDirectory || isDemo) return;
    let active = true;
    const variants = catalogRequestVariants(
      selectedServiceCategory,
      selectedServiceSubcategory,
    );

    setServicesLoading(true);
    setServicesError(null);
    setServices([]);

    Promise.all(
      variants.map((variant) =>
        servicesService.listPublic({
          ...(supplierSlug ? { supplierSlug } : { supplierId }),
          ...variant,
          skip: 0,
          limit: 100,
        }),
      ),
    )
      .then((pages) => {
        if (!active) return;
        const items = mergeById(pages.flat());
        setServices(items);
        if (!selectedServiceCategory) setServiceCatalog(items);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setServices([]);
        setServicesError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudieron cargar los servicios.",
        );
      })
      .finally(() => {
        if (active) setServicesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    selectedServiceCategory,
    selectedServiceSubcategory,
    slug,
    supplierId,
    supplierIsDirectory,
    supplierSlug,
    isDemo,
  ]);

    const [logoError, setLogoError] = useState(false);
    const [introError, setIntroError] = useState(false);

  const getImageUrl = (path: string | null) => {
    if (!path) return "/placeholder.png";
    if (path.startsWith('http')) return path;
    const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://drooopy.com/api').replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`.replace(/([^:])\/{2,}/g, '$1/');
  };

  const sanitizeHtml = (html: string) => {
    if (!html) return "";
    return DOMPurify.sanitize(html.replace(/&nbsp;|&#160;|&#x[aA]0;|\u00a0/gi, " "));
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
  const isDirectory = supplierIsDirectory;

  const filteredServices = (isDemo ? demoServices : services).filter((service) =>
    (!isDemo || matchesCatalogFilters(service, selectedServiceCategory, selectedServiceSubcategory)) &&
    (!serviceSearchQuery || service.title.toLocaleLowerCase("es").includes(serviceSearchQuery.toLocaleLowerCase("es"))),
  );
  const visibleProducts = isDemo
    ? initialProducts.filter((product) =>
        matchesCatalogFilters(product, selectedProductCategory, selectedProductSubcategory) &&
        (!debouncedProductSearch || product.title.toLocaleLowerCase("es").includes(debouncedProductSearch.toLocaleLowerCase("es"))),
      )
    : products;
  const changeProductCategory = (category: CatalogFilterOption | null) => {
    setSelectedProductCategory(category);
    setSelectedProductSubcategory(null);
    setPage(1);
    setProducts([]);
    setHasMore(false);
  };
  const changeProductSubcategory = (subcategory: CatalogFilterOption | null) => {
    setSelectedProductSubcategory(subcategory);
    setPage(1);
    setProducts([]);
    setHasMore(false);
  };
  const changeServiceCategory = (category: CatalogFilterOption | null) => {
    setSelectedServiceCategory(category);
    setSelectedServiceSubcategory(null);
    setServices([]);
  };
  const changeServiceSubcategory = (subcategory: CatalogFilterOption | null) => {
    setSelectedServiceSubcategory(subcategory);
    setServices([]);
  };
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
      !["más que un proveedor,", "más que un negocio,"].includes(
        supplier.title_about.trim().toLowerCase(),
      ),
  );
  const hasCustomAboutSubtitle = Boolean(
    supplier?.subtitle_about?.trim() &&
      supplier.subtitle_about.trim().toLowerCase() !== "tu aliado estratégico.",
  );
  const hasAboutContent = Boolean(
    supplier?.about ||
      supplier?.about_media ||
      hasCustomAboutTitle ||
      hasCustomAboutSubtitle,
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

  if (!supplier) return null;

  const sectionFocusClass = (sections: SiteBuilderSection[]) =>
    isBuilderPreview && builderSection && sections.includes(builderSection)
      ? "ring-1 ring-inset ring-[var(--supplier-outline,#168e00)]"
      : "";

  return (
    <SupplierTheme supplier={supplier} className="min-h-screen font-sans">

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
        className={`supplier-media group relative w-full scroll-mt-20 overflow-hidden bg-black ${sectionFocusClass(["general", "appearance", "header"])} ${
          isDirectory
            ? "min-h-[calc(100svh-4rem)] xl:min-h-0"
            : "min-h-[100svh] xl:min-h-0 xl:pt-24"
        }`}
      >
         {/* Shared media canvas: 2100 × 740 on wide desktop for both modes. */}
         <div
           className={`absolute inset-0 overflow-hidden xl:inset-x-0 xl:bottom-auto xl:aspect-[2100/740] xl:h-auto ${
             isDirectory ? "xl:top-0" : "xl:top-24"
           }`}
         >
           {supplier.header_media_type === 'video' && supplier.header_video ? (
               <video
                 ref={headerVideoRef}
                 src={getImageUrl(supplier.header_video)}
                 autoPlay
                 muted={isMuted}
                 loop
                 playsInline
                 className="absolute inset-0 h-full w-full scale-105 object-cover opacity-90 transition-transform duration-[30s] ease-linear group-hover:scale-100"
               />
           ) : (
               <Carousel images={(supplier.carousel_images || []).slice(0, 3)} />
           )}

           {/* Soft readability overlay without tinting the media */}
           <div className="absolute inset-0 z-10 bg-black/40 md:bg-gradient-to-r md:from-black/70 md:via-black/20 md:to-transparent" />
           <div className="absolute inset-x-0 bottom-0 z-10 h-32 bg-gradient-to-t from-black/40 to-transparent md:h-56" />

           {/* Audio Toggle */}
           {supplier.header_media_type === 'video' && supplier.header_video && (
               <button
                  onClick={toggleMute}
                  className="absolute bottom-6 right-6 z-40 rounded-full border border-white/20 bg-black/40 p-3 text-[color:var(--supplier-inverse,#ffffff)] backdrop-blur-md transition-all hover:scale-110 hover:bg-black/60"
                  aria-label={isMuted ? "Activar sonido" : "Silenciar"}
               >
                   {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
               </button>
           )}
         </div>

         {/* Content */}
         <div
           className={`relative z-20 flex flex-col items-center justify-center px-5 py-10 text-center sm:py-12 md:px-8 md:py-14 md:text-left ${
             isDirectory
               ? "min-h-[calc(100svh-4rem)]"
               : "min-h-[100svh] pt-28 md:pt-36"
           } xl:aspect-[2100/740] xl:min-h-0 xl:py-8 ${
             hasHeroHighlights ? "pb-32 md:pb-28 xl:pb-8" : ""
           }`}
         >
             <div className="animate-in fade-in slide-in-from-left-10 mx-auto w-full max-w-6xl duration-1000">
                {supplierLogo && !logoError && (
                    <div className="mx-auto mb-5 h-[clamp(4.5rem,11svh,7rem)] w-[clamp(4.5rem,11svh,7rem)] rounded-2xl border border-white/20 bg-[var(--supplier-card-background,#ffffff)]/10 p-3 shadow-2xl backdrop-blur-md sm:mb-6 md:mx-0 md:rounded-3xl">
                        <img src={getImageUrl(supplierLogo)} alt={supplier.name} className="w-full h-full object-contain drop-shadow-md" onError={() => setLogoError(true)} />
                    </div>
                )}
                
                <h1 className={`mb-5 max-w-full break-words font-black uppercase leading-[0.92] tracking-[-0.045em] text-[color:var(--supplier-inverse,#ffffff)] drop-shadow-2xl font-[family-name:var(--font-varela-round)] sm:mb-6 ${
                  isDirectory
                    ? "text-[clamp(2.5rem,min(6vw,11svh),6rem)]"
                    : "text-[clamp(2.5rem,min(5.25vw,10svh),5.5rem)]"
                }`}>
                   {supplier.name}
                </h1>
                
                {supplier.short_description ? (
                  <p className="mx-auto mb-7 max-w-3xl border-l-0 border-[var(--supplier-outline,#168e00)] pl-0 text-[clamp(1rem,min(1.45vw,2.8svh),1.35rem)] font-light leading-relaxed text-gray-100 drop-shadow-lg font-[family-name:var(--font-poppins)] sm:mb-8 md:mx-0 md:border-l-4 md:pl-6">
                    {supplier.short_description}
                  </p>
                ) : null}

                <div className="mb-6 flex w-full flex-col flex-wrap items-stretch justify-center gap-3 sm:mb-8 sm:flex-row sm:items-center sm:gap-4 md:justify-start">
                      {!isDirectory ? (
                        <Link href={`${supplierBasePath}productos/`} onClick={(event) => { event.preventDefault(); handleShowProducts(); }} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full supplier-surface-primary bg-[var(--supplier-primary-action,#168e00)] px-7 py-3 text-base font-bold text-[color:var(--supplier-inverse,#ffffff)] shadow-[0_0_30px_-5px_color-mix(in_srgb,var(--supplier-shadow,#004e28)_60%,transparent)] transition-all hover:-translate-y-1 hover:bg-[var(--supplier-primary-hover,#137a00)] hover:shadow-[0_0_40px_-5px_color-mix(in_srgb,var(--supplier-shadow,#004e28)_80%,transparent)] font-[family-name:var(--font-varela-round)] sm:w-auto sm:px-8 sm:text-lg">
                            Ver Catálogo <ArrowDown size={20} />
                        </Link>
                      ) : null}
                      {isDirectory ? (
                        <DirectoryContactButton
                          supplierId={supplier.id}
                          supplierName={supplier.name}
                          supplierSlug={supplier.slug}
                          supplierImage={supplierLogo}
                          returnPath={supplierBasePath}
                        />
                      ) : null}
                      {hasContactSection ? (
                        <button type="button" onClick={handleContactClick} className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-white/30 bg-[var(--supplier-card-background,#ffffff)]/10 px-7 py-3 text-base font-bold text-[color:var(--supplier-inverse,#ffffff)] backdrop-blur-md transition-all hover:-translate-y-1 hover:bg-[var(--supplier-card-background,#ffffff)]/20 font-[family-name:var(--font-varela-round)] sm:w-auto sm:px-8 sm:text-lg">
                          Contactar Ahora
                        </button>
                      ) : null}
                </div>
             </div>
         </div>

         {/* Floating Stats Bar */}
         {hasHeroHighlights ? (
         <div className="absolute bottom-0 left-0 z-30 w-full border-t border-white/10 bg-black/20 backdrop-blur-xl xl:relative xl:bottom-auto xl:left-auto">
             <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-10 px-5 py-6 md:gap-16 md:px-8">
                 {Number(supplier.rating_count) > 0 && Number(supplier.average_rating) > 0 ? (
                   <div className="text-center md:text-left">
                       <div className="text-3xl font-black text-[var(--supplier-accent,#168e00)] font-[family-name:var(--font-varela-round)]">{supplier.average_rating?.toFixed(1)}</div>
                       <div className="text-[color:var(--supplier-inverse-muted,#ffffff)] text-xs uppercase tracking-widest font-bold">Calificación</div>
                   </div>
                 ) : null}
                 {Number(supplier.sales_count) > 0 ? (
                   <div className="text-center md:text-left">
                       <div className="text-3xl font-black text-[color:var(--supplier-inverse,#ffffff)] font-[family-name:var(--font-varela-round)]">
                         {supplier.sales_count}
                       </div>
                       <div className="text-[color:var(--supplier-inverse-muted,#ffffff)] text-xs uppercase tracking-widest font-bold">
                         Ventas
                       </div>
                   </div>
                 ) : null}
                {supplier.is_verified ? (
                  <div className="flex items-center">
                    <div className="flex items-center gap-3 bg-[var(--supplier-card-background,#ffffff)]/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
                      <div className="w-8 h-8 rounded-full supplier-surface-primary bg-[var(--supplier-primary-action,#168e00)] flex items-center justify-center text-[color:var(--supplier-inverse,#ffffff)]">
                        <Check size={18} strokeWidth={4} />
                      </div>
                      <span className="text-[color:var(--supplier-inverse,#ffffff)] font-bold text-sm uppercase tracking-wider">Empresa Verificada</span>
                    </div>
                  </div>
                ) : null}
             </div>
         </div>
         ) : null}
      </section>

      <SupplierModuleNavigation
        supplierId={supplier.id}
        hasMenu={publicMenus.length > 0}
        isDirectory={isDirectory}
        activeTab={activeTab}
        onChangeTab={navigateTab}
        tabsRef={tabsRef}
        isDemo={isDemo}
        demoHasAgenda={demoServices.length > 0}
      />

      {activeTab === "menu" && publicMenus.length > 0 ? (
        <PublicSupplierMenu menus={publicMenus} supplierName={supplier.name} isDemo={isDemo} />
      ) : null}

      {activeTab === "agenda" ? isDemo ? (
        <DemoSupplierAgendaTab key={`${supplier.slug || String(slug)}:${searchParams.get("service") || ""}`} services={demoServices} supplierName={supplier.name} initialServiceId={searchParams.get("service")} />
      ) : (
        <PublicSupplierAgendaTab
          supplierId={supplier.id}
          businessType={supplier.business_type}
          initialTitle={supplier.agenda_settings?.public_booking_title}
        />
      ) : null}

      {activeTab === "main" && supplier.description?.trim() ? (
        <section
          aria-labelledby="supplier-description-title"
          className="relative overflow-hidden supplier-surface-page bg-gradient-to-b from-[var(--supplier-page-background,#ffffff)] to-[var(--supplier-page-background,#f7f9f8)] py-14 md:py-20"
        >
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <article className="max-w-4xl">
              <span
                aria-hidden="true"
                className="mb-7 block h-1 w-14 rounded-full supplier-surface-primary bg-[var(--supplier-primary-action,#168e00)]"
              />
              <h2
                id="supplier-description-title"
                className="font-[family-name:var(--font-varela-round)] text-3xl font-bold text-[var(--supplier-heading,#004e28)] md:text-5xl"
              >
                Conoce a {supplier.name}
              </h2>
              <div className="ql-snow mt-7 w-full">
                <div
                  className="ql-editor max-w-none p-0 text-base leading-8 text-gray-700 [&_a]:font-semibold [&_a]:text-[var(--supplier-accent,#168e00)] [&_a]:underline-offset-4 [&_a:hover]:underline [&_li]:mb-2 [&_p]:mb-5 [&_p:last-child]:mb-0 md:text-lg md:leading-9"
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

      {isDirectory && activeTab === "main" && (servicesLoading || serviceCatalog.length > 0 || selectedServiceCategory) ? (
        <section
          id="servicios"
          className="relative scroll-mt-20 overflow-hidden supplier-surface-page bg-[var(--supplier-page-background,#f2f3f4)] py-20"
        >
          <div className="pointer-events-none absolute -right-64 -top-64 h-[620px] w-[620px] rounded-full bg-[var(--supplier-primary,#168e00)]/5 blur-3xl" />
          <div className="relative z-10 mx-auto max-w-6xl px-5 md:px-8">
            <div className="mb-10 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <span className="mb-3 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-[var(--supplier-accent,#168e00)]">
                  <BriefcaseBusiness size={17} />
                  Directorio empresarial
                </span>
                <h2 className="font-[family-name:var(--font-varela-round)] text-3xl font-black text-[var(--supplier-heading,#004e28)] md:text-5xl">
                  Servicios
                </h2>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  Conoce las soluciones profesionales disponibles y encuentra
                  la opción adecuada para ti.
                </p>
              </div>

              {serviceCatalog.length > 4 ? (
                <label className="relative block w-full md:w-80">
                  <Search
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    size={19}
                  />
                  <span className="sr-only">Buscar servicios</span>
                  <input
                    value={serviceSearchQuery}
                    onChange={(event) => setServiceSearchQuery(event.target.value)}
                    placeholder="Buscar servicios..."
                    className="w-full rounded-2xl border border-gray-200 supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] py-3.5 pl-11 pr-4 text-sm outline-none transition focus:border-[var(--supplier-outline,#168e00)] focus:ring-4 focus:ring-[var(--supplier-outline,#168e00)]/10"
                  />
                </label>
              ) : null}
            </div>

            <div className="mb-10">
              <SupplierCatalogFilters
                label="servicios"
                categories={serviceCategories}
                selectedCategory={selectedServiceCategory}
                selectedSubcategory={selectedServiceSubcategory}
                onCategoryChange={changeServiceCategory}
                onSubcategoryChange={changeServiceSubcategory}
              />
            </div>

            {servicesLoading ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="aspect-[4/5] animate-pulse rounded-[2rem] supplier-surface-card bg-[var(--supplier-card-background,#ffffff)]"
                  />
                ))}
              </div>
            ) : servicesError ? (
              <div className="rounded-[2rem] supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] px-6 py-14 text-center shadow-sm">
                <p className="font-semibold text-red-600">{servicesError}</p>
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="rounded-[2rem] supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] px-6 py-14 text-center shadow-sm">
                <p className="font-semibold text-gray-500">
                  {serviceSearchQuery
                    ? "No encontramos servicios con esos filtros."
                    : selectedServiceCategory
                      ? "No hay servicios disponibles en esta categoría."
                      : "No hay servicios disponibles en este momento."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 items-stretch gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {filteredServices.map((service) => (
                  <DirectoryServiceCard key={service.id} service={service} demoAgendaHref={isDemo ? `${supplierBasePath}agenda/?service=${encodeURIComponent(service.id)}` : undefined} />
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* --- INTRO SECTION (Directory) --- */}
      {isDirectory && activeTab === "main" && (supplier.intro_title?.trim() || supplier.intro_description?.trim() || supplier.intro_image_url) ? (
        <section
          id="intro"
          className="relative scroll-mt-20 overflow-hidden supplier-surface-secondary bg-[var(--supplier-secondary,#004e28)] py-16 text-[color:var(--supplier-inverse,#ffffff)] md:py-24"
        >
          <div className="pointer-events-none absolute -left-40 top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full bg-[var(--supplier-primary,#168e00)]/15 blur-3xl" />
          <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 md:grid-cols-2 md:px-8">
            <div className="order-2 md:order-1">
              {supplier.intro_title?.trim() ? (
                <h2 className="font-[family-name:var(--font-varela-round)] text-3xl font-black leading-tight md:text-4xl lg:text-5xl">
                  {supplier.intro_title.trim()}
                </h2>
              ) : null}
              {supplier.intro_description?.trim() ? (
                <p className="mt-5 max-w-xl whitespace-pre-line text-base leading-8 text-[color:var(--supplier-inverse-muted,#ffffff)] md:text-lg md:leading-9">
                  {supplier.intro_description.trim()}
                </p>
              ) : null}
            </div>

            {supplier.intro_image_url && !introError ? (
              <div className="order-1 md:order-2">
                <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-3xl border border-white/10 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getImageUrl(supplier.intro_image_url)}
                    alt={supplier.intro_title?.trim() || supplier.name}
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={() => setIntroError(true)}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* --- PRODUCTS SECTION (Tab Content) --- */}
      {!isDirectory && activeTab === 'products' && (
      <section id={isDirectory ? "servicios" : "productos"} className={`relative scroll-mt-20 overflow-hidden ${isDirectory ? "supplier-surface-page bg-[var(--supplier-page-background,#f2f3f4)] py-20" : "supplier-surface-page bg-[var(--supplier-page-background,#f2f3f4)] py-24"}`}>
        {/* Decorative Background Blob */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[var(--supplier-secondary,#004e28)]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-6xl px-5 md:px-8">
            <div className={`flex flex-col md:flex-row items-center justify-between gap-6 ${isDirectory ? "mb-10" : "mb-16"}`}>
                <div className="max-w-2xl">
                    <h2 className={`${isDirectory ? "text-3xl md:text-4xl" : "text-4xl md:text-5xl"} font-black text-[var(--supplier-heading,#004e28)] mb-4 font-[family-name:var(--font-varela-round)]`}>
                        {isDirectory ? "Servicios" : "Productos"}
                    </h2>
                </div>
                
                {Math.max(productCatalog.length, products.length) > 4 ? (
                <div className="w-full md:w-auto">
                    <div className="relative w-full md:w-96 group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400 group-focus-within:text-[var(--supplier-accent,#168e00)] transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder={isDirectory ? "Buscar servicios..." : "Buscar productos..."}
                            value={productSearchQuery}
                            onChange={(event) => {
                              setProductSearchQuery(event.target.value);
                              setPage(1);
                            }}
                            className="block w-full pl-11 pr-4 py-4 supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] border border-gray-200 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--supplier-outline,#168e00)]/20 focus:border-[var(--supplier-outline,#168e00)] transition-all shadow-sm hover:shadow-md"
                        />
                        {productSearchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                  setProductSearchQuery("");
                                  setPage(1);
                                }}
                                aria-label="Limpiar búsqueda de productos"
                                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            >
                                <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                            </button>
                        )}
                    </div>
                </div>
                ) : null}
            </div>

            <div className="mb-10 md:mb-12">
              <SupplierCatalogFilters
                label="productos"
                categories={productCategories}
                selectedCategory={selectedProductCategory}
                selectedSubcategory={selectedProductSubcategory}
                onCategoryChange={changeProductCategory}
                onSubcategoryChange={changeProductSubcategory}
              />
            </div>

            {productsLoading && products.length === 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                    {[1,2,3,4].map(i => (
                        <div key={i} className="aspect-[4/5] bg-gray-200 rounded-[2rem] animate-pulse" />
                    ))}
                </div>
            ) : productsError ? (
                <div className="text-center py-20 supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] rounded-[3rem] shadow-sm">
                    <p className="text-xl text-red-500 font-bold mb-4">{productsError}</p>
                    <button 
                        onClick={() => void fetchProducts(
                          String(slug || supplier.slug || supplier.id),
                          1,
                          false,
                          {
                            category: selectedProductCategory,
                            subcategory: selectedProductSubcategory,
                            search: debouncedProductSearch,
                          },
                        )}
                        className="px-6 py-3 supplier-surface-secondary bg-[var(--supplier-secondary,#004e28)] text-[color:var(--supplier-inverse,#ffffff)] rounded-full hover:bg-[var(--supplier-primary-action,#168e00)] transition-colors"
                    >
                        Reintentar Carga
                    </button>
                </div>
            ) : !isDirectory && visibleProducts.length === 0 ? (
                <div className="rounded-[3rem] supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] py-20 text-center shadow-sm">
                    <p className="text-xl font-bold text-gray-400">
                      {productSearchQuery
                        ? "No encontramos productos con esos filtros."
                        : selectedProductCategory
                          ? "No hay productos disponibles en esta categoría."
                          : "No hay productos disponibles en este momento."}
                    </p>
                </div>
            ) : (
                <div className={`grid gap-8 md:gap-10 ${isDirectory ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
                    {visibleProducts.map((product) => (
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
                {productsLoading && <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--supplier-heading,#004e28)]" />}
            </div>
        </div>
      </section>
      )}

      {/* --- MAIN TAB CONTENT --- */}
      {activeTab === 'main' && (
      <>
        {/* Recommended Carousels */}
        {!isDirectory ? (
        <div className="mx-auto max-w-6xl space-y-8 bg-gray-50/30 px-5 py-12 md:px-8">
             <SupplierProductCarousel supplierId={supplier.id} kind="most_searched" title="Más Buscados" />
             <SupplierProductCarousel supplierId={supplier.id} kind="most_purchased" title="Más Comprados" />
             <SupplierProductCarousel supplierId={supplier.id} kind="best_rated" title="Mejor Calificados" />
        </div>
        ) : null}

      {(!isDirectory || hasAboutContent) ? (
        <SupplierAboutSection
          supplierName={supplier.name}
          imageUrl={supplier.about_media ? getImageUrl(supplier.about_media) : null}
          title={hasCustomAboutTitle ? supplier.title_about : null}
          subtitle={hasCustomAboutSubtitle ? supplier.subtitle_about : null}
          sanitizedHtml={sanitizeHtml(supplier.about || "")}
          verified={Boolean(supplier.is_verified)}
          className={sectionFocusClass(["information"])}
        />
      ) : null}

      {/* --- CERTIFICATES SECTION --- */}
      {supplier.certificates && supplier.certificates.length > 0 && (
        <section className="py-20 supplier-surface-page bg-[var(--supplier-page-background,#f9fafb)]">
            <div className="mx-auto max-w-6xl px-5 md:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-4xl font-black text-[var(--supplier-heading,#004e28)] mb-4 font-[family-name:var(--font-varela-round)]">
                        {supplier.certificates_title || 'Calidad Certificada'}
                    </h2>
                    {!isDirectory ? (
                      <p className="mx-auto max-w-2xl text-gray-500">
                        Nuestros procesos y productos cumplen con los más altos estándares internacionales.
                      </p>
                    ) : null}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    {supplier.certificates.map((cert) => (
                        <div key={cert.id} className="group relative supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 text-center border border-gray-100">
                            <div className="h-32 mb-4 flex items-center justify-center p-2 bg-gray-50 rounded-xl">
                                <img 
                                    src={getImageUrl(cert.image || cert.image_url || "/placeholder-cert.png")} 
                                    alt={cert.name || "Certificado"} 
                                    className="max-h-full max-w-full object-contain grayscale group-hover:grayscale-0 transition-all duration-500" 
                                />
                            </div>
                            <h3 className="font-bold text-[var(--supplier-heading,#004e28)] mb-1 font-[family-name:var(--font-varela-round)] line-clamp-1">{cert.name || "Certificado"}</h3>
                            <p className="text-xs text-gray-500 line-clamp-2">{cert.description}</p>
                            
                            {/* Zoom Effect Overlay */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center backdrop-blur-sm cursor-pointer">
                                <span className="text-[color:var(--supplier-inverse,#ffffff)] font-bold px-4 py-2 border border-white/30 rounded-full bg-[var(--supplier-card-background,#ffffff)]/10 backdrop-blur-md">
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
        <DirectoryRatingsSection key={`${isDemo ? "demo" : "supplier"}:${supplier.slug || String(slug)}`} slug={supplier.slug || String(slug)} isDemo={isDemo} />
      ) : (
        <section id="experiencia" className="scroll-mt-20 border-t border-gray-100 supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] py-24">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
              <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-8">
                  <div>
                      <h2 className="text-3xl md:text-4xl font-black text-[var(--supplier-heading,#004e28)] mb-2 font-[family-name:var(--font-varela-round)]">
                          Opiniones Verificadas
                      </h2>
                      <div className="flex items-center gap-2 text-[var(--supplier-accent,#168e00)]">
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
                          <div key={rating.id} className="supplier-surface-page bg-[var(--supplier-page-background,#f9fafb)] p-8 rounded-[2rem] relative">
                              <div className="flex items-center gap-4 mb-4">
                                  <div className="w-12 h-12 rounded-full supplier-surface-secondary bg-[var(--supplier-secondary,#004e28)] flex items-center justify-center text-[color:var(--supplier-inverse,#ffffff)] font-bold text-xl">
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
                                    className="w-10 h-10 rounded-lg object-cover supplier-surface-card bg-[var(--supplier-card-background,#ffffff)]"
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
                  <div className="text-center py-16 supplier-surface-page bg-[var(--supplier-page-background,#f9fafb)] rounded-[3rem]">
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
        <DirectoryGallerySection supplierId={supplier.id} initialImages={isDemo ? demoGalleryImages : undefined} />
      ) : null}

      {/* --- CONTACT & MAP (Dark Mode / Expert UI) --- */}
      <section
        id="contacto"
        className={`relative overflow-hidden ${sectionFocusClass(["hours", "contact", "social"])} ${
          useDirectoryPresentation ? "supplier-surface-secondary bg-[var(--supplier-secondary,#004e28)] py-16 md:py-20" : "supplier-surface-secondary bg-[var(--supplier-secondary,#004e28)] py-24 text-[color:var(--supplier-inverse,#ffffff)]"
        }`}
      >
          {/* Background Elements */}
          <div className={`absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] via-transparent to-transparent ${useDirectoryPresentation ? "from-[var(--supplier-primary,#168e00)]/10" : "from-white opacity-10"}`} />
          
          <div className="relative z-10 mx-auto max-w-6xl px-5 md:px-8">
              
              {/* TOP ROW: Info & Hours */}
              <div className={`mb-12 grid grid-cols-1 gap-8 ${hasContactInfo && hasBusinessHours ? "md:grid-cols-2" : ""}`}>
                  {/* Info Card */}
                  {hasContactInfo || hasSocial ? (
                  <div className={`rounded-[2rem] transition-colors ${useDirectoryPresentation ? "overflow-hidden border border-[var(--supplier-heading,#004e28)]/10 supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] shadow-[0_24px_60px_-40px_color-mix(in_srgb,var(--supplier-shadow,#004e28)_70%,transparent)]" : "bg-[var(--supplier-card-background,#ffffff)]/5 backdrop-blur-lg border border-white/10 p-8 hover:bg-[var(--supplier-card-background,#ffffff)]/10"}`}>
                      <h3 className={`text-2xl font-bold font-[family-name:var(--font-varela-round)] flex items-center gap-3 ${useDirectoryPresentation ? "supplier-surface-secondary bg-[var(--supplier-secondary,#004e28)] px-8 py-6 text-[color:var(--supplier-inverse,#ffffff)]" : "mb-6"}`}>
                          <MessageCircle className="text-[var(--supplier-accent,#168e00)]" /> Contáctanos
                      </h3>
                      <div className={`space-y-4 ${useDirectoryPresentation ? "p-8" : ""}`}>
                          {supplier.phone && (
                              <div className="flex min-w-0 items-center gap-4 group">
                                  <div className="w-10 h-10 shrink-0 rounded-full bg-[var(--supplier-primary,#168e00)]/20 flex items-center justify-center group-hover:bg-[var(--supplier-primary-action,#168e00)] transition-colors">
                                      <Phone size={18} className="text-[var(--supplier-accent,#168e00)] group-hover:text-[color:var(--supplier-inverse,#ffffff)]" />
                                  </div>
                                  <span className="min-w-0 break-words text-base font-medium sm:text-lg">{supplier.phone}</span>
                              </div>
                          )}
                          {supplier.email && (
                              <div className="flex min-w-0 items-center gap-4 group">
                                  <div className="w-10 h-10 shrink-0 rounded-full bg-[var(--supplier-primary,#168e00)]/20 flex items-center justify-center group-hover:bg-[var(--supplier-primary-action,#168e00)] transition-colors">
                                      <Mail size={18} className="text-[var(--supplier-accent,#168e00)] group-hover:text-[color:var(--supplier-inverse,#ffffff)]" />
                                  </div>
                                  <span className="min-w-0 break-all text-base font-medium leading-snug sm:text-lg">{supplier.email}</span>
                              </div>
                          )}
                          {supplier.address && (
                              <div className="flex min-w-0 items-center gap-4 group">
                                  <div className="w-10 h-10 shrink-0 rounded-full bg-[var(--supplier-primary,#168e00)]/20 flex items-center justify-center group-hover:bg-[var(--supplier-primary-action,#168e00)] transition-colors">
                                      <MapPin size={18} className="text-[var(--supplier-accent,#168e00)] group-hover:text-[color:var(--supplier-inverse,#ffffff)]" />
                                  </div>
                                  <span className="min-w-0 break-words text-base font-medium sm:text-lg">{supplier.address}</span>
                              </div>
                          )}

                          {hasSocial ? (
                            <div className={`pt-4 mt-2 ${useDirectoryPresentation ? "border-t border-[var(--supplier-heading,#004e28)]/10" : "border-t border-white/10"}`}>
                              <p className={`mb-3 text-xs font-bold uppercase tracking-widest ${useDirectoryPresentation ? "text-[var(--supplier-accent,#168e00)]" : "text-[color:var(--supplier-inverse-muted,#ffffff)]"}`}>
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
                                        ? "bg-[var(--supplier-secondary,#004e28)]/10 text-[var(--supplier-heading,#004e28)] hover:bg-[var(--supplier-secondary,#004e28)] hover:text-[color:var(--supplier-inverse,#ffffff)]"
                                        : "bg-[var(--supplier-card-background,#ffffff)]/10 text-[color:var(--supplier-inverse,#ffffff)] hover:bg-[var(--supplier-card-background,#ffffff)] hover:text-[var(--supplier-heading,#004e28)]"
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
                  <div className={`rounded-[2rem] ${useDirectoryPresentation ? "overflow-hidden border border-[var(--supplier-heading,#004e28)]/10 supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] shadow-[0_24px_60px_-40px_color-mix(in_srgb,var(--supplier-shadow,#004e28)_70%,transparent)]" : "bg-[var(--supplier-card-background,#ffffff)]/5 backdrop-blur-lg border border-white/10 p-8"}`}>
                      <h3 className={`text-2xl font-bold font-[family-name:var(--font-varela-round)] flex items-center gap-3 ${useDirectoryPresentation ? "supplier-surface-secondary bg-[var(--supplier-secondary,#004e28)] px-8 py-6 text-[color:var(--supplier-inverse,#ffffff)]" : "mb-6"}`}>
                          <Clock className="text-[var(--supplier-accent,#168e00)]" /> Horarios de Atención
                      </h3>
                      <div className={`space-y-4 ${useDirectoryPresentation ? "p-8 text-[var(--supplier-muted,#59675f)]" : "text-gray-300"}`}>
                          {groupedHours.map((group, idx) => (
                                  <div key={idx} className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${useDirectoryPresentation ? "rounded-2xl supplier-surface-page bg-[var(--supplier-page-background,#f2f3f4)] px-5 py-4" : "border-b border-white/5 pb-2 last:border-0"}`}>
                                      <span className={useDirectoryPresentation ? "font-semibold text-[var(--supplier-heading,#004e28)]" : ""}>
                                          {group.start === group.end 
                                              ? DAYS_MAP[group.start] 
                                              : `${DAYS_MAP[group.start]} - ${DAYS_MAP[group.end]}`}
                                      </span>
                                      <span className={`font-bold ${useDirectoryPresentation ? "w-fit rounded-xl supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] px-4 py-2 text-[var(--supplier-accent,#168e00)] shadow-sm" : "text-[color:var(--supplier-inverse,#ffffff)]"}`}>
                                          {group.isClosed ? "Cerrado" : `${formatTime(group.open)} - ${formatTime(group.close)}`}
                                      </span>
                                  </div>
                              ))}

                          <div className={`flex items-center gap-3 ${useDirectoryPresentation ? "pt-3" : "mt-4"}`}>
                              {businessStatus.isOpen ? (
                                  <div 
                                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wide text-[color:var(--supplier-inverse,#ffffff)]"
                                    style={{ backgroundColor: "var(--supplier-primary)", color: "var(--supplier-on-primary)" }}
                                  >
                                      <div className="w-2 h-2 rounded-full supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] animate-pulse" />
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
              <div className={`w-full h-[400px] rounded-[2rem] overflow-hidden relative mb-12 group ${useDirectoryPresentation ? "border border-[var(--supplier-heading,#004e28)]/10 supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] shadow-[0_24px_70px_-44px_color-mix(in_srgb,var(--supplier-shadow,#004e28)_70%,transparent)]" : "bg-[var(--supplier-card-background,#ffffff)]/5 backdrop-blur-md border border-white/10 shadow-2xl"}`}>
                  <SupplierLocationMap
                      location={mapLocation}
                      supplierName={supplier.name}
                  />

                  {/* Floating Location Badge */}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${mapLocation.lat},${mapLocation.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-4 left-4 z-[500] flex items-center gap-2 rounded-xl bg-[var(--supplier-card-background,#ffffff)]/90 px-4 py-2 text-sm font-bold text-[var(--supplier-heading,#004e28)] shadow-lg backdrop-blur transition-transform group-hover:scale-105"
                    >
                        <MapPin size={16} /> Ver Ubicación Exacta
                    </a>
              </div>
              ) : null}

              {/* BOTTOM ROW: CTA (Full Width) */}
              {(contactHref || isDirectory) ? (
              <div className="supplier-surface-primary bg-[var(--supplier-primary-action,#168e00)] rounded-[2rem] p-8 md:p-12 text-center relative overflow-hidden shadow-[0_0_50px_-10px_color-mix(in_srgb,var(--supplier-shadow,#004e28)_40%,transparent)]">
                  <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
                  <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                      <div className="text-left">
                          <h3 className="text-2xl md:text-3xl font-black mb-2 font-[family-name:var(--font-varela-round)]">
                            ¿Tienes preguntas sobre nuestros {isDirectory ? "servicios" : "productos"}?
                          </h3>
                          <p className="text-[color:var(--supplier-inverse-muted,#ffffff)] text-lg">Estamos listos para atenderte y resolver todas tus dudas al instante.</p>
                      </div>
                      {isDirectory ? (
                        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                          {supplier.phone ? (
                            <a
                              href={`https://wa.me/${normalizeWhatsAppPhone(supplier.phone)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-14 items-center justify-center gap-2 whitespace-nowrap rounded-full supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] px-8 py-4 text-base font-bold text-[var(--supplier-heading,#004e28)] shadow-xl transition-all hover:-translate-y-1 hover:bg-[var(--supplier-hover-card,#f3f4f6)]"
                            >
                              <Phone size={21} />
                              WhatsApp
                            </a>
                          ) : (
                            <span
                              aria-disabled="true"
                              title="El negocio todavía no ha configurado un número de WhatsApp"
                              className="inline-flex min-h-14 cursor-not-allowed items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/30 bg-[var(--supplier-card-background,#ffffff)]/15 px-8 py-4 text-base font-bold text-[color:var(--supplier-inverse-muted,#ffffff)]"
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
                            returnPath={supplierBasePath}
                            className="inline-flex min-h-14 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/20 supplier-surface-secondary bg-[var(--supplier-secondary,#004e28)] px-8 py-4 text-base font-bold text-[color:var(--supplier-inverse,#ffffff)] shadow-xl transition-all hover:-translate-y-1 hover:bg-[var(--supplier-secondary-hover,#003b1f)] disabled:cursor-wait disabled:opacity-70"
                          />
                        </div>
                      ) : contactHref ? (
                        <a
                          href={contactHref}
                          target={contactHref.startsWith("http") ? "_blank" : undefined}
                          rel={contactHref.startsWith("http") ? "noopener noreferrer" : undefined}
                          className="flex items-center gap-2 whitespace-nowrap rounded-full supplier-surface-card bg-[var(--supplier-card-background,#ffffff)] px-8 py-4 text-lg font-bold text-[var(--supplier-heading,#004e28)] shadow-xl transition-all hover:-translate-y-1 hover:bg-[var(--supplier-hover-card,#f3f4f6)]"
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
    </SupplierTheme>
  );
}
