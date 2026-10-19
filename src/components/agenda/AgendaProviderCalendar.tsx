'use client';
import { useState } from 'react';
import type { AgendaProviderBooking } from '@/types/agendaBooking';
import type { AgendaSchedule } from '@/types/agenda';
import { appointmentStatusColor, appointmentStatusLabel, bookingsOnDay, calendarDays, dateInZone, layoutDay, type AgendaView } from '@/lib/agendaCalendar';
type Props = { view: Exclude<AgendaView, 'reservations'>; date: string; timezone: string; bookings: AgendaProviderBooking[]; schedules: AgendaSchedule[]; pendingIds: ReadonlySet<number>; serviceNames: ReadonlyMap<number, string>; onSelectDate: (date: string) => void; onFocusDate?: (date: string) => void; onSelectBooking: (booking: AgendaProviderBooking) => void };
const dayLabel = (day: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric' }) => new Intl.DateTimeFormat('es-MX', { ...options, timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
const time = (iso: string, timezone: string) => new Intl.DateTimeFormat('es-MX', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
export default function AgendaProviderCalendar(props: Props) {
  const days = calendarDays(props.view, props.date), today = dateInZone(new Date(), props.timezone);
  const [mobileDay, setMobileDay] = useState(props.date);
  const selected = days.includes(mobileDay) ? mobileDay : days[0];
  if (props.view === 'month') return <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white" aria-label="Calendario mensual de citas">
    <div className="grid grid-cols-7 border-b bg-[#f2f3f4]">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => <div key={day} className="py-3 text-center text-xs font-semibold text-[#004e28]">{day}</div>)}</div>
    <div className="grid grid-cols-7">{days.map(day => {
      const appointments = bookingsOnDay(props.bookings, day, props.timezone), pending = appointments.filter(b => props.pendingIds.has(b.id)).length;
      return <button type="button" key={day} onClick={() => props.onSelectDate(day)} aria-current={today === day ? 'date' : undefined} aria-label={`${dayLabel(day, { dateStyle: 'full' })}, ${appointments.length} citas${pending ? `, ${pending} con cambio solicitado` : ''}`} className={`min-h-24 min-w-0 border-b border-r border-gray-100 p-1.5 text-left transition hover:bg-green-50 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-[#168e00] sm:min-h-32 sm:p-3 ${today === day ? 'bg-green-50 ring-1 ring-inset ring-[#168e00]' : day.slice(0, 7) !== props.date.slice(0, 7) ? 'bg-gray-50 text-gray-400' : 'text-[#004e28]'}`}>
        <span className="block text-sm font-bold">{Number(day.slice(-2))}</span>{appointments.length ? <span className="mt-2 block text-[10px] font-semibold sm:text-xs">{appointments.length} citas</span> : null}{pending ? <span className="mt-1 block rounded-md bg-amber-100 px-1 py-1 text-[10px] font-bold text-amber-900 sm:text-xs">{pending} cambios</span> : null}
      </button>;
    })}</div>
  </section>;
  return <section className="space-y-3" aria-label={props.view === 'week' ? 'Agenda semanal' : 'Agenda del día'}>
    {props.view === 'week' ? <>
      <div className="flex gap-2 overflow-x-auto pb-2 lg:hidden">{days.map(day => <button type="button" aria-pressed={selected === day} key={day} onClick={() => { setMobileDay(day); props.onFocusDate?.(day); }} className={`min-h-14 shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold ${selected === day ? 'border-[#004e28] bg-[#004e28] text-white' : 'border-gray-200 bg-white text-[#004e28]'}`}>{dayLabel(day)}<span className="block text-xs">{bookingsOnDay(props.bookings, day, props.timezone).length} citas</span></button>)}</div>
      <div className="hidden lg:block"><TimeGrid {...props} days={days} /></div><div className="lg:hidden"><TimeGrid {...props} days={[selected]} /></div>
    </> : <TimeGrid {...props} days={[props.date]} />}
    {!props.bookings.length ? <p className="rounded-xl bg-white p-4 text-sm text-gray-600">No hay citas en este período con el filtro seleccionado.</p> : null}
    <p className="text-xs leading-5 text-gray-600">Zona horaria: {props.timezone}. Los espacios sin citas visibles no garantizan disponibilidad: también se aplican capacidad, bloqueos y reglas del negocio.</p>
  </section>;
}
function TimeGrid({ days, ...props }: Props & { days: string[] }) {
  const layouts = days.map(day => layoutDay(props.bookings, day, props.timezone));
  const minutes = props.schedules.filter(s => s.is_active).flatMap(s => [s.start_time, s.end_time]).map(t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)));
  const starts = layouts.flat().map(event => event.start), ends = layouts.flat().map(event => event.end);
  const startHour = Math.floor(Math.min(...minutes, ...starts, minutes.length || starts.length ? 1440 : 8 * 60) / 60);
  const endHour = Math.max(startHour + 1, Math.ceil(Math.max(...minutes, ...ends, minutes.length || ends.length ? 0 : 18 * 60) / 60));
  const height = (endHour - startHour) * 120, today = dateInZone(new Date(), props.timezone);
  return <div className="max-h-[72vh] overflow-auto rounded-3xl border border-gray-200 bg-white shadow-sm">
    <div className="grid" style={{ gridTemplateColumns: `48px ${layouts.map(events => `minmax(${Math.max(days.length > 1 ? 140 : 220, ...events.map(event => event.columns * 140))}px, 1fr)`).join(" ")}`, minWidth: days.length > 1 ? 1030 : 270 }}>
      <div className="sticky top-0 z-20 border-b bg-white" />{days.map(day => <div key={day} className={`sticky top-0 z-20 border-b border-l border-gray-100 px-2 py-3 text-center text-sm font-bold ${today === day ? 'bg-green-50 text-[#168e00]' : 'bg-white text-[#004e28]'}`}>{dayLabel(day)}</div>)}
      <div className="relative bg-white" style={{ height }}>{Array.from({ length: endHour - startHour }, (_, index) => <span key={index} className="absolute right-1 text-[10px] text-gray-500" style={{ top: index * 120 + 2 }}>{String(startHour + index).padStart(2, '0')}:00</span>)}</div>
      {days.map((day, index) => <div key={day} className="relative border-l border-gray-100 bg-[#f2f3f4]/70" style={{ height, backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0px, transparent 59px, #e5e7eb 59px, #e5e7eb 60px)' }}>
        {props.schedules.filter(s => s.is_active && s.day_of_week === (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7).map(schedule => {
          const start = Number(schedule.start_time.slice(0, 2)) * 60 + Number(schedule.start_time.slice(3, 5)), end = Number(schedule.end_time.slice(0, 2)) * 60 + Number(schedule.end_time.slice(3, 5));
          return <div key={schedule.id} aria-hidden="true" className="absolute inset-x-0 bg-white/80" style={{ top: Math.max(0, start - startHour * 60) * 2, height: (end - start) * 2 }} />;
        })}
        {layouts[index].map(({ booking, start, end, column, columns }) => {
          const service = props.serviceNames.get(booking.service_id) || `Servicio #${booking.service_id}`, pending = props.pendingIds.has(booking.id);
          const label = `${time(booking.start_at, props.timezone)}–${time(booking.end_at, props.timezone)} · ${service} · ${booking.customer_name} · ${appointmentStatusLabel(booking.status)}${pending ? ' · Cambio solicitado' : ''}`;
          return <button key={booking.id} type="button" title={label} aria-label={label} onClick={() => props.onSelectBooking(booking)} className={`absolute z-10 overflow-auto rounded-lg border-l-4 px-1.5 py-1 text-left text-[10px] leading-tight shadow-sm transition hover:z-20 hover:shadow-md focus-visible:z-30 focus-visible:outline-2 focus-visible:outline-[#168e00] ${appointmentStatusColor(booking.status)}`} style={{ top: (start - startHour * 60) * 2, height: Math.max(24, (end - start) * 2 - 2), left: `calc(${column / columns * 100}% + 2px)`, width: `calc(${100 / columns}% - 4px)` }}>
            <span className="block font-bold">{time(booking.start_at, props.timezone)}–{time(booking.end_at, props.timezone)}</span><span className="block font-semibold">{service}</span><span className="block">{booking.customer_name}</span><span className="block">{appointmentStatusLabel(booking.status)}</span>{pending ? <span className="mt-1 block rounded bg-amber-100 px-1 py-0.5 font-bold text-amber-900">Cambio solicitado</span> : null}
          </button>;
        })}
      </div>)}
    </div>
  </div>;
}
