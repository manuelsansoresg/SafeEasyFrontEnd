"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import { useAuthStore } from "@/store/useAuthStore";
import { adsService, adsErrorMessage, AdsRequestError, type AdApprovalStatus, type AdItem, type AdSource, type AdminAdFilters } from "@/services/adsService";
import { AdAdminForm } from "@/components/admin/ads/AdAdminForm";
import { AdAdminCard, type AdAdminAction } from "@/components/admin/ads/AdAdminCard";
import { AdRejectModal } from "@/components/admin/ads/AdRejectModal";
import { AdNotificationTarget } from "@/components/admin/ads/AdNotificationTarget";
import { AdError, AdLoading, AdModal, AdPagination, adButtonClass, adInputClass, adPanelClass, confirmAdDeletion } from "@/components/admin/ads/AdControls";

const LIMIT = 10;
export function AdminAdsPanel({ initialApproval = "", targetId }: { initialApproval?: AdApprovalStatus | ""; targetId?: number }) {
  const userId = useAuthStore((state) => state.user?.id);
  const role = useAuthStore((state) => state.user?.role);
  const canManage = role === "admin";
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [approval, setApproval] = useState<AdApprovalStatus | "">(initialApproval);
  const [activation, setActivation] = useState("");
  const [source, setSource] = useState<AdSource | "">("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [recent, setRecent] = useState<AdItem | null>(null);
  const [editing, setEditing] = useState<AdItem | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const [rejecting, setRejecting] = useState<AdItem | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const actionLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const filters: AdminAdFilters = {
    ...(approval ? { approval_status: approval } : {}),
    ...(activation ? { is_active: activation === "true" } : {}),
    ...(source ? { source } : {}),
  };
  const list = useQuery({
    queryKey: ["advertising", "admin", userId, "list", page, filters],
    queryFn: ({ signal }) => adsService.admin.list(page * LIMIT, LIMIT, filters, signal),
    enabled: canManage,
    retry: false,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["advertising", "admin", userId] });
  const closeEditor = () => {
    if (!editorBusy && (!editorDirty || window.confirm("¿Descartar los cambios sin guardar?"))) setEditing(null);
  };
  const saved = (ad: AdItem, isEdit: boolean) => {
    setRecent(ad);
    setSuccess(isEdit ? "El anuncio se actualizó correctamente." : "El anuncio se creó correctamente.");
    setEditing(null);
    setEditorDirty(false);
    if (!isEdit) setCreateKey((key) => key + 1);
    void refresh();
  };

  const perform = async (action: "approve" | "reject" | "toggle" | "delete", ad: AdItem, reason?: string) => {
    if (actionLock.current || editorBusy) return;
    if (action === "approve" && !window.confirm(`¿Aprobar el anuncio #${ad.id} con las imágenes y el destino mostrados?`)) return;
    if (action === "delete" && !confirmAdDeletion(ad, "admin")) return;
    if ((action === "approve" || action === "reject") && (ad.source !== "supplier_upload" || ad.approval_status !== "PENDING" || !Number.isInteger(ad.content_version) || ad.content_version < 1)) {
      setError("Actualiza la información para obtener una solicitud pendiente y su versión vigente."); void refresh(); return;
    }
    if (action === "toggle" && !ad.is_active && ad.source === "supplier_upload" && ad.approval_status !== "APPROVED") return;
    actionLock.current = true;
    setActionBusy(true);
    setError(null);
    try {
      let result: AdItem | null = null;
      if (action === "approve") result = await adsService.admin.approve(ad.id, ad.content_version);
      if (action === "reject") result = await adsService.admin.reject(ad.id, ad.content_version, reason!);
      if (action === "toggle") result = await adsService.admin.update(ad.id, { is_active: !ad.is_active });
      if (action === "delete") await adsService.admin.delete(ad.id);
      if (action === "delete") {
        if (recent?.id === ad.id) setRecent(null);
        if (list.data?.length === 1 && page > 0) setPage((value) => value - 1);
      } else if (result) setRecent(result);
      setRejecting(null);
      setSuccess(action === "approve" ? "Anuncio aprobado." : action === "reject" ? "Anuncio rechazado. El proveedor recibirá el motivo." : action === "delete" ? "Anuncio eliminado." : "Estado administrativo actualizado.");
      await refresh();
    } catch (cause) {
      setError(adsErrorMessage(cause));
      if (cause instanceof AdsRequestError && [404, 409].includes(cause.status)) {
        // Discard the review snapshot: a new decision must use a fresh version.
        setRejecting(null);
        setRecent(null);
        await refresh();
      }
    } finally {
      actionLock.current = false;
      setActionBusy(false);
    }
  };
  const onAction = (action: AdAdminAction, ad: AdItem) => {
    if (actionLock.current || editorBusy) return;
    setError(null);
    if (action === "edit") { setEditorDirty(false); setEditing(ad); }
    else if (action === "reject") setRejecting(ad);
    else void perform(action, ad);
  };
  const card = (ad: AdItem) => <AdAdminCard ad={ad} busy={actionBusy || editorBusy || createBusy || list.isFetching || list.isError} onAction={onAction} />;

  if (!canManage) return <AdError message="Solo los administradores autorizados pueden gestionar la publicidad de Drooopy." />;
  return <div className="space-y-6">
    <PageHero title="Anuncios" subtitle="Crea publicidad de Drooopy y revisa las promociones enviadas por los proveedores." eyebrow="Contenido" />
    {error && <AdError message={error} />}
    {success && <Toast type="success" message={success} onClose={() => setSuccess(null)} />}
    {targetId && <AdNotificationTarget id={targetId} audience="admin">{card}</AdNotificationTarget>}
    <section className={adPanelClass}><div><h2 className="text-lg font-semibold text-[#004e28]">Nuevo anuncio</h2><p className="mt-1 text-sm text-gray-500">Los anuncios creados por administración no requieren revisión.</p></div><AdAdminForm key={createKey} onSaved={(ad) => saved(ad, false)} onBusyChange={setCreateBusy} /></section>
    <section className={adPanelClass}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-[#004e28]">Anuncios registrados y solicitudes</h2><button type="button" disabled={list.isFetching || actionBusy} className={adButtonClass} onClick={() => { setRecent(null); void refresh(); }}><RefreshCw size={16} />Actualizar</button></div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm"><span>Aprobación</span><select value={approval} onChange={(event) => { setApproval(event.target.value as AdApprovalStatus | ""); setPage(0); setRecent(null); }} className={adInputClass}><option value="">Todos</option><option value="PENDING">Pendientes</option><option value="APPROVED">Aprobados</option><option value="REJECTED">Rechazados</option></select></label>
        <label className="space-y-1 text-sm"><span>Estado administrativo</span><select value={activation} onChange={(event) => { setActivation(event.target.value); setPage(0); setRecent(null); }} className={adInputClass}><option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option></select></label>
        <label className="space-y-1 text-sm"><span>Origen</span><select value={source} onChange={(event) => { setSource(event.target.value as AdSource | ""); setPage(0); setRecent(null); }} className={adInputClass}><option value="">Todos</option><option value="manual">Anuncio propio</option><option value="supplier_upload">Solicitud de proveedor</option><option value="supplier_carousel">Carrusel de proveedor · legado</option></select></label>
      </div>
      {recent && <div className="space-y-2 rounded-xl border border-green-200 bg-green-50/30 p-3"><p className="text-sm font-medium text-[#004e28]">Último anuncio guardado</p>{card(recent)}</div>}
      {list.isPending || list.isFetching ? <AdLoading /> : list.isError ? <AdError message={adsErrorMessage(list.error)} retry={() => void list.refetch()} />
        : list.data.length ? <div className="grid gap-4 xl:grid-cols-2">{list.data.map((ad) => <div key={ad.id}>{card(ad)}</div>)}</div>
        : <p className="py-6 text-center text-sm text-gray-500">No se encontraron anuncios con estos filtros.</p>}
      <AdPagination page={page} count={list.data?.length ?? 0} limit={LIMIT} busy={list.isFetching || list.isError || actionBusy} onChange={setPage} />
    </section>
    {editing && <AdModal title={`Editar anuncio #${editing.id}`} busy={editorBusy} dirty={editorDirty} onClose={() => setEditing(null)}><AdAdminForm key={editing.id} ad={editing} onSaved={(ad) => saved(ad, true)} onBusyChange={setEditorBusy} onDirtyChange={setEditorDirty} onCancel={closeEditor} /></AdModal>}
    {rejecting && <AdRejectModal key={`${rejecting.id}-${rejecting.content_version}`} ad={rejecting} busy={actionBusy} error={error} onClose={() => setRejecting(null)} onReject={(reason) => void perform("reject", rejecting, reason)} />}
  </div>;
}
