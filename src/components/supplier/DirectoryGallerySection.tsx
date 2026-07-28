"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Camera, ChevronLeft, ChevronRight, X } from "lucide-react";
import { supplierGalleryService } from "@/services/supplierGalleryService";
import type { SupplierGalleryImage } from "@/types/supplierGallery";

interface DirectoryGallerySectionProps {
  supplierId: number;
}

const buildImageUrl = (path: string | null | undefined): string => {
  if (!path) return "/placeholder.png";
  if (path.startsWith("http")) return path;
  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api").replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`.replace(/([^:])\/{2,}/g, "$1/");
};

export function DirectoryGallerySection({ supplierId }: DirectoryGallerySectionProps) {
  const [images, setImages] = useState<SupplierGalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    supplierGalleryService
      .list(supplierId)
      .then((items) => {
        if (cancelled) return;
        setImages(items);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setImages([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudo cargar la galería.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supplierId]);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const goToPrevious = useCallback(() => {
    setLightboxIndex((current) => {
      if (current === null || images.length === 0) return current;
      return (current - 1 + images.length) % images.length;
    });
  }, [images.length]);

  const goToNext = useCallback(() => {
    setLightboxIndex((current) => {
      if (current === null || images.length === 0) return current;
      return (current + 1) % images.length;
    });
  }, [images.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") goToPrevious();
      if (event.key === "ArrowRight") goToNext();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightboxIndex, closeLightbox, goToPrevious, goToNext]);

  // No renderizar nada si está loading sin error y no hay imágenes aún
  if (loading && images.length === 0 && !error) return null;
  if (error) return null;
  if (images.length === 0) return null;

  return (
    <section
      id="galeria"
      className="relative scroll-mt-20 overflow-hidden bg-white py-16 md:py-24"
    >
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="mb-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="mb-3 inline-flex items-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-[#168e00]">
              <Camera size={17} />
              Nuestra galería
            </span>
            <h2 className="font-[family-name:var(--font-varela-round)] text-3xl font-black text-[#004e28] md:text-4xl lg:text-5xl">
              Conoce nuestro trabajo
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-gray-600">
              Una muestra visual de lo que hacemos. Toca cualquier imagen para verla en grande.
            </p>
          </div>
        </div>

        <div
          className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4"
          style={{ columnFill: "balance" }}
        >
          {images.map((image, index) => {
            const url = buildImageUrl(image.image_url);
            return (
              <button
                key={image.id}
                type="button"
                onClick={() => setLightboxIndex(index)}
                className="group mb-4 block w-full overflow-hidden rounded-2xl bg-[#e9efeb] break-inside-avoid focus:outline-none focus:ring-4 focus:ring-[#168e00]/30"
                aria-label={`Ver imagen ${index + 1} en grande`}
              >
                <Image
                  src={url}
                  alt={`Galería imagen ${index + 1}`}
                  width={800}
                  height={600}
                  unoptimized
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  className="h-auto w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
              </button>
            );
          })}
        </div>
      </div>

      {lightboxIndex !== null && images[lightboxIndex] ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/90 p-4 md:p-8"
          onClick={closeLightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada de imagen"
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              closeLightbox();
            }}
            className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label="Cerrar"
          >
            <X size={22} />
          </button>

          {images.length > 1 ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  goToPrevious();
                }}
                className="absolute left-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
                aria-label="Imagen anterior"
              >
                <ChevronLeft size={26} />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  goToNext();
                }}
                className="absolute right-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40"
                aria-label="Siguiente imagen"
              >
                <ChevronRight size={26} />
              </button>
            </>
          ) : null}

          <figure
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={buildImageUrl(images[lightboxIndex].image_url)}
              alt={`Galería imagen ${lightboxIndex + 1}`}
              className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
            />
            <figcaption className="mt-3 text-center text-sm text-white/70">
              {lightboxIndex + 1} / {images.length}
            </figcaption>
          </figure>
        </div>
      ) : null}
    </section>
  );
}
