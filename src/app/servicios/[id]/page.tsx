"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { servicesService } from "@/services/servicesService";
import type { SupplierService } from "@/types/services";
import { DirectoryContactButton } from "@/components/supplier/DirectoryContactButton";

interface ServiceSupplierSummary {
  id: number;
  name: string;
  slug: string | null;
  logo?: string | null;
}

export default function PublicServicePage() {
  const params = useParams<{ id: string }>();
  const [service, setService] = useState<SupplierService | null>(null);
  const [supplier, setSupplier] = useState<ServiceSupplierSummary | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    servicesService
      .getPublic(params.id)
      .then((data) => {
        if (!cancelled) {
          setService(data);
          fetch(`/proxy/suppliers/${data.supplier_id}`, { cache: "no-store" })
            .then((response) => (response.ok ? response.json() : null))
            .then((supplierData) => {
              if (!cancelled && supplierData) setSupplier(supplierData);
            })
            .catch(() => undefined);
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "No se pudo cargar el servicio.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const images = useMemo(() => {
    if (!service) return [];
    return [...service.images].sort((a, b) => {
      if (a.is_cover) return -1;
      if (b.is_cover) return 1;
      return a.position - b.position;
    });
  }, [service]);

  if (loading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#f2f3f4]">
        <Loader2 className="animate-spin text-[#168e00]" size={38} />
      </main>
    );
  }

  if (error || !service) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#f2f3f4] px-5">
        <div className="max-w-lg rounded-[2rem] bg-white p-10 text-center shadow-sm">
          <BriefcaseBusiness className="mx-auto text-gray-300" size={44} />
          <h1 className="mt-4 font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28]">
            Servicio no disponible
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {error ?? "No encontramos el servicio solicitado."}
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#004e28] px-5 py-3 text-sm font-semibold text-white"
          >
            <ArrowLeft size={17} />
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  const currentImage =
    images[activeImage]?.image_url ||
    service.cover_image_url ||
    "/placeholder.png";
  const price = Number(service.price);
  const hasPrice = Number.isFinite(price) && price > 0;

  return (
    <main className="min-h-screen bg-[#f2f3f4] pb-20 pt-28 md:pt-32">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <Link
          href={`/empresas/${supplier?.slug || service.supplier_id}#servicios`}
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#004e28] transition hover:text-[#168e00]"
        >
          <ArrowLeft size={17} />
          Volver al proveedor
        </Link>

        <article className="grid overflow-hidden rounded-[2rem] border border-[#004e28]/10 bg-white shadow-[0_28px_80px_-52px_rgba(0,78,40,0.7)] lg:grid-cols-[1.08fr_0.92fr]">
          <section className="border-b border-gray-100 p-4 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-[#e9efeb]">
              <Image
                src={currentImage}
                alt={service.title}
                fill
                unoptimized
                priority
                sizes="(max-width: 1024px) 100vw, 55vw"
                className="object-cover"
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
                    className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#004e28] shadow-lg backdrop-blur"
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
                    className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#004e28] shadow-lg backdrop-blur"
                    aria-label="Imagen siguiente"
                  >
                    <ChevronRight size={21} />
                  </button>
                </>
              ) : null}
            </div>

            {images.length > 1 ? (
              <div className="mt-4 grid grid-cols-5 gap-2">
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
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="flex flex-col p-6 sm:p-9 lg:p-11">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#168e00]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#168e00]">
              <CheckCircle2 size={15} />
              Servicio disponible
            </span>
            <h1 className="mt-6 font-[family-name:var(--font-varela-round)] text-3xl font-black leading-tight text-[#004e28] sm:text-4xl">
              {service.title}
            </h1>
            {supplier?.name ? (
              <p className="mt-2 text-sm font-semibold text-[#168e00]">
                Por {supplier.name}
              </p>
            ) : null}
            <p className="mt-5 whitespace-pre-line text-base leading-8 text-gray-600">
              {service.description}
            </p>
            <div className="mt-auto pt-9">
              {hasPrice ? (
                <>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">
                    Precio desde
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-varela-round)] text-3xl font-black text-[#168e00]">
                    {new Intl.NumberFormat("es-MX", {
                      style: "currency",
                      currency: "MXN",
                    }).format(price)}
                  </p>
                </>
              ) : null}
              <div className={hasPrice ? "mt-7" : ""}>
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
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}
