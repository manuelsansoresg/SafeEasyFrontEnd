'use client';
import { useRef, useState } from 'react';
import AgendaModalShell from '@/components/agenda/AgendaModalShell';
import { agendaBookingService as api, AgendaBookingRequestError } from '@/services/agendaBookingService';
import { mxn } from '@/lib/agendaFinance';
import type { AgendaBooking } from '@/types/agendaBooking';
import type { CancellationPreview } from '@/types/agendaFinance';

export default function AgendaFinancialCancellation({ booking, managementToken, onUpdated }: {
  booking: AgendaBooking; managementToken?: string | null; onUpdated: (booking: AgendaBooking) => void;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [loss, setLoss] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const lock = useRef(false);
  const loadPreview = async () => {
    setPreview(null); setLoss(false);
    const next = await api.cancellationPreview(booking.id, managementToken);
    setPreview(next);
  };
  const begin = async () => {
    if (lock.current) return;
    lock.current = true; setWorking(true); setError(''); setOpen(true);
    try { await loadPreview(); }
    catch (err) { setError(err instanceof Error ? err.message : 'No se pudo consultar la vista previa.'); }
    finally { setWorking(false); lock.current = false; }
  };
  const cancel = async () => {
    if (lock.current || !preview?.cancellation_allowed || (preview.requires_loss_confirmation && !loss)) return;
    lock.current = true; setWorking(true); setError('');
    try {
      const updated = await api.cancelBooking(booking.id, { reason: reason.trim() || null, management_token: managementToken || null, preview_token: preview.preview_token, accept_deposit_loss: preview.requires_loss_confirmation && loss });
      onUpdated(updated); setOpen(false);
    } catch (err) {
      if (err instanceof AgendaBookingRequestError && ['cancellation_preview_changed', 'cancellation_loss_confirmation_required'].includes(err.code || '')) {
        try { await loadPreview(); setError('Las condiciones de cancelación cambiaron. Revisa los importes y confirma nuevamente.'); }
        catch { setPreview(null); setError('No se pudieron actualizar las condiciones. Vuelve a consultar antes de cancelar.'); }
      } else {
        // A timeout can occur after commit. Read the booking before any further cancellation.
        setPreview(null); setLoss(false);
        try {
          const updated = managementToken ? await api.getGuestBooking(booking.id, managementToken) : (await api.myBookings()).find(b => b.id === booking.id);
          if (updated?.status === 'cancelled') { onUpdated(updated); setOpen(false); return; }
          setError(err instanceof Error ? err.message : 'Respuesta incierta. Consulta nuevamente el estado antes de confirmar.');
        } catch { setError('No pudimos confirmar el resultado. Actualiza la reservación antes de intentar otra cancelación.'); }
      }
    } finally { lock.current = false; setWorking(false); }
  };
  return <>
    <button type="button" className="mt-3 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white disabled:opacity-40" disabled={working} onClick={() => void begin()}>Consultar cancelación</button>
    <AgendaModalShell hideSubmit={Boolean(preview && !preview.cancellation_allowed)} open={open} title={preview?.requires_loss_confirmation ? 'El plazo de cancelación ha vencido' : preview?.within_deadline ? 'Puedes cancelar sin perder tu anticipo' : 'Cancelar reservación'} saving={working} submitDisabled={!preview?.cancellation_allowed || (preview.requires_loss_confirmation && !loss)} submitLabel={preview?.requires_loss_confirmation ? 'Cancelar y aceptar la pérdida del anticipo' : 'Confirmar cancelación'} cancelLabel="Conservar mi reservación" onClose={() => setOpen(false)} onSubmit={e => { e.preventDefault(); void cancel(); }}>
      {preview ? <>
        <p className="text-sm text-gray-700">{preview.message}</p>
        <p className="text-sm">Plazo configurado: {preview.cancellation_notice_hours} horas antes · {new Date(preview.cancellation_deadline_at).toLocaleString('es-MX')}</p>
        <dl className="grid gap-3 rounded-2xl bg-[#f2f3f4] p-4 text-sm sm:grid-cols-2">{[
          ['Precio acordado', preview.original_total], ['Anticipo pagado', preview.deposit_paid],
          ['Anticipo que conservará el negocio', preview.retained_amount], ['Devolución mediante Mercado Pago', preview.online_refund_amount],
          ['Devolución manual del establecimiento', preview.manual_refund_amount], ['Saldo que ya no se cobrará', preview.balance_waived],
        ].map(([label, amount]) => <div key={String(label)}><dt>{label}</dt><dd className="font-bold text-[#004e28]">{mxn(amount)}</dd></div>)}</dl>
        {preview.review_required ? <p role="alert" className="text-sm text-amber-900">Esta cancelación requiere revisión del establecimiento.</p> : null}
        {preview.cancellation_allowed ? <>
          <label className="block text-sm">Motivo (opcional)<textarea className="mt-2 w-full rounded-xl border border-gray-300 p-3" maxLength={5000} rows={3} value={reason} onChange={e => setReason(e.target.value)} /></label>
          {preview.requires_loss_confirmation ? <label className="flex gap-3 text-sm"><input required type="checkbox" className="size-5 shrink-0 accent-red-600" checked={loss} onChange={e => setLoss(e.target.checked)} />Entiendo que al cancelar perderé mi anticipo de {mxn(preview.retained_amount)}.</label> : null}
          <p className="text-xs text-gray-600">Al confirmar se cancelará la reservación y se solicitarán las devoluciones aplicables. El tiempo de acreditación depende de Mercado Pago y del medio de pago utilizado.</p>
        </> : null}
      </> : <p role="status">{working ? 'Consultando condiciones…' : 'La confirmación está bloqueada hasta consultar una vista previa vigente.'}</p>}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {!preview && !working ? <button type="button" className="rounded-xl border px-4 py-3 text-sm" onClick={() => void begin()}>Volver a consultar</button> : null}
    </AgendaModalShell>
  </>;
}
