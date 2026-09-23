"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Settings2,
  Trash2,
} from "lucide-react";
import AgendaModalShell from "@/components/agenda/AgendaModalShell";
import AgendaPaymentSettingsSection from "@/components/agenda/AgendaPaymentSettings";
import AgendaServiceConfigModal from "@/components/agenda/AgendaServiceConfigModal";
import AgendaServiceSelectorModal from "@/components/agenda/AgendaServiceSelectorModal";
import AgendaStoreServiceModal, {
  type AgendaStoreServiceCreateValues,
  type AgendaStoreServiceUpdateValues,
} from "@/components/agenda/AgendaStoreServiceModal";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import { useMyDirectorySubscription } from "@/hooks/useMyDirectorySubscription";
import { useSupplierModules } from "@/hooks/useSupplierModules";
import { ModuleAccessError } from "@/components/admin/ModuleAccessError";
import { resolveCurrentSupplier } from "@/lib/currentSupplier";
import { startMercadoPagoConnect } from "@/lib/mercadoPagoConnect";
import { agendaService } from "@/services/agendaService";
import { servicesService } from "@/services/servicesService";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  AgendaCatalogService,
  AgendaDay,
  AgendaException,
  AgendaExceptionPayload,
  AgendaExceptionType,
  AgendaPaymentSettings,
  AgendaSchedulePayload,
  AgendaService,
  AgendaSettings,
  AgendaSettingsPayload,
  SlotInterval,
} from "@/types/agenda";

type Section =
  | "general"
  | "hours"
  | "services"
  | "payments"
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

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-[#168e00] focus:ring-2 focus:ring-[#168e00]/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

const selectClass =
  "h-12 w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 pr-11 text-sm text-gray-900 outline-none transition focus:border-[#168e00] focus:ring-4 focus:ring-[#168e00]/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";

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
  const user = useAuthStore((state) => state.user);
  const { loading: accessLoading, error: accessError, hasModule, retry } = useSupplierModules();
  const hasAccess = hasModule("agenda");
  const { isDirectory, loading: directoryLoading } =
    useMyDirectorySubscription(Boolean(user));

  const [section, setSection] = useState<Section>("general");
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AgendaSettings | null>(null);
  const [schedules, setSchedules] = useState<AgendaSchedulePayload[]>([]);
  const [services, setServices] = useState<AgendaService[]>([]);
  const [paymentSettings, setPaymentSettings] =
    useState<AgendaPaymentSettings | null>(null);
  const [catalog, setCatalog] = useState<AgendaCatalogService[]>([]);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [exceptions, setExceptions] = useState<AgendaException[]>([]);
  const [toast, setToast] = useState<ToastState>(null);
  const [saving, setSaving] = useState(false);

  const [selectorOpen, setSelectorOpen] = useState(false);
  const [configuringService, setConfiguringService] =
    useState<AgendaService | null>(null);
  const [storeServiceModalOpen, setStoreServiceModalOpen] = useState(false);
  const [editingCatalogService, setEditingCatalogService] =
    useState<AgendaCatalogService | null>(null);
  const [serviceActionSaving, setServiceActionSaving] = useState(false);
  const [linkingMercadoPago, setLinkingMercadoPago] = useState(false);

  const [exceptionModal, setExceptionModal] = useState(false);
  const [editingException, setEditingException] =
    useState<AgendaException | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!hasAccess) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [
        settingsData,
        scheduleData,
        serviceData,
        catalogData,
        paymentSettingsData,
        exceptionData,
        supplier,
      ] =
        await Promise.all([
          agendaService.getSettings(signal),
          agendaService.listSchedules(signal),
          agendaService.listServices(signal),
          agendaService.listServiceCatalog(signal),
          agendaService.getPaymentSettings(signal),
          agendaService.listExceptions(signal),
          user
            ? resolveCurrentSupplier(user, { signal })
            : Promise.resolve(null),
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
      setCatalog(catalogData);
      setPaymentSettings(paymentSettingsData);
      setSupplierId(supplier?.id ?? null);
      setExceptions(exceptionData);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setToast({
          type: "error",
          message: message(error, "No se pudo cargar la agenda."),
        });
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [hasAccess, user]);

  useEffect(() => {
    if (accessLoading) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [accessLoading, load]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const tabs = useMemo(
    () => [
      { id: "general" as const, label: "General" },
      { id: "hours" as const, label: "Horarios" },
      { id: "services" as const, label: "Servicios" },
      { id: "payments" as const, label: "Pagos" },
      { id: "exceptions" as const, label: "Excepciones" },
      { id: "notifications" as const, label: "Notificaciones" },
    ],
    [],
  );

  if (accessLoading || directoryLoading || (hasAccess && loading)) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Loader2 className="animate-spin text-[#168e00]" size={34} />
      </div>
    );
  }

  if (accessError) return <ModuleAccessError onRetry={() => void retry()} />;

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
    if (!settings) return false;

    setSaving(true);
    try {
      const updated = await agendaService.updateSettings(
        settingsPayload(settings),
      );
      setSettings(updated);
      setToast({ type: "success", message: successMessage });
      return true;
    } catch (error) {
      setToast({
        type: "error",
        message: message(error, "No se pudo guardar."),
      });
      return false;
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
        return false;
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
      return true;
    } catch (error) {
      setToast({
        type: "error",
        message: message(error, "No se pudieron guardar los horarios."),
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const savePaymentSettings = async () => {
    if (!paymentSettings) return false;
    if (
      paymentSettings.accepts_payments &&
      !paymentSettings.allows_cash_payment &&
      !paymentSettings.allows_online_payment
    ) {
      setToast({
        type: "error",
        message: "Selecciona al menos una forma de pago.",
      });
      return false;
    }

    setSaving(true);
    try {
      const updated = await agendaService.updatePaymentSettings({
        accepts_payments: paymentSettings.accepts_payments,
        allows_cash_payment: paymentSettings.allows_cash_payment,
        allows_online_payment: paymentSettings.allows_online_payment,
      });
      setPaymentSettings(updated);
      setToast({ type: "success", message: "Configuración de pagos guardada." });
      return true;
    } catch (error) {
      setToast({
        type: "error",
        message: message(error, "No se pudo guardar la configuración de pagos."),
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const linkMercadoPago = async () => {
    setLinkingMercadoPago(true);
    try {
      await startMercadoPagoConnect("supplier");
    } catch (error) {
      setToast({
        type: "error",
        message: message(error, "No se pudo iniciar la vinculación con Mercado Pago."),
      });
      setLinkingMercadoPago(false);
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

  const refreshServiceData = async () => {
    const [nextServices, nextCatalog] = await Promise.all([
      agendaService.listServices(),
      agendaService.listServiceCatalog(),
    ]);
    setServices(nextServices);
    setCatalog(nextCatalog);
  };

  const addCatalogServices = async (serviceIds: string[]) => {
    const selected = catalog.filter((item) =>
      serviceIds.includes(item.service_id),
    );
    if (selected.length === 0) return;

    setServiceActionSaving(true);
    try {
      const firstDisplayOrder =
        services.reduce(
          (highest, item) => Math.max(highest, item.display_order),
          -1,
        ) + 1;
      const results = await Promise.allSettled(
        selected.map((item, index) =>
          item.agenda_service_id !== null
            ? agendaService.updateService(item.agenda_service_id, {
                is_active: true,
              })
            : agendaService.createService({
                catalog_service_id: item.service_id,
                duration_minutes: 30,
                buffer_minutes: 0,
                is_active: true,
                display_order: firstDisplayOrder + index,
              }),
        ),
      );
      await refreshServiceData();

      const added = results.filter((result) => result.status === "fulfilled").length;
      const failed = results.length - added;
      const firstFailure = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === "rejected",
      );
      if (added > 0) setSelectorOpen(false);
      setToast(
        failed === 0
          ? {
              type: "success",
              message:
                added === 1
                  ? "Servicio agregado a Agenda."
                  : `${added} servicios agregados a Agenda.`,
            }
          : {
              type: added > 0 ? "info" : "error",
              message:
                added > 0
                  ? `Se agregaron ${added} servicios. ${failed} no ${failed === 1 ? "pudo" : "pudieron"} configurarse.`
                  : message(
                      firstFailure?.reason,
                      "No se pudieron agregar los servicios.",
                    ),
            },
      );
    } catch (error) {
      setToast({
        type: "error",
        message: message(error, "No se pudieron agregar los servicios."),
      });
    } finally {
      setServiceActionSaving(false);
    }
  };

  const saveAgendaConfiguration = async (
    payload: Parameters<typeof agendaService.updateService>[1],
  ) => {
    if (!configuringService) return;
    setServiceActionSaving(true);
    try {
      await agendaService.updateService(configuringService.id, payload);
      await refreshServiceData();
      setConfiguringService(null);
      setToast({ type: "success", message: "Configuración de cita actualizada." });
    } catch (error) {
      setToast({
        type: "error",
        message: message(error, "No se pudo actualizar la configuración."),
      });
    } finally {
      setServiceActionSaving(false);
    }
  };

  const deactivateAgendaService = async () => {
    if (!configuringService) return;
    setServiceActionSaving(true);
    try {
      await agendaService.updateService(configuringService.id, {
        is_active: false,
      });
      await refreshServiceData();
      setConfiguringService(null);
      setToast({
        type: "success",
        message: "El servicio dejó de aceptar nuevas reservaciones.",
      });
    } catch (error) {
      setToast({
        type: "error",
        message: message(error, "No se pudo desactivar el servicio."),
      });
    } finally {
      setServiceActionSaving(false);
    }
  };

  const createStoreService = async (
    values: AgendaStoreServiceCreateValues,
  ) => {
    if (!supplierId) {
      setToast({
        type: "error",
        message: "No pudimos identificar tu negocio. Actualiza la página e inténtalo de nuevo.",
      });
      return;
    }

    setServiceActionSaving(true);
    try {
      const created = await servicesService.create({
        supplierId,
        title: values.title,
        description: values.description,
        price: values.price,
        isActive: values.isActive,
        coverIndex: values.image ? 0 : undefined,
        images: values.image ? [values.image] : [],
      });

      try {
        const displayOrder =
          services.reduce(
            (highest, item) => Math.max(highest, item.display_order),
            -1,
          ) + 1;
        await agendaService.createService({
          catalog_service_id: created.id,
          duration_minutes: values.durationMinutes,
          buffer_minutes: values.bufferMinutes,
          is_active: true,
          display_order: displayOrder,
        });
        await refreshServiceData();
        setStoreServiceModalOpen(false);
        setToast({ type: "success", message: "Servicio creado y agregado a Agenda." });
      } catch (agendaError) {
        await refreshServiceData();
        setStoreServiceModalOpen(false);
        setToast({
          type: "error",
          message: `El servicio fue creado, pero no se pudo activar en Agenda. Puedes seleccionarlo nuevamente para completar la configuración. ${message(
            agendaError,
            "",
          )}`.trim(),
        });
      }
    } catch (error) {
      setToast({
        type: "error",
        message: message(error, "No se pudo crear el servicio."),
      });
    } finally {
      setServiceActionSaving(false);
    }
  };

  const updateStoreService = async (
    values: AgendaStoreServiceUpdateValues,
  ) => {
    if (!editingCatalogService) return;
    setServiceActionSaving(true);
    try {
      await servicesService.update(editingCatalogService.service_id, {
        title: values.title,
        description: values.description,
        price: values.price,
        is_active: values.isActive,
      });
      await refreshServiceData();
      setStoreServiceModalOpen(false);
      setEditingCatalogService(null);
      setToast({ type: "success", message: "Servicio actualizado." });
    } catch (error) {
      setToast({
        type: "error",
        message: message(error, "No se pudo actualizar el servicio."),
      });
    } finally {
      setServiceActionSaving(false);
    }
  };

  const currentStepIndex = tabs.findIndex((tab) => tab.id === section);
  const isLastStep = currentStepIndex === tabs.length - 1;
  const isConfigured = Boolean(
    settings?.is_active ||
      schedules.length ||
      services.length ||
      paymentSettings?.accepts_payments ||
      exceptions.length,
  );

  const goBack = () => {
    const previous = tabs[currentStepIndex - 1];
    if (previous) setSection(previous.id);
  };

  const continueWizard = async () => {
    let canContinue = true;

    if (section === "general") {
      canContinue = await saveSettings("Datos generales guardados.");
    } else if (section === "hours") {
      canContinue = await saveSchedules();
    } else if (section === "payments") {
      canContinue = await savePaymentSettings();
    } else if (section === "notifications") {
      canContinue = await saveSettings("Configuración de Agenda terminada.");
    }

    if (!canContinue || isLastStep) return;

    const next = tabs[currentStepIndex + 1];
    if (next) setSection(next.id);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <PageHero
            eyebrow="Configuración guiada"
            title={isConfigured ? "Edita tu agenda" : "Configura tu agenda"}
            subtitle={
              isConfigured
                ? "Recorre los pasos y cambia sólo lo que necesites."
                : "Sigue los pasos para preparar horarios, servicios y avisos."
            }
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

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
        <div className="flex min-w-[900px] items-center">
          {tabs.map((tab, index) => {
            const isCurrent = section === tab.id;
            const isDone = index < currentStepIndex;

            return (
              <div key={tab.id} className="flex flex-1 items-center">
                <div
                  className="flex items-center gap-2 p-1"
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black transition-colors ${
                      isCurrent
                        ? "bg-[#168e00] text-white"
                        : isDone
                          ? "bg-[#004e28] text-white"
                          : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {isDone ? <Check size={15} /> : index + 1}
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      isCurrent ? "text-[#004e28]" : "text-gray-400"
                    }`}
                  >
                    {tab.label}
                  </span>
                </div>
                {index < tabs.length - 1 ? (
                  <div
                    className={`mx-3 h-px flex-1 ${
                      index < currentStepIndex ? "bg-[#168e00]/40" : "bg-gray-200"
                    }`}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
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
                <div className="relative">
                  <select
                    className={selectClass}
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
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                </div>
                <small className="mt-1.5 block text-gray-500">
                  Se utiliza para mostrar correctamente la hora de las citas.
                </small>
              </label>

              <label>
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                  Mostrar horarios cada
                </span>
                <div className="relative">
                  <select
                    className={selectClass}
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
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                </div>
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

        </section>
      ) : null}

      {section === "services" ? (
        <section className="space-y-4">
          <div className={`${panelClass} overflow-hidden`}>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-2 flex items-center gap-3">
                  <span className="rounded-2xl bg-[#168e00]/10 p-2.5 text-[#168e00]">
                    <CalendarClock aria-hidden="true" size={22} />
                  </span>
                  <h2 className="font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28]">
                    Servicios para reservar
                  </h2>
                </div>
                <p className="text-sm leading-6 text-gray-600">
                  Selecciona qué servicios podrán reservar tus clientes y configura cuánto dura cada cita.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {!isDirectory ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCatalogService(null);
                      setStoreServiceModalOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#004e28] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#003b1f]"
                  >
                    <Plus aria-hidden="true" size={18} />
                    Nuevo servicio
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSelectorOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#117500]"
                >
                  <Plus aria-hidden="true" size={18} />
                  Agregar servicios
                </button>
              </div>
            </div>
          </div>

          {services.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
              <CalendarClock className="mx-auto text-[#168e00]" size={36} />
              <h3 className="mt-3 text-xl font-bold text-gray-900">
                {catalog.length === 0
                  ? isDirectory
                    ? "No tienes servicios creados todavía"
                    : "Crea tu primer servicio para comenzar"
                  : "Todavía no has agregado servicios a tu Agenda"}
              </h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-600">
                {catalog.length === 0
                  ? isDirectory
                    ? "Crea primero tus servicios y después podrás elegir cuáles aceptar con cita."
                    : "Crea tu primer servicio para comenzar a recibir reservaciones."
                  : "Selecciona uno o varios servicios para que tus clientes puedan reservarlos."}
              </p>
              <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                {catalog.length === 0 && isDirectory ? (
                  <Link
                    href="/admin/services/create"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#004e28] px-4 py-3 text-sm font-bold text-white"
                  >
                    Crear mi primer servicio
                    <ExternalLink aria-hidden="true" size={16} />
                  </Link>
                ) : !isDirectory && catalog.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCatalogService(null);
                      setStoreServiceModalOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#004e28] px-4 py-3 text-sm font-bold text-white"
                  >
                    <Plus aria-hidden="true" size={17} />
                    Crear primer servicio
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSelectorOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-3 text-sm font-bold text-white"
                  >
                    <Plus aria-hidden="true" size={17} />
                    Seleccionar servicios
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {services.map((item) => {
                const catalogService = catalog.find(
                  (entry) => entry.service_id === item.catalog_service_id,
                );
                const catalogIsInactive = catalogService?.is_active === false;
                return (
                  <article key={item.id} className={`${panelClass} flex flex-col`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-gray-900">
                            {item.name}
                          </h3>
                          <span
                            className={
                              item.is_active && !catalogIsInactive
                                ? "rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700"
                                : "rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600"
                            }
                          >
                            {catalogIsInactive
                              ? "Servicio inactivo"
                              : item.is_active
                                ? "Disponible para reservar"
                                : "Reservaciones desactivadas"}
                          </span>
                        </div>
                        {item.description ? (
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600">
                            {item.description}
                          </p>
                        ) : null}
                      </div>
                      <p className="shrink-0 font-bold text-[#004e28]">
                        {money(item.price)}
                      </p>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-2xl bg-[#f2f3f4] p-3 text-gray-700">
                        <Clock3 aria-hidden="true" className="mb-1 text-[#168e00]" size={18} />
                        <strong className="block">{item.duration_minutes} min</strong>
                        <span className="text-xs">Duración</span>
                      </div>
                      <div className="rounded-2xl bg-[#f2f3f4] p-3 text-gray-700">
                        <Clock3 aria-hidden="true" className="mb-1 text-[#168e00]" size={18} />
                        <strong className="block">{item.buffer_minutes} min</strong>
                        <span className="text-xs">Tiempo posterior</span>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setConfiguringService(item)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#117500]"
                      >
                        <Settings2 aria-hidden="true" size={17} />
                        Configurar cita
                      </button>
                      {isDirectory ? (
                        <Link
                          href={`/admin/services/${item.catalog_service_id}`}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                        >
                          <Pencil aria-hidden="true" size={16} />
                          Editar servicio
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled={!catalogService}
                          onClick={() => {
                            if (!catalogService) return;
                            setEditingCatalogService(catalogService);
                            setStoreServiceModalOpen(true);
                          }}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Pencil aria-hidden="true" size={16} />
                          Editar servicio
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {section === "payments" && paymentSettings ? (
        <AgendaPaymentSettingsSection
          value={paymentSettings}
          linking={linkingMercadoPago}
          onChange={setPaymentSettings}
          onLinkMercadoPago={() => void linkMercadoPago()}
          onRequireMercadoPago={() =>
            setToast({
              type: "info",
              message: "Vincula primero tu cuenta de Mercado Pago.",
            })
          }
        />
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

        </section>
      ) : null}

      <div className="sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white/95 p-4 shadow-[0_18px_50px_-24px_rgba(0,78,40,0.45)] backdrop-blur-md">
        <button
          type="button"
          onClick={goBack}
          disabled={currentStepIndex === 0 || saving}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-3 font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft size={17} /> Atrás
        </button>

        <div className="text-center text-xs font-semibold text-gray-400">
          Paso {currentStepIndex + 1} de {tabs.length}
        </div>

        <button
          type="button"
          onClick={() => void continueWizard()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-bold text-white transition hover:bg-[#117500] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : null}
          {isLastStep ? "Terminar configuración" : "Guardar y continuar"}
          {!isLastStep ? <ArrowRight size={17} /> : <Check size={17} />}
        </button>
      </div>

      {selectorOpen ? (
        <AgendaServiceSelectorModal
          open
          catalog={catalog}
          isDirectory={isDirectory}
          saving={serviceActionSaving}
          onClose={() => setSelectorOpen(false)}
          onAdd={addCatalogServices}
        />
      ) : null}

      {configuringService ? (
        <AgendaServiceConfigModal
          open
          service={configuringService}
          saving={serviceActionSaving}
          onClose={() => setConfiguringService(null)}
          onSave={saveAgendaConfiguration}
          onDeactivate={deactivateAgendaService}
        />
      ) : null}

      {!isDirectory && storeServiceModalOpen ? (
        <AgendaStoreServiceModal
          open
          service={editingCatalogService}
          saving={serviceActionSaving}
          onClose={() => {
            setStoreServiceModalOpen(false);
            setEditingCatalogService(null);
          }}
          onCreate={createStoreService}
          onUpdate={updateStoreService}
        />
      ) : null}

      {exceptionModal ? (
        <ExceptionModal
          open
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
      ) : null}

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
  const [form, setForm] = useState<AgendaExceptionPayload>(
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

  if (!open) return null;

  const timed = form.exception_type !== "closed";

  return (
    <AgendaModalShell
      open={open}
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
        <div className="relative">
          <select
            className={selectClass}
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
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
        </div>
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
    </AgendaModalShell>
  );
}
