import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/lib/api') return { url: 'data:text/javascript,export const fetchWithAuth=(...args)=>globalThis.__calendarFetch(...args)', shortCircuit: true };
    if (specifier === '@/lib/currentSupplier') return { url: 'data:text/javascript,export const isSupplierRole=r=>r?.toUpperCase()==="SUPPLIER";export const isAdminRole=r=>r?.toUpperCase()==="ADMIN";', shortCircuit: true };
    if (specifier.startsWith('@/')) return { url: new URL(`../src/${specifier.slice(2)}${specifier.startsWith('@/components/') ? '.tsx' : '.ts'}`, import.meta.url).href, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
    return next(url, context);
  },
});
const { agendaBookingService: api } = await import('../src/services/agendaBookingService.ts');
const { calendarDays, calendarPeriod, shiftDay, moveCalendar, dateInZone, dayStart, layoutDay, bookingsOnDay, parseAgendaNavigation, appointmentStatusLabel } = await import('../src/lib/agendaCalendar.ts');
const { getNotificationDestination } = await import('../src/lib/notificationDestination.ts');
const { isAgendaInboxEvent } = await import('../src/types/chat.ts');
const { default: Calendar } = await import('../src/components/agenda/AgendaProviderCalendar.tsx');
const { default: Toolbar } = await import('../src/components/agenda/AgendaCalendarToolbar.tsx');
const { default: Pending } = await import('../src/components/agenda/AgendaPendingRequests.tsx');
const render = (C, props) => renderToStaticMarkup(React.createElement(C, props));
const booking = { id: 125, service_id: 10, supplier_id: 7, customer_name: 'Cliente de prueba', start_at: '2026-10-22T16:00:00Z', end_at: '2026-10-22T17:00:00Z', created_at: '2026-10-18T16:30:00Z', updated_at: '2026-10-18T16:30:00Z', status: 'confirmed', finance_version: 2, provider_notes: null };
const request = { id: 15, booking_id: 125, status: 'pending', requested_start_at: '2026-10-24T18:00:00Z', reason: 'Necesito cambiar de horario', created_at: '2026-10-18T16:30:00Z', updated_at: '2026-10-18T16:30:00Z', response_note: null, booking };
const props = { view: 'day', date: '2026-10-22', timezone: 'America/Merida', bookings: [booking], schedules: [], pendingIds: new Set([125]), serviceNames: new Map([[10, 'Servicio de prueba']]), onSelectDate() {}, onSelectBooking() {} };
test('períodos comienzan en lunes y el mes incluye su cuadrícula completa', () => {
  assert.equal(calendarDays('day', '2026-10-22').length, 1);
  assert.deepEqual(calendarDays('week', '2026-10-22'), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
  assert.equal(calendarDays('month', '2026-10-22').length, 42);
  assert.equal(calendarDays('month', '2026-10-22')[0], '2026-09-28');
});
test('navegación civil mantiene fechas y cruza meses/años sin usar la zona de la computadora', () => {
  assert.equal(shiftDay('2026-12-31', 1), '2027-01-01');
  assert.equal(moveCalendar('week', '2026-10-22', 1), '2026-10-29');
  assert.equal(moveCalendar('month', '2026-01-31', 1), '2026-02-01');
  assert.equal(dateInZone('2026-10-22T02:00:00Z', 'America/Merida'), '2026-10-21');
  assert.equal(dateInZone('2026-10-22T23:00:00Z', 'Asia/Tokyo'), '2026-10-23');
});
test('intervalos UTC usan inicio inclusivo y fin exclusivo y respetan DST de 23/25 horas', () => {
  assert.deepEqual(calendarPeriod('day', '2026-10-22', 'America/Merida'), { date_from: '2026-10-22T06:00:00.000Z', date_to: '2026-10-23T06:00:00.000Z' });
  const short = calendarPeriod('day', '2026-03-08', 'America/New_York');
  const long = calendarPeriod('day', '2026-11-01', 'America/New_York');
  assert.equal((Date.parse(short.date_to) - Date.parse(short.date_from)) / 3600000, 23);
  assert.equal((Date.parse(long.date_to) - Date.parse(long.date_from)) / 3600000, 25);
  assert.equal(dayStart('2026-10-22', 'Asia/Kolkata'), '2026-10-21T18:30:00.000Z');
  assert.throws(() => dayStart('2026-10-22', 'Invalid/Timezone'), RangeError);
});
test('una cita que cruza medianoche aparece en ambos días y no en el límite exclusivo', () => {
  const overnight = { ...booking, start_at: '2026-10-23T05:30:00Z', end_at: '2026-10-23T06:30:00Z' };
  assert.equal(bookingsOnDay([overnight], '2026-10-22', 'America/Merida').length, 1);
  assert.equal(bookingsOnDay([overnight], '2026-10-23', 'America/Merida').length, 1);
  assert.equal(bookingsOnDay([overnight], '2026-10-24', 'America/Merida').length, 0);
  assert.equal(layoutDay([overnight], '2026-10-22', 'America/Merida')[0].end, 1440);
  assert.equal(layoutDay([overnight], '2026-10-23', 'America/Merida')[0].start, 0);
});
test('citas simultáneas y solapamientos encadenados conservan columnas seleccionables', () => {
  const rows = [booking, { ...booking, id: 126, start_at: '2026-10-22T16:30:00Z', end_at: '2026-10-22T17:30:00Z' }, { ...booking, id: 127, start_at: '2026-10-22T17:00:00Z', end_at: '2026-10-22T18:00:00Z' }];
  const layout = layoutDay(rows, props.date, props.timezone);
  assert.equal(layout.length, 3); assert.equal(layout[0].column, 0); assert.equal(layout[1].column, 1); assert.equal(layout[2].column, 0);
  assert(layout.every(event => event.columns === 2));
});
for (const view of ['day', 'week', 'month']) test(`vista ${view}: renderizado responsive, fechas y solicitudes`, () => {
  const html = render(Calendar, { ...props, view });
  assert.match(html, /citas|Agenda/);
  if (view === 'month') { assert.match(html, /1 cambios/); assert.doesNotMatch(html, /Cliente de prueba/); }
  else { assert.match(html, /Cliente de prueba/); assert.match(html, /Cambio solicitado/); assert.match(html, /Confirmada/); }
  if (view === 'week') assert.match(html, /lg:hidden|hidden lg:block/);
});
for (const status of ['pending', 'confirmed', 'completed', 'cancelled', 'no_show']) test(`calendario conserva el estado ${status} sin deducir pagos`, () => {
  const html = render(Calendar, { ...props, bookings: [{ ...booking, status, service_id: 99 }] });
  assert(html.includes(appointmentStatusLabel(status))); assert.match(html, /Servicio #99/); assert.doesNotMatch(html, /Totalmente pagado/);
});
test('toolbar ofrece cuatro vistas y controles de calendario; Reservaciones no muestra controles decorativos de fecha', () => {
  const common = { date: props.date, timezone: props.timezone, onView() {}, onDate() {}, loading: false };
  const html = render(Toolbar, { ...common, view: 'week' });
  for (const text of ['Día', 'Semana', 'Mes', 'Reservaciones', 'Hoy', 'Período anterior', 'Período siguiente']) assert(html.includes(text));
  assert.match(html, /aria-pressed="true"/);
  const list = render(Toolbar, { ...common, view: 'reservations' });
  assert.match(list, /Reservaciones del negocio/); assert.doesNotMatch(list, /type="date"|Período anterior/);
});
test('paginación completa de calendario supera 200 registros, deduplica y no consulta finanzas', async () => {
  const calls = [];
  globalThis.__calendarFetch = async (url, options) => {
    calls.push({ url, options }); const skip = Number(new URL(url, 'http://mock').searchParams.get('skip'));
    return Response.json(Array.from({ length: skip === 0 ? 200 : 5 }, (_, i) => ({ ...booking, id: skip === 200 && i === 0 ? 199 : skip + i })));
  };
  const range = calendarPeriod('week', props.date, props.timezone);
  const rows = await api.providerCalendarAppointments(range, 'confirmed');
  assert.equal(rows.length, 204); assert.equal(calls.length, 2);
  for (const call of calls) { const params = new URL(call.url, 'http://mock').searchParams; assert.equal(params.get('sort'), 'start_asc'); assert.equal(params.get('overlap'), 'true'); assert.equal(params.get('status'), 'confirmed'); assert.equal(params.get('date_from'), range.date_from); }
  assert(calls.every(call => !call.url.includes('/payment')));
});
for (const sort of ['created_desc', 'start_asc', 'start_desc']) test(`orden ${sort} y paginación se envían al servidor antes de mostrar tarjetas`, async () => {
  let called;
  globalThis.__calendarFetch = async url => { called = new URL(url, 'http://mock'); return Response.json([booking]); };
  await api.providerAppointments('cancelled', undefined, { sort, skip: 50, limit: 51 });
  assert.equal(called.searchParams.get('sort'), sort); assert.equal(called.searchParams.get('skip'), '50'); assert.equal(called.searchParams.get('limit'), '51'); assert.equal(called.searchParams.get('status'), 'cancelled');
});
test('abortar el calendario interrumpe la paginación antes de otro envío', async () => {
  const controller = new AbortController(); let count = 0;
  globalThis.__calendarFetch = async () => { count++; controller.abort(); return Response.json(Array(200).fill(booking)); };
  await assert.rejects(api.providerCalendarAppointments(calendarPeriod('day', props.date, props.timezone), undefined, controller.signal), error => error.name === 'AbortError');
  assert.equal(count, 1);
});
test('total pendiente global y paginación no dependen de las citas visibles del mes', async () => {
  const calls = [];
  globalThis.__calendarFetch = async url => { const u = new URL(url, 'http://mock'); calls.push(u); const skip = Number(u.searchParams.get('skip')); return Response.json({ total: 201, skip, limit: 200, items: Array.from({ length: skip === 0 ? 200 : 1 }, (_, i) => ({ ...request, id: skip + i + 1 })) }); };
  const result = await api.providerPendingRequests();
  assert.equal(result.total, 201); assert.equal(result.items.length, 201); assert.equal(calls.length, 2); assert(calls.every(u => u.searchParams.get('status') === 'pending'));
});
test('errores del contador nunca se convierten en cero y cambios durante paginación se informan', async () => {
  globalThis.__calendarFetch = async () => Response.json({ detail: 'Forbidden' }, { status: 403 });
  await assert.rejects(api.providerPendingRequests(), error => error.status === 403);
  globalThis.__calendarFetch = async () => Response.json({ total: 2, items: [request], skip: 0, limit: 200 });
  await assert.rejects(api.providerPendingRequests(), /completar la consulta/);
  const html = render(Pending, { items: [], total: null, error: 'No disponible', loading: false, page: 0, onPage() {}, onRefresh() {}, onReview() {}, onBooking() {}, services: props.serviceNames, timezone: props.timezone });
  assert.match(html, /No se pudo consultar el total/); assert.doesNotMatch(html, /No hay solicitudes pendientes/);
});
test('bandeja presenta fecha actual, propuesta, motivo y citas canceladas sin borrarlas', () => {
  const html = render(Pending, { items: [{ ...request, booking: { ...booking, status: 'cancelled' } }], total: 57, error: '', loading: false, page: 0, onPage() {}, onRefresh() {}, onReview() {}, onBooking() {}, services: props.serviceNames, timezone: props.timezone });
  for (const text of ['57 solicitudes', 'Fecha actual', 'Nueva fecha solicitada', 'Necesito cambiar de horario', 'está cancelada', 'Revisar solicitud', 'Ver reservación', 'Página 1 de 2']) assert(html.includes(text));
});
test('notificaciones estructuradas antiguas y nuevas llegan directamente a reprogramaciones', () => {
  assert.equal(getNotificationDestination({ type: 'agenda_reschedule_requested', booking_id: 125 }, 'SUPPLIER'), '/admin/agenda/appointments?booking_id=125&action=reschedule');
  assert.equal(getNotificationDestination({ data: { type: 'agenda_reschedule_requested', booking_id: 125, reschedule_request_id: 15 } }, 'SUPPLIER'), '/admin/agenda/appointments?booking_id=125&action=reschedule&request_id=15');
  assert.equal(getNotificationDestination({ type: 'agenda_booking_created', booking_id: 125 }, 'SUPPLIER'), '/admin/agenda/appointments?booking_id=125');
  assert.equal(getNotificationDestination({ type: 'agenda_reschedule_requested', booking_id: 125 }, 'CLIENT'), '/agenda/bookings/125');
  assert.deepEqual(parseAgendaNavigation(new URLSearchParams('booking_id=125&action=reschedule&request_id=15')), { bookingId: 125, requestId: 15, reschedule: true });
  assert.equal(parseAgendaNavigation(new URLSearchParams('booking_id=-1&request_id=abc')).bookingId, null);
});
test('WebSocket valida el ID opcional sin romper eventos antiguos ni aceptar valores inválidos', () => {
  const event = { type: 'agenda.reschedule_requested', booking_id: 125, supplier_id: 7 };
  assert(isAgendaInboxEvent(event)); assert(isAgendaInboxEvent({ ...event, reschedule_request_id: 15 }));
  for (const value of [-1, 0, '15', NaN]) assert.equal(isAgendaInboxEvent({ ...event, reschedule_request_id: value }), false);
});
