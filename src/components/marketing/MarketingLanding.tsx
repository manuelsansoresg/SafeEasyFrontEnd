"use client";

import { CalendarDays, Check, Clock3, Images, Link2, List, MessageCircle, Package, ShoppingBag, Tag } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { MarketingCta, MarketingFaq, MarketingStickyCta, MarketingWhatsappButton } from "@/components/marketing/MarketingBlocks";
import { MarketingFooter, MarketingHeader } from "@/components/marketing/MarketingChrome";
import { MarketingLeadForm } from "@/components/marketing/MarketingLeadForm";
import { MarketingHeroVisual, MarketingProductVisual } from "@/components/marketing/MarketingVisuals";
import { campaignWhatsAppUrl, emitCampaignEvent } from "@/lib/marketingCampaign";
import { hasProfessionalOption, plansFromPayload, selectMarketingPlan, type NewLandingKind } from "@/lib/marketingPlans";
import type { Plan } from "@/types/subscriptions";

type LandingContent = {
  eyebrow: string;
  headline: [string, string];
  description: string;
  strip: string[];
  problemTitle: string;
  problemText: string;
  problemWords: string[];
  productTitle?: string;
  productText?: string;
  benefitsTitle: string;
  benefits: Array<{ icon: typeof List; title: string; text: string }>;
  steps: Array<{ title: string; text: string }>;
  pricingTitle: string;
  pricingText: string;
  leadTitle: string;
  closing: string;
};

const content: Record<NewLandingKind, LandingContent> = {
  menu: {
    eyebrow: "Drooopy para negocios de comida",
    headline: ["Haz que tus clientes vean", "tu menú antes de preguntar."],
    description: "Muestra tus platillos, imágenes y precios en un espacio fácil de consultar y compartir.",
    strip: ["Platillos claros", "Precios visibles", "Fotos que abren el apetito", "Un enlace para compartir"],
    problemTitle: "Deja de mandar el menú una y otra vez.",
    problemText: "Ten un espacio que tus clientes puedan consultar cuando quieran.",
    problemWords: ["Platillos", "Precios", "Imágenes"],
    productTitle: "Así pueden ver tus platillos.",
    productText: "Un ejemplo real de un menú publicado por Sabora en Drooopy.",
    benefitsTitle: "Tu menú, fácil de consultar.",
    benefits: [
      { icon: List, title: "Menú organizado", text: "Muestra tus platillos de forma clara." },
      { icon: Images, title: "Fotos", text: "Haz que la comida entre por los ojos." },
      { icon: Tag, title: "Precios visibles", text: "Reduce preguntas repetidas." },
      { icon: Link2, title: "Enlace para compartir", text: "Envíalo por WhatsApp o redes." },
    ],
    steps: [
      { title: "Déjanos tus datos", text: "Tu nombre y WhatsApp son suficientes." },
      { title: "Te orientamos", text: "Conocemos lo que necesita tu negocio." },
      { title: "Muestra tu menú", text: "Organiza platillos, fotos y precios." },
    ],
    pricingTitle: "Tu menú dentro de Drooopy.",
    pricingText: "El menú está disponible desde el Plan Directorio.",
    leadTitle: "Hablemos de tu menú.",
    closing: "Haz que ver tu menú sea tan fácil como abrir un enlace.",
  },
  products: {
    eyebrow: "Drooopy para negocios",
    headline: ["Muestra tus productos", "sin enviarlos uno por uno."],
    description: "Organiza tu catálogo en Drooopy para que tus clientes vean productos, imágenes y precios desde un solo lugar.",
    strip: ["Un catálogo ordenado", "Fotos por producto", "Precios claros", "Más fácil de compartir"],
    problemTitle: "Tus productos deberían ser fáciles de ver.",
    problemText: "Evita depender de fotos sueltas, publicaciones viejas o mensajes repetidos.",
    problemWords: ["Productos", "Precios", "Información"],
    productTitle: "Un catálogo que habla por tu negocio.",
    productText: "Productos reales publicados por Moderno Muebles en Drooopy.",
    benefitsTitle: "Cada producto en su lugar.",
    benefits: [
      { icon: ShoppingBag, title: "Catálogo organizado", text: "Tus productos en un solo lugar." },
      { icon: Images, title: "Imágenes por producto", text: "Muestra mejor lo que vendes." },
      { icon: Tag, title: "Precios claros", text: "El cliente sabe qué esperar." },
      { icon: MessageCircle, title: "Pedidos más sencillos", text: "Facilita el siguiente paso." },
    ],
    steps: [
      { title: "Déjanos tus datos", text: "Cuéntanos cómo contactarte." },
      { title: "Te orientamos", text: "Vemos el tamaño de tu catálogo." },
      { title: "Publica productos", text: "Organiza fotos, precios e información." },
    ],
    pricingTitle: "Empieza con un catálogo claro.",
    pricingText: "La publicación de productos comienza en el Plan Estándar.",
    leadTitle: "Hablemos de tus productos.",
    closing: "Tus productos ya están listos. Haz que sea más fácil encontrarlos.",
  },
  agenda: {
    eyebrow: "Drooopy para negocios con citas",
    headline: ["Permite que tus clientes", "reserven sin estar preguntando horarios."],
    description: "Muestra tus servicios y disponibilidad para recibir reservaciones desde tu espacio en Drooopy.",
    strip: ["Servicios definidos", "Horarios disponibles", "Reservaciones ordenadas", "Menos mensajes repetidos"],
    problemTitle: "Menos mensajes preguntando qué horario tienes disponible.",
    problemText: "Organiza tus servicios y permite que tus clientes encuentren una opción para reservar.",
    problemWords: ["Servicios", "Horarios", "Reservaciones"],
    benefitsTitle: "Tu tiempo, mejor organizado.",
    benefits: [
      { icon: CalendarDays, title: "Disponibilidad", text: "Muestra cuándo puedes atender." },
      { icon: List, title: "Servicios", text: "Define qué puede reservar el cliente." },
      { icon: Clock3, title: "Reservaciones", text: "Mantén las citas organizadas." },
      { icon: Package, title: "Información del negocio", text: "Todo dentro de tu espacio en Drooopy." },
    ],
    steps: [
      { title: "Déjanos tus datos", text: "Tu nombre y WhatsApp son suficientes." },
      { title: "Te orientamos", text: "Conocemos cómo manejas tus citas." },
      { title: "Organiza tu agenda", text: "Define servicios y horarios disponibles." },
    ],
    pricingTitle: "Una forma más clara de reservar.",
    pricingText: "La agenda está disponible desde el Plan Estándar.",
    leadTitle: "Hablemos de tus reservaciones.",
    closing: "Tu tiempo importa. Haz que reservar sea más sencillo.",
  },
};

const containerClass = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10";
const headingClass = "font-[family-name:var(--font-varela-round)] tracking-[-0.025em] text-[#004e28]";
const formatCurrency = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(value);

export function MarketingLanding({ kind, initialPlans, campaignParams, today, agendaDates }: {
  kind: NewLandingKind;
  initialPlans: Plan[];
  campaignParams: Array<[string, string]>;
  today: string;
  agendaDates: string[];
}) {
  const copy = content[kind];
  const [plans, setPlans] = useState(initialPlans);
  const [loadingPlans, setLoadingPlans] = useState(initialPlans.length === 0);
  const [heroVisible, setHeroVisible] = useState(true);
  const [priceVisible, setPriceVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const priceRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLElement>(null);
  const trackedView = useRef(false);
  const originalParams = useMemo(() => new URLSearchParams(campaignParams), [campaignParams]);
  const accessCode = originalParams.get("code")?.trim() ?? "";
  const plan = selectMarketingPlan(plans, kind);
  const higherTier = hasProfessionalOption(plans, plan);
  const whatsappUrl = campaignWhatsAppUrl(kind);

  useEffect(() => {
    if (trackedView.current) return;
    trackedView.current = true;
    emitCampaignEvent(kind, "view");
  }, [kind]);
  useEffect(() => {
    if (plans.length) return;
    let mounted = true;
    const params = new URLSearchParams({ skip: "0", limit: "1000", only_active: "true" });
    if (accessCode) { params.set("access_code", accessCode); params.set("is_demo", "true"); }
    else { params.set("is_listed", "true"); params.set("is_demo", "false"); }
    fetch(`/api/plans/?${params}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: unknown) => { if (mounted) setPlans(plansFromPayload(payload)); })
      .catch(() => { if (mounted) setPlans([]); })
      .finally(() => { if (mounted) setLoadingPlans(false); });
    return () => { mounted = false; };
  }, [accessCode, plans.length]);
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

  const scrollTo = (event: MouseEvent<HTMLAnchorElement>, id: "quiero-informacion" | "como-funciona", placement?: string) => {
    if (placement) emitCampaignEvent(kind, "cta_click", placement);
    const target = id === "quiero-informacion" ? formRef.current : document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    window.history.pushState(null, "", `#${id}`);
    target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  const faqs = kind === "menu" ? [
    { question: "¿Puedo cambiar mis platillos después?", answer: "Sí. Puedes actualizar tu menú desde tu panel." },
    { question: "¿Puedo agregar imágenes?", answer: "Sí. Puedes mostrar imágenes de tus platillos." },
    { question: "¿Puedo compartir mi menú por WhatsApp?", answer: "Sí. Tu menú tiene un enlace que puedes compartir." },
    { question: "¿Cuánto dura el plan?", answer: plan ? `La vigencia de este plan es ${plan.duration === "monthly" ? "mensual" : "anual"}.` : "Depende de la vigencia del plan disponible." },
  ] : kind === "products" ? [
    { question: "¿Cuántos productos puedo publicar?", answer: plan?.max_active_products ? `El Plan Estándar permite hasta ${plan.max_active_products} productos activos.` : "Depende del plan disponible para tu negocio." },
    { question: "¿Puedo modificar precios?", answer: "Sí. Puedes actualizar la información de tus productos desde tu panel." },
    { question: "¿Puedo agregar imágenes?", answer: plan?.max_images_per_product ? `Sí. Este plan permite hasta ${plan.max_images_per_product} imágenes por producto.` : "Sí. Puedes agregar imágenes a tus productos." },
    { question: "¿Hay un plan con mayor capacidad?", answer: higherTier ? "Sí. También existe una opción Profesional con mayor capacidad." : "Te ayudamos a revisar las opciones disponibles." },
  ] : [
    { question: "¿Puedo configurar mis horarios?", answer: "Sí. Puedes definir la disponibilidad de tu negocio." },
    { question: "¿Puedo definir mis servicios?", answer: "Sí. Puedes configurar los servicios que tus clientes pueden reservar." },
    { question: "¿El cliente puede reservar?", answer: "Sí. Puede elegir un servicio, una fecha y un horario disponible." },
    { question: "¿Puedo modificar mi disponibilidad?", answer: "Sí. Puedes ajustar tus horarios desde la configuración de Agenda." },
  ];

  return <div className="min-h-screen overflow-x-clip bg-white pb-20 text-[#17251c] md:pb-0">
    <MarketingHeader contentId={`contenido-${kind}`} onCta={(event) => scrollTo(event, "quiero-informacion", "header")} onSteps={(event) => scrollTo(event, "como-funciona")} />
    <main id={`contenido-${kind}`}>
      <section ref={heroRef} className="bg-[#fbfcfa] py-9 sm:py-12 lg:py-14" aria-labelledby={`${kind}-title`}>
        <div className={`${containerClass} grid items-center gap-8 lg:grid-cols-[0.43fr_0.57fr] lg:gap-10`}>
          <div className="max-w-xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">{copy.eyebrow}</p>
            <h1 id={`${kind}-title`} className={`${headingClass} mt-4 text-[2.45rem] leading-[1.08] sm:text-5xl lg:text-[3.4rem]`}>{copy.headline[0]} <span className="text-[#168e00]">{copy.headline[1]}</span></h1>
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-[#40554a] sm:text-lg sm:leading-8">{copy.description}</p>
            <div className="mt-7 flex flex-col items-start gap-2">
              <MarketingCta href="#quiero-informacion" onClick={(event) => scrollTo(event, "quiero-informacion", "hero")} className="w-full sm:w-auto" />
              <a href="#como-funciona" onClick={(event) => scrollTo(event, "como-funciona")} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[#004e28] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#004e28]">Ver cómo funciona</a>
            </div>
            <p className="mt-3 text-xs text-[#536657]">Un espacio para tu negocio dentro de Drooopy.</p>
          </div>
          <MarketingHeroVisual kind={kind} today={today} agendaDates={agendaDates} />
        </div>
      </section>

      <div className="border-y border-[#004e28]/10 bg-white"><ul className={`${containerClass} grid grid-cols-2 gap-x-5 gap-y-3 py-4 text-xs font-semibold text-[#004e28] sm:grid-cols-4 sm:text-sm`}>{copy.strip.map((item) => <li key={item} className="flex items-center gap-2"><Check size={16} className="shrink-0 text-[#168e00]" aria-hidden="true" />{item}</li>)}</ul></div>

      <section className="py-12 sm:py-16" aria-labelledby="problem-title"><div className={`${containerClass} grid gap-6 lg:grid-cols-[0.5fr_0.5fr] lg:items-center`}><div><h2 id="problem-title" className={`${headingClass} max-w-xl text-2xl leading-tight sm:text-3xl`}>{copy.problemTitle}</h2><p className="mt-3 text-sm leading-6 text-[#40554a] sm:text-base">{copy.problemText}</p></div><div className="grid grid-cols-3 divide-x divide-[#004e28]/15 border-y border-[#004e28]/15 py-4 text-center text-sm font-semibold text-[#004e28]">{copy.problemWords.map((word) => <span key={word} className="px-1">{word}</span>)}</div></div></section>

      {kind !== "agenda" && copy.productTitle ? <section className="bg-[#f2f3f4] py-12 sm:py-16" aria-labelledby="product-title"><div className={containerClass}><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">Ejemplo real</p><h2 id="product-title" className={`${headingClass} mt-2 text-3xl leading-tight sm:text-4xl`}>{copy.productTitle}</h2><p className="mt-3 text-sm leading-6 text-[#40554a] sm:text-base">{copy.productText}</p></div><MarketingProductVisual kind={kind} /></div></section> : null}

      <section className="py-12 sm:py-16" aria-labelledby="benefits-title"><div className={containerClass}><h2 id="benefits-title" className={`${headingClass} text-3xl sm:text-4xl`}>{copy.benefitsTitle}</h2><div className="mt-7 grid gap-x-7 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">{copy.benefits.map(({ icon: Icon, title, text }) => <article key={title} className="border-t border-[#004e28]/20 pt-4"><Icon size={21} className="text-[#168e00]" aria-hidden="true" /><h3 className={`${headingClass} mt-3 text-lg`}>{title}</h3><p className="mt-1 text-sm leading-6 text-[#40554a]">{text}</p></article>)}</div></div></section>

      <section id="como-funciona" className="scroll-mt-20 bg-[#fbfcfa] py-12 sm:py-16" aria-labelledby="steps-title"><div className={containerClass}><h2 id="steps-title" className={`${headingClass} text-3xl sm:text-4xl`}>Así de sencillo funciona.</h2><ol className="mt-7 grid gap-5 sm:grid-cols-3">{copy.steps.map((step, index) => <li key={step.title} className="border-t-2 border-[#004e28] pt-4"><span className="text-xs font-bold text-[#116f04]">{String(index + 1).padStart(2, "0")}</span><h3 className={`${headingClass} mt-2 text-xl`}>{step.title}</h3><p className="mt-1 text-sm text-[#40554a]">{step.text}</p></li>)}</ol></div></section>

      <section id="precio" ref={priceRef} className="scroll-mt-20 bg-[#004e28] py-12 text-white sm:py-16" aria-labelledby="pricing-title"><div className={`${containerClass} grid items-center gap-7 lg:grid-cols-[0.45fr_0.55fr] lg:gap-12`}><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b3ecaa]">Plan recomendado</p><h2 id="pricing-title" className="mt-3 font-[family-name:var(--font-varela-round)] text-3xl leading-tight sm:text-4xl">{copy.pricingTitle}</h2><p className="mt-3 max-w-md text-sm leading-6 text-white/85 sm:text-base">{copy.pricingText}</p></div><div className="rounded-[1.5rem] bg-white p-6 text-[#17251c] sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#00672f]">{plan?.title || (kind === "menu" ? "Plan Directorio" : "Plan Estándar")}</p><div className="mt-4 min-h-16" aria-live="polite">{plan ? <><div className="flex flex-wrap items-end gap-x-2">{kind !== "menu" ? <span className="pb-1 text-sm font-semibold text-[#40554a]">Desde</span> : null}<span className={`${headingClass} text-5xl leading-none sm:text-6xl`}>{formatCurrency(plan.price)}</span><span className="pb-1 text-sm font-semibold text-[#40554a]">MXN / {plan.duration === "monthly" ? "mes" : "año"}</span></div><p className="mt-2 text-xs text-[#40554a]">Cobro {plan.duration === "monthly" ? "mensual" : "anual"}</p></> : <p className="text-sm font-semibold text-[#40554a]">{loadingPlans ? "Consultando el precio actual…" : "El precio no está disponible en este momento. Déjanos tus datos y te orientamos."}</p>}</div>{kind !== "menu" && higherTier ? <p className="mt-4 border-t border-[#004e28]/10 pt-4 text-sm text-[#40554a]">También hay una opción Profesional para negocios que necesitan mayor capacidad.</p> : null}<MarketingCta href="#quiero-informacion" onClick={(event) => scrollTo(event, "quiero-informacion", "pricing")} className="mt-6 w-full" /></div></div></section>

      <section id="quiero-informacion" ref={formRef} className="scroll-mt-20 bg-[#f2f3f4] py-12 sm:py-16" aria-labelledby="lead-title"><div className={`${containerClass} grid items-center gap-7 lg:grid-cols-[0.45fr_0.55fr] lg:gap-12`}><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">Hablemos</p><h2 id="lead-title" className={`${headingClass} mt-3 text-3xl leading-tight sm:text-4xl`}>{copy.leadTitle}</h2><p className="mt-3 text-sm leading-6 text-[#40554a] sm:text-base">Déjanos tus datos y te contactamos.</p></div><MarketingLeadForm kind={kind} onLeadCreated={() => emitCampaignEvent(kind, "lead_created", "lead_form")} /></div></section>

      <section className="py-12 sm:py-16" aria-labelledby="faq-title"><div className="mx-auto max-w-3xl px-5 sm:px-8"><h2 id="faq-title" className={`${headingClass} text-3xl sm:text-4xl`}>Preguntas frecuentes</h2><div className="mt-5"><MarketingFaq items={faqs} /></div></div></section>

      <section className="border-t border-[#004e28]/10 bg-[#fbfcfa] py-12 sm:py-16" aria-labelledby="final-title"><div className={`${containerClass} flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between`}><h2 id="final-title" className={`${headingClass} max-w-2xl text-3xl leading-tight sm:text-4xl`}>{copy.closing}</h2><div className="flex flex-col items-start gap-2 lg:shrink-0"><MarketingCta href="#quiero-informacion" onClick={(event) => scrollTo(event, "quiero-informacion", "final")} className="w-full sm:w-auto" /><a href={whatsappUrl} target="_blank" rel="noopener noreferrer" onClick={() => emitCampaignEvent(kind, "whatsapp_click", "final")} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[#004e28] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#004e28]">Tengo una pregunta por WhatsApp</a></div></div></section>
    </main>
    <MarketingFooter />
    <MarketingWhatsappButton href={whatsappUrl} onClick={() => emitCampaignEvent(kind, "whatsapp_click", "floating")} className={`fixed right-4 z-30 shadow-md ${!heroVisible && !priceVisible && !formVisible ? "bottom-24 md:bottom-5" : "bottom-5"}`} />
    <MarketingStickyCta visible={!heroVisible && !priceVisible && !formVisible} href="#quiero-informacion" onClick={(event) => scrollTo(event, "quiero-informacion", "sticky_mobile")} />
  </div>;
}
