"use client";

import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import type { AdItem } from "@/services/adsService";
import { AdDestination, AdPreview, AdStatus, adButtonClass, formatAdDate } from "@/components/admin/ads/AdControls";

export type SupplierAdAction = "edit" | "visibility" | "delete";
export function SupplierAdCard({ ad, busy, onAction }: { ad: AdItem; busy: boolean; onAction: (action: SupplierAdAction, ad: AdItem) => void }) {
  const approved = ad.approval_status === "APPROVED";
  const title = ad.approval_status === "PENDING" ? "Pendiente de aprobación"
    : ad.approval_status === "REJECTED" ? "Anuncio rechazado"
    : approved && !ad.is_active ? "Anuncio no disponible para publicación"
    : approved && ad.supplier_visible === false ? "Anuncio oculto"
    : approved && ad.is_published === true ? "Anuncio publicado"
    : "Anuncio no disponible para publicación";
  return <article className="min-w-0 space-y-4 rounded-xl border border-gray-200 bg-white p-4">
    <div><h3 className="font-semibold text-[#004e28]">{title}</h3><p className="mt-1 text-xs text-gray-500">Anuncio #{ad.id} · {formatAdDate(ad.created_at)}</p></div>
    <AdPreview ad={ad} />
    <AdStatus ad={ad} />
    {ad.approval_status === "PENDING" && <p className="text-sm text-gray-600">Drooopy está revisando tu anuncio. Todavía no aparece en la página principal.</p>}
    {ad.approval_status === "REJECTED" && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700"><p className="font-medium">Motivo de rechazo</p><p className="mt-1 whitespace-pre-wrap break-words">{ad.rejection_reason || "Consulta con Drooopy para conocer el motivo."}</p></div>}
    {approved && !ad.is_active && <p className="text-sm text-gray-600">La administración ha inhabilitado este anuncio. Cambiar su visibilidad no puede reactivarlo.</p>}
    {approved && ad.is_active && !ad.is_published && ad.supplier_visible !== false && <p className="text-sm text-gray-600">El anuncio conserva su aprobación, pero actualmente no cumple todas las condiciones de publicación. La visibilidad de tu negocio también influye.</p>}
    <AdDestination ad={ad} />
    <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
      {approved && ad.is_active && <button type="button" disabled={busy} className={adButtonClass} onClick={() => onAction("visibility", ad)}>{ad.supplier_visible === false ? <Eye size={16} /> : <EyeOff size={16} />}{ad.supplier_visible === false ? "Mostrar anuncio" : "Ocultar anuncio"}</button>}
      <button type="button" disabled={busy} className={adButtonClass} onClick={() => onAction("edit", ad)}><Pencil size={16} />{ad.approval_status === "REJECTED" ? "Corregir y reenviar" : "Editar imágenes"}</button>
      <button type="button" disabled={busy} className={`${adButtonClass} text-red-700`} onClick={() => onAction("delete", ad)}><Trash2 size={16} />Eliminar</button>
    </div>
  </article>;
}
