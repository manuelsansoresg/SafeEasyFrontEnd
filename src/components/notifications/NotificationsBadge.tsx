"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { notificationService, NotificationItem } from "@/services/notificationService";

export default function NotificationsBadge() {
  const [count, setCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const refreshUnreadCount = async () => {
    try {
      const items = await notificationService.getNotifications({ unreadOnly: true });
      setCount(items.length || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las notificaciones.");
    }
  };

  useEffect(() => {
    refreshUnreadCount();
  }, [pathname]);

  useEffect(() => {
    const id = setInterval(refreshUnreadCount, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const id = setInterval(() => {
      loadLatest({ silent: true });
      refreshUnreadCount();
    }, 10000);
    return () => clearInterval(id);
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadLatest = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const list = await notificationService.getNotifications({ limit: 10 });
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las notificaciones.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const toggleOpen = async () => {
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;
    loadLatest();
  }, [isOpen]);

  const markRead = async (id: number | string) => {
    try {
      await notificationService.markRead(id);
      setItems((prev) =>
        prev.map((n) =>
          String(n.id) === String(id) ? { ...n, is_read: true, read: true } : n
        )
      );
      refreshUnreadCount();
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

  const truncate = (value: string, max = 60) => {
    const raw = String(value || "").trim();
    if (raw.length <= max) return raw;
    return `${raw.slice(0, max - 1)}…`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        aria-label="Notificaciones"
        onClick={toggleOpen}
        className="relative flex items-center justify-center h-10 px-2 text-white hover:text-[#7ed957] transition-all"
      >
        <Bell size={20} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#168E00] text-white text-[10px] font-bold flex items-center justify-center">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] md:w-96 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right">
          <div className="p-4 flex items-center justify-between border-b border-gray-50">
            <div>
              <h3 className="font-bold text-xl text-gray-900">Notificaciones</h3>
              <p className="text-xs text-gray-500">Últimas 10 alertas</p>
            </div>
            <button
              onClick={() => {
                loadLatest();
                refreshUnreadCount();
              }}
              className="inline-flex items-center px-3 py-1 text-xs rounded-full border border-[#168E00] text-[#168E00] hover:bg-[#168E00]/10"
            >
              Actualizar
            </button>
          </div>

          <div className="px-4 py-2">
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

          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-400">
                <div className="w-6 h-6 border-2 border-[#168E00] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span className="text-xs">Cargando...</span>
              </div>
            ) : error ? (
              <div className="p-8 text-center text-sm text-red-600">
                <p>{error}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
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
                      setIsOpen(false);
                      if (n.order_id) {
                        router.push(`/client/orders/${encodeURIComponent(String(n.order_id))}?focus=delivery-code`);
                      }
                    }}
                    className={`flex items-start gap-3 p-3 transition-colors rounded-lg cursor-pointer ${
                      isRead ? "hover:bg-gray-50" : "bg-[#E8F5E9] hover:bg-[#DCF8C6]"
                    }`}
                  >
                    <div
                      className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
                        isRead ? "bg-gray-300" : "bg-[#168E00]"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 text-[15px] truncate">
                        {n.title || "Notificación"}
                      </h4>
                      <p className="text-[13px] text-gray-500 truncate">
                        {truncate(n.message || "", 80) || " "}
                      </p>
                    </div>
                  </div>
                );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
