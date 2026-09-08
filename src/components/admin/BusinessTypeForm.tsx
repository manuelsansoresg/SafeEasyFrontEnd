"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import FileUpload from "@/components/ui/FileUpload";
import { businessTypeService } from "@/services/businessTypeService";
import type { BusinessTypeAdminDetail, BusinessTypePayload } from "@/types/businessType";

const inputClass = "w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";
const buttonClass = "ml-auto inline-flex min-w-40 items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60";
const acceptedIconTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const messageOf = (error: unknown) => error instanceof Error ? error.message : "No se pudo guardar. Inténtalo de nuevo.";

export function BusinessTypeForm({ id, onClose, onSaved }: {
  id: number | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<BusinessTypeAdminDetail | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(id !== null);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [iconError, setIconError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState<"general" | "icon" | "delete-icon" | null>(null);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    if (id === null) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setLoadError("");
      try {
        const record = await businessTypeService.detail(id!, controller.signal);
        if (controller.signal.aborted) return;
        setDetail(record);
        setName(record.name);
        setActive(record.is_active);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(messageOf(error));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [id, retry]);

  const generalChanged = !detail || name.trim() !== detail.name || active !== detail.is_active;
  function resetIconSelection() {
    setIconFile(null);
  }

  function close() {
    if (saving) return;
    const hasPendingChanges = iconFile !== null
      || (id === null ? name.trim().length > 0 : Boolean(detail && generalChanged));
    if (hasPendingChanges && !window.confirm("¿Cerrar sin guardar los cambios pendientes?")) return;
    onClose();
  }

  function selectIcon(file: File | null) {
    if (!file) {
      resetIconSelection();
      return;
    }
    setIconError("");
    setError("");
    setSuccess("");
    if (!acceptedIconTypes.has(file.type)) {
      setIconFile(null);
      setIconError("Selecciona una imagen PNG, JPG o WEBP.");
      return;
    }
    setIconFile(file);
  }

  async function saveGeneral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    if (id === null) {
      if (!iconFile) {
        setIconError("Selecciona un icono para el tipo de negocio.");
        return;
      }
      setSaving("general");
      setError("");
      setIconError("");
      setSuccess("");

      let record = detail;
      if (createdId === null) {
        try {
          record = await businessTypeService.create({ name: name.trim(), is_active: active });
          setCreatedId(record.id);
          setDetail(record);
        } catch (error) {
          setError(messageOf(error));
          setSaving(null);
          return;
        }
      }

      const businessTypeId = createdId ?? record?.id;
      if (businessTypeId === undefined) {
        setError("No se pudo obtener el identificador del tipo de negocio.");
        setSaving(null);
        return;
      }

      try {
        await businessTypeService.uploadIcon(businessTypeId, iconFile);
        onSaved("Tipo de negocio creado con su icono.");
        onClose();
      } catch {
        setError("El tipo de negocio fue creado, pero no se pudo subir el icono. Inténtalo nuevamente.");
      } finally {
        setSaving(null);
      }
      return;
    }

    if (!detail) return;
    setSaving("general");
    setError("");
    setSuccess("");
    try {
      const changes: Partial<BusinessTypePayload> = {};
      if (name.trim() !== detail.name) changes.name = name.trim();
      if (active !== detail.is_active) changes.is_active = active;
      if (Object.keys(changes).length) {
        await businessTypeService.update(id, changes);
        setDetail({ ...detail, ...changes });
        setSuccess("Datos generales guardados.");
        onSaved("Datos generales guardados.");
      }
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setSaving(null);
    }
  }

  async function saveIcon() {
    if (id === null || !iconFile || saving) return;
    setSaving("icon");
    setIconError("");
    setSuccess("");
    try {
      const record = await businessTypeService.uploadIcon(id, iconFile);
      setDetail(record);
      resetIconSelection();
      setSuccess("Icono guardado.");
      onSaved("Icono del tipo de negocio actualizado.");
    } catch (error) {
      setIconError(messageOf(error));
    } finally {
      setSaving(null);
    }
  }

  async function deleteIcon() {
    if (id === null || !detail?.icon_url || saving) return;
    if (!window.confirm("¿Eliminar el icono de este tipo de negocio?")) return;
    setSaving("delete-icon");
    setIconError("");
    setSuccess("");
    try {
      await businessTypeService.deleteIcon(id);
      setDetail({ ...detail, icon_url: null });
      resetIconSelection();
      setSuccess("Icono eliminado.");
      onSaved("Icono del tipo de negocio eliminado.");
    } catch (error) {
      setIconError(messageOf(error));
    } finally {
      setSaving(null);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="business-type-title" onCancel={(event) => { event.preventDefault(); close(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-xl backdrop:bg-black/40 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="business-type-title" className="font-[family-name:var(--font-varela-round)] text-xl font-bold text-[#004e28]">{id === null ? "Nuevo tipo de negocio" : "Editar tipo de negocio"}</h2>
        <button type="button" aria-label="Cerrar" disabled={!!saving} onClick={close} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"><X size={20} /></button>
      </div>
      {loading ? <p role="status" className="flex items-center gap-2 py-8 text-gray-500"><Loader2 size={20} className="animate-spin" />Cargando tipo de negocio...</p>
        : loadError ? <div role="alert" className="space-y-3"><p className="text-sm text-red-700">{loadError}</p><button type="button" onClick={() => setRetry((value) => value + 1)} className={buttonClass}>Reintentar</button></div>
        : <div className="space-y-6">
          {success ? <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-700">{success}</p> : null}
          <form onSubmit={saveGeneral} className="space-y-4">
            <h3 className="font-semibold text-[#004e28]">Datos generales</h3>
            {detail && id !== null ? <p className="break-words text-xs text-gray-500">Identificador: {detail.slug} · {detail.suppliers_count} proveedores</p> : null}

            <div className="space-y-4">
              <FileUpload
                label={`Icono del tipo de negocio${id === null ? " *" : ""}`}
                value={iconFile}
                currentImageUrl={detail?.icon_url}
                onChange={selectIcon}
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                helperText="PNG, JPG o WEBP. La imagen se optimizará automáticamente."
                disabled={!!saving}
                removeBehavior="clear_selection"
              />
              {iconError ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{iconError}</p> : null}
              {id !== null ? <div className="flex flex-wrap justify-end gap-2">
                {detail?.icon_url ? <button type="button" disabled={!!saving} onClick={() => void deleteIcon()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
                  {saving === "delete-icon" ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}Eliminar icono
                </button> : null}
                {iconFile ? <button type="button" disabled={!!saving} onClick={() => void saveIcon()} className="inline-flex min-w-40 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving === "icon" ? <Loader2 size={16} className="animate-spin" /> : null}{saving === "icon" ? "Guardando icono..." : "Guardar icono"}
                </button> : null}
              </div> : null}
            </div>

            <fieldset disabled={!!saving} className="space-y-4">
              <div className="space-y-1.5"><label htmlFor="business-type-name" className="text-sm font-semibold">Nombre *</label><input id="business-type-name" autoFocus={id === null} required disabled={id === null && createdId !== null} value={name} onChange={(event) => setName(event.target.value)} className={inputClass} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} disabled={id === null && createdId !== null} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 accent-[#168e00]" />Activo</label>
              {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
              <div className="flex justify-end border-t border-gray-100 pt-4">
                <button type="submit" disabled={!!saving || (id !== null && !generalChanged)} className="inline-flex min-w-40 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving === "general" ? <Loader2 size={16} className="animate-spin" /> : null}
                  {saving === "general" ? (createdId === null ? "Creando..." : "Subiendo icono...") : createdId !== null ? "Reintentar subida de icono" : id === null ? "Crear tipo" : "Guardar datos generales"}
                </button>
              </div>
            </fieldset>
          </form>
        </div>}
    </dialog>
  );
}
