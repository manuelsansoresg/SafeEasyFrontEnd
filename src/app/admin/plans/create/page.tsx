"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PlanForm from "@/components/admin/PlanForm";

export default function CreatePlanPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/plans"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Nuevo Plan</h1>
          <p className="text-gray-500">Crea un nuevo plan para tu plataforma.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <PlanForm />
      </div>
    </div>
  );
}

