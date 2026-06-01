"use client";

import SellerSupplierWizard from "@/components/admin/SellerSupplierWizard";
import SupplierForm from "@/components/admin/SupplierForm";
import { PageHero } from "@/components/ui/PageHero";
import { useAuthStore } from "@/store/useAuthStore";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreateSupplierPage() {
  const { user } = useAuthStore();
  const isSeller = user?.role === "seller";
  const returnPath = isSeller ? "/admin/dashboard" : "/admin/suppliers";

  return (
    <div className="space-y-6">
      <PageHero
        title="Nuevo Proveedor"
        subtitle="Registra un nuevo proveedor en el sistema."
        eyebrow={isSeller ? "Panel vendedor" : "Usuarios"}
        actions={
          <Link href={returnPath} className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      {isSeller ? (
        <SellerSupplierWizard />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <SupplierForm returnPath={returnPath} />
        </div>
      )}
    </div>
  );
}
