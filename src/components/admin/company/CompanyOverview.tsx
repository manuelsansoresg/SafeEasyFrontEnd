"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Clock3,
  Image as ImageIcon,
  Info,
  MapPin,
  Share2,
  Store,
} from "lucide-react";
import { BusinessTypePickerModal } from "@/components/admin/company/BusinessTypePickerModal";
import { Toast } from "@/components/ui/Toast";
import { getCompanyProfileCompletion } from "@/lib/companyProfileCompletion";
import type { SupplierBusinessType } from "@/lib/currentSupplier";
import { supplierModuleScreens } from "@/lib/supplierModules";

type Supplier = Record<string, unknown> & {
  id: number;
  name?: string;
  logo?: string;
  logo_url?: string;
  business_type_id?: number | null;
  business_type?: SupplierBusinessType | null;
};

type CompanyOverviewProps = {
  supplier: Supplier;
  isDirectory: boolean;
  enabledModules: (typeof supplierModuleScreens)[number][];
  onNavigate: (tab: string) => void;
  onSupplierUpdated: () => Promise<void> | void;
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

export function CompanyOverview({ supplier, isDirectory, enabledModules, onNavigate, onSupplierUpdated }: CompanyOverviewProps) {
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const completion = getCompanyProfileCompletion(supplier, { isDirectory });
  const logo = String(supplier.logo_url || supplier.logo || "").trim();
  const nextIncomplete = completion.sections.find((section) => !section.complete);
  const businessType = supplier.business_type;
  const businessTypeId = supplier.business_type_id ?? businessType?.id ?? null;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function handleBusinessTypeSaved() {
    await onSupplierUpdated();
    setTypePickerOpen(false);
    setToast("Tipo de negocio actualizado.");
  }

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

      {businessType ? <section aria-labelledby="business-type-title" className="rounded-2xl border border-[#004e28]/15 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-[#f2f3f4]">
            {businessType.icon_url ? <Image src={businessType.icon_url} alt="" fill sizes="64px" className="object-contain p-2" /> : <BriefcaseBusiness size={28} className="text-[#004e28]" aria-hidden="true" />}
          </div>
          <div className="min-w-0 flex-1">
            <p id="business-type-title" className="text-xs font-semibold uppercase tracking-[0.14em] text-[#168e00]">Tipo de negocio</p>
            <h3 className="mt-1 font-[family-name:var(--font-varela-round)] text-xl text-[#004e28]">{businessType.name}</h3>
            <p className="mt-1 max-w-xl text-sm leading-6 text-gray-600">Este tipo ayuda a clasificar tu negocio y mostrarlo en las secciones correctas.</p>
          </div>
          <button type="button" onClick={() => setTypePickerOpen(true)} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-[#168e00]/30 px-4 py-2.5 text-sm font-semibold text-[#0b6d00] transition hover:border-[#168e00] hover:bg-[#168e00]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00] focus-visible:ring-offset-2">Cambiar tipo</button>
        </div>
      </section> : <section aria-labelledby="business-type-title" className="rounded-2xl border border-[#168e00]/30 bg-[#168e00]/[0.06] p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-[#004e28] shadow-sm ring-1 ring-[#168e00]/15"><BriefcaseBusiness size={26} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p id="business-type-title" className="text-xs font-bold uppercase tracking-[0.16em] text-[#0b6d00]">Clasifica tu negocio</p>
            <p className="mt-1 text-sm leading-6 text-gray-700">Selecciona qué tipo de negocio describe mejor tu actividad.</p>
          </div>
          <button type="button" onClick={() => setTypePickerOpen(true)} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#004e28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00] focus-visible:ring-offset-2">Elegir tipo de negocio</button>
        </div>
      </section>}

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

      {enabledModules.length > 0 ? (
        <section aria-labelledby="business-modules-title">
          <h3 id="business-modules-title" className="font-[family-name:var(--font-varela-round)] text-xl text-[#004e28]">Módulos de tu negocio</h3>
          <p className="mt-1 text-sm text-gray-500">Administra las funciones adicionales habilitadas para tu negocio.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {enabledModules.map((module) => {
              const Icon = module.icon;
              return <Link key={module.code} href={module.path} className="group flex min-h-32 items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#168e00]/40 hover:shadow-lg hover:shadow-[#004e28]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00] focus-visible:ring-offset-2">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#004e28]/[0.06] text-[#004e28] transition group-hover:bg-[#004e28] group-hover:text-white"><Icon size={21} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block font-semibold text-gray-900">{module.title}</span><span className="mt-1 block text-sm leading-5 text-gray-500">{module.description}</span><span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#168e00]">Administrar <ArrowRight size={14} aria-hidden="true" /></span></span>
              </Link>;
            })}
          </div>
        </section>
      ) : null}

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

      {typePickerOpen ? <BusinessTypePickerModal supplierId={supplier.id} currentId={businessTypeId} onClose={() => setTypePickerOpen(false)} onSaved={handleBusinessTypeSaved} /> : null}
      {toast ? <Toast type="success" message={toast} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
