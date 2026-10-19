'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { agendaBookingService as api } from '@/services/agendaBookingService';
import { agendaService } from '@/services/agendaService';
import { calendarPeriod, dateInZone, type AgendaSort, type AgendaView } from '@/lib/agendaCalendar';
import type { AgendaSchedule, AgendaService } from '@/types/agenda';
import type { AgendaBookingStatus, AgendaProviderBooking, AgendaProviderRescheduleItem } from '@/types/agendaBooking';

export function useProviderAgenda(enabled: boolean, userId?: number) {
  const [view, setView] = useState<AgendaView>('week');
  const [date, setDate] = useState('');
  const [sort, setSort] = useState<AgendaSort>('created_desc');
  const [filter, setFilter] = useState<'all' | AgendaBookingStatus>('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [timezone, setTimezone] = useState('');
  const [schedules, setSchedules] = useState<AgendaSchedule[]>([]);
  const [services, setServices] = useState<AgendaService[]>([]);
  const [onlineConfigured, setOnlineConfigured] = useState(false);
  const [appointments, setAppointments] = useState<AgendaProviderBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contextError, setContextError] = useState('');
  const [contextRefresh, setContextRefresh] = useState(0);
  const [pendingOwner, setPendingOwner] = useState<number | null>(null);
  const [listOwner, setListOwner] = useState<number | null>(null);
  const [pending, setPending] = useState<AgendaProviderRescheduleItem[]>([]);
  const [pendingTotal, setPendingTotal] = useState<number | null>(null);
  const [pendingError, setPendingError] = useState('');
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingPage, setPendingPage] = useState(0);
  const [initialized, setReady] = useState(false);
  const [contextOwner, setContextOwner] = useState<number | null>(null);
  const ready = initialized && contextOwner === userId;
  const listSequence = useRef(0), pendingSequence = useRef(0);
  const listController = useRef<AbortController | null>(null), pendingController = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!enabled || !userId) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const [settings, hours, catalog, payments] = await Promise.all([
          agendaService.getSettings(controller.signal), agendaService.listSchedules(controller.signal), agendaService.listServices(controller.signal), agendaService.getPaymentSettings(controller.signal).catch(() => null),
        ]);
        if (controller.signal.aborted) return;
        const today = dateInZone(new Date(), settings.timezone); // Validates the server timezone; no local/UTC fallback.
        let selectedView: AgendaView = window.matchMedia('(max-width: 767px)').matches ? 'day' : 'week';
        let selectedDate = today;
        try {
          const stored = JSON.parse(sessionStorage.getItem(`agenda-calendar:${userId}`) || 'null');
          if (stored && ['day', 'week', 'month', 'reservations'].includes(stored.view)) selectedView = stored.view;
          if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored.date) && !Number.isNaN(Date.parse(`${stored.date}T12:00:00Z`))) selectedDate = stored.date;
        } catch { /* Session persistence is optional. */ }
        setTimezone(settings.timezone); setSchedules(hours); setServices(catalog); setOnlineConfigured(payments?.online_payment_available === true);
        setView(selectedView); setDate(selectedDate); setContextError(''); setContextOwner(userId); setReady(true);
      } catch (err) { if (!controller.signal.aborted) { setContextError(err instanceof Error ? err.message : 'No se pudo cargar la zona horaria y la configuración de Agenda.'); setLoading(false); } }
    };
    void load(); return () => controller.abort();
  }, [enabled, userId, contextRefresh]);
  useEffect(() => { if (ready && userId) { try { sessionStorage.setItem(`agenda-calendar:${userId}`, JSON.stringify({ view, date })); } catch { /* Use in-memory selection. */ } } }, [view, date, ready, userId]);
  const futureFrom = useMemo(() => ready && view === 'reservations' && sort === 'start_asc' ? new Date().toISOString() : undefined, [ready, view, sort]);
  const period = useMemo(() => ready && view !== "reservations" ? calendarPeriod(view, date, timezone) : null, [ready, view, date, timezone]);
  const from = period?.date_from, to = period?.date_to;
  const load = useCallback(async () => {
    if (!enabled || !ready) return;
    listController.current?.abort();
    const controller = new AbortController(); listController.current = controller;
    const sequence = ++listSequence.current; setLoading(true); setError('');
    try {
      const status = filter === 'all' ? undefined : filter;
      const rows = view === 'reservations'
        ? await api.providerAppointments(status, controller.signal, { sort, date_from: futureFrom, skip: page * 50, limit: 51 })
        : await api.providerCalendarAppointments({ date_from: from, date_to: to }, status, controller.signal);
      if (controller.signal.aborted || sequence !== listSequence.current) return;
      setListOwner(userId ?? null); setHasMore(view === 'reservations' && rows.length > 50); setAppointments(view === 'reservations' ? rows.slice(0, 50) : rows);
    } catch (err) { if (!controller.signal.aborted && sequence === listSequence.current) { setAppointments([]); setError(err instanceof Error ? err.message : 'No se pudieron consultar las citas.'); } }
    finally { if (!controller.signal.aborted && sequence === listSequence.current) setLoading(false); }
  }, [enabled, ready, userId, view, from, to, sort, futureFrom, filter, page]);
  useEffect(() => { void load(); return () => listController.current?.abort(); }, [load]);
  const loadPending = useCallback(async () => {
    if (!enabled || !userId) return;
    pendingController.current?.abort(); const controller = new AbortController(); pendingController.current = controller;
    const sequence = ++pendingSequence.current; setPendingLoading(true);
    try {
      const result = await api.providerPendingRequests(controller.signal);
      if (controller.signal.aborted || sequence !== pendingSequence.current) return;
      setPendingOwner(userId); setPending(result.items); setPendingTotal(result.total); setPendingError(''); setPendingPage(previous => Math.min(previous, Math.max(0, Math.ceil(result.items.length / 50) - 1)));
    } catch (err) { if (!controller.signal.aborted && sequence === pendingSequence.current) setPendingError(err instanceof Error ? err.message : 'No se pudo consultar el total de solicitudes.'); }
    finally { if (!controller.signal.aborted && sequence === pendingSequence.current) setPendingLoading(false); }
  }, [enabled, userId]);
  useEffect(() => { void loadPending(); return () => pendingController.current?.abort(); }, [loadPending]);
  const pendingMap = useMemo(() => {
    const map = new Map<number, AgendaProviderRescheduleItem>();
    if (pendingOwner === userId) for (const item of pending) if (!map.has(item.booking_id)) map.set(item.booking_id, item);
    return map;
  }, [pending, pendingOwner, userId]);
  const refreshAll = useCallback(async () => { await Promise.all([load(), loadPending()]); }, [load, loadPending]);
  const changeView = useCallback((value: AgendaView) => { setPage(0); setView(value); }, []);
  const changeDate = useCallback((value: string) => { setPage(0); setDate(value); }, []);
  const changeSort = useCallback((value: AgendaSort) => { setPage(0); setSort(value); }, []);
  const changeFilter = useCallback((value: 'all' | AgendaBookingStatus) => { setPage(0); setFilter(value); }, []);
  return { view, setView: changeView, date, setDate: changeDate, sort, setSort: changeSort, filter, setFilter: changeFilter, page, setPage, hasMore, timezone, schedules, services, onlineConfigured, appointments: listOwner === userId ? appointments : [], setAppointments, loading, error, contextError, retryContext: () => setContextRefresh(n => n + 1), ready, load, pending: pendingOwner === userId ? pending : [], pendingMap, pendingTotal: pendingOwner === userId ? pendingTotal : null, pendingError, pendingLoading, pendingPage, setPendingPage, loadPending, refreshAll };
}
