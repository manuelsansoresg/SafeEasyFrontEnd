"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  XCircle,
} from "lucide-react";

import { fetchWithAuth } from "@/lib/api";

type CheckoutSessionStatus = {
  checkout_id: string;
  status: string;
  order_id: number | null;
  mp_payment_id?: string | null;
  expires_at?: string | null;
  remaining_seconds?: number;
  can_continue_payment?: boolean;
};

type ViewState =
  | "loading"
  | "success"
  | "pending"
  | "failure"
  | "expired"
  | "refunded"
  | "error";

const TERMINAL_FAILURE_STATUSES = new Set([
  "rejected",
  "cancelled",
  "canceled",
  "failure",
  "failed",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function readErrorMessage(payload: unknown, fallback: string) {
  const data = asRecord(payload);

  const detail =
    typeof data.detail === "string" ? data.detail.trim() : "";
  const message =
    typeof data.message === "string" ? data.message.trim() : "";
  const error =
    typeof data.error === "string" ? data.error.trim() : "";

  return detail || message || error || fallback;
}

function formatRemaining(seconds?: number) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(
    2,
    "0",
  )}`;
}

function CheckoutResultContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const checkoutId = useMemo(
    () => String(searchParams.get("checkout_id") || "").trim(),
    [searchParams],
  );

  const returnStatus = useMemo(
    () => String(searchParams.get("status") || "").trim().toLowerCase(),
    [searchParams],
  );

  const [session, setSession] = useState<CheckoutSessionStatus | null>(null);
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [message, setMessage] = useState(
    "Estamos confirmando el estado de tu pago.",
  );
  const [refreshing, setRefreshing] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const isTerminal = useMemo(
    () =>
      viewState === "success" ||
      viewState === "failure" ||
      viewState === "expired" ||
      viewState === "refunded" ||
      viewState === "error",
    [viewState],
  );

  const applyStatus = useCallback(
    (data: CheckoutSessionStatus) => {
      setSession(data);

      const status = String(data.status || "").toLowerCase();

      // Si ya existe una Order, el webhook terminó correctamente.
      if (data.order_id) {
        setViewState("success");
        setMessage("Tu pago fue confirmado y tu pedido ya fue creado.");
        return;
      }

      if (status === "refunded") {
        setViewState("refunded");
        setMessage(
          "El pago fue devuelto porque la compra no pudo completarse.",
        );
        return;
      }

      if (status === "expired") {
        setViewState("expired");
        setMessage(
          "El tiempo disponible para completar este pago terminó.",
        );
        return;
      }

      if (TERMINAL_FAILURE_STATUSES.has(status)) {
        setViewState("failure");
        setMessage(
          "El pago no fue aprobado. Tu carrito permanece sin cambios.",
        );
        return;
      }

      // Si Mercado Pago nos mandó por la URL de fallo y todavía no existe
      // una orden, no debemos presentar la compra como exitosa.
      if (returnStatus === "failure") {
        setViewState("failure");
        setMessage(
          "El pago no se completó. Puedes regresar a tu carrito e intentarlo nuevamente.",
        );
        return;
      }

      setViewState("pending");

      if (returnStatus === "success") {
        setMessage(
          "Mercado Pago recibió el pago. Estamos esperando la confirmación final para crear tu pedido.",
        );
      } else if (returnStatus === "pending") {
        setMessage(
          "Tu pago sigue pendiente de confirmación por Mercado Pago.",
        );
      } else {
        setMessage(
          "Estamos esperando la confirmación final de Mercado Pago.",
        );
      }
    },
    [returnStatus],
  );

  const loadStatus = useCallback(
    async (manual = false) => {
      if (!checkoutId) {
        setViewState("error");
        setMessage("No se recibió un checkout_id válido.");
        return;
      }

      if (manual) {
        setRefreshing(true);
      }

      try {
        const response = await fetchWithAuth(
          `/api/orders/checkout-sessions/${encodeURIComponent(
            checkoutId,
          )}/status`,
          {
            headers: {
              Accept: "application/json",
            },
          },
        );

        const payload: unknown = await response.json().catch(() => ({}));

        if (!response.ok) {
          setViewState("error");
          setMessage(
            readErrorMessage(
              payload,
              "No se pudo consultar el estado de la compra.",
            ),
          );
          return;
        }

        applyStatus(payload as CheckoutSessionStatus);
      } catch {
        setViewState("error");
        setMessage(
          "Hubo un problema de conexión al consultar el estado de la compra.",
        );
      } finally {
        if (manual) {
          setRefreshing(false);
        }
      }
    },
    [applyStatus, checkoutId],
  );

  useEffect(() => {
    void loadStatus(false);
  }, [loadStatus]);

  // Cuando Mercado Pago regresa con success/pending puede ocurrir que el
  // navegador llegue antes que el webhook. Consultamos durante unos segundos
  // hasta que aparezca la Order o se alcance un estado terminal.
  useEffect(() => {
    if (!checkoutId || isTerminal) return;

    if (returnStatus === "failure") return;

    if (pollCount >= 20) return;

    const timer = window.setTimeout(() => {
      setPollCount((current) => current + 1);
      void loadStatus(false);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [
    checkoutId,
    isTerminal,
    loadStatus,
    pollCount,
    returnStatus,
  ]);

  const icon = (() => {
    if (viewState === "success") {
      return <CheckCircle2 className="h-12 w-12 text-green-600" />;
    }

    if (viewState === "failure" || viewState === "error") {
      return <XCircle className="h-12 w-12 text-red-600" />;
    }

    if (viewState === "expired" || viewState === "refunded") {
      return <AlertTriangle className="h-12 w-12 text-amber-600" />;
    }

    return <Clock3 className="h-12 w-12 text-amber-600" />;
  })();

  const title = (() => {
    switch (viewState) {
      case "success":
        return "¡Pago confirmado!";
      case "failure":
        return "Pago no completado";
      case "expired":
        return "Checkout vencido";
      case "refunded":
        return "Pago reembolsado";
      case "error":
        return "No pudimos consultar la compra";
      case "pending":
        return "Confirmando tu pago";
      default:
        return "Procesando compra";
    }
  })();

  const showPendingSpinner =
    viewState === "loading" || viewState === "pending";

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 font-[family-name:var(--font-poppins)]">
      <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-8 text-center sm:px-10">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gray-50">
              {showPendingSpinner ? (
                <Loader2 className="h-10 w-10 animate-spin text-[#004e28]" />
              ) : (
                icon
              )}
            </div>

            <h1 className="font-[family-name:var(--font-varela-round)] text-2xl font-bold text-gray-950 sm:text-3xl">
              {title}
            </h1>

            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-gray-600 sm:text-base">
              {message}
            </p>
          </div>

          <div className="space-y-4 px-6 py-6 sm:px-10">
            {session ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-gray-500">Estado</span>
                  <span className="font-semibold text-gray-900">
                    {session.order_id
                      ? "Aprobado"
                      : session.status || "Pendiente"}
                  </span>
                </div>

                {session.order_id ? (
                  <div className="mt-3 flex items-center justify-between gap-4 border-t border-gray-200 pt-3 text-sm">
                    <span className="text-gray-500">Pedido</span>
                    <span className="font-bold text-gray-900">
                      #{session.order_id}
                    </span>
                  </div>
                ) : null}

                {!session.order_id &&
                typeof session.remaining_seconds === "number" &&
                session.remaining_seconds > 0 ? (
                  <div className="mt-3 flex items-center justify-between gap-4 border-t border-gray-200 pt-3 text-sm">
                    <span className="text-gray-500">
                      Tiempo restante del checkout
                    </span>
                    <span className="font-semibold text-gray-900">
                      {formatRemaining(session.remaining_seconds)}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {viewState === "refunded" ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Mercado Pago pudo haber aprobado inicialmente el cobro, pero
                el backend detectó que la orden no podía completarse y procesó
                la devolución. No se creó un pedido.
              </div>
            ) : null}

            {viewState === "expired" ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                No se creó una orden. Los productos continúan sujetos a la
                disponibilidad actual del inventario.
              </div>
            ) : null}

            {viewState === "pending" && pollCount >= 20 ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
                La confirmación está tardando más de lo habitual. Puedes usar
                “Actualizar estado”; no necesitas volver a pagar mientras
                Mercado Pago siga procesando la operación.
              </div>
            ) : null}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              {viewState === "success" && session?.order_id ? (
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/client/orders/${session.order_id}`)
                  }
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#004e28] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#168e00]"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Ver mi pedido
                </button>
              ) : (
                <Link
                  href="/client/cart"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#004e28] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#168e00]"
                >
                  <RotateCcw className="h-4 w-4" />
                  Volver al carrito
                </Link>
              )}

              <button
                type="button"
                onClick={() => void loadStatus(true)}
                disabled={refreshing || !checkoutId}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-800 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {refreshing ? "Actualizando..." : "Actualizar estado"}
              </button>
            </div>

            {viewState === "success" ? (
              <div className="pt-1 text-center">
                <Link
                  href="/client/orders"
                  className="text-sm font-semibold text-[#004e28] hover:underline"
                >
                  Ver todas mis órdenes
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckoutResultFallback() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 font-[family-name:var(--font-poppins)]">
      <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-5 text-sm text-gray-600 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-[#004e28]" />
          Cargando resultado del pago...
        </div>
      </div>
    </div>
  );
}

export default function CheckoutResultPage() {
  return (
    <Suspense fallback={<CheckoutResultFallback />}>
      <CheckoutResultContent />
    </Suspense>
  );
}
