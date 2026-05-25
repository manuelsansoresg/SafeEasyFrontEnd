"use client";

import UserForm from "@/components/admin/UserForm";
import { PageHero } from "@/components/ui/PageHero";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreateCourierPage() {
  return (
    <div className="space-y-6">
      <PageHero
        title="Nuevo Repartidor"
        subtitle="Crea un nuevo repartidor en el sistema."
        actions={
          <Link href="/admin/couriers" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      <UserForm fixedRole="courier" returnPath="/admin/couriers" submitLabel="Guardar Repartidor" />
    </div>
  );
}
