import { isSupplierRole, isAdminRole } from "@/lib/currentSupplier";
import type { NotificationItem } from "@/services/notificationService";

const idValue = (value: unknown): string | null => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const id = String(value).trim();
  return /^\d+$/.test(id) && Number(id) > 0 ? id : null;
};

const textValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export function getNotificationDestination(notification: NotificationItem, role?: string): string | null {
  const data = notification.data && typeof notification.data === "object" ? notification.data : {};
  const type = (notification.type || textValue(data.type) || "").toLowerCase();
  const adId = idValue(notification.ad_banner_id ?? data.ad_banner_id);
  if (type === "ad_pending_approval") {
    if (role !== "admin") return null;
    return `/admin/ads?approval_status=PENDING${adId ? `&ad_id=${encodeURIComponent(adId)}` : ""}`;
  }
  if (type === "ad_approved" || type === "ad_rejected") {
    if (role !== "supplier") return null;
    return `/admin/my-ads${adId ? `?ad_id=${encodeURIComponent(adId)}` : ""}`;
  }
  const title = (notification.title || "").toLowerCase();
  const provider = isSupplierRole(role) || isAdminRole(role);
  const bookingId = idValue(notification.booking_id ?? notification.appointment_id ?? data.booking_id ?? data.appointment_id);
  const menuOrderId = idValue(notification.menu_order_id ?? data.menu_order_id);
  const suppliedOrderNumber = textValue(notification.order_number ?? data.order_number);
  const menuOrderNumber = suppliedOrderNumber?.match(/^MENU-[A-Z0-9-]+$/i)?.[0]
    ?? notification.message?.match(/\bMENU-[A-Z0-9-]+\b/i)?.[0]
    ?? null;
  const orderId = idValue(notification.order_id ?? data.order_id);
  const isBooking = Boolean(bookingId) || /agenda|booking|appointment|cita|reservaci[oó]n/.test(`${type} ${title}`);
  const isMenuOrder = /menu[_ -]?order|pedido/.test(`${type} ${title}`) || Boolean(menuOrderId || menuOrderNumber);
  const isOrder = /order|orden|venta/.test(`${type} ${title}`);

  if (isBooking) {
    const id = bookingId
      ?? idValue(notification.title?.match(/#(\d+)/)?.[1])
      ?? idValue(notification.message?.match(/(?:cita|reservaci[oó]n)\s*#(\d+)/i)?.[1]);
    if (!id) return provider ? "/admin/agenda/appointments" : "/client/appointments";
    const requestId = idValue(notification.reschedule_request_id ?? data.reschedule_request_id ?? data.request_id);
    const reschedule = type === 'agenda_reschedule_requested' || type === 'agenda.reschedule_requested' || data.action === 'reschedule';
    return provider
      ? `/admin/agenda/appointments?booking_id=${encodeURIComponent(id)}${reschedule ? `&action=reschedule${requestId ? `&request_id=${encodeURIComponent(requestId)}` : ''}` : ''}`
      : `/agenda/bookings/${encodeURIComponent(id)}`;
  }

  if (isMenuOrder) {
    const providerMenuId = menuOrderId ?? orderId;
    if (provider && providerMenuId) return `/admin/menu/pedidos/${encodeURIComponent(providerMenuId)}`;
    if (provider && menuOrderNumber) return `/admin/menu/pedidos?order_number=${encodeURIComponent(menuOrderNumber)}`;
    if (provider) return "/admin/menu/pedidos";
    if (menuOrderNumber) return `/pedidos/menu/${encodeURIComponent(menuOrderNumber)}`;
    return "/client/menu-orders";
  }

  if (isOrder || orderId) {
    const id = orderId ?? idValue(notification.title?.match(/#(\d+)/)?.[1]);
    if (!id) return provider ? "/admin/orders" : "/client/orders";
    return provider
      ? `/admin/orders/${encodeURIComponent(id)}`
      : `/client/orders/${encodeURIComponent(id)}`;
  }

  return null;
}
