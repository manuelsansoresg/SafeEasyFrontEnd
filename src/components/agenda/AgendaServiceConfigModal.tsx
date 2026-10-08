"use client";

import { AlertTriangle, ChevronDown, Info } from "lucide-react";
import { useState } from "react";
import AgendaModalShell from "@/components/agenda/AgendaModalShell";
import type {
  AgendaService,
  AgendaServiceUpdatePayload,
  BufferDuration,
  ServiceDuration,
} from "@/types/agenda";

const durations: ServiceDuration[] = [15, 20, 30, 45, 60, 90, 120];
const buffers: BufferDuration[] = [0, 5, 10, 15, 20, 30, 45, 60];
const selectClass =
  "h-12 w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 pr-11 text-sm text-gray-900 outline-none transition focus:border-[#168e00] focus:ring-4 focus:ring-[#168e00]/10";

type AgendaServiceConfigModalProps = {
  open: boolean;
  service: AgendaService | null;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: AgendaServiceUpdatePayload) => Promise<void>;
  onDeactivate: () => Promise<void>;
};

function money(value: number | null) {
  if (value === null) return "Sin precio";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value);
}

export default function AgendaServiceConfigModal({
  open,
  service,
  saving,
  onClose,
  onSave,
  onDeactivate,
}: AgendaServiceConfigModalProps) {
  const [duration, setDuration] = useState<ServiceDuration>(
    service?.duration_minutes ?? 30,
  );
  const [buffer, setBuffer] = useState<BufferDuration>(
    service?.buffer_minutes ?? 0,
  );
  const [active, setActive] = useState(service?.is_active ?? true);
  const [displayOrder, setDisplayOrder] = useState(
    service?.display_order ?? 0,
  );
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

  if (!service) return null;

  return (
    <AgendaModalShell
      open={open}
      title="Configurar cita"
      description="Ajusta únicamente cómo se reservará este servicio. Su nombre, descripción y precio pertenecen al catálogo."
      saving={saving}
      submitLabel={confirmingDeactivate ? "Desactivar reservaciones" : "Guardar cambios"}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        if (confirmingDeactivate) {
          void onDeactivate();
          return;
        }
        if (service.is_active && !active) {
          setConfirmingDeactivate(true);
          return;
        }
        void onSave({
          duration_minutes: duration,
          buffer_minutes: buffer,
          is_active: active,
          display_order: displayOrder,
        });
      }}
    >
      <div className="rounded-2xl border border-[#168e00]/15 bg-[#168e00]/5 p-4">
        <h3 className="font-[family-name:var(--font-varela-round)] text-lg text-[#004e28]">
          {service.name}
        </h3>
        <p className="mt-1 font-bold text-[#168e00]">{money(service.price)}</p>
        {service.description ? (
          <p className="mt-2 text-sm leading-6 text-gray-600">
            {service.description}
          </p>
        ) : null}
      </div>

      {confirmingDeactivate ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 shrink-0" aria-hidden="true" size={21} />
            <div>
              <p className="font-bold">¿Desactivar reservaciones?</p>
              <p className="mt-1 text-sm leading-6">
                Este servicio dejará de aparecer para nuevas reservaciones. Tus citas existentes se conservarán.
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setActive(true);
                  setConfirmingDeactivate(false);
                }}
                className="mt-3 text-sm font-bold text-amber-900 underline-offset-4 hover:underline"
              >
                Volver a la configuración
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-gray-700 sm:min-h-10">
                  Duración de la cita
                </span>
                <div className="relative">
                  <select
                    className={selectClass}
                    value={duration}
                    onChange={(event) =>
                      setDuration(Number(event.target.value) as ServiceDuration)
                    }
                  >
                    {durations.map((value) => (
                      <option key={value} value={value}>
                        {value} minutos
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    size={18}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>
              </label>
              <p className="mt-2 text-xs leading-5 text-gray-600">
                Tiempo que necesitas para realizar el servicio.
              </p>
              <details className="mt-1 text-xs leading-5 text-gray-600">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded text-[#168e00] marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00] [&::-webkit-details-marker]:hidden">
                  <Info aria-hidden="true" size={14} />
                  Ver ejemplo
                </summary>
                <p className="mt-1">
                  Si seleccionas 30 minutos y la cita comienza a las 10:00, terminará a las 10:30.
                </p>
              </details>
            </div>

            <div className="min-w-0">
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-gray-700 sm:min-h-10">
                  Tiempo de preparación entre citas
                </span>
                <div className="relative">
                  <select
                    className={selectClass}
                    value={buffer}
                    onChange={(event) =>
                      setBuffer(Number(event.target.value) as BufferDuration)
                    }
                  >
                    {buffers.map((value) => (
                      <option key={value} value={value}>
                        {value === 0 ? "Sin tiempo adicional" : `${value} minutos`}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    size={18}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                </div>
              </label>
              <p className="mt-2 text-xs leading-5 text-gray-600">
                Tiempo adicional que se bloqueará antes de recibir al siguiente cliente.
              </p>
              <details className="mt-1 text-xs leading-5 text-gray-600">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded text-[#168e00] marker:hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00] [&::-webkit-details-marker]:hidden">
                  <Info aria-hidden="true" size={14} />
                  Ver ejemplo
                </summary>
                <p className="mt-1">
                  Si el servicio dura 30 minutos y agregas 15 de preparación, la siguiente cita podrá comenzar a las 10:45.
                </p>
              </details>
            </div>

            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                Orden de aparición
              </span>
              <input
                type="number"
                min={0}
                max={9999}
                value={displayOrder}
                onChange={(event) => setDisplayOrder(Number(event.target.value))}
                className="h-12 w-full rounded-xl border border-gray-200 px-4 outline-none transition focus:border-[#168e00] focus:ring-4 focus:ring-[#168e00]/10"
              />
            </label>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 p-4 transition hover:border-[#168e00]/30">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
              className="mt-0.5 size-5 accent-[#168e00]"
            />
            <span>
              <strong className="block text-gray-900">Disponible para reservar</strong>
              <span className="mt-0.5 block text-sm text-gray-600">
                Cuando está activo, tus clientes pueden encontrar horarios para este servicio.
              </span>
            </span>
          </label>

          {service.is_active ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setActive(false);
                setConfirmingDeactivate(true);
              }}
              className="text-sm font-bold text-red-700 underline-offset-4 hover:underline disabled:opacity-50"
            >
              Quitar de Agenda
            </button>
          ) : null}
        </>
      )}
    </AgendaModalShell>
  );
}
