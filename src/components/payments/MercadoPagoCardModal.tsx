"use client";

import Script from "next/script";
import { useEffect, useId, useRef, useState } from "react";
import { BadgeCheck, CreditCard, Loader2, LockKeyhole, ShieldCheck, X } from "lucide-react";

import { cardCheckoutService } from "@/services/cardCheckoutService";
import type {
  CardAuthorizationDraft,
  CardAuthorizationResponse,
  MercadoPagoCardData,
} from "@/types/cardCheckout";

type BrickController = {
  unmount: () => void;
};

type MercadoPagoInstance = {
  bricks: () => {
    create: (
      brick: "cardPayment",
      target: string,
      settings: Record<string, unknown>,
    ) => Promise<BrickController>;
  };
};

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => MercadoPagoInstance;
  }
}

type Props = {
  supplierName: string;
  estimatedTotal: number;
  checkout: CardAuthorizationDraft;
  onClose: () => void;
  onOrderCreated: (response: CardAuthorizationResponse) => void;
  onPending: (response: CardAuthorizationResponse) => void;
  onViewOrder: (orderId: number) => void;
};

type Phase = "loading" | "ready" | "submitting" | "authorized";

function money(value: number) {
  return value.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function brickErrorMessage(error: unknown) {
  const record = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
  const message = typeof record.message === "string" ? record.message.toLowerCase() : "";
  if (message.includes("card_token") || message.includes("token")) {
    return "Mercado Pago no pudo proteger los datos de la tarjeta. Revisa los campos e inténtalo nuevamente.";
  }
  if (message.includes("incomplete")) return "Completa todos los datos de la tarjeta.";
  return "No se pudo cargar correctamente el formulario seguro de Mercado Pago.";
}

export function MercadoPagoCardModal({
  supplierName,
  estimatedTotal,
  checkout,
  onClose,
  onOrderCreated,
  onPending,
  onViewOrder,
}: Props) {
  const reactId = useId();
  const containerId = `mp-card-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY?.trim() || "";
  const [sdkReady, setSdkReady] = useState(() => typeof window !== "undefined" && Boolean(window.MercadoPago));
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [authorizedOrderId, setAuthorizedOrderId] = useState<number | null>(null);
  const controllerRef = useRef<BrickController | null>(null);
  const submittingRef = useRef(false);
  const callbacksRef = useRef({ onOrderCreated, onPending });

  useEffect(() => {
    callbacksRef.current = { onOrderCreated, onPending };
  }, [onOrderCreated, onPending]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submittingRef.current && phase !== "authorized") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, phase]);

  useEffect(() => {
    if (!sdkReady || !publicKey || !window.MercadoPago || controllerRef.current) return;

    let cancelled = false;
    const renderBrick = async () => {
      try {
        const mp = new window.MercadoPago!(publicKey, { locale: "es-MX" });
        const controller = await mp.bricks().create("cardPayment", containerId, {
          initialization: { amount: estimatedTotal },
          customization: {
            visual: {
              style: {
                theme: "default",
                customVariables: {
                  baseColor: "#168e00",
                  baseColorFirstVariant: "#004e28",
                  buttonTextColor: "#ffffff",
                  borderRadiusMedium: "12px",
                  formBackgroundColor: "#ffffff",
                },
              },
              texts: {
                formTitle: "Datos de tu tarjeta",
                formSubmit: "Autorizar tarjeta",
              },
            },
            paymentMethods: { minInstallments: 1, maxInstallments: 1 },
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) setPhase("ready");
            },
            onError: (brickError: unknown) => {
              if (!cancelled && !submittingRef.current) setError(brickErrorMessage(brickError));
            },
            onSubmit: async (cardData: MercadoPagoCardData) => {
              if (submittingRef.current) return Promise.reject(new Error("authorization_in_progress"));
              const token = String(cardData?.token || "").trim();
              const paymentMethodId = String(cardData?.payment_method_id || "").trim();
              if (!token || !paymentMethodId) {
                setError("Mercado Pago no generó el token de la tarjeta. Revisa los datos e inténtalo nuevamente.");
                return Promise.reject(new Error("missing_card_token"));
              }

              submittingRef.current = true;
              setPhase("submitting");
              setError(null);
              try {
                const response = await cardCheckoutService.authorize({
                  ...checkout,
                  card_token: token,
                  payment_method_id: paymentMethodId,
                  issuer_id: cardData.issuer_id == null || cardData.issuer_id === "" ? null : String(cardData.issuer_id),
                  installments: 1,
                });
                const status = String(response.payment_status || "").toLowerCase();

                if (status === "authorized" && response.order_id) {
                  setAuthorizedOrderId(response.order_id);
                  controllerRef.current?.unmount();
                  controllerRef.current = null;
                  setPhase("authorized");
                  callbacksRef.current.onOrderCreated(response);
                  return;
                }

                if (["pending", "in_process", "authorized"].includes(status) && !response.order_id) {
                  callbacksRef.current.onPending(response);
                  return;
                }

                if (status === "paid" && response.order_id) {
                  setAuthorizedOrderId(response.order_id);
                  controllerRef.current?.unmount();
                  controllerRef.current = null;
                  setPhase("authorized");
                  callbacksRef.current.onOrderCreated(response);
                  return;
                }

                throw new Error("La tarjeta no pudo ser autorizada. Revisa los datos o utiliza otra tarjeta.");
              } catch (authorizationError) {
                const message =
                  authorizationError instanceof Error && authorizationError.message.trim()
                    ? authorizationError.message
                    : "No se pudo autorizar la tarjeta. Inténtalo nuevamente.";
                setError(message);
                setPhase("ready");
                throw authorizationError;
              } finally {
                submittingRef.current = false;
              }
            },
          },
        });

        if (cancelled) controller.unmount();
        else controllerRef.current = controller;
      } catch {
        if (!cancelled) {
          setError("No se pudo iniciar el formulario seguro de Mercado Pago.");
          setPhase("ready");
        }
      }
    };

    void renderBrick();
    return () => {
      cancelled = true;
      controllerRef.current?.unmount();
      controllerRef.current = null;
    };
  }, [checkout, containerId, estimatedTotal, publicKey, sdkReady]);

  const closeDisabled = phase === "submitting";

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="card-payment-title">
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="afterInteractive"
        onLoad={() => setSdkReady(true)}
        onError={() => {
          setError("No se pudo cargar el formulario seguro de Mercado Pago. Revisa tu conexión e inténtalo nuevamente.");
          setPhase("ready");
        }}
      />
      <button type="button" aria-label="Cerrar pago" className="absolute inset-0 cursor-default" disabled={closeDisabled} onClick={onClose} />

      <div className="relative flex max-h-[96dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[92vh] sm:rounded-3xl">
        <div className="border-b border-gray-100 bg-[#004e28] px-5 py-5 text-white sm:px-7">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold text-white/70">
                <ShieldCheck className="h-4 w-4" /> Pago protegido por Mercado Pago
              </div>
              <h2 id="card-payment-title" className="mt-2 truncate font-[family-name:var(--font-varela-round)] text-2xl font-bold">
                Autoriza tu tarjeta
              </h2>
              <p className="mt-1 truncate text-sm text-white/75">{supplierName}</p>
            </div>
            <button type="button" onClick={onClose} disabled={closeDisabled} className="rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40" aria-label="Cerrar">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          {phase === "authorized" && authorizedOrderId ? (
            <div className="py-5 text-center sm:py-8">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#168e00]/10">
                <BadgeCheck className="h-11 w-11 text-[#168e00]" />
              </div>
              <h3 className="mt-5 font-[family-name:var(--font-varela-round)] text-2xl font-bold text-[#004e28]">Tarjeta autorizada</h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-600">
                Mercado Pago reservó el monto en tu tarjeta. El cobro se completará cuando recibas tu pedido y se confirme tu código de entrega.
              </p>
              <button type="button" onClick={() => onViewOrder(authorizedOrderId)} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#004e28] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#168e00] sm:w-auto">
                Ver pedido #{authorizedOrderId}
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="rounded-2xl border border-[#004e28]/10 bg-[#f2f3f4] px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total estimado</div>
                  <div className="mt-1 font-[family-name:var(--font-varela-round)] text-2xl font-bold text-[#004e28]">{money(estimatedTotal)}</div>
                </div>
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 sm:max-w-[190px]">
                  <LockKeyhole className="h-5 w-5 shrink-0 text-[#168e00]" />
                  Drooopy no recibe ni almacena los datos completos de tu tarjeta.
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-950">
                El monto será autorizado en tu tarjeta. El cobro definitivo se realizará cuando recibas tu pedido y se confirme tu código de entrega. El backend calculará el importe definitivo.
              </div>

              {!publicKey ? (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
                  El pago con tarjeta no está disponible porque falta configurar la llave pública de Mercado Pago.
                </div>
              ) : (
                <div className="relative mt-5 min-h-[360px] rounded-2xl border border-gray-100 bg-white p-2 sm:p-4">
                  {phase === "loading" ? (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/90">
                      <div className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                        <Loader2 className="h-5 w-5 animate-spin text-[#168e00]" /> Cargando formulario seguro...
                      </div>
                    </div>
                  ) : null}
                  <div id={containerId} />
                </div>
              )}

              {error ? <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</div> : null}

              {phase === "submitting" ? (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-[#004e28] px-4 py-3 text-sm font-bold text-white">
                  <Loader2 className="h-4 w-4 animate-spin" /> Autorizando tarjeta… No cierres esta ventana.
                </div>
              ) : null}
            </>
          )}
        </div>

        {phase !== "authorized" ? (
          <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-3 text-xs text-gray-500 sm:px-7">
            <CreditCard className="h-4 w-4 text-[#004e28]" /> Una sola exhibición. No se crearán cargos duplicados.
          </div>
        ) : null}
      </div>
    </div>
  );
}
