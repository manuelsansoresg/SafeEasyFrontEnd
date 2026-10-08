import type {
  AgendaPaymentMethod,
  AgendaPaymentStatus,
  AgendaService,
} from "@/types/agenda";

export type AgendaBookingStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

export type AgendaRescheduleStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export interface AgendaAvailabilitySlot {
  start_at: string;
  end_at: string;
}

export interface AgendaAvailability {
  supplier_id: number;
  service_id: number;
  timezone: string;

  minimum_notice_minutes: number;
  maximum_booking_days: number;
  cancellation_notice_hours: number;

  allow_guest_bookings: boolean;
  require_guest_email: boolean;
  allow_customer_cancellation: boolean;
  allow_reschedule_requests: boolean;

  accepts_payments: boolean;
  allows_cash_payment: boolean;
  allows_online_payment: boolean;
  mercadopago_linked: boolean;
  online_payment_available: boolean;

  slots: AgendaAvailabilitySlot[];
}

export interface AgendaBookingPayload {
  service_id: number;
  start_at: string;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  notes?: string | null;
  payment_method: AgendaPaymentMethod;
}

export interface AgendaProviderBookingPayload
  extends Omit<AgendaBookingPayload, "payment_method"> {
  customer_user_id?: number | null;
  status?: "pending" | "confirmed" | null;
}

export interface AgendaBooking {
  id: number;
  supplier_id: number;
  service_id: number;
  customer_user_id: number | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  start_at: string;
  end_at: string;
  status: AgendaBookingStatus;
  notes: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  cancellation_allowed_snapshot?: boolean | null;
  cancellation_notice_hours_snapshot?: number | null;
  cancellation_deadline_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgendaProviderBooking extends AgendaBooking {
  provider_notes: string | null;
}

export interface AgendaBookingCreated extends AgendaBooking {
  management_token: string;
  payment_method: AgendaPaymentMethod;
  payment_status: AgendaPaymentStatus;
  payment_amount: number;
  payment_checkout_url: string | null;
  payment_expires_at: string | null;
  paid_at: string | null;
}

export interface AgendaProviderBookingCreated extends AgendaBooking {
  management_token: string;
}

export interface AgendaBookingPayment {
  booking_id: number;
  supplier_id: number;
  payment_method: AgendaPaymentMethod;
  payment_status: AgendaPaymentStatus;
  amount: number;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  payment_checkout_url: string | null;
  payment_expires_at: string | null;
  paid_at: string | null;
}

export interface AgendaRescheduleRequest {
  id: number;
  booking_id: number;
  requested_start_at: string;
  reason: string | null;
  status: AgendaRescheduleStatus;
  response_note: string | null;
  requested_by_user_id: number | null;
  decided_by_user_id: number | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgendaCancelPayload {
  reason?: string | null;
  management_token?: string | null;
}

export interface AgendaReschedulePayload {
  requested_start_at: string;
  reason?: string | null;
  management_token?: string | null;
}

export interface AgendaRescheduleDecisionPayload {
  approve: boolean;
  response_note?: string | null;
}

export interface AgendaStatusPayload {
  status: AgendaBookingStatus;
  provider_notes?: string | null;
  cancellation_reason?: string | null;
}

export type AgendaRefundStatus = "pending" | "processing" | "failed" | "confirmed" | "manual_pending";
export type AgendaRefundType = "primary" | "additional" | "unknown";

export interface AgendaRefund {
  id: number;
  booking_id: number;
  payment_id: number;
  readonly mp_payment_id: string | null;
  readonly refund_type: AgendaRefundType;
  amount: number;
  currency: string;
  method: string;
  status: AgendaRefundStatus;
  reason: string | null;
  initiated_by: string;
  requested_at: string;
  confirmed_at: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  manual_reference: string | null;
  confirmed_by_user_id: number | null;
}

export interface AgendaBookingWithService {
  booking: AgendaBooking;
  service: AgendaService | null;
}
