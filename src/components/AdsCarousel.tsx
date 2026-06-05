"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PublicAd {
  id: number;
  link_url?: string | null;
  city?: string | null;
  state?: string | null;
  is_active?: boolean;
  image_desktop?: string | null;
  image_mobile?: string | null;
}

interface AdsCarouselProps {
  enableNavigation?: boolean;
}

const ROTATE_INTERVAL = 6000;

export function AdsCarousel({ enableNavigation = true }: AdsCarouselProps) {
  const [ads, setAds] = useState<PublicAd[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchAds = async () => {
      try {
        console.log("AdsCarousel: Fetching ads...");
        const res = await fetch("/api/ads/public", { cache: "no-store" });
        console.log(`AdsCarousel: status ${res.status}`);
        
        if (!res.ok) {
          console.warn(`AdsCarousel: Failed to fetch ads (${res.status})`);
          setAds([]);
          return;
        }
        
        const text = await res.text();
        if (!text) {
             console.warn("AdsCarousel: Empty response");
             setAds([]);
             return;
        }
        
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.warn("AdsCarousel: JSON parse error", e, text.substring(0, 100));
            setAds([]);
            return;
        }
        
        let adsList: PublicAd[] = [];
        
        if (Array.isArray(data)) {
            adsList = data;
        } else if (data && typeof data === 'object') {
             // Handle wrapped responses
             if (Array.isArray((data as any).items)) adsList = (data as any).items;
             else if (Array.isArray((data as any).results)) adsList = (data as any).results;
             else if (Array.isArray((data as any).data)) adsList = (data as any).data;
             else if (Array.isArray((data as any).ads)) adsList = (data as any).ads;
        }

        const activeAds = adsList.filter((a: PublicAd) => a && a.is_active !== false);
        console.log(`AdsCarousel: Found ${activeAds.length} active ads`);
        setAds(activeAds);
      } catch (e) {
        console.warn("AdsCarousel: Error fetching ads", e);
        setAds([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAds();
  }, []);

  useEffect(() => {
    if (!ads.length) return;
    const id = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, ROTATE_INTERVAL);
    return () => window.clearInterval(id);
  }, [ads]);

  const computeImageUrl = (path?: string | null) => {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
    // Normalize base URL to remove trailing slashes
    const baseUrl = base.replace(/\/+$/, "");
    // Ensure path starts with slash
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    // Construct and fix double slashes
    return `${baseUrl}${cleanPath}`.replace(/([^:])\/{2,}/g, '$1/');
  };

  const currentAd = ads[currentIndex];

  const handleClick = () => {
    // if (!enableNavigation) return;
    // router.push("/recomendados?kind=most_searched");
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ads.length) return;
    setCurrentIndex((prev) => (prev - 1 + ads.length) % ads.length);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ads.length) return;
    setCurrentIndex((prev) => (prev + 1) % ads.length);
  };

  if (loading && !ads.length) {
    return (
      <div className="w-full rounded-2xl bg-gray-100 animate-pulse mb-6 aspect-[16/7] md:aspect-[16/6]" />
    );
  }

  if (!currentAd) {
    return (
      <div className="w-full rounded-2xl bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 mb-6 aspect-[16/7] md:aspect-[16/6]" />
    );
  }

  const desktopSrc = computeImageUrl(currentAd.image_desktop || currentAd.image_mobile);
  const mobileSrc = computeImageUrl(currentAd.image_mobile || currentAd.image_desktop);
  const fallbackSrc = mobileSrc || desktopSrc;

  return (
    <div
      className="relative w-full mb-6 rounded-2xl overflow-hidden bg-gray-100 aspect-[16/7] md:aspect-[16/6]"
      onClick={handleClick}
    >
      <picture>
        {desktopSrc && (
          <source
            media="(min-width: 768px)"
            srcSet={desktopSrc}
          />
        )}
        {fallbackSrc && (
          <img
            src={fallbackSrc}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
      </picture>

      {ads.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1.5 shadow-md"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-1.5 shadow-md"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {ads.map((ad, idx) => (
              <span
                key={ad.id}
                className={`w-2 h-2 rounded-full ${
                  idx === currentIndex ? "bg-white" : "bg-white/40"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
