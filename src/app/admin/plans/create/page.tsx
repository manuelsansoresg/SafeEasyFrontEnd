"use client";

import Link from "next/link";
import PlanForm from "@/components/admin/PlanForm";
import { PageHero } from "@/components/ui/PageHero";
import { ArrowLeft } from "lucide-react";

export default function CreatePlanPage() {
  return (
    <div className="w-full space-y-6">
      <PageHero
        title="Nuevo Plan"
        subtitle="Crea un nuevo plan para tu plataforma."
        actions={
          <Link href="/admin/plans" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <PlanForm />
      </div>
    </div>
  );
}
