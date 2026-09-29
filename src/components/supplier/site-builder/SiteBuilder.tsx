"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
} from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  Instagram,
  LayoutTemplate,
  Loader2,
  Menu,
  Monitor,
  Palette,
  PanelTop,
  Phone,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Smartphone,
  Tablet,
  Upload,
  X,
} from "lucide-react";
import StepCarousel from "@/components/sell/wizard/StepCarousel";
import { fetchWithAuth } from "@/lib/api";
import { resolveCurrentSupplier } from "@/lib/currentSupplier";
import type { BusinessHour } from "@/lib/products";
import {
  SITE_BUILDER_READY,
  SITE_BUILDER_UPDATE,
  type SiteBuilderDevice,
  type SiteBuilderDraft,
  type SiteBuilderSection,
} from "@/lib/siteBuilder";
import { useAuthStore } from "@/store/useAuthStore";

type SaveState = "idle" | "saving" | "saved" | "error";

type NavItem = {
  id: SiteBuilderSection;
  label: string;
  hint: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  keywords: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: "general", label: "General", hint: "Nombre y descripción corta", icon: FileText, keywords: "nombre descripción eslogan" },
  { id: "appearance", label: "Apariencia", hint: "Colores del portal", icon: Palette, keywords: "color fondo tarjetas" },
  { id: "header", label: "Encabezado", hint: "Logo, portada y video", icon: PanelTop, keywords: "logo portada carrusel video" },
  { id: "information", label: "Información", hint: "Historia y ubicación", icon: LayoutTemplate, keywords: "información historia dirección acerca" },
  { id: "hours", label: "Horarios", hint: "Atención al público", icon: Clock3, keywords: "horario abierto cerrado" },
  { id: "contact", label: "Contacto", hint: "Teléfono y correo", icon: Phone, keywords: "teléfono whatsapp correo dirección" },
  { id: "social", label: "Redes sociales", hint: "Perfiles públicos", icon: Instagram, keywords: "facebook instagram twitter x redes" },
  { id: "sections", label: "Secciones", hint: "Visibilidad del portal", icon: Menu, keywords: "secciones visible información mapa galería" },
];

const DAYS = [
  { id: 1, label: "Lunes" },
  { id: 2, label: "Martes" },
  { id: 3, label: "Miércoles" },
  { id: 4, label: "Jueves" },
  { id: 5, label: "Viernes" },
  { id: 6, label: "Sábado" },
  { id: 0, label: "Domingo" },
];

const EDITABLE_FIELDS = [
  "name",
  "short_description",
  "description",
  "title_about",
  "subtitle_about",
  "about",
  "address",
  "exterior_number",
  "interior_number",
  "neighborhood",
  "phone",
  "email",
  "facebook_url",
  "instagram_url",
  "x_url",
  "primary_color",
  "page_background_color",
  "card_background_color",
  "header_background_color",
] as const;

const DEVICE_VIEWPORTS: Record<SiteBuilderDevice, { width: number; height: number }> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
};

const normalizeHours = (hours?: BusinessHour[]) => {
  const current = new Map((hours || []).map((hour) => [Number(hour.day_of_week), hour]));
  return DAYS.map(({ id }) => {
    const hour = current.get(id);
    return {
      day_of_week: id,
      open_time: hour?.open_time || "09:00",
      close_time: hour?.close_time || "18:00",
      is_closed: hour?.is_closed ?? true,
    } satisfies BusinessHour;
  });
};

const pickDraft = (value: SiteBuilderDraft) =>
  Object.fromEntries(EDITABLE_FIELDS.map((key) => [key, value[key] ?? ""]));

const readSupplierPayload = (payload: unknown): Partial<SiteBuilderDraft> => {
  if (!payload || typeof payload !== "object") return {};
  const record = payload as Record<string, unknown>;
  const nested = record.data && typeof record.data === "object" ? record.data : record.supplier;
  return (nested && typeof nested === "object" ? nested : record) as Partial<SiteBuilderDraft>;
};

export default function SiteBuilder() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const [savedData, setSavedData] = useState<SiteBuilderDraft | null>(null);
  const [draftData, setDraftData] = useState<SiteBuilderDraft | null>(null);
  const [savedHours, setSavedHours] = useState<BusinessHour[]>([]);
  const [draftHours, setDraftHours] = useState<BusinessHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SiteBuilderSection | null>(null);
  const [device, setDevice] = useState<SiteBuilderDevice>("desktop");
  const [zoom, setZoom] = useState("fit");
  const [query, setQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [previewReady, setPreviewReady] = useState(false);
  const [previewStageWidth, setPreviewStageWidth] = useState(0);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const saveSequenceRef = useRef(0);
  const previewUrlRef = useRef<string | null>(null);

  const loadSupplier = useCallback(async () => {
    if (!user || !token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const resolved = await resolveCurrentSupplier(user);
      if (!resolved) throw new Error("No encontramos un negocio asociado a esta cuenta.");
      const response = await fetchWithAuth(`/api/suppliers/${resolved.id}`, { cache: "no-store" });
      const full = response.ok ? readSupplierPayload(await response.json().catch(() => null)) : {};
      const supplier = { ...resolved, ...full } as SiteBuilderDraft;
      const hours = normalizeHours(supplier.business_hours);
      setSavedData(supplier);
      setDraftData(supplier);
      setSavedHours(hours);
      setDraftHours(hours);
      setSaveState("saved");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No se pudo cargar la configuración del portal.");
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    void loadSupplier();
  }, [loadSupplier]);

  const formDirty = useMemo(() => {
    if (!savedData || !draftData) return false;
    return JSON.stringify(pickDraft(savedData)) !== JSON.stringify(pickDraft(draftData));
  }, [draftData, savedData]);
  const hoursDirty = useMemo(
    () => JSON.stringify(savedHours) !== JSON.stringify(draftHours),
    [draftHours, savedHours],
  );
  const isDirty = formDirty || hoursDirty;

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);

  const sendPreview = useCallback(() => {
    if (!draftData) return;
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: SITE_BUILDER_UPDATE,
        payload: { ...draftData, business_hours: draftHours },
        activeSection,
      },
      window.location.origin,
    );
  }, [activeSection, draftData, draftHours]);

  useEffect(() => {
    sendPreview();
  }, [sendPreview, previewReady]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === SITE_BUILDER_READY) {
        setPreviewReady(true);
        sendPreview();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [sendPreview]);

  const saveChanges = useCallback(async () => {
    if (!draftData || !savedData || !isDirty) return;
    const sequence = ++saveSequenceRef.current;
    setSaveState("saving");
    setSaveError(null);
    try {
      if (formDirty) {
        const body = new FormData();
        for (const key of EDITABLE_FIELDS) {
          if ((draftData[key] ?? "") !== (savedData[key] ?? "")) body.append(key, String(draftData[key] ?? ""));
        }
        const response = await fetchWithAuth(`/api/suppliers/${draftData.id}`, { method: "PUT", body });
        if (!response.ok) throw new Error((await response.text().catch(() => "")) || "No se pudo guardar la configuración.");
      }
      if (hoursDirty) {
        const payload = draftHours.map((hour) => ({
          day_of_week: hour.day_of_week,
          open_time: hour.is_closed ? null : hour.open_time,
          close_time: hour.is_closed ? null : hour.close_time,
          is_closed: hour.is_closed,
        }));
        const response = await fetchWithAuth(`/api/suppliers/${draftData.id}/business-hours`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error((await response.text().catch(() => "")) || "No se pudieron guardar los horarios.");
      }
      if (sequence !== saveSequenceRef.current) return;
      setSavedData(draftData);
      setSavedHours(draftHours);
      setSaveState("saved");
    } catch (error) {
      if (sequence !== saveSequenceRef.current) return;
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
    }
  }, [draftData, draftHours, formDirty, hoursDirty, isDirty, savedData]);

  useEffect(() => {
    if (!isDirty) return;
    setSaveState("idle");
    const timer = window.setTimeout(() => void saveChanges(), 850);
    return () => window.clearTimeout(timer);
  }, [isDirty, saveChanges]);

  const updateField = <K extends keyof SiteBuilderDraft>(key: K, value: SiteBuilderDraft[K]) => {
    setDraftData((current) => current ? { ...current, [key]: value } : current);
  };

  const reloadPublishedData = useCallback(async () => {
    if (!draftData) return;
    const response = await fetchWithAuth(`/api/suppliers/${draftData.id}`, { cache: "no-store" });
    if (!response.ok) return;
    const fresh = { ...draftData, ...readSupplierPayload(await response.json().catch(() => null)) } as SiteBuilderDraft;
    setSavedData(fresh);
    setDraftData(fresh);
    setPreviewReady(false);
    iframeRef.current?.contentWindow?.location.reload();
  }, [draftData]);

  const handleLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !draftData) return;
    if (!file.type.startsWith("image/")) {
      setSaveError("Selecciona un archivo de imagen válido.");
      setSaveState("error");
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const localUrl = URL.createObjectURL(file);
    previewUrlRef.current = localUrl;
    setDraftData((current) => current ? { ...current, logo: localUrl, logo_url: localUrl } : current);
    setUploadingLogo(true);
    setSaveState("saving");
    try {
      const body = new FormData();
      body.append("logo", file);
      const response = await fetchWithAuth(`/api/suppliers/${draftData.id}`, { method: "PUT", body });
      if (!response.ok) throw new Error((await response.text().catch(() => "")) || "No se pudo subir el logo.");
      const updated = readSupplierPayload(await response.json().catch(() => null));
      const merged = { ...draftData, ...updated } as SiteBuilderDraft;
      setDraftData(merged);
      setSavedData(merged);
      setSaveState("saved");
    } catch (error) {
      setDraftData(savedData);
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "No se pudo subir el logo.");
    } finally {
      setUploadingLogo(false);
    }
  };

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  useEffect(() => {
    if (loading) return;
    const stage = previewStageRef.current;
    if (!stage) return;

    const updateWidth = (width: number) => {
      if (width <= 0) return;
      setPreviewStageWidth((current) => current === width ? current : width);
    };
    updateWidth(stage.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      updateWidth(entries[0]?.contentRect.width || 0);
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [loading]);

  if (loading) return <BuilderLoading />;
  if (loadError || !draftData) return <BuilderError message={loadError || "No se encontró el negocio."} onRetry={loadSupplier} />;

  const slug = String(draftData.slug || draftData.short_name || draftData.name || draftData.id).trim();
  const publicUrl = `/empresas/${encodeURIComponent(slug)}`;
  const previewUrl = `${publicUrl}?builderPreview=1`;
  const filteredNav = NAV_ITEMS.filter((item) => `${item.label} ${item.hint} ${item.keywords}`.toLowerCase().includes(query.trim().toLowerCase()));
  const viewport = DEVICE_VIEWPORTS[device];
  const fitScale = previewStageWidth > 0 ? Math.min(1, previewStageWidth / viewport.width) : 1;
  const scale = zoom === "fit" ? fitScale : Number(zoom) / 100;
  const scaledViewport = {
    width: viewport.width * scale,
    height: viewport.height * scale,
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#eef0f1]">
      <header className="z-30 flex h-[72px] shrink-0 items-center gap-3 border-b border-black/10 bg-white px-3 shadow-[0_1px_8px_rgba(0,0,0,0.04)] sm:px-5">
        <Link href="/admin/my-company" className="inline-flex h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-semibold text-[#004e28] transition hover:bg-[#004e28]/5" title="Volver a Mi negocio">
          <ArrowLeft size={18} /><span className="hidden lg:inline">Mi negocio</span>
        </Link>
        <div className="h-7 w-px bg-gray-200" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-[family-name:var(--font-varela-round)] text-base text-[#004e28] sm:text-xl">Personalizar portal <span className="hidden font-normal text-gray-300 sm:inline">·</span> <span className="hidden text-gray-500 sm:inline">{draftData.name}</span></h1>
        </div>
        <DeviceSwitcher value={device} onChange={setDevice} />
        <SaveStatus state={saveState} error={saveError} onRetry={() => void saveChanges()} />
        <Link href={publicUrl} target="_blank" rel="noopener noreferrer" title="Ver portal público" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#004e28] px-3 text-sm font-semibold text-white transition hover:bg-[#168e00] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00] focus-visible:ring-offset-2">
          <ExternalLink size={17} /><span className="hidden xl:inline">Ver portal</span>
        </Link>
      </header>

      <div className="flex shrink-0 border-b border-gray-200 bg-white p-2 lg:hidden">
        {(["edit", "preview"] as const).map((tab) => <button key={tab} type="button" onClick={() => setMobileView(tab)} className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${mobileView === tab ? "bg-[#004e28] text-white" : "text-gray-500"}`}>{tab === "edit" ? "Editar" : "Vista previa"}</button>)}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className={`${mobileView === "preview" ? "hidden" : "flex"} ${sidebarCollapsed ? "lg:w-[52px]" : "lg:w-[370px] xl:w-[420px]"} w-full shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-200 lg:flex`}>
          {sidebarCollapsed ? (
            <div className="flex h-full flex-col items-center border-r border-gray-100 py-3">
              <button type="button" onClick={() => setSidebarCollapsed(false)} title="Expandir panel" aria-label="Expandir panel de personalización" className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-[#004e28] transition hover:bg-[#004e28]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00]"><ChevronRight size={19} /></button>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4">
                <div className="min-w-0 flex-1">
                  {activeSection ? (
                    <button type="button" onClick={() => setActiveSection(null)} className="inline-flex min-h-9 items-center gap-2 rounded-lg pr-3 text-sm font-semibold text-[#004e28] transition hover:bg-[#004e28]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00]"><ArrowLeft size={17} />Personalizar</button>
                  ) : (
                    <><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#168e00]">Personalizar</p><p className="mt-1 truncate font-[family-name:var(--font-varela-round)] text-xl text-[#004e28]">{draftData.name}</p></>
                  )}
                </div>
                <button type="button" onClick={() => setSidebarCollapsed(true)} title="Contraer panel" aria-label="Contraer panel de personalización" className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-[#004e28] lg:inline-flex"><ChevronLeft size={18} /></button>
              </div>

              {!activeSection ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="border-b border-gray-100 p-4"><label className="relative block"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar configuración…" className="h-11 w-full rounded-xl border border-gray-200 bg-[#f7f8f8] pl-10 pr-9 text-sm outline-none transition focus:border-[#168e00] focus:bg-white focus:ring-4 focus:ring-[#168e00]/10" />{query ? <button type="button" onClick={() => setQuery("")} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-200"><X size={15} /></button> : null}</label></div>
                  <nav aria-label="Configuración del portal" className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
                    {filteredNav.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => setActiveSection(item.id)} className="group flex min-h-[58px] w-full items-center gap-3 rounded-xl px-3 text-left transition hover:bg-[#004e28]/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f2f3f4] text-[#004e28] transition group-hover:bg-white"><Icon size={18} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-gray-800">{item.label}</span><span className="block truncate text-[11px] text-gray-400">{item.hint}</span></span><ChevronRight size={17} className="text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-[#168e00]" /></button>; })}
                    {filteredNav.length === 0 ? <p className="px-3 py-8 text-center text-sm text-gray-400">No encontramos esa configuración.</p> : null}
                  </nav>
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
                  <PanelContent section={activeSection} draft={draftData} hours={draftHours} onField={updateField} onHours={setDraftHours} onLogo={handleLogo} uploadingLogo={uploadingLogo} token={token || ""} onHeaderSaved={reloadPublishedData} />
                </div>
              )}
            </div>
          )}
        </aside>

        <main className={`${mobileView === "edit" ? "hidden" : "flex"} min-w-0 flex-1 flex-col bg-[#eef0f1] lg:flex`}>
          <div className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-200 bg-white px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-gray-500"><span className={`h-2 w-2 rounded-full ${previewReady ? "bg-[#168e00]" : "animate-pulse bg-amber-400"}`} />{previewReady ? "Vista previa interactiva" : "Cargando portal…"}</div>
            <div className="flex items-center gap-3">
              <span className="hidden text-[11px] font-medium tabular-nums text-gray-400 sm:inline">{viewport.width} × {viewport.height}</span>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-500">Zoom<select value={zoom} onChange={(event) => setZoom(event.target.value)} className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none focus:border-[#168e00]"><option value="fit">Ajustar</option><option value="100">100%</option><option value="90">90%</option><option value="80">80%</option><option value="70">70%</option></select></label>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2.5 sm:p-4">
            <div ref={previewStageRef} className="min-h-[520px] w-full">
              <div
                className="mx-auto transition-[width,height] duration-200"
                style={{ width: scaledViewport.width, height: scaledViewport.height }}
              >
                <div
                  className="origin-top-left overflow-hidden rounded-[14px] border border-black/10 bg-white shadow-[0_18px_45px_-30px_rgba(0,30,15,0.45)] transition-transform duration-200"
                  style={{ width: viewport.width, height: viewport.height, transform: `scale(${scale})` }}
                >
                  <iframe ref={iframeRef} src={previewUrl} title={`Vista previa de ${draftData.name}`} onLoad={() => { setPreviewReady(true); window.setTimeout(sendPreview, 80); }} className="h-full w-full bg-white" />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function DeviceSwitcher({ value, onChange }: { value: SiteBuilderDevice; onChange: (value: SiteBuilderDevice) => void }) {
  const devices = [{ id: "mobile" as const, label: "Móvil", icon: Smartphone }, { id: "tablet" as const, label: "Tablet", icon: Tablet }, { id: "desktop" as const, label: "Escritorio", icon: Monitor }];
  return <div className="hidden rounded-xl bg-[#f2f3f4] p-1 sm:flex">{devices.map((device) => { const Icon = device.icon; return <button key={device.id} type="button" title={device.label} aria-label={device.label} aria-pressed={value === device.id} onClick={() => onChange(device.id)} className={`flex h-8 w-9 items-center justify-center rounded-lg transition ${value === device.id ? "bg-white text-[#004e28] shadow-sm" : "text-gray-400 hover:text-[#004e28]"}`}><Icon size={17} /></button>; })}</div>;
}

function SaveStatus({ state, error, onRetry }: { state: SaveState; error: string | null; onRetry: () => void }) {
  if (state === "saving") return <span className="hidden items-center gap-1.5 text-xs font-semibold text-gray-500 md:inline-flex"><Loader2 size={15} className="animate-spin" />Guardando…</span>;
  if (state === "error") return <button type="button" onClick={onRetry} title={error || "Error al guardar"} className="hidden items-center gap-1.5 text-xs font-semibold text-red-600 md:inline-flex"><AlertCircle size={15} />Error · Reintentar</button>;
  return <span className="hidden items-center gap-1.5 text-xs font-semibold text-[#168e00] md:inline-flex">{state === "saved" ? <Check size={15} /> : <Save size={15} />}Guardado</span>;
}

function Field({ label, value, onChange, type = "text", placeholder, rows }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; rows?: number }) {
  const className = "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#168e00] focus:ring-4 focus:ring-[#168e00]/10";
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-gray-700">{label}</span>{rows ? <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={`${className} resize-y`} /> : <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={className} />}</label>;
}

function ColorField({ label, value, fallback, onChange }: { label: string; value?: string; fallback: string; onChange: (value: string) => void }) {
  const safe = /^#[0-9a-f]{6}$/i.test(value || "") ? value! : fallback;
  return <div><span className="mb-1.5 block text-xs font-semibold text-gray-700">{label}</span><div className="flex items-center gap-2"><input type="color" value={safe} onChange={(event) => onChange(event.target.value)} className="h-11 w-12 cursor-pointer rounded-lg border border-gray-200 bg-white p-1" /><input value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={fallback} maxLength={7} className="h-11 min-w-0 flex-1 rounded-xl border border-gray-200 px-3 font-mono text-sm uppercase outline-none focus:border-[#168e00] focus:ring-4 focus:ring-[#168e00]/10" /><button type="button" onClick={() => onChange(fallback)} className="h-10 rounded-lg px-2 text-[11px] font-semibold text-[#004e28] hover:bg-[#004e28]/5">Restaurar</button></div></div>;
}

function PanelHeading({ title, description }: { title: string; description: string }) {
  return <div className="mb-5"><h2 className="font-[family-name:var(--font-varela-round)] text-xl text-[#004e28]">{title}</h2><p className="mt-1 text-xs leading-5 text-gray-500">{description}</p></div>;
}

function PanelContent({ section, draft, hours, onField, onHours, onLogo, uploadingLogo, token, onHeaderSaved }: { section: SiteBuilderSection; draft: SiteBuilderDraft; hours: BusinessHour[]; onField: <K extends keyof SiteBuilderDraft>(key: K, value: SiteBuilderDraft[K]) => void; onHours: (hours: BusinessHour[]) => void; onLogo: (event: ChangeEvent<HTMLInputElement>) => void; uploadingLogo: boolean; token: string; onHeaderSaved: () => void }) {
  if (section === "general") return <div><PanelHeading title="General" description="La información principal con la que se presenta tu negocio." /><div className="space-y-4"><Field label="Nombre comercial" value={draft.name || ""} onChange={(value) => onField("name", value)} /><Field label="Descripción corta" value={draft.short_description || ""} onChange={(value) => onField("short_description", value)} rows={3} placeholder="Resume tu negocio en pocas palabras" /><Field label="Descripción" value={draft.description || ""} onChange={(value) => onField("description", value)} rows={5} /></div></div>;
  if (section === "appearance") return <div><PanelHeading title="Apariencia" description="Personaliza la paleta de tu portal o recupera los colores originales de Drooopy." /><button type="button" onClick={() => { onField("primary_color", "#168e00"); onField("header_background_color", "#004e28"); onField("page_background_color", "#f2f3f4"); onField("card_background_color", "#ffffff"); }} className="mb-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#004e28]/15 bg-[#004e28]/5 px-3 text-xs font-semibold text-[#004e28] transition hover:border-[#168e00]/40 hover:bg-[#168e00]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168e00] focus-visible:ring-offset-2"><RotateCcw size={15} aria-hidden="true" />Restaurar todos los colores de Drooopy</button><div className="space-y-5"><ColorField label="Color principal" value={draft.primary_color} fallback="#168e00" onChange={(value) => onField("primary_color", value)} /><ColorField label="Fondo del encabezado" value={draft.header_background_color} fallback="#004e28" onChange={(value) => onField("header_background_color", value)} /><ColorField label="Fondo general" value={draft.page_background_color || draft.background_color} fallback="#f2f3f4" onChange={(value) => onField("page_background_color", value)} /><ColorField label="Fondo de tarjetas" value={draft.card_background_color} fallback="#ffffff" onChange={(value) => onField("card_background_color", value)} /></div></div>;
  if (section === "header") return <div><PanelHeading title="Encabezado" description="Actualiza la identidad y el contenido principal de la portada." /><label className="mb-5 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#168e00]/40 bg-[#168e00]/5 p-3 transition hover:bg-[#168e00]/10"><span className="grid h-10 w-10 place-items-center rounded-lg bg-white text-[#004e28] shadow-sm">{uploadingLogo ? <Loader2 size={19} className="animate-spin" /> : <Upload size={19} />}</span><span className="min-w-0"><span className="block text-sm font-semibold text-[#004e28]">{uploadingLogo ? "Subiendo logo…" : "Cambiar logo"}</span><span className="block text-xs text-gray-500">Vista previa inmediata</span></span><input type="file" accept="image/*" onChange={onLogo} disabled={uploadingLogo} className="sr-only" /></label><div className="min-w-0 border-t border-gray-100 pt-5"><StepCarousel compact supplierId={draft.id} slug={draft.slug || undefined} token={token} onNext={onHeaderSaved} onSaved={onHeaderSaved} /></div></div>;
  if (section === "information") return <div><PanelHeading title="Información" description="Historia, presentación y ubicación que aparecen en el portal." /><div className="space-y-4"><Field label="Título" value={draft.title_about || ""} onChange={(value) => onField("title_about", value)} /><Field label="Subtítulo" value={draft.subtitle_about || ""} onChange={(value) => onField("subtitle_about", value)} /><Field label="Acerca del negocio" value={draft.about || ""} onChange={(value) => onField("about", value)} rows={7} /><Field label="Dirección" value={draft.address || ""} onChange={(value) => onField("address", value)} rows={2} /><div className="grid grid-cols-2 gap-3"><Field label="Número exterior" value={draft.exterior_number || ""} onChange={(value) => onField("exterior_number", value)} /><Field label="Número interior" value={draft.interior_number || ""} onChange={(value) => onField("interior_number", value)} /></div><Field label="Colonia" value={draft.neighborhood || ""} onChange={(value) => onField("neighborhood", value)} /></div></div>;
  if (section === "hours") return <div><PanelHeading title="Horarios" description="Los cambios se reflejan al instante y se guardan automáticamente." /><div className="space-y-2">{DAYS.map((day) => { const index = hours.findIndex((hour) => Number(hour.day_of_week) === day.id); const value = hours[index]; return <div key={day.id} className="rounded-xl border border-gray-200 p-3"><label className="flex items-center justify-between gap-2"><span className="text-xs font-semibold text-gray-800">{day.label}</span><input type="checkbox" checked={!value?.is_closed} onChange={(event) => onHours(hours.map((hour, itemIndex) => itemIndex === index ? { ...hour, is_closed: !event.target.checked } : hour))} className="h-4 w-4 rounded border-gray-300 text-[#168e00] focus:ring-[#168e00]" /></label>{!value?.is_closed ? <div className="mt-2 flex items-center gap-2"><input type="time" value={value.open_time || "09:00"} onChange={(event) => onHours(hours.map((hour, itemIndex) => itemIndex === index ? { ...hour, open_time: event.target.value } : hour))} className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-2 text-xs" /><span className="text-xs text-gray-400">a</span><input type="time" value={value.close_time || "18:00"} onChange={(event) => onHours(hours.map((hour, itemIndex) => itemIndex === index ? { ...hour, close_time: event.target.value } : hour))} className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-2 text-xs" /></div> : <p className="mt-1 text-[11px] text-gray-400">Cerrado</p>}</div>; })}</div></div>;
  if (section === "contact") return <div><PanelHeading title="Contacto" description="Datos públicos para que tus clientes puedan localizarte." /><div className="space-y-4"><Field label="Teléfono / WhatsApp" type="tel" value={draft.phone || ""} onChange={(value) => onField("phone", value)} /><Field label="Correo público" type="email" value={draft.email || ""} onChange={(value) => onField("email", value)} /><Field label="Dirección mostrada" value={draft.address || ""} onChange={(value) => onField("address", value)} rows={3} /></div></div>;
  if (section === "social") return <div><PanelHeading title="Redes sociales" description="Solo se muestran las plataformas que el portal ya soporta." /><div className="space-y-4"><Field label="Facebook" type="url" value={draft.facebook_url || ""} onChange={(value) => onField("facebook_url", value)} placeholder="https://facebook.com/mi-negocio" /><Field label="Instagram" type="url" value={draft.instagram_url || ""} onChange={(value) => onField("instagram_url", value)} placeholder="https://instagram.com/mi-negocio" /><Field label="X (Twitter)" type="url" value={draft.x_url || ""} onChange={(value) => onField("x_url", value)} placeholder="https://x.com/mi-negocio" /></div></div>;
  if (section === "sections") return <div><PanelHeading title="Secciones" description="El portal muestra cada bloque cuando existen datos o el módulo correspondiente está activo." /><div className="space-y-2">{[{ label: "Información", visible: Boolean(draft.about || draft.description) }, { label: "Horarios", visible: hours.some((hour) => !hour.is_closed) }, { label: "Contacto", visible: Boolean(draft.phone || draft.email || draft.address) }, { label: "Redes sociales", visible: Boolean(draft.facebook_url || draft.instagram_url || draft.x_url) }, { label: "Mapa", visible: Boolean(draft.map_location) }].map((item) => <div key={item.label} className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-3"><span className="text-sm font-medium text-gray-700">{item.label}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${item.visible ? "bg-[#168e00]/10 text-[#168e00]" : "bg-gray-100 text-gray-400"}`}>{item.visible ? "Visible" : "Sin información"}</span></div>)}</div><p className="mt-4 rounded-xl bg-[#f2f3f4] p-3 text-xs leading-5 text-gray-600">Productos, menú y agenda se muestran aquí únicamente como parte del portal. Se administran desde sus pantallas propias.</p></div>;
  return null;
}

function BuilderLoading() { return <div className="grid min-h-[65vh] place-items-center rounded-2xl border border-gray-200 bg-white"><div className="text-center"><Loader2 className="mx-auto animate-spin text-[#168e00]" size={32} /><p className="mt-3 text-sm font-semibold text-[#004e28]">Cargando configuración…</p><div className="mx-auto mt-4 h-2 w-48 animate-pulse rounded-full bg-gray-100" /></div></div>; }
function BuilderError({ message, onRetry }: { message: string; onRetry: () => void }) { return <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-7 text-center shadow-sm"><AlertCircle className="mx-auto text-red-500" size={34} /><h1 className="mt-3 font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28]">Error al cargar</h1><p className="mt-2 text-sm text-gray-600">{message}</p><button type="button" onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#004e28] px-4 py-2.5 text-sm font-semibold text-white"><RefreshCw size={16} />Reintentar</button></div>; }
