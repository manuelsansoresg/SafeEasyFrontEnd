import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, HelpCircle, PackageCheck, ShieldCheck, Store, Truck } from "lucide-react";

export const metadata: Metadata = {
  title: "Centro de ayuda | Drooopy",
  description: "Encuentra respuestas sobre compras, ventas, entregas y seguridad dentro de Drooopy.",
};

const topics = [
  {
    icon: PackageCheck,
    title: "Compras y pedidos",
    text: "Revisa tus pedidos desde tu cuenta, consulta el estado y valida la información del vendedor antes de comprar.",
  },
  {
    icon: Store,
    title: "Vender en Drooopy",
    text: "Crea tu perfil de empresa, agrega productos, personaliza tu catálogo y administra tus solicitudes.",
  },
  {
    icon: Truck,
    title: "Entregas",
    text: "Consulta el avance de cada pedido y mantén tus datos de entrega completos para evitar retrasos.",
  },
  {
    icon: ShieldCheck,
    title: "Seguridad",
    text: "Protege tu cuenta, revisa la información de cada publicación y evita compartir datos sensibles fuera de la plataforma.",
  },
];

const faqs = [
  {
    question: "¿Cómo encuentro productos?",
    answer: "Usa la búsqueda principal, explora categorías o revisa recomendaciones dentro de la página de inicio.",
  },
  {
    question: "¿Cómo registro mi empresa?",
    answer: "Entra a Vender en Drooopy y completa el flujo de registro para crear tu perfil y catálogo.",
  },
  {
    question: "¿Dónde reviso mis pedidos?",
    answer: "Inicia sesión y entra a tu cuenta de cliente para ver pedidos, favoritos y datos de entrega.",
  },
];

export default function CentroDeAyudaPage() {
  return (
    <div className="bg-white">
      <section className="bg-primary text-white">
        <div className="container mx-auto px-4 pt-40 pb-16 md:pt-48 md:pb-24">
          <div className="max-w-4xl">
            <p className="font-[family-name:var(--font-varela-round)] text-lg text-[#7ed957] mb-4">
              Centro de ayuda
            </p>
            <h1 className="font-[family-name:var(--font-varela-round)] text-4xl md:text-6xl leading-tight">
              Respuestas rápidas para usar Drooopy con confianza.
            </h1>
            <p className="mt-6 max-w-2xl text-base md:text-lg leading-8 text-white/85">
              Encuentra orientación sobre compras, ventas, entregas, seguridad y gestión de tu cuenta.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {topics.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-white">
                  <Icon size={22} />
                </div>
                <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                <p className="mt-3 text-sm leading-7 text-gray-500">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f2f3f4] py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="font-[family-name:var(--font-varela-round)] text-lg text-secondary">Preguntas frecuentes</p>
              <h2 className="mt-3 font-[family-name:var(--font-varela-round)] text-3xl md:text-5xl text-primary">
                Lo básico para empezar.
              </h2>
            </div>
            <div className="space-y-4">
              {faqs.map((item) => (
                <article key={item.question} className="rounded-lg bg-white p-6 shadow-sm">
                  <div className="flex items-start gap-3">
                    <HelpCircle className="mt-1 shrink-0 text-secondary" size={20} />
                    <div>
                      <h3 className="font-bold text-gray-900">{item.question}</h3>
                      <p className="mt-2 text-sm leading-7 text-gray-500">{item.answer}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-6 rounded-lg border border-gray-100 p-6 md:flex-row md:items-center md:justify-between md:p-8">
            <div>
              <h2 className="text-2xl font-bold text-primary">¿Necesitas más ayuda?</h2>
              <p className="mt-2 text-sm leading-7 text-gray-500">
                Escríbenos desde contacto y cuéntanos qué quieres resolver.
              </p>
            </div>
            <Link
              href="/contacto"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 font-semibold text-white transition hover:bg-secondary"
            >
              Contactar a Drooopy
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
