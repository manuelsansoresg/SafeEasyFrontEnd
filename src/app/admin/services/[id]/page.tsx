"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ServiceForm } from "@/components/admin/ServiceForm";
import { PageHero } from "@/components/ui/PageHero";
import { servicesService } from "@/services/servicesService";
import type { SupplierService } from "@/types/services";

export default function EditServicePage() {
  const params = useParams<{ id: string }>();
  const [service, setService] = useState<SupplierService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    servicesService
      .listMine({ skip: 0, limit: 100 })
      .then((services) => {
        if (cancelled) return;
        const found = services.find((item) => item.id === params.id);
        if (!found) throw new Error("Servicio no encontrado.");
        setService(found);
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

  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <Loader2 className="animate-spin text-[#168e00]" size={34} />
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="rounded-2xl border border-red-100 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-red-600">
          {error ?? "Servicio no encontrado."}
        </p>
        <Link
          href="/admin/services"
          className="mt-4 inline-flex text-sm font-semibold text-[#004e28] hover:underline"
        >
          Volver a servicios
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Editar Servicio"
        subtitle={`Actualiza “${service.title}” y administra su galería.`}
        actions={
          <Link
            href="/admin/services"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 transition hover:text-[#004e28]"
          >
            <ArrowLeft size={17} />
            Volver a servicios
          </Link>
        }
      />
      <ServiceForm initialService={service} />
    </div>
  );
}

