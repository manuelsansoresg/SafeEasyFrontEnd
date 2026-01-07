"use client";

import ProductForm from "@/components/admin/ProductForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreateProductPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          href="/admin/products" 
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Nuevo Producto</h1>
          <p className="text-gray-500 mt-1">Registra un nuevo producto en el catálogo.</p>
        </div>
      </div>

      <ProductForm />
    </div>
  );
}
