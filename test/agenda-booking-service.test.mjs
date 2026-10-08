import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/api") {
      return {
        url: "data:text/javascript,export const fetchWithAuth = (...args) => globalThis.__agendaFetchMock(...args)",
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const { agendaBookingService } = await import("../src/services/agendaBookingService.ts");

test("el cliente invitado consulta devoluciones con su token por el gateway público", async () => {
  const calls = [];
  globalThis.__agendaFetchMock = async (url, options) => {
    calls.push({ url, options });
    return Response.json([{ id: 9, booking_id: 4, status: "pending", mp_payment_id: "mp-1", refund_type: "additional" }]);
  };
  const result = await agendaBookingService.getBookingRefunds(4, "guest-token");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/proxy/public/agenda/bookings/4/refunds?management_token=guest-token");
  assert.equal(calls[0].options.retryOnAuthFailure, false);
  assert.equal(result[0].status, "pending");
  assert.equal(result[0].refund_type, "additional");
  assert.equal(result[0].mp_payment_id, "mp-1");
});

test("el proveedor consulta historiales de citas activas y canceladas sin enviar una acción financiera", async () => {
  const calls = [];
  globalThis.__agendaFetchMock = async (url, options) => {
    calls.push({ url, options });
    return Response.json([{ id: 9, booking_id: Number(url.match(/appointments\/(\d+)/)?.[1]), status: "confirmed", refund_type: "additional" }]);
  };
  const active = await agendaBookingService.providerBookingRefunds(4);
  const cancelled = await agendaBookingService.providerBookingRefunds(5);
  assert.deepEqual(calls.map((call) => call.url), [
    "/proxy/agenda/appointments/4/refunds",
    "/proxy/agenda/appointments/5/refunds",
  ]);
  assert.equal(calls.every((call) => call.options.method === undefined), true);
  assert.equal(active[0].refund_type, "additional");
  assert.equal(cancelled[0].booking_id, 5);
});

test("las acciones del proveedor usan los endpoints y payload existentes", async () => {
  const calls = [];
  globalThis.__agendaFetchMock = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ id: 9, booking_id: 4, status: "confirmed" });
  };
  await agendaBookingService.providerBookingRefunds(4);
  await agendaBookingService.confirmManualRefund(4, 9, "DEV-12345");
  await agendaBookingService.retryRefund(4, 9);
  assert.deepEqual(calls.map((call) => call.url), [
    "/proxy/agenda/appointments/4/refunds",
    "/proxy/agenda/appointments/4/refunds/9/confirm-manual",
    "/proxy/agenda/appointments/4/refunds/9/retry",
  ]);
  assert.equal(calls[1].options.method, "POST");
  assert.deepEqual(JSON.parse(calls[1].options.body), { reference: "DEV-12345" });
  assert.equal(calls[2].options.method, "POST");
});

test("los errores 422 y 500 conservan un mensaje seguro para el modal", async () => {
  globalThis.__agendaFetchMock = async () => Response.json({ detail: "Debe indicar el motivo de cancelación." }, { status: 422 });
  await assert.rejects(
    agendaBookingService.updateProviderStatus(4, { status: "cancelled", cancellation_reason: "Motivo" }),
    (error) => error.status === 422 && error.message === "Debe indicar el motivo de cancelación.",
  );
  globalThis.__agendaFetchMock = async () => Response.json({ detail: "internal-secret" }, { status: 500 });
  await assert.rejects(
    agendaBookingService.retryRefund(4, 9),
    (error) => error.status === 500 && !error.message.includes("internal-secret"),
  );
});
