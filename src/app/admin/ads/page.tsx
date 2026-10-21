"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { adsService, adsErrorMessage, AdItem } from "@/services/adsService";
import { Loader2, Plus, Trash2, EyeOff, Eye, Pencil } from "lucide-react";
import FileUpload from "@/components/ui/FileUpload";
import { PageHero } from "@/components/ui/PageHero";

import { SupplierAdForm } from "@/components/admin/ads/SupplierAdForm";
import { AdImage, resolveAdImage } from "@/components/admin/ads/AdImage";
import { Toast } from "@/components/ui/Toast";
import { useAuthStore } from "@/store/useAuthStore";
import { useQueryClient } from "@tanstack/react-query";

const PAGE_LIMIT = 10;

export default function AdminAdsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const canManage = role === "admin" || role === "superuser";
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"manual" | "supplier">("manual");
  const [activeFilter, setActiveFilter] = useState("all");
  const [success, setSuccess] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const listRequest = useRef(0);
  const createLock = useRef(false);
  const mutationLock = useRef(false);
  const editDialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState<AdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<AdItem | null>(null);
  const [editLinkUrl, setEditLinkUrl] = useState("");
  const [editDisplayOrder, setEditDisplayOrder] = useState("0");
  const [editCity, setEditCity] = useState("Mérida");
  const [editState, setEditState] = useState("Yucatán");
  const [editActive, setEditActive] = useState(true);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editMobileFile, setEditMobileFile] = useState<File | null>(null);
  const [deleteDesktopImage, setDeleteDesktopImage] = useState(false);
  const [deleteMobileImage, setDeleteMobileImage] = useState(false);

  const skip = (page - 1) * PAGE_LIMIT;

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!canManage) return;
    const request = ++listRequest.current;
    setLoading(true);
    setListError(null);
    try {
      const data = await adsService.list(skip, PAGE_LIMIT, activeFilter === "all" ? undefined : activeFilter === "active", signal);
      if (request !== listRequest.current || signal?.aborted) return;
      if (data.length === 0 && page > 1) { setPage((previous) => previous - 1); return; }
      setItems(data);
    } catch (cause) {
      if (request === listRequest.current && !signal?.aborted) setListError(adsErrorMessage(cause));
    } finally {
      if (request === listRequest.current && !signal?.aborted) setLoading(false);
    }
  }, [skip, activeFilter, canManage, page]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (isEditOpen) editDialog.current?.showModal();
  }, [isEditOpen]);

  const onSupplierCreated = () => {
    setSuccess("El anuncio del proveedor se guardó correctamente.");
    if (page !== 1 || activeFilter !== "all") {
      setPage(1);
      setActiveFilter("all");
    } else void load();
  };

  // Prevent browser navigating away when dropping files outside dropzone
  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);
    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", preventDefault);
    };
  }, []);

  const handleFileChange = (f: File | null) => {
    setFile(f);
  };

  const handleCreate = async () => {
    if (createLock.current) return;
    if (!file) {
      setError("Selecciona una imagen para el anuncio.");
      return;
    }
    createLock.current = true;
    setCreating(true);
    setError(null);
    try {
      const created = await adsService.create({
        image: file,
        image_mobile: mobileFile || undefined,
        link_url: linkUrl || undefined,
        city: "Mérida",
        state: "Yucatán",
        display_order: Number(displayOrder) || 0,
        is_active: true,
      });
      if (!created) {
        setError("No se pudo crear el anuncio.");
      } else {
        setLinkUrl("");
        setDisplayOrder("0");
        setFile(null);
        setMobileFile(null);
        setSuccess("El anuncio se creó correctamente.");
        await load();
      }
    } catch (cause) {
      setError(adsErrorMessage(cause));
    } finally {
      createLock.current = false;
      setCreating(false);
    }
  };

  const handleToggleActive = async (ad: AdItem) => {
    if (mutationLock.current) return;
    mutationLock.current = true;
    setUpdatingId(ad.id);
    setError(null);
    try {
      const updated = await adsService.update(ad.id, {
        city: ad.city ?? "Mérida",
        state: ad.state ?? "Yucatán",
        display_order: ad.display_order ?? 0,
        is_active: !ad.is_active,
        link_url: ad.link_url ?? undefined,
      });
      if (!updated) {
        setError("No se pudo actualizar el anuncio.");
      } else {
        await load();
      }
    } catch (cause) {
      setError(adsErrorMessage(cause));
    } finally {
      mutationLock.current = false;
      setUpdatingId(null);
    }
  };

  const handleDelete = async (ad: AdItem) => {
    if (mutationLock.current) return;
    if (!confirm(ad.source === "supplier_carousel"
      ? "¿Retirar este anuncio de Drooopy? La imagen permanecerá en el carrusel del proveedor y podrás seleccionarla nuevamente."
      : "¿Eliminar este anuncio?")) return;
    mutationLock.current = true;
    const id = ad.id;
    setDeletingId(id);
    setError(null);
    try {
      const ok = await adsService.delete(id);
      if (!ok) {
        setError("No se pudo eliminar el anuncio.");
      } else {
        void queryClient.invalidateQueries({ queryKey: ["ad-supplier-images"] });
        await load();
        setSuccess("El anuncio se eliminó correctamente.");
      }
    } catch (cause) {
      setError(adsErrorMessage(cause));
    } finally {
      mutationLock.current = false;
      setDeletingId(null);
    }
  };

  const computeImageUrlFromPath = resolveAdImage;
  const hasMore = items.length === PAGE_LIMIT;
  const renderImage = (ad: AdItem) => <AdImage src={ad.image_desktop} fallback={ad.image_mobile} className="h-16 w-32" />;

  if (!canManage) return <p role="alert" className="rounded-xl bg-white p-6 text-gray-700">No tienes permisos para administrar anuncios.</p>;

  return (
    <div className="space-y-6">
      <PageHero
        title="Anuncios"
        subtitle="Gestiona los banners promocionales de la plataforma."
        eyebrow="Contenido"
      />

      {success && <Toast type="success" message={success} onClose={() => setSuccess(null)} />}

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Formulario de alta */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Plus size={18} className="text-primary" />
          Nuevo anuncio
        </h2>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Origen del nuevo anuncio">
          <button type="button" aria-pressed={mode === "manual"} disabled={creating} onClick={() => setMode("manual")} className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-medium ${mode === "manual" ? "border-[#004e28] bg-[#004e28] text-white" : "border-gray-200 text-[#004e28]"}`}>Subir imagen</button>
          <button type="button" aria-pressed={mode === "supplier"} disabled={creating} onClick={() => setMode("supplier")} className={`min-h-11 rounded-lg border px-4 py-2 text-sm font-medium ${mode === "supplier" ? "border-[#004e28] bg-[#004e28] text-white" : "border-gray-200 text-[#004e28]"}`}>Seleccionar de un proveedor</button>
        </div>
        <div hidden={mode !== "supplier"}><SupplierAdForm onCreated={onSupplierCreated} /></div>
        <div hidden={mode !== "manual"}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Imagen desktop *</p>
            <FileUpload
              accept="image/*"
              value={file}
              onChange={handleFileChange}
              disabled={creating}
              helperText="Arrastra y suelta o haz clic para seleccionar"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Imagen mobile (opcional)</p>
            <FileUpload
              accept="image/*"
              value={mobileFile}
              onChange={setMobileFile}
              disabled={creating}
              helperText="Arrastra y suelta o haz clic para seleccionar"
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Link URL (opcional)
              </label>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://ejemplo.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                Orden
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Ciudad
                </label>
                <input
                  type="text"
                  value="Mérida"
                  disabled
                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Estado
                </label>
                <input
                  type="text"
                  value="Yucatán"
                  disabled
                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Crear anuncio
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Listado */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-3 items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Anuncios registrados
          </h2>
          <label className="flex items-center gap-2 text-sm">Estado
            <select value={activeFilter} onChange={(event) => { setActiveFilter(event.target.value); setPage(1); }} className="rounded-lg border border-gray-200 px-3 py-2">
              <option value="all">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option>
            </select>
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50/50">
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Imagen</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Origen / Link</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Orden</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ciudad</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Activo</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={20} />
                      Cargando anuncios...
                    </div>
                  </td>
                </tr>
              ) : listError ? (
                <tr><td colSpan={7} role="alert" className="px-6 py-8 text-center text-sm text-red-700">{listError} <button type="button" onClick={() => void load()} className="underline">Reintentar</button></td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron anuncios
                  </td>
                </tr>
              ) : (
                items.map((ad) => (
                  <tr key={ad.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {renderImage(ad)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-blue-600">
                      <span className={`mb-1 block w-fit rounded-full px-2 py-1 text-xs font-medium ${ad.source === "supplier_carousel" ? "bg-green-50 text-[#004e28]" : "bg-gray-100 text-gray-600"}`}>{ad.source === "supplier_carousel" ? "Imagen de proveedor" : "Anuncio propio"}</span>
                      {ad.source === "supplier_carousel" && ad.supplier_id != null && <span className="block text-xs text-gray-600">Proveedor #{ad.supplier_id}</span>}
                      <span className="block max-w-48 break-words">{ad.link_url || "-"}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {ad.display_order ?? 0}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {ad.city || "Mérida"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {ad.state || "Yucatán"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                          ad.is_active
                            ? "bg-green-50 text-green-700 border-green-100"
                            : "bg-gray-50 text-gray-600 border-gray-100"
                        }`}
                      >
                        {ad.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setError(null);
                            setEditItem(ad);
                            setEditLinkUrl(ad.link_url || "");
                            setEditDisplayOrder(String(ad.display_order ?? 0));
                            setEditCity(ad.city || "Mérida");
                            setEditState(ad.state || "Yucatán");
                            setEditActive(!!ad.is_active);
                            setEditFile(null);
                            setEditMobileFile(null);
                            setDeleteDesktopImage(false);
                            setDeleteMobileImage(false);
                            setIsEditOpen(true);
                          }}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                          disabled={updatingId !== null || deletingId !== null}
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(ad)}
                          disabled={updatingId !== null || deletingId !== null}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors disabled:opacity-50"
                          title={ad.is_active ? "Desactivar" : "Activar"}
                        >
                          {ad.is_active ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(ad)}
                          disabled={updatingId !== null || deletingId !== null}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Eliminar anuncio"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-500">Página {page}</span>
          <button
            type="button"
            onClick={() => hasMore && setPage((p) => p + 1)}
            disabled={!hasMore || loading || !!listError}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      </div>

      {isEditOpen && editItem && (
        <dialog ref={editDialog} aria-labelledby="edit-ad-title" onCancel={(event) => { event.preventDefault(); if (!mutationLock.current && confirm("¿Cerrar la edición y descartar los cambios sin guardar?")) setIsEditOpen(false); }} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl backdrop:bg-black/50">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 id="edit-ad-title" className="text-lg font-semibold text-gray-900">Editar anuncio</h3>
              <button
                type="button"
                aria-label="Cerrar edición"
                disabled={updatingId !== null}
                onClick={() => { if (confirm("¿Cerrar la edición y descartar los cambios sin guardar?")) setIsEditOpen(false); }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <fieldset disabled={updatingId !== null} className="min-w-0 space-y-3">
              {editItem.source === "supplier_carousel" ? <div className="space-y-2 rounded-xl bg-[#f2f3f4] p-3">
                <p className="text-sm text-[#004e28]">Esta imagen pertenece al proveedor. Solo puedes cambiar los datos del anuncio.</p>
                <AdImage src={editItem.image_desktop} fallback={editItem.image_mobile} alt="Imagen vinculada del proveedor" className="max-h-56 w-full" />
                {editItem.image_mobile && <AdImage src={editItem.image_mobile} alt="Imagen móvil vinculada" className="max-h-40 w-full" />}
              </div> : <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Imagen desktop (opcional)</p>
                  <FileUpload
                    accept="image/*"
                    value={editFile}
                    currentImageUrl={computeImageUrlFromPath(editItem.image_desktop)}
                    removeBehavior="clear_all"
                    onChange={(f) => {
                      setEditFile(f);
                      if (f) setDeleteDesktopImage(false);
                    }}
                    onRemoveExisting={() => setDeleteDesktopImage(true)}
                    disabled={updatingId === editItem.id}
                    helperText="Arrastra y suelta o haz clic para seleccionar"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Imagen mobile (opcional)</p>
                  <FileUpload
                    accept="image/*"
                    value={editMobileFile}
                    currentImageUrl={computeImageUrlFromPath(editItem.image_mobile)}
                    removeBehavior="clear_all"
                    onChange={(f) => {
                      setEditMobileFile(f);
                      if (f) setDeleteMobileImage(false);
                    }}
                    onRemoveExisting={() => setDeleteMobileImage(true)}
                    disabled={updatingId === editItem.id}
                    helperText="Arrastra y suelta o haz clic para seleccionar"
                  />
                </div>
              </div>}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Link URL
                </label>
                <input
                  type="url"
                  value={editLinkUrl}
                  onChange={(e) => setEditLinkUrl(e.target.value)}
                  placeholder="https://ejemplo.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Orden
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={editDisplayOrder}
                  onChange={(e) => setEditDisplayOrder(e.target.value)}
                  placeholder="0"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Ciudad</label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Estado</label>
                  <input
                    type="text"
                    value={editState}
                    onChange={(e) => setEditState(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Activo
              </label>
            </fieldset>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (mutationLock.current || !confirm("¿Cancelar la edición y descartar los cambios sin guardar?")) return;
                  setIsEditOpen(false);
                  setEditFile(null);
                  setEditMobileFile(null);
                  setDeleteDesktopImage(false);
                  setDeleteMobileImage(false);
                }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!editItem || mutationLock.current) return;
                  if (!Number.isSafeInteger(Number(editDisplayOrder)) || Number(editDisplayOrder) < 0) {
                    setError("El orden debe ser un número entero mayor o igual a cero."); return;
                  }
                  mutationLock.current = true;
                  setUpdatingId(editItem.id);
                  setError(null);
                  try {
                    const updated = await adsService.update(editItem.id, {
                      link_url: editLinkUrl || null,
                      city: editCity || null,
                      state: editState || null,
                      display_order: Number(editDisplayOrder) || 0,
                      is_active: editActive,
                      ...(editItem.source === "supplier_carousel" ? {} : {
                        image: editFile || undefined,
                        image_mobile: editMobileFile || undefined,
                        delete_image_desktop: deleteDesktopImage || false,
                        delete_image_mobile: deleteMobileImage || false,
                      }),
                    });
                    if (!updated) {
                      setError("No se pudo actualizar el anuncio.");
                    } else {
                      await load();
                      setSuccess("El anuncio se actualizó correctamente.");
                      setIsEditOpen(false);
                      setEditFile(null);
                      setEditMobileFile(null);
                      setDeleteDesktopImage(false);
                      setDeleteMobileImage(false);
                    }
                  } catch (cause) {
                    setError(adsErrorMessage(cause));
                  } finally {
                    mutationLock.current = false;
                    setUpdatingId(null);
                  }
                }}
                disabled={!!(editItem && updatingId === editItem.id)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
              >
                {editItem && updatingId === editItem.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editItem && updatingId === editItem.id ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
