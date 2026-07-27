"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle, Heart } from "lucide-react";
import Image from "next/image";
import { useAuthStore } from "@/store/useAuthStore";
import { useFavoritesStore } from "@/store/useFavoritesStore";
import { Toast } from "@/components/ui/Toast";
import { useEffect } from "react";
import { SearchDirectory } from "@/lib/search";

interface DirectoryCardProps {
  directory: SearchDirectory;
}

const getImageUrl = (path: string | null | undefined) => {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("https")) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api").replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`.replace(/([^:])\/{2,}/g, "$1/");
};

const fallbackLogo = "/placeholder.png";

export function DirectoryCard({ directory }: DirectoryCardProps) {
  const slug = String(directory.slug || "").trim();
  const href = slug ? `/empresas/${slug}` : "/empresas";
  const isVerified = directory.is_verified === true;
  const cityLabel = [directory.city, directory.state].filter(Boolean).join(", ");

  const { isAuthenticated } = useAuthStore();
  const { isFavorite, toggleFavorite } = useFavoritesStore();
  const favKey = `directory-${directory.id}`;
  const isFav = isFavorite(favKey);
  const [toast, setToast] = useState<null | { type: "success" | "error" | "info"; message: string }>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      setToast({ type: "info", message: "Debes iniciar sesión para agregar a favoritos." });
      return;
    }
    try {
      await toggleFavorite(favKey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo actualizar favoritos.";
      setToast({ type: "error", message: msg });
    }
  };

  const logoUrl = getImageUrl(directory.logo) || fallbackLogo;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#004e28]/10 bg-white shadow-[0_18px_50px_-34px_rgba(0,78,40,0.45)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-30px_rgba(0,78,40,0.55)]">
      {toast ? (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      ) : null}

      <Link href={href} className="flex flex-col h-full" aria-label={`Ver directorio ${directory.name}`}>
        <div className="relative aspect-square overflow-hidden bg-[#e9efeb]">
          <Image
            src={logoUrl}
            alt={directory.name}
            fill
            unoptimized
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-6 transition-transform duration-700 group-hover:scale-105"
          />
          <button
            type="button"
            onClick={handleFavoriteClick}
            className="absolute top-3 right-3 grid place-items-center w-9 h-9 rounded-full bg-white/90 backdrop-blur shadow hover:bg-white transition-colors"
            aria-label={isFav ? "Quitar de favoritos" : "Agregar a favoritos"}
          >
            <Heart
              size={18}
              className={isFav ? "text-red-500" : "text-gray-500"}
              fill={isFav ? "currentColor" : "none"}
            />
          </button>
          {isVerified ? (
            <div className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-[#168e00] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow">
              <CheckCircle size={12} strokeWidth={3} />
              Verificado
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-1 p-4">
          <h3 className="text-base font-bold text-[#004e28] font-[family-name:var(--font-varela-round)] line-clamp-2">
            {directory.name}
          </h3>
          {cityLabel ? (
            <p className="text-xs text-gray-500 line-clamp-1">{cityLabel}</p>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
