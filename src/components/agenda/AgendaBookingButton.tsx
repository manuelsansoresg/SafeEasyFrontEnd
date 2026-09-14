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
        className={`inline-flex items-center gap-2 rounded-xl bg-gray-100 px-5 py-3 font-semibold text-gray-500 ${className}`}
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
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-semibold text-white transition hover:bg-[#117500] ${className}`}
    >
      <CalendarDays size={19} />
      Reservar cita
    </Link>
  );
}
