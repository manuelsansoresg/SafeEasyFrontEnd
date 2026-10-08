import assert from "node:assert/strict";
import test from "node:test";
import {
  didAgendaRefundConfirm,
  getAgendaPaymentNotice,
  hasProcessingAgendaRefund,
} from "../src/lib/agendaRefundPresentation.ts";

const refund = (status) => ({ id: 7, status });
const notice = (bookingStatus, paymentStatus, refunds, returnParameter = true) =>
  getAgendaPaymentNotice(bookingStatus, paymentStatus, refunds, returnParameter)?.message;

test("el retorno de Mercado Pago refleja los estados actuales de la API", () => {
  assert.equal(notice("confirmed", "paid", [], true), "Pago confirmado correctamente.");
  assert.equal(notice("confirmed", "paid", [], false), undefined);
  assert.equal(notice("completed", "paid", [], true), undefined);
  assert.equal(notice("no_show", "pending", [], true), undefined);
  assert.equal(notice("confirmed", "pending", [], true), "Estamos confirmando tu pago. Esta pantalla se actualizará automáticamente.");
  assert.equal(notice("confirmed", "failed", [], true), "El pago no se completó. Consulta el estado actual del pago abajo.");
  assert.equal(notice("cancelled", "refunded", [refund("confirmed")], true), "Tu pago fue reembolsado.");
  assert.equal(notice("cancelled", "paid", [refund("confirmed")], true), "Tu pago fue reembolsado.");
  assert.equal(notice("cancelled", "paid", [refund("pending")], true), "Tu reservación fue cancelada y estamos gestionando la devolución de tu pago.");
  assert.equal(notice("cancelled", "paid", [refund("processing")], true), "Tu reservación fue cancelada y estamos gestionando la devolución de tu pago.");
  assert.equal(notice("cancelled", "paid", [refund("manual_pending")], true), "Tu reservación fue cancelada. El negocio debe confirmar la devolución de tu pago directo.");
  assert.equal(notice("cancelled", "paid", [refund("failed")], true), "Tu reservación fue cancelada. La devolución requiere seguimiento del negocio.");
  assert.equal(notice("cancelled", "not_required", [], true), "Tu reservación fue cancelada.");
  assert.equal(notice("cancelled", "pending", [], true), "Tu reservación fue cancelada.");
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
  assert.equal(didAgendaRefundConfirm([refund("pending")], [refund("failed")]), false);
  assert.equal(didAgendaRefundConfirm([refund("confirmed")], [refund("confirmed")]), false);
  assert.equal(didAgendaRefundConfirm([refund("pending")], [{ id: 8, status: "confirmed" }]), false);
});
