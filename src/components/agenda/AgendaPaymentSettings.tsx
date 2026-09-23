"use client";

import { Banknote, CheckCircle2, CreditCard, ExternalLink, Loader2 } from "lucide-react";
import type { AgendaPaymentSettings } from "@/types/agenda";

type AgendaPaymentSettingsProps = {
  value: AgendaPaymentSettings;
  linking: boolean;
  onChange: (value: AgendaPaymentSettings) => void;
  onLinkMercadoPago: () => void;
  onRequireMercadoPago: () => void;
};

function Switch({
  id,
  checked,
  disabled = false,
  label,
  onChange,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className={disabled ? "cursor-not-allowed" : "cursor-pointer"}>
      <span className="sr-only">{label}</span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="relative block h-8 w-14 rounded-full bg-gray-300 transition peer-checked:bg-[#168e00] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#004e28] peer-disabled:opacity-50 after:absolute after:left-1 after:top-1 after:size-6 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-6" />
    </label>
  );
}

export default function AgendaPaymentSettingsSection({
  value,
  linking,
  onChange,
  onLinkMercadoPago,
  onRequireMercadoPago,
}: AgendaPaymentSettingsProps) {
  const methodsEnabled = value.accepts_payments;

  return (
    <section className="space-y-5" aria-labelledby="agenda-payments-title">
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#168e00]">
          Pagos de las citas
        </p>
        <h2
          id="agenda-payments-title"
          className="mt-2 font-[family-name:var(--font-varela-round)] text-2xl text-[#004e28]"
        >
          Decide cómo cobrar tus reservaciones
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
          Decide si quieres cobrar tus servicios cuando un cliente agenda.
        </p>

        <div className="mt-6 flex items-start justify-between gap-5 rounded-2xl border border-[#168e00]/20 bg-[#168e00]/5 p-4 sm:items-center sm:p-5">
          <div>
            <label htmlFor="accepts-agenda-payments" className="font-bold text-[#004e28]">
              Aceptar pagos en las reservaciones
            </label>
            <p className="mt-1 max-w-xl text-sm leading-6 text-gray-600">
              Al activarlo, el cliente podrá elegir cómo pagar el servicio al momento de reservar.
            </p>
          </div>
          <Switch
            id="accepts-agenda-payments"
            label="Aceptar pagos en las reservaciones"
            checked={value.accepts_payments}
            onChange={(accepts_payments) =>
              onChange({ ...value, accepts_payments })
            }
          />
        </div>
      </div>

      <div
        className={`grid gap-4 md:grid-cols-2 ${methodsEnabled ? "" : "opacity-60"}`}
        aria-disabled={!methodsEnabled}
      >
        <article className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-[#168e00]/10 text-[#168e00]">
              <Banknote aria-hidden="true" size={24} />
            </span>
            <Switch
              id="allows-cash-payment"
              label="Permitir pago directo"
              checked={methodsEnabled && value.allows_cash_payment}
              disabled={!methodsEnabled}
              onChange={(allows_cash_payment) =>
                onChange({ ...value, allows_cash_payment })
              }
            />
          </div>
          <h3 className="mt-4 text-lg font-bold text-gray-900">Pago directo</h3>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            El cliente reserva y realiza el pago directamente contigo.
          </p>
          <span
            className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-black ${
              methodsEnabled && value.allows_cash_payment
                ? "bg-green-50 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {methodsEnabled && value.allows_cash_payment ? "ACTIVADO" : "DESACTIVADO"}
          </span>
        </article>

        <article className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-[#004e28]/10 text-[#004e28]">
              <CreditCard aria-hidden="true" size={24} />
            </span>
            <Switch
              id="allows-online-payment"
              label="Permitir pago con Mercado Pago"
              checked={methodsEnabled && value.allows_online_payment && value.mercadopago_linked}
              disabled={!methodsEnabled}
              onChange={(allows_online_payment) => {
                if (allows_online_payment && !value.mercadopago_linked) {
                  onRequireMercadoPago();
                  return;
                }
                onChange({ ...value, allows_online_payment });
              }}
            />
          </div>
          <h3 className="mt-4 text-lg font-bold text-gray-900">Tarjeta / Mercado Pago</h3>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            El cliente paga en línea al realizar su reservación.
          </p>

          {value.mercadopago_linked ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-bold text-green-700">
              <CheckCircle2 aria-hidden="true" size={17} />
              Mercado Pago vinculado
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-900">Mercado Pago no vinculado</p>
              <button
                type="button"
                disabled={linking}
                onClick={onLinkMercadoPago}
                className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#004e28] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#003b1f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#168e00] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {linking ? (
                  <Loader2 aria-hidden="true" size={17} className="animate-spin" />
                ) : (
                  <ExternalLink aria-hidden="true" size={17} />
                )}
                {linking ? "Abriendo Mercado Pago..." : "Vincular Mercado Pago"}
              </button>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
