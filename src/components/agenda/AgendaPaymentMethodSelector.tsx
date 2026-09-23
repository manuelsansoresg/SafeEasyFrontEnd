"use client";

import { Banknote, CreditCard } from "lucide-react";
import type { AgendaPaymentMethod } from "@/types/agenda";

type AgendaPaymentMethodSelectorProps = {
  allowsCash: boolean;
  onlineAvailable: boolean;
  value: AgendaPaymentMethod;
  onChange: (value: Exclude<AgendaPaymentMethod, "none">) => void;
};

export default function AgendaPaymentMethodSelector({
  allowsCash,
  onlineAvailable,
  value,
  onChange,
}: AgendaPaymentMethodSelectorProps) {
  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-xl font-bold text-gray-900">4. Forma de pago</h2>
      <p className="mt-1 text-sm text-gray-500">Elige cómo quieres pagar este servicio.</p>

      <fieldset className="mt-5 grid gap-3 md:grid-cols-2">
        <legend className="sr-only">Forma de pago</legend>
        {allowsCash ? (
          <label
            className={
              value === "cash"
                ? "flex min-h-28 cursor-pointer items-start gap-3 rounded-2xl border-2 border-[#168e00] bg-[#168e00]/5 p-4"
                : "flex min-h-28 cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 p-4 transition hover:border-[#168e00]/40"
            }
          >
            <input
              type="radio"
              name="agenda-payment-method"
              value="cash"
              checked={value === "cash"}
              onChange={() => onChange("cash")}
              className="mt-1 size-5 shrink-0 accent-[#168e00]"
            />
            <span>
              <span className="flex items-center gap-2 font-bold text-gray-900">
                <Banknote aria-hidden="true" size={20} className="text-[#168e00]" />
                Pago directo
              </span>
              <span className="mt-2 block text-sm leading-6 text-gray-600">
                Realiza la reservación y paga directamente con el negocio.
              </span>
            </span>
          </label>
        ) : null}

        {onlineAvailable ? (
          <label
            className={
              value === "online"
                ? "flex min-h-28 cursor-pointer items-start gap-3 rounded-2xl border-2 border-[#168e00] bg-[#168e00]/5 p-4"
                : "flex min-h-28 cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 p-4 transition hover:border-[#168e00]/40"
            }
          >
            <input
              type="radio"
              name="agenda-payment-method"
              value="online"
              checked={value === "online"}
              onChange={() => onChange("online")}
              className="mt-1 size-5 shrink-0 accent-[#168e00]"
            />
            <span>
              <span className="flex items-center gap-2 font-bold text-gray-900">
                <CreditCard aria-hidden="true" size={20} className="text-[#168e00]" />
                Tarjeta / Mercado Pago
              </span>
              <span className="mt-2 block text-sm leading-6 text-gray-600">
                Paga el servicio en línea al realizar la reservación.
              </span>
            </span>
          </label>
        ) : null}
      </fieldset>
    </section>
  );
}
