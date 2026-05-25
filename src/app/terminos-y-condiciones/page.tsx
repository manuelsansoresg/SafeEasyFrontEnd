import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Términos y condiciones | Drooopy",
  description: "Consulta los términos generales de uso de Drooopy.",
};

const sections = [
  {
    title: "Uso de la plataforma",
    text: "Drooopy facilita la conexión entre compradores y vendedores. Cada usuario debe usar la plataforma con información veraz, respetar las reglas de publicación y mantener sus datos actualizados.",
  },
  {
    title: "Publicaciones y catálogos",
    text: "Los vendedores son responsables de la información, disponibilidad, precios, imágenes y condiciones de sus productos o servicios publicados.",
  },
  {
    title: "Compras y pedidos",
    text: "Los compradores deben revisar los detalles de cada producto y confirmar sus datos antes de completar una compra o solicitar una entrega.",
  },
  {
    title: "Cuentas y seguridad",
    text: "Cada usuario es responsable de proteger su acceso, no compartir contraseñas y reportar cualquier actividad no reconocida.",
  },
  {
    title: "Cambios del servicio",
    text: "Drooopy puede ajustar funciones, contenidos o condiciones para mejorar la experiencia, cumplir obligaciones operativas o reforzar la seguridad.",
  },
];

export default function TerminosYCondicionesPage() {
  return (
    <div className="bg-white">
      <section className="bg-primary text-white">
        <div className="container mx-auto px-4 pt-40 pb-16 md:pt-48 md:pb-24">
          <div className="max-w-4xl">
            <p className="font-[family-name:var(--font-varela-round)] text-lg text-[#7ed957] mb-4">
              Términos y condiciones
            </p>
            <h1 className="font-[family-name:var(--font-varela-round)] text-4xl md:text-6xl leading-tight">
              Reglas claras para usar Drooopy.
            </h1>
            <p className="mt-6 max-w-2xl text-base md:text-lg leading-8 text-white/85">
              Esta sección resume los lineamientos generales de uso de la plataforma para compradores, vendedores y usuarios registrados.
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
                    <FileText size={20} />
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
            <div>
              <h2 className="text-2xl font-bold text-primary">¿Tienes dudas sobre estos términos?</h2>
              <p className="mt-2 text-sm leading-7 text-gray-500">
                Puedes escribirnos desde la sección de contacto.
              </p>
            </div>
            <Link
              href="/contacto"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 font-semibold text-white transition hover:bg-secondary"
            >
              Ir a contacto
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
