"use client";

import UserForm from "@/components/admin/UserForm";
import { PageHero } from "@/components/ui/PageHero";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreateSellerPage() {
  return (
    <div className="space-y-6">
      <PageHero
        title="Nuevo Vendedor"
        subtitle="Crea un nuevo vendedor en el sistema."
        eyebrow="Usuarios"
        actions={
          <Link href="/admin/sellers" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      <UserForm fixedRole="seller" returnPath="/admin/sellers" submitLabel="Guardar Vendedor" />
    </div>
  );
}
