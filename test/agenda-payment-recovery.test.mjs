import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === '@/lib/api') return {url:'data:text/javascript,export const fetchWithAuth=(...args)=>globalThis.__recoveryFetch(...args)',shortCircuit:true};
    if (specifier.startsWith('@/')) return {url:new URL(`../src/${specifier.slice(2)}${specifier.startsWith('@/components/')?'.tsx':'.ts'}`,import.meta.url).href,shortCircuit:true};
    return next(specifier,context);
  },
  load(url,context,next) {
    if (url.endsWith('.tsx')) return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};
    return next(url,context);
  },
});
const {agendaBookingService:api,AgendaBookingRequestError}=await import('../src/services/agendaBookingService.ts');
const {default:Summary}=await import('../src/components/agenda/AgendaFinancialSummary.tsx');
const {canRetryFinancialPayment,paymentActionError,paymentRetryMessage}=await import('../src/lib/agendaFinance.ts');
const {createPaymentRecovery,paymentRecoveryScope}=await import('../src/lib/agendaPaymentRecovery.ts');
const {readFinancialAttempt}=await import('../src/lib/agendaFinancialAttempt.ts');
const base={booking_id:7,ledger_version:2,total:'200.00',initial_required:'10.00',deposit_confirmed:'0.00',gross_collected:'0.00',balance_due:'200.00',refunded:'0.00',refund_pending:'0.00',settlement_status:'pending',mode:'fixed',review_required:false,allowed_manual_methods:[],payment_state:'rejected',can_retry_payment:true,retry_strategy:'reuse_existing_checkout',retry_block_reason:null};
const valid=()=>({booking_id:7,payment_intent_id:12,preference_id:'existing',checkout_url:'https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=existing',amount:'10.00',currency:'MXN',expires_at:new Date(Date.now()+3600000).toISOString(),strategy:'reuse_existing_checkout'});
const render=data=>renderToStaticMarkup(React.createElement(Summary,{summary:data}));
let storage;
test.beforeEach(()=>{storage=new Map();globalThis.window={sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};});
function controller(overrides={}) {
  const redirects=[],calls=[];
  const recovery=createPaymentRecovery({bookingId:7,userId:42,isCurrent:()=>true,redirect:url=>redirects.push(url),request:async(...args)=>{calls.push(args);return valid();},...overrides});
  return {recovery,calls,redirects};
}
const labels={approved:'Pago aprobado',rejected:'Pago rechazado',pending:'Pago pendiente de confirmación',in_process:'Mercado Pago está revisando el pago',authorized:'Pago autorizado, pendiente de confirmación',cancelled:'Intento de pago cancelado',refunded:'Pago devuelto',in_mediation:'Pago en disputa',charged_back:'Pago sujeto a contracargo',not_started:'Todavía no hay un pago confirmado',invalid:'El estado requiere verificación',future_status:'El estado requiere verificación'};
for(const [state,label] of Object.entries(labels)) test(`presentación accesible de ${state}`,()=>{
  const html=render({...base,payment_state:state,payment_status_detail:'SECRET_INTERNAL_REASON'});
  assert(html.includes(label));assert(html.includes('role="status"'));assert(html.includes('aria-live="polite"'));assert(!html.includes('SECRET_INTERNAL_REASON'));
  assert(html.includes('Resumen financiero de la reservación'));assert(html.includes('sm:grid-cols-2'));
});
test('rechazo no sustituye importes ni se confunde con liquidación pendiente',()=>{
  const html=render(base);assert(html.includes('Pago rechazado'));assert(html.includes('$200.00'));assert(html.includes('$10.00'));assert(html.includes('$0.00'));assert(html.includes('Pago pendiente'));
});
test('aprobado usa 10 recibidos y saldo 190 del servidor; no usa último rechazo',()=>{
  const html=render({...base,payment_state:'approved',last_payment_attempt_state:'rejected',deposit_confirmed:'10.00',gross_collected:'10.00',balance_due:'190.00',settlement_status:'partial'});
  assert(html.includes('Pago aprobado'));assert(!html.includes('Pago rechazado'));assert(html.includes('$190.00'));
});
test('v1 sin campos nuevos sigue presentando cifras sin estado MP inventado',()=>{
  const html=render({...base,ledger_version:1,payment_state:undefined,can_retry_payment:undefined});assert(!html.includes('Estado del pago en Mercado Pago'));assert(html.includes('$200.00'));
});
for(const state of ['pending','in_process','approved','authorized','refunded','in_mediation','charged_back','invalid','not_started'])test(`nunca permite reintento para ${state}`,async()=>{
  const {recovery,calls,redirects}=controller();assert.equal(await recovery.run({...base,payment_state:state}),false);assert.equal(calls.length,0);assert.equal(redirects.length,0);
});
for(const field of ['has_active_review','has_pending_payment','has_confirmed_payment','review_required']) test(`indicador ${field} impide repetir`,()=>assert.equal(canRetryFinancialPayment({...base,[field]:true}),false));
test('autorización exige indicador exacto y estrategia conocida de v2',()=>{
  assert(canRetryFinancialPayment(base));for(const data of [{can_retry_payment:false},{can_retry_payment:undefined},{retry_strategy:null},{retry_strategy:'new_checkout'},{ledger_version:1}])assert(!canRetryFinancialPayment({...base,...data}));
});
for(const provider of [false,true])test(`actualización ${provider?'proveedor':'cliente'} usa POST sin body y GET permanece de lectura`,async()=>{
  const calls=[];globalThis.__recoveryFetch=async(url,options)=>{calls.push({url,options});return Response.json(base);};
  await api.refreshFinancialSummary(7,provider,provider?undefined:'guest-token');await api.financialSummary(7,provider,provider?undefined:'guest-token');
  assert.equal(calls[0].url,provider?'/proxy/agenda/appointments/7/financial-summary/refresh':'/proxy/public/agenda/bookings/7/financial-summary/refresh?management_token=guest-token');assert.equal(calls[0].options.method,'POST');assert.equal(calls[0].options.body,undefined);assert.equal(calls[1].options.method,undefined);assert.equal(calls[0].options.cache,'no-store');
});
for(const token of [undefined,'guest-token'])test(`recuperación ${token?'invitado':'autenticado'} solo envía la clave`,async()=>{
  const calls=[];globalThis.__recoveryFetch=async(url,options)=>{calls.push({url,options});return Response.json(valid());};await api.retryFinancialPayment(7,'stable-uuid-key',token);
  assert.equal(calls[0].url,`/proxy/public/agenda/bookings/7/payments/retry${token?'?management_token=guest-token':''}`);assert.deepEqual(JSON.parse(calls[0].options.body),{idempotency_key:'stable-uuid-key'});assert.equal(calls[0].options.retryOnAuthFailure,false);
});
test('redirige únicamente tras respuesta autorizada y limpia la clave',async()=>{
  const {recovery,redirects}=controller();assert(await recovery.run(base));assert.deepEqual(redirects,[valid().checkout_url]);assert.equal(readFinancialAttempt(await paymentRecoveryScope(7,42)),null);
});
test('dos clics simultáneos producen una solicitud',async()=>{
  let resolve,started;const ready=new Promise(r=>started=r);const response=new Promise(r=>resolve=r);let count=0;
  const {recovery}=controller({request:async()=>{count++;started();return response;}});const first=recovery.run(base);await ready;assert.equal(await recovery.run(base),false);resolve(valid());assert(await first);assert.equal(count,1);
});
test('timeout y recarga conservan clave para el mismo usuario y reserva',async()=>{
  const keys=[];let failing=true;const request=async(id,key)=>{keys.push(key);if(failing)throw new DOMException('Timed out','AbortError');return valid();};
  const first=controller({request});await assert.rejects(first.recovery.run(base));assert.equal(first.redirects.length,0);failing=false;
  const next=controller({request});assert(await next.recovery.run(base));assert.equal(keys[0],keys[1]);assert.match(keys[0],/^[a-zA-Z0-9_-]{8,100}$/);
});
test('scope separa usuarios, invitados y reservaciones sin token en la clave',async()=>{
  const scopes=await Promise.all([paymentRecoveryScope(7,1),paymentRecoveryScope(7,2),paymentRecoveryScope(8,1),paymentRecoveryScope(7,undefined,'private-token'),paymentRecoveryScope(7,undefined,'other-token')]);assert.equal(new Set(scopes).size,5);assert(scopes.every(s=>!s.includes('private-token')));
});
test('cambio de reservación o desmontaje no redirige una respuesta tardía',async()=>{
  let resolve,started;const ready=new Promise(r=>started=r);const response=new Promise(r=>resolve=r);const {recovery,redirects}=controller({request:async()=>{started();return response;}});const task=recovery.run(base);await ready;recovery.cancel();resolve(valid());assert.equal(await task,false);assert.equal(redirects.length,0);
});
test('pago aprobado mientras se verifica impide redirección',async()=>{
  let eligible=true;const {recovery,redirects}=controller({isCurrent:()=>eligible,request:async()=>{eligible=false;return valid();}});assert.equal(await recovery.run(base),false);assert.equal(redirects.length,0);
});
for(const patch of [{booking_id:8},{strategy:'new_checkout'},{checkout_url:'javascript:alert(1)'},{checkout_url:'https://mercadopago.com.evil.invalid/pay'},{checkout_url:'http://mercadopago.com/pay'},{expires_at:'2000-01-01T00:00:00Z'},{expires_at:'invalid'},{payment_intent_id:0},{currency:'USD'},{amount:'0.00'}])test(`respuesta no verificable ${JSON.stringify(patch)} no redirige`,async()=>{
  const {recovery,redirects}=controller({request:async()=>({...valid(),...patch})});await assert.rejects(recovery.run(base));assert.equal(redirects.length,0);assert(storage.size>0);
});
for(const status of [401,403,404,409,422,429,500,502,503])test(`HTTP ${status} no redirige ni repite automáticamente`,async()=>{
  let count=0;globalThis.__recoveryFetch=async()=>{count++;return Response.json({detail:{code:'payment_pending',message:'PRIVATE_SERVER_DETAIL'}},{status});};
  const {recovery,redirects}=controller({request:(...args)=>api.retryFinancialPayment(...args)});
  await assert.rejects(recovery.run(base),err=>{assert.equal(err.status,status);assert(!paymentActionError(err).includes('PRIVATE_SERVER_DETAIL'));return true;});assert.equal(redirects.length,0);assert.equal(count,1);
});
for(const code of ['payment_pending','payment_already_confirmed','reconciliation_required','reconciliation_in_progress','reconciliation_unavailable','reconciliation_incomplete','checkout_expired','booking_closed','booking_expired','financial_review','checkout_uncertain','payment_uncertain','finance_disabled','legacy_booking','multiple_or_missing_intents','contract_mismatch','payment_identity_mismatch','checkout_identity_mismatch','checkout_contract_mismatch','checkout_expiration_unverified','checkout_url_unverified','checkout_url_mismatch','checkout_not_active','online_payments_disabled'])test(`bloqueo ${code} tiene mensaje seguro`,()=>{
  const message=paymentRetryMessage(code);assert(message.length>10);assert(!message.includes(code));assert.equal(paymentActionError(new AgendaBookingRequestError('PRIVATE',409,code)),message);
});
test('render de pagos no elimina presentación de devoluciones ni alerta de revisión',()=>{
  const html=render({...base,review_required:true,refunded:'10.00',refund_pending:'5.00'});assert(html.includes('Devoluciones confirmadas'));assert(html.includes('Devoluciones pendientes'));assert(html.includes('role="alert"'));
});
test('wiring del panel mantiene polling GET, manual POST y ningún enlace antiguo del proveedor',()=>{
  const panel=readFileSync(new URL('../src/components/agenda/AgendaFinancialPanel.tsx',import.meta.url),'utf8');
  const read=panel.slice(panel.indexOf('const refresh ='),panel.indexOf('const refreshRemote ='));assert(read.includes('api.financialSummary('));assert(!read.includes('refreshFinancialSummary'));
  const remote=panel.slice(panel.indexOf('const refreshRemote ='),panel.indexOf('useEffect(() => () =>'));assert(remote.includes('api.refreshFinancialSummary(booking.id, provider, managementToken)'));assert(remote.includes('api.financialHistory'));assert(remote.includes('setCooldown'));
  assert(panel.includes('onClick={() => void refreshRemote()}'));assert(!panel.includes('Abrir enlace de pago'));assert(!panel.includes('navigator.clipboard'));assert(panel.includes('!provider && summary'));
});
test('recuperar creación conocida va a gestión sin Checkout guardado ni nueva reserva',()=>{
  const page=readFileSync(new URL('../src/app/agenda/[supplierId]/page.tsx',import.meta.url),'utf8');const branch=page.slice(page.indexOf('if (financialAttempt.current?.bookingId)'),page.indexOf('if (createdBookingId.current !== null)'));
  assert(branch.includes('router.push(`/agenda/bookings/'));assert(!branch.includes('window.location.assign'));assert(!branch.includes('createFinancialBooking'));
  assert(page.includes('!recoveringCreation && result.financial.payment_state === "not_started"'));
});
test('botón móvil incluye texto, foco visible y bloqueo síncrono de doble clic',()=>{
  const source=readFileSync(new URL('../src/components/agenda/AgendaPaymentRetry.tsx',import.meta.url),'utf8');assert(source.includes('min-h-12 w-full'));assert(source.includes('focus-visible:outline'));assert(source.includes('aria-busy'));assert(source.includes('clickLock.current = true'));assert(source.includes('Verificando pago…'));assert(source.includes('role="alert"'));
});

test('timeout aborta la consulta y conserva credenciales de replay sin autorizar redirección',async t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  let started;const ready=new Promise(resolve=>started=resolve);
  const {recovery,redirects}=controller({request:async(id,key,token,signal)=>{started();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Timeout','AbortError')),{once:true}));}});
  const task=recovery.run(base);await ready;
  const rejected=assert.rejects(task);t.mock.timers.tick(60000);await rejected;
  assert.equal(redirects.length,0);assert(storage.size>0);
});
test('mismo token no mezcla claves entre usuarios autenticados distintos',async()=>{
  assert.notEqual(await paymentRecoveryScope(7,1,'grant'),await paymentRecoveryScope(7,2,'grant'));
});
