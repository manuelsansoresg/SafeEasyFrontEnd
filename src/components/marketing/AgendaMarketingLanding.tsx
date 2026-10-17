"use client";

import Image from "next/image";
import {
  CalendarCheck2,
  CalendarDays,
  Check,
  Clock3,
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
import { MarketingLeadModal } from "@/components/marketing/MarketingLeadModal";
import { MarketingAgendaShowcase } from "@/components/marketing/MarketingVisuals";
import {
  campaignWhatsAppUrl,
  emitCampaignEvent,
} from "@/lib/marketingCampaign";
import {
  plansFromPayload,
  getAgendaMarketingPlans,
} from "@/lib/marketingPlans";
import type { AgendaExample } from "@/lib/marketingPageData";
import type { Plan } from "@/types/subscriptions";

type Props = {
  initialPlans: Plan[];
  campaignParams: Array<[string, string]>;
  today: string;
  agendaExample: AgendaExample | null;
};

const container = "mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-10";
const heading =
  "font-[family-name:var(--font-varela-round)] tracking-[-0.035em] text-[#004e28]";
const whatsappUrl = campaignWhatsAppUrl("agenda");
const agendaCtaLabel = "Quiero mi agenda digital";

const benefits = [
  {
    icon: CalendarCheck2,
    title: "Recibe citas mientras atiendes",
    text: "Comparte tu enlace para que tus clientes elijan servicio, fecha y horario sin coordinar cada cita por mensajes.",
  },
  {
    icon: Clock3,
    title: "Muestra tus horarios disponibles",
    text: "Tus clientes consultan tu disponibilidad y eligen cuándo reservar desde tu enlace.",
  },
  {
    icon: Settings2,
    title: "Configura servicios y disponibilidad",
    text: "Define tus servicios, precios y horarios de atención.",
  },
  {
    icon: CalendarDays,
    title: "Administra tus citas",
    text: "Consulta y organiza tus reservaciones desde Drooopy.",
  },
];

const faqs = [
  {
    question: "¿Mis clientes necesitan registrarse para reservar?",
    answer:
      "Puedes permitir reservas como invitado. Si desactivas esa opción, deberán iniciar sesión.",
  },
  {
    question: "¿Puedo cambiar los horarios de atención?",
    answer:
      "Sí. Puedes ajustar la disponibilidad desde la configuración de Agenda.",
  },
  {
    question: "¿Puedo configurar diferentes servicios y precios?",
    answer:
      "Sí. Puedes definir los servicios, sus precios y horarios disponibles.",
  },
  {
    question: "¿Mis clientes pueden pagar en línea?",
    answer:
      "Los cobros en línea desde Agenda requieren un plan que los incluya, vincular Mercado Pago y habilitar la opción. Consulta las capacidades de cada plan en la sección de precios.",
  },
  {
    question: "¿Agenda tiene algún costo adicional?",
    answer:
      "Está incluida en los planes que la ofrecen, sin cargo adicional por activarla. Mercado Pago puede cobrar comisiones por transacción.",
  },
  {
    question: "¿Cómo consulto mis reservaciones?",
    answer: "Desde Agenda en tu panel de Drooopy.",
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
  today,
  agendaExample,
}: Props) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [loadingPlans, setLoadingPlans] = useState(initialPlans.length === 0);
  const [heroVisible, setHeroVisible] = useState(true);
  const [priceVisible, setPriceVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);
  const [isLeadModalOpen, setLeadModalOpen] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const priceRef = useRef<HTMLElement>(null);
  const formRef = useRef<HTMLElement>(null);
  const modalOpener = useRef<HTMLAnchorElement>(null);
  const trackedView = useRef(false);
  const originalParams = useMemo(
    () => new URLSearchParams(campaignParams),
    [campaignParams],
  );
  const accessCode = originalParams.get("code")?.trim() ?? "";
  const agendaPlans = getAgendaMarketingPlans(plans, Boolean(accessCode));
  // Compare annual offers together; retain other billing periods when no annual offer exists.
  const annualPlans = agendaPlans.filter((item) => item.duration === "yearly");
  const displayedPlans = annualPlans.length ? annualPlans : agendaPlans;
  const plan = displayedPlans[0] ?? null;
  const paymentPlan = displayedPlans.find((item) =>
    item.module_capabilities?.agenda?.online_payments_enabled === true,
  );
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
  ) {
    const target = document.getElementById("como-funciona");
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }

  const cta = (placement: string) =>
    (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      emitCampaignEvent("agenda", "cta_click", placement);
      modalOpener.current = event.currentTarget;
      setLeadModalOpen(true);
    };

  return (
    <div className="min-h-screen overflow-x-clip bg-white pb-20 text-[#17251c] md:pb-0">
      <MarketingHeader
        contentId="contenido-agenda"
        onCta={cta("header")}
        onSteps={scrollTo}
        ctaLabel="Solicitar información"
      />
      <main id="contenido-agenda">
        {/* HERO */}
        <section
          ref={heroRef}
          aria-labelledby="agenda-hero-title"
          className="bg-[#fbfcfa] py-8 sm:py-11 lg:py-14"
        >
          <div className={`${container} grid items-center gap-7 lg:grid-cols-[0.47fr_0.53fr] lg:gap-8`}>
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">
                Agenda online para tu negocio
              </p>
              <h1
                id="agenda-hero-title"
                className={`${heading} mt-4 text-[clamp(2.25rem,4.5vw,3.8rem)] leading-[1.08]`}
              >
                Mientras tú atiendes,{" "}
                <span className="block text-[#158900]">
                  tus clientes pueden reservar.
                </span>
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-[#40554a] sm:text-lg sm:leading-8">
                Comparte un enlace para que elijan servicio, fecha y horario.
                Organiza tus reservaciones sin coordinar cada cita por mensaje.
              </p>
              <p className="mt-5 text-base font-semibold leading-6 text-[#004e28]" aria-live="polite">
                {plan
                  ? `Agenda digital desde ${formatPrice(plan.price)} MXN ${plan.duration === "yearly" ? "al año" : "al mes"}`
                  : loadingPlans ? "Consultando precio de Agenda…" : "Solicita información sobre los planes de Agenda."}
              </p>
              <div className="mt-4 flex flex-col items-start gap-2">
                <MarketingCta
                  href="#quiero-informacion"
                  onClick={cta("hero")}
                  label={agendaCtaLabel}
                  className="w-full sm:w-auto"
                />
                <a
                  href="#como-funciona"
                  onClick={scrollTo}
                  className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[#004e28] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#004e28]"
                >
                  Ver cómo funciona
                </a>
              </div>
              <p className="mt-3 text-xs text-[#5f7164]">
                Déjanos tu nombre y WhatsApp. Te explicamos cómo comenzar.
              </p>
            </div>
            <figure className="mx-auto w-full max-w-[570px] lg:max-w-[620px]">
              <Image
                src="/agenda.png"
                alt="Ilustración del proceso de reservación: elegir un servicio, seleccionar fecha y horario y registrar una cita en Drooopy"
                width={1600}
                height={960}
                priority
                sizes="(max-width: 639px) 100vw, (max-width: 1023px) 570px, 620px"
                className="h-auto w-full object-contain"
              />
              <figcaption className="mt-1 text-center text-[11px] text-[#5f7164]">
                Imagen ilustrativa del proceso. Los horarios mostrados no son disponibilidad en tiempo real.
              </figcaption>
            </figure>
          </div>
        </section>

        {/* PROBLEMA / SOLUCIÓN */}
        <section aria-labelledby="agenda-problem-title" className="py-12 sm:py-16">
          <div className={`${container} grid items-center gap-8 lg:grid-cols-[0.45fr_0.55fr] lg:gap-12`}>
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">
                Cuando las citas llegan por mensaje
              </p>
              <h2 id="agenda-problem-title" className={`${heading} mt-3 text-[1.8rem] leading-tight sm:text-[2.2rem]`}>
                ¿Te preguntan por horarios mientras estás atendiendo?
              </h2>
              <p className="mt-4 text-base leading-7 text-[#40554a]">
                Una consulta puede convertirse en varios mensajes para acordar
                servicio, día y hora. Con Agenda, tus clientes revisan las
                opciones disponibles desde un enlace.
              </p>
            </div>
            <ul className="divide-y divide-[#004e28]/15 border-y border-[#004e28]/15">
              {[
                "Te escriben para preguntar qué servicios pueden reservar.",
                "Buscas entre conversaciones para confirmar un horario.",
                "Coordinas cada cita mientras sigues atendiendo.",
              ].map((item, index) => (
                <li key={item} className="flex items-center gap-4 py-4 text-sm leading-6 text-[#40554a] sm:text-base">
                  <span className="font-[family-name:var(--font-varela-round)] text-lg text-[#168e00]">0{index + 1}</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* DEMOSTRACIÓN DEL RECORRIDO */}
        <section
          id="como-funciona"
          aria-labelledby="agenda-steps-title"
          className="scroll-mt-24 bg-[#f2f3f4] py-12 sm:py-16"
        >
          <div className={container}>
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">
                Así reserva un cliente
              </p>
              <h2 id="agenda-steps-title" className={`${heading} mt-3 text-[1.8rem] leading-tight sm:text-[2.2rem]`}>
                Del servicio a la cita, en un solo recorrido.
              </h2>
              <p className="mt-3 text-base leading-7 text-[#40554a]">
                Tus clientes consultan los servicios, eligen una fecha y un horario
                disponible y completan su reservación.
              </p>
            </div>
            {agendaExample?.service && agendaExample.slots.length ? (
              <MarketingAgendaShowcase today={today} example={agendaExample} />
            ) : (
              <ol className="mt-7 grid gap-5 border-y border-[#004e28]/10 py-6 sm:grid-cols-4">
                {[
                  { icon: Settings2, title: "Consulta servicios", text: "Ve las opciones que ofreces." },
                  { icon: CalendarDays, title: "Elige una fecha", text: "Revisa los días disponibles." },
                  { icon: Clock3, title: "Selecciona horario", text: "Escoge una hora libre." },
                  { icon: CalendarCheck2, title: "Reserva", text: "Completa la solicitud de cita." },
                ].map(({ icon: Icon, title, text }, index) => (
                  <li key={title} className="min-w-0 border-l-2 border-[#168e00] pl-4">
                    <Icon size={21} className="text-[#168e00]" aria-hidden="true" />
                    <p className="mt-2 text-xs font-bold text-[#168e00]">0{index + 1}</p>
                    <h3 className={`${heading} mt-1 text-base`}>{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[#40554a]">{text}</p>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-4 text-xs leading-5 text-[#5f7164]">
              {agendaExample?.service && agendaExample.slots.length
                ? "Ejemplo con información pública de Agenda. Los horarios pueden cambiar; esta vista no permite reservar."
                : "Recorrido ilustrativo. Consulta la disponibilidad real en la Agenda de cada negocio."}
            </p>
            <p className="mt-4 flex items-start gap-2 text-sm font-semibold text-[#004e28]">
              <Check size={18} className="mt-0.5 shrink-0 text-[#168e00]" aria-hidden="true" />
              Una vez realizada la reservación, puedes revisarla desde Drooopy.
            </p>
          </div>
        </section>

        {/* BENEFICIOS */}
        <section aria-labelledby="agenda-benefits-title" className="py-12 sm:py-16">
          <div className={container}>
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">
                Pensado para tu negocio
              </p>
              <h2 id="agenda-benefits-title" className={`${heading} mt-3 text-[1.8rem] leading-tight sm:text-[2.2rem]`}>
                Más tiempo para atender. Tus citas, en orden.
              </h2>
            </div>
            <div className="mt-7 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map(({ icon: Icon, title, text }) => (
                <article key={title} className="border-t border-[#004e28]/15 pt-5">
                  <Icon size={23} className="text-[#158900]" aria-hidden="true" />
                  <h3 className={`${heading} mt-4 text-lg leading-snug`}>{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#40554a]">{text}</p>
                </article>
              ))}
            </div>
            <div className="mt-10 flex flex-col gap-5 border-t border-[#004e28]/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-base font-semibold leading-6 text-[#004e28]">
                Organiza tus horarios y facilita que tus clientes reserven.
              </p>
              <MarketingCta
                href="#quiero-informacion"
                onClick={cta("benefits")}
                label="Solicitar información"
                className="w-full shrink-0 sm:w-auto"
              />
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
                "Estéticas y salones",
                "Especialistas en uñas",
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
          className="scroll-mt-24 bg-[#004e28] py-12 text-white sm:py-16"
        >
          <div className={container}>
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b9e8b2]">Opciones para tu negocio</p>
              <h2 id="agenda-pricing-title" className="mt-4 font-[family-name:var(--font-varela-round)] text-3xl leading-tight tracking-[-0.025em] sm:text-4xl">
                Elige cómo recibir reservaciones con Drooopy.
              </h2>
              <p className="mt-4 text-base leading-7 text-white/85">
                Agenda está incluida en estos planes, sin costo adicional por activarla.
                {paymentPlan ? ` Los cobros en línea desde Agenda están disponibles desde el plan ${paymentPlan.title}, por ${formatPrice(paymentPlan.price)} MXN ${paymentPlan.duration === "yearly" ? "al año" : "al mes"}.` : " Consulta en cada plan si incluye cobros en línea desde Agenda."}
              </p>
            </div>
            <div className={`mt-8 grid items-stretch gap-5 ${displayedPlans.length === 2 ? "md:grid-cols-2" : displayedPlans.length > 2 ? "md:grid-cols-2 xl:grid-cols-3" : "max-w-xl"}`} aria-live="polite">
              {displayedPlans.length ? displayedPlans.map((offer) => {
                const payments = offer.module_capabilities?.agenda?.online_payments_enabled;
                return (
                  <article key={offer.id} className="flex min-w-0 flex-col rounded-[1.65rem] bg-white p-6 text-[#17251c] shadow-[0_24px_60px_-40px_rgba(0,0,0,0.25)] sm:p-8">
                    <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#00672f]">{offer.title}</h3>
                    <div className="mt-4 flex flex-wrap items-end gap-x-2 gap-y-2">
                      <span className={`${heading} text-5xl leading-none`}>{formatPrice(offer.price)}</span>
                      <span className="pb-1 text-sm font-semibold text-[#40554a]">MXN / {offer.duration === "monthly" ? "mes" : "año"}</span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-[#004e28]">Agenda incluida, sin costo adicional de activación.</p>
                    <div className="mt-5 flex-1 border-t border-[#004e28]/10 pt-4 text-sm leading-6 text-[#40554a]">
                      <p>Gestiona reservaciones, muestra tus servicios y disponibilidad y comparte tu enlace de Agenda.</p>
                      <p className="mt-3 font-semibold text-[#004e28]">
                        {payments === true
                          ? "Incluye cobros en línea desde Agenda al vincular Mercado Pago y habilitar la opción."
                          : payments === false
                            ? "No incluye cobros en línea desde Agenda."
                            : "Consulta si este plan permite cobros en línea desde Agenda."}
                      </p>
                      <p className="mt-3 text-xs leading-5 text-[#5f7164]">
                        El importe corresponde a la suscripción{offer.duration === "yearly" ? " anual" : " mensual"}.
                        {payments === true ? " Mercado Pago puede cobrar comisiones por transacción." : ""}
                      </p>
                    </div>
                    <MarketingCta href="#quiero-informacion" onClick={cta("pricing")} label="Solicitar información" className="mt-6 w-full" />
                  </article>
                );
              }) : (
                <div className="rounded-[1.65rem] bg-white p-6 text-[#40554a] sm:p-8">
                  <p className="text-sm leading-6">{loadingPlans ? "Consultando planes disponibles…" : "No hay un precio público disponible en este momento. Déjanos tus datos y te orientamos."}</p>
                  <MarketingCta href="#quiero-informacion" onClick={cta("pricing")} label="Solicitar información" className="mt-6 w-full" />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* INVITACIÓN A SOLICITAR INFORMACIÓN */}
        <section
          id="quiero-informacion"
          ref={formRef}
          aria-labelledby="agenda-lead-title"
          className="scroll-mt-24 bg-[#f2f3f4] py-12 sm:py-16"
        >
          <div className={`${container} grid items-center gap-8 lg:grid-cols-[0.45fr_0.55fr] lg:gap-14`}>
            <div className="max-w-lg">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#00672f]">
                Hablemos de tu negocio
              </p>
              <h2 id="agenda-lead-title" className={`${heading} mt-3 text-3xl leading-tight sm:text-4xl`}>
                Descubre cómo recibir reservaciones con Drooopy.
              </h2>
              <p className="mt-4 text-base leading-7 text-[#40554a]">
                Cuéntanos sobre tu negocio y te explicamos cómo activar Agenda.
              </p>
              <p className="mt-5 flex items-start gap-2 text-sm font-semibold text-[#004e28]">
                <Check size={18} className="mt-0.5 shrink-0 text-[#158900]" aria-hidden="true" />
                Sin crear cuenta ni hacer un pago desde esta página.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-[#004e28]/10 bg-white p-6 shadow-[0_20px_60px_-45px_rgba(0,78,40,0.35)] sm:p-8">
              <h3 className={`${heading} text-2xl leading-snug`}>Así comienzas con tu agenda</h3>
              <ol className="mt-5 divide-y divide-[#004e28]/10">
                {[
                  { title: "Solicita información", text: "Completa el formulario con tu nombre y WhatsApp para que podamos contactarte." },
                  { title: "Conoce cómo activar tu agenda", text: "Te explicamos los planes disponibles, el proceso de contratación y la configuración de tus servicios y horarios." },
                  { title: "Comparte tu agenda", text: "Una vez activada y configurada, comparte tu enlace para que tus clientes puedan reservar." },
                ].map((step, index) => (
                  <li key={step.title} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f2f3f4] text-sm font-bold text-[#004e28]" aria-hidden="true">{index + 1}</span>
                    <div><p className="text-sm font-semibold text-[#004e28]">{step.title}</p><p className="mt-1 text-sm leading-6 text-[#40554a]">{step.text}</p></div>
                  </li>
                ))}
              </ol>
              <MarketingCta href="#quiero-informacion" onClick={cta("lead_section")} label="Solicitar información" className="mt-6 w-full" />
            </div>
          </div>
        </section>

        {/* DUDAS */}
        <section className="py-12 sm:py-16" aria-labelledby="agenda-faq-title">
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
        <section className="border-t border-[#004e28]/10 bg-[#fbfcfa] py-12 sm:py-16" aria-labelledby="agenda-closing-title">
          <div className={`${container} flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between`}>
            <div className="max-w-2xl">
              <h2 id="agenda-closing-title" className={`${heading} text-3xl leading-tight sm:text-4xl`}>
                Atiende a tus clientes. Deja que los siguientes reserven.
              </h2>
              <p className="mt-3 text-sm leading-7 text-[#40554a] sm:text-base">
                Comparte tus servicios y horarios desde un enlace de Drooopy.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 lg:shrink-0">
              <MarketingCta
                href="#quiero-informacion"
                onClick={cta("final")}
                label={agendaCtaLabel}
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
        className={`${isLeadModalOpen ? "hidden" : "fixed"} right-4 z-30 shadow-md ${showSticky ? "bottom-24 md:bottom-5" : "bottom-5"}`}
      />
      <MarketingStickyCta
        visible={showSticky}
        href="#quiero-informacion"
        onClick={cta("sticky_mobile")}
        label={agendaCtaLabel}
      />
      {isLeadModalOpen ? (
        <MarketingLeadModal
          openerRef={modalOpener}
          onClose={() => setLeadModalOpen(false)}
          onLeadCreated={() => emitCampaignEvent("agenda", "lead_created", "lead_form")}
        />
      ) : null}
    </div>
  );
}
