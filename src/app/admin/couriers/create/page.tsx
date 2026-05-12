"use client";

import UserForm from "@/components/admin/UserForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function CreateCourierPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/couriers"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Nuevo Repartidor</h1>
          <p className="text-gray-500 mt-1">Crea un nuevo repartidor en el sistema.</p>
        </div>
      </div>

      <UserForm fixedRole="courier" returnPath="/admin/couriers" submitLabel="Guardar Repartidor" />
    </div>
  );
}
