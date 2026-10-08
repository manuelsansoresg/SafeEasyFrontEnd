"use client";

import Image from "next/image";
import { BriefcaseBusiness, Check, Images, Link2, MessageCircle } from "lucide-react";
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
const containerClass = "mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-10";
const headingClass = "font-[family-name:var(--font-varela-round)] tracking-[-0.025em] text-[#004e28]";

const benefits = [
  { icon: BriefcaseBusiness, title: "Muestra lo que haces", text: "Presenta tus servicios e información de forma organizada." },
  { icon: Images, title: "Dale una mejor presentación", text: "Agrega imágenes para que conozcan tu negocio." },
  { icon: MessageCircle, title: "Facilita el contacto", text: "Tus clientes encuentran cómo comunicarse contigo." },
  { icon: Link2, title: "Comparte tu espacio", text: "Utiliza tu enlace de Drooopy en redes sociales y WhatsApp." },
];
const steps = [
  { number: "01", title: "Déjanos tus datos", text: "Comparte tu nombre y WhatsApp." },
  { number: "02", title: "Te orientamos", text: "Te explicamos cómo publicar tu negocio en Drooopy." },
  { number: "03", title: "Prepara tu espacio", text: "Organiza la información que quieres mostrar a tus clientes." },
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
    { question: "¿Necesito conocimientos técnicos?", answer: "No. Puedes administrar la información de tu negocio desde tu panel." },
    { question: "¿Puedo cambiar mis datos después?", answer: "Sí. Puedes actualizar la información de tu negocio." },
    { question: "¿Puedo compartir mi espacio por WhatsApp?", answer: "Sí. Puedes compartir el enlace de tu negocio." },
    { question: "¿Cuánto tiempo estará publicado?", answer: plan ? `Depende de la vigencia del plan contratado. El plan mostrado tiene vigencia ${plan.duration === "monthly" ? "mensual" : "anual"}.` : "Depende de la vigencia del plan contratado." },
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
        <section ref={heroRef} className="bg-[#fbfcfa] py-7 sm:py-9 lg:py-10" aria-labelledby="directory-title">
          <div className="mx-auto grid w-full max-w-7xl items-center gap-6 px-5 sm:px-8 md:grid-cols-2 md:gap-8 lg:grid-cols-[minmax(0,0.52fr)_minmax(0,0.48fr)] lg:px-10">
            <div className="min-w-0 max-w-[610px]">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">DIRECTORIO DROOOPY</p>
              <h1 id="directory-title" className={`${headingClass} mt-5 text-[clamp(2.35rem,4.3vw,3.8rem)] leading-[1.08]`}>
                Tu negocio <span className="block">merece ser</span>{" "}<span className="block text-[#168e00]">fácil de encontrar.</span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-[#40554a] sm:text-lg sm:leading-8">Reúne tus servicios, imágenes, ubicación y contacto en un solo espacio que puedes compartir con tus clientes.</p>
              <div className="mt-6 flex flex-col items-start gap-2">
                <MarketingCta href="#quiero-informacion" onClick={(event) => scrollToForm(event, "hero")} className="w-full sm:w-auto" />
                <a href="#como-funciona" onClick={scrollToSteps} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[#004e28] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#004e28]">Ver cómo funciona</a>
              </div>
              <p className="mt-3 text-xs text-[#536657]">Tu negocio, con su propio espacio dentro de Drooopy.</p>
            </div>
            <div className="mx-auto w-full max-w-[290px] sm:max-w-[330px] md:mr-0 md:max-w-[360px] lg:max-w-[390px]">
              <Image src="/directorio.png" alt="Vista móvil de un negocio publicado en Drooopy: portada, nombre, contacto y productos" width={1122} height={1402} priority sizes="(max-width: 639px) 290px, (max-width: 767px) 330px, (max-width: 1023px) 360px, 390px" className="h-auto w-full object-contain" />
            </div>
          </div>
        </section>

        <div className="border-y border-[#004e28]/10 bg-white">
          <ul className={`${containerClass} grid grid-cols-2 gap-x-5 gap-y-3 py-4 text-xs font-semibold text-[#004e28] sm:grid-cols-4 sm:text-sm`}>
            {["Tu espacio en Drooopy.", "Información organizada.", "Enlace para compartir.", "Código QR."].map((item) => <li key={item} className="flex items-center gap-2"><Check size={16} className="shrink-0 text-[#168e00]" aria-hidden="true" />{item}</li>)}
          </ul>
        </div>

        <section className="py-11 sm:py-14" aria-labelledby="problem-title">
          <div className={`${containerClass} grid gap-7 lg:grid-cols-[44%_56%] lg:items-center lg:gap-0`}>
            <div className="lg:pr-8"><h2 id="problem-title" className={`${headingClass} max-w-xl text-[1.65rem] leading-tight sm:text-3xl`}>¿Tus clientes tienen que buscar entre publicaciones para saber qué ofreces?</h2><p className="mt-3 max-w-lg text-sm leading-6 text-[#40554a] sm:text-base">Hazles más fácil encontrar la información de tu negocio en un solo lugar.</p></div>
            <dl className="grid gap-4 border-t border-[#004e28]/15 pt-5 sm:grid-cols-3 sm:gap-5 lg:ml-7 lg:border-t-0 lg:border-l lg:py-1 lg:pl-8">
              {[{ title: "Qué ofreces", text: "Servicios y fotografías." }, { title: "Dónde encontrarte", text: "Ubicación y horarios." }, { title: "Cómo contactarte", text: "Información y medios de contacto." }].map((item) => <div key={item.title}><dt className={`${headingClass} text-base`}>{item.title}</dt><dd className="mt-1 text-sm leading-6 text-[#40554a]">{item.text}</dd></div>)}
            </dl>
          </div>
        </section>

        <section className="bg-[#f2f3f4] py-11 sm:py-14" aria-labelledby="product-title">
          <div className={containerClass}>
            <div className="max-w-3xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">ASÍ SE VE EN DROOOPY</p><h2 id="product-title" className={`${headingClass} mt-2 text-[1.75rem] leading-tight sm:text-[2.125rem]`}>Tu negocio, presentado de forma clara y profesional.</h2><p className="mt-3 text-sm leading-6 text-[#40554a] sm:text-base">Un espacio donde tus clientes pueden conocer lo que haces y encontrar cómo contactarte.</p></div>
            <figure className="mx-auto mt-7 max-w-[1000px] sm:mt-8"><Image src="/directoriodesktop.png" alt="Vista amplia de un negocio en Drooopy con portada, contacto, información, productos y horario" width={1448} height={1086} sizes="(max-width: 1024px) 100vw, 1000px" className="h-auto w-full rounded-2xl object-contain shadow-[0_12px_35px_-28px_rgba(0,40,20,0.3)]" /><figcaption className="mt-3 text-center text-xs text-[#536657]">Ejemplo de un negocio publicado en Drooopy.</figcaption></figure>
          </div>
        </section>

        <section className="py-11 sm:py-14" aria-labelledby="benefits-title">
          <div className={containerClass}>
            <h2 id="benefits-title" className={`${headingClass} max-w-2xl text-[1.75rem] leading-tight sm:text-[2.125rem]`}>Todo lo importante de tu negocio, en un solo lugar.</h2>
            <div className="mt-7 grid gap-x-7 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map(({ icon: Icon, title, text }) => <article key={title} className="border-t border-[#004e28]/20 pt-4"><Icon size={21} className="text-[#168e00]" aria-hidden="true" /><h3 className={`${headingClass} mt-3 text-lg`}>{title}</h3><p className="mt-1 text-sm leading-6 text-[#40554a]">{text}</p></article>)}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-20 bg-[#fbfcfa] py-11 sm:py-14" aria-labelledby="steps-title"><div className={containerClass}><h2 id="steps-title" className={`${headingClass} max-w-2xl text-[1.75rem] leading-tight sm:text-[2.125rem]`}>Comenzar es más sencillo de lo que imaginas.</h2><ol className="mt-7 grid gap-5 sm:grid-cols-3">{steps.map((step) => <li key={step.number} className="border-t-2 border-[#004e28] pt-4"><span className="text-xs font-bold text-[#116f04]">{step.number}</span><h3 className={`${headingClass} mt-2 text-xl`}>{step.title}</h3><p className="mt-1 text-sm leading-6 text-[#40554a]">{step.text}</p></li>)}</ol><MarketingCta href="#quiero-informacion" onClick={(event) => scrollToForm(event, "steps")} className="mt-7 w-full sm:w-auto" /></div></section>

        <section id="precio" ref={priceRef} className="scroll-mt-20 bg-[#004e28] py-11 text-white sm:py-14" aria-labelledby="pricing-title">
          <div className={`${containerClass} grid items-center gap-7 lg:grid-cols-[0.45fr_0.55fr] lg:gap-12`}>
            <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b3ecaa]">Plan Directorio</p><h2 id="pricing-title" className="mt-3 font-[family-name:var(--font-varela-round)] text-[1.75rem] leading-tight sm:text-[2.125rem]">Haz espacio para tu negocio en Drooopy.</h2><p className="mt-3 max-w-md text-sm leading-6 text-white/85 sm:text-base">Publica tu información y compártela con tus clientes desde un solo lugar.</p></div>
            <div className="rounded-[1.5rem] bg-white p-6 text-[#17251c] sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#00672f]">{plan?.title || "Plan Directorio"}</p>
              <div className="mt-4 min-h-16" aria-live="polite">{plan ? <><div className="flex flex-wrap items-end gap-x-2"><span className={`${headingClass} text-5xl leading-none sm:text-6xl`}>{formatCurrency(plan.price)}</span><span className="pb-1 text-sm font-semibold text-[#40554a]">MXN / {plan.duration === "monthly" ? "mes" : "año"}</span></div><p className="mt-2 text-xs text-[#40554a]">Cobro {plan.duration === "monthly" ? "mensual" : "anual"}</p></> : <p className="text-sm font-semibold text-[#40554a]">{loadingPlan ? "Consultando el precio actual…" : "El Plan Directorio no está disponible en este momento."}</p>}</div>
              {plan && visibleFeatures.length ? <ul className="mt-5 grid gap-2 border-t border-[#004e28]/15 pt-5 sm:grid-cols-2">{visibleFeatures.map((line, index) => <li key={`${line}-${index}`} className="flex items-start gap-2 text-sm leading-6 text-[#40554a]"><Check size={17} className="mt-1 shrink-0 text-[#168e00]" aria-hidden="true" />{line}</li>)}</ul> : null}
              {moreFeatures.length ? <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-[#005c2e] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#004e28]">Ver todo lo incluido</summary><ul className="mt-2 grid gap-2 border-t border-[#004e28]/10 pt-4">{moreFeatures.map((line, index) => <li key={`${line}-${index}`} className="flex items-start gap-2 text-sm leading-6 text-[#40554a]"><Check size={16} className="mt-1 shrink-0 text-[#168e00]" aria-hidden="true" />{line}</li>)}</ul></details> : null}
              <MarketingCta href="#quiero-informacion" onClick={(event) => scrollToForm(event, "pricing")} className="mt-6 w-full" />
            </div>
          </div>
        </section>

        <section id="quiero-informacion" ref={formRef} className="scroll-mt-20 bg-[#f2f3f4] py-11 sm:py-14" aria-labelledby="lead-title"><div className={`${containerClass} grid items-center gap-7 lg:grid-cols-[0.45fr_0.55fr] lg:gap-12`}><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">Hablemos</p><h2 id="lead-title" className={`${headingClass} mt-3 text-[1.75rem] leading-tight sm:text-[2.125rem]`}>¿Listo para darle más visibilidad a tu negocio?</h2><p className="mt-3 text-sm leading-6 text-[#40554a] sm:text-base">Déjanos tus datos y te explicamos cómo comenzar en Drooopy.</p></div><DirectoryLeadForm onLeadCreated={() => emitMarketingEvent("directory_lead_created", "lead_form")} /></div></section>

        <section className="py-11 sm:py-14" aria-labelledby="faq-title"><div className="mx-auto max-w-3xl px-5 sm:px-8"><h2 id="faq-title" className={`${headingClass} text-[1.75rem] sm:text-[2.125rem]`}>Preguntas frecuentes</h2><div className="mt-5"><MarketingFaq items={faqs} /></div></div></section>

        <section className="border-t border-[#004e28]/10 bg-[#fbfcfa] py-11 sm:py-14" aria-labelledby="final-title"><div className={`${containerClass} flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between`}><div><h2 id="final-title" className={`${headingClass} max-w-2xl text-[1.75rem] leading-tight sm:text-[2.125rem]`}>Tu negocio tiene mucho que mostrar. Haz que sea más fácil conocerlo.</h2><p className="mt-3 text-sm leading-6 text-[#40554a] sm:text-base">Dale a tus clientes un lugar donde encontrar tu información.</p></div><div className="flex flex-col items-start gap-2 lg:shrink-0"><MarketingCta href="#quiero-informacion" onClick={(event) => scrollToForm(event, "final")} className="w-full sm:w-auto" /><a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={() => emitMarketingEvent("directory_whatsapp_click", "final")} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[#004e28] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#004e28]">Tengo una pregunta por WhatsApp</a></div></div></section>
      </main>

      <MarketingFooter />

      <MarketingWhatsappButton href={WHATSAPP_URL} onClick={() => emitMarketingEvent("directory_whatsapp_click", "floating")} className={`fixed right-4 z-30 shadow-md ${!heroVisible && !priceVisible && !formVisible ? "bottom-24 md:bottom-5" : "bottom-5"}`} />
      <MarketingStickyCta visible={!heroVisible && !priceVisible && !formVisible} href="#quiero-informacion" onClick={(event) => scrollToForm(event, "sticky_mobile")} />
    </div>
  );
}
