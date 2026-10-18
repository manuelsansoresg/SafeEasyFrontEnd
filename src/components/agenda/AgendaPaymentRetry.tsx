'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { canRetryFinancialPayment, paymentActionError, paymentRetryMessage } from '@/lib/agendaFinance';
import { createPaymentRecovery } from '@/lib/agendaPaymentRecovery';
import { agendaBookingService } from '@/services/agendaBookingService';
import { useAuthStore } from '@/store/useAuthStore';
import type { AgendaBooking } from '@/types/agendaBooking';
import type { FinancialSummary } from '@/types/agendaFinance';

export default function AgendaPaymentRetry({ booking, summary, managementToken, disabled, onBusy, verification }: {
  booking: AgendaBooking; summary: FinancialSummary; managementToken?: string | null;
  disabled: boolean; onBusy: (busy: boolean) => void; verification: number;
}) {
  const userId = useAuthStore(s => s.user?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deniedAt, setDeniedAt] = useState<number | null>(null);
  const active = useRef(false);
  const clickLock = useRef(false);
  const latest = useRef({ booking, summary });
  useEffect(() => { latest.current = { booking, summary }; }, [booking, summary]);
  const recovery = useMemo(() => createPaymentRecovery({
    bookingId: booking.id, userId, token: managementToken,
    request: (id, key, token, signal) => agendaBookingService.retryFinancialPayment(id, key, token, signal),
    isCurrent: () => active.current && ['pending', 'confirmed'].includes(latest.current.booking.status) &&
      Date.parse(latest.current.booking.start_at) > Date.now() && canRetryFinancialPayment(latest.current.summary),
    redirect: url => window.location.assign(url),
  }), [booking.id, userId, managementToken]);
  useEffect(() => { active.current = true; return () => { active.current = false; recovery.cancel(); }; }, [recovery]);
  useEffect(() => {
    if (summary.has_confirmed_payment || ['approved', 'refunded'].includes(summary.payment_state ?? '') || !['pending', 'confirmed'].includes(booking.status)) {
      void recovery.clear().catch(() => { /* Never expose replay credentials or storage details. */ });
    }
  }, [recovery, summary.has_confirmed_payment, summary.payment_state, booking.status]);
  const denied = deniedAt === verification;
  const allowed = canRetryFinancialPayment(summary) && Boolean(managementToken || userId) &&
    ['pending', 'confirmed'].includes(booking.status) && !denied;
  const retry = async () => {
    if (clickLock.current || disabled || busy || !allowed) return;
    clickLock.current = true;
    setBusy(true); onBusy(true); setError('');
    try { await recovery.run(summary); }
    catch (err) { if (active.current) { setError(paymentActionError(err)); setDeniedAt(verification); } }
    finally { clickLock.current = false; if (active.current) { setBusy(false); onBusy(false); } }
  };
  return <div className="space-y-3">
    {allowed ? <button type="button" disabled={busy || disabled} aria-busy={busy} onClick={() => void retry()} className="min-h-12 w-full rounded-xl bg-[#168e00] px-5 py-3 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004e28] disabled:opacity-50 sm:w-auto">{busy ? 'Verificando pago…' : 'Reintentar pago'}</button> : null}
    {!allowed && summary.payment_state === 'rejected' ? <p className="text-sm text-gray-600">{denied ? 'Actualiza el estado antes de volver a intentar.' : paymentRetryMessage(summary.retry_block_reason)}</p> : null}
    {error ? <p role="alert" className="text-sm text-amber-900">{error}</p> : null}
  </div>;
}
