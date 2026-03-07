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
    return DAYS.map((day) => {
      const existing = existingHours.find((h) => h.day_of_week === day.id);
      if (existing) return existing;
      
      return {
        day_of_week: day.id,
        open_time: "09:00",
        close_time: "18:00",
        is_closed: false,
      };
    });
  };

  useEffect(() => {
    const fetchHours = async () => {
      try {
        const res = await fetchWithAuth(`/api/suppliers/${supplierId}`, {
          method: "GET",
        });
        
        if (res) {
          // Check if the response has business_hours property
          // The API returns the supplier object which contains business_hours array
          const data = res as unknown as { business_hours: BusinessHour[] };
          if (data.business_hours && Array.isArray(data.business_hours)) {
            setHours(initializeHours(data.business_hours));
          } else {
            setHours(initializeHours([]));
          }
        }
      } catch (err) {
        console.error("Error fetching business hours:", err);
        setError("Error al cargar los horarios");
        setHours(initializeHours([]));
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
        h.day_of_week === dayId ? { ...h, [field]: value } : h
      )
    );
    setSuccess(false);
  };

  const toggleClosed = (dayId: number) => {
    setHours((prev) =>
      prev.map((h) =>
        h.day_of_week === dayId ? { ...h, is_closed: !h.is_closed } : h
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
        day_of_week,
        open_time: is_closed ? null : (open_time || "09:00"),
        close_time: is_closed ? null : (close_time || "18:00"),
        is_closed
      }));

      const res = await fetchWithAuth(`/api/suppliers/${supplierId}/business-hours`, {
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
            const dayConfig = hours.find((h) => h.day_of_week === day.id);
            const isClosed = dayConfig?.is_closed ?? false;
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
