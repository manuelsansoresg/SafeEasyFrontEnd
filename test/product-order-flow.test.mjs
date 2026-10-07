import assert from "node:assert/strict";
import test from "node:test";

import {
  canMarkCustomerNoShow,
  canShowProductDeliveryCode,
  getProductEffectiveStatus,
  isProductNoShowHistory,
  isTerminalOrderState,
  normalizeProductStatusKey,
  productCancelMessage,
  productNoShowMessage,
} from "../src/lib/orderActionRules.ts";

test("normaliza no-show y reconoce todos los cierres", () => {
  assert.equal(normalizeProductStatusKey("customer_no_show"), "no_show");
  assert.equal(normalizeProductStatusKey("no_show"), "no_show");
  for (const key of ["no_show", "cancelled", "refunded", "refund_refunded", "completed", "expired"]) {
    assert.equal(isTerminalOrderState(key), true, key);
  }
});

test("el historial no-show prevalece sobre ready_for_pickup, incluso con estado cancelado", () => {
  const order = { status: "cancelled", payment_status: "refunded", fulfillment_status: "ready_for_pickup" };
  const history = [{ status: "cancelled", event: "customer_no_show" }];
  assert.equal(isProductNoShowHistory(history), true);
  assert.equal(getProductEffectiveStatus(order, history, "ready_for_pickup"), "no_show");
  assert.equal(getProductEffectiveStatus({ ...order, status: "pending" }, [], "ready_for_pickup"), "refund_refunded");
});

test("los estados finales ocultan el código de entrega", () => {
  for (const key of ["no_show", "cancelled", "refunded", "expired"]) {
    assert.equal(canShowProductDeliveryCode({}, key), false, key);
  }
  assert.equal(canShowProductDeliveryCode({ status: "cancelled" }, "ready_for_pickup"), false);
  assert.equal(canShowProductDeliveryCode({ payment_status: "refunded" }, "ready_for_pickup"), false);
});

test("no-show se habilita a los 60 minutos solo para pickup activo", () => {
  const readyAt = "2026-10-06T12:00:00.000Z";
  const now = Date.parse(readyAt) + 60 * 60000;
  const order = { status: "pending", payment_status: "paid", fulfillment_status: "ready_for_pickup", delivery_type: "pickup" };
  assert.equal(canMarkCustomerNoShow(order, "ready_for_pickup", readyAt, now - 1), false);
  assert.equal(canMarkCustomerNoShow(order, "ready_for_pickup", readyAt, now), true);
  const closedKey = getProductEffectiveStatus({ ...order, status: "cancelled" }, [{ event: "customer_no_show" }], "ready_for_pickup");
  assert.equal(canMarkCustomerNoShow(order, closedKey, readyAt, now), false);
  assert.equal(canMarkCustomerNoShow({ ...order, delivery_type: "shipping" }, "ready_for_pickup", readyAt, now), false);
});

test("los mensajes confirman reembolso únicamente según la respuesta", () => {
  assert.equal(productCancelMessage("refunded"), "Orden cancelada y reembolso procesado.");
  assert.equal(productCancelMessage("cancelled"), "Orden cancelada.");
  assert.equal(productNoShowMessage("refunded"), "Pedido marcado como no recogido y reembolso procesado.");
  assert.equal(productNoShowMessage("cancelled"), "Pedido marcado como no recogido.");
});
