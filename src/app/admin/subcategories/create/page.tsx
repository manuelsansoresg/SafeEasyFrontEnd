"use client";

import SubcategoryForm from "@/components/admin/SubcategoryForm";
import { PageHero } from "@/components/ui/PageHero";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreateSubcategoryPage() {
  return (
    <div className="w-full space-y-6">
      <PageHero
        title="Nueva Subcategoría"
        subtitle="Crea una nueva subcategoría y asígnala a una categoría principal."
        actions={
          <Link href="/admin/subcategories" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <SubcategoryForm />
      </div>
    </div>
  );
}
