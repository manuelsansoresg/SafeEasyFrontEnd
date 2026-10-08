import type { AgendaRefund, AgendaRefundStatus as RefundStatus } from "@/types/agendaBooking";

const copy: Record<RefundStatus, { title: string; detail: string; color: string }> = {
  pending: { title: "Reembolso pendiente", detail: "Estamos gestionando la devolución de tu pago.", color: "bg-amber-50 text-amber-800" },
  processing: { title: "Reembolso en proceso", detail: "La devolución está siendo procesada.", color: "bg-amber-50 text-amber-800" },
  confirmed: { title: "Reembolso procesado", detail: "La devolución fue confirmada. El tiempo de acreditación depende de tu medio de pago.", color: "bg-green-50 text-green-700" },
  failed: { title: "Reembolso pendiente de revisión", detail: "No se pudo completar la devolución. El negocio debe dar seguimiento.", color: "bg-red-50 text-red-700" },
  manual_pending: { title: "Devolución pendiente del negocio", detail: "El negocio debe realizar y confirmar la devolución de tu pago directo.", color: "bg-amber-50 text-amber-800" },
};

export default function AgendaRefundStatus({ refund, compact = false }: { refund: AgendaRefund; compact?: boolean }) {
  const status = copy[refund.status];
  const refundType = refund.refund_type ?? "unknown";
  const typeLabel = refundType === "primary" ? "Reembolso del servicio" : refundType === "additional" ? "Devolución de cobro adicional" : "Devolución";
  const detail = refundType === "additional"
    ? refund.status === "confirmed"
      ? "Se devolvió un cobro adicional. Esta operación no modifica por sí sola el pago principal de la reservación."
      : refund.status === "failed"
        ? "No se pudo completar la devolución del cobro adicional. El negocio debe dar seguimiento."
        : refund.status === "pending" || refund.status === "processing"
          ? "Estamos gestionando la devolución de un cobro adicional."
          : "El negocio debe confirmar esta devolución."
    : refundType === "primary" && refund.status === "confirmed"
      ? "El pago principal de esta reservación fue reembolsado."
      : refundType === "unknown" && (refund.status === "pending" || refund.status === "processing")
        ? "La devolución está en proceso. Consulta su estado aquí."
        : status.detail;
  const amount = new Intl.NumberFormat("es-MX", { style: "currency", currency: refund.currency }).format(refund.amount);
  const date = (value: string) => new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return (
    <article className="min-w-0 rounded-2xl border border-gray-100 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{typeLabel}</p>
          <strong className="text-[#004e28]">{amount}</strong>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.color}`}>{status.title}</span>
      </div>
      {!compact || refund.status === "confirmed" ? <p className="mt-2 text-sm text-gray-700">{detail}</p> : null}
      <dl className="mt-3 grid gap-1 text-xs text-gray-600 sm:grid-cols-2">
        <div><dt className="inline font-semibold">Método: </dt><dd className="inline">{refund.method === "online" ? "Mercado Pago" : refund.method === "cash" ? "Pago directo" : refund.method}</dd></div>
        <div><dt className="inline font-semibold">Solicitud: </dt><dd className="inline">{date(refund.requested_at)}</dd></div>
        {refund.confirmed_at ? <div><dt className="inline font-semibold">Confirmación: </dt><dd className="inline">{date(refund.confirmed_at)}</dd></div> : null}
        {refund.reason ? <div><dt className="inline font-semibold">Motivo: </dt><dd className="inline break-words">{refund.reason}</dd></div> : null}
        {compact && refund.manual_reference ? <div><dt className="inline font-semibold">Referencia: </dt><dd className="inline break-all">{refund.manual_reference}</dd></div> : null}
      </dl>
    </article>
  );
}
