"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ServiceForm } from "@/components/admin/ServiceForm";
import { PageHero } from "@/components/ui/PageHero";

export default function CreateServicePage() {
  return (
    <div className="space-y-6">
      <PageHero
        title="Nuevo Servicio"
        subtitle="Publica un servicio en tu directorio empresarial."
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
      <ServiceForm />
    </div>
  );
}

