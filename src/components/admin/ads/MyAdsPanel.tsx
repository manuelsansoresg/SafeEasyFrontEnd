"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import { useAuthStore } from "@/store/useAuthStore";
import { adsService, adsErrorMessage, AdsRequestError, type AdItem } from "@/services/adsService";
import { SupplierAdUpload } from "@/components/admin/ads/SupplierAdUpload";
import { SupplierAdCard, type SupplierAdAction } from "@/components/admin/ads/SupplierAdCard";
import { AdNotificationTarget } from "@/components/admin/ads/AdNotificationTarget";
import { AdError, AdLoading, AdModal, AdPagination, adButtonClass, adPanelClass, confirmAdDeletion } from "@/components/admin/ads/AdControls";

const LIMIT = 10;
export function MyAdsPanel({ targetId }: { targetId?: number }) {
  const userId = useAuthStore((state) => state.user?.id);
  const role = useAuthStore((state) => state.user?.role);
  const canManage = role === "supplier";
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [createBusy, setCreateBusy] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [recent, setRecent] = useState<AdItem | null>(null);
  const [editing, setEditing] = useState<AdItem | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const actionLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["advertising", "supplier", userId, "list", page],
    queryFn: ({ signal }) => adsService.supplier.list(page * LIMIT, LIMIT, signal),
    enabled: canManage,
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["advertising", "supplier", userId] });
  const saved = (ad: AdItem, isEdit: boolean) => {
    setRecent(ad);
    setEditing(null);
    setEditorDirty(false);
    if (!isEdit) setCreateKey((key) => key + 1);
    setSuccess("El anuncio se guardó correctamente. Consulta su estado actualizado en el listado.");
    setPage(0);
    void refresh();
  };
  const perform = async (action: "visibility" | "delete", ad: AdItem) => {
    if (actionLock.current || editorBusy || ad.source !== "supplier_upload") return;
    if (action === "visibility" && (ad.approval_status !== "APPROVED" || !ad.is_active)) return;
    if (action === "delete" && !confirmAdDeletion(ad, "supplier")) return;
    actionLock.current = true;
    setActionBusy(true);
    setError(null);
    try {
      if (action === "visibility") {
        const updated = await adsService.supplier.setVisibility(ad.id, !ad.supplier_visible);
        // The response is authoritative, including is_published and approval.
        queryClient.setQueriesData<AdItem[]>({ queryKey: ["advertising", "supplier", userId, "list"] }, (items) => items?.map((item) => item.id === updated.id ? updated : item));
        if (targetId === updated.id) queryClient.setQueryData(["advertising", "supplier", userId, "target", targetId], updated);
        setRecent(updated);
        setSuccess(updated.supplier_visible ? "Visibilidad guardada. La publicación depende del estado actual del anuncio y de tu negocio." : "Tu anuncio está oculto y conserva su aprobación.");
      } else {
        await adsService.supplier.delete(ad.id);
        if (recent?.id === ad.id) setRecent(null);
        if (list.data?.length === 1 && page > 0) setPage((value) => value - 1);
        setSuccess("El anuncio se eliminó correctamente.");
      }
      await refresh();
    } catch (cause) {
      setError(adsErrorMessage(cause));
      if (cause instanceof AdsRequestError && [404, 409].includes(cause.status)) { setRecent(null); await refresh(); }
    } finally {
      actionLock.current = false;
      setActionBusy(false);
    }
  };
  const onAction = (action: SupplierAdAction, ad: AdItem) => {
    if (actionLock.current || editorBusy || ad.source !== "supplier_upload") return;
    if (action === "edit") { setEditorDirty(false); setEditing(ad); }
    else void perform(action, ad);
  };
  const card = (ad: AdItem) => <SupplierAdCard ad={ad} busy={actionBusy || editorBusy || createBusy || list.isFetching || list.isError} onAction={onAction} />;
  if (!canManage) return <AdError message="Esta sección está disponible exclusivamente para proveedores autenticados." />;
  return <div className="space-y-6">
    <PageHero title="Mis anuncios" subtitle="Publica promociones de tu negocio en Drooopy y administra tus anuncios." eyebrow="Publicidad" />
    {error && <AdError message={error} />}
    {success && <Toast type="success" message={success} onClose={() => setSuccess(null)} />}
    {targetId && <AdNotificationTarget id={targetId} audience="supplier">{card}</AdNotificationTarget>}
    <section className={adPanelClass}><h2 className="text-lg font-semibold text-[#004e28]">Solicitar un anuncio</h2><SupplierAdUpload key={createKey} onSaved={(ad) => saved(ad, false)} onBusyChange={setCreateBusy} /></section>
    <section className={adPanelClass}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-[#004e28]">Tus anuncios</h2><button type="button" disabled={list.isFetching || actionBusy} className={adButtonClass} onClick={() => { setRecent(null); void refresh(); }}><RefreshCw size={16} />Actualizar</button></div>
      {recent && <div className="space-y-2 rounded-xl border border-green-200 bg-green-50/30 p-3"><p className="text-sm font-medium text-[#004e28]">Último anuncio guardado</p>{card(recent)}</div>}
      {list.isPending || list.isFetching ? <AdLoading /> : list.isError ? <AdError message={adsErrorMessage(list.error)} retry={() => void list.refetch()} />
        : list.data.length ? <div className="grid gap-4 xl:grid-cols-2">{list.data.map((ad) => <div key={ad.id}>{card(ad)}</div>)}</div>
        : <p className="py-6 text-center text-sm text-gray-500">Todavía no tienes anuncios en esta página.</p>}
      <AdPagination page={page} count={list.data?.length ?? 0} limit={LIMIT} busy={list.isFetching || list.isError || actionBusy} onChange={setPage} />
    </section>
    {editing && <AdModal title={`Editar imágenes del anuncio #${editing.id}`} busy={editorBusy} dirty={editorDirty} onClose={() => setEditing(null)}><SupplierAdUpload key={editing.id} ad={editing} onSaved={(ad) => saved(ad, true)} onBusyChange={setEditorBusy} onDirtyChange={setEditorDirty} onCancel={() => { if (!editorBusy && (!editorDirty || window.confirm("¿Descartar las imágenes seleccionadas sin guardar?"))) setEditing(null); }} /></AdModal>}
  </div>;
}
