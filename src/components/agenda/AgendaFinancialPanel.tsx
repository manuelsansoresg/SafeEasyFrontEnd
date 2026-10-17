'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import AgendaFinancialSummary, { AgendaCancellationResult } from '@/components/agenda/AgendaFinancialSummary';
import AgendaModalShell from '@/components/agenda/AgendaModalShell';
import { availableAdjustment, cents, financialRefundState, financeLabel, mxn, openIntent } from '@/lib/agendaFinance';
import { isExpectedAbort } from '@/lib/agendaRequest';
import { getSafeMercadoPagoUrl } from '@/lib/security';
import { agendaBookingService as api } from '@/services/agendaBookingService';
import { clearFinancialAttempt, readFinancialAttempt, writeFinancialAttempt } from '@/lib/agendaFinancialAttempt';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import type { AgendaBooking } from '@/types/agendaBooking';
import type { FinancialHistory, FinancialSummary, ManualMethod } from '@/types/agendaFinance';

type Action = { kind: 'manual' | 'checkout' | 'reversals' | 'refunds' | 'confirm'; operationId?: number; refundId?: number; max?: string | null };
const inputClass = 'mt-2 block min-h-12 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#168e00] focus:ring-4 focus:ring-[#168e00]/10';
const selectClass = 'h-12 w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 pr-11 text-sm text-gray-900 outline-none transition focus:border-[#168e00] focus:ring-4 focus:ring-[#168e00]/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400';
const buttonClass = 'rounded-xl border border-[#168e00] px-4 py-3 text-sm font-semibold text-[#004e28] disabled:opacity-40';

export default function AgendaFinancialPanel({ booking, provider = false, managementToken, onlineAvailable = false }: {
  booking: AgendaBooking; provider?: boolean; managementToken?: string | null; onlineAvailable?: boolean;
}) {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [history, setHistory] = useState<FinancialHistory | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<ManualMethod>('cash');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [notice, setNotice] = useState('');
  const [cancellation, setCancellation] = useState<import('@/types/agendaFinance').CancellationPreview | null>(null);
  const [attemptReady, setAttemptReady] = useState(!provider);
  const lock = useRef(false);
  const attempt = useRef<{ key: string; action: Action; amount: string; method: ManualMethod; reference: string; reason: string } | null>(null);
  const userId = useAuthStore(s => s.user?.id);
  const attemptScope = `provider:${userId}:${booking.id}`;
  const sequence = useRef(0);
  useEffect(() => {
    if (!provider) return;
    try {
      const stored = readFinancialAttempt<NonNullable<typeof attempt.current>>(attemptScope);
      attempt.current = stored;
      if (stored) { setAttempted(true); setAmount(stored.amount); setMethod(stored.method); setReference(stored.reference); setReason(stored.reason); setConfirmed(false); }
      setAttemptReady(true);
    } catch { setError('No se pudo recuperar el intento pendiente. Revisa los movimientos antes de continuar.'); }
  }, [provider, attemptScope]);
  const subscribe = useChatStore(s => s.subscribeToInboxEvents);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const current = ++sequence.current;
    setLoading(true);
    try {
      const [next, movements, cancellationStatus] = await Promise.all([
        api.financialSummary(booking.id, provider, managementToken, signal),
        provider ? api.financialHistory(booking.id, signal) : Promise.resolve(null),
        !provider && booking.status === "cancelled" ? api.cancellationPreview(booking.id, managementToken, signal) : Promise.resolve(null),
      ]);
      if (signal?.aborted || current !== sequence.current) return;
      setSummary(next); setHistory(movements); setCancellation(cancellationStatus); setError('');
    } catch (err) {
      if (!isExpectedAbort(err, signal) && current === sequence.current) setError(err instanceof Error ? err.message : 'No se pudo actualizar el resumen.');
    } finally { if (current === sequence.current && !signal?.aborted) setLoading(false); }
  }, [booking.id, booking.status, provider, managementToken]);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => { controller.abort(); };
  }, [refresh, booking.updated_at, booking.status]);
  useEffect(() => subscribe(event => {
    if ('booking_id' in event && event.booking_id === booking.id && String(event.type).startsWith('agenda.')) void refresh();
  }), [subscribe, booking.id, refresh]);
  // Read-only recovery for late webhooks and guest sessions, with no overlapping polls.
  useEffect(() => {
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (document.visibilityState === 'visible') await refresh();
      if (!stopped) timer = setTimeout(tick, 15000);
    };
    timer = setTimeout(tick, 15000);
    const focus = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', focus);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', focus); };
  }, [refresh]);

  const begin = (next: Action) => {
    try {
      const stored = readFinancialAttempt<NonNullable<typeof attempt.current>>(attemptScope);
      if (stored) {
        attempt.current = stored; setAttempted(true); setAmount(stored.amount); setMethod(stored.method); setReference(stored.reference); setReason(stored.reason); setConfirmed(false);
      }
    } catch { setError('No se pudo recuperar el intento pendiente. Revisa los movimientos antes de continuar.'); return; }
    if (attempt.current) { setAction(attempt.current.action); return; }
    setAction(next); setAmount(next.max || ''); setReference(''); setReason(''); setConfirmed(false); setActionError(''); setAttempted(false);
    setMethod(summary?.allowed_manual_methods[0] ?? 'cash');
  };
  const submit = async () => {
    if (!action || lock.current || !confirmed || !summary || !history) return;
    const data = attempt.current ?? { key: crypto.randomUUID(), action, amount, method, reference, reason };
    lock.current = true; setWorking(true); setActionError('');
    try {
      writeFinancialAttempt(attemptScope, data);
      attempt.current = data; setAttempted(true);
      const a = data.action;
      if (a.kind === 'manual') await api.registerManualPayment(booking.id, { amount: data.amount, method: data.method, reference: data.reference.trim() || null, idempotency_key: data.key });
      else if (a.kind === 'checkout') {
        const intent = await api.createBalanceIntent(booking.id, data.key);
        const url = getSafeMercadoPagoUrl(intent.checkout_url);
        setNotice(url ? 'Enlace creado. Puedes abrirlo o copiarlo en el historial de cobros.' : 'El cobro está pendiente de confirmación o conciliación. Actualiza su estado.');
      } else if (a.kind === 'confirm' && a.refundId) await api.confirmFinancialManualRefund(booking.id, a.refundId, data.reference.trim());
      else if (a.operationId && (a.kind === 'refunds' || a.kind === 'reversals')) await api.adjustPayment(booking.id, a.operationId, a.kind, { amount: data.amount, reason: data.reason.trim(), idempotency_key: data.key });
      clearFinancialAttempt(attemptScope);
      attempt.current = null; setAttempted(false); setAction(null); setNotice(data.action.kind === 'checkout' ? 'Consulta el enlace o el estado del Checkout en el historial de cobros.' : 'Operación registrada. El resumen se actualiza desde el servidor.');
    } catch (err) {
      setActionError(`${err instanceof Error ? err.message : 'Respuesta incierta.'} Se conserva el mismo intento para evitar duplicados.`);
    } finally { await refresh(); lock.current = false; setWorking(false); }
  };
  const activeIntent = history?.intents.some(i => openIntent(i.status));
  const blocked = !attemptReady || Boolean(error) || loading || !summary || Boolean(summary.review_required) || ['review', 'unknown', 'refund_pending'].includes(summary.settlement_status);
  const inputAmount = cents(amount), maximum = cents(action?.max);
  const validAmount = inputAmount !== null && inputAmount > BigInt(0) && maximum !== null && inputAmount <= maximum;
  const needsAmount = action && ['manual', 'refunds', 'reversals'].includes(action.kind);
  const valid = confirmed && (!needsAmount || validAmount) && (!action || !['refunds', 'reversals'].includes(action.kind) || reason.trim().length >= 3) && (action?.kind !== 'confirm' || reference.trim().length >= 3);
  return <section className="mt-4 space-y-4 rounded-2xl border border-[#004e28]/15 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold text-[#004e28]">{provider ? 'Pagos de la reservación' : 'Resumen de pago'}</h2><button className={buttonClass} type="button" disabled={loading} onClick={() => void refresh()}>{loading ? 'Actualizando…' : 'Actualizar estado'}</button></div>
    {error ? <p role="alert" className="text-sm text-amber-900">{error}</p> : null}
    {summary ? <AgendaFinancialSummary summary={summary} /> : <p role="status">Consultando importes…</p>}
    {booking.cancellation_result ? <details><summary className="cursor-pointer text-sm font-semibold text-[#004e28]">Resultado informado al cancelar</summary><AgendaCancellationResult result={booking.cancellation_result} /></details> : null}
    {cancellation ? <div className="space-y-2 rounded-xl bg-[#f2f3f4] p-4 text-sm" role="status"><p className="font-bold text-[#004e28]">Estado actual de la cancelación</p><p>Anticipo retenido: {mxn(cancellation.retained_amount)}</p><p>Devolución online pendiente: {mxn(cancellation.online_refund_amount)}</p><p>Devolución manual a cargo del establecimiento: {mxn(cancellation.manual_refund_amount)}</p><p>Devoluciones confirmadas: {mxn(summary?.refunded)}</p><p className="text-xs">Las devoluciones confirmadas por Mercado Pago pueden tardar en acreditarse según el medio de pago.</p></div> : null}
    {notice ? <p role="status" className="text-sm text-[#004e28]">{notice}</p> : null}
    {provider && summary && history ? <>
      {attempted ? <button type="button" className={buttonClass} onClick={() => attempt.current && setAction(attempt.current.action)}>Revisar intento pendiente</button> : null}
      {!['cancelled', 'no_show'].includes(booking.status) && cents(summary.balance_due) !== null && cents(summary.balance_due)! > BigInt(0) ? <div className="flex flex-wrap gap-3">
        <button type="button" className="rounded-xl bg-[#168e00] px-5 py-3 font-bold text-white disabled:opacity-40" disabled={blocked || activeIntent || !summary.allowed_manual_methods.length || attempted} onClick={() => begin({ kind: 'manual', max: String(summary.balance_due) })}>Cobrar saldo</button>
        {onlineAvailable ? <button type="button" className={buttonClass} disabled={blocked || activeIntent || attempted} onClick={() => begin({ kind: 'checkout' })}>Cobrar con Mercado Pago</button> : null}
      </div> : null}
      {activeIntent ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Existe un Checkout pendiente o incierto. Espera su confirmación o conciliación antes de registrar otro cobro.</p> : null}
      <details className="space-y-3"><summary className="cursor-pointer py-3 font-bold text-[#004e28]">Historial financiero</summary>
        {history.operations.map(op => {
          const max = availableAdjustment(op, history);
          return <article key={op.id} className="space-y-2 rounded-xl bg-[#f2f3f4] p-3 text-sm"><p className="font-bold">{op.kind === 'reversal' ? 'Corrección' : 'Cobro'} · {mxn(op.amount)} · {financeLabel(op.method)}</p><p>{financeLabel(op.status)} · {new Date(op.created_at).toLocaleString('es-MX')}</p>{op.reference ? <p>Referencia: {op.reference}</p> : null}
            {op.kind === 'charge' && op.status !== 'charged_back' && op.confirmed_at && cents(max) !== null && cents(max)! > BigInt(0) && !blocked && !attempted ? <div className="flex flex-wrap gap-2">{op.method !== 'online' ? <button type="button" className={buttonClass} onClick={() => begin({ kind: 'reversals', operationId: op.id, max })}>Corregir pago manual</button> : null}<button type="button" className={buttonClass} onClick={() => begin({ kind: 'refunds', operationId: op.id, max })}>Solicitar devolución</button></div> : null}
          </article>;
        })}
        {history.intents.map(intent => {
          const url = getSafeMercadoPagoUrl(intent.checkout_url);
          return <article key={intent.id} className="rounded-xl border border-gray-200 p-3 text-sm"><p>Checkout · {mxn(intent.amount)} · {financeLabel(intent.status)}</p>{intent.expires_at ? <p>Vence: {new Date(intent.expires_at).toLocaleString("es-MX")}</p> : null}{url && intent.status === 'ready' ? <div className="mt-3 flex flex-wrap gap-3"><a href={url} target="_blank" rel="noopener noreferrer" className={buttonClass}>Abrir enlace de pago</a><button type="button" className={buttonClass} onClick={() => { void navigator.clipboard.writeText(url).then(() => setNotice('Enlace copiado.'), () => setNotice('No se pudo copiar. Abre el enlace para compartirlo.')); }}>Copiar enlace</button></div> : null}</article>;
        })}
        {history.refunds.map(refund => {
          const method = history.operations.find(o => o.id === refund.operation_id)?.method;
          return <article key={refund.id} className="rounded-xl bg-[#f2f3f4] p-3 text-sm"><p>{mxn(refund.amount)} · {financeLabel(financialRefundState(refund))} · {method ? financeLabel(method) : 'Método por consultar'}</p><p>{new Date(refund.created_at).toLocaleString('es-MX')}</p>{refund.manual_reference ? <p>Referencia: {refund.manual_reference}</p> : null}{refund.last_error ? <p className="text-amber-900">{refund.last_error}</p> : null}{refund.status === 'manual_pending' && method && method !== 'online' ? <button type="button" className={buttonClass} disabled={attempted} onClick={() => begin({ kind: 'confirm', refundId: refund.id })}>Confirmar devolución realizada</button> : null}</article>;
        })}
        <details><summary className="cursor-pointer py-2">Eventos de la reservación</summary>{history.events.map(event => <p key={event.id} className="py-2 text-xs text-gray-600">{financeLabel(event.type)} · {new Date(event.created_at).toLocaleString('es-MX')}</p>)}</details>
      </details>
    </> : null}
    <AgendaModalShell open={Boolean(action)} title={action?.kind === 'manual' ? 'Cobrar saldo' : action?.kind === 'checkout' ? 'Crear enlace de pago' : action?.kind === 'reversals' ? 'Corregir pago manual' : action?.kind === 'confirm' ? 'Confirmar devolución realizada' : 'Solicitar devolución'} saving={working} submitDisabled={!valid} submitLabel={action?.kind === 'manual' ? 'Registrar pago recibido' : 'Confirmar operación'} onClose={() => setAction(null)} onSubmit={e => { e.preventDefault(); void submit(); }}>
      <fieldset disabled={working || attempted} className="space-y-4 disabled:opacity-70">
        {action?.kind === 'manual' ? <><label className="block text-sm">Método<span className="relative mt-2 block"><select className={selectClass} value={method} onChange={e => setMethod(e.target.value as ManualMethod)}>{summary?.allowed_manual_methods.map(value => <option key={value} value={value}>{financeLabel(value)}</option>)}</select><ChevronDown aria-hidden="true" size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" /></span></label>{method === 'external_terminal' ? <p className="rounded-xl bg-amber-50 p-3 text-sm">Realiza primero el cobro en tu terminal. Después confirma aquí el importe recibido para actualizar el saldo de la reservación.</p> : null}</> : null}
        {needsAmount ? <label className="block text-sm">Importe en MXN (máximo {mxn(action?.max)})<input className={inputClass} required type="number" min="0.01" step="0.01" max={action?.max ?? undefined} value={amount} onChange={e => setAmount(e.target.value)} /></label> : null}
        {action?.kind === 'manual' || action?.kind === 'confirm' ? <label className="block text-sm">Referencia o comprobante<input className={inputClass} required={action.kind === 'confirm'} maxLength={255} minLength={action.kind === 'confirm' ? 3 : undefined} value={reference} onChange={e => setReference(e.target.value)} /></label> : null}
        {action?.kind === 'refunds' || action?.kind === 'reversals' ? <label className="block text-sm">Motivo<textarea className={inputClass} required minLength={3} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label> : null}
        <p className="text-sm text-gray-600">{action?.kind === 'reversals' ? 'Se agregará un movimiento de ajuste, sin borrar el original.' : action?.kind === 'confirm' ? 'Primero realiza físicamente la devolución al cliente. Confirma únicamente cuando hayas devuelto el dinero.' : action?.kind === 'refunds' ? `Solicitarás una devolución de ${mxn(amount)}. El servidor informará su estado real.` : action?.kind === 'checkout' ? 'El servidor generará un Checkout Pro para el saldo exigible.' : 'Confirma únicamente el dinero que efectivamente recibiste.'}</p>
      </fieldset>
        <label className="flex gap-3 text-sm"><input disabled={working} type="checkbox" required className="size-5 accent-[#168e00]" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />{action?.kind === 'manual' ? 'Confirmo que recibí este importe.' : 'He revisado los datos y confirmo esta operación.'}</label>
      {actionError ? <p role="alert" className="text-sm text-amber-900">{actionError}</p> : null}
      {attempted ? <p className="text-sm text-gray-600">Los datos permanecen bloqueados para repetir exclusivamente el mismo intento. Consulta el historial antes de reintentarlo.</p> : null}
    </AgendaModalShell>
  </section>;
}
