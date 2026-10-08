import type { AgendaPaymentStatus } from "@/types/agenda";
import type { AgendaBookingStatus, AgendaRefundStatus } from "@/types/agendaBooking";

type RefundState = { id: number; status: AgendaRefundStatus };

export function hasProcessingAgendaRefund(refunds: ReadonlyArray<RefundState>): boolean {
  return refunds.some((refund) => refund.status === "pending" || refund.status === "processing");
}

export function didAgendaRefundConfirm(previous: ReadonlyArray<RefundState>, current: ReadonlyArray<RefundState>): boolean {
  return current.some((refund) => refund.status === "confirmed" && previous.some((item) =>
    item.id === refund.id && (item.status === "pending" || item.status === "processing"),
  ));
}

export function getAgendaPaymentNotice(
  bookingStatus: AgendaBookingStatus,
  paymentStatus: AgendaPaymentStatus | null | undefined,
  refunds: ReadonlyArray<RefundState>,
  hasCheckoutReturn: boolean,
): { message: string; classes: string } | null {
  if (paymentStatus === "refunded" || refunds.some((refund) => refund.status === "confirmed")) {
    return { message: "Tu pago fue reembolsado.", classes: "border-green-200 bg-green-50 text-green-700" };
  }

  if (bookingStatus === "cancelled") {
    if (refunds.some((refund) => refund.status === "failed")) {
      return { message: "Tu reservación fue cancelada. La devolución requiere seguimiento del negocio.", classes: "border-red-200 bg-red-50 text-red-700" };
    }
    if (hasProcessingAgendaRefund(refunds)) {
      return { message: "Tu reservación fue cancelada y estamos gestionando la devolución de tu pago.", classes: "border-amber-200 bg-amber-50 text-amber-900" };
    }
    if (refunds.some((refund) => refund.status === "manual_pending")) {
      return { message: "Tu reservación fue cancelada. El negocio debe confirmar la devolución de tu pago directo.", classes: "border-amber-200 bg-amber-50 text-amber-900" };
    }
    return { message: "Tu reservación fue cancelada.", classes: "border-gray-200 bg-gray-50 text-gray-700" };
  }

  if ((bookingStatus !== "pending" && bookingStatus !== "confirmed") || !hasCheckoutReturn || !paymentStatus) return null;
  if (paymentStatus === "paid") {
    return { message: "Pago confirmado correctamente.", classes: "border-green-200 bg-green-50 text-green-700" };
  }
  if (paymentStatus === "pending") {
    return { message: "Estamos confirmando tu pago. Esta pantalla se actualizará automáticamente.", classes: "border-amber-200 bg-amber-50 text-amber-900" };
  }
  if (paymentStatus === "failed" || paymentStatus === "expired") {
    return { message: "El pago no se completó. Consulta el estado actual del pago abajo.", classes: "border-red-200 bg-red-50 text-red-700" };
  }
  return null;
}
