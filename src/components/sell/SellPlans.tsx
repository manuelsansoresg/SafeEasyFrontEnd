'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { normalizePlanFeatures } from '@/components/sell/planText';
import { ArrowRight, Check, ImageIcon, Package, Sparkles } from 'lucide-react';

type PlanDuration = 'monthly' | 'yearly';

type ApiPlan = {
  id: number;
  title: string;
  description?: string | null;
  price: number;
  features?: unknown;
  duration: PlanDuration;
  is_active?: boolean;
  max_active_products?: number | null;
  max_images_per_product?: number | null;
};

type SellPlan = {
  id: number;
  name: string;
  price: string;
  period: string;
  description: string;
  featureLines: string[];
  maxActiveProducts: number | null;
  maxImagesPerProduct: number | null;
};

const fallbackPlans: SellPlan[] = [
  {
    id: 1,
    name: 'Estándar',
    price: '$3,600',
    period: '/año',
    description: 'Ideal para negocios establecidos.',
    featureLines: [
      'Hasta 50 productos',
      'Perfil verificado',
      'Soporte por correo',
      'Acceso al mercado global',
    ],
    maxActiveProducts: 50,
    maxImagesPerProduct: 5,
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
    maxActiveProducts: null,
    maxImagesPerProduct: null,
  },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(value);

const formatPeriod = (duration: PlanDuration) => (duration === 'monthly' ? '/mes' : '/año');

const formatLimitValue = (value: number | null | undefined) => {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  return new Intl.NumberFormat('es-MX').format(value);
};

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
  maxActiveProducts:
    typeof plan.max_active_products === 'number' && Number.isFinite(plan.max_active_products)
      ? plan.max_active_products
      : null,
  maxImagesPerProduct:
    typeof plan.max_images_per_product === 'number' && Number.isFinite(plan.max_images_per_product)
      ? plan.max_images_per_product
      : null,
});

const buildRegisterHref = (planName: string, referralCode: string) => {
  const params = new URLSearchParams({
    plan: planName.toLowerCase(),
  });
  if (referralCode) params.set('referral_code', referralCode);
  return `/sell/register?${params.toString()}`;
};

type LimitStatProps = {
  icon: React.ReactNode;
  value: string;
  label: string;
  highlight: boolean;
};

const LimitStat = ({ icon, value, label, highlight }: LimitStatProps) => (
  <div
    className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${
      highlight
        ? 'border-white/15 bg-white/[0.06]'
        : 'border-gray-200 bg-gray-50'
    }`}
  >
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        highlight ? 'bg-white/10 text-white' : 'bg-primary/10 text-primary'
      }`}
    >
      {icon}
    </div>
    <div className="min-w-0">
      <div
        className={`text-base font-bold leading-tight md:text-lg ${
          highlight ? 'text-white' : 'text-gray-950'
        }`}
      >
        {value}
      </div>
      <div
        className={`mt-0.5 text-[11px] font-medium uppercase tracking-wider md:text-xs ${
          highlight ? 'text-white/70' : 'text-gray-500'
        }`}
      >
        {label}
      </div>
    </div>
  </div>
);

type PlanCardProps = {
  plan: SellPlan;
  highlight: boolean;
  registerHref: string;
};

const PlanCard = ({ plan, highlight, registerHref }: PlanCardProps) => {
  const productValue = formatLimitValue(plan.maxActiveProducts);
  const imageValue = formatLimitValue(plan.maxImagesPerProduct);
  const showLimits = productValue !== null || imageValue !== null;
  const showUnlimited = productValue === null && imageValue === null;

  return (
    <div
      className={`group relative flex h-full flex-col overflow-hidden rounded-3xl transition-all duration-300 ${
        highlight
          ? 'bg-gradient-to-br from-[#004e28] via-[#003d20] to-[#012a16] text-white shadow-2xl shadow-primary/30 ring-1 ring-white/10 md:-translate-y-3 md:scale-[1.02]'
          : 'border border-gray-200 bg-white shadow-sm hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl'
      }`}
    >
      {highlight && (
        <div className="absolute right-6 top-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Recomendado
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-7 md:p-8">
        <div>
          <span
            className={`inline-flex items-center text-[11px] font-semibold uppercase tracking-[0.18em] ${
              highlight ? 'text-white/70' : 'text-primary'
            }`}
          >
            Plan
          </span>
          <h3
            className={`font-[family-name:var(--font-varela-round)] mt-2 text-2xl md:text-[1.7rem] ${
              highlight ? 'text-white' : 'text-gray-950'
            }`}
          >
            {plan.name}
          </h3>
          <p
            className={`mt-2 text-sm leading-6 ${
              highlight ? 'text-white/75' : 'text-gray-500'
            }`}
          >
            {plan.description}
          </p>
        </div>

        <div className="mt-6 flex items-baseline gap-1.5">
          <span
            className={`font-[family-name:var(--font-varela-round)] text-4xl md:text-[2.75rem] leading-none ${
              highlight ? 'text-white' : 'text-gray-950'
            }`}
          >
            {plan.price}
          </span>
          <span
            className={`text-sm font-medium md:text-base ${
              highlight ? 'text-white/70' : 'text-gray-500'
            }`}
          >
            {plan.period}
          </span>
        </div>

        {showLimits && (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {productValue !== null && (
              <LimitStat
                icon={<Package className="h-[18px] w-[18px]" />}
                value={productValue}
                label="Productos activos"
                highlight={highlight}
              />
            )}
            {imageValue !== null && (
              <LimitStat
                icon={<ImageIcon className="h-[18px] w-[18px]" />}
                value={imageValue}
                label="Imágenes por producto"
                highlight={highlight}
              />
            )}
          </div>
        )}

        {showUnlimited && (
          <div
            className={`mt-6 rounded-xl border px-3.5 py-3 ${
              highlight
                ? 'border-white/15 bg-white/[0.06] text-white/85'
                : 'border-primary/15 bg-primary/5 text-primary'
            }`}
          >
            <div className="text-sm font-semibold">Productos e imágenes ilimitadas</div>
            <div
              className={`mt-0.5 text-xs ${
                highlight ? 'text-white/60' : 'text-gray-500'
              }`}
            >
              Escale su catálogo sin restricciones.
            </div>
          </div>
        )}

        <div
          className={`my-6 h-px w-full ${
            highlight ? 'bg-white/10' : 'bg-gray-200'
          }`}
        />

        <ul className="space-y-3.5 text-sm leading-6 md:text-[15px]">
          {(plan.featureLines.length > 0 ? plan.featureLines : [plan.description]).map(
            (line, lineIndex) => (
              <li key={`${line}-${lineIndex}`} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    highlight ? 'bg-white/15 text-white' : 'bg-primary/10 text-primary'
                  }`}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span className={highlight ? 'text-white/85' : 'text-gray-700'}>{line}</span>
              </li>
            ),
          )}
        </ul>

        <div className="mt-auto pt-8">
          <Link
            href={registerHref}
            className={`group/cta inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-bold transition-all duration-200 md:text-base ${
              highlight
                ? 'bg-white text-primary shadow-lg shadow-black/10 hover:bg-white/95 hover:shadow-xl'
                : 'border-2 border-primary bg-white text-primary hover:bg-primary hover:text-white'
            }`}
          >
            <span>{highlight ? 'Seleccionar Pro' : 'Empezar Ahora'}</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </div>
  );
};

type SellPlansProps = {
  accessCode?: string;
  referralCode?: string;
};

export default function SellPlans({ accessCode = '', referralCode = '' }: SellPlansProps) {
  const [serverPlans, setServerPlans] = useState<SellPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const normalizedAccessCode = accessCode.trim();
  const normalizedReferralCode = referralCode.trim();
  const hasAccessCode = normalizedAccessCode.length > 0;

  useEffect(() => {
    let mounted = true;

    const loadPlans = async () => {
      try {
        const params = new URLSearchParams({
          skip: '0',
          limit: '1000',
          only_active: 'true',
        });

        if (normalizedAccessCode) {
          params.set('access_code', normalizedAccessCode);
          params.set('is_demo', 'true');
        } else {
          params.set('is_listed', 'true');
          params.set('is_demo', 'false');
        }

        const response = await fetch(`/api/plans/?${params.toString()}`, {
          cache: 'no-store',
        });

        if (response.ok) {
          const data: unknown = await response.json();
          const plans = pickArray(data).map(mapApiPlan);
          if (mounted) {
            setServerPlans(plans);
          }
        }
      } catch (error) {
        console.error('[SellPlans] Error loading plans:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadPlans();

    return () => {
      mounted = false;
    };
  }, [normalizedAccessCode]);

  const plans = useMemo(
    () => (serverPlans.length > 0 || hasAccessCode ? serverPlans : fallbackPlans),
    [hasAccessCode, serverPlans]
  );

  return (
    <section id="plans" className="relative overflow-hidden bg-gradient-to-b from-white via-gray-50 to-white py-20 md:py-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[120%] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="container relative mx-auto px-4">
        <div className="mx-auto mb-14 max-w-3xl text-center md:mb-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Planes y precios
          </span>
          <h2 className="font-[family-name:var(--font-varela-round)] mt-5 text-3xl text-gray-950 md:text-5xl">
            Elija el plan perfecto para su negocio
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-500 md:text-lg md:leading-8">
            Planes anuales diseñados para escalar con usted. Sin contratos forzosos, cancele cuando quiera.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 items-stretch gap-6 md:grid-cols-2 md:gap-8">
          {isLoading &&
            fallbackPlans.map((plan, index) => (
              <PlanCard
                key={`loading-${plan.id}`}
                plan={plan}
                highlight={index === 1}
                registerHref="#"
              />
            ))}

          {!isLoading && plans.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm md:col-span-2">
              <h3 className="text-2xl font-bold text-gray-900">No hay planes disponibles</h3>
              <p className="mt-3 text-gray-600">
                En este momento no hay planes activos para mostrar.
              </p>
            </div>
          )}

          {!isLoading &&
            plans.map((plan, index) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                highlight={index === 1}
                registerHref={buildRegisterHref(plan.name, normalizedReferralCode)}
              />
            ))}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-gray-400 md:text-sm">
          Los límites de productos e imágenes mostrados son los configurados para cada plan.
          ¿Necesita algo a la medida? <a href="#faq" className="font-semibold text-primary hover:underline">Contáctenos</a>.
        </p>
      </div>
    </section>
  );
}
