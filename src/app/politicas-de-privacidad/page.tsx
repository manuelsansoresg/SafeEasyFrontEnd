import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Política de privacidad | Drooopy",
  description: "Conoce cómo Drooopy maneja la privacidad y protección de datos de sus usuarios.",
};

const sections = [
  {
    title: "Datos de cuenta",
    text: "Podemos solicitar datos como nombre, correo, teléfono, dirección o información de empresa para crear cuentas, operar pedidos y mantener la comunicación necesaria.",
  },
  {
    title: "Uso de información",
    text: "La información se utiliza para brindar acceso a la plataforma, procesar operaciones, mejorar la experiencia y prevenir usos indebidos.",
  },
  {
    title: "Comunicación",
    text: "Podemos enviar notificaciones relacionadas con pedidos, cuenta, seguridad o cambios importantes en el servicio.",
  },
  {
    title: "Protección",
    text: "Aplicamos medidas razonables para proteger la información y recomendamos a cada usuario mantener sus accesos seguros.",
  },
  {
    title: "Derechos del usuario",
    text: "Los usuarios pueden solicitar orientación sobre sus datos personales a través de los canales de contacto disponibles.",
  },
];

export default function PoliticasDePrivacidadPage() {
  return (
    <div className="bg-white">
      <section className="bg-primary text-white">
        <div className="container mx-auto px-4 pt-40 pb-16 md:pt-48 md:pb-24">
          <div className="max-w-4xl">
            <p className="font-[family-name:var(--font-varela-round)] text-lg text-[#7ed957] mb-4">
              Política de privacidad
            </p>
            <h1 className="font-[family-name:var(--font-varela-round)] text-4xl md:text-6xl leading-tight">
              Cuidamos la información que hace funcionar tu experiencia.
            </h1>
            <p className="mt-6 max-w-2xl text-base md:text-lg leading-8 text-white/85">
              Esta página explica de forma general cómo se usan los datos dentro de Drooopy para operar cuentas, pedidos, catálogos y soporte.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 md:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl space-y-4">
            {sections.map((section) => (
              <article key={section.title} className="rounded-lg border border-gray-100 p-6 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f2f3f4] text-primary">
                    <LockKeyhole size={20} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{section.title}</h2>
                    <p className="mt-3 text-sm leading-7 text-gray-500">{section.text}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f2f3f4] py-14">
        <div className="container mx-auto px-4">
          <div className="mx-auto flex max-w-4xl flex-col gap-6 rounded-lg bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between md:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-primary">¿Quieres consultar algo sobre privacidad?</h2>
                <p className="mt-2 text-sm leading-7 text-gray-500">
                  Escríbenos desde contacto para recibir orientación.
                </p>
              </div>
            </div>
            <Link
              href="/contacto"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 font-semibold text-white transition hover:bg-secondary"
            >
              Contacto
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
