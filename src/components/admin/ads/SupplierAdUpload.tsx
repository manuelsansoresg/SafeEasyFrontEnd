"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { adsService, adsErrorMessage, type AdItem } from "@/services/adsService";
import { validateAdImages } from "@/lib/adValidation";
import { AdError, AdImagesInput, adButtonClass, adPrimaryClass } from "@/components/admin/ads/AdControls";

export function SupplierAdUpload({ ad, onSaved, onBusyChange, onDirtyChange, onCancel }: {
  ad?: AdItem; onSaved: (ad: AdItem) => void; onBusyChange?: (busy: boolean) => void; onDirtyChange?: (dirty: boolean) => void; onCancel?: () => void;
}) {
  const [desktop, setDesktop] = useState<File | null>(null);
  const [mobile, setMobile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const warn = ad?.approval_status === "APPROVED" && !!(desktop || mobile);
  const save = async () => {
    if (lock.current) return;
    if (!ad && !desktop) { setError("Selecciona una imagen de escritorio para enviar tu anuncio."); return; }
    if (ad && !desktop && !mobile) { setError("Selecciona al menos una imagen para corregir o reenviar el anuncio."); return; }
    const imageError = validateAdImages(desktop, mobile);
    if (imageError) { setError(imageError); return; }
    if (warn && !window.confirm("Al modificar las imágenes, tu anuncio volverá a revisión y dejará de publicarse hasta que Drooopy lo apruebe nuevamente.")) return;
    lock.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    try {
      // Do not spread an advertisement into this payload. The supplier contract
      // accepts these two image fields only, even when editing just mobile.
      const payload = { image: desktop, image_mobile: mobile };
      const result = ad ? await adsService.supplier.update(ad.id, payload) : await adsService.supplier.create({ ...payload, image: desktop! });
      onSaved(result);
    } catch (cause) {
      setError(adsErrorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  };
  return <div className="space-y-4">
    {!ad && <p className="rounded-xl bg-[#f2f3f4] p-4 text-sm text-[#004e28]">Tu anuncio será revisado por Drooopy antes de publicarse. Cuando sea aprobado, dirigirá automáticamente a los visitantes a tu negocio.</p>}
    <AdImagesInput desktop={desktop} mobile={mobile} onDesktop={(file) => { setDesktop(file); onDirtyChange?.(!!file || !!mobile); }} onMobile={(file) => { setMobile(file); onDirtyChange?.(!!desktop || !!file); }} current={ad} disabled={busy} />
    {ad && <p className="text-xs text-gray-500">Puedes reemplazar únicamente la imagen móvil y conservar la de escritorio. Si cambias escritorio sin adjuntar móvil, se generará una nueva versión móvil.</p>}
    {warn && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Al modificar las imágenes, tu anuncio volverá a revisión y dejará de publicarse hasta que Drooopy lo apruebe nuevamente.</p>}
    {error && <AdError message={error} />}
    <div className="flex flex-wrap justify-end gap-2">{onCancel && <button type="button" disabled={busy} className={adButtonClass} onClick={onCancel}>Cancelar</button>}<button type="button" disabled={busy} className={adPrimaryClass} onClick={() => void save()}>{busy && <Loader2 size={16} className="animate-spin" />}{busy ? "Enviando..." : ad ? "Guardar y reenviar a revisión" : "Enviar anuncio para revisión"}</button></div>
  </div>;
}
