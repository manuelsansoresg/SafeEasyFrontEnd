"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isNotificationRead, NOTIFICATIONS_CHANGED_EVENT, notificationService, NotificationItem } from "@/services/notificationService";
import { createPortal } from "react-dom";
import { useChatInboxWebSocket } from "@/hooks/useChatWebSocket";
import { useInboxReconnect } from "@/hooks/useInboxReconnect";
import { useAuthHydrated, useAuthStore } from "@/store/useAuthStore";
import { useChatStore } from "@/store/useChatStore";
import { getNotificationDestination } from "@/lib/notificationDestination";

export default function NotificationsBadge() {
  const [count, setCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((state) => state.token);
  const userId = useAuthStore((state) => state.user?.id);
  const userRole = useAuthStore((state) => state.user?.role);
  const enabled = hydrated && Boolean(token) && Boolean(userId);
  const unreadRequest = useRef<Promise<void> | null>(null);
  const unreadQueued = useRef(false);
  const sessionSequence = useRef(0);
  const subscribeToInboxEvents = useChatStore((state) => state.subscribeToInboxEvents);
  const { status: inboxStatus } = useChatInboxWebSocket(enabled);

  const refreshUnreadCount = useCallback((silent = false): Promise<void> => {
    if (!enabled) return Promise.resolve();
    if (unreadRequest.current) {
      unreadQueued.current = true;
      return unreadRequest.current;
    }
    const sequence = sessionSequence.current;
    const request = (async () => {
      do {
        unreadQueued.current = false;
        try {
          const list = await notificationService.getNotifications({ unreadOnly: true });
          if (sequence === sessionSequence.current) {
            setCount(list.filter((notification) => !isNotificationRead(notification)).length);
          }
        } catch (e) {
          if (!silent && sequence === sessionSequence.current) {
            setError(e instanceof Error ? e.message : "No se pudieron cargar las notificaciones.");
          }
        }
      } while (unreadQueued.current && sequence === sessionSequence.current);
    })();
    unreadRequest.current = request;
    void request.finally(() => {
      if (unreadRequest.current === request) unreadRequest.current = null;
    });
    return request;
  }, [enabled]);

  useEffect(() => {
    setCount(0);
    setItems([]);
    setError(null);
    if (enabled) void refreshUnreadCount();
    else setIsOpen(false);
    return () => {
      sessionSequence.current += 1;
      unreadQueued.current = false;
      unreadRequest.current = null;
    };
  }, [enabled, userId, refreshUnreadCount]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        !dropdownRef.current?.contains(event.target as Node) &&
        !panelRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const handleNotificationsChanged = () => void refreshUnreadCount(true);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged);
    window.addEventListener("focus", handleNotificationsChanged);
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged);
      window.removeEventListener("focus", handleNotificationsChanged);
    };
  }, [enabled, refreshUnreadCount]);

  const loadLatest = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!enabled) return;
    const sequence = sessionSequence.current;
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      const [recent, unread] = await Promise.all([
        notificationService.getNotifications({ limit: 10 }),
        notificationService.getNotifications({ unreadOnly: true }),
      ]);
      if (sequence !== sessionSequence.current) return;
      const unreadItems = unread.filter((notification) => !isNotificationRead(notification));
      const unreadIds = new Set(unreadItems.map((notification) => String(notification.id)));
      setItems([
        ...unreadItems,
        ...recent.filter((notification) => !unreadIds.has(String(notification.id))),
      ].slice(0, 10));
      setCount(unreadItems.length);
      setError(null);
    } catch (e) {
      if (sequence !== sessionSequence.current) return;
      if (!silent) setError(e instanceof Error ? e.message : "No se pudieron cargar las notificaciones.");
    } finally {
      if (!silent && sequence === sessionSequence.current) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = subscribeToInboxEvents((event) => {
      if (event.type !== "notification.created") return;
      if (isOpen) void loadLatest({ silent: true });
      else void refreshUnreadCount(true);
    });
    return unsubscribe;
  }, [enabled, isOpen, loadLatest, refreshUnreadCount, subscribeToInboxEvents]);

  const resyncAfterReconnect = useCallback(() => {
    if (isOpen) void loadLatest({ silent: true });
    else void refreshUnreadCount(true);
  }, [isOpen, loadLatest, refreshUnreadCount]);
  useInboxReconnect(inboxStatus, enabled, resyncAfterReconnect);

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen || !enabled) return;
    void loadLatest();
  }, [enabled, isOpen, loadLatest]);

  const markRead = async (id: number | string): Promise<void> => {
    if (!enabled) return;
    try {
      await notificationService.markRead(id);
      setItems((prev) =>
        prev.map((n) =>
          String(n.id) === String(id) ? { ...n, is_read: true, read: true } : n
        )
      );
    } catch (e) {
      setActionMessage(e instanceof Error ? e.message : "No se pudo marcar la notificación como leída.");
    }
  };

  const openNotification = async (notification: NotificationItem) => {
    setActionMessage(null);
    const destination = getNotificationDestination(notification, userRole);
    if (!isNotificationRead(notification)) await markRead(notification.id);
    if (destination) {
      setIsOpen(false);
      router.push(destination);
    } else {
      setActionMessage("Esta notificación no tiene un destino disponible.");
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
        type="button"
        aria-label="Notificaciones"
        aria-expanded={isOpen}
        aria-controls="notifications-panel"
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

      {isOpen && (typeof document !== "undefined" ? createPortal(
        <div ref={panelRef} id="notifications-panel" className="fixed left-4 right-4 top-[calc(5rem+0.75rem)] max-h-[calc(100dvh-6.5rem)] overflow-y-auto md:left-auto md:right-4 md:w-96 xl:top-[calc(6rem+0.75rem)] xl:max-h-[calc(100dvh-7.5rem)] bg-white rounded-xl shadow-lg border border-gray-100 z-[10050] animate-in fade-in zoom-in-95 duration-100 origin-top-left md:origin-top-right">
          <div className="p-4 flex items-center justify-between border-b border-gray-50">
            <div>
              <h3 className="font-bold text-xl text-gray-900">Notificaciones</h3>
              <p className="text-xs text-gray-500">No leídas y recientes</p>
            </div>
            <button
              onClick={() => {
                loadLatest();
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

          {actionMessage && <p role="status" className="px-4 py-2 text-xs text-amber-700">{actionMessage}</p>}

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
                const isRead = isNotificationRead(n);
                return (
                  <button
                    type="button"
                    key={String(n.id)}
                    onClick={() => void openNotification(n)}
                    className={`w-full text-left flex items-start gap-3 p-3 transition-colors rounded-lg focus-visible:outline-2 focus-visible:outline-[#168E00] ${
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
                  </button>
                );
                })}
              </div>
            )}
          </div>
          <Link
            href="/client/notifications"
            onClick={() => setIsOpen(false)}
            className="block border-t border-gray-100 px-4 py-3 text-center text-sm font-semibold text-[#168e00] hover:bg-[#f2f3f4]"
          >
            Ver todas las notificaciones
          </Link>
        </div>,
        document.body
      ) : null)}
    </div>
  );
}
