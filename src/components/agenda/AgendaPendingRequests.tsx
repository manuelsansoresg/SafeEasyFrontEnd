'use client';
import type { AgendaProviderRescheduleItem } from '@/types/agendaBooking';
import { formatAgendaDate } from '@/lib/agendaCalendar';
export default function AgendaPendingRequests({ items, total, error, loading, page, onPage, onRefresh, onReview, onBooking, services, timezone }: {
  items: AgendaProviderRescheduleItem[]; total: number | null; error: string; loading: boolean; page: number; onPage: (page: number) => void; onRefresh: () => void; onReview: (item: AgendaProviderRescheduleItem) => void; onBooking: (id: number) => void; services: ReadonlyMap<number, string>; timezone: string;
}) {
  return <details className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4" open={Boolean(error)}>
    <summary className="cursor-pointer font-bold text-[#004e28]">Solicitudes por atender <span className="mt-1 block text-sm font-medium text-gray-600">{error ? 'No se pudo consultar el total de solicitudes' : total === null ? 'Consultando solicitudes…' : total ? `${total} solicitudes de reprogramación pendientes` : 'No hay solicitudes pendientes'}</span></summary>
    <button type="button" disabled={loading} className="mt-3 min-h-11 text-sm font-semibold text-[#168e00] underline disabled:opacity-40" onClick={onRefresh}>{loading ? 'Actualizando…' : 'Actualizar solicitudes'}</button>
    {error ? <p role="alert" className="text-sm text-amber-900">{error}</p> : <>
      <div className="mt-3 grid gap-3 md:grid-cols-2">{items.slice(page * 50, (page + 1) * 50).map(item => <article key={item.id} className="space-y-2 rounded-2xl border border-amber-100 bg-white p-4 text-sm">
        <p className="font-bold text-[#004e28]">{item.booking.customer_name} · {services.get(item.booking.service_id) || `Servicio #${item.booking.service_id}`}</p><p className="text-xs text-gray-500">Cita #{item.booking_id} · Solicitado: {formatAgendaDate(item.created_at, timezone)}</p>
        <p><strong>Fecha actual:</strong> {formatAgendaDate(item.booking.start_at, timezone)}</p><p><strong>Nueva fecha solicitada:</strong> {formatAgendaDate(item.requested_start_at, timezone)}</p><p><strong>Motivo:</strong> {item.reason || 'Sin motivo proporcionado.'}</p><p className="font-semibold text-amber-900">Pendiente de tu autorización</p>
        {item.booking.status === 'cancelled' ? <p className="text-red-700">Esta reservación está cancelada. No es posible aprobar su reprogramación.</p> : null}
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onReview(item)} className="min-h-11 rounded-xl bg-[#004e28] px-3 py-2 font-semibold text-white">Revisar solicitud</button><button type="button" onClick={() => onBooking(item.booking_id)} className="min-h-11 rounded-xl border border-gray-200 px-3 py-2 font-semibold text-[#004e28]">Ver reservación</button></div>
      </article>)}</div>
      {(total ?? 0) > 50 ? <div className="mt-4 flex items-center justify-between text-sm"><button type="button" disabled={!page} className="min-h-11 rounded-xl border px-3 disabled:opacity-40" onClick={() => onPage(page - 1)}>Anterior</button><span>Página {page + 1} de {Math.ceil((total ?? 0) / 50)}</span><button type="button" disabled={(page + 1) * 50 >= (total ?? 0)} className="min-h-11 rounded-xl border px-3 disabled:opacity-40" onClick={() => onPage(page + 1)}>Siguiente</button></div> : null}
    </>}
  </details>;
}
