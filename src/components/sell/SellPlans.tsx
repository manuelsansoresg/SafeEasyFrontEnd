'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { trackMetaCustomEvent } from '@/lib/metaPixel';
import { getPlanFeatureLines, splitPlanText } from '@/components/sell/planText';
import type { PlanModuleCapabilities } from '@/types/subscriptions';
import { ArrowRight, Blocks, BriefcaseBusiness, CalendarDays, Check, ChevronDown, ImageIcon, Images, Package, Sparkles, UtensilsCrossed } from 'lucide-react';

type SellIntent = 'products' | 'agenda' | 'menu';

type PlanDuration = 'monthly' | 'yearly';

type ApiPlan = {
  id: number;
  title: string;
  description?: string | null;
  price: number;
  features?: unknown;
  duration: PlanDuration;
  is_active?: boolean;
  is_directory?: boolean;
  max_active_products?: number | null;
  max_images_per_product?: number | null;
  max_gallery_images?: number | null;
  ai_text_generations_per_year?: number;
  ai_image_generations_per_year?: number;
  module_codes?: string[];
  module_capabilities?: PlanModuleCapabilities;
  modules?: unknown;
};

type IncludedModule = {
  code: string;
  name: string;
  description?: string;
  paymentsEnabled?: boolean;
  limits: [string, string | number][];
};

type SellPlan = {
  id: number;
  name: string;
  price: string;
  annualizedPrice: number;
  period: string;
  description: string;
  featureLines: string[];
  isDirectory: boolean;
  maxActiveProducts: number | null;
  maxImagesPerProduct: number | null;
  maxGalleryImages: number | null;
  aiTexts: number;
  aiImages: number;
  modules: IncludedModule[];
};

const moduleNames: Record<string, string> = {
  menu: 'Menú',
  agenda: 'Agenda',
};

const normalizeText = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const moduleName = (code: string) =>
  moduleNames[code] ?? code.replace(/[_-]+/g, ' ').replace(/^./, (letter) => letter.toUpperCase());

const mentionsModule = (text: string, modules: IncludedModule[]) => {
  const normalized = ` ${normalizeText(text).replace(/[^a-z0-9]+/g, ' ').trim()} `;
  return modules.some(({ code, name }) => {
    const terms = [code.replace(/[_-]+/g, ' '), name].map(normalizeText);
    return terms.some((term) => normalized.includes(` ${term} `));
  });
};

const includedModules = (plan: ApiPlan): IncludedModule[] => {
  const metadata = Array.isArray(plan.modules) ? plan.modules : [];
  const codes = Array.isArray(plan.module_codes) ? plan.module_codes : [];

  return [...new Set(codes.filter((code): code is string => typeof code === 'string').map((code) => code.trim().toLowerCase()).filter(Boolean))]
    .map((code) => {
      const detail = metadata.find((item) =>
        item && typeof item === 'object' && (item as Record<string, unknown>).code === code,
      ) as Record<string, unknown> | undefined;
      const capability = plan.module_capabilities?.[code];
      const ordersEnabled = typeof capability?.orders_enabled === 'boolean' ? capability.orders_enabled : undefined;
      const onlinePaymentsEnabled = typeof capability?.online_payments_enabled === 'boolean' ? capability.online_payments_enabled : undefined;
      const actualName = typeof detail?.name === 'string' && detail.name.trim() ? detail.name.trim() : moduleName(code);
      const actualDescription = typeof detail?.description === 'string' && detail.description.trim()
        ? detail.description.trim()
        : undefined;
      let name = actualName;
      let description = actualDescription;
      if (code === 'menu') {
        name = ordersEnabled === true ? 'Menú con pedidos' : ordersEnabled === false ? 'Menú digital' : actualName;
        description = ordersEnabled === true
          ? 'Publica tus platillos y recibe pedidos para recoger o entregar.'
          : ordersEnabled === false
            ? 'Exhibe tus platillos, fotos y precios. Sin pedidos en línea.'
            : undefined;
      } else if (code === 'agenda') {
        name = 'Agenda';
        description = onlinePaymentsEnabled === true
          ? 'Gestiona citas y reservaciones con pagos en línea.'
          : onlinePaymentsEnabled === false
            ? 'Gestiona citas y reservaciones.'
            : undefined;
      }
      const rawLimits = detail?.limits;
      const limits = rawLimits && typeof rawLimits === 'object' && !Array.isArray(rawLimits)
        ? Object.entries(rawLimits).filter((entry): entry is [string, string | number] =>
            typeof entry[1] === 'string' || typeof entry[1] === 'number',
          )
        : [];

      return {
        code,
        name,
        description,
        paymentsEnabled: code !== 'menu' && code !== 'agenda' && typeof detail?.payments_enabled === 'boolean'
          ? detail.payments_enabled : undefined,
        limits,
      };
    });
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(value);

const formatPeriod = (duration: PlanDuration) => (duration === 'monthly' ? '/mes' : '/año');

const formatLimitValue = (value: number | null | undefined) => {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value)) return null;
  if (value <= 0) return null;
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

const mapApiPlan = (plan: ApiPlan): SellPlan => {
  const modules = includedModules(plan);
  const description = (plan.description || '').trim();
  const descriptionLines = new Set(splitPlanText(description).map(normalizeText));

  return {
    id: plan.id,
    name: plan.title,
    price: formatCurrency(Number(plan.price || 0)),
    annualizedPrice: Number(plan.price || 0) * (plan.duration === 'monthly' ? 12 : 1),
    period: formatPeriod(plan.duration),
    description,
    featureLines: getPlanFeatureLines({
      features: plan.features,
      isDirectory: false,
    }).filter((line) => !mentionsModule(line, modules) && !descriptionLines.has(normalizeText(line))),
    isDirectory: Boolean(plan.is_directory),
    maxActiveProducts:
      typeof plan.max_active_products === 'number' && Number.isFinite(plan.max_active_products)
        ? plan.max_active_products
        : null,
    maxImagesPerProduct:
      typeof plan.max_images_per_product === 'number' && Number.isFinite(plan.max_images_per_product)
        ? plan.max_images_per_product
        : null,
    maxGalleryImages:
      typeof plan.max_gallery_images === 'number' && Number.isFinite(plan.max_gallery_images)
        ? plan.max_gallery_images
        : null,
    aiTexts: Math.max(0, Number(plan.ai_text_generations_per_year) || 0),
    aiImages: Math.max(0, Number(plan.ai_image_generations_per_year) || 0),
    modules,
  };
};

const buildRegisterHref = (planId: number, campaignQuery: string, publicOnly: boolean) => {
  const params = new URLSearchParams(campaignQuery);
  params.set('plan', String(planId));
  if (publicOnly) params.delete('code');
  return `/sell/register?${params.toString()}`;
};

const intentLabels: Record<SellIntent, string> = {
  products: 'Planes para vender productos',
  agenda: 'Planes con Agenda',
  menu: 'Planes con Menú',
};

const matchesIntent = (plan: SellPlan, intent: SellIntent) =>
  intent === 'products'
    ? !plan.isDirectory && (plan.maxActiveProducts ?? 0) > 0
    : plan.modules.some(({ code }) => code === intent);

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

const ModuleBlock = ({ module, highlight }: { module: IncludedModule; highlight: boolean }) => {
  const Icon = module.code === 'menu' ? UtensilsCrossed : module.code === 'agenda' ? CalendarDays : Blocks;

  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'border-white/15 bg-white/[0.06]' : 'border-[#004e28]/10 bg-[#f6faf6]'}`}>
      <div className="flex items-start gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${highlight ? 'bg-white/10 text-white' : 'bg-[#168e00]/10 text-[#004e28]'}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${highlight ? 'text-white' : 'text-[#004e28]'}`}>{module.name}</p>
          {module.description ? (
            <p className={`mt-0.5 text-xs leading-5 ${highlight ? 'text-white/65' : 'text-gray-500'}`}>{module.description}</p>
          ) : null}
          {module.paymentsEnabled !== undefined ? (
            <p className={`mt-0.5 text-xs ${module.paymentsEnabled
              ? highlight ? 'text-[#b9f1b2]' : 'font-medium text-[#0b6d00]'
              : highlight ? 'text-white/55' : 'text-gray-500'}`}>
              {module.paymentsEnabled ? 'Pagos en línea incluidos' : 'Sin pagos en línea'}
            </p>
          ) : null}
        </div>
      </div>
      {module.limits.length > 0 ? (
        <details className={`group/details mt-2 border-t pt-2 ${highlight ? 'border-white/10' : 'border-[#004e28]/10'}`}>
          <summary className={`flex cursor-pointer list-none items-center gap-1 text-xs font-semibold [&::-webkit-details-marker]:hidden ${highlight ? 'text-white/75' : 'text-[#0b6d00]'}`}>
            Ver detalles <ChevronDown className="h-3.5 w-3.5 transition-transform group-open/details:rotate-180" aria-hidden="true" />
          </summary>
          <dl className="mt-2 space-y-1.5 text-xs">
            {module.limits.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className={highlight ? 'text-white/65' : 'text-gray-500'}>{label.replace(/[_-]+/g, ' ')}</dt>
                <dd className={`font-semibold ${highlight ? 'text-white' : 'text-gray-800'}`}>{value}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </div>
  );
};

type PlanCardProps = {
  plan: SellPlan;
  highlight: boolean;
  registerHref: string;
  isEntryPlan: boolean;
};

const BenefitLine = ({ line, highlight }: { line: string; highlight: boolean }) => (
  <li className="flex items-start gap-2.5">
    <span className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full ${highlight ? 'bg-white/15 text-white' : 'bg-primary/10 text-primary'}`}>
      <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
    </span>
    <span className={highlight ? 'text-white/85' : 'text-gray-700'}>{line}</span>
  </li>
);

const PlanCard = ({ plan, highlight, registerHref, isEntryPlan }: PlanCardProps) => {
  const productValue = plan.isDirectory ? null : formatLimitValue(plan.maxActiveProducts);
  const imageValue = formatLimitValue(plan.maxImagesPerProduct);
  const galleryValue = plan.isDirectory ? formatLimitValue(plan.maxGalleryImages) : null;
  const limitCount = [productValue, galleryValue, imageValue].filter(value => value !== null).length;
  const descriptionLines = plan.description.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const benefits = [...new Set([...descriptionLines, ...plan.featureLines])];
  const PlanIcon = plan.isDirectory ? BriefcaseBusiness : plan.modules.length ? Blocks : Package;

  return (
    <article className={`group relative flex h-full flex-col overflow-hidden rounded-[28px] border transition-[box-shadow,border-color] duration-200 ${highlight ? 'border-[#004e28] bg-[#004e28] text-white shadow-[0_20px_60px_-24px_#004e2870]' : 'border-[#004e28]/15 bg-white text-gray-950 shadow-[0_8px_30px_-20px_#004e2830] hover:border-[#004e28]/35 hover:shadow-[0_16px_40px_-24px_#004e2840]'}`}>
      <div className={`h-1.5 ${highlight ? 'bg-[#87d46a]' : 'bg-[#004e28]/10'}`} aria-hidden="true" />
      <header className={`relative p-6 pb-0 md:p-7 md:pb-0 ${highlight ? 'bg-[radial-gradient(ellipse_at_top_right,#ffffff12,transparent_70%)]' : ''}`}>
        <div className="mb-5 flex min-h-11 items-center justify-between gap-2">
          <span className={`grid size-11 place-items-center rounded-2xl ${highlight ? 'bg-white/10 text-[#b7e6a5]' : 'bg-[#edf6ef] text-[#004e28]'}`}><PlanIcon size={22} strokeWidth={1.7} aria-hidden="true" /></span>
          {highlight && <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white"><Sparkles size={12} aria-hidden="true" />{isEntryPlan ? 'Para empezar' : 'Plan destacado'}</span>}
        </div>
        <h3 className="font-[family-name:var(--font-varela-round)] text-2xl leading-tight md:text-[1.7rem]">{plan.name}</h3>
        <p className={`mt-2 text-sm leading-6 ${highlight ? 'text-white/80' : 'text-gray-600'}`}>
          {plan.isDirectory ? 'Para tener una página de tu negocio.' : (plan.maxActiveProducts ?? 0) > 0 ? 'Para publicar productos en tu tienda en línea.' : 'Consulta las herramientas de este plan.'}
        </p>
        <div className="mt-5 flex flex-wrap items-baseline gap-1.5">
          <span className="font-[family-name:var(--font-varela-round)] text-[2.6rem] leading-none tracking-tight md:text-5xl">{plan.price}</span>
          <span className={`text-sm ${highlight ? 'text-white/75' : 'text-gray-500'}`}>MXN {plan.period}</span>
        </div>
        <Link href={registerHref} onClick={() => trackMetaCustomEvent('SellPlanSelected', { plan_id: String(plan.id) })} className={`mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#168e00] ${highlight ? 'bg-white text-[#004e28] hover:bg-[#eaf8e5]' : 'bg-[#004e28] text-white hover:bg-[#eaf8e5] hover:text-[#004e28]'}`} aria-label={`Elegir ${plan.name}`}>
          Elegir este plan<ArrowRight size={16} aria-hidden="true" />
        </Link>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-6 md:p-7">
        {limitCount > 0 && <div className={`grid gap-2 ${limitCount > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {productValue !== null && <LimitStat icon={<Package size={18} />} value={productValue} label="Productos activos" highlight={highlight} />}
          {galleryValue !== null && <LimitStat icon={<Images size={18} />} value={galleryValue} label="Imágenes en galería" highlight={highlight} />}
          {imageValue !== null && <LimitStat icon={plan.isDirectory ? <BriefcaseBusiness size={18} /> : <ImageIcon size={18} />} value={imageValue} label={plan.isDirectory ? 'Alta de servicios' : 'Imágenes por producto'} highlight={highlight} />}
        </div>}

        {(plan.aiTexts > 0 || plan.aiImages > 0) && <section aria-label="Inteligencia artificial incluida" className={`rounded-xl border p-4 ${highlight ? 'border-white/15 bg-white/[0.06]' : 'border-[#004e28]/10 bg-[#f4f8f5]'}`}><h4 className={`flex items-center gap-2 text-xs font-semibold ${highlight ? 'text-[#b7e6a5]' : 'text-[#004e28]'}`}><Sparkles size={14} aria-hidden="true" />IA incluida cada año</h4><ul className="mt-3 space-y-2 text-xs leading-5">{plan.aiTexts > 0 && <li>{plan.aiTexts} generaciones de textos</li>}{plan.aiImages > 0 && <li>{plan.aiImages} imágenes para logo o banner</li>}</ul></section>}

        {benefits.length > 0 && <section aria-label={`Beneficios de ${plan.name}`} className={`border-t pt-5 ${highlight ? 'border-white/15' : 'border-[#004e28]/10'}`}>
          <h4 className={`mb-4 text-[10px] font-semibold uppercase tracking-[.18em] ${highlight ? 'text-[#b7e6a5]' : 'text-[#004e28]'}`}>Tu plan incluye</h4>
          <ul className="space-y-3 text-sm leading-6">{benefits.map((line, i) => <BenefitLine key={`${i}-${line}`} line={line} highlight={highlight} />)}</ul>
        </section>}

        {plan.modules.length > 0 && <section aria-label="Módulos incluidos" className={benefits.length > 0 ? '' : `border-t pt-5 ${highlight ? 'border-white/15' : 'border-[#004e28]/10'}`}>
          <div className="mb-3 flex items-center justify-between gap-2"><h4 className={`text-[10px] font-semibold uppercase tracking-[.18em] ${highlight ? 'text-[#b7e6a5]' : 'text-[#004e28]'}`}>Herramientas incluidas</h4><span className={`rounded-full px-2 py-0.5 text-xs ${highlight ? 'bg-white/10 text-white/80' : 'bg-[#edf6ef] text-[#004e28]'}`}>{plan.modules.length}</span></div>
          <div className="space-y-2">{plan.modules.map(module => <ModuleBlock key={module.code} module={module} highlight={highlight} />)}</div>
        </section>}
      </div>
    </article>
  );
};

type SellPlansProps = {
  accessCode?: string;
  intent?: SellIntent;
  featuredPlanId?: number;
  campaignQuery?: string;
};

export default function SellPlans({ accessCode = '', intent, featuredPlanId, campaignQuery = '' }: SellPlansProps) {
  const [serverPlans, setServerPlans] = useState<SellPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const normalizedAccessCode = featuredPlanId ? '' : accessCode.trim();
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const orderedPlans = [...serverPlans].sort((a, b) =>
    Number(b.isDirectory) - Number(a.isDirectory) || a.annualizedPrice - b.annualizedPrice || a.id - b.id,
  );
  const featuredPlan = orderedPlans.find((plan) => plan.id === featuredPlanId);
  const visiblePlans = featuredPlan ? [featuredPlan] : intent ? orderedPlans.filter((plan) => matchesIntent(plan, intent)) : orderedPlans;
  const allPlansHref = campaignQuery ? `/sell?${campaignQuery}#plans` : '/sell#plans';

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

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: unknown = await response.json();
        if (mounted) {
          setServerPlans(pickArray(data).map(mapApiPlan));
          setLoadFailed(false);
        }
      } catch (error) {
        console.error('[SellPlans] Error loading plans:', error);
        if (mounted) setLoadFailed(true);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    loadPlans();

    return () => {
      mounted = false;
    };
  }, [normalizedAccessCode, attempt]);

  return (
    <section id="plans" className="scroll-mt-24 relative overflow-hidden bg-gradient-to-b from-white via-gray-50 to-white py-20 md:py-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[120%] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="container relative mx-auto px-4">
        <div className="mx-auto mb-14 max-w-3xl text-center md:mb-20">
          <h2 className="font-[family-name:var(--font-varela-round)] text-3xl text-[#004e28] md:text-5xl">
            {featuredPlan ? 'El plan de la demo' : intent ? intentLabels[intent] : 'Elige con qué quieres empezar'}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-gray-600 md:text-lg">
            Empieza con lo que necesitas hoy. Si tu negocio crece y necesitas más herramientas, puedes explorar otros planes. También puedes elegir una tienda desde el primer día.
          </p>
          {intent || featuredPlan ? <Link href={allPlansHref} className="mt-3 inline-flex min-h-11 items-center font-semibold text-[#004e28] underline underline-offset-4">Ver todos los planes</Link> : null}
        </div>

        <div className="mx-auto grid max-w-7xl grid-cols-1 items-stretch gap-6 md:grid-cols-2 md:gap-7 xl:grid-cols-3">
          {isLoading && (
            <div className="flex min-h-80 items-center justify-center rounded-3xl border border-gray-200 bg-white text-sm text-gray-500 shadow-sm md:col-span-2 xl:col-span-3">
              Cargando planes...
            </div>
          )}

          {!isLoading && loadFailed ? (
            <div role="status" className="col-span-full rounded-2xl border border-gray-200 bg-white p-8 text-center">
              <p className="text-gray-800">No pudimos cargar los planes en este momento.</p>
              <button type="button" className="mt-4 min-h-12 rounded-xl bg-[#004e28] px-5 font-semibold text-white" onClick={() => { setIsLoading(true); setAttempt((value) => value + 1); }}>
                Volver a intentar
              </button>
            </div>
          ) : null}

          {!isLoading && !loadFailed && visiblePlans.length === 0 ? (
            <p className="col-span-full rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-600">
              {intent ? 'En este momento no hay planes publicados para esta opción.' : 'En este momento no hay planes activos para mostrar.'}
            </p>
          ) : null}

          {!isLoading && !loadFailed && visiblePlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              highlight={plan.id === visiblePlans[0]?.id}
              isEntryPlan={!intent && !featuredPlan}
              registerHref={buildRegisterHref(plan.id, campaignQuery, Boolean(featuredPlanId))}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
