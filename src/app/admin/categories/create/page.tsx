"use client";

import CategoryForm from "@/components/admin/CategoryForm";
import { PageHero } from "@/components/ui/PageHero";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreateCategoryPage() {
  return (
    <div className="w-full space-y-6">
      <PageHero
        title="Nueva Categoría"
        subtitle="Crea una nueva categoría para organizar tus productos."
        eyebrow="Contenido"
        actions={
          <Link href="/admin/categories" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <CategoryForm />
      </div>
    </div>
  );
}
