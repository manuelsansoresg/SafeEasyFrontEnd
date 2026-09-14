"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bell,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  Check,
  Clock3,
  Loader2,
  Pencil,
  Plus,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import { useAgendaModuleAccess } from "@/hooks/useAgendaModuleAccess";
import { agendaService } from "@/services/agendaService";
import type {
  AgendaDay,
  AgendaException,
  AgendaExceptionPayload,
  AgendaExceptionType,
  AgendaSchedulePayload,
  AgendaService,
  AgendaServicePayload,
  AgendaSettings,
  AgendaSettingsPayload,
  BufferDuration,
  ServiceDuration,
  SlotInterval,
} from "@/types/agenda";

type Section =
  | "general"
  | "hours"
  | "services"
  | "exceptions"
  | "notifications";

type ToastState =
  | { type: "success" | "error" | "info"; message: string }
  | null;

const DAYS: { value: AgendaDay; label: string; short: string }[] = [
  { value: 0, label: "Lunes", short: "Lun" },
  { value: 1, label: "Martes", short: "Mar" },
  { value: 2, label: "Miércoles", short: "Mié" },
  { value: 3, label: "Jueves", short: "Jue" },
  { value: 4, label: "Viernes", short: "Vie" },
  { value: 5, label: "Sábado", short: "Sáb" },
  { value: 6, label: "Domingo", short: "Dom" },
];

const SLOT_INTERVALS: SlotInterval[] = [15, 20, 30, 60];
const DURATIONS: ServiceDuration[] = [15, 20, 30, 45, 60, 90, 120];
const BUFFERS: BufferDuration[] = [0, 5, 10, 15, 20, 30, 45, 60];

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

const panelClass =
  "rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6";

function message(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function timeInput(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "";
}

function money(value: number | null) {
  if (value == null) return "Sin precio";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

function settingsPayload(settings: AgendaSettings): AgendaSettingsPayload {
  return {
    timezone: settings.timezone,
    slot_interval_minutes: settings.slot_interval_minutes,
    minimum_notice_minutes: settings.minimum_notice_minutes,
    maximum_booking_days: settings.maximum_booking_days,
    cancellation_notice_hours: settings.cancellation_notice_hours,
    automatic_confirmation: settings.automatic_confirmation,
    is_active: settings.is_active,
    allow_guest_bookings: settings.allow_guest_bookings,
    require_guest_email: settings.require_guest_email,
    allow_customer_cancellation: settings.allow_customer_cancellation,
    allow_reschedule_requests: settings.allow_reschedule_requests,
    provider_push_notifications: settings.provider_push_notifications,
    provider_email_notifications: settings.provider_email_notifications,
    customer_email_notifications: settings.customer_email_notifications,
    customer_push_notifications: settings.customer_push_notifications,
    reminder_24_hours: settings.reminder_24_hours,
    reminder_2_hours: settings.reminder_2_hours,
    notification_email: settings.notification_email?.trim() || null,
  };
}

export default function AdminAgendaPage() {
  const { loading: accessLoading, hasAccess } = useAgendaModuleAccess(true);

  const [section, setSection] = useState<Section>("general");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AgendaSettings | null>(null);
  const [schedules, setSchedules] = useState<AgendaSchedulePayload[]>([]);
  const [services, setServices] = useState<AgendaService[]>([]);
  const [exceptions, setExceptions] = useState<AgendaException[]>([]);
  const [toast, setToast] = useState<ToastState>(null);
  const [saving, setSaving] = useState(false);

  const [serviceModal, setServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<AgendaService | null>(
    null,
  );

  const [exceptionModal, setExceptionModal] = useState(false);
  const [editingException, setEditingException] =
    useState<AgendaException | null>(null);

  const load = useCallback(async () => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    try {
      const [settingsData, scheduleData, serviceData, exceptionData] =
        await Promise.all([
          agendaService.getSettings(controller.signal),
          agendaService.listSchedules(controller.signal),
          agendaService.listServices(controller.signal),
          agendaService.listExceptions(controller.signal),
        ]);

      setSettings(settingsData);
      setSchedules(
        scheduleData.map((item) => ({
          day_of_week: item.day_of_week,
          start_time: timeInput(item.start_time),
          end_time: timeInput(item.end_time),
          is_active: item.is_active,
        })),
      );
      setServices(serviceData);
      setExceptions(exceptionData);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setToast({
          type: "error",
          message: message(error, "No se pudo cargar la agenda."),
        });
      }
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  }, [hasAccess]);

  useEffect(() => {
    if (!accessLoading) void load();
  }, [accessLoading, load]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const tabs = useMemo(
    () => [
      { id: "general" as const, label: "General", icon: Settings2 },
      { id: "hours" as const, label: "Horarios", icon: Clock3 },
      { id: "services" as const, label: "Servicios", icon: CalendarClock },
      { id: "exceptions" as const, label: "Excepciones", icon: CalendarOff },
      { id: "notifications" as const, label: "Notificaciones", icon: Bell },
    ],
    [],
  );

  if (accessLoading || loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Loader2 className="animate-spin text-[#168e00]" size={34} />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHero
          eyebrow="Módulo"
          title="Agenda"
          subtitle="Configura las reservaciones de tu negocio."
        />
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <div className="flex gap-3">
            <AlertCircle className="shrink-0" />
            <div>
              <h2 className="font-bold">El módulo Agenda no está activo</h2>
              <p className="mt-1 text-sm">
                Activa o solicita el módulo antes de configurar tu agenda.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const saveSettings = async (successMessage = "Configuración guardada.") => {
    if (!settings) return;

    setSaving(true);
    try {
      const updated = await agendaService.updateSettings(
        settingsPayload(settings),
      );
      setSettings(updated);
      setToast({ type: "success", message: successMessage });
    } catch (error) {
      setToast({
        type: "error",
        message: message(error, "No se pudo guardar."),
      });
    } finally {
      setSaving(false);
    }
  };

  const saveSchedules = async () => {
    for (const block of schedules) {
      if (
        !block.start_time ||
        !block.end_time ||
        block.end_time <= block.start_time
      ) {
        setToast({
          type: "error",
          message:
            "Revisa las horas: la hora final debe ser posterior a la inicial.",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const saved = await agendaService.replaceSchedules(schedules);
      setSchedules(
        saved.map((item) => ({
          ...item,
          start_time: timeInput(item.start_time),
          end_time: timeInput(item.end_time),
        })),
      );
      setToast({ type: "success", message: "Horarios guardados." });
    } catch (error) {
      setToast({
        type: "error",
        message: message(error, "No se pudieron guardar los horarios."),
      });
    } finally {
      setSaving(false);
    }
  };

  const addBlock = (day: AgendaDay) =>
    setSchedules((current) => [
      ...current,
      {
        day_of_week: day,
        start_time: "09:00",
        end_time: "18:00",
        is_active: true,
      },
    ]);

  const updateBlock = (
    index: number,
    changes: Partial<AgendaSchedulePayload>,
  ) =>
    setSchedules((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item,
      ),
    );

  const removeBlock = (index: number) =>
    setSchedules((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <PageHero
            eyebrow="Módulo"
            title="Agenda"
            subtitle="Define tus horarios, servicios y fechas especiales."
          />
        </div>

        <Link
          href="/admin/agenda/appointments"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#168e00] px-4 py-3 font-semibold text-white hover:bg-[#117500]"
        >
          <CalendarDays size={18} />
          Gestionar citas
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSection(tab.id)}
            className={
              section === tab.id
                ? "inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#004e28] px-4 py-2.5 font-semibold text-white"
                : "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 font-semibold text-gray-500 hover:bg-gray-50 hover:text-[#004e28]"
            }
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {section === "general" && settings ? (
        <section className="space-y-6">
          <div className={panelClass}>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Configuración general
              </h2>
              <p className="text-sm text-gray-500">
                Define cuándo pueden reservar y cómo se comporta tu agenda.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Zona horaria
                </span>
                <select
                  className={inputClass}
                  value={settings.timezone}
                  onChange={(e) =>
                    setSettings({ ...settings, timezone: e.target.value })
                  }
                >
                  <option value="America/Merida">
                    Mérida / Ciudad de México
                  </option>
                  <option value="America/Cancun">Cancún</option>
                  <option value="America/Monterrey">Monterrey</option>
                  <option value="America/Tijuana">Tijuana</option>
                </select>
                <small className="mt-1.5 block text-gray-500">
                  Se utiliza para mostrar correctamente la hora de las citas.
                </small>
              </label>

              <label>
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Mostrar horarios cada
                </span>
                <select
                  className={inputClass}
                  value={settings.slot_interval_minutes}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      slot_interval_minutes: Number(
                        e.target.value,
                      ) as SlotInterval,
                    })
                  }
                >
                  {SLOT_INTERVALS.map((value) => (
                    <option key={value} value={value}>
                      Cada {value} minutos
                    </option>
                  ))}
                </select>
                <small className="mt-1.5 block text-gray-500">
                  Define cada cuánto aparecerá una hora disponible.
                </small>
              </label>

              <NumberField
                label="Reservar con al menos (minutos)"
                value={settings.minimum_notice_minutes}
                min={0}
                max={43200}
                description="Tiempo mínimo entre el momento de reservar y la hora de la cita."
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    minimum_notice_minutes: value,
                  })
                }
              />

              <NumberField
                label="Permitir reservas hasta (días)"
                value={settings.maximum_booking_days}
                min={1}
                max={365}
                description="Indica qué tan lejos en el futuro pueden reservar tus clientes."
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    maximum_booking_days: value,
                  })
                }
              />
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <Toggle
                label="Aceptar reservaciones"
                description="Cuando está activa, tus clientes pueden consultar horarios y reservar citas."
                checked={settings.is_active}
                onChange={(value) =>
                  setSettings({ ...settings, is_active: value })
                }
              />

              <Toggle
                label="Confirmar citas automáticamente"
                description="Las nuevas citas quedan confirmadas al instante, sin que tengas que aprobarlas manualmente."
                checked={settings.automatic_confirmation}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    automatic_confirmation: value,
                  })
                }
              />
            </div>
          </div>

          <div className={panelClass}>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Reglas para tus clientes
              </h2>
              <p className="text-sm text-gray-500">
                Decide quién puede reservar y qué cambios puede hacer después.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Toggle
                label="Permitir reservaciones sin cuenta"
                description="Los clientes podrán reservar como invitados sin registrarse en Drooopy."
                checked={settings.allow_guest_bookings}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    allow_guest_bookings: value,
                    require_guest_email: value
                      ? settings.require_guest_email
                      : false,
                  })
                }
              />

              <Toggle
                label="Solicitar correo a invitados"
                description="El correo permite enviar confirmaciones, avisos y el acceso para gestionar la cita."
                checked={settings.require_guest_email}
                disabled={!settings.allow_guest_bookings}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    require_guest_email: value,
                  })
                }
              />

              <Toggle
                label="Permitir cancelaciones"
                description="Los clientes podrán cancelar sus citas respetando el tiempo mínimo configurado."
                checked={settings.allow_customer_cancellation}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    allow_customer_cancellation: value,
                  })
                }
              />

              <Toggle
                label="Permitir solicitudes de cambio"
                description="Los clientes podrán pedir una nueva fecha u hora para su cita."
                checked={settings.allow_reschedule_requests}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    allow_reschedule_requests: value,
                  })
                }
              />
            </div>

            <div className="mt-5 max-w-xl">
              <NumberField
                label="Cancelar con al menos (horas)"
                value={settings.cancellation_notice_hours}
                min={0}
                max={720}
                disabled={!settings.allow_customer_cancellation}
                description="Tiempo que debe faltar para la cita cuando el cliente quiera cancelarla."
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    cancellation_notice_hours: value,
                  })
                }
              />
            </div>
          </div>

          <SaveButton
            saving={saving}
            onClick={() => void saveSettings("Configuración guardada.")}
          />
        </section>
      ) : null}

      {section === "hours" ? (
        <section className="space-y-4">
          {DAYS.map((day) => {
            const blocks = schedules
              .map((item, index) => ({ item, index }))
              .filter(({ item }) => item.day_of_week === day.value);

            return (
              <div key={day.value} className={panelClass}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-gray-900">{day.label}</h3>
                    <p className="text-sm text-gray-400">
                      {blocks.length
                        ? `${blocks.length} bloque(s)`
                        : "Cerrado"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => addBlock(day.value)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#168e00]/20 px-3 py-2 text-sm font-semibold text-[#168e00] hover:bg-[#168e00]/5"
                  >
                    <Plus size={16} />
                    Agregar horario
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {blocks.map(({ item, index }) => (
                    <div
                      key={`${day.value}-${index}`}
                      className="grid items-end gap-3 rounded-2xl bg-gray-50 p-3 sm:grid-cols-[1fr_1fr_auto]"
                    >
                      <label>
                        <span className="mb-1 block text-xs font-semibold text-gray-500">
                          Desde
                        </span>
                        <input
                          type="time"
                          className={inputClass}
                          value={item.start_time}
                          onChange={(e) =>
                            updateBlock(index, {
                              start_time: e.target.value,
                            })
                          }
                        />
                      </label>

                      <label>
                        <span className="mb-1 block text-xs font-semibold text-gray-500">
                          Hasta
                        </span>
                        <input
                          type="time"
                          className={inputClass}
                          value={item.end_time}
                          onChange={(e) =>
                            updateBlock(index, {
                              end_time: e.target.value,
                            })
                          }
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => removeBlock(index)}
                        className="flex h-12 items-center justify-center rounded-xl border border-red-100 px-4 text-red-600 hover:bg-red-50"
                        aria-label="Eliminar horario"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <SaveButton
            saving={saving}
            onClick={() => void saveSchedules()}
            label="Guardar horarios"
          />
        </section>
      ) : null}

      {section === "services" ? (
        <section className="space-y-4">
          <div className="rounded-3xl border border-[#168e00]/20 bg-[#168e00]/5 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white p-2.5 text-[#168e00] shadow-sm">
                <CalendarClock size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#004e28]">
                  ¿Qué es un servicio de Agenda?
                </h2>
                <p className="mt-1 text-sm leading-6 text-gray-700">
                  Es el tipo de cita que tus clientes podrán elegir cuando quieran reservar contigo.
                  Por ejemplo: <strong>Consulta inicial</strong>, <strong>Corte de cabello</strong>,
                  <strong> Masaje de 60 minutos</strong>, <strong>Asesoría</strong> o
                  <strong> Sesión de fisioterapia</strong>.
                </p>
                <p className="mt-2 text-sm font-medium text-[#004e28]">
                  Necesitas al menos un servicio activo para que aparezca el botón
                  “Reservar cita” en tu página pública.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setEditingService(null);
                setServiceModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-4 py-3 font-semibold text-white hover:bg-[#117500]"
            >
              <Plus size={18} />
              Agregar servicio para reservar
            </button>
          </div>

          {services.length === 0 ? (
            <EmptyState
              title="Aún no tienes servicios para reservar"
              text="Crea por lo menos uno para que tus clientes puedan elegir qué cita desean agendar."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {services.map((item) => (
                <article key={item.id} className={panelClass}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-gray-900">
                          {item.name}
                        </h3>
                        <Status active={item.is_active} />
                      </div>

                      {item.description ? (
                        <p className="mt-2 text-sm text-gray-500">
                          {item.description}
                        </p>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingService(item);
                        setServiceModal(true);
                      }}
                      className="rounded-xl border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
                      aria-label="Editar"
                    >
                      <Pencil size={17} />
                    </button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    <Chip text={`Duración: ${item.duration_minutes} min`} />
                    <Chip text={`Tiempo posterior: ${item.buffer_minutes} min`} />
                    <Chip text={money(item.price)} />
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const updated = await agendaService.updateService(
                          item.id,
                          { is_active: !item.is_active },
                        );
                        setServices((current) =>
                          current.map((row) =>
                            row.id === updated.id ? updated : row,
                          ),
                        );
                      } catch (error) {
                        setToast({
                          type: "error",
                          message: message(
                            error,
                            "No se pudo cambiar el estado.",
                          ),
                        });
                      }
                    }}
                    className="mt-4 text-sm font-semibold text-[#168e00]"
                  >
                    {item.is_active ? "Desactivar" : "Activar"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {section === "exceptions" ? (
        <section className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setEditingException(null);
                setExceptionModal(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-4 py-3 font-semibold text-white hover:bg-[#117500]"
            >
              <Plus size={18} />
              Nueva excepción
            </button>
          </div>

          {exceptions.length === 0 ? (
            <EmptyState
              title="No hay fechas especiales"
              text="Aquí puedes cerrar un día o modificar su horario normal."
            />
          ) : (
            <div className="space-y-3">
              {exceptions.map((item) => (
                <article
                  key={item.id}
                  className={`${panelClass} flex flex-col justify-between gap-4 sm:flex-row sm:items-center`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-gray-900">
                        {new Date(
                          `${item.exception_date}T12:00:00`,
                        ).toLocaleDateString("es-MX", {
                          dateStyle: "long",
                        })}
                      </h3>
                      <Chip text={exceptionLabel(item.exception_type)} />
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                      {item.exception_type === "closed"
                        ? "Todo el día cerrado"
                        : `${timeInput(item.start_time)} - ${timeInput(
                            item.end_time,
                          )}`}
                      {item.reason ? ` · ${item.reason}` : ""}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingException(item);
                        setExceptionModal(true);
                      }}
                      className="rounded-xl border border-gray-200 p-2.5 text-gray-500 hover:bg-gray-50"
                    >
                      <Pencil size={17} />
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!window.confirm("¿Eliminar esta excepción?")) return;

                        try {
                          await agendaService.removeException(item.id);
                          setExceptions((current) =>
                            current.filter((row) => row.id !== item.id),
                          );
                          setToast({
                            type: "success",
                            message: "Excepción eliminada.",
                          });
                        } catch (error) {
                          setToast({
                            type: "error",
                            message: message(error, "No se pudo eliminar."),
                          });
                        }
                      }}
                      className="rounded-xl border border-red-100 p-2.5 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {section === "notifications" && settings ? (
        <section className="space-y-6">
          <div className={panelClass}>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Avisos para tu negocio
              </h2>
              <p className="text-sm text-gray-500">
                Elige cómo quieres recibir los movimientos de tus citas.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Toggle
                label="Notificaciones push"
                description="Recibe avisos en la aplicación del proveedor cuando haya movimientos en una cita."
                checked={settings.provider_push_notifications}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    provider_push_notifications: value,
                  })
                }
              />

              <Toggle
                label="Notificaciones por correo"
                description="Recibe por email las confirmaciones y cambios relacionados con las citas."
                checked={settings.provider_email_notifications}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    provider_email_notifications: value,
                  })
                }
              />
            </div>

            <div className="mt-5 max-w-2xl">
              <label>
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Correo para notificaciones
                </span>
                <input
                  type="email"
                  maxLength={255}
                  className={inputClass}
                  value={settings.notification_email ?? ""}
                  disabled={!settings.provider_email_notifications}
                  placeholder="Si lo dejas vacío se usará el correo de tu cuenta"
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      notification_email: e.target.value || null,
                    })
                  }
                />
                <small className="mt-1.5 block text-gray-500">
                  Es opcional. Si no escribes otro correo, se utilizará el
                  correo principal de tu cuenta.
                </small>
              </label>
            </div>
          </div>

          <div className={panelClass}>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Avisos para tus clientes
              </h2>
              <p className="text-sm text-gray-500">
                Define qué canales se utilizarán para informar al cliente.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Toggle
                label="Enviar correos al cliente"
                description="Envía confirmaciones y cambios al correo asociado con la cita."
                checked={settings.customer_email_notifications}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    customer_email_notifications: value,
                  })
                }
              />

              <Toggle
                label="Enviar notificaciones push"
                description="Los clientes registrados podrán recibir avisos en su aplicación."
                checked={settings.customer_push_notifications}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    customer_push_notifications: value,
                  })
                }
              />
            </div>
          </div>

          <div className={panelClass}>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Recordatorios de citas
              </h2>
              <p className="text-sm text-gray-500">
                Activa los avisos automáticos antes de que comience una cita.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Toggle
                label="Recordatorio 24 horas antes"
                description="Envía un recordatorio aproximadamente un día antes de la cita."
                checked={settings.reminder_24_hours}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    reminder_24_hours: value,
                  })
                }
              />

              <Toggle
                label="Recordatorio 2 horas antes"
                description="Envía un segundo aviso aproximadamente dos horas antes de la cita."
                checked={settings.reminder_2_hours}
                onChange={(value) =>
                  setSettings({
                    ...settings,
                    reminder_2_hours: value,
                  })
                }
              />
            </div>
          </div>

          <SaveButton
            saving={saving}
            onClick={() =>
              void saveSettings("Configuración de notificaciones guardada.")
            }
            label="Guardar notificaciones"
          />
        </section>
      ) : null}

      <ServiceModal
        open={serviceModal}
        value={editingService}
        saving={saving}
        onClose={() => setServiceModal(false)}
        onSave={async (payload) => {
          setSaving(true);
          try {
            const saved = editingService
              ? await agendaService.updateService(editingService.id, payload)
              : await agendaService.createService(payload);

            setServices((current) =>
              editingService
                ? current.map((item) =>
                    item.id === saved.id ? saved : item,
                  )
                : [...current, saved],
            );

            setServiceModal(false);
            setToast({
              type: "success",
              message: editingService
                ? "Servicio actualizado."
                : "Servicio creado.",
            });
          } catch (error) {
            setToast({
              type: "error",
              message: message(error, "No se pudo guardar el servicio."),
            });
          } finally {
            setSaving(false);
          }
        }}
      />

      <ExceptionModal
        open={exceptionModal}
        value={editingException}
        saving={saving}
        onClose={() => setExceptionModal(false)}
        onSave={async (payload) => {
          setSaving(true);
          try {
            const saved = editingException
              ? await agendaService.updateException(
                  editingException.id,
                  payload,
                )
              : await agendaService.createException(payload);

            setExceptions((current) =>
              (
                editingException
                  ? current.map((item) =>
                      item.id === saved.id ? saved : item,
                    )
                  : [...current, saved]
              ).sort((a, b) =>
                a.exception_date.localeCompare(b.exception_date),
              ),
            );

            setExceptionModal(false);
            setToast({
              type: "success",
              message: editingException
                ? "Excepción actualizada."
                : "Excepción creada.",
            });
          } catch (error) {
            setToast({
              type: "error",
              message: message(error, "No se pudo guardar la excepción."),
            });
          } finally {
            setSaving(false);
          }
        }}
      />

      {toast ? (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  description,
  disabled = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  description?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-sm font-semibold text-gray-700">
        {label}
      </span>
      <input
        type="number"
        className={inputClass}
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {description ? (
        <small className="mt-1.5 block text-gray-500">{description}</small>
      ) : null}
    </label>
  );
}

function Toggle({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={
        disabled
          ? "flex cursor-not-allowed items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4 opacity-60"
          : "flex cursor-pointer items-center gap-3 rounded-2xl border border-gray-200 p-4 transition hover:border-[#168e00]/30 hover:bg-[#168e00]/[0.02]"
      }
    >
      <input
        type="checkbox"
        className="h-5 w-5 accent-[#168e00]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <strong className="block text-gray-800">{label}</strong>
        <small className="text-gray-500">{description}</small>
      </span>
    </label>
  );
}

function SaveButton({
  saving,
  onClick,
  label = "Guardar configuración",
}: {
  saving: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <div className="mt-6 flex justify-end">
      <button
        type="button"
        disabled={saving}
        onClick={onClick}
        className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-semibold text-white hover:bg-[#117500] disabled:opacity-50"
      >
        {saving ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Save size={18} />
        )}
        {label}
      </button>
    </div>
  );
}

function Status({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? "rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700"
          : "rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-500"
      }
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-600">
      {text}
    </span>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-14 text-center">
      <CalendarClock className="mx-auto text-[#168e00]" size={34} />
      <h2 className="mt-3 text-xl font-bold text-gray-900">{title}</h2>
      <p className="mt-1 text-gray-500">{text}</p>
    </div>
  );
}

function exceptionLabel(value: AgendaExceptionType) {
  return value === "closed"
    ? "Cerrado"
    : value === "special_hours"
      ? "Horario especial"
      : "Bloqueo";
}

function ModalShell({
  title,
  saving,
  onClose,
  onSubmit,
  children,
}: {
  title: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[20000] overflow-y-auto bg-black/40 p-4">
      <div className="mx-auto my-8 max-w-2xl rounded-3xl bg-white shadow-2xl">
        <div className="border-b border-gray-100 px-6 py-5">
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 p-6">
          {children}

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-5">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-5 py-3 font-semibold text-gray-600"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Check size={18} />
              )}
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ServiceModal({
  open,
  value,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  value: AgendaService | null;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: AgendaServicePayload) => Promise<void>;
}) {
  const [form, setForm] = useState<AgendaServicePayload>({
    name: "",
    description: null,
    duration_minutes: 30,
    buffer_minutes: 0,
    price: null,
    is_active: true,
    display_order: 0,
  });

  useEffect(() => {
    if (!open) return;

    setForm(
      value
        ? {
            name: value.name,
            description: value.description,
            duration_minutes: value.duration_minutes,
            buffer_minutes: value.buffer_minutes,
            price: value.price,
            is_active: value.is_active,
            display_order: value.display_order,
          }
        : {
            name: "",
            description: null,
            duration_minutes: 30,
            buffer_minutes: 0,
            price: null,
            is_active: true,
            display_order: 0,
          },
    );
  }, [open, value]);

  if (!open) return null;

  return (
    <ModalShell
      title={value ? "Editar servicio de Agenda" : "Nuevo servicio para reservar"}
      saving={saving}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        if (form.name.trim().length >= 2) {
          void onSave({
            ...form,
            name: form.name.trim(),
            description: form.description?.trim() || null,
          });
        }
      }}
    >
      <div className="rounded-2xl border border-[#168e00]/20 bg-[#168e00]/5 p-4">
        <p className="font-bold text-[#004e28]">
          Este servicio será una opción que el cliente podrá reservar.
        </p>
        <p className="mt-1 text-sm leading-5 text-gray-600">
          Crea un servicio por cada tipo de cita que ofreces. Por ejemplo:
          “Consulta inicial”, “Corte de cabello”, “Masaje” o “Asesoría”.
        </p>
      </div>

      <label>
        <span className="mb-1 block text-sm font-semibold">Nombre del servicio *</span>
        <input
          required
          minLength={2}
          maxLength={150}
          className={inputClass}
          value={form.name}
          placeholder="Ej. Consulta inicial"
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <small className="mt-1.5 block text-gray-500">
          Es el nombre que verá tu cliente al momento de elegir qué quiere reservar.
        </small>
      </label>

      <label>
        <span className="mb-1 block text-sm font-semibold">Descripción</span>
        <textarea
          rows={3}
          maxLength={5000}
          className={inputClass}
          value={form.description ?? ""}
          placeholder="Ej. Valoración inicial para conocer tus necesidades y recomendarte el tratamiento adecuado."
          onChange={(e) =>
            setForm({
              ...form,
              description: e.target.value || null,
            })
          }
        />
        <small className="mt-1.5 block text-gray-500">
          Opcional. Explica brevemente qué incluye la cita o para qué sirve.
        </small>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="mb-1 block text-sm font-semibold">Duración de la cita</span>
          <select
            className={inputClass}
            value={form.duration_minutes}
            onChange={(e) =>
              setForm({
                ...form,
                duration_minutes: Number(
                  e.target.value,
                ) as ServiceDuration,
              })
            }
          >
            {DURATIONS.map((item) => (
              <option key={item} value={item}>
                {item} minutos
              </option>
            ))}
          </select>
          <small className="mt-1.5 block text-gray-500">
            Tiempo que ocupará esta cita en tu agenda.
          </small>
        </label>

        <label>
          <span className="mb-1 block text-sm font-semibold">
            Tiempo libre después de la cita
          </span>
          <select
            className={inputClass}
            value={form.buffer_minutes}
            onChange={(e) =>
              setForm({
                ...form,
                buffer_minutes: Number(e.target.value) as BufferDuration,
              })
            }
          >
            {BUFFERS.map((item) => (
              <option key={item} value={item}>
                {item === 0 ? "Sin tiempo adicional" : `${item} minutos`}
              </option>
            ))}
          </select>
          <small className="mt-1.5 block text-gray-500">
            Bloquea unos minutos después para limpiar, preparar el espacio o descansar.
            Este tiempo no se muestra como parte de la duración de la cita.
          </small>
        </label>

        <label>
          <span className="mb-1 block text-sm font-semibold">Precio</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className={inputClass}
            value={form.price ?? ""}
            placeholder="Ej. 350"
            onChange={(e) =>
              setForm({
                ...form,
                price:
                  e.target.value === ""
                    ? null
                    : Number(e.target.value),
              })
            }
          />
          <small className="mt-1.5 block text-gray-500">
            Opcional. Si lo dejas vacío, el cliente verá “Consultar precio”.
          </small>
        </label>

        <NumberField
          label="Orden de aparición"
          value={form.display_order}
          min={0}
          max={9999}
          description="Define en qué posición aparecerá. Usa 0 para mostrarlo primero, 1 para el siguiente, y así sucesivamente."
          onChange={(display_order) =>
            setForm({ ...form, display_order })
          }
        />
      </div>

      <Toggle
        label="Mostrar este servicio para reservar"
        description="Cuando está activo, aparecerá como opción en tu página pública. Necesitas al menos un servicio activo para que se muestre el botón “Reservar cita”."
        checked={form.is_active}
        onChange={(is_active) => setForm({ ...form, is_active })}
      />
    </ModalShell>
  );
}

function ExceptionModal({
  open,
  value,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  value: AgendaException | null;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: AgendaExceptionPayload) => Promise<void>;
}) {
  const [form, setForm] = useState<AgendaExceptionPayload>({
    exception_date: "",
    exception_type: "closed",
    start_time: null,
    end_time: null,
    reason: null,
  });

  useEffect(() => {
    if (!open) return;

    setForm(
      value
        ? {
            exception_date: value.exception_date,
            exception_type: value.exception_type,
            start_time: timeInput(value.start_time) || null,
            end_time: timeInput(value.end_time) || null,
            reason: value.reason,
          }
        : {
            exception_date: "",
            exception_type: "closed",
            start_time: null,
            end_time: null,
            reason: null,
          },
    );
  }, [open, value]);

  if (!open) return null;

  const timed = form.exception_type !== "closed";

  return (
    <ModalShell
      title={value ? "Editar excepción" : "Nueva excepción"}
      saving={saving}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();

        if (!form.exception_date) return;

        if (
          timed &&
          (!form.start_time ||
            !form.end_time ||
            form.end_time <= form.start_time)
        ) {
          return;
        }

        void onSave({
          ...form,
          start_time: timed ? form.start_time : null,
          end_time: timed ? form.end_time : null,
          reason: form.reason?.trim() || null,
        });
      }}
    >
      <label>
        <span className="mb-1 block text-sm font-semibold">Fecha *</span>
        <input
          required
          type="date"
          className={inputClass}
          value={form.exception_date}
          onChange={(e) =>
            setForm({
              ...form,
              exception_date: e.target.value,
            })
          }
        />
      </label>

      <label>
        <span className="mb-1 block text-sm font-semibold">Tipo</span>
        <select
          className={inputClass}
          value={form.exception_type}
          onChange={(e) =>
            setForm({
              ...form,
              exception_type: e.target.value as AgendaExceptionType,
            })
          }
        >
          <option value="closed">Día cerrado</option>
          <option value="special_hours">Horario especial</option>
          <option value="blocked">Bloquear un horario</option>
        </select>
      </label>

      {timed ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-sm font-semibold">Desde</span>
            <input
              required
              type="time"
              className={inputClass}
              value={form.start_time ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  start_time: e.target.value || null,
                })
              }
            />
          </label>

          <label>
            <span className="mb-1 block text-sm font-semibold">Hasta</span>
            <input
              required
              type="time"
              className={inputClass}
              value={form.end_time ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  end_time: e.target.value || null,
                })
              }
            />
          </label>
        </div>
      ) : null}

      <label>
        <span className="mb-1 block text-sm font-semibold">Motivo</span>
        <input
          className={inputClass}
          maxLength={255}
          value={form.reason ?? ""}
          onChange={(e) =>
            setForm({
              ...form,
              reason: e.target.value || null,
            })
          }
          placeholder="Opcional"
        />
      </label>
    </ModalShell>
  );
}
