"use client";

import SubcategoryForm from "@/components/admin/SubcategoryForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreateSubcategoryPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          href="/admin/subcategories" 
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Nueva Subcategoría</h1>
          <p className="text-gray-500">Crea una nueva subcategoría y asígnala a una categoría principal.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <SubcategoryForm />
      </div>
    </div>
  );
}
