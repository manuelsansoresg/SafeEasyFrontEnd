import type { AgendaBooking, AgendaBookingPayload } from '@/types/agendaBooking';

// FastAPI Decimal responses may be JSON numbers in untyped dictionaries.
export type Money = string | number;
export type ManualMethod = 'cash' | 'external_terminal' | 'bank_transfer';
export interface ChargePolicy {
  mode: 'offline' | 'full' | 'percentage' | 'fixed';
  percentage: Money | null;
  fixed_amount: Money | null;
  retain_deposit: boolean;
  retention_authorized: boolean;
  terms_version: string | null;
  terms_text: string | null;
}
export interface FinancialQuote {
  ledger_version: 2; service_id: number; total: Money | null; currency: string;
  initial_required: Money; remaining_after_initial: Money | null;
  policy: ChargePolicy; acceptance_required: boolean;
}
export interface FinancialSummary {
  booking_id: number; ledger_version: number; total: Money | null;
  currency?: string; mode?: ChargePolicy['mode']; initial_required?: Money;
  remaining_after_initial?: Money | null; deposit_confirmed?: Money;
  gross_collected?: Money; refunded?: Money; balance_due: Money | null;
  retained?: Money; refund_pending?: Money; settlement_status: string;
  review_required: boolean; allowed_manual_methods: ManualMethod[];
}
export interface FinancialIntent {
  id: number; booking_id: number; purpose: string; amount: Money; currency: string;
  status: string; checkout_url: string | null; expires_at: string | null; last_error: string | null;
}
export interface FinancialOperation {
  id: number; kind: string; method: string; amount: Money; status: string;
  refunded_amount: Money; reference: string | null; original_operation_id: number | null;
  created_at: string; confirmed_at: string | null;
}
export interface FinancialRefund {
  id: number; operation_id: number; amount: Money; status: string; reason: string | null;
  external_id: string | null;
  created_at: string; confirmed_at: string | null; manual_reference: string | null; last_error: string | null;
}
export interface FinancialHistory {
  operations: FinancialOperation[]; intents: FinancialIntent[]; refunds: FinancialRefund[];
  events: { id: number; type: string; created_at: string; details: Record<string, unknown> }[];
}
export type FinancialBookingPayload = Omit<AgendaBookingPayload, 'payment_method'> & {
  idempotency_key: string; accepted_terms_version: string | null;
};
export interface FinancialBookingCreated {
  booking: AgendaBooking & { management_token: string };
  financial: FinancialSummary; payment_intent: FinancialIntent | null;
}
export interface CancellationResult {
  retained_amount: Money; review_required: boolean;
  refunds: { id: number; amount: Money; method: string; status: string; request_state: string; confirmed_at: string | null }[];
}
export interface CancellationPreview {
  booking_id: number; ledger_version: number; cancellation_allowed: boolean;
  within_deadline: boolean; cancellation_deadline_at: string; cancellation_notice_hours: number;
  original_total: Money | null; deposit_paid: Money; retained_amount: Money;
  online_refund_amount: Money; manual_refund_amount: Money; balance_waived: Money | null;
  review_required: boolean; requires_loss_confirmation: boolean; message: string; preview_token: string;
}
