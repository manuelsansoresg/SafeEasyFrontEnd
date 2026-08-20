"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  Clock3,
  Image as ImageIcon,
  Info,
  MapPin,
  Share2,
  Store,
} from "lucide-react";
import { getCompanyProfileCompletion } from "@/lib/companyProfileCompletion";

type Supplier = Record<string, unknown> & {
  name?: string;
  logo?: string;
  logo_url?: string;
};

type CompanyOverviewProps = {
  supplier: Supplier;
  isDirectory: boolean;
  onNavigate: (tab: string) => void;
};

const cards = [
  {
    id: "information",
    title: "Información",
    description: "Nombre, descripción y ubicación de tu negocio",
    icon: Info,
  },
  {
    id: "appearance",
    title: "Apariencia",
    description: "Logo e imagen de identidad del negocio",
    icon: ImageIcon,
  },
  {
    id: "header",
    title: "Encabezado",
    description: "Video de portada o imágenes del carrusel",
    icon: ImageIcon,
  },
  {
    id: "hours",
    title: "Horarios",
    description: "Indica cuándo pueden encontrarte tus clientes",
    icon: Clock3,
  },
  {
    id: "contact",
    title: "Contacto",
    description: "Teléfono y redes sociales de tu negocio",
    icon: MapPin,
  },
] as const;

export function CompanyOverview({ supplier, isDirectory, onNavigate }: CompanyOverviewProps) {
  const completion = getCompanyProfileCompletion(supplier, { isDirectory });
  const logo = String(supplier.logo_url || supplier.logo || "").trim();
  const nextIncomplete = completion.sections.find((section) => !section.complete);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-[#004e28]/10 bg-white shadow-[0_16px_50px_rgba(0,78,40,0.07)]">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_19rem] lg:items-center">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#f2f3f4] text-[#004e28] ring-1 ring-black/5">
              {logo ? (
                // The API may return either an absolute URL or the existing proxied static path.
                <img src={logo} alt={`Logo de ${supplier.name || "tu negocio"}`} className="h-full w-full object-cover" />
              ) : (
                <Store size={28} aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#168e00]/10 px-2.5 py-1 text-xs font-semibold text-[#0b6d00]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#168e00]" />
                Perfil publicado
              </span>
              <h2 className="mt-3 truncate font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28]">
                {supplier.name || "Mi negocio"}
              </h2>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Mantén tu información al día para que más personas puedan encontrarte y contactarte.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-[#f2f3f4] p-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Tu perfil</p>
                <p className="mt-1 text-sm font-medium text-gray-700">
                  {completion.completed} de {completion.total} pasos listos
                </p>
              </div>
              <span className="font-[family-name:var(--font-varela-round)] text-3xl text-[#004e28]">
                {completion.percentage}%
              </span>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-white"
              role="progressbar"
              aria-label="Perfil completado"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completion.percentage}
            >
              <div
                className="h-full rounded-full bg-[#168e00] transition-[width] duration-500"
                style={{ width: `${completion.percentage}%` }}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 bg-[#fbfcfb] px-5 py-4 sm:px-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {completion.sections.map((section) => (
                <span key={section.id} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                  <span
                    className={`flex h-4 w-4 items-center justify-center rounded-full ${
                      section.complete ? "bg-[#168e00] text-white" : "border border-gray-300 bg-white"
                    }`}
                  >
                    {section.complete ? <Check size={11} aria-hidden="true" /> : null}
                  </span>
                  {section.label}
                </span>
              ))}
            </div>
            {nextIncomplete ? (
              <button
                type="button"
                onClick={() => onNavigate(nextIncomplete.id === "logo" ? "appearance" : nextIncomplete.id)}
                className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-[#004e28] hover:text-[#168e00]"
              >
                Seguir completando <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="quick-access-title">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h3 id="quick-access-title" className="font-[family-name:var(--font-varela-round)] text-xl text-[#004e28]">
              Accesos rápidos
            </h3>
            <p className="mt-1 text-sm text-gray-500">Elige solamente lo que quieres actualizar.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                type="button"
                key={card.id}
                onClick={() => onNavigate(card.id)}
                className="group flex min-h-32 items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#168e00]/40 hover:shadow-lg hover:shadow-[#004e28]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00] focus-visible:ring-offset-2"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#004e28]/[0.06] text-[#004e28] transition group-hover:bg-[#004e28] group-hover:text-white">
                  <Icon size={21} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-gray-900">{card.title}</span>
                  <span className="mt-1 block text-sm leading-5 text-gray-500">{card.description}</span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#168e00]">
                    Editar <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onNavigate("sharing")}
          className="flex items-center gap-3 rounded-2xl bg-[#004e28] p-5 text-left text-white transition hover:bg-[#003d20]"
        >
          <Share2 size={22} aria-hidden="true" />
          <span>
            <span className="block font-semibold">Compartir mi negocio</span>
            <span className="block text-sm text-white/70">Enlace y código QR en un solo lugar</span>
          </span>
        </button>
        <Link
          href={isDirectory ? "/admin/services" : "/admin/products"}
          className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-[#168e00]/40"
        >
          <Store size={22} className="text-[#004e28]" aria-hidden="true" />
          <span>
            <span className="block font-semibold text-gray-900">
              {isDirectory ? "Administrar servicios" : "Administrar productos"}
            </span>
            <span className="block text-sm text-gray-500">Abre el módulo que ya conoces</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
