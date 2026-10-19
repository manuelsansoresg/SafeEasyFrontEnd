'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import AgendaModalShell from '@/components/agenda/AgendaModalShell';
import { agendaBookingService as api, AgendaBookingRequestError } from '@/services/agendaBookingService';
import { formatAgendaDate } from '@/lib/agendaCalendar';
import type { AgendaProviderBooking, AgendaRescheduleRequest } from '@/types/agendaBooking';
export default function AgendaRescheduleRequestsModal({ booking, serviceName, timezone, refreshKey, requestId, onClose, onDecision }: {
  booking: AgendaProviderBooking; serviceName?: string; timezone: string; refreshKey: number; requestId?: number | null; onClose: () => void; onDecision: () => Promise<void>;
}) {
  const [requests, setRequests] = useState<AgendaRescheduleRequest[]>([]);
  const [choice, setChoice] = useState<{ id: number; approve: boolean } | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const lock = useRef(false), sequence = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const current = ++sequence.current;
    try {
      const response = await api.rescheduleRequests(booking.id, signal);
      const rows = response.filter(request => request.booking_id === booking.id);
      if (!signal?.aborted && current === sequence.current) {
        setRequests(rows); setChoice(previous => previous && rows.some(r => r.id === previous.id && r.status === 'pending') ? previous : null);
        if (requestId && !rows.some(r => r.id === requestId && r.booking_id === booking.id)) setError('La solicitud indicada no pertenece a esta cita o ya no está disponible.');
      }
    } catch (err) { if (!signal?.aborted && current === sequence.current) setError(err instanceof Error ? err.message : 'No se pudieron consultar las solicitudes.'); }
    finally { if (!signal?.aborted && current === sequence.current) setLoading(false); }
  }, [booking.id, requestId]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load, refreshKey]);
  const decide = async () => {
    if (!['pending', 'confirmed'].includes(booking.status) || !choice || lock.current || !requests.some(r => r.id === choice.id && r.booking_id === booking.id && r.status === 'pending')) return;
    lock.current = true; setWorking(true); setError(''); setSuccess('');
    try {
      const updated = await api.decideReschedule(booking.id, choice.id, { approve: choice.approve, response_note: note.trim() || null });
      sequence.current++;
      setRequests(current => current.map(request => request.id === updated.id ? updated : request));
      setChoice(null); setNote(''); setSuccess(updated.status === 'approved' ? 'Cambio aprobado por el servidor. La cita se actualizará en la nueva fecha.' : 'Solicitud rechazada. La cita conserva su fecha original.');
      try { await onDecision(); } catch { setError('La decisión quedó registrada, pero no se pudo actualizar la agenda. Usa Actualizar.'); }
    } catch (err) {
      setChoice(null);
      setError(err instanceof AgendaBookingRequestError && err.status === 409 && /horario.*disponible|requested time.*available/i.test(err.message) ? 'No fue posible aprobar este cambio porque el horario solicitado ya no está disponible.' : err instanceof Error ? err.message : 'No se pudo responder la solicitud.');
      await Promise.all([load(), onDecision().catch(() => undefined)]);
    } finally { lock.current = false; setWorking(false); }
  };
  const selected = requests.find(r => r.id === choice?.id);
  const rows = [...requests].sort((a, b) => Number(b.id === requestId) - Number(a.id === requestId) || Number(b.status === 'pending') - Number(a.status === 'pending') || Date.parse(b.created_at) - Date.parse(a.created_at));
  return <AgendaModalShell open title={choice ? choice.approve ? '¿Aprobar el cambio de horario?' : 'Rechazar solicitud de reprogramación' : 'Solicitud de reprogramación'} description={`Cita #${booking.id} · ${serviceName || `Servicio #${booking.service_id}`} · ${booking.customer_name}`} saving={working} hideSubmit={!choice || !["pending", "confirmed"].includes(booking.status)} submitLabel={choice?.approve ? 'Confirmar aprobación' : 'Confirmar rechazo'} onClose={onClose} onSubmit={e => { e.preventDefault(); void decide(); }}>
    <p className="text-sm text-gray-600">Tu cliente quiere cambiar la fecha y hora de esta cita. Revisa la solicitud antes de responder.</p>
    {loading ? <p role="status">Consultando solicitudes…</p> : null}{error ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p> : null}{success ? <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-[#004e28]">{success}</p> : null}
    {booking.status === 'cancelled' ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Esta reservación está cancelada. No es posible aprobar su reprogramación.</p> : null}
    {!loading && !rows.length ? <p>Esta cita no tiene solicitudes de reprogramación.</p> : null}
    {rows.map(request => <article key={request.id} className={`space-y-3 rounded-2xl border p-4 ${request.id === requestId ? 'border-[#168e00] ring-2 ring-[#168e00]/15' : request.status === 'pending' ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200'}`}>
      <p className="font-bold text-[#004e28]">{request.status === 'pending' ? 'El cliente solicita cambiar su cita' : 'Historial de solicitud'}</p>
      <div className="rounded-xl bg-white p-3 text-sm"><p className="text-xs font-bold text-gray-500">CITA ACTUAL</p><p className="font-semibold">{formatAgendaDate(booking.start_at, timezone)}</p><p aria-hidden="true" className="my-2 text-xl text-[#168e00]">↓</p><p className="text-xs font-bold text-gray-500">CAMBIO SOLICITADO</p><p className="font-bold text-[#004e28]">{formatAgendaDate(request.requested_start_at, timezone)}</p></div>
      <p className="text-sm"><strong>Motivo del cliente:</strong> {request.reason || 'No proporcionó un motivo.'}</p><p className="text-xs text-gray-500">Solicitada: {formatAgendaDate(request.created_at, timezone)}</p><p className="text-sm font-semibold">{({ pending: 'Pendiente de tu autorización', approved: 'Aprobada', rejected: 'Rechazada', cancelled: 'Cancelada' })[request.status]}</p>
      {request.response_note ? <p className="text-sm">Respuesta: {request.response_note}</p> : null}
      {request.status === 'pending' && ['pending', 'confirmed'].includes(booking.status) && (!requestId || requestId === request.id || rows.some(r => r.id === requestId)) ? <div className="flex flex-wrap gap-2"><button type="button" disabled={working} onClick={() => { setChoice({ id: request.id, approve: true }); setNote(''); }} className="min-h-11 rounded-xl bg-[#168e00] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Aprobar cambio</button><button type="button" disabled={working} onClick={() => { setChoice({ id: request.id, approve: false }); setNote(''); }} className="min-h-11 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-40">Rechazar solicitud</button></div> : null}
    </article>)}
    {choice && selected && ["pending", "confirmed"].includes(booking.status) ? <div className="space-y-3 rounded-xl bg-[#f2f3f4] p-4"><p className="text-sm font-semibold">{choice.approve ? `Se reemplazará ${formatAgendaDate(booking.start_at, timezone)} por ${formatAgendaDate(selected.requested_start_at, timezone)}.` : `Se rechazará la fecha solicitada ${formatAgendaDate(selected.requested_start_at, timezone)}. La cita conservará su fecha actual.`}</p><label className="block text-sm">Mensaje para el cliente (opcional)<textarea rows={3} maxLength={5000} value={note} disabled={working} onChange={e => setNote(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white p-3" /></label><button type="button" disabled={working} onClick={() => setChoice(null)} className="min-h-11 text-sm font-semibold text-gray-600 underline">Volver a la solicitud</button></div> : null}
  </AgendaModalShell>;
}
