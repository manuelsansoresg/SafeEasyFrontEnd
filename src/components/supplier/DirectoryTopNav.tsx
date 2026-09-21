"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface DirectoryTopNavProps {
  supplierName: string;
  logoUrl: string | null;
  showAbout: boolean;
  showServices: boolean;
}

const getImageUrl = (path: string | null): string | null => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api").replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`.replace(/([^:])\/{2,}/g, "$1/");
};

export function DirectoryTopNav({
  supplierName,
  logoUrl,
  showAbout,
  showServices,
}: DirectoryTopNavProps) {
  const fullLogoUrl = getImageUrl(logoUrl);

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#004e28] text-white shadow-md backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-5 md:px-8">
        {/* Logo + nombre del proveedor */}
        <Link
          href="#inicio"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 transition-opacity hover:opacity-90 sm:gap-3 lg:max-w-sm lg:flex-none"
        >
          {fullLogoUrl ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fullLogoUrl}
                alt={supplierName}
                className="h-full w-full object-contain"
              />
            </div>
          ) : null}
          <span className="truncate font-[family-name:var(--font-varela-round)] text-sm font-bold sm:text-base lg:text-lg">
            {supplierName}
          </span>
        </Link>

        {/* Anchor links — desktop */}
        <div className="hidden items-center gap-5 text-sm font-semibold lg:flex xl:gap-7">
          <a
            href="#inicio"
            className="text-white/85 transition-colors hover:text-white"
          >
            Inicio
          </a>
          {showAbout ? (
            <a
              href="#nosotros"
              className="text-white/85 transition-colors hover:text-white"
            >
              Nosotros
            </a>
          ) : null}
          {showServices ? (
            <a
              href="#servicios"
              className="text-white/85 transition-colors hover:text-white"
            >
              Servicios
            </a>
          ) : null}
          <a
            href="#contacto"
            className="text-white/85 transition-colors hover:text-white"
          >
            Contacto
          </a>
        </div>

        {/* Volver a Drooopy */}
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-white/20 sm:text-sm"
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Volver a Drooopy</span>
          <span className="sm:hidden">Drooopy</span>
        </Link>
      </div>
    </nav>
  );
}
