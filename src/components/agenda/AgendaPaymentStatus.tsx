"use client";

import { Banknote, CheckCircle2, Clock3, CreditCard, Loader2, ReceiptText } from "lucide-react";
import { getSafeMercadoPagoUrl } from "@/lib/security";
import type { AgendaBookingPayment } from "@/types/agendaBooking";
import type { AgendaPaymentStatus as PaymentStatus } from "@/types/agenda";

type AgendaPaymentStatusProps = {
  payment: AgendaBookingPayment | null | undefined;
  loading?: boolean;
  compact?: boolean;
  markingPaid?: boolean;
  onMarkPaid?: () => void;
};

const statusCopy: Record<PaymentStatus, { label: string; classes: string }> = {
  not_required: { label: "No requiere pago", classes: "bg-gray-100 text-gray-600" },
  pending: { label: "Pago pendiente", classes: "bg-amber-50 text-amber-800" },
  paid: { label: "Pagado", classes: "bg-green-50 text-green-700" },
  failed: { label: "Pago no completado", classes: "bg-red-50 text-red-700" },
  expired: { label: "Pago expirado", classes: "bg-gray-200 text-gray-700" },
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value);
}

function paymentMethodLabel(payment: AgendaBookingPayment) {
  if (payment.payment_method === "cash") return "Pago directo";
  if (payment.payment_method === "online") return "Tarjeta / Mercado Pago";
  return "Sin pago";
}

export default function AgendaPaymentStatus({
  payment,
  loading = false,
  compact = false,
  markingPaid = false,
  onMarkPaid,
}: AgendaPaymentStatusProps) {
  if (loading || payment === undefined) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-gray-50 p-4 text-sm text-gray-500" role="status">
        <Loader2 aria-hidden="true" size={17} className="animate-spin" />
        Consultando pago...
      </div>
    );
  }

  if (payment === null) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-gray-50 p-4 text-sm text-gray-500">
        <ReceiptText aria-hidden="true" size={18} />
        Sin registro de pago
      </div>
    );
  }

  const status = statusCopy[payment.payment_status];
  const safeCheckout = getSafeMercadoPagoUrl(payment.payment_checkout_url);
  const pendingOnline =
    payment.payment_method === "online" && payment.payment_status === "pending";

  return (
    <div className={`rounded-2xl border border-gray-100 bg-[#f8faf9] ${compact ? "p-4" : "p-5"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#168e00]/10 text-[#168e00]">
            {payment.payment_method === "online" ? (
              <CreditCard aria-hidden="true" size={20} />
            ) : payment.payment_method === "cash" ? (
              <Banknote aria-hidden="true" size={20} />
            ) : (
              <ReceiptText aria-hidden="true" size={20} />
            )}
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-gray-400">Pago</p>
            <p className="mt-1 font-bold text-gray-900">{paymentMethodLabel(payment)}</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${status.classes}`}>
          {status.label}
        </span>
      </div>

      {!compact ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Total</p>
            <p className="mt-1 font-black text-[#004e28]">{formatMoney(payment.amount)} MXN</p>
          </div>
          <div className="rounded-xl bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Estado</p>
            <p className="mt-1 font-bold text-gray-800">{status.label}</p>
          </div>
        </div>
      ) : payment.payment_method !== "none" ? (
        <p className="mt-3 text-sm font-bold text-[#004e28]">{formatMoney(payment.amount)} MXN</p>
      ) : null}

      {pendingOnline && !compact ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          <p className="font-bold">Tu horario está reservado temporalmente mientras completas el pago.</p>
          {payment.payment_expires_at ? (
            <p className="mt-1 flex items-center gap-2">
              <Clock3 aria-hidden="true" size={16} />
              Completa el pago antes de las {new Intl.DateTimeFormat("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(payment.payment_expires_at))}.
            </p>
          ) : null}
        </div>
      ) : null}

      {payment.payment_status === "paid" && payment.paid_at && !compact ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-green-700">
          <CheckCircle2 aria-hidden="true" size={17} />
          Confirmado el {new Intl.DateTimeFormat("es-MX", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(payment.paid_at))}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {pendingOnline && safeCheckout && !compact ? (
          <button
            type="button"
            onClick={() => window.location.assign(safeCheckout)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-bold text-white"
          >
            <CreditCard aria-hidden="true" size={17} />
            Continuar pago
          </button>
        ) : null}

        {payment.payment_method === "cash" &&
        payment.payment_status === "pending" &&
        onMarkPaid ? (
          <button
            type="button"
            disabled={markingPaid}
            onClick={onMarkPaid}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {markingPaid ? (
              <Loader2 aria-hidden="true" size={17} className="animate-spin" />
            ) : (
              <CheckCircle2 aria-hidden="true" size={17} />
            )}
            Marcar como pagado
          </button>
        ) : null}
      </div>
    </div>
  );
}
