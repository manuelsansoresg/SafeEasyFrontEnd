"use client";

import Link from "next/link";
import { CalendarDays, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { agendaBookingService } from "@/services/agendaBookingService";
import type { AgendaService } from "@/types/agenda";

const currencyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
});

function serviceSummary(services: AgendaService[]) {
  if (!services.length) {
    return "Elige el día y horario que mejor te funcione";
  }

  if (services.length === 1) {
    const service = services[0];

    if (typeof service.price === "number" && Number.isFinite(service.price)) {
      return `${service.name} · ${currencyFormatter.format(service.price)}`;
    }

    return service.name;
  }

  return `${services.length} servicios disponibles`;
}

export function AgendaBookingButton({
  supplierId,
  className = "",
}: {
  supplierId: number;
  className?: string;
}) {
  const [services, setServices] = useState<AgendaService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      setLoading(true);

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
                first.display_order - second.display_order ||
                first.id - second.id,
            ),
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setServices([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => controller.abort();
  }, [supplierId]);

  const subtitle = useMemo(
    () => serviceSummary(services),
    [services],
  );

  if (loading) {
    return (
      <span
        className={`inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full border border-white/20 bg-white/10 px-6 py-3 text-white/85 backdrop-blur-md sm:w-auto ${className}`}
      >
        <Loader2
          size={19}
          className="shrink-0 animate-spin"
        />

        <span className="flex flex-col text-left leading-tight">
          <span className="text-sm font-bold">
            Consultando agenda
          </span>

          <span className="mt-0.5 text-xs font-medium text-white/65">
            Revisando disponibilidad
          </span>
        </span>
      </span>
    );
  }

  if (!services.length) {
    return null;
  }

  return (
    <Link
      href={`/agenda/${supplierId}`}
      className={`group inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-[#168e00] px-6 py-3 text-white shadow-[0_0_30px_-5px_rgba(22,142,0,0.6)] transition-all hover:-translate-y-1 hover:bg-[#137a00] hover:shadow-[0_0_40px_-5px_rgba(22,142,0,0.8)] sm:w-auto ${className}`}
      aria-label="Agenda disponible. Consultar horarios y reservar cita"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 transition-colors group-hover:bg-white/20">
        <CalendarDays size={20} />
      </span>

      <span className="flex min-w-0 flex-col text-left leading-tight">
        <span className="font-[family-name:var(--font-varela-round)] text-base font-black sm:text-lg">
          Agenda disponible
        </span>

        <span className="mt-1 max-w-[16rem] truncate text-xs font-medium text-white/80 sm:text-sm">
          {subtitle}
        </span>
      </span>
    </Link>
  );
}
