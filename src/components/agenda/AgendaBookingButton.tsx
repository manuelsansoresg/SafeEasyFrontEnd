"use client";

import Link from "next/link";
import { CalendarDays, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { agendaBookingService } from "@/services/agendaBookingService";

export function AgendaBookingButton({
  supplierId,
  className = "",
}: {
  supplierId: number;
  className?: string;
}) {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      try {
        const services =
          await agendaBookingService.listPublicServices(
            supplierId,
            controller.signal,
          );

        setAvailable(services.length > 0);
      } catch {
        setAvailable(false);
      } finally {
        setLoading(false);
      }
    };

    void run();

    return () => controller.abort();
  }, [supplierId]);

  if (loading) {
    return (
      <span
        className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-7 py-3 font-semibold text-white/80 backdrop-blur-md sm:w-auto ${className}`}
      >
        <Loader2 size={18} className="animate-spin" />
        Consultando agenda
      </span>
    );
  }

  if (!available) return null;

  return (
    <Link
      href={`/agenda/${supplierId}`}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#168e00] px-7 py-3 text-base font-bold text-white shadow-[0_0_30px_-5px_rgba(22,142,0,0.6)] transition-all hover:-translate-y-1 hover:bg-[#137a00] hover:shadow-[0_0_40px_-5px_rgba(22,142,0,0.8)] font-[family-name:var(--font-varela-round)] sm:w-auto sm:px-8 sm:text-lg ${className}`}
    >
      <CalendarDays size={20} />
      Reservar cita
    </Link>
  );
}
