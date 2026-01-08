"use client";

import CategoryForm from "@/components/admin/CategoryForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreateCategoryPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          href="/admin/categories" 
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Nueva Categoría</h1>
          <p className="text-gray-500">Crea una nueva categoría para organizar tus productos.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <CategoryForm />
      </div>
    </div>
  );
}
