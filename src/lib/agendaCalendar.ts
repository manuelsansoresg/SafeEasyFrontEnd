import type { AgendaProviderBooking } from '@/types/agendaBooking';
export type AgendaView = 'day' | 'week' | 'month' | 'reservations';
export type AgendaSort = 'created_desc' | 'start_asc' | 'start_desc';
const civil = (day: string) => new Date(`${day}T12:00:00Z`);
export function shiftDay(day: string, count: number) { const date = civil(day); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0, 10); }
export function dateInZone(value: string | Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  return ['year', 'month', 'day'].map(type => parts.find(p => p.type === type)?.value).join('-');
}
export function dayStart(day: string, timezone: string) {
  const target = Date.parse(`${day}T00:00:00Z`);
  let instant = target;
  for (let i = 0; i < 5; i++) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
    const n = (type: string) => Number(parts.find(p => p.type === type)?.value);
    const observed = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
    if (observed === target) return new Date(instant).toISOString();
    instant += target - observed;
  }
  throw new Error('No se pudo resolver el inicio de esta fecha en la zona horaria del negocio.');
}
export function calendarDays(view: AgendaView, anchor: string) {
  if (view === 'day' || view === 'reservations') return [anchor];
  const first = view === 'month' ? `${anchor.slice(0, 7)}-01` : anchor;
  const start = shiftDay(first, -((civil(first).getUTCDay() + 6) % 7));
  return Array.from({ length: view === 'week' ? 7 : 42 }, (_, index) => shiftDay(start, index));
}
export function calendarPeriod(view: AgendaView, anchor: string, timezone: string) {
  const days = calendarDays(view, anchor);
  return { date_from: dayStart(days[0], timezone), date_to: dayStart(shiftDay(days.at(-1)!, 1), timezone) };
}
export function moveCalendar(view: AgendaView, day: string, count: number) {
  if (view !== 'month') return shiftDay(day, count * (view === 'week' ? 7 : 1));
  const date = civil(`${day.slice(0, 7)}-01`); date.setUTCMonth(date.getUTCMonth() + count); return date.toISOString().slice(0, 10);
}
export function bookingsOnDay(bookings: AgendaProviderBooking[], day: string, timezone: string) {
  const from = Date.parse(dayStart(day, timezone)), to = Date.parse(dayStart(shiftDay(day, 1), timezone));
  return bookings.filter(b => Date.parse(b.start_at) < to && Date.parse(b.end_at) > from);
}
export const minuteInZone = (iso: string, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  return Number(parts.find(p => p.type === 'hour')?.value) * 60 + Number(parts.find(p => p.type === 'minute')?.value);
};
export function layoutDay(bookings: AgendaProviderBooking[], day: string, timezone: string) {
  const from = Date.parse(dayStart(day, timezone)), to = Date.parse(dayStart(shiftDay(day, 1), timezone));
  const events = bookingsOnDay(bookings, day, timezone).map(booking => {
    const start = Date.parse(booking.start_at) <= from ? 0 : minuteInZone(booking.start_at, timezone);
    const end = Date.parse(booking.end_at) >= to ? 1440 : minuteInZone(booking.end_at, timezone);
    return { booking, start, end: end > start ? end : Math.min(1440, start + (Date.parse(booking.end_at) - Date.parse(booking.start_at)) / 60000), column: 0, columns: 1 };
  }).sort((a, b) => a.start - b.start || a.end - b.end || a.booking.id - b.booking.id);
  let group: typeof events = [], ends: number[] = [], groupEnd = -1;
  const flush = () => { group.forEach(event => { event.columns = ends.length; }); group = []; ends = []; groupEnd = -1; };
  for (const event of events) {
    if (event.start >= groupEnd) flush();
    let column = ends.findIndex(end => end <= event.start);
    if (column < 0) column = ends.length;
    ends[column] = event.end; event.column = column; group.push(event); groupEnd = Math.max(groupEnd, event.end);
  }
  flush(); return events;
}
export const appointmentStatusLabel = (status: string) => ({ pending: 'Pendiente de confirmación', confirmed: 'Confirmada', completed: 'Completada', cancelled: 'Cancelada', no_show: 'No asistió' }[status] || status);
export const appointmentStatusColor = (status: string) => ({ pending: 'border-amber-300 bg-amber-50 text-amber-950', confirmed: 'border-[#168e00]/40 bg-green-50 text-[#004e28]', completed: 'border-blue-200 bg-blue-50 text-blue-900', cancelled: 'border-red-200 bg-red-50 text-red-900', no_show: 'border-gray-300 bg-gray-100 text-gray-700' }[status] || 'border-gray-300 bg-white text-black');
export const formatAgendaDate = (iso: string, timezone: string) => new Intl.DateTimeFormat('es-MX', { timeZone: timezone, dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso));
export function parseAgendaNavigation(params: { get: (key: string) => string | null }) {
  const positive = (value: string | null) => value && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
  return { bookingId: positive(params.get('booking_id')), requestId: positive(params.get('request_id')), reschedule: params.get('action') === 'reschedule' };
}
