import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, HelpCircle, MapPin, MessageSquare, Send, Store, UserRound } from "lucide-react";
import { SupportStartButton } from "@/components/support-chat/SupportStartButton";

export const metadata: Metadata = {
  title: "Contacto | Drooopy",
  description: "Contacta a Drooopy para recibir ayuda como comprador, vendedor o negocio interesado.",
};

const contactOptions = [
  {
    icon: UserRound,
    title: "Compradores",
    text: "Consulta dudas sobre pedidos, compras, pagos y seguimiento desde el centro de ayuda.",
    href: "/centro-de-ayuda",
    action: "Ir al centro de ayuda",
  },
  {
    icon: Store,
    title: "Vendedores",
    text: "Registra tu negocio, publica tu catálogo y administra tus ventas desde Drooopy.",
    href: "/sell",
    action: "Vender en Drooopy",
  },
  {
    icon: MessageSquare,
    title: "Soporte general",
    text: "Escríbenos si necesitas orientación para usar la plataforma o resolver una duda específica.",
    href: null,
    action: "Abrir chat de soporte",
  },
];

const reasons = [
  "Dudas sobre compras o pedidos",
  "Alta de vendedores y empresas",
  "Privacidad, términos y uso de la plataforma",
  "Reportes sobre publicaciones o experiencia de compra",
];

export default function ContactoPage() {
  return (
    <div className="bg-white">
      <section className="bg-primary text-white">
        <div className="container mx-auto px-4 pt-40 pb-16 md:pt-48 md:pb-24">
          <div className="max-w-4xl">
            <p className="font-[family-name:var(--font-varela-round)] text-lg text-[#7ed957] mb-4">
              Contacto
            </p>
            <h1 className="font-[family-name:var(--font-varela-round)] text-4xl md:text-6xl leading-tight">
              Estamos para ayudarte a comprar, vender y resolver dudas.
            </h1>
            <p className="mt-6 max-w-2xl text-base md:text-lg leading-8 text-white/85">
              Elige el canal que mejor se ajuste a lo que necesitas. Te guiamos para encontrar respuestas, iniciar como vendedor o comunicarte con soporte.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-5 md:grid-cols-3">
            {contactOptions.map(({ icon: Icon, title, text, href, action }) => (
              <article key={title} className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-white">
                  <Icon size={22} />
                </div>
                <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                <p className="mt-3 text-sm leading-7 text-gray-500">{text}</p>
                {href ? (
                  <Link
                    href={href}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-secondary transition hover:text-primary"
                  >
                    {action}
                    <ArrowRight size={16} />
                  </Link>
                ) : (
                  <SupportStartButton label={action} variant="link" />
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f2f3f4] py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="font-[family-name:var(--font-varela-round)] text-lg text-secondary">Antes de escribir</p>
              <h2 className="mt-3 font-[family-name:var(--font-varela-round)] text-3xl md:text-5xl text-primary">
                Cuéntanos qué necesitas y te llevamos al lugar correcto.
              </h2>
              <p className="mt-5 text-base leading-8 text-gray-600">
                Para pedidos activos, revisa tu cuenta y el detalle del pedido. Para vender, el registro de empresas te guía paso a paso.
              </p>
            </div>

            <div className="rounded-lg bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900">Motivos frecuentes</h3>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {reasons.map((reason) => (
                  <div key={reason} className="flex items-start gap-3 rounded-lg border border-gray-100 p-4">
                    <HelpCircle className="mt-0.5 shrink-0 text-secondary" size={18} />
                    <p className="text-sm leading-6 text-gray-600">{reason}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <SupportStartButton />
                <Link
                  href="/centro-de-ayuda"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-primary px-6 font-semibold text-primary transition hover:bg-primary hover:text-white"
                >
                  <Send size={18} />
                  Ver ayuda
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="container mx-auto px-4">
          <div className="rounded-lg border border-gray-100 p-6 md:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#f2f3f4] text-primary">
                  <MapPin size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Drooopy México</h2>
                  <p className="mt-2 text-sm leading-7 text-gray-500">
                    Plataforma digital para conectar compradores, vendedores y entregas en México.
                  </p>
                </div>
              </div>
              <Link
                href="/sell"
                className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-6 font-semibold text-white transition hover:bg-secondary"
              >
                Registrar mi empresa
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
