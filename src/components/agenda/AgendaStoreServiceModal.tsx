"use client";

import { ChevronDown, ImagePlus } from "lucide-react";
import { useState } from "react";
import AgendaModalShell from "@/components/agenda/AgendaModalShell";
import type {
  AgendaCatalogService,
  BufferDuration,
  ServiceDuration,
} from "@/types/agenda";

const durations: ServiceDuration[] = [15, 20, 30, 45, 60, 90, 120];
const buffers: BufferDuration[] = [0, 5, 10, 15, 20, 30, 45, 60];
const fieldClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-[#168e00] focus:ring-4 focus:ring-[#168e00]/10";
const selectClass = `${fieldClass} h-12 appearance-none pr-11`;

export type AgendaStoreServiceCreateValues = {
  title: string;
  description: string;
  price: number;
  isActive: boolean;
  durationMinutes: ServiceDuration;
  bufferMinutes: BufferDuration;
  image: File | null;
};

export type AgendaStoreServiceUpdateValues = {
  title: string;
  description: string;
  price: number;
  isActive: boolean;
};

type AgendaStoreServiceModalProps = {
  open: boolean;
  service: AgendaCatalogService | null;
  saving: boolean;
  onClose: () => void;
  onCreate: (values: AgendaStoreServiceCreateValues) => Promise<void>;
  onUpdate: (values: AgendaStoreServiceUpdateValues) => Promise<void>;
};

export default function AgendaStoreServiceModal({
  open,
  service,
  saving,
  onClose,
  onCreate,
  onUpdate,
}: AgendaStoreServiceModalProps) {
  const [title, setTitle] = useState(service?.title ?? "");
  const [description, setDescription] = useState(service?.description ?? "");
  const [price, setPrice] = useState(service ? String(service.price) : "");
  const [isActive, setIsActive] = useState(service?.is_active ?? true);
  const [duration, setDuration] = useState<ServiceDuration>(
    service?.duration_minutes ?? 30,
  );
  const [buffer, setBuffer] = useState<BufferDuration>(
    service?.buffer_minutes ?? 0,
  );
  const [image, setImage] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const valid =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    price !== "" &&
    Number.isFinite(Number(price)) &&
    Number(price) >= 0;

  return (
    <AgendaModalShell
      open={open}
      title={service ? "Editar servicio" : "Nuevo servicio"}
      description={
        service
          ? "Actualiza la información que verán tus clientes. La duración de la cita se configura por separado."
          : "Crea el servicio y déjalo listo para recibir reservaciones en una sola operación."
      }
      saving={saving}
      submitLabel={service ? "Guardar servicio" : "Crear servicio"}
      submitDisabled={!valid}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) {
          setValidationError("Completa nombre, descripción y un precio válido.");
          return;
        }
        setValidationError(null);
        const common = {
          title: title.trim(),
          description: description.trim(),
          price: Number(price),
          isActive,
        };
        if (service) void onUpdate(common);
        else {
          void onCreate({
            ...common,
            durationMinutes: duration,
            bufferMinutes: buffer,
            image,
          });
        }
      }}
    >
      {validationError ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {validationError}
        </p>
      ) : null}

      <label>
        <span className="mb-1.5 block text-sm font-semibold text-gray-700">
          Nombre del servicio *
        </span>
        <input
          required
          maxLength={255}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ej. Instalación"
          className={fieldClass}
        />
      </label>

      <label>
        <span className="mb-1.5 block text-sm font-semibold text-gray-700">
          Descripción *
        </span>
        <textarea
          required
          rows={4}
          maxLength={5000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Explica brevemente qué incluye el servicio."
          className={fieldClass}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-sm font-semibold text-gray-700">
            Precio *
          </span>
          <input
            required
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="0.00"
            className={fieldClass}
          />
        </label>

        {!service ? (
          <label>
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Duración de la cita *
            </span>
            <div className="relative">
              <select
                value={duration}
                onChange={(event) =>
                  setDuration(Number(event.target.value) as ServiceDuration)
                }
                className={selectClass}
              >
                {durations.map((value) => (
                  <option key={value} value={value}>
                    {value} minutos
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            </div>
          </label>
        ) : null}

        {!service ? (
          <label>
            <span className="mb-1.5 block text-sm font-semibold text-gray-700">
              Tiempo libre después
            </span>
            <div className="relative">
              <select
                value={buffer}
                onChange={(event) =>
                  setBuffer(Number(event.target.value) as BufferDuration)
                }
                className={selectClass}
              >
                {buffers.map((value) => (
                  <option key={value} value={value}>
                    {value === 0 ? "Sin tiempo adicional" : `${value} minutos`}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            </div>
          </label>
        ) : null}
      </div>

      {!service ? (
        <label className="block rounded-2xl border border-dashed border-gray-300 p-4 transition hover:border-[#168e00]/50">
          <span className="flex items-center gap-2 font-semibold text-gray-800">
            <ImagePlus aria-hidden="true" size={19} className="text-[#168e00]" />
            Imagen opcional
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="mt-3 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#168e00]/10 file:px-3 file:py-2 file:font-semibold file:text-[#117500]"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              if (file && file.size > 5 * 1024 * 1024) {
                setValidationError("La imagen no puede superar 5 MB.");
                event.target.value = "";
                setImage(null);
                return;
              }
              setValidationError(null);
              setImage(file);
            }}
          />
          <span className="mt-2 block text-xs text-gray-500">
            JPG, PNG o WebP de hasta 5 MB.
          </span>
        </label>
      ) : null}

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 p-4">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          className="mt-0.5 size-5 accent-[#168e00]"
        />
        <span>
          <strong className="block text-gray-900">Servicio activo</strong>
          <span className="mt-0.5 block text-sm text-gray-600">
            Los servicios inactivos no pueden ofrecer nuevas reservaciones.
          </span>
        </span>
      </label>
    </AgendaModalShell>
  );
}
