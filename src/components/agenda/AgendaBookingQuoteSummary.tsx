'use client';
import { mxn } from '@/lib/agendaFinance';
import type { FinancialQuote } from '@/types/agendaFinance';

export default function AgendaBookingQuoteSummary({ quote, accepted, onAccepted }: {
  quote: FinancialQuote; accepted: boolean; onAccepted: (accepted: boolean) => void;
}) {
  return <>
    <dl className="grid gap-3 sm:grid-cols-3">
      <div><dt className="text-sm">Precio del servicio</dt><dd className="font-bold">{mxn(quote.total)}</dd></div>
      <div><dt className="text-sm">{['fixed', 'percentage'].includes(quote.policy.mode) ? 'Anticipo para reservar' : 'Pago al reservar'}</dt><dd className="font-bold text-[#168e00]">{mxn(quote.initial_required)}</dd></div>
      <div><dt className="text-sm">Saldo restante</dt><dd className="font-bold">{mxn(quote.remaining_after_initial)}</dd></div>
    </dl>
    <p className="text-sm text-gray-700">{quote.policy.mode === 'offline' ? 'Reserva sin pagar en línea. Liquida posteriormente con el establecimiento.' : `Hoy pagas ${mxn(quote.initial_required)} para reservar. ${quote.policy.mode === 'full' ? 'Corresponde al precio completo del servicio.' : `Los ${mxn(quote.remaining_after_initial)} restantes se liquidan posteriormente con el establecimiento.`}`}</p>
    {quote.policy.terms_text ? <details className="rounded-xl bg-[#f2f3f4] p-4">
      <summary className="cursor-pointer text-sm font-semibold text-[#004e28]">Consultar condiciones de cancelación</summary>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">{quote.policy.terms_text}</p>
      {quote.policy.terms_version ? <p className="mt-2 text-xs text-gray-600">Versión: {quote.policy.terms_version}</p> : null}
    </details> : null}
    {quote.acceptance_required ? <label className="flex gap-3 text-sm"><input type="checkbox" checked={accepted} className="size-5 shrink-0 accent-[#168e00]" onChange={e => onAccepted(e.target.checked)} />He leído y acepto las condiciones de cancelación.</label> : null}
  </>;
}
