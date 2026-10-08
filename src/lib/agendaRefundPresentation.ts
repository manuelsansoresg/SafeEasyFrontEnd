import type { AgendaPaymentStatus } from "@/types/agenda";
import type { AgendaBookingStatus, AgendaRefundStatus, AgendaRefundType } from "@/types/agendaBooking";

type RefundState = { id: number; status: AgendaRefundStatus; refund_type?: AgendaRefundType | null };

const green = "border-green-200 bg-green-50 text-green-700";
const amber = "border-amber-200 bg-amber-50 text-amber-900";
const red = "border-red-200 bg-red-50 text-red-700";
const gray = "border-gray-200 bg-gray-50 text-gray-700";

function typeOf(refund: RefundState): AgendaRefundType {
  return refund.refund_type ?? "unknown";
}

export function hasProcessingAgendaRefund(refunds: ReadonlyArray<RefundState>): boolean {
  return refunds.some((refund) => refund.status === "pending" || refund.status === "processing");
}

export function didAgendaRefundConfirm(previous: ReadonlyArray<RefundState>, current: ReadonlyArray<RefundState>): boolean {
  return current.some((refund) => typeOf(refund) !== "additional" && refund.status === "confirmed" && previous.some((item) =>
    item.id === refund.id && (item.status === "pending" || item.status === "processing"),
  ));
}

export function getAgendaPaymentNotice(
  bookingStatus: AgendaBookingStatus,
  paymentStatus: AgendaPaymentStatus | null | undefined,
  refunds: ReadonlyArray<RefundState>,
  hasCheckoutReturn: boolean,
): { message: string; classes: string } | null {
  const primary = refunds.filter((refund) => typeOf(refund) === "primary");
  const additional = refunds.filter((refund) => typeOf(refund) === "additional");
  const unknown = refunds.filter((refund) => typeOf(refund) === "unknown");

  if (paymentStatus === "refunded" || primary.some((refund) => refund.status === "confirmed")) {
    return { message: "El pago de tu reservación fue reembolsado.", classes: green };
  }
  if (primary.some((refund) => refund.status === "failed")) {
    return { message: "La devolución del pago de tu reservación requiere seguimiento del negocio.", classes: red };
  }
  if (hasProcessingAgendaRefund(primary)) {
    return { message: "Tu reservación fue cancelada y estamos gestionando la devolución de tu pago.", classes: amber };
  }
  if (primary.some((refund) => refund.status === "manual_pending")) {
    return { message: "El negocio debe confirmar la devolución de tu pago directo.", classes: amber };
  }

  if (additional.some((refund) => refund.status === "failed")) {
    return { message: "No se pudo completar la devolución del cobro adicional. El negocio debe dar seguimiento.", classes: red };
  }
  if (hasProcessingAgendaRefund(additional)) {
    return { message: "Estamos gestionando la devolución de un cobro adicional.", classes: amber };
  }
  if (additional.some((refund) => refund.status === "confirmed")) {
    return { message: paymentStatus === "paid"
      ? "Se devolvió un cobro adicional. El pago de tu reservación sigue confirmado."
      : "Se devolvió un cobro adicional. Consulta el estado del pago de tu reservación abajo.", classes: green };
  }

  if (unknown.length > 0) {
    return { message: "Se registró una devolución. Consulta su estado en el historial.", classes: gray };
  }
  if (bookingStatus === "cancelled") {
    return { message: "Tu reservación fue cancelada.", classes: gray };
  }

  if ((bookingStatus !== "pending" && bookingStatus !== "confirmed") || !hasCheckoutReturn || !paymentStatus) return null;
  if (paymentStatus === "paid") {
    return { message: "Pago confirmado correctamente.", classes: green };
  }
  if (paymentStatus === "pending") {
    return { message: "Estamos confirmando tu pago. Esta pantalla se actualizará automáticamente.", classes: amber };
  }
  if (paymentStatus === "failed" || paymentStatus === "expired") {
    return { message: "El pago no se completó. Consulta el estado actual del pago abajo.", classes: red };
  }
  return null;
}
