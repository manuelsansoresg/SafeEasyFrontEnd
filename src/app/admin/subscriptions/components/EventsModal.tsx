"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Loader2, ShieldCheck, X } from "lucide-react";
import { subscriptionsService } from "@/services/subscriptionsService";
import type {
  SubscriptionAssignmentType,
  SubscriptionHistoryEntry,
} from "@/types/subscriptions";

type Props = {
  open: boolean;
  subscriptionId: number | null;
  onClose: () => void;
};

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return "Sin dato";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const prettyStatus = (value: string | null | undefined) => {
  if (value === "active") return "Activa";
  if (value === "expired") return "Expirada";
  if (value === "cancelled") return "Cancelada";
  if (value === "purchase_pending") return "Pago pendiente";
  if (value === "activated") return "Activada";
  return value || "Sin dato";
};

const prettyAssignmentType = (
  value: SubscriptionAssignmentType | null | undefined,
) => {
  if (value === "courtesy") return "Cortesía";
  if (value === "external_payment") return "Pago externo";
  if (value === "migration") return "Migración";
  if (value === "support") return "Soporte";
  if (value === "other") return "Otro";
  return "Sin clasificar";
};

const prettyAction = (value: string | null | undefined) => {
  if (!value) return "Cambio administrativo";
  const normalized = value.toLowerCase();
  if (normalized.includes("create") || normalized.includes("assign")) {
    return "Subscripción asignada";
  }
  if (normalized.includes("cancel")) return "Subscripción cancelada";
  if (normalized.includes("extend")) return "Vigencia extendida";
  if (normalized.includes("plan")) return "Plan modificado";
  if (normalized.includes("update") || normalized.includes("change")) {
    return "Subscripción modificada";
  }
  return value.replaceAll("_", " ");
};

const Change = ({
  label,
  previous,
  next,
}: {
  label: string;
  previous: string;
  next: string;
}) => (
  <div className="grid grid-cols-[92px_1fr] gap-2 text-xs leading-5">
    <span className="font-medium text-gray-500">{label}</span>
    <span className="text-gray-700">
      <span className="text-gray-400">{previous}</span>
      <span className="px-2 text-gray-300">→</span>
      <span className="font-medium text-gray-900">{next}</span>
    </span>
  </div>
);

export default function EventsModal({ open, subscriptionId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<SubscriptionHistoryEntry[]>([]);

  const title = useMemo(
    () => (subscriptionId ? `Historial · #${subscriptionId}` : "Historial"),
    [subscriptionId],
  );

  useEffect(() => {
    if (!open || !subscriptionId) return;
    let mounted = true;
    const loadId = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      setEvents([]);

      subscriptionsService
        .getHistory(subscriptionId)
        .then((data) => {
          if (mounted) setEvents(data);
        })
        .catch((loadError) => {
          console.error("Failed to fetch subscription history:", loadError);
          if (!mounted) return;
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo cargar el historial.",
          );
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    }, 0);

    return () => {
      mounted = false;
      window.clearTimeout(loadId);
    };
  }, [open, subscriptionId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscription-history-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Clock size={20} />
            </div>
            <div>
              <h2 id="subscription-history-title" className="text-lg font-semibold text-gray-900">
                {title}
              </h2>
              <p className="text-sm text-gray-500">
                Registro de auditoría de solo lectura
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {loading ? (
            <div className="py-12 text-center text-gray-500">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={18} />
                Cargando historial...
              </div>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error}
            </div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              Esta subscripción aún no tiene eventos de auditoría.
            </div>
          ) : (
            <div className="space-y-4">
              {events.map((event, index) => {
                const hasStatusChange =
                  event.previous_status != null || event.new_status != null;
                const hasPlanChange =
                  event.previous_plan_id != null || event.new_plan_id != null;
                const hasStartChange =
                  event.previous_start_date != null || event.new_start_date != null;
                const hasEndChange =
                  event.previous_end_date != null || event.new_end_date != null;

                return (
                  <article
                    key={event.id}
                    className="relative rounded-2xl border border-gray-100 bg-gray-50/70 p-4 sm:p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                          <ShieldCheck size={17} />
                        </div>
                        <div>
                          <h3 className="font-semibold capitalize text-gray-900">
                            {prettyAction(event.action)}
                          </h3>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {event.admin_name
                              ? `Realizado por ${event.admin_name}`
                              : event.admin_user_id
                                ? `Administrador #${event.admin_user_id}`
                                : "Acción administrativa"}
                          </p>
                        </div>
                      </div>
                      <time className="text-xs text-gray-500" dateTime={event.created_at}>
                        {formatDateTime(event.created_at)}
                      </time>
                    </div>

                    <div className="mt-4 rounded-xl border border-gray-100 bg-white p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        {prettyAssignmentType(event.assignment_type)}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                        {event.note || "Sin nota"}
                      </p>
                    </div>

                    {hasStatusChange || hasPlanChange || hasStartChange || hasEndChange ? (
                      <div className="mt-4 space-y-1.5 border-t border-gray-200 pt-3">
                        {hasStatusChange ? (
                          <Change
                            label="Estado"
                            previous={prettyStatus(event.previous_status)}
                            next={prettyStatus(event.new_status)}
                          />
                        ) : null}
                        {hasPlanChange ? (
                          <Change
                            label="Plan"
                            previous={
                              event.previous_plan_id ? `#${event.previous_plan_id}` : "Sin dato"
                            }
                            next={event.new_plan_id ? `#${event.new_plan_id}` : "Sin dato"}
                          />
                        ) : null}
                        {hasStartChange ? (
                          <Change
                            label="Inicio"
                            previous={formatDateTime(event.previous_start_date)}
                            next={formatDateTime(event.new_start_date)}
                          />
                        ) : null}
                        {hasEndChange ? (
                          <Change
                            label="Vigencia"
                            previous={formatDateTime(event.previous_end_date)}
                            next={formatDateTime(event.new_end_date)}
                          />
                        ) : null}
                      </div>
                    ) : null}

                    {index < events.length - 1 ? (
                      <div className="absolute -bottom-4 left-8 h-4 w-px bg-gray-200" />
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 p-5">
          <p className="text-xs text-gray-500">
            Los registros no pueden modificarse ni eliminarse.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
