'use client';
import { financeLabel, mxn, paymentStateLabel } from '@/lib/agendaFinance';
import type { CancellationResult, FinancialSummary } from '@/types/agendaFinance';
export function AgendaCancellationResult({ result }: { result: CancellationResult }) {
  return <div className="space-y-3 rounded-2xl bg-[#f2f3f4] p-4 text-sm" role="status">
    <p className="font-bold text-[#004e28]">Reservación cancelada</p>
    <p>Anticipo que conservará el establecimiento: {mxn(result.retained_amount)}</p>
    {result.review_required ? <p className="font-bold text-amber-900">El resultado requiere revisión del establecimiento.</p> : null}
    {result.refunds.map(refund => <p key={refund.id}>{mxn(refund.amount)} · {financeLabel(refund.method)} · {financeLabel(refund.request_state)}{refund.request_state === 'confirmed' && refund.method === 'online' ? '. Mercado Pago confirmó la devolución; la acreditación depende de tu medio de pago.' : refund.request_state === 'manual_pending' ? '. El establecimiento debe realizar la devolución.' : ''}</p>)}
  </div>;
}
export default function AgendaFinancialSummary({ summary }: { summary: FinancialSummary }) {
  const rows = [
    ['Precio total acordado', summary.total], ['Pago inicial requerido', summary.initial_required],
    ['Anticipo recibido', summary.deposit_confirmed], ['Total cobrado', summary.gross_collected],
    ['Saldo pendiente real', summary.balance_due], ['Devoluciones confirmadas', summary.refunded],
    ['Devoluciones pendientes', summary.refund_pending],
  ] as const;
  return <div className="space-y-4">
    {summary.ledger_version === 2 && summary.payment_state ? <div role="status" aria-live="polite" className="space-y-2 rounded-xl border border-[#004e28]/15 bg-[#f2f3f4] p-4">
      <p className="text-xs font-semibold text-gray-600">Estado del pago en Mercado Pago</p>
      <p className="flex items-start gap-2 font-bold text-[#004e28]"><span aria-hidden="true">{summary.payment_state === 'approved' ? '✓' : summary.payment_state === 'rejected' ? '!' : 'ⓘ'}</span>{paymentStateLabel(summary.payment_state)}</p>
      {summary.payment_state === 'rejected' ? <p className="text-sm">Mercado Pago no aprobó este intento. Consulta los importes recibidos en el resumen.</p> : null}
      {summary.has_active_review || ['pending', 'in_process', 'authorized'].includes(summary.payment_state) ? <p className="text-sm">Aún no se confirma este pago. Espera la respuesta de Mercado Pago antes de intentar nuevamente.</p> : null}
      {summary.payment_updated_at && Number.isFinite(Date.parse(summary.payment_updated_at)) ? <p className="text-xs text-gray-600">Estado informado: {new Date(summary.payment_updated_at).toLocaleString('es-MX')}</p> : null}
    </div> : null}
    <h3 className="font-semibold text-[#004e28]">Resumen financiero de la reservación</h3>
    <p className="inline-flex rounded-full bg-[#004e28]/10 px-3 py-2 text-sm font-bold text-[#004e28]">{financeLabel(summary.settlement_status)}</p>
    {summary.mode === "offline" ? <p className="text-sm text-gray-600">Sin cobro inicial. El saldo se liquida con el establecimiento.</p> : null}
    <dl className="grid gap-3 sm:grid-cols-2">{rows.filter(([label, amount]) => amount !== undefined && (label !== "Anticipo recibido" || summary.mode !== "full")).map(([label, amount]) => <div key={label} className="rounded-xl bg-[#f2f3f4] p-3"><dt className="text-xs text-gray-600">{label}</dt><dd className="mt-1 font-bold text-[#004e28]">{mxn(amount)}</dd></div>)}</dl>
    {summary.review_required || summary.settlement_status === 'review' ? <p role="alert" className="rounded-xl bg-amber-50 p-3 font-semibold text-amber-900">Esta reservación requiere revisión. Consulta con el establecimiento antes de realizar otro cobro.</p> : null}
    {summary.settlement_status === 'pending' ? <p className="text-sm text-gray-600">La reservación conserva un importe pendiente de pago.</p> : null}
  </div>;
}
