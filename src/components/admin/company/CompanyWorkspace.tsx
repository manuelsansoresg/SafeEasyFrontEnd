"use client";

import Link from "next/link";
import { useMemo, type ComponentProps, type ReactNode } from "react";
import { Award, Facebook, Clock3, ExternalLink, Home, Image as ImageIcon, Info, MessageCircle, Package, Paintbrush, PanelTop, QrCode, Truck, ShieldCheck } from "lucide-react";
import SupplierForm from "@/components/admin/SupplierForm";
import StepCarousel from "@/components/sell/wizard/StepCarousel";
import StepCertificates from "@/components/sell/wizard/StepCertificates";
import BusinessHoursEditor from "@/components/admin/BusinessHoursEditor";
import QRPanel from "@/components/admin/QRPanel";
import { SupplierShippingSettings } from "@/components/admin/shipping/SupplierShippingSettings";
import { CompanyOverview } from "@/components/admin/company/CompanyOverview";
import { SupplierPaletteEditor } from "@/components/admin/company/SupplierPaletteEditor";
import { getSupplierSlug, type SupplierBusinessType } from "@/lib/currentSupplier";
import { getCompanyProfileCompletion } from "@/lib/companyProfileCompletion";
import { supplierModuleScreens } from "@/lib/supplierModules";

export type CompanySupplier = NonNullable<ComponentProps<typeof SupplierForm>["initialData"]> & {
  slug?: string;
  business_type_id?: number | null;
  business_type?: SupplierBusinessType | null;
  is_demo?: boolean;
  is_directory?: boolean;
  [key: string]: unknown;
};
export type CompanyTab = "overview" | "information" | "appearance" | "header" | "hours" | "contact" | "sharing" | "shipping" | "advanced" | "administration";
export const normalizeCompanyTab = (value: string | null): CompanyTab => {
  const legacy: Record<string, CompanyTab> = { info: "information", carousel: "header", certificates: "advanced", qr: "sharing" };
  const normalized = value ? legacy[value] || value : "overview";
  return ["overview", "information", "appearance", "header", "hours", "contact", "sharing", "shipping", "advanced", "administration"].includes(normalized) ? normalized as CompanyTab : "overview";
};

export function CompanyWorkspace({ supplier, token, isDirectory, enabledModules, activeTab, onNavigate: navigate, onSupplierUpdated, administration, isSupplierAccount = false }: {
  supplier: CompanySupplier;
  token: string;
  isDirectory: boolean;
  enabledModules: (typeof supplierModuleScreens)[number][];
  activeTab: CompanyTab;
  onNavigate: (tab: string) => void;
  onSupplierUpdated: () => Promise<void>;
  administration?: ReactNode;
  isSupplierAccount?: boolean;
}) {
  const isAdmin = administration != null;
  const customizeHref = isAdmin ? `/admin/suppliers/${supplier.id}/customize` : "/admin/my-company/customize";
  const navItems = useMemo(() => [
    { id: "overview", label: "Inicio", icon: Home },
    { id: "information", label: "Información", icon: Info },
    { id: "appearance", label: "Apariencia", icon: ImageIcon },
    { id: "header", label: "Encabezado", icon: PanelTop },
    { id: "hours", label: "Horarios", icon: Clock3 },
    { id: "contact", label: "Contacto", icon: MessageCircle },
    { id: "sharing", label: "Compartir", icon: QrCode },
    ...(isSupplierAccount ? [{ id: "shipping", label: "Costo de envío", icon: Truck }] : []),
    { id: "advanced", label: "Más opciones", icon: Award },
    ...(isAdmin ? [{ id: "administration", label: "Administración", icon: ShieldCheck }] : []),
  ], [isSupplierAccount, isAdmin]);
  const slug = getSupplierSlug(supplier);
  const profileUrl = slug ? `/${supplier.is_demo === true ? "demos" : "empresas"}/${encodeURIComponent(slug)}` : null;
  const completion = getCompanyProfileCompletion(supplier, { isDirectory });

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5">
      <header className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm sm:px-6">
        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#168e00]">{isAdmin ? "Gestionar proveedor" : "Mi negocio"}</p><span className="rounded-full bg-[#f2f3f4] px-2 py-0.5 text-[11px] font-medium text-gray-600">{isDirectory ? "Directorio" : "Tienda"}</span></div>
            <h1 className="mt-1 break-words font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28] sm:text-[1.7rem]">{supplier.name}</h1>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500"><div className="h-1.5 w-28 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#168e00]" style={{ width: `${completion.percentage}%` }} /></div><span>{completion.percentage}% completo</span></div>
          </div>
          <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-3 xl:gap-3">
            <Link href={`/admin/my-company/import-facebook?supplier_id=${supplier.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#004e28]/20 px-4 py-2.5 text-sm font-semibold text-[#004e28] transition hover:bg-[#f2f3f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00]"><Facebook size={16} aria-hidden="true" />Importar desde Facebook</Link>
            <Link href={customizeHref} className="portal-customizer-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#004e28] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#168e00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00] focus-visible:ring-offset-2"><Paintbrush size={16} aria-hidden="true" />Personalizar portal</Link>
            {profileUrl ? <Link href={profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#004e28]/20 px-4 py-2.5 text-sm font-semibold text-[#004e28] transition hover:bg-[#004e28] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00] focus-visible:ring-offset-2">{isAdmin ? "Ver portal" : "Ver mi negocio"} <ExternalLink size={16} aria-hidden="true" /></Link> : null}
          </div>
        </div>
      </header>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[13.5rem_minmax(0,1fr)]">
        <aside className="min-w-0 xl:sticky xl:top-28 xl:self-start">
          <nav aria-label="Secciones de mi negocio" className="flex w-full min-w-0 gap-2 overflow-x-auto pb-2 xl:block xl:space-y-1 xl:overflow-visible">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return <button key={item.id} type="button" onClick={() => navigate(item.id)} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition xl:w-full ${active ? "bg-[#004e28] text-white shadow-sm" : "bg-white text-gray-600 hover:bg-[#004e28]/[0.06] hover:text-[#004e28] xl:bg-transparent"}`}><Icon size={18} aria-hidden="true" />{item.label}</button>;
            })}
            {!isAdmin ? <div className="hidden border-t border-gray-200 pt-3 xl:mt-3 xl:block"><Link href={isDirectory ? "/admin/services" : "/admin/products"} className="flex min-h-11 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-[#004e28]/[0.06] hover:text-[#004e28]"><Package size={18} aria-hidden="true" />{isDirectory ? "Mis servicios" : "Mis productos"}</Link></div> : null}
            {enabledModules.length > 0 ? (
              <div className="flex shrink-0 items-center gap-2 border-l border-gray-200 pl-3 xl:mt-3 xl:block xl:space-y-1 xl:border-l-0 xl:border-t xl:pl-0 xl:pt-3">
                <span className="px-2 text-xs font-semibold uppercase tracking-wide text-[#004e28] xl:block">Módulos</span>
                {enabledModules.map((module) => {
                  const Icon = module.icon;
                  return <Link key={module.code} href={module.path} className="inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl bg-white px-3.5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-[#004e28]/[0.06] hover:text-[#004e28] xl:flex xl:w-full xl:bg-transparent"><Icon size={18} aria-hidden="true" />{module.title}</Link>;
                })}
              </div>
            ) : null}
          </nav>
        </aside>

        <main className="min-w-0">
          {activeTab === "administration" ? administration : null}
          {activeTab === "overview" ? <CompanyOverview supplier={supplier} isDirectory={isDirectory} enabledModules={enabledModules} onNavigate={navigate} onSupplierUpdated={onSupplierUpdated} showSupplierModules={!isAdmin} showCatalogLink={!isAdmin} /> : null}
          {activeTab === "information" ? <SectionCard title="Información" description="Los datos principales y la ubicación de tu negocio."><SupplierForm initialData={supplier} isEditMode view="information" onSaved={() => onSupplierUpdated()} /></SectionCard> : null}
          {activeTab === "appearance" ? <SectionCard title="Apariencia" description="Colores, logo e imágenes de identidad de tu negocio."><SupplierPaletteEditor key={JSON.stringify([supplier.id, supplier.primary_color, supplier.header_background_color, supplier.page_background_color, supplier.card_background_color])} supplier={supplier} onSaved={onSupplierUpdated} /><SupplierForm initialData={supplier} isEditMode view="appearance" onSaved={() => onSupplierUpdated()} /></SectionCard> : null}
          {activeTab === "header" && token ? <SectionCard title="Encabezado" description="Elige entre un video de portada o un carrusel de imágenes para presentar tu negocio."><StepCarousel supplierId={supplier.id} slug={slug || undefined} token={token} onNext={() => navigate("hours")} /></SectionCard> : null}
          {activeTab === "hours" && token ? <SectionCard title="Horarios" description="Dile a tus clientes cuándo pueden visitarte o contactarte."><BusinessHoursEditor supplierId={supplier.id} token={token} /></SectionCard> : null}
          {activeTab === "contact" ? <SectionCard title="Contacto" description="Teléfono, WhatsApp y redes sociales en un solo lugar."><SupplierForm initialData={supplier} isEditMode view="contact" onSaved={() => onSupplierUpdated()} /></SectionCard> : null}
          {activeTab === "sharing" ? <SectionCard title="Compartir" description="Comparte tu perfil con un enlace o código QR.">{isAdmin ? <div className="space-y-3"><p className="text-sm text-gray-600">Enlace público del proveedor:</p>{profileUrl ? <Link href={profileUrl} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-[#004e28] underline">{profileUrl}</Link> : <p>Configura primero la URL del proveedor.</p>}<p className="text-sm text-gray-500">La generación del QR requiere acceso del backend al proveedor seleccionado.</p></div> : <QRPanel />}</SectionCard> : null}
          {activeTab === "shipping" && token && isSupplierAccount ? <SectionCard title="Costo de envío" description="Consulta las tarifas vigentes y configura los costos de envío de tu negocio."><SupplierShippingSettings key={supplier.id} /></SectionCard> : null}
          {activeTab === "advanced" && token ? <div className="space-y-5"><SectionCard title="Información adicional" description="Historia, introducción y datos que no necesitas cambiar con frecuencia."><SupplierForm initialData={supplier} isEditMode view="advanced" onSaved={() => onSupplierUpdated()} /></SectionCard><SectionCard title="Certificaciones y reconocimientos" description="Agrega respaldos que ayuden a generar confianza."><StepCertificates supplierId={supplier.id} slug={slug || undefined} token={token} onNext={() => undefined} /></SectionCard></div> : null}
        </main>
      </div>
    </div>
  );
}

function SectionCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="min-w-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-6 border-b border-gray-100 pb-4"><h2 className="font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28]">{title}</h2><p className="mt-1 text-sm leading-6 text-gray-500">{description}</p></div>{children}</section>;
}
