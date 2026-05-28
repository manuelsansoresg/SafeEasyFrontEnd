"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Loader2, X } from "lucide-react";
import { subscriptionsService } from "@/services/subscriptionsService";
import type { SubscriptionEvent } from "@/types/subscriptions";

type Props = {
  open: boolean;
  subscriptionId: number | null;
  onClose: () => void;
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const prettyStatus = (value: string) => {
  if (value === "purchase_pending") return "Pago pendiente";
  if (value === "activated") return "Activada";
  if (value === "active") return "Activa";
  if (value === "expired") return "Expirada";
  return value;
};

export default function EventsModal({ open, subscriptionId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<SubscriptionEvent[]>([]);

  const title = useMemo(() => {
    if (!subscriptionId) return "Historial";
    return `Historial · #${subscriptionId}`;
  }, [subscriptionId]);

  useEffect(() => {
    if (!open || !subscriptionId) return;
    let mounted = true;
    const loadEvents = async () => {
      setLoading(true);
      setError(null);
      setEvents([]);
      try {
        const data = await subscriptionsService.getEvents(subscriptionId);
        if (!mounted) return;
        setEvents(data);
      } catch (e) {
        console.error("Failed to fetch events:", e);
        if (!mounted) return;
        setError("No se pudo cargar el historial.");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    window.setTimeout(loadEvents, 0);
    return () => {
      mounted = false;
    };
  }, [open, subscriptionId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Clock size={20} />
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">{title}</div>
              <div className="text-sm text-gray-500">Eventos de la suscripción</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="py-10 text-center text-gray-500">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin" size={18} />
                Cargando historial...
              </div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
              {error}
            </div>
          ) : events.length === 0 ? (
            <div className="py-10 text-center text-gray-500">Sin eventos</div>
          ) : (
            <div className="space-y-4">
              {events.map((ev) => (
                <div key={ev.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <div className="w-px flex-1 bg-gray-200 mt-2" />
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div className="font-medium text-gray-900">{prettyStatus(ev.status)}</div>
                      <div className="text-xs text-gray-500">{formatDateTime(ev.created_at)}</div>
                    </div>
                    <div className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{ev.note || "-"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
