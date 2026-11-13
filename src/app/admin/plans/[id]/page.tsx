"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import PlanForm from "@/components/admin/PlanForm";
import { subscriptionsService } from "@/services/subscriptionsService";
import type { AdminPlan } from "@/types/subscriptions";

export default function EditPlanPage() {
  const params = useParams();
  const id = params.id;
  const { token } = useAuthStore();

  const [plan, setPlan] = useState<AdminPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    const controller = new AbortController();

    subscriptionsService.getAdminPlan(Number(id), controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setError(null);
        setPlan(data);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "No se pudo cargar el plan.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id, token]);

  if (loading || (!error && plan?.id !== Number(id))) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-500 gap-4">
        <Loader2 className="animate-spin text-primary" size={40} />
        <p>Cargando información del plan...</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <h2 className="text-xl font-bold text-gray-800">Error</h2>
        <p className="text-gray-500">{error || "Plan no encontrado"}</p>
        <Link
          href="/admin/plans"
          className="px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
        >
          Volver al listado
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <PageHero
        title="Editar Plan"
        subtitle={`Modifica los datos del plan ${plan.title}.`}
        actions={
          <Link href="/admin/plans" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <PlanForm key={plan.id} initialData={plan} />
      </div>
    </div>
  );
}
