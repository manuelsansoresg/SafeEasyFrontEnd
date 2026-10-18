import type { AgendaPaymentRetryResponse, FinancialSummary } from '@/types/agendaFinance';
import { canRetryFinancialPayment, cents } from '@/lib/agendaFinance';
import { clearFinancialAttempt, readFinancialAttempt, writeFinancialAttempt } from '@/lib/agendaFinancialAttempt';
import { getSafeMercadoPagoUrl } from '@/lib/security';

export async function paymentRecoveryScope(bookingId: number, userId?: number, token?: string | null) {
  if (!userId && !token) throw new Error('Acceso de gestión requerido.');
  const identity = `user:${userId ?? 'guest'}:grant:${token ?? ''}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
  const owner = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  return `payment-recovery:${owner}:${bookingId}`;
}
export function verifiedRecoveryUrl(result: AgendaPaymentRetryResponse, bookingId: number) {
  const url = getSafeMercadoPagoUrl(result.checkout_url);
  if (result.booking_id !== bookingId || result.strategy !== 'reuse_existing_checkout' || !url ||
      !Number.isSafeInteger(result.payment_intent_id) || result.payment_intent_id <= 0 ||
      !result.preference_id || result.currency !== 'MXN' || (cents(result.amount) ?? BigInt(0)) <= BigInt(0) ||
      !Number.isFinite(Date.parse(result.expires_at)) || Date.parse(result.expires_at) <= Date.now()) {
    throw new Error('Respuesta de recuperación no verificable.');
  }
  return url;
}
export function createPaymentRecovery(options: {
  bookingId: number; userId?: number; token?: string | null;
  request: (bookingId: number, key: string, token?: string | null, signal?: AbortSignal) => Promise<AgendaPaymentRetryResponse>;
  isCurrent: () => boolean; redirect: (url: string) => void;
}) {
  let running = false;
  let generation = 0;
  return {
    cancel() { generation++; },
    async clear() { clearFinancialAttempt(await paymentRecoveryScope(options.bookingId, options.userId, options.token)); },
    async run(summary: FinancialSummary) {
      if (running || summary.booking_id !== options.bookingId || !canRetryFinancialPayment(summary) || !options.isCurrent()) return false;
      running = true;
      const version = generation;
      const current = () => version === generation && options.isCurrent();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      try {
        const scope = await paymentRecoveryScope(options.bookingId, options.userId, options.token);
        const stored = readFinancialAttempt<{ key: string }>(scope);
        const key = stored?.key ?? crypto.randomUUID();
        if (!/^[a-zA-Z0-9_-]{8,100}$/.test(key)) throw new Error('Intento guardado inválido.');
        writeFinancialAttempt(scope, { key });
        if (!current()) return false;
        const result = await options.request(options.bookingId, key, options.token, controller.signal);
        const url = verifiedRecoveryUrl(result, options.bookingId);
        if (!current()) return false;
        options.redirect(url);
        clearFinancialAttempt(scope);
        return true;
      } finally { clearTimeout(timeout); running = false; }
    },
  };
}
