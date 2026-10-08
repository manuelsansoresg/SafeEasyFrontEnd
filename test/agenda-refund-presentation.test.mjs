import assert from "node:assert/strict";
import test from "node:test";
import {
  didAgendaRefundConfirm,
  getAgendaPaymentNotice,
  hasProcessingAgendaRefund,
} from "../src/lib/agendaRefundPresentation.ts";

const refund = (status, refund_type = "primary", id = 7) => ({ id, status, refund_type });
const notice = (bookingStatus, paymentStatus, refunds, returnParameter = true) =>
  getAgendaPaymentNotice(bookingStatus, paymentStatus, refunds, returnParameter)?.message;

test("el retorno de Mercado Pago refleja los estados actuales de la API", () => {
  assert.equal(notice("confirmed", "paid", [], true), "Pago confirmado correctamente.");
  assert.equal(notice("confirmed", "paid", [], false), undefined);
  assert.equal(notice("completed", "paid", [], true), undefined);
  assert.equal(notice("no_show", "pending", [], true), undefined);
  assert.equal(notice("confirmed", "pending", [], true), "Estamos confirmando tu pago. Esta pantalla se actualizará automáticamente.");
  assert.equal(notice("confirmed", "failed", [], true), "El pago no se completó. Consulta el estado actual del pago abajo.");
  assert.equal(notice("cancelled", "refunded", [refund("confirmed")], true), "El pago de tu reservación fue reembolsado.");
  assert.equal(notice("cancelled", "paid", [refund("confirmed")], true), "El pago de tu reservación fue reembolsado.");
  assert.equal(notice("cancelled", "paid", [refund("pending")], true), "Tu reservación fue cancelada y estamos gestionando la devolución de tu pago.");
  assert.equal(notice("cancelled", "paid", [refund("processing")], true), "Tu reservación fue cancelada y estamos gestionando la devolución de tu pago.");
  assert.equal(notice("cancelled", "paid", [refund("manual_pending")], true), "El negocio debe confirmar la devolución de tu pago directo.");
  assert.equal(notice("cancelled", "paid", [refund("failed")], true), "La devolución del pago de tu reservación requiere seguimiento del negocio.");
  assert.equal(notice("cancelled", "not_required", [], true), "Tu reservación fue cancelada.");
  assert.equal(notice("cancelled", "pending", [], true), "Tu reservación fue cancelada.");
});

test("un cobro adicional devuelto conserva el pago principal y la cita activos", () => {
  assert.equal(notice("confirmed", "paid", [refund("confirmed", "additional")]), "Se devolvió un cobro adicional. El pago de tu reservación sigue confirmado.");
  assert.equal(notice("confirmed", "paid", [refund("pending", "additional")]), "Estamos gestionando la devolución de un cobro adicional.");
  assert.equal(notice("confirmed", "paid", [refund("processing", "additional")]), "Estamos gestionando la devolución de un cobro adicional.");
  assert.equal(notice("confirmed", "paid", [refund("failed", "additional")]), "No se pudo completar la devolución del cobro adicional. El negocio debe dar seguimiento.");
  assert.equal(notice("cancelled", "paid", [refund("confirmed", "additional")]), "Se devolvió un cobro adicional. El pago de tu reservación sigue confirmado.");
});

test("desconocidos y respuestas antiguas no se interpretan como reembolso principal", () => {
  const cautious = "Se registró una devolución. Consulta su estado en el historial.";
  assert.equal(notice("confirmed", "paid", [refund("confirmed", "unknown")]), cautious);
  assert.equal(notice("cancelled", "paid", [{ id: 7, status: "confirmed" }]), cautious);
  assert.equal(notice("confirmed", "paid", [refund("pending", "unknown")]), cautious);
});

test("varias devoluciones priorizan el pago principal y las operaciones sin resolver", () => {
  assert.equal(notice("cancelled", "refunded", [refund("confirmed", "primary"), refund("failed", "additional", 8)]), "El pago de tu reservación fue reembolsado.");
  assert.equal(notice("cancelled", "paid", [refund("pending", "primary"), refund("confirmed", "additional", 8)]), "Tu reservación fue cancelada y estamos gestionando la devolución de tu pago.");
  assert.equal(notice("confirmed", "paid", [refund("confirmed", "additional"), refund("failed", "additional", 8)]), "No se pudo completar la devolución del cobro adicional. El negocio debe dar seguimiento.");
});

test("el sondeo sólo permanece activo para devoluciones en proceso", () => {
  assert.equal(hasProcessingAgendaRefund([]), false);
  assert.equal(hasProcessingAgendaRefund([refund("pending")]), true);
  assert.equal(hasProcessingAgendaRefund([refund("processing")]), true);
  for (const status of ["confirmed", "failed", "manual_pending"]) {
    assert.equal(hasProcessingAgendaRefund([refund(status)]), false, status);
  }
});

test("la transición confirmada identifica cuándo refrescar el pago", () => {
  assert.equal(didAgendaRefundConfirm([refund("pending")], [refund("confirmed")]), true);
  assert.equal(didAgendaRefundConfirm([refund("processing")], [refund("confirmed")]), true);
  assert.equal(didAgendaRefundConfirm([refund("pending", "additional")], [refund("confirmed", "additional")]), false);
  assert.equal(didAgendaRefundConfirm([{ id: 7, status: "pending" }], [{ id: 7, status: "confirmed" }]), true);
  assert.equal(didAgendaRefundConfirm([refund("pending")], [refund("failed")]), false);
  assert.equal(didAgendaRefundConfirm([refund("confirmed")], [refund("confirmed")]), false);
  assert.equal(didAgendaRefundConfirm([refund("pending")], [{ id: 8, status: "confirmed" }]), false);
});
