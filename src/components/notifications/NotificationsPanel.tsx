"use client";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { notificationService, NotificationItem } from "@/services/notificationService";

export default function NotificationsPanel() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const router = useRouter();

  const truncate = (value: string, max = 90) => {
    const raw = String(value || "").trim();
    if (raw.length <= max) return raw;
    return `${raw.slice(0, max - 1)}…`;
  };

  const load = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const list = await notificationService.getNotifications();
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las notificaciones.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const id = setInterval(() => load({ silent: true }), 10000);
    return () => clearInterval(id);
  }, []);

  const markRead = async (id: number | string) => {
    try {
      await notificationService.markRead(id);
      setItems((prev) =>
        prev.map((n) =>
          String(n.id) === String(id) ? { ...n, is_read: true, read: true } : n
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo marcar la notificación como leída.");
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((n) => {
      const t = String(n.title || "").toLowerCase();
      const m = String(n.message || "").toLowerCase();
      return t.includes(q) || m.includes(q);
    });
  }, [items, query]);

  return (
    <div className="w-full md:max-w-2xl md:mx-auto">
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-gray-50">
          <div>
            <h2 className="font-bold text-xl text-gray-900">Notificaciones</h2>
            <p className="text-xs text-gray-500">Tus alertas recientes</p>
          </div>
          <button
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center px-3 py-1 text-xs rounded-full border border-[#168E00] text-[#168E00] hover:bg-[#168E00]/10"
          >
            Actualizar
          </button>
        </div>

        <div className="px-4 py-2 border-b border-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Buscar en Notificaciones"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-gray-100 rounded-full py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#168E00]/20 transition-all"
            />
          </div>
        </div>

        <div className="max-h-[70vh] md:max-h-[520px] overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-3 animate-pulse">
              <div className="h-14 bg-gray-100 rounded-lg" />
              <div className="h-14 bg-gray-100 rounded-lg" />
              <div className="h-14 bg-gray-100 rounded-lg" />
              <div className="h-14 bg-gray-100 rounded-lg" />
            </div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-red-600">
              <p>{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <p>No tienes notificaciones por ahora.</p>
            </div>
          ) : (
            <div className="space-y-2 px-2 py-2">
              {filtered.map((n) => {
                const isRead = (n.is_read ?? n.read) === true;
                return (
                  <div
                    key={String(n.id)}
                    onClick={async () => {
                      await markRead(n.id);
                      if (n.order_id) {
                        router.push(`/client/orders/${encodeURIComponent(String(n.order_id))}?focus=delivery-code`);
                      }
                    }}
                    className={`rounded-lg cursor-pointer transition-colors px-3 py-3 flex items-start gap-3 ${
                      isRead ? "hover:bg-gray-50" : "bg-[#E8F5E9] hover:bg-[#DCF8C6]"
                    }`}
                  >
                    <div
                      className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
                        isRead ? "bg-gray-300" : "bg-[#168E00]"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-gray-900 text-[15px] truncate">
                        {n.title || "Notificación"}
                      </div>
                      <div className="text-[13px] text-gray-500 truncate">
                        {truncate(n.message || "") || " "}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
