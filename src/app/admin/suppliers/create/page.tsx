"use client";

import SupplierForm from "@/components/admin/SupplierForm";
import { PageHero } from "@/components/ui/PageHero";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreateSupplierPage() {
  return (
    <div className="space-y-6">
      <PageHero
        title="Nuevo Proveedor"
        subtitle="Registra un nuevo proveedor en el sistema."
        actions={
          <Link href="/admin/suppliers" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <SupplierForm />
      </div>
    </div>
  );
}
