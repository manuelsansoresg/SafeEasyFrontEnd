"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Toast } from "@/components/ui/Toast";
import { ArrowLeft, ExternalLink, Loader2, RefreshCw } from "lucide-react";

type ToastState = null | { type: "success" | "error" | "info"; message: string };

type CheckoutData = {
  order_id: number;
  init_point: string | null;
  raw: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const v = record[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function normalizeCheckoutData(orderId: number, payload: unknown): CheckoutData {
  const raw = asRecord(payload);
  const preference = raw.preference && typeof raw.preference === "object" ? (raw.preference as Record<string, unknown>) : {};
  const initPoint =
    pickString(raw, ["init_point", "mp_init_point", "mercadopago_init_point", "payment_url", "checkout_url"]) ||
    pickString(preference, ["init_point"]) ||
    pickString(asRecord(raw.payment), ["init_point", "mp_init_point", "mercadopago_init_point", "payment_url", "checkout_url"]);

  return { order_id: orderId, init_point: initPoint, raw };
}

async function fetchOrderCheckout(orderId: number) {
  const tryUrls = [
    `/api/orders/${orderId}`,
    `/api/orders/${orderId}/`,
    `/api/v1/orders/${orderId}`,
    `/api/v1/orders/${orderId}/`,
  ];

  let last: Response | null = null;
  for (const url of tryUrls) {
    const res = await fetchWithAuth(url, { headers: { Accept: "application/json" } });
    last = res;
    if (res.ok) return { res, url };
    if (res.status === 404 || res.status === 405) continue;
    if (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308) continue;
    break;
  }

  return { res: last, url: tryUrls[tryUrls.length - 1] };
}

export default function CheckoutPage() {
  const params = useParams<{ order_id?: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastState>(null);
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);

  const orderId = useMemo(() => {
    const raw = params?.order_id;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params?.order_id]);

  const closeToast = () => setToast(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const load = useCallback(async (showErrors: boolean) => {
    if (!orderId) {
      setToast({ type: "error", message: "order_id inválido." });
      setLoading(false);
      return;
    }

    let hadCache = false;
    try {
      const cached = sessionStorage.getItem(`drooopy:checkout:${orderId}`);
      if (cached) {
        const parsed: unknown = JSON.parse(cached);
        setCheckout(normalizeCheckoutData(orderId, parsed));
        hadCache = true;
      }
    } catch {}

    if (hadCache) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { res, url } = await fetchOrderCheckout(orderId);
      const data: unknown = await res?.json().catch(() => ({}));
      const record = asRecord(data);

      if (!res || !res.ok) {
        const msg =
          (typeof record.detail === "string" && record.detail.trim()) ||
          (typeof record.message === "string" && record.message.trim()) ||
          (typeof record.error === "string" && record.error.trim()) ||
          (res ? `No se pudo cargar el checkout (HTTP ${res.status}).` : "No se pudo cargar el checkout.");

        if (showErrors) setToast({ type: "error", message: `${msg}${url ? ` (${url})` : ""}` });
        setCheckout(null);
        return;
      }

      try {
        sessionStorage.setItem(`drooopy:checkout:${orderId}`, JSON.stringify(data));
      } catch {}
      setCheckout(normalizeCheckoutData(orderId, data));
    } catch {
      if (showErrors) setToast({ type: "error", message: "Error de conexión al cargar el checkout." });
      setCheckout(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load(false);
  }, [load]);

  const canPay = Boolean(checkout?.init_point);

  return (
    <div className="min-h-[calc(100vh-6rem)] pt-24 md:pt-28 pb-16 font-[family-name:var(--font-poppins)]">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between gap-3 mb-6">
          <button
            type="button"
            onClick={() => (history.length > 1 ? router.back() : router.push("/cart"))}
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
          >
            <ArrowLeft size={18} />
            Volver
          </button>
          <Link href="/client/orders" className="text-sm font-semibold text-primary hover:underline">
            Ver mis órdenes
          </Link>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Checkout</h1>
              <p className="text-sm text-gray-500">Orden #{orderId ?? "—"}</p>
            </div>
            <button
              type="button"
              onClick={() => load(true)}
              disabled={loading}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold",
                loading ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-gray-900 text-white hover:bg-black",
              )}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Reintentar
            </button>
          </div>

          {loading ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando información de pago...
            </div>
          ) : (
            <div className="mt-6">
              <button
                type="button"
                onClick={() => {
                  if (!checkout?.init_point) return;
                  window.location.href = checkout.init_point;
                }}
                disabled={!canPay}
                className={cn(
                  "w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm",
                  canPay ? "bg-primary text-white hover:bg-primary/90" : "bg-gray-200 text-gray-400 cursor-not-allowed",
                )}
              >
                <ExternalLink size={16} />
                Pagar con Mercado Pago
              </button>

              {!canPay ? (
                <div className="mt-4 text-sm text-gray-600">
                  No se recibió un link de pago (init_point). Si el backend ya creó la orden, debe exponer el init_point en el
                  response del start-checkout o en el endpoint de orden/checkout.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      {toast ? <Toast type={toast.type} message={toast.message} onClose={closeToast} /> : null}
    </div>
  );
}
