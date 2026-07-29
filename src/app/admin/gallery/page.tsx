"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Images,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useMyDirectorySubscription } from "@/hooks/useMyDirectorySubscription";
import { subscriptionsService } from "@/services/subscriptionsService";
import { supplierGalleryService } from "@/services/supplierGalleryService";
import { resolveCurrentSupplier } from "@/lib/currentSupplier";
import type { SupplierGalleryImage } from "@/types/supplierGallery";
import type { Subscription } from "@/types/subscriptions";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 MB
const MAX_PER_BATCH = 10;

type ToastState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

function validateFiles(files: File[]): string | null {
  const unsupported = files.find((file) => !ALLOWED_IMAGE_TYPES.has(file.type));
  if (unsupported) return "Las imágenes deben ser JPG, PNG o WebP.";
  const oversized = files.find((file) => file.size > MAX_FILE_SIZE);
  if (oversized) return `"${oversized.name}" supera el límite de 8 MB.`;
  return null;
}

export default function AdminGalleryPage() {
  const { user } = useAuthStore();
  const { isDirectory, loading: subscriptionLoading } =
    useMyDirectorySubscription();

  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [supplierLoading, setSupplierLoading] = useState(true);

  const [images, setImages] = useState<SupplierGalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const limit = useMemo(() => {
    const fromPlan = subscription?.plan?.max_gallery_images;
    if (typeof fromPlan === "number" && fromPlan > 0) return fromPlan;
    return null;
  }, [subscription]);

  const remaining = limit ? Math.max(0, limit - images.length) : null;
  const isFull = typeof remaining === "number" && remaining <= 0;
  const canAddMore = !isFull;

  // Resolve current supplier (admin also has a supplier id from resolveCurrentSupplier when relevant)
  useEffect(() => {
    if (subscriptionLoading) return;
    if (!isDirectory || !user) {
      setSupplierLoading(false);
      return;
    }
    let cancelled = false;
    setSupplierLoading(true);
    resolveCurrentSupplier(user)
      .then((supplier) => {
        if (cancelled) return;
        if (supplier?.id) {
          setSupplierId(supplier.id);
        } else {
          setSupplierId(null);
          setError(
            "No se encontró un proveedor asociado a tu cuenta. Completa tu perfil de empresa primero.",
          );
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Error resolving current supplier:", err);
        setSupplierId(null);
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo identificar al proveedor.",
        );
      })
      .finally(() => {
        if (!cancelled) setSupplierLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDirectory, subscriptionLoading, user]);

  // Load subscription to read the plan limit
  useEffect(() => {
    if (subscriptionLoading) return;
    if (!isDirectory) return;
    let cancelled = false;
    subscriptionsService
      .getMySubscription()
      .then((sub) => {
        if (!cancelled) setSubscription(sub);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Error loading subscription for gallery:", err);
          setSubscription(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isDirectory, subscriptionLoading]);

  // Load gallery
  const loadGallery = useCallback(async () => {
    if (!supplierId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await supplierGalleryService.listMine(supplierId);
      const sorted = [...list].sort((a, b) => a.position - b.position);
      setImages(sorted);
    } catch (err) {
      setImages([]);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar la galería.",
      );
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    if (supplierId) void loadGallery();
  }, [supplierId, loadGallery]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Revoke object URLs on unmount or when previews change
  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePreviews = (files: File[]) => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setPreviews(files.map((file) => URL.createObjectURL(file)));
  };

  const addFiles = (newFiles: File[]) => {
    const imageFiles = newFiles.filter((f) => ALLOWED_IMAGE_TYPES.has(f.type));
    if (imageFiles.length === 0) {
      setToast({ type: "error", message: "Solo se permiten imágenes JPG, PNG o WebP." });
      return;
    }
    const error = validateFiles(imageFiles);
    if (error) {
      setToast({ type: "error", message: error });
      return;
    }
    const totalAfter = pendingFiles.length + imageFiles.length;
    if (totalAfter > MAX_PER_BATCH) {
      setToast({
        type: "info",
        message: `Solo puedes subir hasta ${MAX_PER_BATCH} imágenes a la vez.`,
      });
      const allowed = imageFiles.slice(0, MAX_PER_BATCH - pendingFiles.length);
      if (allowed.length === 0) return;
      const next = [...pendingFiles, ...allowed];
      setPendingFiles(next);
      updatePreviews(next);
      return;
    }
    if (typeof remaining === "number" && totalAfter > remaining) {
      setToast({
        type: "info",
        message: `Solo puedes agregar ${remaining} imagen${
          remaining === 1 ? "" : "es"
        } más según tu plan.`,
      });
      const allowed = imageFiles.slice(0, Math.max(0, remaining - pendingFiles.length));
      if (allowed.length === 0) return;
      const next = [...pendingFiles, ...allowed];
      setPendingFiles(next);
      updatePreviews(next);
      return;
    }
    const next = [...pendingFiles, ...imageFiles];
    setPendingFiles(next);
    updatePreviews(next);
  };

  const removePending = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    const nextFiles = pendingFiles.filter((_, i) => i !== index);
    const nextPreviews = previews.filter((_, i) => i !== index);
    setPendingFiles(nextFiles);
    setPreviews(nextPreviews);
  };

  const clearPending = () => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setPendingFiles([]);
    setPreviews([]);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!supplierId || pendingFiles.length === 0 || uploading) return;
    setUploading(true);

    // Mostramos la preview local (blob URL) para feedback inmediato.
    // El ID negativo activa el badge "Sincronizando" en la card.
    const localPreviews: SupplierGalleryImage[] = pendingFiles.map((file, index) => ({
      id: -Date.now() - index,
      supplier_id: supplierId,
      image_url: URL.createObjectURL(file),
      thumbnail_url: URL.createObjectURL(file),
      position: 0,
      created_at: new Date().toISOString(),
    }));
    setImages((current) => {
      const next = [...current, ...localPreviews];
      return next.map((img, idx) => ({ ...img, position: idx }));
    });
    clearPending();

    try {
      // Subimos al backend con POST /api/suppliers/{id}/gallery (multipart/form-data).
      // El service hace la llamada y devuelve las imágenes ya persistidas con su id real.
      const result = await supplierGalleryService.upload(supplierId, pendingFiles);
      setImages((current) => {
        // Reemplazamos las previews locales (id < 0) por las del servidor (id > 0).
        const serverOnly = current.filter((img) => img.id > 0);
        return [...serverOnly, ...result.uploaded].map((img, idx) => ({
          ...img,
          position: idx,
        }));
      });
      setToast({
        type: "success",
        message: `${result.uploaded.length} imagen${
          result.uploaded.length === 1 ? "" : "es"
        } subida${result.uploaded.length === 1 ? "" : "s"}.`,
      });
    } catch (err) {
      // Si falla la subida, dejamos la preview local y avisamos.
      setToast({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "No se pudieron subir las imágenes.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (image: SupplierGalleryImage) => {
    if (!supplierId) return;
    if (
      !window.confirm("¿Eliminar esta imagen de la galería? Esta acción no se puede deshacer.")
    ) {
      return;
    }
    setDeletingId(image.id);
    try {
      if (image.id > 0) {
        // Imagen real del servidor: DELETE normal
        await supplierGalleryService.remove(supplierId, image.id);
      } else {
        // Preview local (ID negativo): solo limpiamos el blob URL y el estado
        if (image.image_url.startsWith("blob:")) {
          URL.revokeObjectURL(image.image_url);
        }
      }
      setImages((current) => current.filter((item) => item.id !== image.id));
      setToast({ type: "success", message: "Imagen eliminada." });
    } catch (err) {
      setToast({
        type: "error",
        message:
          err instanceof Error ? err.message : "No se pudo eliminar la imagen.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (subscriptionLoading || supplierLoading) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <Loader2 className="animate-spin text-[#168e00]" size={34} />
      </div>
    );
  }

  if (!isDirectory) {
    return (
      <div className="mx-auto max-w-2xl rounded-[1.75rem] border border-amber-200 bg-white p-8 text-center shadow-sm">
        <Images className="mx-auto text-[#004e28]" size={42} strokeWidth={1.7} />
        <h1 className="mt-4 font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28]">
          Galería disponible con plan Directorio
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-600">
          Tu cuenta necesita una suscripción activa de tipo directorio para
          administrar la galería de tu empresa.
        </p>
        <Link
          href="/admin/my-subscription"
          className="mt-6 inline-flex rounded-xl bg-[#004e28] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#168e00]"
        >
          Ver mi suscripción
        </Link>
      </div>
    );
  }

  if (!supplierId) {
    return (
      <div className="mx-auto max-w-2xl rounded-[1.75rem] border border-amber-200 bg-white p-8 text-center shadow-sm">
        <AlertCircle className="mx-auto text-amber-500" size={42} strokeWidth={1.7} />
        <h1 className="mt-4 font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28]">
          No se encontró un proveedor asociado
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-600">
          {error ??
            "Completa tu perfil de empresa antes de administrar la galería."}
        </p>
        <Link
          href="/admin/my-company"
          className="mt-6 inline-flex rounded-xl bg-[#004e28] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#168e00]"
        >
          Ir a Mi Empresa
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Galería"
        subtitle="Sube las imágenes que se mostrarán en tu directorio. El límite lo define tu plan."
        actions={
          <div className="rounded-xl border border-[#004e28]/10 bg-white px-4 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Imágenes usadas
            </p>
            <p className="mt-1 font-[family-name:var(--font-varela-round)] text-xl text-[#004e28]">
              {images.length}
              {limit != null ? (
                <span className="text-base text-gray-400"> / {limit}</span>
              ) : null}
            </p>
            {remaining != null ? (
              <p className="mt-1 text-xs text-gray-500">
                {isFull
                  ? "Has alcanzado el límite de tu plan."
                  : `${remaining} disponibles`}
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-500">Sin límite definido</p>
            )}
          </div>
        }
      />

      {/* Uploader */}
      <section className="overflow-hidden rounded-[1.4rem] border border-[#004e28]/10 bg-white shadow-[0_18px_55px_-42px_rgba(0,78,40,0.65)]">
        <div className="border-b border-gray-100 p-5">
          <h2 className="font-[family-name:var(--font-varela-round)] text-lg text-[#004e28]">
            Subir nuevas imágenes
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Puedes subir hasta {MAX_PER_BATCH} imágenes a la vez (JPG, PNG o WebP, máximo 8 MB cada una).
          </p>
        </div>

        <div className="p-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={onDrop}
            onClick={() => canAddMore && inputRef.current?.click()}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
              isDragging
                ? "border-[#168e00] bg-[#168e00]/5"
                : canAddMore
                  ? "cursor-pointer border-gray-200 hover:border-[#168e00] hover:bg-gray-50"
                  : "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
            }`}
            role="button"
            aria-disabled={!canAddMore}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={onFileInputChange}
              disabled={!canAddMore}
              className="hidden"
            />
            <Upload className="text-[#004e28]" size={28} />
            <p className="mt-3 text-sm font-semibold text-gray-900">
              {canAddMore
                ? "Haz clic o arrastra imágenes aquí"
                : "Has alcanzado el límite de tu plan"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {canAddMore
                ? "Formatos: JPG, PNG, WebP. Tamaño máximo: 8 MB."
                : "Elimina alguna imagen para poder subir más."}
            </p>
          </div>

          {previews.length > 0 ? (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Pendientes de subir ({previews.length})
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {previews.map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-gray-200 bg-[#f2f3f4]"
                  >
                    <Image
                      src={url}
                      alt={`Vista previa ${index + 1}`}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePending(index);
                      }}
                      className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-gray-600 shadow-sm transition hover:bg-red-500 hover:text-white"
                      aria-label={`Quitar imagen ${index + 1}`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={clearPending}
                  disabled={uploading}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading || pendingFiles.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#004e28] px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-[#004e28]/15 transition hover:-translate-y-0.5 hover:bg-[#168e00] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Upload size={18} />
                  )}
                  Subir {pendingFiles.length} imagen
                  {pendingFiles.length === 1 ? "" : "es"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* Current gallery */}
      <section className="overflow-hidden rounded-[1.4rem] border border-[#004e28]/10 bg-white shadow-[0_18px_55px_-42px_rgba(0,78,40,0.65)]">
        <div className="border-b border-gray-100 p-5">
          <h2 className="font-[family-name:var(--font-varela-round)] text-lg text-[#004e28]">
            Imágenes actuales
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Ordenadas por posición. La primera imagen es la principal.
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center">
            <Loader2 className="animate-spin text-[#168e00]" size={30} />
          </div>
        ) : error ? (
          <div className="p-10 text-center">
            <p className="text-sm font-semibold text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => void loadGallery()}
              className="mt-4 text-sm font-semibold text-[#004e28] hover:underline"
            >
              Intentar de nuevo
            </button>
          </div>
        ) : images.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Images className="mx-auto text-gray-300" size={38} />
            <p className="mt-3 text-sm font-semibold text-gray-600">
              Aún no tienes imágenes en tu galería.
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Sube tus primeras imágenes para que tu directorio se vea más atractivo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 md:grid-cols-4">
            {images.map((image, index) => (
              <article
                key={image.id}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                <div className="relative aspect-[4/3] bg-[#f2f3f4]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.thumbnail_url || image.image_url}
                    alt={`Imagen ${index + 1} de la galería`}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  {index === 0 ? (
                    <span className="absolute left-2 top-2 rounded-full bg-[#004e28] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm">
                      Principal
                    </span>
                  ) : null}
                  {image.id < 0 ? (
                    <span className="absolute right-2 top-2 rounded-full bg-amber-500/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm">
                      Sincronizando
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                    #{index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleDelete(image)}
                    disabled={deletingId === image.id}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Eliminar imagen"
                    title="Eliminar"
                  >
                    {deletingId === image.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {toast ? (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
