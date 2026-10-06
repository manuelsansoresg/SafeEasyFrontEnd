export const MENU_CANCEL_STATUSES = ["pending", "confirmed"] as const;
export const MENU_REFUND_STATUSES = ["preparing", "ready", "completed", "no_show"] as const;
export const PRODUCT_CANCEL_STATUSES = ["pending", "preparing", "ready_for_pickup"] as const;
export const PRODUCT_REFUND_STATUSES = ["en_route_to_pickup", "picked_up", "in_transit", "out_for_delivery", "delivered", "completed"] as const;

export function canRequestAnotherRefund(status?: string | null): boolean {
  return !["requested", "approved", "refunded"].includes(status || "");
}

export function elapsedMinutes(timestamp: string | null | undefined, minutes: number, now: number): boolean {
  if (!timestamp) return false;
  const then = Date.parse(timestamp);
  return Number.isFinite(then) && now >= then + minutes * 60000;
}
