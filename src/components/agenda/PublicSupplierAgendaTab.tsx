"use client";

import Link from "next/link";
import {
  CalendarDays,
  Clock3,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { agendaBookingService } from "@/services/agendaBookingService";
import type { AgendaService } from "@/types/agenda";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

function formatPrice(value: number | null) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return null;
  }

  return currencyFormatter.format(value);
}

export function PublicSupplierAgendaTab({
  supplierId,
}: {
  supplierId: number;
}) {
  const [services, setServices] = useState<AgendaService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const result =
          await agendaBookingService.listPublicServices(
            supplierId,
            controller.signal,
          );

        if (controller.signal.aborted) return;

        setServices(
          result
            .filter((service) => service.is_active)
            .sort(
              (first, second) =>
                first.display_order -
                  second.display_order ||
                first.id - second.id,
            ),
        );
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        setServices([]);
        setError(
          requestError instanceof Error
            ? requestError.message
            : "No se pudo cargar la agenda.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => controller.abort();
  }, [supplierId]);

  if (loading) {
    return (
      <section className="bg-[#f7f9f8] py-16">
        <div className="mx-auto flex max-w-6xl items-center justify-center px-5 md:px-8">
          <div className="inline-flex items-center gap-3 rounded-2xl bg-white px-6 py-4 font-semibold text-[#004e28] shadow-sm">
            <Loader2
              size={20}
              className="animate-spin text-[#168e00]"
            />
            Cargando agenda
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bg-[#f7f9f8] py-16">
        <div className="mx-auto max-w-6xl px-5 md:px-8">
          <div className="rounded-3xl border border-red-100 bg-white p-7 text-center shadow-sm">
            <p className="font-semibold text-red-600">
              {error}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!services.length) {
    return null;
  }

  return (
    <section className="bg-[#f7f9f8] py-14 md:py-18">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="rounded-[2rem] bg-[#004e28] p-6 text-white sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
              <CalendarDays size={25} />
            </span>

            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">
                Agenda
              </p>
              <h2 className="mt-1 font-[family-name:var(--font-varela-round)] text-3xl font-black">
                Reserva tu cita
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
                Revisa los servicios disponibles y continúa
                para elegir fecha y horario.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {services.map((service) => {
            const price = formatPrice(service.price);

            return (
              <article
                key={service.id}
                className="rounded-3xl border border-[#004e28]/10 bg-white p-5 shadow-[0_16px_40px_-32px_rgba(0,78,40,0.6)]"
              >
                <h3 className="font-[family-name:var(--font-varela-round)] text-lg font-black text-[#004e28]">
                  {service.name}
                </h3>

                {service.description ? (
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-600">
                    {service.description}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-gray-600">
                    <Clock3 size={13} />
                    {service.duration_minutes} min
                  </span>

                  {price ? (
                    <span className="rounded-full bg-[#168e00]/10 px-3 py-1.5 text-[#168e00]">
                      {price}
                    </span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-7">
          <Link
            href={`/agenda/${supplierId}`}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#168e00] px-7 py-3 text-base font-black text-white shadow-[0_0_30px_-8px_rgba(22,142,0,0.7)] transition hover:-translate-y-0.5 hover:bg-[#137a00] sm:w-auto"
          >
            <CalendarDays size={19} />
            Elegir fecha y horario
          </Link>
        </div>
      </div>
    </section>
  );
}
