"use client";

import { useState, useEffect } from "react";
import { fetchWithAuth } from "@/lib/api";
import { Clock, AlertCircle, Loader2 } from "lucide-react";
import { BusinessHour } from "@/lib/products";

interface Props {
  supplierId: number;
  token: string;
}

const DAYS = [
  { id: 1, label: "Lunes" },
  { id: 2, label: "Martes" },
  { id: 3, label: "Miércoles" },
  { id: 4, label: "Jueves" },
  { id: 5, label: "Viernes" },
  { id: 6, label: "Sábado" },
  { id: 0, label: "Domingo" },
];

export default function BusinessHoursEditor({ supplierId, token }: Props) {
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize with default hours if none exist
  const initializeHours = (existingHours: BusinessHour[] = []) => {
    const normalizedByDay = new Map<number, BusinessHour>();
    const parseBool = (v: unknown) => {
      if (typeof v === "boolean") return v;
      if (typeof v === "number") return v !== 0;
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "true" || s === "1" || s === "yes" || s === "y") return true;
        if (s === "false" || s === "0" || s === "no" || s === "n") return false;
      }
      return false;
    };

    for (const raw of existingHours) {
      const rec = raw as unknown as Record<string, unknown>;
      const day = Number(rec.day_of_week);
      if (!Number.isFinite(day)) continue;

      const open = typeof rec.open_time === "string" ? rec.open_time : null;
      const close = typeof rec.close_time === "string" ? rec.close_time : null;
      const isClosed = parseBool(rec.is_closed) || (open == null && close == null);

      const normalized: BusinessHour = {
        ...(raw as BusinessHour),
        day_of_week: day,
        open_time: open,
        close_time: close,
        is_closed: isClosed,
      };

      const existing = normalizedByDay.get(day);
      if (!existing) {
        normalizedByDay.set(day, normalized);
        continue;
      }

      const existingClosed =
        Boolean(existing.is_closed) || (existing.open_time == null && existing.close_time == null);
      const incomingClosed = Boolean(normalized.is_closed) || (open == null && close == null);
      normalizedByDay.set(day, incomingClosed ? normalized : existingClosed ? existing : normalized);
    }

    return DAYS.map((day) => {
      const existing = normalizedByDay.get(day.id);
      if (existing) return existing;
      
      return {
        day_of_week: day.id,
        open_time: null,
        close_time: null,
        is_closed: true,
      };
    });
  };

  useEffect(() => {
    const fetchHours = async () => {
      try {
        const toRecord = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : null);

        const tryFetchJson = async (url: string) => {
          const res = await fetchWithAuth(url, { method: "GET", headers: { Accept: "application/json" } });
          if (!res.ok) return null;
          return res.json().catch(() => null);
        };

        const pickSupplierPayload = (payload: unknown): Record<string, unknown> | null => {
          if (Array.isArray(payload)) {
            const found = payload.find((x) => {
              const rec = toRecord(x);
              return rec && Number(rec.id) === Number(supplierId);
            });
            return toRecord(found ?? payload[0] ?? null);
          }

          const root = toRecord(payload);
          if (!root) return null;

          if (Number(root.id) === Number(supplierId)) return root;

          const dataRec = toRecord(root.data);
          if (dataRec && Number(dataRec.id) === Number(supplierId)) return dataRec;

          const items = root.items ?? root.results;
          if (Array.isArray(items)) {
            const found = items.find((x) => {
              const rec = toRecord(x);
              return rec && Number(rec.id) === Number(supplierId);
            });
            return toRecord(found ?? items[0] ?? null);
          }

          return root;
        };

        const parseBusinessHours = (payload: unknown): BusinessHour[] => {
          if (Array.isArray(payload)) {
            const first = toRecord(payload[0]);
            const looksLikeBusinessHour = first && "day_of_week" in first && "is_closed" in first;
            if (looksLikeBusinessHour) return payload as BusinessHour[];
          }

          const root = pickSupplierPayload(payload);
          if (!root) return [];

          const direct = root.business_hours;
          if (Array.isArray(direct)) return direct as BusinessHour[];

          const nested = toRecord(root.data)?.business_hours ?? toRecord(root.result)?.business_hours;
          if (Array.isArray(nested)) return nested as BusinessHour[];

          const items = root.items ?? root.results;
          if (Array.isArray(items) && items.length > 0) {
            const first = toRecord(items[0]);
            const bh = first?.business_hours;
            if (Array.isArray(bh)) return bh as BusinessHour[];
          }

          return [];
        };

        const businessHoursUrlsToTry = [
          `/api/suppliers/${supplierId}/business-hours/`,
          `/api/suppliers/${supplierId}/business-hours`,
        ];

        const supplierUrlsToTry = [
          `/api/suppliers/${supplierId}/`,
          `/api/suppliers/${supplierId}`,
          `/api/suppliers/?id=${supplierId}`,
          `/api/suppliers?id=${supplierId}`,
          `/api/suppliers/?skip=0&limit=100&id=${supplierId}`,
          `/api/suppliers?skip=0&limit=100&id=${supplierId}`,
        ];

        let payload: unknown = null;
        for (const url of businessHoursUrlsToTry) {
          payload = await tryFetchJson(url);
          if (payload != null) break;
        }

        if (payload == null) {
          for (const url of supplierUrlsToTry) {
            payload = await tryFetchJson(url);
            if (payload != null) break;
          }
        }

        const businessHours = parseBusinessHours(payload);
        if (payload == null) {
          setError("No se pudieron cargar los horarios (sesión o permisos).");
          setHours([]);
          return;
        }

        if (businessHours.length === 0) {
          setError("No se encontraron horarios en la respuesta del API.");
          setHours(initializeHours([]));
          return;
        }

        setHours(initializeHours(businessHours));
      } catch (err) {
        console.error("Error fetching business hours:", err);
        setError("Error al cargar los horarios");
        setHours([]);
      } finally {
        setLoading(false);
      }
    };

    if (supplierId && token) {
      fetchHours();
    }
  }, [supplierId, token]);

  const handleTimeChange = (dayId: number, field: "open_time" | "close_time", value: string) => {
    setHours((prev) =>
      prev.map((h) =>
        Number((h as unknown as { day_of_week?: unknown }).day_of_week) === dayId ? { ...h, [field]: value } : h
      )
    );
    setSuccess(false);
  };

  const toggleClosed = (dayId: number) => {
    setHours((prev) =>
      prev.map((h) =>
        Number((h as unknown as { day_of_week?: unknown }).day_of_week) === dayId
          ? { ...h, is_closed: !h.is_closed }
          : h
      )
    );
    setSuccess(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Filter out null times for open days to ensure validity
      const payload = hours.map(({ day_of_week, open_time, close_time, is_closed }) => ({
        day_of_week: Number(day_of_week),
        open_time: is_closed ? null : (open_time || "09:00"),
        close_time: is_closed ? null : (close_time || "18:00"),
        is_closed: Boolean(is_closed),
      }));

      await fetchWithAuth(`/api/suppliers/${supplierId}/business-hours`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      setSuccess(true);
      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving business hours:", err);
      setError("Error al guardar los horarios. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Cargando horarios...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="text-primary" size={20} />
            Horarios de Atención
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Configura los días y horas en que tu negocio está abierto.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 text-sm mb-4 border border-red-100">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-600 p-4 rounded-lg flex items-center gap-2 text-sm mb-4 border border-green-100">
          <CheckCircle size={18} />
          Horarios actualizados correctamente
        </div>
      )}

      <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-200">
          {DAYS.map((day) => {
            const dayConfig = hours.find((h) => Number((h as unknown as { day_of_week?: unknown }).day_of_week) === day.id);
            const isClosed = dayConfig?.is_closed ?? true;
            const openTime = dayConfig?.open_time || "09:00";
            const closeTime = dayConfig?.close_time || "18:00";

            return (
              <div key={day.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white transition-colors">
                <div className="flex items-center gap-4 min-w-[150px]">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={!isClosed}
                      onChange={() => toggleClosed(day.id)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                  <span className={`font-medium ${isClosed ? "text-gray-400" : "text-gray-900"}`}>
                    {day.label}
                  </span>
                </div>

                <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-end">
                  {isClosed ? (
                    <span className="text-gray-400 text-sm italic py-2 px-4 bg-gray-100 rounded-md w-full sm:w-auto text-center">
                      Cerrado
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={openTime}
                        onChange={(e) => handleTimeChange(day.id, "open_time", e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                      <span className="text-gray-400">-</span>
                      <input
                        type="time"
                        value={closeTime}
                        onChange={(e) => handleTimeChange(day.id, "close_time", e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-white font-bold py-3 px-8 rounded-lg hover:bg-primary/90 transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Guardando...
            </>
          ) : (
            "Guardar"
          )}
        </button>
      </div>
    </div>
  );
}

function CheckCircle({ size = 24 }: { size?: number }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  );
}
