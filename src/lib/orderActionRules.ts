export const MENU_CANCEL_STATUSES = ["pending", "confirmed"] as const;
export const MENU_REFUND_STATUSES = ["preparing", "ready", "completed", "no_show"] as const;
export const PRODUCT_CANCEL_STATUSES = ["pending", "preparing", "ready_for_pickup"] as const;
export const PRODUCT_REFUND_STATUSES = ["en_route_to_pickup", "picked_up", "in_transit", "out_for_delivery", "delivered", "completed"] as const;

export function normalizeProductStatusKey(value: unknown): string {
  const key = String(value ?? "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "_");
  if (key === "customer_no_show" || key === "no_show") return "no_show";
  if (["refunded", "refund_refunded", "reembolsado"].includes(key)) return "refund_refunded";
  if (key === "cancelado") return "cancelled";
  return key;
}

export function isTerminalOrderState(value: unknown): boolean {
  return ["completed", "cancelled", "refund_refunded", "no_show", "expired"].includes(normalizeProductStatusKey(value));
}

type ProductHistoryEvent = { status?: string; event?: string; action?: string; description?: string; message?: string };

export function isProductNoShowHistory(history: ProductHistoryEvent[]): boolean {
  return history.some((item) => [item.event, item.action, item.status, item.description, item.message]
    .some((value) => normalizeProductStatusKey(value) === "no_show"));
}

export function getProductEffectiveStatus(order: {
  status?: string; payment_status?: string; fulfillment_status?: string; visual_status?: string;
}, history: ProductHistoryEvent[], historyKey: string): string {
  if (isProductNoShowHistory(history)) return "no_show";
  const status = normalizeProductStatusKey(order.status);
  const payment = normalizeProductStatusKey(order.payment_status);
  const fulfillment = normalizeProductStatusKey(order.fulfillment_status);
  const visual = normalizeProductStatusKey(order.visual_status);
  if (payment === "refund_refunded" || visual === "refund_refunded") return "refund_refunded";
  if (status === "cancelled" || status === "expired") return status;
  if (isTerminalOrderState(fulfillment)) return fulfillment;
  if (fulfillment && !["pending", "created", "authorized", "paid"].includes(fulfillment)) return fulfillment;
  return normalizeProductStatusKey(historyKey || fulfillment || visual || payment || status || "pending");
}

export function canShowProductDeliveryCode(order: { status?: string; payment_status?: string }, effectiveKey: string): boolean {
  return !isTerminalOrderState(effectiveKey) &&
    !isTerminalOrderState(order.status) &&
    normalizeProductStatusKey(order.payment_status) !== "refund_refunded";
}

export function canMarkCustomerNoShow(order: { status?: string; payment_status?: string; fulfillment_status?: string; delivery_type?: string }, effectiveKey: string, readyAt: string | undefined, now: number): boolean {
  return order.delivery_type === "pickup" &&
    normalizeProductStatusKey(order.fulfillment_status) === "ready_for_pickup" &&
    canShowProductDeliveryCode(order, effectiveKey) &&
    elapsedMinutes(readyAt, 60, now);
}

export function productCancelMessage(paymentStatus?: string): string {
  return normalizeProductStatusKey(paymentStatus) === "refund_refunded"
    ? "Orden cancelada y reembolso procesado."
    : "Orden cancelada.";
}

export function productNoShowMessage(paymentStatus?: string): string {
  return normalizeProductStatusKey(paymentStatus) === "refund_refunded"
    ? "Pedido marcado como no recogido y reembolso procesado."
    : "Pedido marcado como no recogido.";
}

export function canRequestAnotherRefund(status?: string | null): boolean {
  return !["requested", "approved", "refunded"].includes(status || "");
}

export function elapsedMinutes(timestamp: string | null | undefined, minutes: number, now: number): boolean {
  if (!timestamp) return false;
  const then = Date.parse(timestamp);
  return Number.isFinite(then) && now >= then + minutes * 60000;
}
