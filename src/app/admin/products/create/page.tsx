"use client";

import { useState } from "react";
import { catalogLabels } from "@/lib/catalogLabels";
import ProductForm from "@/components/admin/ProductForm";
import { PageHero } from "@/components/ui/PageHero";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreateProductPage() {
  const [isRealEstate, setIsRealEstate] = useState(false);
  const catalog = catalogLabels(isRealEstate ? "inmuebles" : null);
  return (
    <div className="space-y-6">
      <PageHero
        title={catalog.add}
        subtitle={catalog.isRealEstate ? "Agrega una propiedad a tu catálogo." : "Registra un nuevo producto en el catálogo."}
        actions={
          <Link href="/admin/products" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      <ProductForm onRealEstateChange={setIsRealEstate} />
    </div>
  );
}
