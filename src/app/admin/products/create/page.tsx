"use client";

import ProductForm from "@/components/admin/ProductForm";
import { PageHero } from "@/components/ui/PageHero";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreateProductPage() {
  return (
    <div className="space-y-6">
      <PageHero
        title="Nuevo Producto"
        subtitle="Registra un nuevo producto en el catálogo."
        actions={
          <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      <ProductForm />
    </div>
  );
}
