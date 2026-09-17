"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Clock3, Loader2 } from "lucide-react";

import { fetchWithAuth } from "@/lib/api";

const CHECKOUT_KEY_PREFIX = "drooopy:checkout:";

type ReservationStatus = {
  order_id?: number;
  status?: string;
  payment_status?: string;
  reservation_expires_at?: string;
  remaining_seconds?: number;
  can_continue_payment?: boolean;
};

function getStoredCheckoutOrderIds(): number[] {
  if (typeof window === "undefined") return [];

  const ids: number[] = [];

  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (!key || !key.startsWith(CHECKOUT_KEY_PREFIX)) continue;

    const rawId = key.slice(CHECKOUT_KEY_PREFIX.length);
    const orderId = Number(rawId);

    if (Number.isSafeInteger(orderId) && orderId > 0) {
      ids.push(orderId);
    }
  }

  // El checkout más reciente normalmente tendrá el id mayor.
  return [...new Set(ids)].sort((a, b) => b - a);
}

function removeStoredCheckout(orderId: number) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(`${CHECKOUT_KEY_PREFIX}${orderId}`);
}

export default function PendingCartCheckoutGuard() {
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const redirectedRef = useRef(false);

  const recoverPendingCheckout = useCallback(async () => {
    if (checkingRef.current || redirectedRef.current) return;

    const orderIds = getStoredCheckoutOrderIds();

    if (orderIds.length === 0) {
      setChecking(false);
      return;
    }

    checkingRef.current = true;
    setChecking(true);

    try {
      for (const orderId of orderIds) {
        let response: Response;

        try {
          response = await fetchWithAuth(
            `/api/orders/${orderId}/reservation-status`,
            {
              headers: {
                Accept: "application/json",
              },
            },
          );
        } catch {
          // Si hubo un problema temporal de red, no borramos la referencia.
          continue;
        }

        if (!response.ok) {
          // 404/403: esa referencia ya no sirve para este usuario.
          if (response.status === 404 || response.status === 403) {
            removeStoredCheckout(orderId);
          }
          continue;
        }

        let reservation: ReservationStatus | null = null;

        try {
          reservation = (await response.json()) as ReservationStatus;
        } catch {
          reservation = null;
        }

        if (!reservation) continue;

        const status = String(reservation.status || "").toLowerCase();
        const paymentStatus = String(
          reservation.payment_status || "",
        ).toLowerCase();

        const remainingSeconds = Math.max(
          0,
          Number(reservation.remaining_seconds) || 0,
        );

        const isActivePendingReservation =
          paymentStatus === "pending" &&
          status === "created" &&
          reservation.can_continue_payment === true &&
          remainingSeconds > 0;

        if (isActivePendingReservation) {
          redirectedRef.current = true;

          // replace() evita el ciclo:
          // carrito -> orden -> Atrás -> carrito -> orden...
          window.location.replace(`/client/orders/${orderId}`);
          return;
        }

        // Si ya se pagó, canceló o expiró, no debe seguir bloqueando
        // el carrito en futuras visitas.
        if (
          paymentStatus === "paid" ||
          status === "cancelled" ||
          status === "expired" ||
          remainingSeconds <= 0
        ) {
          removeStoredCheckout(orderId);
        }
      }
    } finally {
      checkingRef.current = false;

      if (!redirectedRef.current) {
        setChecking(false);
      }
    }
  }, []);

  useEffect(() => {
    void recoverPendingCheckout();

    const handlePageShow = () => {
      void recoverPendingCheckout();
    };

    const handleFocus = () => {
      void recoverPendingCheckout();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void recoverPendingCheckout();
      }
    };

    // pageshow es importante cuando el navegador restaura /cart
    // desde su back-forward cache al presionar Atrás en Mercado Pago.
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("focus", handleFocus);
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [recoverPendingCheckout]);

  if (!checking) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#004e28]/10">
          <Clock3 className="h-6 w-6 text-[#004e28]" />
        </div>

        <div className="mt-4 font-[family-name:var(--font-varela-round)] text-lg font-bold text-gray-950">
          Recuperando tu compra
        </div>

        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          Tienes una orden con pago pendiente. Estamos abriendo la compra
          que ya tiene tu producto reservado.
        </p>

        <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-[#004e28]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Un momento...
        </div>
      </div>
    </div>
  );
}
