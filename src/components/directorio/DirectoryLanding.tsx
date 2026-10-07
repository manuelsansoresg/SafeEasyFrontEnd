"use client";

import Image from "next/image";
import { BriefcaseBusiness, Check, Images, MapPin, MessageCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { DirectoryLeadForm } from "@/components/directorio/DirectoryLeadForm";
import { MarketingCta, MarketingFaq, MarketingStickyCta, MarketingWhatsappButton } from "@/components/marketing/MarketingBlocks";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/MarketingChrome";
import { getPlanFeatureLines } from "@/components/sell/planText";
import { campaignWhatsAppUrl, emitCampaignEvent, type CampaignAction } from "@/lib/marketingCampaign";
import type { Plan } from "@/types/subscriptions";

type DirectoryLandingProps = {
  initialPlan: Plan | null;
  campaignParams: Array<[string, string]>;
};
const WHATSAPP_URL = campaignWhatsAppUrl("directory");
const containerClass = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10";
const headingClass = "font-[family-name:var(--font-varela-round)] tracking-[-0.025em] text-[#004e28]";

const benefits = [
  { icon: BriefcaseBusiness, title: "Servicios", text: "Muestra claramente lo que ofreces." },
  { icon: Images, title: "Imágenes", text: "Enseña tu trabajo, productos o instalaciones." },
  { icon: MapPin, title: "Horarios y ubicación", text: "Pon la información que tus clientes buscan." },
  { icon: MessageCircle, title: "Contacto directo", text: "Haz sencillo que puedan comunicarse contigo." },
];
const extraBenefits = ["Página de tu negocio", "Enlace para compartir", "Código QR", "Edición desde tu panel"];
const steps = [
  { number: "01", title: "Déjanos tus datos", text: "Solo necesitamos tu nombre y WhatsApp." },
  { number: "02", title: "Te orientamos", text: "Vemos la opción adecuada para ti." },
  { number: "03", title: "Preparamos tu espacio", text: "Organizamos tu negocio en Drooopy." },
];

const formatCurrency = (value: number) => new Intl.NumberFormat("es-MX", {
  style: "currency", currency: "MXN", maximumFractionDigits: 0,
}).format(value);

const pickPlanArray = (payload: unknown): Plan[] => {
  if (Array.isArray(payload)) return payload as Plan[];
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const items = record.items ?? record.results ?? record.data ?? record.plans;
  return Array.isArray(items) ? items as Plan[] : [];
};

const emitMarketingEvent = (event: `directory_${CampaignAction}`, placement?: string) =>
  emitCampaignEvent("directory", event.replace("directory_", "") as CampaignAction, placement);

export function DirectoryLanding({ initialPlan, campaignParams }: DirectoryLandingProps) {
  const [plan, setPlan] = useState<Plan | null>(initialPlan);
  const [loadingPlan, setLoadingPlan] = useState(!initialPlan);
  const [heroVisible, setHeroVisible] = useState(true);
  const [priceVisible, setPriceVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const priceRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLElement>(null);
  const trackedView = useRef(false);
  const originalParams = useMemo(() => new URLSearchParams(campaignParams), [campaignParams]);
  const accessCode = originalParams.get("code")?.trim() ?? "";

  useEffect(() => {
    if (trackedView.current) return;
    trackedView.current = true;
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
      .then((response) => response.ok ? response.json() : null)
      .then((payload: unknown) => {
        if (mounted) setPlan(pickPlanArray(payload).find((item) => item.is_active && item.is_directory) ?? null);
      })
      .catch(() => { if (mounted) setPlan(null); })
      .finally(() => { if (mounted) setLoadingPlan(false); });
    return () => { mounted = false; };
  }, [accessCode, plan]);
  useEffect(() => {
    const observed = [heroRef.current, priceRef.current, formRef.current].filter((item): item is HTMLElement => !!item);
    if (!observed.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.target === heroRef.current) setHeroVisible(entry.isIntersecting);
      if (entry.target === priceRef.current) setPriceVisible(entry.isIntersecting);
      if (entry.target === formRef.current) setFormVisible(entry.isIntersecting);
    }), { threshold: 0.18 });
    observed.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  const featureLines = plan ? getPlanFeatureLines({
    features: plan.features,
    description: plan.description,
    isDirectory: plan.is_directory,
  }) : [];
  const visibleFeatures = featureLines.slice(0, 4);
  const moreFeatures = featureLines.slice(4);
  const faqs = [
    { question: "¿Necesito saber crear páginas web?", answer: "No. Podrás administrar la información desde tu panel." },
    { question: "¿Puedo cambiar mis datos después?", answer: "Sí. Puedes actualizar la información de tu negocio desde tu panel." },
    { question: "¿Cuánto tiempo estará publicado?", answer: plan ? `Durante la vigencia ${plan.duration === "monthly" ? "mensual" : "anual"} de tu plan, mientras esté activo.` : "Depende de la vigencia del plan disponible." },
    { question: "¿Qué necesito para comenzar?", answer: "Información básica de tu negocio, servicios e imágenes." },
    { question: "¿Puedo cambiar después a otro plan?", answer: "Sí, según las opciones disponibles en Drooopy." },
  ];
  const trackCta = (placement: string) => emitMarketingEvent("directory_cta_click", placement);
  const scrollToForm = (event: MouseEvent<HTMLAnchorElement>, placement: string) => {
    trackCta(placement);
    const target = formRef.current;
    if (!target) return;
    event.preventDefault();
    window.history.pushState(null, "", "#quiero-informacion");
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  };
  const scrollToSteps = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById("como-funciona");
    if (!target) return;
    event.preventDefault();
    window.history.pushState(null, "", "#como-funciona");
    target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-white pb-20 text-[#17251c] md:pb-0">
      <MarketingHeader contentId="contenido-directorio" onCta={(event) => scrollToForm(event, "header")} onSteps={scrollToSteps} />

      <main id="contenido-directorio">
        <section ref={heroRef} className="bg-[#fbfcfa] py-9 sm:py-12 lg:py-14" aria-labelledby="directory-title">
          <div className={`${containerClass} grid items-center gap-7 lg:grid-cols-[0.43fr_0.57fr] lg:gap-8`}>
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">Directorio Drooopy</p>
              <h1 id="directory-title" className={`${headingClass} mt-4 text-[2.45rem] leading-[1.08] sm:text-5xl lg:text-[3.4rem]`}>
                Haz que más personas encuentren <span className="text-[#168e00]">tu negocio.</span>
              </h1>
              <p className="mt-5 max-w-lg text-[15px] leading-7 text-[#40554a] sm:text-lg sm:leading-8">Muestra tus servicios, imágenes, horarios y formas de contacto en un solo espacio dentro de Drooopy.</p>
              <div className="mt-7 flex flex-col items-start gap-2">
                <MarketingCta href="#quiero-informacion" onClick={(event) => scrollToForm(event, "hero")} className="w-full sm:w-auto" />
                <a href="#como-funciona" onClick={scrollToSteps} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[#004e28] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#004e28]">Ver cómo funciona</a>
              </div>
              <p className="mt-3 text-xs text-[#536657]">{plan ? `Plan ${plan.duration === "monthly" ? "mensual" : "anual"} · ` : ""}Administra tu información desde tu panel</p>
            </div>
            <div className="mx-auto w-full max-w-[590px] lg:max-w-none">
              <Image src="/directorio.png" alt="Vista móvil de un negocio publicado en Drooopy: portada, nombre, contacto y productos" width={1122} height={1402} priority sizes="(max-width: 1023px) 100vw, 56vw" className="h-auto w-full object-contain" />
            </div>
          </div>
        </section>

        <div className="border-y border-[#004e28]/10 bg-white">
          <ul className={`${containerClass} grid grid-cols-2 gap-x-5 gap-y-3 py-4 text-xs font-semibold text-[#004e28] sm:grid-cols-4 sm:text-sm`}>
            {["Tu espacio en Drooopy", "Servicios e imágenes", "Enlace para compartir", "Código QR"].map((item) => <li key={item} className="flex items-center gap-2"><Check size={16} className="shrink-0 text-[#168e00]" aria-hidden="true" />{item}</li>)}
          </ul>
        </div>

        <section className="py-12 sm:py-16" aria-labelledby="problem-title">
          <div className={`${containerClass} grid gap-6 lg:grid-cols-[0.5fr_0.5fr] lg:items-center`}>
            <div><h2 id="problem-title" className={`${headingClass} max-w-xl text-2xl leading-tight sm:text-3xl`}>Que conocer tu negocio no dependa de buscar entre publicaciones.</h2><p className="mt-3 text-sm leading-6 text-[#40554a] sm:text-base">Reúne en un solo lugar lo que tus clientes necesitan saber.</p></div>
            <div className="grid grid-cols-3 divide-x divide-[#004e28]/15 border-y border-[#004e28]/15 py-4 text-center text-sm font-semibold text-[#004e28]"><span>Servicios</span><span>Información</span><span>Contacto</span></div>
          </div>
        </section>

        <section className="bg-[#f2f3f4] py-12 sm:py-16" aria-labelledby="product-title">
          <div className={containerClass}>
            <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">El producto</p><h2 id="product-title" className={`${headingClass} mt-2 text-3xl leading-tight sm:text-4xl`}>Así puede verse tu negocio en Drooopy.</h2><p className="mt-3 text-sm leading-6 text-[#40554a] sm:text-base">Tu información organizada para que tus clientes entiendan rápidamente qué ofreces.</p></div>
            <Image src="/directoriodesktop.png" alt="Vista amplia de un negocio en Drooopy con portada, contacto, información, productos y horario" width={1448} height={1086} sizes="(max-width: 1279px) 100vw, 1200px" className="mt-7 h-auto w-full rounded-[1.25rem] object-contain shadow-[0_16px_45px_-30px_rgba(0,40,20,0.35)] sm:mt-9" />
          </div>
        </section>

        <section className="py-12 sm:py-16" aria-labelledby="benefits-title">
          <div className={containerClass}>
            <h2 id="benefits-title" className={`${headingClass} text-3xl sm:text-4xl`}>Lo que tus clientes necesitan ver.</h2>
            <div className="mt-7 grid gap-x-7 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map(({ icon: Icon, title, text }) => <article key={title} className="border-t border-[#004e28]/20 pt-4"><Icon size={21} className="text-[#168e00]" aria-hidden="true" /><h3 className={`${headingClass} mt-3 text-lg`}>{title}</h3><p className="mt-1 text-sm leading-6 text-[#40554a]">{text}</p></article>)}
            </div>
            <ul className="mt-7 grid gap-x-5 gap-y-2 border-t border-[#004e28]/10 pt-5 text-xs font-semibold text-[#004e28] sm:grid-cols-2 sm:text-sm lg:grid-cols-4">{extraBenefits.map((item) => <li key={item} className="flex items-center gap-2"><Check size={16} className="text-[#168e00]" aria-hidden="true" />{item}</li>)}</ul>
          </div>
        </section>

        <section className="border-y border-[#004e28]/10 bg-[#fbfcfa] py-6" aria-labelledby="menu-title"><div className={`${containerClass} flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4`}><h2 id="menu-title" className={`${headingClass} text-lg sm:text-xl`}>¿Tienes restaurante o negocio de comida?</h2><p className="text-sm text-[#40554a]">También puedes mostrar tu menú dentro de Drooopy cuando tu plan lo incluya.</p><a href="#quiero-informacion" onClick={(event) => scrollToForm(event, "menu")} className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-[#005c2e] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#004e28] sm:ml-auto">Quiero información</a></div></section>

        <section id="como-funciona" className="scroll-mt-20 py-12 sm:py-16" aria-labelledby="steps-title"><div className={containerClass}><h2 id="steps-title" className={`${headingClass} text-3xl sm:text-4xl`}>Así de sencillo funciona.</h2><ol className="mt-7 grid gap-5 sm:grid-cols-3">{steps.map((step) => <li key={step.number} className="border-t-2 border-[#004e28] pt-4"><span className="text-xs font-bold text-[#116f04]">{step.number}</span><h3 className={`${headingClass} mt-2 text-xl`}>{step.title}</h3><p className="mt-1 text-sm text-[#40554a]">{step.text}</p></li>)}</ol></div></section>

        <section id="precio" ref={priceRef} className="scroll-mt-20 bg-[#004e28] py-12 text-white sm:py-16" aria-labelledby="pricing-title">
          <div className={`${containerClass} grid items-center gap-7 lg:grid-cols-[0.45fr_0.55fr] lg:gap-12`}>
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b3ecaa]">Plan Directorio</p><h2 id="pricing-title" className="mt-3 font-[family-name:var(--font-varela-round)] text-3xl leading-tight sm:text-4xl">Un espacio para tu negocio en Drooopy.</h2><p className="mt-3 max-w-md text-sm leading-6 text-white/85 sm:text-base">Muestra tu negocio, servicios, imágenes y formas de contacto.</p></div>
            <div className="rounded-[1.5rem] bg-white p-6 text-[#17251c] sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#00672f]">{plan?.title || "Plan Directorio"}</p>
              <div className="mt-4 min-h-16" aria-live="polite">{plan ? <><div className="flex flex-wrap items-end gap-x-2"><span className={`${headingClass} text-5xl leading-none sm:text-6xl`}>{formatCurrency(plan.price)}</span><span className="pb-1 text-sm font-semibold text-[#40554a]">MXN / {plan.duration === "monthly" ? "mes" : "año"}</span></div><p className="mt-2 text-xs text-[#40554a]">Cobro {plan.duration === "monthly" ? "mensual" : "anual"}</p></> : <p className="text-sm font-semibold text-[#40554a]">{loadingPlan ? "Consultando el precio actual…" : "El Plan Directorio no está disponible en este momento."}</p>}</div>
              {plan && visibleFeatures.length ? <ul className="mt-5 grid gap-2 border-t border-[#004e28]/15 pt-5 sm:grid-cols-2">{visibleFeatures.map((line, index) => <li key={`${line}-${index}`} className="flex items-start gap-2 text-sm leading-6 text-[#40554a]"><Check size={17} className="mt-1 shrink-0 text-[#168e00]" aria-hidden="true" />{line}</li>)}</ul> : null}
              {moreFeatures.length ? <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-[#005c2e] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#004e28]">Ver todo lo incluido</summary><ul className="mt-2 grid gap-2 border-t border-[#004e28]/10 pt-4">{moreFeatures.map((line, index) => <li key={`${line}-${index}`} className="flex items-start gap-2 text-sm leading-6 text-[#40554a]"><Check size={16} className="mt-1 shrink-0 text-[#168e00]" aria-hidden="true" />{line}</li>)}</ul></details> : null}
              <MarketingCta href="#quiero-informacion" onClick={(event) => scrollToForm(event, "pricing")} className="mt-6 w-full" />
            </div>
          </div>
        </section>

        <section id="quiero-informacion" ref={formRef} className="scroll-mt-20 bg-[#f2f3f4] py-12 sm:py-16" aria-labelledby="lead-title"><div className={`${containerClass} grid items-center gap-7 lg:grid-cols-[0.45fr_0.55fr] lg:gap-12`}><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">Hablemos</p><h2 id="lead-title" className={`${headingClass} mt-3 text-3xl leading-tight sm:text-4xl`}>¿Quieres información para tu negocio?</h2><p className="mt-3 text-sm leading-6 text-[#40554a] sm:text-base">Déjanos tus datos y te contactamos.</p></div><DirectoryLeadForm onLeadCreated={() => emitMarketingEvent("directory_lead_created", "lead_form")} /></div></section>

        <section className="py-12 sm:py-16" aria-labelledby="faq-title"><div className="mx-auto max-w-3xl px-5 sm:px-8"><h2 id="faq-title" className={`${headingClass} text-3xl sm:text-4xl`}>Preguntas frecuentes</h2><div className="mt-5"><MarketingFaq items={faqs} /></div></div></section>

        <section className="border-t border-[#004e28]/10 bg-[#fbfcfa] py-12 sm:py-16" aria-labelledby="final-title"><div className={`${containerClass} flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between`}><div><h2 id="final-title" className={`${headingClass} max-w-2xl text-3xl leading-tight sm:text-4xl`}>Tu negocio ya existe. Haz que sea más fácil encontrarlo y conocerlo.</h2></div><div className="flex flex-col items-start gap-2 lg:shrink-0"><MarketingCta href="#quiero-informacion" onClick={(event) => scrollToForm(event, "final")} className="w-full sm:w-auto" /><a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={() => emitMarketingEvent("directory_whatsapp_click", "final")} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[#004e28] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#004e28]">Tengo una pregunta por WhatsApp</a></div></div></section>
      </main>

      <MarketingFooter />

      <MarketingWhatsappButton href={WHATSAPP_URL} onClick={() => emitMarketingEvent("directory_whatsapp_click", "floating")} className={`fixed right-4 z-30 shadow-md ${!heroVisible && !priceVisible && !formVisible ? "bottom-24 md:bottom-5" : "bottom-5"}`} />
      <MarketingStickyCta visible={!heroVisible && !priceVisible && !formVisible} href="#quiero-informacion" onClick={(event) => scrollToForm(event, "sticky_mobile")} />
    </div>
  );
}
