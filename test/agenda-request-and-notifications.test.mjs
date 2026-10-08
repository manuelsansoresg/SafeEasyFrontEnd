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

const { isExpectedAbort, isHttpConflict } = await import("../src/lib/agendaRequest.ts");
const { agendaBookingService } = await import("../src/services/agendaBookingService.ts");
const { notificationService } = await import("../src/services/notificationService.ts");

test("solo se ignoran cancelaciones reconocibles", () => {
  assert.equal(isExpectedAbort(new DOMException("aborted", "AbortError")), true);
  assert.equal(isExpectedAbort(new Error("Fetch is aborted")), true);
  assert.equal(isExpectedAbort(new Error("Network request failed")), false);
  assert.equal(isExpectedAbort(new Error("Server error")), false);
  const controller = new AbortController();
  controller.abort();
  assert.equal(isExpectedAbort(new TypeError("fetch failed"), controller.signal), true);
  assert.equal(isHttpConflict({ status: 409 }), true);
  assert.equal(isHttpConflict({ status: 500 }), false);
});

test("el listado de notificaciones usa la ruta con barra final y conserva listas vacías", async () => {
  const calls = [];
  globalThis.__agendaFetchMock = async (url) => {
    calls.push(url);
    return Response.json([]);
  };
  assert.deepEqual(await notificationService.getNotifications({ unreadOnly: true }), []);
  assert.deepEqual(await notificationService.getNotifications({ limit: 10 }), []);
  assert.deepEqual(calls, [
    "/proxy/notifications/?unread_only=true",
    "/proxy/notifications/?limit=10",
  ]);
});

test("un 404 de notificaciones se informa como error y marcar leída conserva la ruta de acción", async () => {
  globalThis.__agendaFetchMock = async () => Response.json({ detail: "Not found" }, { status: 404 });
  await assert.rejects(notificationService.getNotifications(), /Not found/);
  const calls = [];
  globalThis.__agendaFetchMock = async (url, options) => {
    calls.push({ url, method: options?.method });
    return new Response(null, { status: 204 });
  };
  await notificationService.markRead(9);
  assert.deepEqual(calls, [{ url: "/proxy/notifications/9/read", method: "PATCH" }]);
});

test("la disponibilidad y las citas usan los contratos existentes sin fabricar horarios", async () => {
  const calls = [];
  const slot = { start_at: "2026-10-09T15:00:00Z", end_at: "2026-10-09T15:30:00Z" };
  globalThis.__agendaFetchMock = async (url, options) => {
    calls.push({ url, method: options?.method });
    if (url.includes("availability")) return Response.json({ timezone: "America/Merida", slots: [slot] });
    return Response.json([]);
  };
  const result = await agendaBookingService.availability(7, 3, "2026-10-09", "2026-10-09");
  await agendaBookingService.myBookings();
  assert.deepEqual(result.slots, [slot]);
  assert.deepEqual(calls.map((call) => call.url), [
    "/proxy/public/agenda/7/availability?service_id=3&date_from=2026-10-09&date_to=2026-10-09",
    "/proxy/agenda/bookings/mine?limit=200",
  ]);
});

test("un POST con respuesta incierta no se reintenta automáticamente", async () => {
  let posts = 0;
  globalThis.__agendaFetchMock = async (_url, options) => {
    posts += 1;
    assert.equal(options.method, "POST");
    assert.equal(options.retryOnAuthFailure, false);
    throw new TypeError("Network request failed");
  };
  await assert.rejects(agendaBookingService.createBooking(7, {
    service_id: 3,
    start_at: "2026-10-09T15:00:00Z",
    customer_name: "Cliente de prueba",
    customer_email: null,
    customer_phone: null,
    notes: null,
    payment_method: "cash",
  }), /Network request failed/);
  assert.equal(posts, 1);
});

test("un conflicto 409 conserva su código y mensaje para escoger otro horario", async () => {
  globalThis.__agendaFetchMock = async () => Response.json(
    { detail: "The requested time is not available" },
    { status: 409 },
  );
  await assert.rejects(agendaBookingService.createBooking(7, {
    service_id: 3,
    start_at: "2026-10-09T15:00:00Z",
    customer_name: "Cliente de prueba",
    customer_email: null,
    customer_phone: null,
    notes: null,
    payment_method: "cash",
  }), (error) => error.status === 409 &&
    error.message === "Ese horario acaba de dejar de estar disponible. Elige otro.");
});
