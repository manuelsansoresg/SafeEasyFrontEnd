import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Handshake, ShieldCheck, Store, Truck, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Nosotros | Drooopy",
  description: "Conoce la misión de Drooopy y cómo conectamos compradores con vendedores de confianza.",
};

const values = [
  {
    icon: ShieldCheck,
    title: "Confianza primero",
    text: "Cuidamos cada paso de la experiencia para que comprar, vender y coordinar entregas sea más claro.",
  },
  {
    icon: Store,
    title: "Impulso local",
    text: "Damos visibilidad a negocios que quieren vender mejor, llegar más lejos y operar con herramientas simples.",
  },
  {
    icon: Handshake,
    title: "Relaciones reales",
    text: "Conectamos personas, empresas y productos con información útil antes de tomar una decisión.",
  },
];

const highlights = [
  {
    icon: Store,
    title: "Catálogos claros",
    text: "Los negocios pueden mostrar sus productos con información ordenada y fácil de consultar.",
  },
  {
    icon: ShieldCheck,
    title: "Compra con confianza",
    text: "Cada experiencia está pensada para que el usuario revise, compare y decida con más seguridad.",
  },
  {
    icon: Handshake,
    title: "Conexiones simples",
    text: "Acercamos a las personas con los negocios que necesitan, sin procesos confusos ni pasos innecesarios.",
  },
];

const steps = [
  {
    icon: Users,
    title: "Compradores",
    text: "Encuentran productos, comparan opciones y dan seguimiento a sus pedidos desde un mismo lugar.",
  },
  {
    icon: Store,
    title: "Vendedores",
    text: "Publican su catálogo, administran pedidos y muestran su marca con una página propia dentro de Drooopy.",
  },
  {
    icon: Truck,
    title: "Entregas",
    text: "El flujo de compra se acompaña con estados claros para saber qué está pasando con cada pedido.",
  },
];

export default function NosotrosPage() {
  return (
    <div className="bg-white">
      <section className="bg-primary text-white">
        <div className="container mx-auto px-4 pt-40 pb-16 md:pt-48 md:pb-24">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="font-[family-name:var(--font-varela-round)] text-lg text-[#7ed957] mb-4">
                Nosotros
              </p>
              <h1 className="font-[family-name:var(--font-varela-round)] text-4xl md:text-6xl leading-tight max-w-3xl">
                Comercio digital más simple, seguro y cercano.
              </h1>
              <p className="mt-6 max-w-2xl text-base md:text-lg leading-8 text-white/85">
                Drooopy nace para conectar compradores con vendedores confiables, ayudando a que cada negocio pueda mostrar sus productos, recibir pedidos y crecer con una experiencia clara.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/sell"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 font-semibold text-primary transition hover:bg-[#7ed957]"
                >
                  Vender en Drooopy
                  <ArrowRight size={18} />
                </Link>
                <Link
                  href="/contacto"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/40 px-6 font-semibold text-white transition hover:bg-white/10"
                >
                  Contacto
                </Link>
              </div>
            </div>
            <div className="relative min-h-[320px] overflow-hidden rounded-lg bg-white/10">
              <Image
                src="/business-support-team.png"
                alt="Equipo de soporte acompañando negocios en Drooopy"
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="container mx-auto px-4">
          <div className="grid gap-4 md:grid-cols-3">
            {highlights.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-[#f2f3f4] text-primary">
                  <Icon size={22} />
                </div>
                <h2 className="text-xl font-bold text-primary">{title}</h2>
                <p className="mt-3 text-sm leading-7 text-gray-500">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f2f3f4] py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <p className="font-[family-name:var(--font-varela-round)] text-lg text-secondary">Lo que hacemos</p>
            <h2 className="mt-3 font-[family-name:var(--font-varela-round)] text-3xl md:text-5xl text-primary">
              Una plataforma para que comprar y vender tenga menos fricción.
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-lg bg-white p-6 shadow-sm">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-white">
                  <Icon size={22} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-gray-500">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="font-[family-name:var(--font-varela-round)] text-lg text-secondary">Nuestros principios</p>
              <h2 className="mt-3 font-[family-name:var(--font-varela-round)] text-3xl md:text-5xl text-primary">
                Crecemos cuando el comercio se siente confiable.
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {values.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-lg border border-gray-100 p-6">
                  <div className="mb-4 text-secondary">
                    <Icon size={28} />
                  </div>
                  <h3 className="font-bold text-gray-900">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-gray-500">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-primary py-14 text-white">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 text-[#7ed957]">
                <BadgeCheck size={20} />
                <span className="text-sm font-semibold">Drooopy para negocios</span>
              </div>
              <h2 className="font-[family-name:var(--font-varela-round)] text-3xl md:text-4xl">
                Haz que tu catálogo trabaje por ti.
              </h2>
            </div>
            <Link
              href="/sell"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 font-semibold text-primary transition hover:bg-[#7ed957]"
            >
              Empezar a vender
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
