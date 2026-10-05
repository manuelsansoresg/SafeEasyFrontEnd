import assert from "node:assert/strict";
import test from "node:test";

import {
  menuOrderAwaitingHandoff,
  menuOrderNeedsCode,
  menuProviderPaymentStatusLabel,
} from "../src/lib/menuOrderFlow.ts";
import { getSafeMercadoPagoUrl } from "../src/lib/security.ts";

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
