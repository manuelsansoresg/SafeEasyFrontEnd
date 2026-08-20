"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Award, Clock3, ExternalLink, Home, Image as ImageIcon, Info, Loader2, MessageCircle, Package, PanelTop, QrCode } from "lucide-react";
import SupplierForm from "@/components/admin/SupplierForm";
import StepCarousel from "@/components/sell/wizard/StepCarousel";
import StepCertificates from "@/components/sell/wizard/StepCertificates";
import BusinessHoursEditor from "@/components/admin/BusinessHoursEditor";
import QRPanel from "@/components/admin/QRPanel";
import { CompanyOverview } from "@/components/admin/company/CompanyOverview";
import { useMyDirectorySubscription } from "@/hooks/useMyDirectorySubscription";
import { getSupplierSlug, resolveCurrentSupplier } from "@/lib/currentSupplier";
import { getCompanyProfileCompletion } from "@/lib/companyProfileCompletion";
import { useAuthStore } from "@/store/useAuthStore";

type SupplierForForm = NonNullable<ComponentProps<typeof SupplierForm>["initialData"]> & {
  slug?: string;
  [key: string]: unknown;
};
type CompanyTab = "overview" | "information" | "appearance" | "header" | "hours" | "contact" | "sharing" | "advanced";

const normalizeTab = (value: string | null): CompanyTab => {
  const legacy: Record<string, CompanyTab> = { info: "information", carousel: "header", certificates: "advanced", qr: "sharing" };
  const normalized = value ? legacy[value] || value : "overview";
  return ["overview", "information", "appearance", "header", "hours", "contact", "sharing", "advanced"].includes(normalized)
    ? (normalized as CompanyTab)
    : "overview";
};

function MyCompanyContent() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isDirectory, loading: directoryLoading } = useMyDirectorySubscription(Boolean(token));
  const [supplier, setSupplier] = useState<SupplierForForm | null>(null);
  const [loading, setLoading] = useState(true);
  const activeTab = normalizeTab(searchParams.get("tab"));

  const fetchSupplier = useCallback(async (options?: { silent?: boolean }) => {
    if (!user || !token) return;
    if (!options?.silent) setLoading(true);
    try {
      setSupplier((await resolveCurrentSupplier(user)) as SupplierForForm | null);
    } catch (error) {
      console.error("Error fetching supplier", error);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    if (user && token) void fetchSupplier();
  }, [fetchSupplier, token, user]);

  const navigate = useCallback((tab: string) => {
    router.replace(`/admin/my-company?tab=${tab}`, { scroll: false });
  }, [router]);

  const navItems = useMemo(() => [
    { id: "overview" as const, label: "Inicio", icon: Home },
    { id: "information" as const, label: "Información", icon: Info },
    { id: "appearance" as const, label: "Apariencia", icon: ImageIcon },
    { id: "header" as const, label: "Encabezado", icon: PanelTop },
    { id: "hours" as const, label: "Horarios", icon: Clock3 },
    { id: "contact" as const, label: "Contacto", icon: MessageCircle },
    { id: "sharing" as const, label: "Compartir", icon: QrCode },
    { id: "advanced" as const, label: "Más opciones", icon: Award },
  ], []);

  if (loading || directoryLoading) {
    return <div className="grid min-h-[420px] place-items-center rounded-2xl border border-gray-200 bg-white"><div className="text-center text-gray-500"><Loader2 className="mx-auto mb-3 animate-spin text-[#168e00]" size={30} /><p className="text-sm font-medium">Preparando tu negocio…</p></div></div>;
  }
  if (!supplier) {
    return <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28]">Mi negocio</h1><p className="mt-2 text-sm text-amber-800">No encontramos una empresa asociada a esta cuenta.</p></section>;
  }

  const slug = getSupplierSlug(supplier);
  const profileUrl = slug ? `/empresas/${encodeURIComponent(slug)}` : null;
  const completion = getCompanyProfileCompletion(supplier, { isDirectory });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#168e00]">Mi negocio</p><span className="rounded-full bg-[#f2f3f4] px-2 py-0.5 text-[11px] font-medium text-gray-600">{isDirectory ? "Directorio" : "Tienda"}</span></div>
            <h1 className="mt-1 truncate font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28] sm:text-[1.7rem]">{supplier.name}</h1>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500"><div className="h-1.5 w-28 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-[#168e00]" style={{ width: `${completion.percentage}%` }} /></div><span>{completion.percentage}% completo</span></div>
          </div>
          {profileUrl ? <Link href={profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#004e28]/20 px-4 py-2.5 text-sm font-semibold text-[#004e28] transition hover:bg-[#004e28] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00] focus-visible:ring-offset-2">Ver mi negocio <ExternalLink size={16} aria-hidden="true" /></Link> : null}
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <nav aria-label="Secciones de mi negocio" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return <button key={item.id} type="button" onClick={() => navigate(item.id)} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition lg:w-full ${active ? "bg-[#004e28] text-white shadow-sm" : "bg-white text-gray-600 hover:bg-[#004e28]/[0.06] hover:text-[#004e28] lg:bg-transparent"}`}><Icon size={18} aria-hidden="true" />{item.label}</button>;
            })}
            <div className="hidden border-t border-gray-200 pt-3 lg:mt-3 lg:block"><Link href={isDirectory ? "/admin/services" : "/admin/products"} className="flex min-h-11 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-[#004e28]/[0.06] hover:text-[#004e28]"><Package size={18} aria-hidden="true" />{isDirectory ? "Mis servicios" : "Mis productos"}</Link></div>
          </nav>
        </aside>

        <main className="min-w-0">
          {activeTab === "overview" ? <CompanyOverview supplier={supplier} isDirectory={isDirectory} onNavigate={navigate} /> : null}
          {activeTab === "information" ? <SectionCard title="Información" description="Los datos principales y la ubicación de tu negocio."><SupplierForm initialData={supplier} isEditMode view="information" onSaved={() => fetchSupplier({ silent: true })} /></SectionCard> : null}
          {activeTab === "appearance" ? <SectionCard title="Apariencia" description="Logo e imágenes de identidad de tu negocio."><SupplierForm initialData={supplier} isEditMode view="appearance" onSaved={() => fetchSupplier({ silent: true })} /></SectionCard> : null}
          {activeTab === "header" && token ? <SectionCard title="Encabezado" description="Elige entre un video de portada o un carrusel de imágenes para presentar tu negocio."><StepCarousel supplierId={supplier.id} slug={slug || undefined} token={token} onNext={() => navigate("hours")} /></SectionCard> : null}
          {activeTab === "hours" && token ? <SectionCard title="Horarios" description="Dile a tus clientes cuándo pueden visitarte o contactarte."><BusinessHoursEditor supplierId={supplier.id} token={token} /></SectionCard> : null}
          {activeTab === "contact" ? <SectionCard title="Contacto" description="Teléfono, WhatsApp y redes sociales en un solo lugar."><SupplierForm initialData={supplier} isEditMode view="contact" onSaved={() => fetchSupplier({ silent: true })} /></SectionCard> : null}
          {activeTab === "sharing" ? <SectionCard title="Compartir" description="Comparte tu perfil con un enlace o código QR."><QRPanel /></SectionCard> : null}
          {activeTab === "advanced" && token ? <div className="space-y-5"><SectionCard title="Información adicional" description="Historia, introducción y datos que no necesitas cambiar con frecuencia."><SupplierForm initialData={supplier} isEditMode view="advanced" onSaved={() => fetchSupplier({ silent: true })} /></SectionCard><SectionCard title="Certificaciones y reconocimientos" description="Agrega respaldos que ayuden a generar confianza."><StepCertificates supplierId={supplier.id} slug={slug || undefined} token={token} onNext={() => undefined} /></SectionCard></div> : null}
        </main>
      </div>
    </div>
  );
}

function SectionCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-6 border-b border-gray-100 pb-4"><h2 className="font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28]">{title}</h2><p className="mt-1 text-sm leading-6 text-gray-500">{description}</p></div>{children}</section>;
}

export default function MyCompanyPage() {
  return <Suspense fallback={<div className="p-8 text-sm text-gray-500">Cargando mi negocio…</div>}><MyCompanyContent /></Suspense>;
}
