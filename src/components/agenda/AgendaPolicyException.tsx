'use client';
import { useRef, useState } from 'react';
import AgendaModalShell from '@/components/agenda/AgendaModalShell';
import { agendaBookingService } from '@/services/agendaBookingService';

export default function AgendaPolicyException({ bookingId, onRefresh }: { bookingId: number; onRefresh: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reference, setReference] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const lock = useRef(false);
  const frozen = useRef<{ reason: string; reference: string | null } | null>(null);
  const submit = async () => {
    if (lock.current || (!frozen.current && reason.trim().length < 3)) return;
    frozen.current ??= { reason: reason.trim(), reference: reference.trim() || null };
    lock.current = true; setWorking(true); setSubmitted(true); setError('');
    try {
      await agendaBookingService.cancellationPolicyException(bookingId, frozen.current);
      setNotice('Excepción registrada. La cancelación seguirá su proceso normal con los importes que determine el servidor.');
      setOpen(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo confirmar el registro. Consulta el estado antes de repetir.'); }
    finally { await onRefresh(); setWorking(false); lock.current = false; }
  };
  return <>
    <button type="button" className="min-h-11 text-sm font-semibold text-[#004e28] underline" onClick={() => setOpen(true)}>Registrar excepción de cancelación</button>
    {notice ? <p role="status" className="text-sm text-[#004e28]">{notice}</p> : null}
    <AgendaModalShell open={open} title="Registrar excepción de cancelación" description="La excepción impide la retención automática en esta cita. No cancela la reservación ni inicia una devolución por sí sola." saving={working} submitLabel="Registrar excepción" submitDisabled={reason.trim().length < 3} onClose={() => setOpen(false)} onSubmit={e => { e.preventDefault(); void submit(); }}>
      <fieldset disabled={working || submitted} className="space-y-4">
        <label className="block text-sm">Motivo<textarea required minLength={3} maxLength={1000} rows={3} className="mt-2 w-full rounded-xl border border-gray-200 p-3" value={reason} onChange={e => setReason(e.target.value)} /></label>
        <label className="block text-sm">Referencia (opcional)<input maxLength={255} className="mt-2 h-12 w-full rounded-xl border border-gray-200 px-4" value={reference} onChange={e => setReference(e.target.value)} /></label>
      </fieldset>
      <p className="text-sm text-gray-600">El motivo quedará registrado y no se podrá editar. El establecimiento debe documentar la excepción aplicable.</p>
      {error ? <p role="alert" className="text-sm text-amber-900">{error} Si repites, se enviarán los mismos datos.</p> : null}
    </AgendaModalShell>
  </>;
}
