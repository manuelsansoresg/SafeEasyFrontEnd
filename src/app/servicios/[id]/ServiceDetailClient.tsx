"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import type { SupplierService } from "@/types/services";
import { DirectoryContactButton } from "@/components/supplier/DirectoryContactButton";

export interface ServiceSupplierSummary {
  id: number;
  name: string;
  slug: string | null;
  logo?: string | null;
}

export default function ServiceDetailClient({
  service,
  initialSupplier,
}: {
  service: SupplierService;
  initialSupplier: ServiceSupplierSummary | null;
}) {
  const [supplier, setSupplier] = useState<ServiceSupplierSummary | null>(initialSupplier);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (initialSupplier) return;
    let cancelled = false;
    fetch(`/proxy/suppliers/${service.supplier_id}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((supplierData) => {
        if (!cancelled && supplierData) setSupplier(supplierData);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [initialSupplier, service.supplier_id]);

  const images = useMemo(() => [...service.images].sort((a, b) => {
    if (a.is_cover) return -1;
    if (b.is_cover) return 1;
    return a.position - b.position;
  }), [service.images]);

  const currentImage =
    images[activeImage]?.image_url ||
    service.cover_image_url ||
    "/placeholder.png";
  const price = Number(service.price);
  const hasPrice = Number.isFinite(price) && price > 0;

  return (
    <main className="min-h-screen bg-[#f2f3f4] pb-20 pt-28 md:pt-32">
      <div className="mx-auto max-w-5xl px-5 md:px-8">
        <Link
          href={`/empresas/${supplier?.slug || service.supplier_id}#servicios`}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#004e28] transition hover:text-[#168e00]"
        >
          <ArrowLeft size={17} />
          Volver al proveedor
        </Link>

        <article className="overflow-hidden rounded-[2rem] border border-[#004e28]/10 bg-white shadow-[0_28px_80px_-52px_rgba(0,78,40,0.7)]">
          <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(380px,1.1fr)] lg:items-center">
            <section className="flex flex-col border-b border-gray-100 p-4 sm:p-6 lg:border-b-0 lg:border-r lg:p-8">
              <div className="relative mx-auto aspect-square w-full max-w-[380px] overflow-hidden rounded-[1.5rem] bg-[#e9efeb]">
                <Image
                  src={currentImage}
                  alt={service.title}
                  fill
                  unoptimized
                  priority
                  sizes="(max-width: 640px) calc(100vw - 48px), 380px"
                  className="object-contain"
                />
                {images.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveImage(
                          (current) =>
                            (current - 1 + images.length) % images.length,
                        )
                      }
                      className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#004e28] shadow-lg backdrop-blur transition hover:bg-white"
                      aria-label="Imagen anterior"
                    >
                      <ChevronLeft size={21} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveImage(
                          (current) => (current + 1) % images.length,
                        )
                      }
                      className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#004e28] shadow-lg backdrop-blur transition hover:bg-white"
                      aria-label="Imagen siguiente"
                    >
                      <ChevronRight size={21} />
                    </button>
                  </>
                ) : null}
              </div>

              {images.length > 1 ? (
                <div className="mx-auto mt-4 grid w-full max-w-[380px] grid-cols-5 gap-2">
                  {images.map((image, index) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setActiveImage(index)}
                      className={`relative aspect-square overflow-hidden rounded-xl border-2 bg-[#f2f3f4] transition ${
                        activeImage === index
                          ? "border-[#168e00]"
                          : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                    >
                      <Image
                        src={image.thumbnail_url || image.image_url}
                        alt={`Vista ${index + 1}`}
                        fill
                        unoptimized
                        sizes="100px"
                        className="object-contain"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="flex flex-col justify-center p-6 sm:p-9 lg:p-10 xl:p-12">
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#168e00]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#168e00]">
                <CheckCircle2 size={15} />
                Servicio disponible
              </span>
              <h1 className="mt-6 font-[family-name:var(--font-varela-round)] text-3xl font-black leading-tight text-[#004e28] sm:text-4xl">
                {service.title}
              </h1>
              {supplier?.name ? (
                <p className="mt-3 text-base font-semibold text-[#168e00]">
                  Por {supplier.name}
                </p>
              ) : null}

              {hasPrice ? (
                <div className="mt-9 border-t border-gray-100 pt-7">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">
                    Precio desde
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-varela-round)] text-3xl font-black text-[#168e00]">
                    {new Intl.NumberFormat("es-MX", {
                      style: "currency",
                      currency: "MXN",
                    }).format(price)}
                  </p>
                </div>
              ) : null}

              <div className={hasPrice ? "mt-7" : "mt-9"}>
                <DirectoryContactButton
                  supplierId={service.supplier_id}
                  supplierName={supplier?.name}
                  supplierSlug={supplier?.slug}
                  supplierImage={supplier?.logo}
                  returnPath={`/servicios/${service.id}`}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#004e28] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#004e28]/15 transition hover:-translate-y-0.5 hover:bg-[#168e00] disabled:cursor-wait disabled:opacity-70"
                />
              </div>
              <Link
                href={`/empresas/${supplier?.slug || service.supplier_id}#contacto`}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center text-sm font-semibold text-[#004e28] transition hover:text-[#168e00]"
              >
                Ver datos del proveedor
              </Link>
            </section>
          </div>

          {service.description?.trim() ? (
            <section className="border-t border-[#004e28]/10 bg-gradient-to-b from-white to-[#f8faf9] px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
              <div className="max-w-3xl">
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#168e00]">
                  Detalles del servicio
                </span>
                <h2 className="mt-3 font-[family-name:var(--font-varela-round)] text-2xl font-black text-[#004e28] sm:text-3xl">
                  Sobre este servicio
                </h2>
                <p className="mt-6 whitespace-pre-line text-base leading-8 text-gray-600 sm:text-lg sm:leading-9">
                  {service.description.trim()}
                </p>
              </div>
            </section>
          ) : null}
        </article>
      </div>
    </main>
  );
}
