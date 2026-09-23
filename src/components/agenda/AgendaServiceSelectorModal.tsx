"use client";

import Link from "next/link";
import { BriefcaseBusiness, CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";
import AgendaModalShell from "@/components/agenda/AgendaModalShell";
import type { AgendaCatalogService } from "@/types/agenda";

type AgendaServiceSelectorModalProps = {
  open: boolean;
  catalog: AgendaCatalogService[];
  isDirectory: boolean;
  saving: boolean;
  onClose: () => void;
  onAdd: (serviceIds: string[]) => Promise<void>;
};

function money(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value);
}

export default function AgendaServiceSelectorModal({
  open,
  catalog,
  isDirectory,
  saving,
  onClose,
  onAdd,
}: AgendaServiceSelectorModalProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const selectableCount = useMemo(
    () =>
      catalog.filter(
        (service) => service.is_active && !service.agenda_enabled,
      ).length,
    [catalog],
  );

  return (
    <AgendaModalShell
      open={open}
      title="Agregar servicios a Agenda"
      description="Selecciona los servicios que tus clientes podrán reservar. Puedes elegir varios a la vez."
      saving={saving}
      submitLabel={
        selected.size === 1
          ? "Agregar servicio"
          : `Agregar seleccionados (${selected.size})`
      }
      submitDisabled={selected.size === 0}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        void onAdd(Array.from(selected));
      }}
    >
      {catalog.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-[#f2f3f4]/60 px-5 py-10 text-center">
          <BriefcaseBusiness className="mx-auto text-[#168e00]" size={34} />
          <p className="mt-3 font-bold text-gray-900">
            No tienes servicios creados todavía
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-gray-600">
            Crea primero tus servicios y después podrás elegir cuáles aceptar con cita.
          </p>
          {isDirectory ? (
            <Link
              href="/admin/services/create"
              className="mt-5 inline-flex rounded-xl bg-[#004e28] px-4 py-3 text-sm font-semibold text-white"
            >
              Crear mi primer servicio
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {catalog.map((service) => {
            const alreadyEnabled =
              service.agenda_service_id !== null && service.agenda_enabled;
            const canSelect = service.is_active && !alreadyEnabled;
            const checked = alreadyEnabled || selected.has(service.service_id);

            return (
              <label
                key={service.service_id}
                className={[
                  "flex items-start gap-3 rounded-2xl border p-4 transition",
                  canSelect
                    ? "cursor-pointer border-gray-200 hover:border-[#168e00]/40 hover:bg-[#168e00]/[0.03]"
                    : "cursor-not-allowed border-gray-100 bg-gray-50",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 accent-[#168e00]"
                  checked={checked}
                  disabled={!canSelect || saving}
                  onChange={(event) => {
                    setSelected((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(service.service_id);
                      else next.delete(service.service_id);
                      return next;
                    });
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="text-gray-900">{service.title}</strong>
                    {alreadyEnabled ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#168e00]/10 px-2.5 py-1 text-xs font-bold text-[#117500]">
                        <CheckCircle2 aria-hidden="true" size={13} />
                        Ya está en Agenda
                      </span>
                    ) : service.agenda_service_id !== null ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                        Reservaciones desactivadas
                      </span>
                    ) : null}
                    {!service.is_active ? (
                      <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-bold text-gray-600">
                        Inactivo
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-[#004e28]">
                    {money(service.price)}
                  </span>
                  {!service.is_active ? (
                    <span className="mt-1 block text-xs text-gray-600">
                      Activa primero el servicio.
                      {isDirectory ? (
                        <Link
                          href={`/admin/services/${service.service_id}`}
                          className="ml-1 font-semibold text-[#168e00] underline-offset-2 hover:underline"
                        >
                          Editar servicio
                        </Link>
                      ) : null}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {catalog.length > 0 && selectableCount === 0 ? (
        <p className="rounded-xl bg-[#f2f3f4] px-4 py-3 text-sm text-gray-600">
          Todos tus servicios activos ya están disponibles en Agenda.
        </p>
      ) : null}
    </AgendaModalShell>
  );
}
