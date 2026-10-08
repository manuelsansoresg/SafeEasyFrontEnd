"use client";

import Image from "next/image";
import {
  CalendarCheck2,
  CalendarDays,
  Check,
  Clock3,
  Link2,
  MessageCircle,
  Settings2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  MarketingCta,
  MarketingFaq,
  MarketingStickyCta,
  MarketingWhatsappButton,
} from "@/components/marketing/MarketingBlocks";
import {
  MarketingFooter,
  MarketingHeader,
} from "@/components/marketing/MarketingChrome";
import { MarketingLeadForm } from "@/components/marketing/MarketingLeadForm";
import {
  campaignWhatsAppUrl,
  emitCampaignEvent,
} from "@/lib/marketingCampaign";
import {
  plansFromPayload,
  selectMarketingPlan,
} from "@/lib/marketingPlans";
import type { Plan } from "@/types/subscriptions";

type Props = {
  initialPlans: Plan[];
  campaignParams: Array<[string, string]>;
};

const container = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10";
const heading =
  "font-[family-name:var(--font-varela-round)] tracking-[-0.035em] text-[#004e28]";
const whatsappUrl = campaignWhatsAppUrl("agenda");

const quickBenefits = [
  { icon: Settings2, label: "Servicios configurables" },
  { icon: Clock3, label: "Horarios disponibles" },
  { icon: CalendarCheck2, label: "Citas organizadas" },
];

const steps = [
  {
    number: "01",
    title: "Eligen un servicio",
    text: "Tus clientes consultan las opciones que ofreces.",
  },
  {
    number: "02",
    title: "Encuentran un horario",
    text: "Ven las fechas y horas disponibles para reservar.",
  },
  {
    number: "03",
    title: "Realizan su reservación",
    text: "La cita queda registrada en la Agenda de tu negocio.",
  },
];

const benefits = [
  {
    icon: Settings2,
    title: "Tú defines la disponibilidad",
    text: "Configura los horarios en los que puedes atender.",
  },
  {
    icon: Link2,
    title: "Un espacio para compartir",
    text: "Tus clientes pueden acceder a tu negocio desde un enlace.",
  },
  {
    icon: CalendarDays,
    title: "Servicios bien presentados",
    text: "Muestra qué servicios se pueden reservar.",
  },
  {
    icon: CalendarCheck2,
    title: "Reservaciones en orden",
    text: "Consulta y administra las citas desde Drooopy.",
  },
];

const faqs = [
  {
    question: "¿Mis clientes pueden elegir servicio y horario?",
    answer:
      "Sí. Pueden consultar los servicios y elegir entre las fechas y horarios disponibles.",
  },
  {
    question: "¿Puedo modificar mis horarios?",
    answer:
      "Sí. La configuración de Agenda te permite ajustar la disponibilidad de tu negocio.",
  },
  {
    question: "¿Dónde consulto mis reservaciones?",
    answer:
      "Las reservaciones se administran desde el espacio correspondiente de tu negocio en Drooopy.",
  },
  {
    question: "¿Qué plan necesito para utilizar Agenda?",
    answer:
      "Depende de los planes y módulos disponibles. Déjanos tus datos y te explicamos las opciones vigentes.",
  },
];

function formatPrice(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function AgendaMarketingLanding({
  initialPlans,
  campaignParams,
}: Props) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [loadingPlans, setLoadingPlans] = useState(initialPlans.length === 0);
  const [heroVisible, setHeroVisible] = useState(true);
  const [priceVisible, setPriceVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const priceRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLElement>(null);
  const trackedView = useRef(false);
  const originalParams = useMemo(
    () => new URLSearchParams(campaignParams),
    [campaignParams],
  );
  const accessCode = originalParams.get("code")?.trim() ?? "";
  const plan = selectMarketingPlan(plans, "agenda");
  const showSticky = !heroVisible && !priceVisible && !formVisible;

  useEffect(() => {
    if (trackedView.current) return;
    trackedView.current = true;
    emitCampaignEvent("agenda", "view");
  }, []);

  // Si el servidor no pudo obtener planes, intentarlo desde el navegador.
  useEffect(() => {
    if (plans.length > 0) return;
    let mounted = true;
    const params = new URLSearchParams({
      skip: "0",
      limit: "1000",
      only_active: "true",
    });
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
        if (mounted) setPlans(plansFromPayload(payload));
      })
      .catch(() => {
        if (mounted) setPlans([]);
      })
      .finally(() => {
        if (mounted) setLoadingPlans(false);
      });
    return () => {
      mounted = false;
    };
  }, [accessCode, plans.length]);

  useEffect(() => {
    const targets = [heroRef.current, priceRef.current, formRef.current].filter(
      (element): element is HTMLElement => Boolean(element),
    );
    if (!targets.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === heroRef.current) setHeroVisible(entry.isIntersecting);
          if (entry.target === priceRef.current) setPriceVisible(entry.isIntersecting);
          if (entry.target === formRef.current) setFormVisible(entry.isIntersecting);
        }
      },
      { threshold: 0.18 },
    );
    targets.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  function scrollTo(
    event: MouseEvent<HTMLAnchorElement>,
    id: "quiero-informacion" | "como-funciona",
    placement?: string,
  ) {
    if (placement) emitCampaignEvent("agenda", "cta_click", placement);
    const target =
      id === "quiero-informacion"
        ? formRef.current
        : document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    // La URL conserva UTMs, gclid y fbclid; solo cambia la ancla.
    window.history.pushState(null, "", `#${id}`);
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }

  const cta = (placement: string) =>
    (event: MouseEvent<HTMLAnchorElement>) =>
      scrollTo(event, "quiero-informacion", placement);

  return (
    <div className="min-h-screen overflow-x-clip bg-white pb-20 text-[#17251c] md:pb-0">
      <MarketingHeader
        contentId="contenido-agenda"
        onCta={cta("header")}
        onSteps={(event) => scrollTo(event, "como-funciona")}
      />
      <main id="contenido-agenda">
        {/* HERO */}
        <section
          ref={heroRef}
          aria-labelledby="agenda-hero-title"
          className="bg-[#fbfcfa] py-10 sm:py-14 lg:py-20"
        >
          <div className={`${container} grid items-center gap-9 lg:grid-cols-[0.45fr_0.55fr] lg:gap-8`}>
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">
                Agenda online para tu negocio
              </p>
              <h1
                id="agenda-hero-title"
                className={`${heading} mt-5 text-[clamp(2.35rem,5vw,4.15rem)] leading-[1.08]`}
              >
                Tus clientes reservan.
                <span className="block text-[#158900]">
                  Tú te concentras en atender.
                </span>
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-[#40554a] sm:text-lg sm:leading-8">
                Muestra tus servicios y horarios disponibles en Drooopy para
                que tus clientes elijan cuándo reservar, sin preguntarte
                horarios por mensaje.
              </p>
              <div className="mt-7 flex flex-col items-start gap-3">
                <MarketingCta
                  href="#quiero-informacion"
                  onClick={cta("hero")}
                  label="Quiero organizar mis citas"
                  className="w-full sm:w-auto"
                />
                <a
                  href="#como-funciona"
                  onClick={(event) => scrollTo(event, "como-funciona")}
                  className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[#004e28] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#004e28]"
                >
                  Ver cómo funciona
                </a>
              </div>
              <p className="mt-3 text-xs text-[#5f7164]">
                Déjanos tu nombre y WhatsApp. Te contactamos para orientarte.
              </p>
            </div>
            <figure className="mx-auto w-full max-w-[700px] lg:max-w-none">
              <Image
                src="/agenda.png"
                alt="Ilustración del proceso de reservación: elegir un servicio, seleccionar fecha y horario y registrar una cita en Drooopy"
                width={1600}
                height={960}
                priority
                sizes="(max-width: 1023px) 100vw, 55vw"
                className="h-auto w-full object-contain"
              />
              <figcaption className="mt-1 text-center text-[11px] text-[#5f7164]">
                Imagen ilustrativa del proceso. Los horarios mostrados no son disponibilidad en tiempo real.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* BENEFICIOS INMEDIATOS */}
        <div className="border-y border-[#004e28]/10 bg-white">
          <ul className={`${container} grid gap-4 py-5 sm:grid-cols-3 sm:gap-6`}>
            {quickBenefits.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm font-semibold text-[#004e28]">
                <Icon className="shrink-0 text-[#158900]" size={21} aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* PROBLEMA / SOLUCIÓN */}
        <section aria-labelledby="agenda-problem-title" className="py-14 sm:py-20">
          <div className={`${container} grid items-start gap-9 lg:grid-cols-[0.45fr_0.55fr] lg:gap-16`}>
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">
                Menos mensajes de ida y vuelta
              </p>
              <h2 id="agenda-problem-title" className={`${heading} mt-3 text-3xl leading-tight sm:text-4xl lg:text-[2.7rem]`}>
                ¿Todavía coordinas cada cita por mensaje?
              </h2>
              <p className="mt-4 text-base leading-7 text-[#40554a]">
                Tus clientes pueden consultar tus servicios y las opciones
                disponibles sin tener que escribirte para preguntar cada horario.
              </p>
              <MarketingCta
                href="#quiero-informacion"
                onClick={cta("problem")}
                label="Quiero organizar mis citas"
                className="mt-6 w-full sm:w-auto"
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2 sm:gap-0">
              <div className="border-l-2 border-[#d5ddd7] pl-5 sm:pr-6">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#687970]">
                  Cuando todo es por mensaje
                </p>
                <ul className="mt-5 space-y-4 text-sm leading-6 text-[#55665c]">
                  <li>Preguntas repetidas sobre disponibilidad.</li>
                  <li>Mensajes para coordinar fecha y hora.</li>
                  <li>Información dispersa entre conversaciones.</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-[#004e28]/10 bg-[#f3f8f1] px-5 py-6 sm:-my-2 sm:py-8">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#005c2e]">
                  Con Agenda en Drooopy
                </p>
                <ul className="mt-5 space-y-4">
                  {[
                    "Servicios visibles y organizados.",
                    "Horarios disponibles para consultar.",
                    "Reservaciones dentro de tu espacio.",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm font-semibold leading-6 text-[#004e28]">
                      <Check size={18} className="mt-1 shrink-0 text-[#158900]" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CÓMO FUNCIONA, SIN REPETIR EL CALENDARIO */}
        <section
          id="como-funciona"
          aria-labelledby="agenda-steps-title"
          className="scroll-mt-24 bg-[#f2f3f4] py-14 sm:py-20"
        >
          <div className={container}>
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">
                Fácil para tus clientes
              </p>
              <h2 id="agenda-steps-title" className={`${heading} mt-3 text-3xl leading-tight sm:text-4xl`}>
                Reservar es sencillo en tres pasos.
              </h2>
            </div>
            <ol className="mt-10 grid gap-7 sm:grid-cols-3 sm:gap-8">
              {steps.map((step) => (
                <li key={step.number} className="border-t-2 border-[#004e28] pt-5">
                  <span className="text-xs font-bold tracking-[0.16em] text-[#158900]">
                    {step.number}
                  </span>
                  <h3 className={`${heading} mt-3 text-xl sm:text-2xl`}>{step.title}</h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-[#40554a]">
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* BENEFICIOS */}
        <section aria-labelledby="agenda-benefits-title" className="py-14 sm:py-20">
          <div className={container}>
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">
                Pensado para tu negocio
              </p>
              <h2 id="agenda-benefits-title" className={`${heading} mt-3 text-3xl leading-tight sm:text-4xl`}>
                Tú controlas los horarios. Tus clientes eligen cuándo reservar.
              </h2>
            </div>
            <div className="mt-9 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map(({ icon: Icon, title, text }) => (
                <article key={title} className="border-t border-[#004e28]/15 pt-5">
                  <Icon size={23} className="text-[#158900]" aria-hidden="true" />
                  <h3 className={`${heading} mt-4 text-lg leading-snug`}>{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#40554a]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* TIPOS DE NEGOCIO */}
        <section className="border-y border-[#004e28]/10 bg-[#fbfcfa] py-8 sm:py-10" aria-labelledby="agenda-audience-title">
          <div className={`${container} flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-10`}>
            <div className="lg:max-w-xs lg:shrink-0">
              <h2 id="agenda-audience-title" className={`${heading} text-xl sm:text-2xl`}>
                ¿Atiendes mediante citas?
              </h2>
              <p className="mt-1 text-sm leading-6 text-[#40554a]">
                Agenda puede adaptarse a distintos servicios.
              </p>
            </div>
            <ul className="flex flex-wrap gap-2.5 text-sm font-semibold text-[#004e28]">
              {[
                "Barberías",
                "Salones de belleza",
                "Spas",
                "Consultorios",
                "Terapeutas",
                "Servicios profesionales",
              ].map((business) => (
                <li key={business} className="rounded-full border border-[#004e28]/15 bg-white px-4 py-2.5">
                  {business}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* PRECIO DINÁMICO */}
        <section
          id="precio"
          ref={priceRef}
          aria-labelledby="agenda-pricing-title"
          className="scroll-mt-24 bg-[#004e28] py-14 text-white sm:py-20"
        >
          <div className={`${container} grid items-center gap-8 lg:grid-cols-[0.46fr_0.54fr] lg:gap-14`}>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b9e8b2]">
                Opciones para tu negocio
              </p>
              <h2 id="agenda-pricing-title" className="mt-4 font-[family-name:var(--font-varela-round)] text-3xl leading-tight tracking-[-0.025em] sm:text-4xl">
                Organiza tus reservaciones desde Drooopy.
              </h2>
              <p className="mt-4 max-w-md text-base leading-7 text-white/85">
                Te orientamos para conocer el plan y la configuración de Agenda
                adecuados para tu negocio.
              </p>
            </div>
            <div className="rounded-[1.65rem] bg-white p-6 text-[#17251c] shadow-[0_24px_60px_-40px_rgba(0,0,0,0.25)] sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#00672f]">
                {plan ? plan.title : "Consulta las opciones disponibles"}
              </p>
              <div className="mt-4 min-h-20" aria-live="polite">
                {plan ? (
                  <>
                    <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                      <span className="pb-1 text-sm font-semibold text-[#40554a]">Desde</span>
                      <span className={`${heading} text-5xl leading-none sm:text-6xl`}>
                        {formatPrice(plan.price)}
                      </span>
                      <span className="pb-1 text-sm font-semibold text-[#40554a]">
                        MXN / {plan.duration === "monthly" ? "mes" : "año"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[#40554a]">
                      Precio del plan {plan.title}.
                    </p>
                  </>
                ) : (
                  <p className="text-sm leading-6 text-[#40554a]">
                    {loadingPlans
                      ? "Consultando planes disponibles…"
                      : "No hay un precio público disponible en este momento. Déjanos tus datos y te orientamos."}
                  </p>
                )}
              </div>
              <div className="mt-5 border-t border-[#004e28]/10 pt-4">
                <p className="text-xs leading-5 text-[#5f7164]">
                  La disponibilidad y las condiciones de activación del módulo
                  Agenda dependen de su configuración vigente.
                </p>
              </div>
              <MarketingCta
                href="#quiero-informacion"
                onClick={cta("pricing")}
                label="Quiero información sobre Agenda"
                className="mt-6 w-full"
              />
            </div>
          </div>
        </section>

        {/* FORMULARIO */}
        <section
          id="quiero-informacion"
          ref={formRef}
          aria-labelledby="agenda-lead-title"
          className="scroll-mt-24 bg-[#f2f3f4] py-14 sm:py-20"
        >
          <div className={`${container} grid items-center gap-8 lg:grid-cols-[0.45fr_0.55fr] lg:gap-14`}>
            <div className="max-w-lg">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">
                Hablemos de tu negocio
              </p>
              <h2 id="agenda-lead-title" className={`${heading} mt-3 text-3xl leading-tight sm:text-4xl`}>
                Haz que reservar una cita sea más sencillo para tus clientes.
              </h2>
              <p className="mt-4 text-base leading-7 text-[#40554a]">
                Déjanos tus datos y te contactamos para explicarte cómo usar
                Agenda en Drooopy.
              </p>
              <p className="mt-5 flex items-start gap-2 text-sm font-semibold text-[#004e28]">
                <Check size={18} className="mt-0.5 shrink-0 text-[#158900]" aria-hidden="true" />
                Sin crear cuenta ni hacer un pago desde esta página.
              </p>
            </div>
            <MarketingLeadForm
              kind="agenda"
              onLeadCreated={() => emitCampaignEvent("agenda", "lead_created", "lead_form")}
            />
          </div>
        </section>

        {/* DUDAS */}
        <section className="py-14 sm:py-20" aria-labelledby="agenda-faq-title">
          <div className="mx-auto max-w-3xl px-5 sm:px-8">
            <h2 id="agenda-faq-title" className={`${heading} text-3xl sm:text-4xl`}>
              Preguntas frecuentes
            </h2>
            <div className="mt-6">
              <MarketingFaq items={faqs} />
            </div>
          </div>
        </section>

        {/* CIERRE */}
        <section className="border-t border-[#004e28]/10 bg-[#fbfcfa] py-14 sm:py-16" aria-labelledby="agenda-closing-title">
          <div className={`${container} flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between`}>
            <div className="max-w-2xl">
              <h2 id="agenda-closing-title" className={`${heading} text-3xl leading-tight sm:text-4xl`}>
                Que pedir una cita sea fácil para todos.
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#40554a] sm:text-base">
                Tus clientes consultan la disponibilidad. Tú mantienes tus
                reservaciones organizadas.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 lg:shrink-0">
              <MarketingCta
                href="#quiero-informacion"
                onClick={cta("final")}
                label="Quiero organizar mis citas"
                className="w-full sm:w-auto"
              />
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => emitCampaignEvent("agenda", "whatsapp_click", "final")}
                className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-semibold text-[#004e28] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#004e28]"
              >
                <MessageCircle size={18} aria-hidden="true" />
                Tengo una pregunta por WhatsApp
              </a>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
      <MarketingWhatsappButton
        href={whatsappUrl}
        onClick={() => emitCampaignEvent("agenda", "whatsapp_click", "floating")}
        className={`fixed right-4 z-30 shadow-md ${showSticky ? "bottom-24 md:bottom-5" : "bottom-5"}`}
      />
      <MarketingStickyCta
        visible={showSticky}
        href="#quiero-informacion"
        onClick={cta("sticky_mobile")}
      />
    </div>
  );
}
