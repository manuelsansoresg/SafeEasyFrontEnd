"use client";

import { useEffect, useState } from "react";
import { adsService, AdItem } from "@/services/adsService";
import { Loader2, Plus, Trash2, EyeOff, Eye, Pencil } from "lucide-react";
import FileUpload from "@/components/ui/FileUpload";

const PAGE_LIMIT = 10;

export default function AdminAdsPage() {
  const [items, setItems] = useState<AdItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<AdItem | null>(null);
  const [editLinkUrl, setEditLinkUrl] = useState("");
  const [editCity, setEditCity] = useState("Mérida");
  const [editState, setEditState] = useState("Yucatán");
  const [editActive, setEditActive] = useState(true);
  const [editFile, setEditFile] = useState<File | null>(null);

  const skip = (page - 1) * PAGE_LIMIT;

  const load = async () => {
    setLoading(true);
    try {
      const data = await adsService.list(skip, PAGE_LIMIT);
      setItems(data);
    } catch (e) {
      setError("No se pudieron cargar los anuncios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [skip]);

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
    if (!file) {
      setError("Selecciona una imagen para el anuncio.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const created = await adsService.create({
        image: file,
        link_url: linkUrl || undefined,
        city: "Mérida",
        state: "Yucatán",
        is_active: true,
      });
      if (!created) {
        setError("No se pudo crear el anuncio.");
      } else {
        setLinkUrl("");
        setFile(null);
        await load();
      }
    } catch {
      setError("Ocurrió un error al crear el anuncio.");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (ad: AdItem) => {
    setUpdatingId(ad.id);
    setError(null);
    try {
      const updated = await adsService.update(ad.id, {
        city: ad.city ?? "Mérida",
        state: ad.state ?? "Yucatán",
        is_active: !ad.is_active,
        link_url: ad.link_url ?? undefined,
      });
      if (!updated) {
        setError("No se pudo actualizar el anuncio.");
      } else {
        setItems((prev) => prev.map((i) => (i.id === ad.id ? updated : i)));
      }
    } catch {
      setError("Ocurrió un error al actualizar el anuncio.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar este anuncio?")) return;
    setDeletingId(id);
    setError(null);
    try {
      const ok = await adsService.delete(id);
      if (!ok) {
        setError("No se pudo eliminar el anuncio.");
      } else {
        setItems((prev) => prev.filter((i) => i.id !== id));
      }
    } catch {
      setError("Ocurrió un error al eliminar el anuncio.");
    } finally {
      setDeletingId(null);
    }
  };

  const computeImageUrl = (ad: AdItem) => {
    const src = ad.image_desktop || ad.image_mobile;
    if (!src) return null;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
    return src.startsWith("http") ? src : `${base.replace(/\/$/, "")}${src.startsWith("/") ? "" : "/"}${src}`;
  };

  const hasMore = items.length === PAGE_LIMIT;

  const renderImage = (ad: AdItem) => {
    const src = ad.image_desktop || ad.image_mobile;
    if (!src) return <span className="text-xs text-gray-400">Sin imagen</span>;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
    const full = src.startsWith("http") ? src : `${base.replace(/\/$/, "")}${src.startsWith("/") ? "" : "/"}${src}`;
    return (
      <img
        src={full}
        alt=""
        className="w-32 h-16 object-cover rounded-md border border-gray-200"
      />
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Anuncios</h1>
          <p className="text-gray-500 text-sm">
            Gestiona los banners promocionales de la plataforma.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Formulario de alta */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Plus size={18} className="text-primary" />
          Nuevo anuncio
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Imagen del banner *</p>
            <FileUpload
              accept="image/*"
              value={file}
              onChange={handleFileChange}
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

      {/* Listado */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Anuncios registrados
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Imagen
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Link
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ciudad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin inline-block mr-2" />
                    Cargando anuncios...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                    No hay anuncios registrados.
                  </td>
                </tr>
              ) : (
                items.map((ad) => (
                  <tr key={ad.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {renderImage(ad)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-blue-600">
                      {ad.link_url || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {ad.city || "Mérida"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {ad.state || "Yucatán"}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={
                          ad.is_active
                            ? "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800"
                            : "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600"
                        }
                      >
                        {ad.is_active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditItem(ad);
                            setEditLinkUrl(ad.link_url || "");
                            setEditCity(ad.city || "Mérida");
                            setEditState(ad.state || "Yucatán");
                            setEditActive(!!ad.is_active);
                            setEditFile(null);
                            setIsEditOpen(true);
                          }}
                          className="p-2 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(ad)}
                          disabled={updatingId === ad.id}
                          className="p-2 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
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
                          onClick={() => handleDelete(ad.id)}
                          disabled={deletingId === ad.id}
                          className="p-2 rounded-full border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50"
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
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-sm text-gray-600">Página {page}</span>
          <button
            type="button"
            onClick={() => hasMore && setPage((p) => p + 1)}
            disabled={!hasMore || loading}
            className="px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>

      {isEditOpen && editItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Editar anuncio</h3>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Imagen del banner (opcional)</p>
                <FileUpload
                  accept="image/*"
                  value={editFile}
                  currentImageUrl={computeImageUrl(editItem)}
                  removeBehavior="clear_selection"
                  onChange={setEditFile}
                  disabled={updatingId === editItem.id}
                  helperText="Arrastra y suelta o haz clic para seleccionar"
                />
              </div>
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
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 bg-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!editItem) return;
                  setUpdatingId(editItem.id);
                  setError(null);
                  try {
                    const updated = await adsService.update(editItem.id, {
                      link_url: editLinkUrl || null,
                      city: editCity || null,
                      state: editState || null,
                      is_active: editActive,
                      image: editFile || null,
                    });
                    if (!updated) {
                      setError("No se pudo actualizar el anuncio.");
                    } else {
                      setItems((prev) => prev.map((i) => (i.id === editItem.id ? updated : i)));
                      setIsEditOpen(false);
                    }
                  } catch {
                    setError("Ocurrió un error al actualizar.");
                  } finally {
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
        </div>
      )}
    </div>
  );
}
