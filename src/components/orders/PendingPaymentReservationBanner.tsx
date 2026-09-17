"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Clock3,
  CreditCard,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { fetchWithAuth } from "@/lib/api";

type ReservationStatus = {
  order_id: number;
  status: string;
  payment_status: string;
  reservation_expires_at: string;
  remaining_seconds: number;
  can_continue_payment: boolean;
};

type CheckoutPreference = {
  preference_id?: string | null;
  init_point?: string | null;
  sandbox_init_point?: string | null;
};

function getOrderIdFromPath(pathname: string | null): number | null {
  if (!pathname) return null;

  const match = pathname.match(/^\/client\/orders\/(\d+)\/?$/);
  if (!match) return null;

  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function formatCountdown(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function readErrorMessage(response: Response, fallback: string) {
  try {
    const data = (await response.clone().json()) as {
      detail?: unknown;
      message?: unknown;
    };

    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : typeof data?.message === "string"
          ? data.message
          : null;

    if (detail) return detail;
  } catch {
    // Ignore JSON parsing errors and try text below.
  }

  try {
    const text = await response.text();
    if (text.trim()) return text.trim();
  } catch {
    // Ignore text parsing errors.
  }

  return fallback;
}

export default function PendingPaymentReservationBanner() {
  const pathname = usePathname();
  const orderId = useMemo(() => getOrderIdFromPath(pathname), [pathname]);

  const [reservation, setReservation] = useState<ReservationStatus | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReservation = useCallback(async () => {
    if (!orderId) {
      setReservation(null);
      setRemainingSeconds(0);
      setError(null);
      return;
    }

    setLoading(true);

    try {
      const response = await fetchWithAuth(
        `/api/orders/${orderId}/reservation-status`,
        {
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        // If this endpoint is temporarily unavailable, do not break
        // the order detail page. The existing screen keeps working.
        setReservation(null);
        setRemainingSeconds(0);
        return;
      }

      const data = (await response.json()) as ReservationStatus;
      setReservation(data);
      setRemainingSeconds(Math.max(0, Number(data.remaining_seconds) || 0));
      setError(null);
    } catch {
      setReservation(null);
      setRemainingSeconds(0);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadReservation();
  }, [loadReservation]);

  useEffect(() => {
    if (!orderId) return;

    const handleFocus = () => {
      void loadReservation();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadReservation();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [orderId, loadReservation]);

  useEffect(() => {
    if (!reservation) return;
    if (remainingSeconds <= 0) return;
    if (!reservation.can_continue_payment) return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [reservation, remainingSeconds > 0]);

  useEffect(() => {
    if (!reservation) return;
    if (remainingSeconds !== 0) return;
    if (!reservation.can_continue_payment) return;

    setReservation((current) =>
      current
        ? {
            ...current,
            remaining_seconds: 0,
            can_continue_payment: false,
          }
        : current,
    );
  }, [remainingSeconds, reservation]);

  const continuePayment = async () => {
    if (!orderId || continuing || cancelling) return;

    setContinuing(true);
    setError(null);

    try {
      const response = await fetchWithAuth(
        `/api/orders/${orderId}/refresh-preference`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        const message = await readErrorMessage(
          response,
          "No se pudo continuar con el pago.",
        );

        if (response.status === 409) {
          await loadReservation();
        }

        throw new Error(message);
      }

      const data = (await response.json()) as CheckoutPreference;
      const initPoint = String(data?.init_point || "").trim();

      if (!initPoint) {
        throw new Error("Mercado Pago no devolvió una liga de pago.");
      }

      window.location.assign(initPoint);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "No se pudo continuar con el pago.";

      setError(message);
      setContinuing(false);
    }
  };

  const cancelPurchase = async () => {
    if (!orderId || continuing || cancelling) return;

    const confirmed = window.confirm(
      "¿Deseas cancelar esta compra? El producto reservado volverá a estar disponible.",
    );

    if (!confirmed) return;

    setCancelling(true);
    setError(null);

    try {
      const response = await fetchWithAuth(
        `/api/orders/${orderId}/cancel-pending`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        const message = await readErrorMessage(
          response,
          "No se pudo cancelar la compra.",
        );

        if (response.status === 409) {
          await loadReservation();
        }

        throw new Error(message);
      }

      // Reload so the existing order page also receives the new
      // cancelled status and does not keep stale information.
      window.location.reload();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "No se pudo cancelar la compra.";

      setError(message);
      setCancelling(false);
    }
  };

  if (!orderId) return null;

  if (loading && !reservation) {
    return null;
  }

  if (!reservation) {
    return null;
  }

  const paymentStatus = String(reservation.payment_status || "").toLowerCase();
  const orderStatus = String(reservation.status || "").toLowerCase();

  if (paymentStatus === "paid") {
    return null;
  }

  if (orderStatus === "cancelled") {
    return null;
  }

  const expired =
    orderStatus === "expired" ||
    remainingSeconds <= 0 ||
    !reservation.can_continue_payment;

  return (
    <div className="container mx-auto px-3 pt-2 sm:px-4">
      <div
        className={
          expired
            ? "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            : "overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm"
        }
      >
        <div
          className={
            expired
              ? "flex items-start gap-3 bg-slate-50 px-4 py-4 sm:px-5"
              : "flex items-start gap-3 bg-amber-50 px-4 py-4 sm:px-5"
          }
        >
          <div
            className={
              expired
                ? "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200"
                : "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100"
            }
          >
            {expired ? (
              <XCircle className="h-5 w-5 text-slate-600" />
            ) : (
              <Clock3 className="h-5 w-5 text-amber-700" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="font-[family-name:var(--font-varela-round)] text-base font-bold text-gray-950">
              {expired ? "La reserva de esta compra venció" : "Tu compra está reservada"}
            </div>

            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              {expired
                ? "El tiempo para completar este pago terminó. Si el producto sigue disponible, podrás iniciar una nueva compra."
                : "Todavía no se ha confirmado el pago. Puedes regresar a Mercado Pago y usar otra tarjeta sin crear una orden nueva."}
            </p>

            {!expired ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#004e28] ring-1 ring-amber-200">
                  <ShieldCheck className="h-4 w-4" />
                  Producto apartado
                </div>

                <div className="inline-flex items-center gap-2 rounded-xl bg-[#004e28] px-3 py-2 text-sm font-bold text-white">
                  <Clock3 className="h-4 w-4" />
                  {formatCountdown(remainingSeconds)}
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>
        </div>

        {!expired ? (
          <div className="flex flex-col gap-3 border-t border-amber-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-5">
            <button
              type="button"
              onClick={cancelPurchase}
              disabled={continuing || cancelling}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {cancelling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {cancelling ? "Cancelando..." : "Cancelar compra"}
            </button>

            <button
              type="button"
              onClick={continuePayment}
              disabled={continuing || cancelling || remainingSeconds <= 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#004e28] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#168e00] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {continuing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {continuing ? "Abriendo Mercado Pago..." : "Continuar pago"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
