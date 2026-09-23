export type AgendaDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type SlotInterval = 15 | 20 | 30 | 60;
export type ServiceDuration = 15 | 20 | 30 | 45 | 60 | 90 | 120;
export type BufferDuration = 0 | 5 | 10 | 15 | 20 | 30 | 45 | 60;
export type AgendaExceptionType = "closed" | "special_hours" | "blocked";
export type AgendaPaymentMethod = "none" | "cash" | "online";
export type AgendaPaymentStatus =
  | "not_required"
  | "pending"
  | "paid"
  | "failed"
  | "expired";

export interface AgendaPaymentSettings {
  supplier_id: number;
  accepts_payments: boolean;
  allows_cash_payment: boolean;
  allows_online_payment: boolean;
  mercadopago_linked: boolean;
  online_payment_available: boolean;
}

export interface AgendaPaymentSettingsPayload {
  accepts_payments: boolean;
  allows_cash_payment: boolean;
  allows_online_payment: boolean;
}

export interface AgendaSettings {
  id: number;
  supplier_id: number;
  timezone: string;
  slot_interval_minutes: SlotInterval;
  minimum_notice_minutes: number;
  maximum_booking_days: number;
  cancellation_notice_hours: number;
  automatic_confirmation: boolean;
  is_active: boolean;
  allow_guest_bookings: boolean;
  require_guest_email: boolean;
  allow_customer_cancellation: boolean;
  allow_reschedule_requests: boolean;
  provider_push_notifications: boolean;
  provider_email_notifications: boolean;
  customer_email_notifications: boolean;
  customer_push_notifications: boolean;
  reminder_24_hours: boolean;
  reminder_2_hours: boolean;
  notification_email: string | null;
  created_at: string;
  updated_at: string;
}

export type AgendaSettingsPayload = Omit<
  AgendaSettings,
  "id" | "supplier_id" | "created_at" | "updated_at"
>;

export interface AgendaSchedule {
  id: number;
  supplier_id: number;
  day_of_week: AgendaDay;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgendaSchedulePayload {
  day_of_week: AgendaDay;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface AgendaService {
  id: number;
  supplier_id: number;
  catalog_service_id: string;
  name: string;
  description: string | null;
  duration_minutes: ServiceDuration;
  buffer_minutes: BufferDuration;
  price: number | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface AgendaServiceCreatePayload {
  catalog_service_id: string;
  duration_minutes: ServiceDuration;
  buffer_minutes: BufferDuration;
  is_active: boolean;
  display_order: number;
}

export interface AgendaServiceUpdatePayload {
  duration_minutes?: ServiceDuration;
  buffer_minutes?: BufferDuration;
  is_active?: boolean;
  display_order?: number;
}

export interface AgendaCatalogService {
  service_id: string;
  title: string;
  description: string;
  price: number;
  is_active: boolean;
  is_agenda_only: boolean;
  agenda_service_id: number | null;
  agenda_enabled: boolean;
  duration_minutes: ServiceDuration | null;
  buffer_minutes: BufferDuration | null;
  display_order: number | null;
}

export interface AgendaException {
  id: number;
  supplier_id: number;
  exception_date: string;
  exception_type: AgendaExceptionType;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgendaExceptionPayload {
  exception_date: string;
  exception_type: AgendaExceptionType;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}
