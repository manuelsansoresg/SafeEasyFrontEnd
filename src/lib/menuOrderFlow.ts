import type { MenuOrder } from "@/types/menuOrder";

type PaymentState = Pick<MenuOrder, "payment_method" | "payment_flow" | "payment_status" | "settlement_status" | "status">;

export function menuOrderAwaitingHandoff(order: PaymentState | null): boolean {
  return order?.payment_method === "online" && !["cancelled", "no_show", "completed"].includes(order.status) && order.payment_status !== "refunded" && order.settlement_status === "on_hold" && (
    (order.payment_flow === "preference" && order.payment_status === "paid") ||
    (order.payment_flow === "card_authorization" && order.payment_status === "authorized")
  );
}

export function menuOrderNeedsCode(order: PaymentState): boolean {
  return order.status === "ready" && menuOrderAwaitingHandoff(order);
}

export function menuProviderPaymentStatusLabel(order: PaymentState): string {
  if (order.payment_status === "refunded") return "Reembolsado";
  if (order.payment_status === "paid" && order.settlement_status === "on_hold") return "Pago recibido · pendiente de entrega";
  if (order.payment_status === "paid" && order.settlement_status === "released" && order.status === "completed") return "Pago confirmado · venta completada";
  if (order.payment_status === "paid" && order.settlement_status === "released" && order.status === "no_show") return "Pago recibido · pedido no recogido";
  if (order.payment_status === "paid") return "Pago recibido";
  if (order.payment_status === "authorized") return "Pago autorizado; pendiente de entrega";
  if (order.payment_status === "failed") return "Pago fallido";
  if (order.payment_status === "cancelled") return "Pago cancelado";
  return "Pendiente de pago";
}
