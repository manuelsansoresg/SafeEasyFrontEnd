"use client";

import { useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useAuthStore";
import { Loader2 } from "lucide-react";
import { adsService, adsErrorMessage, type AdItem, type AdSupplier, type AdminAdPayload } from "@/services/adsService";
import { safeAdDestination } from "@/lib/adDestination";
import { AdSupplierPicker } from "@/components/admin/ads/AdSupplierPicker";
import { AdError, AdImagesInput, AdPreview, adButtonClass, adInputClass, adPrimaryClass } from "@/components/admin/ads/AdControls";

import { validateAdImages } from "@/lib/adValidation";

export function AdAdminForm({ ad, onSaved, onBusyChange, onDirtyChange, onCancel }: {
  ad?: AdItem; onSaved: (ad: AdItem) => void;
  onBusyChange?: (busy: boolean) => void; onDirtyChange?: (dirty: boolean) => void; onCancel?: () => void;
}) {
  const id = useId();
  const userId = useAuthStore((state) => state.user?.id);
  const [desktop, setDesktop] = useState<File | null>(null);
  const [mobile, setMobile] = useState<File | null>(null);
  const [deleteDesktop, setDeleteDesktop] = useState(false);
  const [deleteMobile, setDeleteMobile] = useState(false);
  const [supplierId, setSupplierId] = useState<number | null>(ad?.supplier_id ?? null);
  const [selected, setSelected] = useState<AdSupplier | null>(null);
  const [manual, setManual] = useState(ad?.is_manual_url ?? Boolean(ad?.link_url));
  const [manualUrl, setManualUrl] = useState(ad?.manual_url ?? (ad?.is_manual_url === undefined ? ad?.link_url ?? "" : ""));
  const [order, setOrder] = useState(String(ad?.display_order ?? 0));
  const [city, setCity] = useState(ad?.city ?? "Mérida");
  const [state, setState] = useState(ad?.state ?? "Yucatán");
  const [active, setActive] = useState(ad?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const legacy = ad?.source === "supplier_carousel" || ad?.supplier_carousel_id != null;
  const supplierUpload = ad?.source === "supplier_upload";
  const visualChange = !!(desktop || mobile || deleteDesktop || deleteMobile);
  const activationBlocked = supplierUpload && (ad.approval_status !== "APPROVED" || visualChange);
  const changed = () => onDirtyChange?.(true);
  const identity = useQuery({
    queryKey: ["advertising-supplier-identity", userId, supplierId],
    queryFn: ({ signal }) => adsService.admin.supplierIdentity(supplierId!, signal),
    enabled: supplierId != null && selected?.id !== supplierId,
    retry: false,
    staleTime: 60_000,
  });
  const knownSupplier = selected || identity.data || null;

  const save = async () => {
    if (lock.current) return;
    if (!ad && !desktop) { setError("Selecciona una imagen de escritorio."); return; }
    const imageError = validateAdImages(desktop, mobile);
    if (imageError) { setError(imageError); return; }
    const displayOrder = Number(order);
    if (!order.trim() || !Number.isSafeInteger(displayOrder) || displayOrder < 0) { setError("El orden debe ser un número entero mayor o igual a cero."); return; }
    if (manual && !safeAdDestination(manualUrl.trim())) { setError("Escribe una URL HTTP/HTTPS o una ruta interna válida, por ejemplo /promociones."); return; }
    if (supplierUpload && visualChange && !window.confirm("Modificar la imagen hará que este anuncio vuelva a revisión y deje de mostrarse hasta su aprobación.")) return;
    lock.current = true;
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    try {
      const payload: AdminAdPayload = {
        is_manual_url: manual,
        // Automatic mode preserves the previously stored manual URL.
        ...(manual ? { manual_url: manualUrl.trim() } : {}),
        display_order: displayOrder, city, state,
        is_active: activationBlocked ? false : active,
        ...(!ad || (!supplierUpload && !legacy) ? supplierId != null ? { supplier_id: supplierId } : ad?.supplier_id != null ? { clear_supplier: true } : {} : {}),
        ...(!legacy ? { image: desktop, image_mobile: mobile } : {}),
        ...(!legacy && !supplierUpload ? { delete_image_desktop: deleteDesktop, delete_image_mobile: deleteMobile } : {}),
      };
      const result = ad ? await adsService.admin.update(ad.id, payload) : await adsService.admin.create({ ...payload, image: desktop! });
      onSaved(result);
    } catch (cause) {
      setError(adsErrorMessage(cause));
    } finally {
      lock.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  };

  const autoPreview = knownSupplier?.slug ? `/empresas/${knownSupplier.slug}` : !ad?.is_manual_url && ad?.supplier_id === supplierId ? ad?.link_url : null;
  return <div className="space-y-5" onChange={changed}>
    <fieldset disabled={busy} className="min-w-0 space-y-5">
      {legacy ? <div className="space-y-3 rounded-xl bg-[#f2f3f4] p-3"><p className="text-sm text-[#004e28]">Anuncio legado: las imágenes pertenecen al carrusel del proveedor y son de solo lectura.</p><AdPreview ad={ad!} /></div>
        : <AdImagesInput desktop={desktop} mobile={mobile} onDesktop={(file) => { setDesktop(file); if (file) setDeleteDesktop(false); changed(); }} onMobile={(file) => { setMobile(file); if (file) setDeleteMobile(false); changed(); }} current={ad} allowDelete={!supplierUpload} deletedDesktop={deleteDesktop} deletedMobile={deleteMobile} onDeleteDesktop={(value) => { setDeleteDesktop(value); changed(); }} onDeleteMobile={(value) => { setDeleteMobile(value); changed(); }} disabled={busy} />}
      {supplierUpload && visualChange && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Modificar la imagen hará que este anuncio vuelva a revisión y deje de mostrarse hasta su aprobación.</p>}
      {!ad || (!supplierUpload && !legacy) ? <AdSupplierPicker supplierId={supplierId} selected={knownSupplier} disabled={busy} onSelect={(supplier) => { setSelected(supplier); setSupplierId(supplier?.id ?? null); changed(); }} />
        : <p className="text-sm text-gray-600">Proveedor propietario: {ad.supplier_id != null ? knownSupplier?.name || `#${ad.supplier_id}` : "Sin información"}. No se puede reasignar.</p>}
      <div className="space-y-3 rounded-xl bg-[#f2f3f4] p-4">
        <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[#004e28]"><input type="checkbox" checked={manual} onChange={(event) => setManual(event.target.checked)} className="accent-[#168e00]" />Usar URL manual</label>
        {manual ? <div className="space-y-1"><label htmlFor={`${id}-url`} className="text-sm font-medium">URL manual *</label><input id={`${id}-url`} type="text" maxLength={500} value={manualUrl} onChange={(event) => setManualUrl(event.target.value)} placeholder="https://ejemplo.com/promocion o /promociones" className={adInputClass} /></div>
          : <div className="space-y-1 text-sm text-gray-600"><p className="font-medium text-[#004e28]">Enlace automático al portal del proveedor</p>{supplierId != null ? <p className="break-all">{autoPreview || "El backend resolverá el portal vigente del proveedor al guardar."}</p> : <p>Este anuncio no tendrá enlace. Se mostrará únicamente como imagen.</p>}</div>}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1"><label htmlFor={`${id}-order`} className="text-sm font-medium">Orden de aparición</label><input id={`${id}-order`} type="number" min="0" step="1" value={order} onChange={(event) => setOrder(event.target.value)} className={adInputClass} /></div>
        <div className="space-y-1"><label htmlFor={`${id}-city`} className="text-sm font-medium">Ciudad</label><input id={`${id}-city`} value={city} onChange={(event) => setCity(event.target.value)} className={adInputClass} /></div>
        <div className="space-y-1"><label htmlFor={`${id}-state`} className="text-sm font-medium">Estado</label><input id={`${id}-state`} value={state} onChange={(event) => setState(event.target.value)} className={adInputClass} /></div>
      </div>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" disabled={activationBlocked} checked={activationBlocked ? false : active} onChange={(event) => setActive(event.target.checked)} className="accent-[#168e00]" />Anuncio activo</label>
      {activationBlocked && <p className="text-xs text-gray-500">La solicitud necesita aprobación de su contenido actual para poder activarse.</p>}
    </fieldset>
    {error && <AdError message={error} />}
    <div className="flex flex-wrap justify-end gap-2">{onCancel && <button type="button" disabled={busy} className={adButtonClass} onClick={onCancel}>Cancelar</button>}<button type="button" disabled={busy} className={adPrimaryClass} onClick={() => void save()}>{busy && <Loader2 size={16} className="animate-spin" />}{busy ? "Guardando..." : ad ? "Guardar cambios" : "Crear anuncio"}</button></div>
  </div>;
}
