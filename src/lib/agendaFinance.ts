import type { FinancialHistory, FinancialOperation, Money } from '@/types/agendaFinance';

export function isFinancialBooking(booking: { finance_version?: number; ledger_version?: number } | null | undefined) {
  return booking?.finance_version === 2 || booking?.ledger_version === 2;
}
// Integer cents are used only for input limits, never to persist a computed balance.
export function cents(value: Money | null | undefined): bigint | null {
  if (value === null || value === undefined) return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  return match ? BigInt(match[1]) * BigInt(100) + BigInt((match[2] || '').padEnd(2, '0')) : null;
}
export function mxn(value: Money | null | undefined) {
  if (value === null || value === undefined) return 'Importe desconocido';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(parsed) : 'Importe desconocido';
}
export const financialLabels: Record<string, string> = {
  not_required: 'Sin cobro inicial', pending: 'Pago pendiente', partial: 'Saldo pendiente',
  settled: 'Totalmente pagado', refund_pending: 'Reembolso en proceso', refunded: 'Reembolso confirmado',
  review: 'Requiere revisión', unknown: 'Importes por verificar', approved: 'Recibido',
  creating: 'Preparando cobro', ready: 'Checkout pendiente', uncertain: 'Cobro por conciliar',
  rejected: 'Pago rechazado', failed: 'Operación fallida', expired: 'Vencido',
  confirmed: 'Reembolso confirmado', manual_pending: 'Devolución manual pendiente',
  pending_request: 'Devolución pendiente de solicitud', request_in_progress: 'Solicitando devolución',
  request_sent: 'Devolución pendiente de confirmación', recoverable_error: 'Devolución pendiente de recuperación',
  review_required: 'Requiere revisión', cancelled: 'Anulado', processing: 'En proceso',
  cash: 'Efectivo', external_terminal: 'Terminal bancaria', bank_transfer: 'Transferencia bancaria', online: 'Mercado Pago',
};
export const financeLabel = (value: string) => financialLabels[value] || value.replaceAll('_', ' ');
export const openIntent = (status: string) => ['creating', 'ready', 'uncertain'].includes(status);

export function availableAdjustment(operation: FinancialOperation, history: FinancialHistory): string | null {
  const total = cents(operation.amount), refunded = cents(operation.refunded_amount);
  if (total === null || refunded === null) return null;
  let reserved = BigInt(0), reversed = BigInt(0);
  for (const refund of history.refunds.filter(r => r.operation_id === operation.id && r.status !== 'cancelled')) {
    const amount = cents(refund.amount); if (amount === null) return null; reserved += amount;
  }
  for (const reversal of history.operations.filter(o => o.original_operation_id === operation.id)) {
    const amount = cents(reversal.amount); if (amount === null) return null; reversed += amount;
  }
  const result = total - reversed - (reserved > refunded ? reserved : refunded);
  return result > BigInt(0) ? `${result / BigInt(100)}.${String(result % BigInt(100)).padStart(2, '0')}` : '0.00';
}

export function validateChargePolicy(policy: import('@/types/agendaFinance').ChargePolicy | null | undefined): string | null {
  if (!policy) return null;
  if (policy.mode === 'percentage') {
    const value = String(policy.percentage ?? '');
    if (!/^\d+(\.\d{1,4})?$/.test(value) || Number(value) <= 0 || Number(value) > 100) return 'El porcentaje debe ser mayor que cero y no superar 100, con hasta cuatro decimales.';
  } else if (policy.percentage !== null) return 'El porcentaje solo corresponde al anticipo porcentual.';
  if (policy.mode === 'fixed') {
    const amount = cents(policy.fixed_amount);
    if (amount === null || amount <= BigInt(0) || amount > BigInt('999999999999')) return 'Escribe un anticipo válido en MXN con hasta dos decimales.';
  } else if (policy.fixed_amount !== null) return 'El importe fijo solo corresponde al anticipo fijo.';
  if (policy.retain_deposit && (!['percentage', 'fixed'].includes(policy.mode) || !policy.retention_authorized || !policy.terms_version?.trim() || !policy.terms_text?.trim())) return 'La retención requiere anticipo, condiciones con versión y declaración expresa del proveedor.';
  return null;
}

export function policyExample(total: Money, policy: import('@/types/agendaFinance').ChargePolicy) {
  const price = cents(total);
  if (price === null || validateChargePolicy(policy)) return null;
  let initial = BigInt(0);
  if (policy.mode === 'full') initial = price;
  if (policy.mode === 'fixed') initial = cents(policy.fixed_amount)!;
  if (policy.mode === 'percentage') {
    const [whole, fraction = ''] = String(policy.percentage).split('.');
    const scaled = BigInt(whole) * BigInt(10000) + BigInt(fraction.padEnd(4, '0'));
    initial = (price * scaled + BigInt(500000)) / BigInt(1000000);
  }
  if (initial > price) return null;
  const decimal = (value: bigint) => `${value / BigInt(100)}.${String(value % BigInt(100)).padStart(2, '0')}`;
  return { total: decimal(price), initial: decimal(initial), remaining: decimal(price - initial) };
}

export function financialRefundState(refund: Pick<import('@/types/agendaFinance').FinancialRefund, 'status' | 'last_error' | 'external_id'>) {
  if (['confirmed', 'cancelled', 'manual_pending'].includes(refund.status)) return refund.status;
  if (refund.status === 'failed') return refund.last_error?.startsWith('review_required:') ? 'review_required' : 'recoverable_error';
  if (refund.external_id) return 'request_sent';
  return refund.status === 'processing' ? 'request_in_progress' : 'pending_request';
}
