"use client";

import SupplierForm from "@/components/admin/SupplierForm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreateSupplierPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          href="/admin/suppliers" 
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Nuevo Proveedor</h1>
          <p className="text-gray-500 mt-1">Registra un nuevo proveedor en el sistema.</p>
        </div>
      </div>

      <SupplierForm />
    </div>
  );
}
