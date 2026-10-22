"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { adsService, type AdItem } from "@/services/adsService";
import { AdError, AdModal, AdPreview, adButtonClass, adInputClass } from "@/components/admin/ads/AdControls";

export function AdRejectModal({ ad, busy, error, onClose, onReject }: {
  ad: AdItem; busy: boolean; error: string | null; onClose: () => void; onReject: (reason: string) => void;
}) {
  const id = useId();
  const userId = useAuthStore((state) => state.user?.id);
  const [reason, setReason] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const supplier = useQuery({
    queryKey: ["advertising-supplier-identity", userId, ad.supplier_id],
    queryFn: ({ signal }) => adsService.admin.supplierIdentity(ad.supplier_id!, signal),
    enabled: ad.supplier_id != null,
    retry: false,
    staleTime: 60_000,
  });
  return <AdModal title={`Rechazar anuncio #${ad.id}`} busy={busy} dirty={!!reason} onClose={onClose}>
    <p className="text-sm text-gray-600">{supplier.data?.name || (supplier.isFetching ? "Consultando proveedor..." : `Proveedor #${ad.supplier_id ?? "—"}`)}</p>
    <AdPreview ad={ad} />
    <div className="space-y-2"><label htmlFor={id} className="text-sm font-medium text-[#004e28]">Motivo de rechazo *</label><textarea id={id} value={reason} disabled={busy} maxLength={4000} rows={5} onChange={(event) => { setReason(event.target.value); setValidation(null); }} className={adInputClass} /><p className="text-xs text-gray-500">{reason.length}/4000 caracteres. El proveedor recibirá este motivo.</p></div>
    {(validation || error) && <AdError message={validation || error!} />}
    <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} className={adButtonClass} onClick={() => { if (!reason || window.confirm("¿Descartar el motivo sin enviar el rechazo?")) onClose(); }}>Cancelar</button><button type="button" disabled={busy} className={cn(adButtonClass, "border-red-200 bg-red-600 text-white hover:bg-red-700")} onClick={() => { if (!reason.trim() || reason.length > 4000) setValidation("Escribe un motivo de rechazo de hasta 4000 caracteres."); else onReject(reason.trim()); }}>{busy ? "Rechazando..." : "Confirmar rechazo"}</button></div>
  </AdModal>;
}
