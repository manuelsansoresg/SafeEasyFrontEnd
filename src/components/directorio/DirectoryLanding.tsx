"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, BriefcaseBusiness, Check, Clock3, Facebook, Images, Instagram, Link2, MessageCircle, Scissors, Store, UtensilsCrossed, Wrench } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import { useEffect, useMemo, useRef, useState } from "react";
import { BusinessPreview } from "@/components/directorio/BusinessPreview";
import { MarketingCta, MarketingFaq, MarketingStickyCta, MarketingWhatsappButton } from "@/components/marketing/MarketingBlocks";
import { getPlanFeatureLines } from "@/components/sell/planText";
import { trackMetaCustomEvent, trackMetaEvent } from "@/lib/metaPixel";
import { useAuthStore } from "@/store/useAuthStore";
import type { Plan } from "@/types/subscriptions";

type DirectoryLandingProps = { initialPlan: Plan | null; campaignParams: Array<[string, string]> };
type MarketingEvent = "directory_view" | "directory_cta_click" | "directory_whatsapp_click";
type AnalyticsWindow = Window & { dataLayer?: Array<Record<string, unknown>> };

const WHATSAPP_URL = `https://wa.me/529992685617?text=${encodeURIComponent("Hola, vi Drooopy y quiero saber cómo publicar mi negocio.")}`;
const headingClass = "font-[family-name:var(--font-varela-round)] tracking-[-0.035em] text-[#004e28]";
const sectionClass = "mx-auto max-w-7xl px-5 sm:px-8 lg:px-10";

const benefits = [
  { icon: BriefcaseBusiness, title: "Servicios claros", text: "Muestra lo que haces sin que tus clientes tengan que adivinarlo." },
  { icon: Images, title: "Imágenes que hablan", text: "Enseña tus trabajos, productos o tu espacio." },
  { icon: Clock3, title: "Horarios y ubicación", text: "Pon los datos prácticos donde todos puedan encontrarlos." },
  { icon: MessageCircle, title: "Contacto directo", text: "Haz sencillo dar el siguiente paso y escribirte." },
];
const extraBenefits = ["Página de tu negocio", "Enlace y código QR", "Información sobre ti", "Edición desde tu panel"];
const problems = [
  { number: "01", title: "Información dispersa", text: "Es difícil saber exactamente qué ofreces." },
  { number: "02", title: "Fotos y servicios mezclados", text: "Hay que buscar demasiado para entender tu negocio." },
  { number: "03", title: "Preguntas repetidas", text: "Horarios, ubicación y contacto se responden una y otra vez." },
];
const steps = [
  { number: "1", title: "Elige tu plan", text: "Revisa lo que incluye y comienza con tu negocio." },
  { number: "2", title: "Completa tu información", text: "Agrega servicios, imágenes, horarios y contacto." },
  { number: "3", title: "Comparte tu espacio", text: "Envía tu enlace o código QR a tus clientes." },
];
const categories = ["Restaurantes", "Salones y spas", "Profesionales", "Talleres", "Constructoras", "Inmobiliarias", "Tiendas", "Servicios", "Emprendedores"];
const categoryIcons = [UtensilsCrossed, Scissors, BriefcaseBusiness, Wrench, Store];

const formatCurrency = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);
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
  (window as AnalyticsWindow).dataLayer?.push(detail);
  if (event === "directory_cta_click") trackMetaCustomEvent("DirectoryCtaClick", { placement });
  if (event === "directory_whatsapp_click") trackMetaEvent("Contact", { content_name: "WhatsApp Directorio" });
};

export function DirectoryLanding({ initialPlan, campaignParams }: DirectoryLandingProps) {
  const user = useAuthStore((state) => state.user);
  const [plan, setPlan] = useState<Plan | null>(initialPlan);
  const [loadingPlan, setLoadingPlan] = useState(!initialPlan);
  const [heroVisible, setHeroVisible] = useState(true);
  const [priceVisible, setPriceVisible] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const priceRef = useRef<HTMLElement>(null);
  const originalParams = useMemo(() => new URLSearchParams(campaignParams), [campaignParams]);
  const accessCode = originalParams.get("code")?.trim() ?? "";

  useEffect(() => { emitMarketingEvent("directory_view"); }, []);
  useEffect(() => {
    if (plan) return;
    let mounted = true;
    const params = new URLSearchParams({ skip: "0", limit: "1000", only_active: "true" });
    if (accessCode) { params.set("access_code", accessCode); params.set("is_demo", "true"); }
    else { params.set("is_listed", "true"); params.set("is_demo", "false"); }
    fetch(`/api/plans/?${params.toString()}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: unknown) => { if (mounted) setPlan(pickPlanArray(payload).find((item) => item.is_active && item.is_directory) ?? null); })
      .catch(() => { if (mounted) setPlan(null); })
      .finally(() => { if (mounted) setLoadingPlan(false); });
    return () => { mounted = false; };
  }, [accessCode, plan]);
  useEffect(() => {
    const hero = heroRef.current;
    const price = priceRef.current;
    if (!hero || !price || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.target === hero) setHeroVisible(entry.isIntersecting);
      if (entry.target === price) setPriceVisible(entry.isIntersecting);
    }), { threshold: 0.18 });
    observer.observe(hero);
    observer.observe(price);
    return () => observer.disconnect();
  }, []);

  const registerHref = useMemo(() => {
    if (!plan) return "#precio";
    const params = new URLSearchParams(campaignParams);
    params.set("plan", String(plan.id));
    params.set("checkout", "directory");
    const role = user?.role?.toLowerCase();
    const path = role === "supplier" || role === "admin" ? "/admin/my-subscription" : user ? "/client/become-supplier" : "/sell/register";
    return `${path}?${params.toString()}`;
  }, [campaignParams, plan, user]);
  const planFeatureLines = plan ? getPlanFeatureLines({ features: plan.features, description: plan.description, isDirectory: plan.is_directory }) : [];
  const featuredLines = planFeatureLines.slice(0, 4);
  const remainingLines = planFeatureLines.slice(4);
  const faqs = [
    { question: "¿Tengo que saber crear páginas web?", answer: "No. Puedes completar la información de tu negocio desde tu panel de Drooopy." },
    { question: "¿Puedo cambiar mis datos después?", answer: "Sí. Desde tu panel puedes actualizar la información de la empresa, servicios, imágenes, horarios y datos de contacto disponibles en tu espacio." },
    { question: "¿Cuánto tiempo permanece publicado mi negocio?", answer: plan?.duration === "monthly" ? "Tu plan tiene vigencia mensual. Tu espacio puede permanecer publicado mientras la suscripción esté activa." : "Tu plan tiene vigencia anual. Tu espacio puede permanecer publicado mientras la suscripción esté activa." },
    { question: "¿Qué necesito para comenzar?", answer: "El nombre de tu negocio, una descripción, tus servicios, datos de contacto, horarios e imágenes. Puedes completar y mejorar tu espacio desde tu panel." },
    { question: "¿Puedo pasar después a un plan para vender productos?", answer: "Drooopy también cuenta con planes para negocios que quieren publicar y vender productos.", href: "/sell", linkLabel: "Conocer los planes para vender" },
    { question: "¿Puedo compartir mi espacio en redes o WhatsApp?", answer: "Sí. Tu negocio tendrá un enlace dentro de Drooopy y podrás generar un código QR desde tu panel para compartirlo." },
  ];
  const trackCta = (placement: string) => emitMarketingEvent("directory_cta_click", placement);

  return <div className="min-h-screen overflow-x-clip bg-white pb-20 text-[#17251c] selection:bg-[#c8efb9] md:pb-0">
    <a href="#contenido-directorio" className="fixed left-4 top-3 z-[100] -translate-y-24 rounded-lg bg-white px-4 py-2 font-semibold text-[#004e28] shadow-lg focus:translate-y-0">Ir al contenido</a>
    <header className="sticky top-0 z-30 border-b border-[#004e28]/10 bg-white/95 backdrop-blur-sm">
      <div className={`${sectionClass} flex h-16 items-center justify-between gap-3 sm:h-[72px]`}>
        <Link href="/" aria-label="Drooopy, ir al inicio" className="relative h-10 w-32 shrink-0 sm:w-40"><Image src="/LOGO DROOOPY NEGRO.svg" alt="Drooopy" fill priority className="object-contain object-left" /></Link>
        <nav aria-label="Navegación de la página" className="flex items-center gap-2 sm:gap-5">
          <a href="#como-funciona" className="hidden text-sm font-semibold text-[#004e28] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#004e28] sm:inline">Cómo funciona</a>
          <Link href="/login" className="hidden text-sm font-semibold text-[#004e28] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#004e28] min-[390px]:inline">Ingresar</Link>
          <a href="#precio" className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#004e28] px-4 text-xs font-bold text-[#004e28] hover:bg-[#f2f3f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004e28] sm:text-sm">Ver plan</a>
        </nav>
      </div>
    </header>
    <main id="contenido-directorio">
      <section ref={heroRef} className="relative overflow-hidden bg-[#fbfcfa] py-10 sm:py-16 lg:py-20" aria-labelledby="directory-title">
        <div className={`${sectionClass} grid items-center gap-10 lg:grid-cols-[0.94fr_1.06fr] lg:gap-16`}>
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">Drooopy para negocios</p>
            <h1 id="directory-title" className={`${headingClass} mt-4 text-[2.35rem] leading-[1.08] sm:text-5xl lg:text-[3.65rem]`}>Haz que más personas encuentren tu negocio <span className="text-[#168e00]">y entiendan por qué elegirte.</span></h1>
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-[#40554a] sm:text-lg sm:leading-8">Reúne tus servicios, imágenes, horarios, ubicación y formas de contacto en un solo espacio fácil de compartir.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"><a href="#precio" onClick={() => trackCta("hero")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#168e00] px-6 py-3 text-sm font-bold text-white hover:bg-[#116f04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004e28] sm:text-base">Quiero publicar mi negocio <ArrowRight size={18} aria-hidden="true" /></a><a href="#como-funciona" className="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-semibold text-[#004e28] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#004e28]">Ver cómo funciona <ArrowDown size={17} aria-hidden="true" /></a></div>
            <p className="mt-3 text-xs text-[#486052]">{plan ? `Plan ${plan.duration === "monthly" ? "mensual" : "anual"} · ` : ""}Administra tu información desde tu panel</p>
          </div>
          <div className="relative mx-auto w-full max-w-[540px] lg:max-w-none"><div className="absolute -inset-3 rounded-[2rem] bg-[#dfeede] sm:-inset-5" aria-hidden="true" /><div className="relative mx-auto max-w-[470px] -rotate-1"><BusinessPreview compact /></div><p className="relative mt-5 text-center text-xs font-medium text-[#45614d]">Ejemplo ilustrativo · Así podría verse tu negocio</p></div>
        </div>
      </section>
      <div className="border-y border-[#004e28]/10 bg-white"><ul className={`${sectionClass} grid grid-cols-2 gap-x-5 gap-y-3 py-4 text-xs font-semibold text-[#004e28] sm:grid-cols-4 sm:text-sm`}>{["Tu espacio en Drooopy", "Edita tu información", "Enlace para compartir", "Código QR"].map((item) => <li key={item} className="flex items-center gap-2"><Check size={16} className="shrink-0 text-[#168e00]" aria-hidden="true" />{item}</li>)}</ul></div>
      <section className="py-16 sm:py-24" aria-labelledby="problem-title"><div className={sectionClass}><div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">¿Te ha pasado?</p><h2 id="problem-title" className={`${headingClass} mt-3 text-3xl leading-tight sm:text-4xl`}>Tus clientes no deberían buscar entre publicaciones para entender qué haces.</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-[#40554a] sm:text-base">En redes sociales la información se pierde entre publicaciones, historias y mensajes. Drooopy reúne lo importante de tu negocio en un solo lugar.</p></div><div className="mt-9 grid gap-0 border-y border-[#004e28]/15 sm:grid-cols-3">{problems.map((item) => <div key={item.number} className="border-b border-[#004e28]/15 py-5 last:border-b-0 sm:border-b-0 sm:border-r sm:px-6 sm:first:pl-0 sm:last:border-r-0"><span className="text-xs font-bold text-[#168e00]">{item.number}</span><h3 className={`${headingClass} mt-2 text-lg`}>{item.title}</h3><p className="mt-2 text-sm leading-6 text-[#40554a]">{item.text}</p></div>)}</div></div></section>
      <section id="beneficios" className="bg-[#f2f3f4] py-16 sm:py-24" aria-labelledby="benefits-title"><div className={sectionClass}><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">Todo más claro</p><h2 id="benefits-title" className={`${headingClass} mt-3 text-3xl leading-tight sm:text-4xl`}>Todo lo importante de tu negocio, en un solo lugar.</h2></div><div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{benefits.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-2xl bg-white p-5 sm:p-6"><Icon size={23} className="text-[#168e00]" aria-hidden="true" /><h3 className={`${headingClass} mt-4 text-lg`}>{title}</h3><p className="mt-2 text-sm leading-6 text-[#40554a]">{text}</p></article>)}</div><ul className="mt-5 grid gap-x-6 gap-y-2 text-sm font-semibold text-[#004e28] sm:grid-cols-2 lg:grid-cols-4">{extraBenefits.map((item) => <li key={item} className="flex items-center gap-2 py-2"><Check size={16} className="text-[#168e00]" aria-hidden="true" />{item}</li>)}</ul><a href="#precio" onClick={() => trackCta("benefits")} className="mt-6 inline-flex min-h-11 items-center gap-2 font-bold text-[#005c2e] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#004e28]">Quiero publicar mi negocio <ArrowRight size={17} aria-hidden="true" /></a></div></section>
      <section className="border-b border-[#004e28]/10 bg-white py-9 sm:py-11" aria-labelledby="menu-title"><div className={`${sectionClass} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}><div><h2 id="menu-title" className={`${headingClass} text-xl sm:text-2xl`}>¿Tienes un restaurante o negocio de comida?</h2><p className="mt-2 text-sm leading-6 text-[#40554a]">Cuando corresponda a tu plan, también puedes mostrar tu menú en tu espacio.</p></div><a href="#precio" className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start font-semibold text-[#005c2e] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#004e28]">Ver el plan <ArrowRight size={17} aria-hidden="true" /></a></div></section>
      <section className="py-16 sm:py-24" aria-labelledby="preview-title"><div className={`${sectionClass} grid items-center gap-9 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20`}><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">Así podría verse tu negocio</p><h2 id="preview-title" className={`${headingClass} mt-3 text-3xl leading-tight sm:text-4xl`}>Tu negocio merece algo más claro que una lista de publicaciones.</h2><p className="mt-5 text-sm leading-7 text-[#40554a] sm:text-base">Una portada, tus servicios, imágenes, horarios y formas de contacto: todo en un espacio que puedes enviar cuando alguien pregunte por ti.</p><p className="mt-5 flex items-center gap-2 text-sm font-semibold text-[#004e28]"><Link2 size={18} aria-hidden="true" /> Un enlace y un QR para compartir</p></div><div className="rounded-[2rem] bg-[#edf3eb] p-4 sm:p-9"><div className="mx-auto max-w-[590px]"><BusinessPreview /></div></div></div></section>
      <section id="como-funciona" className="scroll-mt-20 bg-[#f2f3f4] py-16 sm:py-24" aria-labelledby="steps-title"><div className={sectionClass}><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">En tres pasos</p><h2 id="steps-title" className={`${headingClass} mt-3 text-3xl leading-tight sm:text-4xl`}>Publicar tu negocio es más sencillo de lo que parece.</h2></div><ol className="mt-9 grid gap-4 sm:grid-cols-3">{steps.map((step) => <li key={step.number} className="border-t-2 border-[#004e28] pt-5"><span className="font-[family-name:var(--font-varela-round)] text-3xl text-[#168e00]">{step.number}</span><h3 className={`${headingClass} mt-3 text-xl`}>{step.title}</h3><p className="mt-2 text-sm leading-6 text-[#40554a]">{step.text}</p></li>)}</ol></div></section>
      <section className="py-14 sm:py-20" aria-labelledby="audience-title"><div className={sectionClass}><h2 id="audience-title" className={`${headingClass} max-w-2xl text-3xl leading-tight sm:text-4xl`}>Si tienes algo que ofrecer, tienes algo que mostrar.</h2><div className="mt-8 flex flex-wrap gap-2">{categories.map((category, index) => { const Icon = categoryIcons[index % categoryIcons.length]; return <span key={category} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#004e28]/15 px-4 py-2 text-sm font-medium text-[#234631]"><Icon size={15} className="text-[#168e00]" aria-hidden="true" />{category}</span>; })}</div></div></section>
      <section id="precio" ref={priceRef} className="scroll-mt-20 bg-[#004e28] py-16 text-white sm:py-24" aria-labelledby="pricing-title"><div className={`${sectionClass} grid items-center gap-9 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16`}><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b3ecaa]">Plan Directorio</p><h2 id="pricing-title" className="mt-3 font-[family-name:var(--font-varela-round)] text-3xl leading-tight tracking-[-0.035em] sm:text-4xl">Empieza con un espacio profesional para tu negocio.</h2><p className="mt-5 max-w-md text-sm leading-7 text-white/85 sm:text-base">Muestra lo esencial para que las personas entiendan qué haces y puedan contactarte.</p></div><div className="rounded-[1.75rem] bg-white p-6 text-[#17251c] sm:p-9"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">{plan?.title || "Plan Directorio"}</p><h3 className={`${headingClass} mt-2 text-2xl`}>Tu espacio en Drooopy</h3></div>{plan ? <span className="rounded-full bg-[#e9f4e5] px-3 py-1.5 text-xs font-bold text-[#005c2e]">{plan.duration === "monthly" ? "Vigencia mensual" : "Vigencia anual"}</span> : null}</div><div className="mt-7 min-h-16" aria-live="polite">{plan ? <><div className="flex flex-wrap items-end gap-x-2"><span className={`${headingClass} text-5xl leading-none sm:text-6xl`}>{formatCurrency(plan.price)}</span><span className="pb-1 text-sm font-semibold text-[#40554a]">MXN / {plan.duration === "monthly" ? "mes" : "año"}</span></div><p className="mt-2 text-xs text-[#40554a]">Cobro {plan.duration === "monthly" ? "mensual" : "anual"}</p></> : <p className="text-sm font-semibold text-[#40554a]">{loadingPlan ? "Consultando el precio actual…" : "El Plan Directorio no está disponible en este momento."}</p>}</div>{plan ? <><p className="mt-7 border-t border-[#004e28]/15 pt-6 text-sm font-bold text-[#004e28]">{featuredLines.length ? "Lo esencial incluido" : "Información del plan"}</p>{featuredLines.length ? <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">{featuredLines.map((line, index) => <li key={`${line}-${index}`} className="flex items-start gap-2 text-sm leading-6 text-[#40554a]"><Check size={17} className="mt-1 shrink-0 text-[#168e00]" aria-hidden="true" />{line}</li>)}</ul> : <p className="mt-2 text-sm leading-6 text-[#40554a]">Consulta los detalles completos del plan durante el registro.</p>}{remainingLines.length ? <details className="mt-4"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-[#005c2e] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#004e28]">Ver todo lo incluido</summary><ul className="mt-2 grid gap-2 border-t border-[#004e28]/10 pt-4">{remainingLines.map((line, index) => <li key={`${line}-${index}`} className="flex items-start gap-2 text-sm leading-6 text-[#40554a]"><Check size={16} className="mt-1 shrink-0 text-[#168e00]" aria-hidden="true" />{line}</li>)}</ul></details> : null}</> : null}<MarketingCta href={registerHref} onClick={() => trackCta("pricing")} disabled={!plan} className="mt-7 w-full" /><p className="mt-3 text-center text-xs text-[#40554a]">El siguiente paso te lleva al registro y contratación del plan.</p></div></div></section>
      <section className="bg-[#f7f9f6] py-14 sm:py-20" aria-labelledby="reassurance-title"><div className={sectionClass}><h2 id="reassurance-title" className={`${headingClass} max-w-2xl text-2xl leading-tight sm:text-3xl`}>¿Todavía no sabes si es para tu negocio?</h2><ul className="mt-6 grid gap-3 sm:grid-cols-3">{["Actualiza tu información desde tu panel.", "Comparte tu espacio por enlace o código QR.", "Si después quieres vender productos, conoce los otros planes de Drooopy."].map((item) => <li key={item} className="flex gap-3 rounded-xl bg-white p-4 text-sm leading-6 text-[#40554a]"><Check size={19} className="mt-0.5 shrink-0 text-[#168e00]" aria-hidden="true" />{item}</li>)}</ul></div></section>
      <section className="py-16 sm:py-24" aria-labelledby="faq-title"><div className="mx-auto max-w-3xl px-5 sm:px-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">Resolvamos tus dudas</p><h2 id="faq-title" className={`${headingClass} mt-3 text-3xl sm:text-4xl`}>Preguntas frecuentes</h2><div className="mt-8"><MarketingFaq items={faqs} /></div></div></section>
      <section className="bg-[#004e28] py-16 text-white sm:py-24" aria-labelledby="final-title"><div className={`${sectionClass} text-center`}><h2 id="final-title" className="mx-auto max-w-4xl font-[family-name:var(--font-varela-round)] text-3xl leading-tight tracking-[-0.035em] sm:text-5xl">La próxima vez que alguien pregunte por tu negocio, ten algo mejor que enviarle.</h2><p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/85 sm:text-base">Dale un espacio donde pueda conocer lo que haces, ver tus servicios y contactarte fácilmente.</p><MarketingCta href={registerHref} onClick={() => trackCta("final")} disabled={!plan} className="mt-8 w-full sm:w-auto" /></div></section>
    </main>
    <footer className="border-t border-[#004e28]/10 bg-white py-8"><div className={`${sectionClass} flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between`}><Link href="/" aria-label="Drooopy, ir al inicio" className="relative h-10 w-32"><Image src="/LOGO DROOOPY NEGRO.svg" alt="Drooopy" fill className="object-contain object-left" /></Link><nav aria-label="Enlaces legales" className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#40554a]"><Link href="/politicas-de-privacidad" className="hover:underline">Privacidad</Link><Link href="/terminos-y-condiciones" className="hover:underline">Términos</Link><Link href="/contacto" className="hover:underline">Contacto</Link></nav><div className="flex gap-4 text-[#004e28]" aria-label="Redes sociales"><a href="https://www.facebook.com/drooopymexico" target="_blank" rel="noreferrer" aria-label="Facebook" className="focus-visible:outline-2 focus-visible:outline-[#004e28]"><Facebook size={18} aria-hidden="true" /></a><a href="https://www.instagram.com/drooopymx" target="_blank" rel="noreferrer" aria-label="Instagram" className="focus-visible:outline-2 focus-visible:outline-[#004e28]"><Instagram size={18} aria-hidden="true" /></a><a href="https://x.com/drooopymx" target="_blank" rel="noreferrer" aria-label="X" className="focus-visible:outline-2 focus-visible:outline-[#004e28]"><FaXTwitter size={18} aria-hidden="true" /></a></div></div></footer>
    <MarketingWhatsappButton href={WHATSAPP_URL} onClick={() => emitMarketingEvent("directory_whatsapp_click", "floating")} className={`fixed right-4 z-30 shadow-md ${!heroVisible && !priceVisible && plan ? "bottom-24 md:bottom-5" : "bottom-5"}`} />
    <MarketingStickyCta visible={!heroVisible && !priceVisible && !!plan} href={registerHref} onClick={() => trackCta("sticky_mobile")} />
  </div>;
}
