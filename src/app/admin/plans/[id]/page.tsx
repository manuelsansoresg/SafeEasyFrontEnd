"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHero } from "@/components/ui/PageHero";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import PlanForm, { type Plan } from "@/components/admin/PlanForm";

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return `${base.replace(/\/$/, "")}${path}`;
};

const authHeaders = (token: string) => ({
  "Authorization": `Bearer ${token.replace(/^bearer\s+/i, "").trim()}`,
});

const unwrapPlans = (data: unknown): Plan[] => {
  if (Array.isArray(data)) return data as Plan[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const items = record.items ?? record.results ?? record.data ?? record.plans;
    if (Array.isArray(items)) return items as Plan[];
  }
  return [];
};

export default function EditPlanPage() {
  const params = useParams();
  const id = params.id;
  const { token } = useAuthStore();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlan = async () => {
      if (!token || !id) return;

      try {
        const response = await fetch(apiUrl(`/plans/${id}`), {
          headers: {
            ...authHeaders(token),
            Accept: "application/json",
          },
        });
        if (response.ok) {
          const data = await response.json();
          setPlan(data);
          return;
        }

        const listResponse = await fetch(apiUrl(`/plans/?skip=0&limit=1000`), {
          headers: {
            ...authHeaders(token),
            Accept: "application/json",
          },
        });
        if (listResponse.ok) {
          const listData = await listResponse.json();
          const numericId = Number(id);
          const found = unwrapPlans(listData).find((p) => Number(p?.id) === numericId) || null;
          if (found) {
            setPlan(found);
            return;
          }
          setError("Plan no encontrado");
        } else {
          setError("No se pudo cargar el plan");
        }
      } catch (err) {
        console.error("Error fetching plan:", err);
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    };

    fetchPlan();
  }, [id, token]);

  if (loading) {
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
        <PlanForm initialData={plan} />
      </div>
    </div>
  );
}
