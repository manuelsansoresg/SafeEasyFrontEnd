'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { normalizePlanFeatures } from '@/components/sell/planText';
import { Check } from 'lucide-react';

type PlanDuration = 'monthly' | 'yearly';

type ApiPlan = {
  id: number;
  title: string;
  description?: string | null;
  price: number;
  features?: unknown;
  duration: PlanDuration;
  is_active?: boolean;
};

type SellPlan = {
  id: number;
  name: string;
  price: string;
  period: string;
  description: string;
  featureLines: string[];
};

const fallbackPlans: SellPlan[] = [
  {
    id: 1,
    name: 'Estándar',
    price: '$3,600',
    period: '/año',
    description: 'Ideal para negocios establecidos.',
    featureLines: [
      'Hasta 500 productos',
      'Perfil verificado',
      'Soporte por correo',
      'Acceso al mercado global',
    ],
  },
  {
    id: 2,
    name: 'Profesional',
    price: '$4,600',
    period: '/año',
    description: 'Para maximizar sus ventas.',
    featureLines: [
      'Productos ilimitados',
      'Perfil verificado + Badge',
      'Prioridad en búsquedas',
      'Soporte prioritario 24/7',
      'Analíticas avanzadas',
    ],
  },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value);

const formatPeriod = (duration: PlanDuration) => (duration === 'monthly' ? '/mes' : '/año');

const pickArray = (data: unknown): ApiPlan[] => {
  if (Array.isArray(data)) return data as ApiPlan[];
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const items = record.items ?? record.results ?? record.data ?? record.plans;
    if (Array.isArray(items)) return items as ApiPlan[];
  }
  return [];
};

const mapApiPlan = (plan: ApiPlan): SellPlan => ({
  id: plan.id,
  name: plan.title,
  price: formatCurrency(Number(plan.price || 0)),
  period: formatPeriod(plan.duration),
  description: plan.description || 'Plan diseñado para impulsar su negocio.',
  featureLines: normalizePlanFeatures(plan.features, plan.description),
});

export default function SellPlans() {
  const [serverPlans, setServerPlans] = useState<SellPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadPlans = async () => {
      try {
        const response = await fetch('/api/plans/?skip=0&limit=1000&only_active=true', {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('No se pudieron cargar los planes.');

        const data: unknown = await response.json();
        const plans = pickArray(data).map(mapApiPlan);
        if (mounted) {
          setServerPlans(plans);
          setHasLoadError(false);
        }
      } catch (error) {
        console.error('[SellPlans] Error loading plans:', error);
        if (mounted) {
          setServerPlans([]);
          setHasLoadError(true);
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadPlans();

    return () => {
      mounted = false;
    };
  }, []);

  const plans = useMemo(() => (hasLoadError ? fallbackPlans : serverPlans), [hasLoadError, serverPlans]);

  return (
    <section id="plans" className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Elija el plan perfecto para su negocio
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Planes anuales diseñados para escalar con usted.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {isLoading && fallbackPlans.map((plan, index) => {
            const highlight = index === 1;

            return (
              <div
                key={`loading-${plan.id}`}
                className={`relative bg-white rounded-2xl shadow-lg overflow-hidden flex min-h-[520px] flex-col ${
                  highlight ? 'border-2 border-primary ring-4 ring-primary/10' : 'border border-gray-200'
                }`}
              >
                {highlight && (
                  <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg uppercase">
                    Recomendado
                  </div>
                )}
                <div className="p-8 flex-grow">
                  <div className="h-8 w-40 animate-pulse rounded bg-gray-100" />
                  <div className="mt-6 h-12 w-48 animate-pulse rounded bg-gray-100" />
                  <div className="mt-6 h-5 w-64 max-w-full animate-pulse rounded bg-gray-100" />
                  <div className="mt-10 space-y-5">
                    {[0, 1, 2, 3].map((item) => (
                      <div key={item} className="flex items-center gap-3">
                        <div className="h-5 w-5 animate-pulse rounded-full bg-gray-100" />
                        <div className="h-5 w-52 max-w-[80%] animate-pulse rounded bg-gray-100" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-8 bg-gray-50 mt-auto">
                  <div className="h-12 w-full animate-pulse rounded-lg bg-gray-100" />
                </div>
              </div>
            );
          })}

          {!isLoading && plans.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm md:col-span-2">
              <h3 className="text-2xl font-bold text-gray-900">No hay planes disponibles</h3>
              <p className="mt-3 text-gray-600">
                En este momento no hay planes activos para mostrar.
              </p>
            </div>
          )}

          {!isLoading && plans.map((plan, index) => {
            const highlight = index === 1;
            const buttonText = highlight ? 'Seleccionar Pro' : 'Empezar Ahora';

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col transition-transform duration-300 hover:-translate-y-2 ${
                  highlight ? 'border-2 border-primary ring-4 ring-primary/10' : 'border border-gray-200'
                }`}
              >
                {highlight && (
                  <div className="absolute top-0 right-0 bg-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg uppercase">
                    Recomendado
                  </div>
                )}
                <div className="p-8 flex-grow">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="flex items-baseline mb-4">
                    <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                    <span className="text-gray-500 ml-1">{plan.period}</span>
                  </div>
                  <ul className="mt-8 space-y-5 text-lg leading-8 text-gray-600 md:text-xl md:leading-9">
                    {(plan.featureLines.length > 0 ? plan.featureLines : [plan.description]).map((line, lineIndex) => (
                      <li key={`${line}-${lineIndex}`} className="flex items-start gap-4">
                        <Check className="mt-1.5 h-5 w-5 shrink-0 text-secondary md:mt-2" aria-hidden="true" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-8 bg-gray-50 mt-auto">
                  <Link
                    href={`/sell/register?plan=${encodeURIComponent(plan.name.toLowerCase())}`}
                    className={`block w-full text-center py-3 px-6 rounded-lg font-bold transition-colors ${
                      highlight
                        ? 'bg-primary text-white hover:bg-primary/90'
                        : 'bg-white text-primary border-2 border-primary hover:bg-primary/5'
                    }`}
                  >
                    {buttonText}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
