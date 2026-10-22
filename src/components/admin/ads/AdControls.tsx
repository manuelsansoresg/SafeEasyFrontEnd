"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Loader2, X } from "lucide-react";
import FileUpload from "@/components/ui/FileUpload";
import { AdImage, resolveAdImage } from "@/components/admin/ads/AdImage";
import { safeAdDestination } from "@/lib/adDestination";
import { cn } from "@/lib/utils";
import type { AdItem } from "@/services/adsService";

export const adInputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#168e00] disabled:bg-gray-100 disabled:text-gray-500";
export const adButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[#004e28] transition hover:bg-[#f2f3f4] focus-visible:outline-2 focus-visible:outline-[#168e00] disabled:cursor-not-allowed disabled:opacity-50";
export const adPrimaryClass = cn(adButtonClass, "border-transparent bg-[#168e00] text-white hover:bg-[#004e28]");
export const adPanelClass = "min-w-0 space-y-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:p-6";

export function AdLoading({ children = "Cargando anuncios..." }: { children?: ReactNode }) {
  return <p role="status" className="flex items-center gap-2 py-4 text-sm text-gray-500"><Loader2 size={18} className="animate-spin" />{children}</p>;
}

export function AdError({ message, retry }: { message: string; retry?: () => void }) {
  return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}{retry && <button type="button" onClick={retry} className="ml-2 min-h-9 underline">Reintentar</button>}</div>;
}

export function AdPagination({ page, count, limit, busy, onChange }: {
  page: number; count: number; limit: number; busy: boolean; onChange: (page: number) => void;
}) {
  return <nav aria-label="Paginación de anuncios" className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-4">
    <button type="button" className={adButtonClass} disabled={page === 0 || busy} onClick={() => onChange(page - 1)}>Anterior</button>
    <span className="text-sm text-gray-500">Página {page + 1}</span>
    <button type="button" className={adButtonClass} disabled={count < limit || busy} onClick={() => onChange(page + 1)}>Siguiente</button>
  </nav>;
}

export function AdModal({ title, children, onClose, busy = false, dirty = false }: {
  title: string; children: ReactNode; onClose: () => void; busy?: boolean; dirty?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { ref.current?.showModal(); }, []);
  const close = () => {
    if (busy) return;
    if (!dirty || window.confirm("¿Cerrar y descartar los cambios sin guardar?")) onClose();
  };
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); close(); }} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl space-y-5 overflow-y-auto rounded-2xl bg-white p-4 shadow-xl backdrop:bg-black/50 sm:p-6">
    <div className="flex items-center justify-between gap-4"><h2 id={titleId} className="text-lg font-semibold text-[#004e28]">{title}</h2><button type="button" aria-label="Cerrar" disabled={busy} className={adButtonClass} onClick={close}><X size={18} /></button></div>
    {children}
  </dialog>;
}

export function AdImagesInput({ desktop, mobile, onDesktop, onMobile, current, allowDelete = false, deletedDesktop = false, deletedMobile = false, onDeleteDesktop, onDeleteMobile, disabled = false }: {
  desktop: File | null; mobile: File | null;
  onDesktop: (file: File | null) => void; onMobile: (file: File | null) => void;
  current?: AdItem; allowDelete?: boolean; deletedDesktop?: boolean; deletedMobile?: boolean;
  onDeleteDesktop?: (deleted: boolean) => void; onDeleteMobile?: (deleted: boolean) => void; disabled?: boolean;
}) {
  const desktopRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  // FileUpload's dropzone is mouse-driven. Explicit buttons also expose its
  // native file picker to keyboard users without changing the shared component.
  return <div className="grid min-w-0 gap-4 sm:grid-cols-2">
    <div ref={desktopRef} className="min-w-0 space-y-2">
      <FileUpload label={current ? "Imagen escritorio" : "Imagen escritorio *"} value={desktop} onChange={onDesktop} currentImageUrl={deletedDesktop ? null : resolveAdImage(current?.image_desktop)} disabled={disabled}
        accept="image/*" helperText="JPEG, PNG o WebP" removeBehavior="clear_selection" />
      <button type="button" disabled={disabled} className={`${adButtonClass} w-full`} onClick={() => desktopRef.current?.querySelector<HTMLInputElement>('input[type="file"]')?.click()}>Seleccionar imagen escritorio</button>
      {allowDelete && current?.image_desktop && <label className="inline-flex min-h-9 items-center gap-2 text-xs text-red-700"><input type="checkbox" disabled={disabled || !!desktop} checked={deletedDesktop} onChange={(event) => onDeleteDesktop?.(event.target.checked)} />Eliminar imagen de escritorio actual</label>}
    </div>
    <div ref={mobileRef} className="min-w-0 space-y-2">
      <FileUpload label="Imagen móvil (opcional)" value={mobile} onChange={onMobile} currentImageUrl={deletedMobile ? null : resolveAdImage(current?.image_mobile)} disabled={disabled}
        accept="image/*" helperText="JPEG, PNG o WebP" removeBehavior="clear_selection" />
      <button type="button" disabled={disabled} className={`${adButtonClass} w-full`} onClick={() => mobileRef.current?.querySelector<HTMLInputElement>('input[type="file"]')?.click()}>Seleccionar imagen móvil</button>
      {allowDelete && current?.image_mobile && <label className="inline-flex min-h-9 items-center gap-2 text-xs text-red-700"><input type="checkbox" disabled={disabled || !!mobile} checked={deletedMobile} onChange={(event) => onDeleteMobile?.(event.target.checked)} />Eliminar imagen móvil actual</label>}
    </div>
  </div>;
}

export function AdPreview({ ad }: { ad: AdItem }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <div><p className="mb-1 text-xs text-gray-500">Escritorio</p><AdImage src={ad.image_desktop} fallback={ad.image_mobile} alt={`Anuncio ${ad.id}`} className="h-36 w-full" /></div>
    {ad.image_mobile && <div><p className="mb-1 text-xs text-gray-500">Móvil</p><AdImage src={ad.image_mobile} alt={`Versión móvil del anuncio ${ad.id}`} className="h-36 w-full" /></div>}
  </div>;
}

const approvals = {
  PENDING: { label: "Pendiente de aprobación", color: "border-amber-200 bg-amber-50 text-amber-800" },
  APPROVED: { label: "Aprobado", color: "border-green-200 bg-green-50 text-[#004e28]" },
  REJECTED: { label: "Rechazado", color: "border-red-200 bg-red-50 text-red-700" },
};
export function AdStatus({ ad }: { ad: AdItem }) {
  const approval = approvals[ad.approval_status];
  const badge = "rounded-full border px-2.5 py-1 text-xs font-medium";
  return <div className="flex flex-wrap gap-2">
    <span className={`${badge} ${approval?.color || "border-gray-200 bg-gray-50 text-gray-500"}`}>{approval?.label || "Sin información de aprobación"}</span>
    <span className={`${badge} ${ad.is_active ? "border-green-200 text-[#168e00]" : "border-gray-200 text-gray-500"}`}>{ad.is_active ? "Activo" : "Inactivo"}</span>
    {ad.source !== "manual" && ad.supplier_visible === false && <span className={`${badge} border-gray-200 text-gray-600`}>Oculto por proveedor</span>}
    <span className={`${badge} ${ad.is_published ? "border-green-200 bg-[#004e28] text-white" : "border-gray-200 text-gray-600"}`}>{ad.is_published === true ? "Publicado" : ad.is_published === false ? "No publicado" : "Publicación sin información"}</span>
  </div>;
}

export function AdDestination({ ad }: { ad: AdItem }) {
  const destination = safeAdDestination(ad.link_url);
  return <div className="min-w-0 text-xs text-gray-500"><span className="block">{ad.is_manual_url ? "URL manual" : "Enlace automático"}</span>{destination
    ? <a href={destination} target="_blank" rel="noopener noreferrer" className="mt-1 block break-all text-[#168e00] underline">{destination}</a>
    : <span>Sin enlace disponible</span>}</div>;
}

export function formatAdDate(value?: string | null): string {
  if (!value || Number.isNaN(new Date(value).getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function adSourceLabel(ad: AdItem): string {
  if (ad.source === "supplier_upload") return "Solicitud de proveedor";
  if (ad.source === "supplier_carousel" || ad.supplier_carousel_id != null) return "Carrusel de proveedor · legado";
  return "Anuncio propio";
}

export function confirmAdDeletion(ad: AdItem, audience: "admin" | "supplier"): boolean {
  const message = audience === "supplier"
    ? "¿Deseas eliminar este anuncio? Dejará de estar disponible y no podrás recuperarlo desde tu panel."
    : ad.source === "supplier_carousel" || ad.supplier_carousel_id != null
      ? "¿Retirar este anuncio de Drooopy? La imagen original permanecerá en el carrusel del proveedor."
      : "¿Eliminar este anuncio de Drooopy? Dejará de estar disponible y no podrás recuperarlo desde el panel.";
  return window.confirm(message);
}
