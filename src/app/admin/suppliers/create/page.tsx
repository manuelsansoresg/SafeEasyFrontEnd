"use client";

import { Suspense } from "react";
import SellerSupplierWizard from "@/components/admin/SellerSupplierWizard";
import SupplierForm from "@/components/admin/SupplierForm";
import { PageHero } from "@/components/ui/PageHero";
import { useAuthStore } from "@/store/useAuthStore";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function CreateSupplierContent() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const isSeller = user?.role === "seller";
  const returnPath = isSeller ? "/admin/dashboard" : "/admin/suppliers";
  const recoveryUserId = Number(searchParams.get("user_id"));
  const existingUserId =
    Number.isInteger(recoveryUserId) && recoveryUserId > 0
      ? recoveryUserId
      : undefined;

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
          <SupplierForm
            returnPath={returnPath}
            existingUserId={existingUserId}
          />
        </div>
      )}
    </div>
  );
}

export default function CreateSupplierPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-sm text-gray-500">
          Preparando formulario...
        </div>
      }
    >
      <CreateSupplierContent />
    </Suspense>
  );
}
