import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import ts from 'typescript';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/lib/api') return { url: 'data:text/javascript,export const fetchWithAuth=(...args)=>globalThis.__agendaInteractionFetch(...args)', shortCircuit: true };
    if (specifier.startsWith('@/')) return { url: new URL(`../src/${specifier.slice(2)}${specifier.startsWith('@/components/') ? '.tsx' : '.ts'}`, import.meta.url).href, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
    return next(url, context);
  },
});
const dom = new JSDOM('<!doctype html><html><body><button id="before">Antes</button><div id="root"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.sessionStorage = dom.window.sessionStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const { default: Requests } = await import('../src/components/agenda/AgendaRescheduleRequestsModal.tsx');
const { useProviderAgenda } = await import('../src/hooks/useProviderAgenda.ts');
const { dateInZone } = await import('../src/lib/agendaCalendar.ts');
const flush = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); }); };
const booking = { id: 125, supplier_id: 7, service_id: 10, customer_name: 'Cliente de prueba', start_at: '2026-10-22T16:00:00Z', end_at: '2026-10-22T17:00:00Z', status: 'confirmed', created_at: '2026-10-18T16:30:00Z', updated_at: '2026-10-18T16:30:00Z', finance_version: 2, provider_notes: null };
const row = { id: 15, booking_id: 125, status: 'pending', requested_start_at: '2026-10-24T18:00:00Z', reason: 'Necesito cambiar de horario', created_at: '2026-10-18T16:30:00Z', updated_at: '2026-10-18T16:30:00Z', response_note: null };
const text = () => document.getElementById('root').textContent;
const button = label => [...document.querySelectorAll('button')].find(element => element.textContent === label);
async function mount(Component, props) {
  const root = createRoot(document.getElementById('root'));
  await act(async () => root.render(React.createElement(Component, props)));
  await flush();
  return root;
}
async function click(element) { assert(element, 'El control debe existir'); await act(async () => { element.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); }
async function unmount(root) { await act(async () => root.unmount()); }
function modalProps(extra = {}) { return { booking, requestId: 15, serviceName: 'Servicio de prueba', timezone: 'America/Merida', refreshKey: 0, onClose() {}, onDecision: async () => {}, ...extra }; }
for (const approve of [true, false]) test(`${approve ? 'aprobar' : 'rechazar'}: confirmación explícita, respuesta del servidor y bloqueo de doble envío`, async () => {
  let current = { ...row }, serverBooking = { ...booking }, sends = 0, finish, refreshes = 0;
  globalThis.__agendaInteractionFetch = async (url, options) => {
    if (url.includes('/decision')) {
      sends++; const payload = JSON.parse(options.body); assert.equal(payload.approve, approve); assert.equal(payload.response_note, null);
      await new Promise(resolve => { finish = resolve; });
      current = { ...row, status: approve ? 'approved' : 'rejected' };
      if (approve) serverBooking = { ...booking, start_at: row.requested_start_at };
      return Response.json(current);
    }
    return Response.json([current]);
  };
  const root = await mount(Requests, modalProps({ onDecision: async () => { refreshes++; } }));
  assert.match(text(), /22 de octubre/); assert.match(text(), /24 de octubre/); assert.match(text(), /Necesito cambiar de horario/);
  await click(button(approve ? 'Aprobar cambio' : 'Rechazar solicitud'));
  assert.match(text(), approve ? /Se reemplazará/ : /Se rechazará la fecha/);
  await act(async () => { const form = document.querySelector('form'); form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); });
  assert.equal(sends, 1); assert(button(approve ? 'Confirmar aprobación' : 'Confirmar rechazo').disabled);
  assert.equal(serverBooking.start_at, booking.start_at, 'No debe mover la cita antes de la respuesta');
  await act(async () => { finish(); }); await flush();
  assert.equal(refreshes, 1); assert.match(text(), approve ? /Cambio aprobado por el servidor/ : /Solicitud rechazada/);
  assert.equal(serverBooking.start_at, approve ? row.requested_start_at : booking.start_at);
  assert.equal(button('Aprobar cambio'), undefined); assert.equal(button('Rechazar solicitud'), undefined);
  await unmount(root);
});
test('409 por horario ocupado no muestra éxito y vuelve a consultar antes de otra decisión', async () => {
  let gets = 0, refreshes = 0;
  globalThis.__agendaInteractionFetch = async url => {
    if (url.includes('/decision')) return Response.json({ detail: 'The requested time is not available' }, { status: 409 });
    gets++; return Response.json([row]);
  };
  const root = await mount(Requests, modalProps({ onDecision: async () => { refreshes++; } }));
  await click(button('Aprobar cambio'));
  await act(async () => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  await flush();
  assert.match(text(), /No fue posible aprobar este cambio porque el horario solicitado ya no está disponible/);
  assert.doesNotMatch(text(), /Cambio aprobado por el servidor/); assert.equal(gets, 2); assert.equal(refreshes, 1);
  assert.equal(button('Confirmar aprobación'), undefined);
  await unmount(root);
});
test('solicitud atendida en otro dispositivo elimina las acciones tras el conflicto', async () => {
  let decided = false;
  globalThis.__agendaInteractionFetch = async url => {
    if (url.includes('/decision')) { decided = true; return Response.json({ detail: 'Reschedule request already decided' }, { status: 409 }); }
    return Response.json([{ ...row, status: decided ? 'approved' : 'pending' }]);
  };
  const root = await mount(Requests, modalProps()); await click(button('Aprobar cambio'));
  await act(async () => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  await flush(); assert.match(text(), /Aprobada/); assert.equal(button('Aprobar cambio'), undefined);
  await unmount(root);
});
for (const state of ['cancelled', 'completed', 'no_show']) test(`cita ${state}: conserva la solicitud y no ofrece decisiones incompatibles`, async () => {
  globalThis.__agendaInteractionFetch = async () => Response.json([row]);
  const root = await mount(Requests, modalProps({ booking: { ...booking, status: state } }));
  assert.match(text(), /Necesito cambiar de horario/); assert.equal(button('Aprobar cambio'), undefined);
  if (state === 'cancelled') assert.match(text(), /Esta reservación está cancelada/);
  await unmount(root);
});
test('request_id ajeno no abre acciones para una solicitud distinta; histórico atendido sigue visible', async () => {
  globalThis.__agendaInteractionFetch = async () => Response.json([{ ...row, status: 'rejected' }]);
  const root = await mount(Requests, modalProps({ requestId: 999 }));
  assert.match(text(), /no pertenece a esta cita/); assert.match(text(), /Rechazada/); assert.equal(button('Aprobar cambio'), undefined);
  await unmount(root);
});
test('modal tiene foco inicial, navegación por teclado, Escape y restauración del foco', async () => {
  globalThis.__agendaInteractionFetch = async () => Response.json([row]);
  const before = document.getElementById('before'); before.focus(); let closes = 0;
  const root = await mount(Requests, modalProps({ onClose() { closes++; } }));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 25)); });
  const dialog = document.querySelector('[role="dialog"]'); assert(dialog.contains(document.activeElement));
  const focusable = [...dialog.querySelectorAll('button:not([disabled]),input,textarea')]; focusable.at(-1).focus();
  await act(async () => focusable.at(-1).dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
  assert.equal(document.activeElement, focusable[0]);
  await act(async () => dialog.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  assert.equal(closes, 1); await unmount(root); assert.equal(document.activeElement, before); assert.equal(document.body.style.overflow, '');
});

function mockAgenda({ mobile = false, timezone = 'America/Merida', pendingError = false, listResponse } = {}) {
  window.matchMedia = () => ({ matches: mobile, addEventListener() {}, removeEventListener() {} });
  const calls = [];
  globalThis.__agendaInteractionFetch = async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/agenda/settings') return Response.json({ timezone });
    if (url === '/api/agenda/schedules') return Response.json([]);
    if (url === '/api/agenda/services') return Response.json([{ id: 10, name: 'Servicio de prueba' }]);
    if (url === '/api/agenda/payment-settings') return Response.json({ online_payment_available: true });
    if (url.includes('/reschedule-requests')) return pendingError ? Response.json({ detail: 'Unavailable' }, { status: 503 }) : Response.json({ total: 1, skip: 0, limit: 200, items: [{ ...row, booking }] });
    return listResponse ? listResponse(url, options) : Response.json([booking]);
  };
  return calls;
}
let state;
function Harness({ enabled = true, userId = 7 }) { state = useProviderAgenda(enabled, userId); return React.createElement('div', null, state.contextError || state.error || state.date); }
for (const mobile of [true, false]) test(`vista predeterminada ${mobile ? 'móvil Día' : 'escritorio Semana'}, sin consultas financieras`, async () => {
  sessionStorage.clear(); const calls = mockAgenda({ mobile });
  const root = await mount(Harness, {});
  assert.equal(state.view, mobile ? 'day' : 'week'); assert.equal(state.date, dateInZone(new Date(), 'America/Merida'));
  assert.equal(state.pendingTotal, 1); assert(state.pendingMap.has(125));
  assert(calls.filter(call => call.url.includes('/appointments')).every(call => call.url.includes('overlap=true') && call.url.includes('date_from=')));
  assert.equal(calls.some(call => /appointments\/\d+\/(payment|financial)/.test(call.url)), false);
  await unmount(root);
});
test('cambio de vista conserva fecha, persiste sesión y Reservaciones pide orden/paginación al servidor', async () => {
  sessionStorage.clear(); const calls = mockAgenda(); const root = await mount(Harness, {});
  await act(async () => { state.setDate('2026-10-22'); state.setView('month'); }); await flush();
  assert.equal(state.date, '2026-10-22'); assert.equal(JSON.parse(sessionStorage.getItem('agenda-calendar:7')).view, 'month');
  await act(async () => state.setView('reservations')); await flush();
  let request = new URL(calls.filter(c => c.url.includes('/appointments')).at(-1).url, 'http://mock');
  assert.equal(request.searchParams.get('sort'), 'created_desc'); assert.equal(request.searchParams.get('limit'), '51');
  await act(async () => { state.setSort('start_desc'); state.setFilter('cancelled'); }); await flush();
  assert.equal(state.page, 0);
  await act(async () => state.setPage(1)); await flush();
  request = new URL(calls.filter(c => c.url.includes('/appointments')).at(-1).url, 'http://mock');
  assert.equal(request.searchParams.get('skip'), '50'); assert.equal(request.searchParams.get('status'), 'cancelled'); assert.equal(request.searchParams.get('sort'), 'start_desc');
  assert.equal(state.date, '2026-10-22'); await unmount(root);
});
test('las próximas citas envían una frontera futura real en vez de clasificar historia como próxima', async () => {
  sessionStorage.clear(); const calls = mockAgenda(); const root = await mount(Harness, {});
  const before = Date.now(); await act(async () => { state.setDate('2020-01-01'); state.setView('reservations'); state.setSort('start_asc'); }); await flush();
  const request = new URL(calls.filter(c => c.url.includes('/appointments')).at(-1).url, 'http://mock');
  assert(Date.parse(request.searchParams.get('date_from')) >= before); await unmount(root);
});
test('zona horaria inválida es recuperable y no consulta calendarios con un fallback silencioso', async () => {
  sessionStorage.clear(); const calls = mockAgenda({ timezone: 'Invalid/Zone' }); const root = await mount(Harness, {});
  assert.equal(state.ready, false); assert(state.contextError); assert.equal(calls.some(c => c.url.includes('/appointments')), false);
  await unmount(root);
});
test('permisos ausentes no consultan datos; el error del contador no significa cero', async () => {
  sessionStorage.clear(); const calls = mockAgenda({ pendingError: true }); let root = await mount(Harness, { enabled: false }); assert.equal(calls.length, 0); await unmount(root);
  root = await mount(Harness, {}); assert.equal(state.pendingTotal, null); assert(state.pendingError); await unmount(root);
});
test('navegación rápida aborta la petición previa y evita sobrescritura por respuestas antiguas', async () => {
  sessionStorage.clear(); const waiting = [];
  mockAgenda({ listResponse: (url, options) => new Promise(resolve => waiting.push({ url, options, resolve })) });
  const root = await mount(Harness, {}); assert(waiting.length);
  const first = waiting[0];
  await act(async () => state.setDate('2026-12-14')); await flush();
  const latest = waiting.at(-1); assert.notEqual(latest, first); assert(first.options.signal.aborted);
  await act(async () => { latest.resolve(Response.json([{ ...booking, id: 999 }])); }); await flush();
  await act(async () => { first.resolve(Response.json([{ ...booking, id: 111 }])); }); await flush();
  assert.equal(state.appointments[0].id, 999); await unmount(root);
});

const { agendaBookingService: api } = await import('../src/services/agendaBookingService.ts');
for (const approve of [true, false]) test(`flujo integrado: ${approve ? 'aprobar mueve la cita' : 'rechazar conserva la cita'} y actualiza contador e índice pendiente`, async () => {
  sessionStorage.clear(); const calls = mockAgenda(); const baseFetch = globalThis.__agendaInteractionFetch;
  let serverBooking = { ...booking }, serverRequest = { ...row };
  globalThis.__agendaInteractionFetch = async (url, options) => {
    if (url.includes('/decision')) { const payload = JSON.parse(options.body); serverRequest = { ...row, status: payload.approve ? 'approved' : 'rejected' }; if (payload.approve) serverBooking = { ...booking, start_at: row.requested_start_at }; return Response.json(serverRequest); }
    if (url === '/proxy/agenda/appointments/125/reschedule-requests') return Response.json([serverRequest]);
    if (url === '/proxy/agenda/appointments/125') return Response.json(serverBooking);
    if (url.startsWith('/proxy/agenda/reschedule-requests')) return Response.json({ total: serverRequest.status === 'pending' ? 1 : 0, skip: 0, limit: 200, items: serverRequest.status === 'pending' ? [{ ...serverRequest, booking: serverBooking }] : [] });
    if (url.startsWith('/proxy/agenda/appointments?')) return Response.json([serverBooking]);
    return baseFetch(url, options);
  };
  function Flow() {
    state = useProviderAgenda(true, 7);
    const [detail, setDetail] = React.useState(booking);
    return React.createElement(Requests, modalProps({ booking: detail, onDecision: async () => { setDetail(await api.providerAppointment(125)); await state.refreshAll(); } }));
  }
  const root = await mount(Flow, {});
  assert.equal(state.pendingTotal, 1); assert(state.pendingMap.has(125));
  await click(button(approve ? 'Aprobar cambio' : 'Rechazar solicitud'));
  await act(async () => document.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))); await flush();
  assert.equal(state.pendingTotal, 0); assert.equal(state.pendingMap.has(125), false);
  assert.equal(state.appointments[0].start_at, approve ? row.requested_start_at : booking.start_at);
  assert.equal(calls.some(call => /financial-summary|\/payments/.test(call.url)), false);
  await unmount(root);
});
test('reconexión consulta de nuevo, sin repetir consultas por la primera conexión ni por estados iguales', async () => {
  const { useInboxReconnect } = await import('../src/hooks/useInboxReconnect.ts');
  let calls = 0;
  function Reconnect({ status }) { useInboxReconnect(status, true, () => calls++); return null; }
  const root = await mount(Reconnect, { status: 'connected' }); assert.equal(calls, 0);
  await act(async () => root.render(React.createElement(Reconnect, { status: 'disconnected' })));
  await act(async () => root.render(React.createElement(Reconnect, { status: 'connected' })));
  assert.equal(calls, 1);
  await act(async () => root.render(React.createElement(Reconnect, { status: 'connected' }))); assert.equal(calls, 1); await unmount(root);
});
test('detalle con modal financiero anidado no crea forms anidados ni cierra el padre con Escape', async () => {
  const { default: Shell } = await import('../src/components/agenda/AgendaModalShell.tsx');
  let outerCloses = 0, innerCloses = 0;
  const root = await mount(Shell, { asForm: false, open: true, title: 'Detalle', saving: false, hideSubmit: true, onSubmit() {}, onClose() { outerCloses++; }, children: React.createElement(Shell, { open: true, title: 'Pago', saving: false, onSubmit() {}, onClose() { innerCloses++; } }, React.createElement('input', { 'aria-label': 'Importe' })) });
  assert.equal(document.querySelectorAll('form form').length, 0);
  const dialogs = document.querySelectorAll('[role="dialog"]');
  await act(async () => dialogs[1].dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  assert.equal(innerCloses, 1); assert.equal(outerCloses, 0); await unmount(root);
});
