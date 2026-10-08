import assert from "node:assert/strict";
import test from "node:test";
import { createAgendaRefundHistoryCache } from "../src/lib/agendaRefundHistoryCache.ts";

test("consulta el historial al abrir una cita activa o cancelada y reutiliza datos recientes", async () => {
  const calls = [];
  const loaded = new Map();
  let clock = 100000;
  const cache = createAgendaRefundHistoryCache({
    fetch: async (bookingId) => { calls.push(bookingId); return [{ id: bookingId }]; },
    onLoaded: (bookingId, items) => loaded.set(bookingId, items),
    onError: () => assert.fail("La consulta no debe fallar"),
    onLoading: () => {},
    now: () => clock,
  });

  assert.equal(calls.length, 0);
  await cache.load(4);
  await cache.load(5);
  await cache.load(4);
  assert.deepEqual(calls, [4, 5]);
  assert.deepEqual(loaded.get(4), [{ id: 4 }]);
  assert.equal(cache.hasLoaded(5), true);
  clock += 30001;
  await cache.load(4);
  assert.deepEqual(calls, [4, 5, 4]);
});

test("eventos y clics simultáneos comparten una sola solicitud; la actualización manual fuerza otra", async () => {
  const calls = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const cache = createAgendaRefundHistoryCache({
    fetch: async (bookingId) => { calls.push(bookingId); await gate; return []; },
    onLoaded: () => {},
    onError: () => assert.fail("La consulta no debe fallar"),
    onLoading: () => {},
  });
  const opened = cache.load(9);
  const event = cache.load(9, true);
  assert.equal(opened, event);
  assert.deepEqual(calls, [9]);
  release();
  await Promise.all([opened, event]);
  await cache.load(9, true);
  assert.deepEqual(calls, [9, 9]);
});
