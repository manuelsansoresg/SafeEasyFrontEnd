"use client";

import { Check, Eye, EyeOff, Pencil, Trash2, X } from "lucide-react";
import type { AdItem } from "@/services/adsService";
import { AdDestination, AdPreview, AdStatus, adButtonClass, adSourceLabel, formatAdDate } from "@/components/admin/ads/AdControls";

export type AdAdminAction = "approve" | "reject" | "edit" | "toggle" | "delete";
export function AdAdminCard({ ad, busy, onAction }: { ad: AdItem; busy: boolean; onAction: (action: AdAdminAction, ad: AdItem) => void }) {
  const canReview = ad.source === "supplier_upload" && ad.approval_status === "PENDING" && Number.isInteger(ad.content_version) && ad.content_version > 0;
  const canActivate = ad.source !== "supplier_upload" || ad.approval_status === "APPROVED";
  return <article className="min-w-0 space-y-4 rounded-xl border border-gray-200 bg-white p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-[#004e28]">Anuncio #{ad.id} · {adSourceLabel(ad)}</h3><p className="mt-1 text-xs text-gray-500">{ad.supplier_id != null ? `Proveedor #${ad.supplier_id}` : "Sin proveedor relacionado"}</p></div><span className="rounded-lg bg-[#f2f3f4] px-3 py-1 text-xs text-gray-600">Orden {ad.display_order ?? 0}</span></div>
    <AdPreview ad={ad} />
    <AdStatus ad={ad} />
    {ad.rejection_reason && <p className="whitespace-pre-wrap break-words rounded-lg bg-red-50 p-3 text-sm text-red-700"><strong>Motivo de rechazo: </strong>{ad.rejection_reason}</p>}
    <div className="grid gap-3 sm:grid-cols-2"><AdDestination ad={ad} /><div className="space-y-1 text-xs text-gray-500"><p>Creado: {formatAdDate(ad.created_at)}</p><p>Actualizado: {formatAdDate(ad.updated_at)}</p>{ad.reviewed_at && <p>Revisado: {formatAdDate(ad.reviewed_at)}</p>}<p>{[ad.city, ad.state].filter(Boolean).join(", ") || "Sin ubicación"}</p></div></div>
    {ad.source === "supplier_upload" && ad.approval_status === "PENDING" && !canReview && <p className="text-xs text-amber-800">No se recibió una versión válida. Actualiza la información antes de revisar.</p>}
    <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
      {canReview && <><button type="button" disabled={busy} className={`${adButtonClass} border-green-200 text-[#168e00]`} onClick={() => onAction("approve", ad)}><Check size={16} />Aprobar anuncio</button><button type="button" disabled={busy} className={`${adButtonClass} border-red-200 text-red-700`} onClick={() => onAction("reject", ad)}><X size={16} />Rechazar anuncio</button></>}
      <button type="button" disabled={busy} className={adButtonClass} onClick={() => onAction("edit", ad)}><Pencil size={16} />Editar</button>
      <button type="button" disabled={busy || (!ad.is_active && !canActivate)} className={adButtonClass} title={!canActivate ? "Requiere aprobación antes de activarse" : undefined} onClick={() => onAction("toggle", ad)}>{ad.is_active ? <EyeOff size={16} /> : <Eye size={16} />}{ad.is_active ? "Desactivar" : "Activar"}</button>
      <button type="button" disabled={busy} className={`${adButtonClass} text-red-700`} onClick={() => onAction("delete", ad)}><Trash2 size={16} />Eliminar</button>
    </div>
  </article>;
}
