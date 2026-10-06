import assert from "node:assert/strict";
import test from "node:test";

import {
  menuOrderAwaitingHandoff,
  menuOrderNeedsCode,
  menuProviderPaymentStatusLabel,
} from "../src/lib/menuOrderFlow.ts";
import { getSafeMercadoPagoUrl } from "../src/lib/security.ts";
import { MENU_CANCEL_STATUSES, MENU_REFUND_STATUSES, PRODUCT_CANCEL_STATUSES, PRODUCT_REFUND_STATUSES, canRequestAnotherRefund, elapsedMinutes } from "../src/lib/orderActionRules.ts";

const preferenceOrder = {
  payment_method: "online",
  payment_flow: "preference",
  payment_status: "paid",
  settlement_status: "on_hold",
  status: "ready",
};

test("un pedido Preference pagado espera el código en pickup y delivery", () => {
  for (const fulfillmentType of ["pickup", "delivery"]) {
    const order = { ...preferenceOrder, fulfillment_type: fulfillmentType };
    assert.equal(menuOrderAwaitingHandoff(order), true);
    assert.equal(menuOrderNeedsCode(order), true);
    assert.equal(menuProviderPaymentStatusLabel(order), "Pago recibido · pendiente de entrega");
  }
});

test("el código sólo se confirma al estar listo y antes de liberar la venta", () => {
  assert.equal(menuOrderNeedsCode({ ...preferenceOrder, status: "preparing" }), false);
  assert.equal(menuOrderNeedsCode({ ...preferenceOrder, payment_status: "pending" }), false);
  assert.equal(menuOrderNeedsCode({ ...preferenceOrder, settlement_status: "released", status: "completed" }), false);
  assert.equal(menuProviderPaymentStatusLabel({ ...preferenceOrder, settlement_status: "released", status: "completed" }), "Pago confirmado · venta completada");
});

test("pedidos históricos con autorización conservan el código", () => {
  const legacy = { ...preferenceOrder, payment_flow: "card_authorization", payment_status: "authorized" };
  assert.equal(menuOrderNeedsCode(legacy), true);
  assert.equal(menuOrderAwaitingHandoff({ ...legacy, settlement_status: "released" }), false);
  assert.equal(menuOrderNeedsCode({ ...legacy, payment_method: "cash" }), false);
});

test("sólo se aceptan enlaces HTTPS de Mercado Pago para salir al checkout", () => {
  const checkout = "https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=123";
  assert.equal(getSafeMercadoPagoUrl(checkout), checkout);
  assert.equal(getSafeMercadoPagoUrl("https://mercadopago.com.mx.ejemplo.com/checkout"), "");
  assert.equal(getSafeMercadoPagoUrl("http://www.mercadopago.com.mx/checkout"), "");
  assert.equal(getSafeMercadoPagoUrl(null), "");
});

test("reembolsado y no recogido no habilitan el código ni indican pago pendiente", () => {
  assert.equal(menuOrderAwaitingHandoff({ ...preferenceOrder, payment_status: "refunded" }), false);
  assert.equal(menuOrderNeedsCode({ ...preferenceOrder, payment_status: "refunded" }), false);
  assert.equal(menuOrderNeedsCode({ ...preferenceOrder, status: "no_show" }), false);
  assert.equal(menuProviderPaymentStatusLabel({ ...preferenceOrder, payment_status: "refunded" }), "Reembolsado");
  assert.equal(menuProviderPaymentStatusLabel({ ...preferenceOrder, status: "no_show", settlement_status: "released" }), "Pago recibido · pedido no recogido");
});

test("acciones de menú respetan estados y no duplican reembolsos activos", () => {
  assert.deepEqual([...MENU_CANCEL_STATUSES], ["pending", "confirmed"]);
  assert.deepEqual([...MENU_REFUND_STATUSES], ["preparing", "ready", "completed", "no_show"]);
  assert.equal(canRequestAnotherRefund("requested"), false);
  assert.equal(canRequestAnotherRefund("approved"), false);
  assert.equal(canRequestAnotherRefund("refunded"), false);
  assert.equal(canRequestAnotherRefund("rejected"), true);
});

test("los límites de 15 y 60 minutos sólo cambian disponibilidad visual", () => {
  const created = "2026-10-06T12:00:00.000Z";
  const start = Date.parse(created);
  assert.equal(elapsedMinutes(created, 15, start + 14 * 60000), false);
  assert.equal(elapsedMinutes(created, 15, start + 15 * 60000), true);
  assert.equal(elapsedMinutes(created, 60, start + 59 * 60000), false);
  assert.equal(elapsedMinutes(created, 60, start + 60 * 60000), true);
  assert.equal(elapsedMinutes(null, 60, start + 120 * 60000), false);
});

test("productos cancelan antes de la entrega y solicitan reembolso después", () => {
  assert.deepEqual([...PRODUCT_CANCEL_STATUSES], ["pending", "preparing", "ready_for_pickup"]);
  for (const status of ["picked_up", "out_for_delivery", "delivered", "completed"]) {
    assert.equal(PRODUCT_CANCEL_STATUSES.includes(status), false);
    assert.equal(PRODUCT_REFUND_STATUSES.includes(status), true);
  }
});
