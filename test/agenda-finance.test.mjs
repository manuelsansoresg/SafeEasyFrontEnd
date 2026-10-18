import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/lib/api') return { url: 'data:text/javascript,export const fetchWithAuth = (...args) => globalThis.__financeFetch(...args)', shortCircuit: true };
    if (specifier.startsWith('@/')) {
      const path = specifier.slice(2);
      const extension = path.startsWith('components/') ? '.tsx' : '.ts';
      return { url: new URL(`../src/${path}${extension}`, import.meta.url).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
    return next(url, context);
  },
});
const { agendaBookingService: api } = await import('../src/services/agendaBookingService.ts');
const { cents, mxn, isFinancialBooking, availableAdjustment, validateChargePolicy, financeLabel, openIntent } = await import('../src/lib/agendaFinance.ts');
const { readFinancialAttempt, writeFinancialAttempt, clearFinancialAttempt } = await import('../src/lib/agendaFinancialAttempt.ts');
const { getSafeMercadoPagoUrl } = await import('../src/lib/security.ts');
const { default: Summary, AgendaCancellationResult } = await import('../src/components/agenda/AgendaFinancialSummary.tsx');
const { default: PolicyEditor, offlinePolicy } = await import('../src/components/agenda/AgendaChargePolicyEditor.tsx');
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const base = { booking_id: 4, ledger_version: 2, total: '800.00', initial_required: '240.00', deposit_confirmed: '240.00', gross_collected: '240.00', remaining_after_initial: '560.00', balance_due: '560.00', refunded: '0.00', refund_pending: '0.00', settlement_status: 'partial', review_required: false, allowed_manual_methods: ['cash', 'external_terminal', 'bank_transfer'] };
function capture(response = {}) {
  const calls = [];
  globalThis.__financeFetch = async (url, options) => { calls.push({ url, options, payload: options.body ? JSON.parse(options.body) : null }); return Response.json(response); };
  return calls;
}
test('cotización y reserva financiera usan contratos públicos sin pago heredado', async () => {
  const calls = capture({ ledger_version: 2 });
  await api.financialQuote(8, 9);
  const payload = { service_id: 9, start_at: '2026-11-01T10:00:00Z', idempotency_key: '5600fe74-cdeb-48c4-aea4-16d04b6d9e04', accepted_terms_version: 'v3' };
  await api.createFinancialBooking(8, payload);
  await api.createFinancialBooking(8, payload);
  assert.equal(calls[0].url, '/proxy/public/agenda/8/services/9/financial-quote');
  assert.equal(calls[1].url, '/proxy/public/agenda/8/bookings/financial');
  assert.deepEqual(calls[1].payload, calls[2].payload);
  assert.equal(calls[1].payload.payment_method, undefined);
  assert.equal(calls[1].payload.amount, undefined);
  assert.equal(calls[1].options.retryOnAuthFailure, false);
});
test('resúmenes autorizados, historial y vista previa se consultan sin mutaciones', async () => {
  const calls = capture(base);
  await api.financialSummary(4, false, 'guest token');
  await api.financialSummary(4, true);
  await api.financialHistory(4);
  await api.cancellationPreview(4, 'guest token');
  assert.deepEqual(calls.map(c => c.url), ['/proxy/public/agenda/bookings/4/financial-summary?management_token=guest+token', '/proxy/agenda/appointments/4/financial-summary', '/proxy/agenda/appointments/4/payments', '/proxy/public/agenda/bookings/4/cancellation-preview?management_token=guest+token']);
  assert(calls.every(c => !c.options.method && c.options.cache === 'no-store'));
});
for (const method of ['cash', 'external_terminal', 'bank_transfer']) test(`abonos mediante ${method} conservan decimal, referencia y clave`, async () => {
  const calls = capture();
  await api.registerManualPayment(4, { amount: '560.00', method, reference: 'Ticket 987', idempotency_key: 'stable-key-987' });
  assert.equal(calls[0].url, '/proxy/agenda/appointments/4/payments/manual');
  assert.deepEqual(calls[0].payload, { amount: '560.00', method, reference: 'Ticket 987', idempotency_key: 'stable-key-987' });
});
test('Checkout de saldo no envía importes ni crea pago manual', async () => {
  const calls = capture({ status: 'uncertain', checkout_url: null });
  const result = await api.createBalanceIntent(4, 'stable-balance');
  assert.equal(calls[0].url, '/proxy/agenda/appointments/4/payment-intents');
  assert.deepEqual(calls[0].payload, { idempotency_key: 'stable-balance' });
  assert(openIntent(result.status));
  assert.equal(getSafeMercadoPagoUrl(result.checkout_url), '');
});
test('ajustes, devoluciones extraordinarias y confirmación manual usan rutas v2', async () => {
  const calls = capture();
  const adjustment = { amount: '100.00', reason: 'Importe incorrecto', idempotency_key: 'stable-correction' };
  await api.adjustPayment(4, 7, 'reversals', adjustment);
  await api.adjustPayment(4, 7, 'refunds', adjustment);
  await api.confirmFinancialManualRefund(4, 3, 'Comprobante 456');
  assert.deepEqual(calls.map(c => c.url), ['/proxy/agenda/appointments/4/payments/7/reversals', '/proxy/agenda/appointments/4/payments/7/refunds', '/proxy/agenda/appointments/4/financial-refunds/3/confirm-manual']);
  assert.deepEqual(calls[2].payload, { reference: 'Comprobante 456' });
});
for (const code of ['cancellation_preview_changed', 'cancellation_loss_confirmation_required']) test(`conflicto ${code} conserva detail.code sin reintentar`, async () => {
  let count = 0;
  globalThis.__financeFetch = async () => { count++; return Response.json({ detail: { code, message: 'Revisa las condiciones' } }, { status: 409 }); };
  await assert.rejects(api.cancelBooking(4, { preview_token: 'backend-token', accept_deposit_loss: true }), err => err.status === 409 && err.code === code && err.message === 'Revisa las condiciones');
  assert.equal(count, 1);
});
test('función desactivada no se convierte en otra reserva v1', async () => {
  let count = 0;
  globalThis.__financeFetch = async () => { count++; return Response.json({ detail: 'Los pagos ampliados de Agenda aún no están habilitados.' }, { status: 409 }); };
  await assert.rejects(api.createFinancialBooking(8, { service_id: 9, idempotency_key: 'stable-disabled' }), err => err.status === 409);
  assert.equal(count, 1);
});
for (const status of [401, 403]) test(`permiso HTTP ${status} no se elude`, async () => {
  let count = 0;
  globalThis.__financeFetch = async () => { count++; return Response.json({ detail: 'Acceso denegado' }, { status }); };
  await assert.rejects(api.financialSummary(4, true), err => err.status === status);
  assert.equal(count, 1);
});
test('cancelar envía token vigente y aceptación sin cantidades', async () => {
  const calls = capture({ status: 'cancelled', cancellation_result: { refunds: [] } });
  const payload = { reason: 'No podré asistir', management_token: null, preview_token: 'real-backend-token', accept_deposit_loss: true };
  await api.cancelBooking(4, payload);
  assert.equal(calls[0].url, '/proxy/agenda/bookings/4/cancel');
  assert.deepEqual(calls[0].payload, payload);
  await api.updateProviderStatus(4, { status: 'cancelled', cancellation_reason: 'No podemos prestar el servicio' });
  assert.equal(calls[1].options.method, 'PATCH');
  assert.equal(calls[1].payload.accept_deposit_loss, undefined);
});
test('anticipo recibido no declara liquidación ni usa el saldo previsto como real', () => {
  const html = render(Summary, { summary: { ...base, balance_due: '260.00', gross_collected: '540.00' } });
  assert.match(html, /Anticipo recibido/); assert.match(html, /240\.00/); assert.match(html, /260\.00/);
  assert.doesNotMatch(html, /Totalmente pagado|560\.00/);
});
test('historia desconocida no inventa ceros y completed no implica liquidación', () => {
  assert.match(render(Summary, { summary: { ...base, total: null, balance_due: null, settlement_status: 'unknown' } }), /Importe desconocido/);
  assert.match(render(Summary, { summary: { ...base, booking_status: 'completed' } }), /Saldo pendiente/);
  assert.equal(isFinancialBooking({ finance_version: 1 }), false);
  assert.equal(isFinancialBooking({ finance_version: 2 }), true);
  assert.equal(isFinancialBooking({ ledger_version: 2 }), true);
});
test('todas las modalidades y herencia nullable respetan las reglas del backend', () => {
  assert.equal(validateChargePolicy(null), null);
  for (const mode of ['offline', 'full', 'percentage', 'fixed']) {
    const policy = { ...offlinePolicy, mode, percentage: mode === 'percentage' ? '30.1250' : null, fixed_amount: mode === 'fixed' ? '200.01' : null };
    assert.equal(validateChargePolicy(policy), null);
  }
  assert(validateChargePolicy({ ...offlinePolicy, mode: 'percentage', percentage: '100.0001' }));
  assert(validateChargePolicy({ ...offlinePolicy, mode: 'full', retain_deposit: true }));
  const policy = { ...offlinePolicy, mode: 'fixed', fixed_amount: '200.00', retain_deposit: true, terms_version: 'v1', terms_text: 'Condiciones', retention_authorized: true };
  assert.equal(validateChargePolicy(policy), null);
  assert(validateChargePolicy({ ...policy, retention_authorized: false }));
});
test('el editor conserva condiciones heredadas de solo lectura sin campos legales editables', () => {
  const html = render(PolicyEditor, { value: { mode: 'percentage', percentage: '30', retain_deposit: true, retention_authorized: true, terms_text: 'Texto íntegro', terms_version: 'v2' }, noticeHours: 24, onChange() {} });
  assert.match(html, /Texto íntegro/); assert.match(html, /24 horas/);
  assert.match(html, /Usar condiciones de Drooopy/);
  assert.doesNotMatch(html, /<textarea|type="checkbox"|Declaro que estoy autorizado/);
  const disabled = render(PolicyEditor, { value: offlinePolicy, onlineAvailable: false, onChange() {} });
  assert.match(disabled, /value="full" disabled=""/);
});
test('los estados de devolución se distinguen sin afirmar acreditación bancaria', () => {
  const states = ['pending_request', 'request_in_progress', 'request_sent', 'confirmed', 'recoverable_error', 'review_required', 'manual_pending', 'cancelled'];
  for (const state of states) {
    const html = render(AgendaCancellationResult, { result: { retained_amount: '0.00', review_required: state === 'review_required', refunds: [{ id: 1, method: 'online', amount: '240.00', status: state, request_state: state }] } });
    assert(html.includes(financeLabel(state)));
    if (state === 'confirmed') assert.match(html, /acreditación depende/);
    else assert.doesNotMatch(html, /Mercado Pago confirmó/);
  }
});
test('límites de ajustes consideran devoluciones pendientes y correcciones previas exactamente', () => {
  const op = { id: 1, amount: '800.00', refunded_amount: '100.00' };
  assert.equal(availableAdjustment(op, { refunds: [{ operation_id: 1, amount: '100.00', status: 'confirmed' }, { operation_id: 1, amount: '200.00', status: 'pending' }], operations: [{ original_operation_id: 1, amount: '50.00' }] }), '450.00');
  assert.equal(cents('0.10') + cents('0.20'), cents('0.30'));
  assert.equal(cents('1.001'), null); assert.equal(cents(null), null);
  assert.equal(mxn(null), 'Importe desconocido');
});
test('persistencia conserva un intento incierto y lo elimina solo después de éxito conocido', () => {
  const store = new Map();
  globalThis.window = { sessionStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) } };
  const pending = { key: 'stable-key', amount: '560.00', method: 'external_terminal' };
  writeFinancialAttempt('provider:1:4', pending);
  assert.deepEqual(readFinancialAttempt('provider:1:4'), pending);
  assert.equal(readFinancialAttempt('provider:2:4'), null);
  assert.deepEqual(readFinancialAttempt('provider:1:4'), pending);
  clearFinancialAttempt('provider:1:4');
  assert.equal(readFinancialAttempt('provider:1:4'), null);
});
test('Checkout Pro admite solo HTTPS y dominios Mercado Pago verificados', () => {
  assert(getSafeMercadoPagoUrl('https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=example'));
  for (const url of ['http://mercadopago.com/checkout', 'https://mercadopago.com.evil.test/', 'javascript:alert(1)', null]) assert.equal(getSafeMercadoPagoUrl(url), '');
});

test('ejemplos de configuración usan centavos y redondeo, nunca cambian la cotización', async () => {
  const { policyExample } = await import('../src/lib/agendaFinance.ts');
  assert.deepEqual(policyExample('800.00', { ...offlinePolicy, mode: 'percentage', percentage: '30' }), { total: '800.00', initial: '240.00', remaining: '560.00' });
  assert.deepEqual(policyExample('800.00', { ...offlinePolicy, mode: 'fixed', fixed_amount: '200.00' }), { total: '800.00', initial: '200.00', remaining: '600.00' });
  assert.equal(policyExample('100.00', { ...offlinePolicy, mode: 'fixed', fixed_amount: '200.00' }), null);
});
test('historial financiero distingue estados de solicitud aunque el endpoint no incluya request_state', async () => {
  const { financialRefundState } = await import('../src/lib/agendaFinance.ts');
  assert.equal(financialRefundState({ status: 'pending', external_id: null, last_error: null }), 'pending_request');
  assert.equal(financialRefundState({ status: 'processing', external_id: null, last_error: null }), 'request_in_progress');
  assert.equal(financialRefundState({ status: 'pending', external_id: 'remote', last_error: null }), 'request_sent');
  assert.equal(financialRefundState({ status: 'failed', external_id: null, last_error: 'review_required: cuenta' }), 'review_required');
  assert.equal(financialRefundState({ status: 'failed', external_id: null, last_error: 'timeout' }), 'recoverable_error');
});

test('configuración global conserva flags y decimales; los servicios heredan con null', async () => {
  const { agendaService } = await import('../src/services/agendaService.ts');
  const calls = capture();
  const charge_policy = { ...offlinePolicy, mode: 'percentage', percentage: '30.1250' };
  await agendaService.updatePaymentSettings({ accepts_payments: true, allows_cash_payment: true, allows_online_payment: true, charge_policy });
  await agendaService.updateService(9, { charge_policy: null, duration_minutes: 30 });
  await agendaService.createService({ catalog_service_id: 'catalog-example', duration_minutes: 30, buffer_minutes: 0, is_active: true, display_order: 0, charge_policy });
  assert.equal(calls[0].url, '/api/agenda/payment-settings');
  assert.equal(calls[0].options.method, 'PUT');
  assert.equal(calls[0].payload.charge_policy.percentage, '30.1250');
  assert.equal(calls[0].payload.allows_cash_payment, true);
  assert.equal(calls[1].url, '/api/agenda/services/9');
  assert.equal(calls[1].payload.charge_policy, null);
  assert.deepEqual(calls[2].payload.charge_policy, charge_policy);
});
test('un timeout financiero se recupera con el mismo UUID y datos congelados', async () => {
  const store = new Map();
  globalThis.window = { sessionStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) } };
  const payload = { service_id: 9, start_at: '2026-11-01T10:00:00Z', accepted_terms_version: null, idempotency_key: '5600fe74-cdeb-48c4-aea4-16d04b6d9e04' };
  writeFinancialAttempt('booking:8:guest', payload);
  let first = true;
  const bodies = [];
  globalThis.__financeFetch = async (url, options) => {
    bodies.push(options.body);
    if (first) { first = false; throw new TypeError('Network unavailable'); }
    return Response.json({ booking: { id: 4, finance_version: 2 }, financial: base, payment_intent: null });
  };
  await assert.rejects(api.createFinancialBooking(8, readFinancialAttempt('booking:8:guest')), TypeError);
  const recovered = await api.createFinancialBooking(8, readFinancialAttempt('booking:8:guest'));
  assert.equal(recovered.booking.id, 4);
  assert.equal(bodies[0], bodies[1]);
});
test('notificaciones financieras activan la sincronización existente', async () => {
  const { isAgendaInboxEvent } = await import('../src/types/chat.ts');
  assert.equal(isAgendaInboxEvent({ type: 'agenda.financial_activity', booking_id: 4, supplier_id: 8 }), true);
  assert.equal(isAgendaInboxEvent({ type: 'agenda.financial_activity', booking_id: '4', supplier_id: 8 }), false);
});

test('el plazo explicativo proviene de noticeHours y conserva descripción genérica sin dato', () => {
  for (const hours of [0, 2, 24, 48]) {
    const html = render(PolicyEditor, { value: offlinePolicy, noticeHours: hours, onChange() {} });
    assert(html.includes(`Cancelaciones sin penalización hasta ${hours} horas antes de la cita.`));
  }
  const generic = render(PolicyEditor, { value: offlinePolicy, onChange() {} });
  assert.match(generic, /Se aplica el plazo de cancelación configurado en Agenda/);
  assert.doesNotMatch(generic, /undefined horas|hasta 2 horas/);
});
