"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  Facebook,
  ImagePlay,
  Images,
  Instagram,
  Link2,
  Mail,
  MapPin,
  MessageCircle,
  QrCode,
  Scissors,
  ShieldCheck,
  Sparkles,
  Store,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPlanFeatureLines } from "@/components/sell/planText";
import { useAuthStore } from "@/store/useAuthStore";
import type { Plan } from "@/types/subscriptions";

type DirectoryLandingProps = {
  initialPlan: Plan | null;
  campaignParams: Array<[string, string]>;
};

type MarketingEvent =
  | "directory_view"
  | "directory_cta_click"
  | "directory_checkout_start";

const benefits = [
  { icon: ImagePlay, title: "Imagen o video de portada", text: "Destaca tu negocio desde el primer vistazo." },
  { icon: BriefcaseBusiness, title: "Acerca de tu empresa", text: "Cuenta quién eres, qué haces y qué diferencia a tu negocio." },
  { icon: Sparkles, title: "Servicios", text: "Publica y presenta los servicios que ofrece tu empresa." },
  { icon: Images, title: "Galería de imágenes", text: "Muestra trabajos, instalaciones, productos o ejemplos de tus servicios." },
  { icon: Clock3, title: "Horarios", text: "Indica tus días y horarios de atención." },
  { icon: MessageCircle, title: "Contacto directo", text: "Facilita que las personas puedan comunicarse contigo." },
  { icon: QrCode, title: "Código QR", text: "Comparte fácilmente el espacio de tu negocio." },
  { icon: Link2, title: "Página personalizada", text: "Obtén tu propio espacio profesional dentro de Drooopy." },
];

const businessTypes = [
  "Restaurantes",
  "Salones y spas",
  "Profesionales",
  "Talleres",
  "Constructoras",
  "Inmobiliarias",
  "Tiendas",
  "Servicios",
  "Emprendedores",
];

const faqs = [
  {
    question: "¿Cuánto tiempo estará publicado mi negocio?",
    answer: "El plan Directorio tiene vigencia anual. Durante ese periodo tu espacio puede permanecer publicado mientras tu suscripción esté activa.",
  },
  {
    question: "¿Puedo modificar la información de mi negocio?",
    answer: "Sí. Desde tu panel puedes actualizar la información de la empresa, servicios, imágenes, horarios y datos de contacto disponibles en tu espacio.",
  },
  {
    question: "¿Qué necesito para comenzar?",
    answer: "El nombre de tu negocio, una descripción, tus servicios, datos de contacto, horarios e imágenes. Podrás completar y mejorar tu espacio desde tu panel.",
  },
  {
    question: "¿Puedo cambiar después a un plan para vender productos?",
    answer: "Sí. Drooopy también cuenta con planes para negocios que quieren publicar y vender productos dentro de la plataforma.",
    link: true,
  },
  {
    question: "¿Cómo puedo compartir mi espacio?",
    answer: "Tu negocio tendrá un enlace propio dentro de Drooopy y podrás generar un código QR desde tu panel para compartirlo con tus clientes.",
  },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);

const formatLimit = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0
    ? new Intl.NumberFormat("es-MX").format(value)
    : null;

const pickPlanArray = (payload: unknown): Plan[] => {
  if (Array.isArray(payload)) return payload as Plan[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const items = record.items ?? record.results ?? record.data ?? record.plans;
  return Array.isArray(items) ? (items as Plan[]) : [];
};

const emitMarketingEvent = (event: MarketingEvent, placement?: string) => {
  if (typeof window === "undefined") return;
  const detail = { event, placement, path: window.location.pathname };
  window.dispatchEvent(new CustomEvent("drooopy:marketing", { detail }));
  const analyticsWindow = window as Window & { dataLayer?: Array<Record<string, unknown>> };
  analyticsWindow.dataLayer?.push(detail);
};

function BusinessPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`overflow-hidden border border-[#004e28]/10 bg-white shadow-[0_30px_90px_-38px_rgba(0,78,40,0.55)] ${
        compact ? "rounded-[1.75rem]" : "rounded-[2.25rem]"
      }`}
      aria-label="Ejemplo visual de un espacio de negocio en el directorio de Drooopy"
    >
      <div className="relative h-44 overflow-hidden bg-[#083b29] sm:h-56">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(126,217,87,0.42),transparent_34%),linear-gradient(135deg,#123f2c_0%,#8f5d36_55%,#d5a868_100%)]" />
        <div className="absolute -right-7 bottom-[-2.5rem] h-44 w-44 rounded-full bg-[#f4d5a0]/60 blur-sm" />
        <div className="absolute bottom-5 left-5 flex items-end gap-3 sm:bottom-6 sm:left-7">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-[#f7efe4] text-[#004e28] shadow-xl sm:h-20 sm:w-20">
            <span className="font-[family-name:var(--font-varela-round)] text-2xl">CA</span>
          </div>
          <div className="pb-1 text-white drop-shadow-md">
            <p className="font-[family-name:var(--font-varela-round)] text-xl sm:text-2xl">Casa Alma</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-white/90 sm:text-sm">
              <MapPin size={13} aria-hidden="true" /> Mérida, Yucatán
            </p>
          </div>
        </div>
      </div>

      <div className={`bg-white ${compact ? "p-4" : "p-5 sm:p-7"}`}>
        <div className="grid grid-cols-3 gap-2">
          {[
            [MessageCircle, "Mensaje"],
            [MapPin, "Ubicación"],
            [QrCode, "Compartir"],
          ].map(([Icon, label]) => {
            const PreviewIcon = Icon as typeof MessageCircle;
            return (
              <div key={label as string} className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl bg-[#f2f3f4] px-2 py-2.5 text-[#004e28]">
                <PreviewIcon size={17} aria-hidden="true" />
                <span className="truncate text-[10px] font-semibold sm:text-xs">{label as string}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-5">
          <p className="font-[family-name:var(--font-varela-round)] text-base text-[#004e28] sm:text-lg">Acerca de nosotros</p>
          <p className="mt-1.5 text-xs leading-5 text-[#53645b] sm:text-sm">
            Cocina artesanal, ingredientes locales y un espacio creado para disfrutar sin prisas.
          </p>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <p className="font-[family-name:var(--font-varela-round)] text-base text-[#004e28] sm:text-lg">Servicios</p>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#168e00]">Ver todos</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {["Desayunos", "Eventos privados"].map((service, index) => (
              <div key={service} className="overflow-hidden rounded-xl border border-[#004e28]/8">
                <div className={`h-14 ${index === 0 ? "bg-[linear-gradient(135deg,#deb97f,#72482d)]" : "bg-[linear-gradient(135deg,#cfe6c0,#476a42)]"}`} />
                <p className="px-2.5 py-2 text-[11px] font-semibold text-[#263c31] sm:text-xs">{service}</p>
              </div>
            ))}
          </div>
        </div>

        {!compact ? (
          <div className="mt-5 flex items-center justify-between rounded-xl border border-[#004e28]/10 px-3.5 py-3">
            <div className="flex items-center gap-2 text-xs text-[#526158] sm:text-sm">
              <Clock3 size={16} className="text-[#168e00]" aria-hidden="true" />
              <span>Lun–Sáb · 8:00–20:00</span>
            </div>
            <span className="rounded-full bg-[#e9f6e6] px-2 py-1 text-[10px] font-bold text-[#126b05]">ABIERTO</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DirectoryLanding({ initialPlan, campaignParams }: DirectoryLandingProps) {
  const user = useAuthStore((state) => state.user);
  const [plan, setPlan] = useState<Plan | null>(initialPlan);
  const [loadingPlan, setLoadingPlan] = useState(!initialPlan);
  const [heroVisible, setHeroVisible] = useState(true);
  const [priceVisible, setPriceVisible] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<HTMLDivElement>(null);

  const originalParams = useMemo(() => new URLSearchParams(campaignParams), [campaignParams]);
  const accessCode = originalParams.get("code")?.trim() ?? "";

  useEffect(() => {
    emitMarketingEvent("directory_view");
  }, []);

  useEffect(() => {
    if (plan) return;
    let mounted = true;
    const params = new URLSearchParams({ skip: "0", limit: "1000", only_active: "true" });
    if (accessCode) {
      params.set("access_code", accessCode);
      params.set("is_demo", "true");
    } else {
      params.set("is_listed", "true");
      params.set("is_demo", "false");
    }

    fetch(`/api/plans/?${params.toString()}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: unknown) => {
        if (!mounted) return;
        setPlan(pickPlanArray(payload).find((item) => item.is_active && item.is_directory) ?? null);
      })
      .catch(() => {
        if (mounted) setPlan(null);
      })
      .finally(() => {
        if (mounted) setLoadingPlan(false);
      });

    return () => {
      mounted = false;
    };
  }, [accessCode, plan]);

  useEffect(() => {
    const hero = heroRef.current;
    const price = priceRef.current;
    if (!hero || !price || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target === hero) setHeroVisible(entry.isIntersecting);
          if (entry.target === price) setPriceVisible(entry.isIntersecting);
        });
      },
      { threshold: 0.18 },
    );
    observer.observe(hero);
    observer.observe(price);
    return () => observer.disconnect();
  }, []);

  const registerHref = useMemo(() => {
    if (!plan) return "#precio";
    const params = new URLSearchParams(campaignParams);
    params.set("plan", String(plan.id));
    const role = user?.role?.toLowerCase();
    const path = role === "supplier" || role === "admin"
      ? "/admin/my-subscription"
      : user
        ? "/client/become-supplier"
        : "/sell/register";
    return `${path}?${params.toString()}`;
  }, [campaignParams, plan, user]);

  const planFeatureLines = plan
    ? getPlanFeatureLines({
        features: plan.features,
        description: plan.description,
        isDirectory: plan.is_directory,
      })
    : [];
  const serviceLimit = formatLimit(plan?.max_images_per_product);
  const galleryLimit = formatLimit(plan?.max_gallery_images);
  const priceFeatures = planFeatureLines.length > 0
    ? planFeatureLines
    : [
        "Espacio en el directorio",
        "Página personalizada del negocio",
        serviceLimit ? `Publicación de hasta ${serviceLimit} servicios` : "Publicación de servicios",
        galleryLimit ? `Galería de hasta ${galleryLimit} imágenes` : "Galería de imágenes",
        "Información, horarios y formas de contacto",
        "Código QR y enlace para compartir",
      ];

  const handleCtaClick = (placement: string) => {
    emitMarketingEvent("directory_cta_click", placement);
    emitMarketingEvent("directory_checkout_start", placement);
  };

  const ctaClass =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#168e00] px-6 py-3 text-center text-sm font-bold text-white shadow-[0_14px_28px_-14px_rgba(22,142,0,0.85)] transition hover:-translate-y-0.5 hover:bg-[#117600] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#168e00] sm:text-base";

  return (
    <div className="min-h-screen overflow-x-clip bg-white text-[#142019] selection:bg-[#b9efaa]">
      <a href="#contenido-directorio" className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-white px-4 py-2 font-semibold text-[#004e28] shadow-lg transition focus:translate-y-0">
        Ir al contenido
      </a>

      <header className="sticky top-0 z-50 border-b border-[#004e28]/8 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Drooopy, ir al inicio" className="relative h-11 w-36 shrink-0 sm:w-44">
            <Image src="/LOGO DROOOPY NEGRO.svg" alt="Drooopy" fill priority className="object-contain object-left" />
          </Link>
          <nav aria-label="Acciones de la landing" className="flex items-center gap-2 sm:gap-4">
            <Link href="/login" className="inline-flex min-h-11 items-center rounded-full px-2.5 text-xs font-semibold text-[#004e28] transition hover:bg-[#f2f3f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00] sm:px-4 sm:text-sm">
              Iniciar sesión
            </Link>
            <Link href={registerHref} onClick={() => handleCtaClick("header")} aria-disabled={!plan} className={`${ctaClass} min-h-11 px-3.5 py-2 text-xs sm:px-5 sm:text-sm ${!plan ? "pointer-events-none opacity-65" : ""}`}>
              <span className="hidden min-[390px]:inline">Registrar mi negocio</span>
              <span className="min-[390px]:hidden">Registrar</span>
            </Link>
          </nav>
        </div>
      </header>

      <main id="contenido-directorio">
        <section ref={heroRef} className="relative isolate overflow-hidden bg-[#fbfdfb] pb-16 pt-10 sm:pb-20 sm:pt-14 lg:pb-28 lg:pt-20">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_85%_16%,rgba(126,217,87,0.2),transparent_28%),radial-gradient(circle_at_10%_82%,rgba(22,142,0,0.08),transparent_28%)]" />
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16 lg:px-8">
            <div className="max-w-xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#168e00]/20 bg-[#eaf7e7] px-3.5 py-2 text-[11px] font-bold tracking-[0.18em] text-[#126b05]">
                <span className="h-2 w-2 rounded-full bg-[#168e00]" /> DIRECTORIO DROOOPY
              </span>
              <h1 className="mt-6 text-balance font-[family-name:var(--font-varela-round)] text-[2.55rem] leading-[1.04] tracking-[-0.035em] text-[#004e28] sm:text-5xl lg:text-[4rem]">
                Haz que más personas encuentren <span className="relative whitespace-nowrap text-[#168e00]">tu negocio<span className="absolute -bottom-1 left-0 h-2 w-full -rotate-1 rounded-full bg-[#7ed957]/35" aria-hidden="true" /></span>.
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-[#4d5e54] sm:text-lg sm:leading-8">
                Crea tu propio espacio dentro de Drooopy y muestra tus servicios, información, imágenes y formas de contacto en un solo lugar.
              </p>
              <div className="mt-8">
                <Link href={registerHref} onClick={() => handleCtaClick("hero")} aria-disabled={!plan} className={`${ctaClass} w-full sm:w-auto ${!plan ? "pointer-events-none opacity-65" : ""}`}>
                  Registrar mi negocio <ArrowRight size={18} aria-hidden="true" />
                </Link>
                <p className="mt-3 text-center text-xs text-[#68776e] sm:text-left">Configuración sencilla · Espacio disponible durante 1 año</p>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[610px] lg:pr-8">
              <div className="absolute -left-3 top-8 h-36 w-36 rounded-full bg-[#7ed957]/25 blur-3xl sm:-left-10" />
              <Image src="/directorio.png" alt="Directorio Drooopy" width={600} height={700} className="relative mx-auto w-full max-w-[430px] rotate-0 sm:rotate-[1.5deg] lg:ml-auto" priority />
              <div className="absolute -bottom-5 -left-1 flex items-center gap-3 rounded-2xl border border-[#004e28]/10 bg-white p-3.5 shadow-xl sm:bottom-9 sm:left-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf7e7] text-[#168e00]"><ExternalLink size={19} aria-hidden="true" /></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-[#168e00]">Tu propio enlace</p><p className="text-xs font-semibold text-[#263c31] sm:text-sm">drooopy.com/empresas/tu-negocio</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-16 sm:py-20 lg:py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#168e00]">Todo lo esencial</p>
              <h2 className="mt-3 font-[family-name:var(--font-varela-round)] text-3xl leading-tight text-[#004e28] sm:text-4xl">Tu negocio, todo en un solo espacio</h2>
              <p className="mt-4 text-base leading-7 text-[#5c6b62]">Dale a tus clientes una forma sencilla de conocerte y ponerse en contacto contigo.</p>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map(({ icon: Icon, title: benefitTitle, text }) => (
                <article key={benefitTitle} className="group rounded-2xl border border-[#004e28]/8 bg-[#fbfdfb] p-5 transition hover:-translate-y-1 hover:border-[#168e00]/25 hover:shadow-[0_18px_45px_-30px_rgba(0,78,40,0.7)]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8f6e5] text-[#168e00] transition group-hover:bg-[#168e00] group-hover:text-white"><Icon size={21} aria-hidden="true" /></div>
                  <h3 className="mt-4 font-[family-name:var(--font-varela-round)] text-lg text-[#004e28]">{benefitTitle}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#617067]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden bg-[#f2f3f4] py-16 sm:py-20 lg:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16 lg:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#168e00]">Una ficha que sí explica quién eres</p>
              <h2 className="mt-3 font-[family-name:var(--font-varela-round)] text-3xl leading-tight text-[#004e28] sm:text-4xl lg:text-5xl">Así puede verse tu negocio en Drooopy</h2>
              <p className="mt-5 text-base leading-7 text-[#59685f]">Un espacio diseñado para que las personas conozcan rápidamente quién eres, qué ofreces y cómo contactarte.</p>
              <div className="mt-7 flex items-start gap-3 rounded-2xl bg-white p-4 text-sm font-semibold leading-6 text-[#004e28] shadow-sm">
                <Link2 size={20} className="mt-0.5 shrink-0 text-[#168e00]" aria-hidden="true" />
                Tu espacio también tendrá un enlace que podrás compartir con tus clientes.
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-5 rotate-2 rounded-[2.5rem] bg-[#dcebd8]" aria-hidden="true" />
              <div className="relative"><BusinessPreview /></div>
            </div>
          </div>
        </section>

        <section className="bg-white py-14 sm:py-18">
          <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
            <h2 className="font-[family-name:var(--font-varela-round)] text-3xl text-[#004e28] sm:text-4xl">Hecho para negocios como el tuyo</h2>
            <div className="mt-8 flex flex-wrap justify-center gap-2.5">
              {businessTypes.map((business, index) => {
                const icons = [UtensilsCrossed, Scissors, BriefcaseBusiness, Wrench, Store];
                const Icon = icons[index % icons.length];
                return <span key={business} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#004e28]/10 bg-[#fbfdfb] px-4 py-2 text-sm font-semibold text-[#365043]"><Icon size={15} className="text-[#168e00]" aria-hidden="true" />{business}</span>;
              })}
            </div>
            <p className="mx-auto mt-7 max-w-2xl text-sm leading-6 text-[#617067] sm:text-base">Si tienes un negocio o prestas un servicio, puedes crear tu espacio dentro del directorio de Drooopy.</p>
          </div>
        </section>

        <section id="precio" ref={priceRef} className="relative overflow-hidden bg-[#004e28] py-16 text-white sm:py-20 lg:py-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_12%,rgba(126,217,87,0.18),transparent_32%),radial-gradient(circle_at_90%_80%,rgba(255,255,255,0.1),transparent_28%)]" />
          <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#aaf396]">Un plan. Todo tu espacio.</p>
              <h2 className="mt-4 font-[family-name:var(--font-varela-round)] text-3xl leading-tight sm:text-4xl lg:text-5xl">Haz visible tu negocio en Drooopy</h2>
              <p className="mt-5 text-base leading-7 text-white/75">Publica la información que tus clientes necesitan para entender tu negocio y ponerse en contacto contigo.</p>
            </div>
            <div className="rounded-[2rem] bg-white p-6 text-[#142019] shadow-[0_30px_90px_-35px_rgba(0,0,0,0.75)] sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#168e00]">PLAN DIRECTORIO</p><h3 className="mt-2 font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28]">Tu espacio profesional</h3></div>
                <div className="rounded-full bg-[#e9f6e6] px-3 py-1.5 text-xs font-bold text-[#126b05]">VIGENCIA ANUAL</div>
              </div>
              <div className="mt-7 min-h-[58px]" aria-live="polite">
                {plan ? <div className="flex items-end gap-2"><span className="font-[family-name:var(--font-varela-round)] text-5xl leading-none text-[#004e28] sm:text-6xl">{formatCurrency(plan.price)}</span><span className="pb-1 text-sm font-semibold text-[#607068]">/{plan.duration === "monthly" ? "mes" : "año"}</span></div> : <p className="text-sm font-semibold text-[#607068]">{loadingPlan ? "Consultando el precio actual…" : "El plan Directorio no está disponible en este momento."}</p>}
              </div>
              {plan ? <ul className="mt-7 grid gap-3 border-t border-[#004e28]/10 pt-6 sm:grid-cols-2">{priceFeatures.map((feature, index) => <li key={`${feature}-${index}`} className="flex items-start gap-2.5 text-sm leading-6 text-[#4d5f55]"><span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e9f6e6] text-[#168e00]"><Check size={13} strokeWidth={3} aria-hidden="true" /></span>{feature}</li>)}</ul> : null}
              <Link href={registerHref} onClick={() => handleCtaClick("price")} aria-disabled={!plan} className={`${ctaClass} mt-7 w-full ${!plan ? "pointer-events-none opacity-65" : ""}`}>Registrar mi negocio <ArrowRight size={18} aria-hidden="true" /></Link>
              <p className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-[#64736b]"><ShieldCheck size={15} className="text-[#168e00]" aria-hidden="true" /> Pago seguro con Mercado Pago</p>
            </div>
          </div>
        </section>

        <section className="bg-[#fbfdfb] py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#168e00]">Antes de comenzar</p><h2 className="mt-3 font-[family-name:var(--font-varela-round)] text-3xl text-[#004e28] sm:text-4xl">Preguntas frecuentes</h2></div>
            <div className="mt-9 space-y-3">
              {faqs.map((faq) => <details key={faq.question} className="group rounded-2xl border border-[#004e28]/10 bg-white px-5 py-1 open:shadow-[0_16px_45px_-34px_rgba(0,78,40,0.8)]"><summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold text-[#173326] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00]"><span>{faq.question}</span><ChevronDown className="shrink-0 text-[#168e00] transition group-open:rotate-180" size={20} aria-hidden="true" /></summary><div className="pb-5 pr-8 text-sm leading-7 text-[#5b6a62]"><p>{faq.answer}</p>{faq.link ? <Link href="/sell/" className="mt-3 inline-flex items-center gap-1.5 font-bold text-[#126b05] underline decoration-[#168e00]/35 underline-offset-4 hover:decoration-[#168e00]">Conocer planes para vender productos <ArrowRight size={15} aria-hidden="true" /></Link> : null}</div></details>)}
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-8 sm:px-6 sm:py-12">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[#004e28] px-5 py-12 text-center text-white shadow-[0_28px_80px_-45px_rgba(0,78,40,0.9)] sm:px-10 sm:py-16">
            <h2 className="mx-auto max-w-3xl font-[family-name:var(--font-varela-round)] text-3xl leading-tight sm:text-4xl lg:text-5xl">Dale a tu negocio un espacio dentro de Drooopy</h2>
            <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">Haz que las personas puedan conocer tus servicios y encontrarte fácilmente desde un solo lugar.</p>
            <Link href={registerHref} onClick={() => handleCtaClick("final")} aria-disabled={!plan} className={`${ctaClass} mt-8 w-full bg-white text-[#004e28] shadow-none hover:bg-[#f2f3f4] sm:w-auto ${!plan ? "pointer-events-none opacity-65" : ""}`}>Registrar mi negocio <ArrowRight size={18} aria-hidden="true" /></Link>
            <p className="mt-3 text-xs text-white/60">Tu espacio en Drooopy comienza aquí.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#004e28]/10 bg-[#fbfdfb] pb-24 pt-9 sm:pb-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row lg:px-8">
          <Link href="/" aria-label="Drooopy, ir al inicio" className="relative h-10 w-36"><Image src="/LOGO DROOOPY NEGRO.svg" alt="Drooopy" fill className="object-contain object-left" /></Link>
          <nav aria-label="Enlaces legales" className="flex flex-wrap justify-center gap-x-5 gap-y-3 text-xs font-semibold text-[#526359] sm:text-sm"><Link href="/politicas-de-privacidad" className="hover:text-[#168e00]">Aviso de privacidad</Link><Link href="/terminos-y-condiciones" className="hover:text-[#168e00]">Términos y condiciones</Link><Link href="/contacto" className="hover:text-[#168e00]">Contacto</Link></nav>
          <div className="flex gap-2 text-[#004e28]" aria-label="Redes sociales de Drooopy"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e9f6e6]"><Facebook size={16} aria-hidden="true" /></span><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e9f6e6]"><Instagram size={16} aria-hidden="true" /></span><span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e9f6e6]"><Mail size={16} aria-hidden="true" /></span></div>
        </div>
        <p className="mt-6 text-center text-xs text-[#718078]">© {new Date().getFullYear()} Drooopy</p>
      </footer>

      {!heroVisible && !priceVisible && plan ? <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#004e28]/10 bg-white/96 p-3 shadow-[0_-10px_35px_-20px_rgba(0,78,40,0.6)] backdrop-blur md:hidden"><Link href={registerHref} onClick={() => handleCtaClick("sticky_mobile")} className={`${ctaClass} w-full`}>Registrar mi negocio <ArrowRight size={18} aria-hidden="true" /></Link></div> : null}

    </div>
  );
}
