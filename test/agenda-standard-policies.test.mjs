import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/lib/api') return { url: 'data:text/javascript,export const fetchWithAuth = (...args) => globalThis.__policyFetch(...args)', shortCircuit: true };
    if (specifier.startsWith('@/')) return { url: new URL(`../src/${specifier.slice(2)}${specifier.startsWith('@/components/') ? '.tsx' : '.ts'}`, import.meta.url).href, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith('.tsx')) return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText };
    return next(url, context);
  },
});
const { agendaService: admin } = await import('../src/services/agendaService.ts');
const { agendaBookingService: bookings, AgendaBookingRequestError } = await import('../src/services/agendaBookingService.ts');
const { default: Editor } = await import('../src/components/agenda/AgendaChargePolicyEditor.tsx');
const { default: Consent } = await import('../src/components/agenda/AgendaStandardPolicyConsent.tsx');
const { default: Quote } = await import('../src/components/agenda/AgendaBookingQuoteSummary.tsx');
const { isLegacyChargePolicy, standardChargePolicy, chargePolicyPayload, standardPolicyAuthorized, bookingTermsPayload, refreshRejectedBookingTerms, isTermsVersionError, canRegisterPolicyException, validateChargePolicy } = await import('../src/lib/agendaFinance.ts');
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const central = { policy_available: true, version: 'real-server-v1', content_hash: 'a'.repeat(64), text_template: 'Condiciones recibidas. Plazo: {cancellation_notice_hours} horas.', approved: true, provider_authorized: false, accepted_at: null };
const fixed = { mode: 'fixed', fixed_amount: '200.00' };
const legacy = { ...fixed, percentage: null, retain_deposit: true, retention_authorized: true, terms_text: 'Texto anterior aceptado', terms_version: 'legacy-v1' };
const quote = { ledger_version: 2, service_id: 9, total: '500.00', initial_required: '200.00', remaining_after_initial: '300.00', currency: 'MXN', acceptance_required: true, policy: { ...fixed, policy_source: 'standard', retain_deposit: true, terms_text: 'Condiciones reales del servidor', terms_version: 'real-server-v1:h2:r1' } };
function capture(response = {}) {
  const calls = [];
  globalThis.__policyFetch = async (url, options) => { calls.push({ url, options, body: options.body ? JSON.parse(options.body) : null }); return Response.json(response); };
  return calls;
}
for (const policy of [fixed, { mode: 'percentage', percentage: '30.1250' }, { mode: 'full' }, { mode: 'offline' }]) {
  test(`configuración ${policy.mode} se guarda sin campos legales ni evidencia del navegador`, async () => {
    const calls = capture();
    await admin.updatePaymentSettings({ accepts_payments: true, allows_cash_payment: true, allows_online_payment: true, charge_policy: { ...policy, policy_source: 'standard', retain_deposit: true, retention_authorized: true, terms_version: 'do-not-send', terms_text: 'do-not-send', standard_evidence: { approved: true, provider_authorized: true } } });
    assert.equal(calls[0].url, '/api/agenda/payment-settings');
    assert.deepEqual(calls[0].body.charge_policy, policy);
    assert.equal(calls[0].body.allows_cash_payment, true);
    assert.equal(validateChargePolicy(policy), null);
  });
}
test('guardar o abrir una política heredada no la convierte ni elimina sus condiciones', async () => {
  const original = structuredClone(legacy);
  const calls = capture();
  await admin.updatePaymentSettings({ accepts_payments: true, allows_cash_payment: true, allows_online_payment: true, charge_policy: legacy });
  assert.deepEqual(calls[0].body.charge_policy, legacy);
  assert(isLegacyChargePolicy(legacy));
  assert(isLegacyChargePolicy({ ...legacy, policy_source: 'legacy' }));
  assert.equal(isLegacyChargePolicy({ ...legacy, policy_source: 'standard' }), false);
  const html = render(Editor, { value: legacy, onChange() { assert.fail('Solo consultar no debe cambiar la política'); } });
  assert.match(html, /Texto anterior aceptado/);
  assert.doesNotMatch(html, /<textarea|type="checkbox"|Versión de las condiciones/);
  assert.deepEqual(legacy, original);
});
test('solo la acción explícita del proveedor convierte una política heredada', () => {
  let changed;
  const tree = Editor({ value: legacy, onChange(value) { changed = value; } });
  const visit = node => {
    if (!React.isValidElement(node)) return;
    if (node.type === 'button' && node.props.children === 'Usar condiciones de Drooopy') node.props.onClick();
    React.Children.forEach(node.props.children, visit);
  };
  assert.equal(changed, undefined);
  visit(tree);
  assert.deepEqual(changed, fixed);
  assert.deepEqual(standardChargePolicy(legacy), fixed);
  assert.deepEqual(chargePolicyPayload(changed), fixed);
});
test('política individual y herencia usan los endpoints existentes', async () => {
  const calls = capture();
  await admin.createService({ catalog_service_id: 'catalog', duration_minutes: 30, buffer_minutes: 0, is_active: true, display_order: 0, charge_policy: fixed });
  await admin.updateService(9, { charge_policy: { ...fixed, policy_source: 'standard', retain_deposit: false, terms_text: 'read only' } });
  await admin.updateService(9, { charge_policy: null });
  await admin.updateService(9, { duration_minutes: 45 });
  assert.equal(calls[0].url, '/api/agenda/services');
  assert.equal(calls[1].options.method, 'PATCH');
  assert.deepEqual(calls[1].body.charge_policy, fixed);
  assert.equal(calls[2].body.charge_policy, null);
  assert.equal('charge_policy' in calls[3].body, false);
});
for (const policy of [fixed, { mode: 'percentage', percentage: '30' }, { mode: 'full' }, { mode: 'offline' }]) test(`editor ${policy.mode} solo muestra su campo de importe correspondiente`, () => {
  const html = render(Editor, { value: policy, noticeHours: 7, onChange() {} });
  assert.match(html, /Cancelaciones sin penalización hasta 7 horas/);
  assert.equal(html.includes('Porcentaje de anticipo'), policy.mode === 'percentage');
  assert.equal(html.includes('Anticipo en MXN'), policy.mode === 'fixed');
  assert.doesNotMatch(html, /type="checkbox"|<textarea|Versión de las condiciones|Declaro que/);
  assert.match(html, /h-12 w-full/);
});
test('retención estándar solo se explica como activa con aprobación y autorización reales', () => {
  const inactive = render(Editor, { value: fixed, standardPolicy: { ...central, approved: false }, onChange() {} });
  assert.match(inactive, /pendiente de habilitación por Drooopy/);
  assert.doesNotMatch(inactive, /podrás conservar/);
  const unauthorized = render(Editor, { value: fixed, standardPolicy: central, onChange() {} });
  assert.match(unauthorized, /acepta las condiciones/);
  assert.doesNotMatch(unauthorized, /podrás conservar/);
  const active = render(Editor, { value: fixed, standardPolicy: { ...central, provider_authorized: true }, onChange() {} });
  assert.match(active, /Si el cliente cancela fuera del plazo permitido o no se presenta, podrás conservar/);
  assert.match(active, /anticipo confirmado y disponible/);
  assert.match(active, /excepciones legales/);
  assert.match(active, /Si cancela el negocio/);
  assert.equal(standardPolicyAuthorized({ ...central, approved: false, provider_authorized: true }), false);
});
test('política sin aprobación no ofrece aceptación; aprobada requiere casilla explícita', () => {
  const unapproved = render(Consent, { policy: { ...central, approved: false }, onRefresh() {} });
  assert.doesNotMatch(unapproved, /Aceptar y continuar|type="checkbox"/);
  const needsAcceptance = render(Consent, { policy: central, onRefresh() {} });
  assert.match(needsAcceptance, /He leído y acepto las condiciones de cancelación/);
  assert.match(needsAcceptance, /disabled=""[^>]*>Aceptar y continuar/);
  assert.doesNotMatch(needsAcceptance, /checked=""/);
  assert.doesNotMatch(needsAcceptance, /aaaaaaa|real-server-v1/);
});
test('una autorización previa solo muestra el indicador y otra versión vuelve a pedir aceptación', () => {
  const accepted = render(Consent, { policy: { ...central, provider_authorized: true, accepted_at: '2026-10-18T12:00:00Z' }, onRefresh() {} });
  assert.match(accepted, /Condiciones de cancelación aceptadas/);
  assert.doesNotMatch(accepted, /type="checkbox"|Aceptar y continuar/);
  const renewed = render(Consent, { policy: { ...central, version: 'real-server-v2', content_hash: 'b'.repeat(64) }, onRefresh() {} });
  assert.match(renewed, /type="checkbox"/);
  assert.doesNotMatch(renewed, /checked=""/);
});
test('aceptación envía versión/hash reales y no envía textos ni aprobaciones', async () => {
  const calls = capture(central);
  const actual = await admin.standardCancellationPolicy();
  await admin.acceptStandardCancellationPolicy({ version: actual.version, content_hash: actual.content_hash, accepted: true });
  assert.equal(calls[0].url, '/api/agenda/standard-cancellation-policy');
  assert.equal(calls[1].url, '/api/agenda/standard-cancellation-policy/accept');
  assert.deepEqual(calls[1].body, { version: central.version, content_hash: central.content_hash, accepted: true });
  assert.equal(calls[1].options.retryOnAuthFailure, false);
});
for (const status of [403, 409, 422]) test(`rechazo HTTP ${status} de aceptación no se convierte en consentimiento`, async () => {
  let count = 0;
  globalThis.__policyFetch = async () => { count++; return Response.json({ detail: 'No se autoriza esta versión' }, { status }); };
  await assert.rejects(admin.acceptStandardCancellationPolicy({ version: central.version, content_hash: central.content_hash, accepted: true }), /No se autoriza esta versión/);
  assert.equal(count, 1);
});
test('cliente consulta condiciones reales y solo ve casilla si se requiere', () => {
  const required = render(Quote, { quote, accepted: false, onAccepted() {} });
  assert.match(required, /500\.00/); assert.match(required, /200\.00/); assert.match(required, /300\.00/);
  assert.match(required, /Consultar condiciones de cancelación/);
  assert.match(required, /Condiciones reales del servidor/);
  assert.match(required, /real-server-v1:h2:r1/);
  assert.match(required, /type="checkbox"/);
  assert.doesNotMatch(required, /checked=""/);
  assert.equal(bookingTermsPayload(quote, false), null);
  assert.deepEqual(bookingTermsPayload(quote, true), { accepted_terms_version: quote.policy.terms_version });
  const optional = { ...quote, acceptance_required: false };
  const html = render(Quote, { quote: optional, accepted: false, onAccepted() {} });
  assert.match(html, /Condiciones reales del servidor/);
  assert.doesNotMatch(html, /type="checkbox"/);
  assert.deepEqual(bookingTermsPayload(optional, false), {});
  assert.match(required, /sm:grid-cols-3/);
});
test('rechazo de condiciones requiere nueva aceptación y conserva el UUID y los datos de la reserva', () => {
  const error = new AgendaBookingRequestError('Debes aceptar la versión vigente de las condiciones de cancelación.', 422);
  assert(isTermsVersionError(error));
  assert.equal(isTermsVersionError(new AgendaBookingRequestError(error.message, 409)), false);
  assert.equal(isTermsVersionError(new AgendaBookingRequestError('Correo inválido', 422)), false);
  assert.equal(isTermsVersionError(new TypeError('Network timeout')), false);
  const pending = { service_id: 9, start_at: '2026-11-01T10:00:00Z', customer_name: 'Cliente de prueba', idempotency_key: '5600fe74-cdeb-48c4-aea4-16d04b6d9e04', accepted_terms_version: 'old' };
  assert.equal(refreshRejectedBookingTerms(pending, quote, false), null);
  assert.equal(refreshRejectedBookingTerms(pending, { ...quote, service_id: 10 }, true), null);
  const updated = refreshRejectedBookingTerms(pending, quote, true);
  assert.equal(updated.idempotency_key, pending.idempotency_key);
  assert.equal(updated.start_at, pending.start_at);
  assert.equal(updated.accepted_terms_version, quote.policy.terms_version);
  assert.equal(pending.accepted_terms_version, 'old');
});
test('excepción usa el contrato real y permanece oculta para reservas cerradas, heredadas o con excepción', async () => {
  const history = { operations: [], intents: [], refunds: [], events: [] };
  assert(canRegisterPolicyException({ status: 'confirmed' }, { ledger_version: 2 }, history));
  for (const status of ['cancelled', 'no_show', 'completed']) assert.equal(canRegisterPolicyException({ status }, { ledger_version: 2 }, history), false);
  assert.equal(canRegisterPolicyException({ status: 'confirmed' }, { ledger_version: 1 }, history), false);
  assert.equal(canRegisterPolicyException({ status: 'confirmed' }, { ledger_version: 2 }, { ...history, events: [{ type: 'cancellation_policy_exception' }] }), false);
  const calls = capture({ id: 7, retention_blocked: true });
  const result = await bookings.cancellationPolicyException(4, { reason: 'Excepción documentada', reference: 'Reclamación de prueba' });
  assert.equal(calls[0].url, '/proxy/agenda/appointments/4/cancellation-policy-exception');
  assert.deepEqual(calls[0].body, { reason: 'Excepción documentada', reference: 'Reclamación de prueba' });
  assert.equal(result.retention_blocked, true);
});
