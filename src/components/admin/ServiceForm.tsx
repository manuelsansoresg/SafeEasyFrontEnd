"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Crown,
  ImagePlus,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { resolveCurrentSupplier } from "@/lib/currentSupplier";
import { servicesService } from "@/services/servicesService";
import { useAuthStore } from "@/store/useAuthStore";
import type { SupplierService } from "@/types/services";
import { Toast } from "@/components/ui/Toast";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 5;
const fieldClassName =
  "w-full rounded-xl border border-gray-200 px-4 py-2 text-gray-900 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

type ToastState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

function validateFiles(files: File[], availableSlots: number) {
  if (files.length > availableSlots) {
    return `Solo puedes agregar ${availableSlots} ${
      availableSlots === 1 ? "imagen" : "imágenes"
    } más.`;
  }
  const unsupported = files.find((file) => !ALLOWED_IMAGE_TYPES.has(file.type));
  if (unsupported) return "Las imágenes deben ser JPG, PNG o WebP.";
  const oversized = files.find((file) => file.size > MAX_IMAGE_SIZE);
  if (oversized) return `"${oversized.name}" supera el límite de 5 MB.`;
  return null;
}

function ExistingGallery({
  service,
  busyImageId,
  onSetCover,
  onDelete,
}: {
  service: SupplierService;
  busyImageId: number | null;
  onSetCover: (imageId: number) => void;
  onDelete: (imageId: number) => void;
}) {
  const sortedImages = [...service.images].sort(
    (a, b) => a.position - b.position,
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sortedImages.map((image) => (
        <article
          key={image.id}
          className="group overflow-hidden rounded-xl border border-gray-200 bg-white"
        >
          <div className="relative aspect-[4/3] bg-[#f2f3f4]">
            <Image
              src={image.thumbnail_url || image.image_url}
              alt={`Imagen ${image.position + 1} de ${service.title}`}
              fill
              unoptimized
              sizes="(max-width: 640px) 100vw, 33vw"
              className="object-cover"
            />
            {image.is_cover ? (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
                <Crown size={13} />
                Portada
              </span>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-2 p-3">
            <button
              type="button"
              disabled={image.is_cover || busyImageId !== null}
              onClick={() => onSetCover(image.id)}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Usar de portada
            </button>
            <button
              type="button"
              disabled={service.images.length === 1 || busyImageId !== null}
              onClick={() => onDelete(image.id)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Eliminar imagen"
              title={
                service.images.length === 1
                  ? "El servicio debe conservar una imagen"
                  : "Eliminar imagen"
              }
            >
              {busyImageId === image.id ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <Trash2 size={17} />
              )}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function ServiceForm({
  initialService,
}: {
  initialService?: SupplierService;
}) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const inputRef = useRef<HTMLInputElement>(null);
  const [service, setService] = useState(initialService ?? null);
  const [title, setTitle] = useState(initialService?.title ?? "");
  const [description, setDescription] = useState(
    initialService?.description ?? "",
  );
  const [price, setPrice] = useState(String(initialService?.price ?? ""));
  const [isActive, setIsActive] = useState(initialService?.is_active ?? true);
  const [files, setFiles] = useState<File[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyImageId, setBusyImageId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files],
  );

  useEffect(
    () => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)),
    [previews],
  );

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const existingCount = service?.images.length ?? 0;
  const availableSlots = MAX_IMAGES - existingCount;

  const addFiles = (selected: File[]) => {
    const nextFiles = [...files, ...selected];
    const error = validateFiles(nextFiles, availableSlots);
    if (error) {
      setToast({ type: "error", message: error });
      return;
    }
    setFiles(nextFiles);
  };

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setCoverIndex((current) => {
      if (current === index) return 0;
      return current > index ? current - 1 : current;
    });
  };

  const validateFields = () => {
    const parsedPrice = Number(price);
    if (!title.trim()) return "Escribe el nombre del servicio.";
    if (title.trim().length > 255)
      return "El nombre no puede superar 255 caracteres.";
    if (!description.trim()) return "Escribe una descripción del servicio.";
    if (description.trim().length > 5000)
      return "La descripción no puede superar 5,000 caracteres.";
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0)
      return "Ingresa un precio válido, igual o mayor a cero.";
    if (!service && files.length === 0)
      return "Agrega al menos una imagen del servicio.";
    return null;
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateFields();
    if (validationError) {
      setToast({ type: "error", message: validationError });
      return;
    }

    setSaving(true);
    try {
      if (service) {
        const updated = await servicesService.update(service.id, {
          title: title.trim(),
          description: description.trim(),
          price: Number(price),
          is_active: isActive,
        });
        setService(updated);
        setToast({
          type: "success",
          message: "La información del servicio se actualizó.",
        });
      } else {
        const supplier = await resolveCurrentSupplier(user);
        if (!supplier) {
          throw new Error("No se encontró el proveedor asociado a tu cuenta.");
        }
        const created = await servicesService.create({
          supplierId: supplier.id,
          title: title.trim(),
          description: description.trim(),
          price: Number(price),
          isActive,
          coverIndex,
          images: files,
        });
        router.replace(`/admin/services/${created.id}`);
      }
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo guardar el servicio.",
      });
    } finally {
      setSaving(false);
    }
  };

  const uploadImages = async () => {
    if (!service || files.length === 0) return;
    setUploading(true);
    try {
      const updated = await servicesService.addImages(
        service.id,
        files,
        coverIndex,
      );
      setService(updated);
      setFiles([]);
      setCoverIndex(0);
      setToast({
        type: "success",
        message: "Las imágenes se agregaron al servicio.",
      });
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron agregar las imágenes.",
      });
    } finally {
      setUploading(false);
    }
  };

  const setCover = async (imageId: number) => {
    if (!service) return;
    setBusyImageId(imageId);
    try {
      setService(await servicesService.setCover(service.id, imageId));
      setToast({ type: "success", message: "La portada se actualizó." });
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "No se cambió la portada.",
      });
    } finally {
      setBusyImageId(null);
    }
  };

  const deleteImage = async (imageId: number) => {
    if (!service || service.images.length === 1) return;
    if (!window.confirm("¿Eliminar esta imagen del servicio?")) return;
    setBusyImageId(imageId);
    try {
      setService(await servicesService.deleteImage(service.id, imageId));
      setToast({ type: "success", message: "La imagen se eliminó." });
    } catch (error) {
      setToast({
        type: "error",
        message:
          error instanceof Error ? error.message : "No se eliminó la imagen.",
      });
    } finally {
      setBusyImageId(null);
    }
  };

  return (
    <>
      <form
        onSubmit={handleSave}
        className="space-y-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <section className="space-y-4">
          <div>
            <h2 className="border-b pb-2 text-lg font-semibold text-gray-700">
              Información del servicio
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Describe con claridad qué ofreces y cuál es su precio base.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-gray-700">
                Nombre del servicio
              </span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={255}
                placeholder="Ej. Reparación de computadoras"
                className={fieldClassName}
              />
              <span className="block text-right text-xs text-gray-400">
                {title.length}/255
              </span>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-gray-700">
                Precio desde
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                  $
                </span>
                <input
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className={`${fieldClassName} pl-8`}
                />
              </div>
            </label>

            <label
              htmlFor="service-is-active"
              className="flex cursor-pointer items-center gap-3 self-center"
            >
              <input
                id="service-is-active"
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-gray-700">
                Servicio activo
                <span className="ml-2 font-normal text-gray-400">
                  (se mostrará públicamente)
                </span>
              </span>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium text-gray-700">
                Descripción
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={5000}
                rows={7}
                placeholder="Explica qué incluye, cómo trabajas y qué puede esperar el cliente."
                className={`${fieldClassName} min-h-36 resize-y leading-6`}
              />
              <span className="block text-right text-xs text-gray-400">
                {description.length}/5,000
              </span>
            </label>
          </div>
        </section>

        <section className="space-y-4 pt-4">
          <div>
            <h2 className="border-b pb-2 text-lg font-semibold text-gray-700">
              Galería
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Entre 1 y 5 imágenes JPG, PNG o WebP, de hasta 5 MB cada una.
            </p>
          </div>
          <div className="space-y-5">
            {service?.images.length ? (
              <ExistingGallery
                service={service}
                busyImageId={busyImageId}
                onSetCover={setCover}
                onDelete={deleteImage}
              />
            ) : null}

            {availableSlots > 0 ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="group flex min-h-40 w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 px-5 py-8 text-center transition-all hover:border-primary/50 hover:bg-gray-50"
              >
                <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                  <Upload size={21} />
                </span>
                <span className="text-sm font-medium text-gray-900">
                  <span className="text-primary">Haz clic para subir</span> o
                  selecciona imágenes
                </span>
                <span className="mt-1 text-xs text-gray-500">
                  JPG, PNG o WebP · Puedes agregar {availableSlots} más
                </span>
              </button>
            ) : null}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />

            {previews.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {previews.map(({ file, url }, index) => (
                  <article
                    key={`${file.name}-${file.lastModified}`}
                    className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                  >
                    <div className="relative aspect-[4/3] bg-[#f2f3f4]">
                      <Image
                        src={url}
                        alt={file.name}
                        fill
                        unoptimized
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover"
                      />
                      {coverIndex === index ? (
                        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white">
                          <Check size={13} />
                          Nueva portada
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-gray-600 shadow-md transition hover:text-red-600"
                        aria-label={`Quitar ${file.name}`}
                      >
                        <X size={17} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCoverIndex(index)}
                      className="w-full px-3 py-3 text-left text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
                    >
                      {coverIndex === index
                        ? "Seleccionada como portada"
                        : "Usar como portada"}
                    </button>
                  </article>
                ))}
              </div>
            ) : null}

            {service && files.length > 0 ? (
              <button
                type="button"
                onClick={uploadImages}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-60"
              >
                {uploading ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <ImagePlus size={17} />
                )}
                Subir imágenes seleccionadas
              </button>
            ) : null}
          </div>
        </section>

        <div className="flex flex-col-reverse justify-end gap-3 border-t border-gray-100 pt-4 sm:flex-row">
          <button
            type="button"
            onClick={() => router.push("/admin/services")}
            className="cursor-pointer rounded-xl bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2 text-white shadow-sm shadow-primary/20 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Check size={18} />
            )}
            {service ? "Guardar cambios" : "Crear servicio"}
          </button>
        </div>
      </form>

      {toast ? (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      ) : null}
    </>
  );
}
