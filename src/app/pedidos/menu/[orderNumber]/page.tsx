"use client";

import Link from "next/link";
import {
  useParams,
  useSearchParams,
} from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShoppingBag,
  Store,
  Truck,
  XCircle,
} from "lucide-react";
import {
  MENU_ORDER_STATUS_CLASSES,
  MENU_ORDER_STATUS_FLOW,
  MENU_ORDER_STATUS_LABELS,
  formatMenuOrderDate,
  formatMenuOrderMoney,
  fulfillmentLabel,
} from "@/lib/menuOrders";
import { menuOrderService } from "@/services/menuOrderService";
import {
  useAuthHydrated,
  useAuthStore,
} from "@/store/useAuthStore";
import type { MenuOrder } from "@/types/menuOrder";

const TERMINAL_STATUSES = new Set([
  "completed",
  "cancelled",
]);

export default function PublicMenuOrderTrackingPage() {
  const params = useParams<{
    orderNumber: string;
  }>();
  const searchParams = useSearchParams();

  const hydrated = useAuthHydrated();
  const { isAuthenticated } = useAuthStore();

  const orderNumber = String(
    params?.orderNumber || "",
  );

  const queryToken =
    searchParams.get("management_token") || "";

  const [order, setOrder] =
    useState<MenuOrder | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [token, setToken] =
    useState(queryToken);

  const tokenStorageKey =
    `menu-order-token:${orderNumber}`;

  useEffect(() => {
    if (!orderNumber) return;

    if (queryToken) {
      setToken(queryToken);

      try {
        window.localStorage.setItem(
          tokenStorageKey,
          queryToken,
        );
      } catch {
        // El token sigue disponible en memoria.
      }

      // Una vez guardado localmente quitamos el token de
      // la barra del navegador para reducir exposición accidental.
      try {
        const url = new URL(
          window.location.href,
        );

        if (
          url.searchParams.has(
            "management_token",
          )
        ) {
          url.searchParams.delete(
            "management_token",
          );

          window.history.replaceState(
            {},
            "",
            `${url.pathname}${url.search}${url.hash}`,
          );
        }
      } catch {
        // No bloqueamos el seguimiento si el navegador
        // no permite modificar la URL.
      }

      return;
    }

    try {
      const stored =
        window.localStorage.getItem(
          tokenStorageKey,
        ) || "";

      setToken(stored);
    } catch {
      setToken("");
    }
  }, [
    orderNumber,
    queryToken,
    tokenStorageKey,
  ]);

  const loadOrder = useCallback(
    async (silent = false) => {
      if (!orderNumber) return;

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError(null);

      try {
        if (token) {
          const data =
            await menuOrderService.publicOrder(
              orderNumber,
              token,
            );

          setOrder(data);
          return;
        }

        // Sin token solo un usuario autenticado puede
        // recuperar el pedido desde "Mis pedidos".
        if (!hydrated) {
          return;
        }

        if (isAuthenticated) {
          const mine =
            await menuOrderService.mine();

          const found =
            mine.find(
              (item) =>
                item.order_number ===
                orderNumber,
            ) || null;

          if (!found) {
            throw new Error(
              "No encontramos este pedido entre tus pedidos registrados.",
            );
          }

          setOrder(found);
          return;
        }

        throw new Error(
          "Para consultar este pedido abre el enlace privado que recibiste por correo.",
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo consultar el pedido.",
        );
      } finally {
        if (
          token ||
          hydrated
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [
      hydrated,
      isAuthenticated,
      orderNumber,
      token,
    ],
  );

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    if (
      !order ||
      TERMINAL_STATUSES.has(order.status)
    ) {
      return;
    }

    const id = window.setInterval(
      () => void loadOrder(true),
      30000,
    );

    return () =>
      window.clearInterval(id);
  }, [loadOrder, order]);

  const productCount = useMemo(
    () =>
      order?.items.reduce(
        (sum, item) =>
          sum + item.quantity,
        0,
      ) ?? 0,
    [order],
  );

  if (
    (loading && !order) ||
    (!token && !hydrated)
  ) {
    return (
      <main className="min-h-[70vh] bg-[#f2f3f4] px-4 py-16">
        <div className="mx-auto flex max-w-4xl items-center justify-center rounded-3xl border border-gray-100 bg-white py-24 shadow-sm">
          <Loader2
            size={34}
            className="animate-spin text-[#168e00]"
          />
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-[70vh] bg-[#f2f3f4] px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-100 bg-white p-7 text-center shadow-sm">
          <XCircle
            size={42}
            className="mx-auto text-red-500"
          />

          <h1 className="mt-4 text-2xl font-black text-[#004e28]">
            No pudimos abrir el pedido
          </h1>

          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-500">
            {error ||
              "No se encontró el pedido."}
          </p>

          {!isAuthenticated ? (
            <p className="mx-auto mt-3 max-w-xl text-xs leading-5 text-gray-400">
              Si realizaste el pedido como invitado,
              revisa tu correo y abre el botón
              “Ver mi pedido”. Ese enlace contiene la
              llave privada de seguimiento.
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href="/"
              className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700"
            >
              Ir al inicio
            </Link>

            {isAuthenticated ? (
              <Link
                href="/client/menu-orders"
                className="rounded-xl bg-[#168e00] px-4 py-3 text-sm font-bold text-white"
              >
                Mis pedidos de menú
              </Link>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  const currentProgress =
    MENU_ORDER_STATUS_FLOW.indexOf(
      order.status,
    );

  return (
    <main className="min-h-screen bg-[#f2f3f4] px-4 py-10 md:py-14">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-[#004e28]/10 bg-white shadow-[0_22px_60px_-45px_rgba(0,78,40,0.75)]">
          <div className="h-1.5 bg-[#168e00]" />

          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#168e00]">
                  Seguimiento de pedido
                </p>

                <h1 className="mt-1 font-[family-name:var(--font-varela-round)] text-3xl font-black text-[#004e28] md:text-4xl">
                  {order.order_number}
                </h1>

                <p className="mt-2 text-sm text-gray-500">
                  {order.menu_name}
                  {" · "}
                  {productCount} productos
                  {" · "}
                  creado{" "}
                  {formatMenuOrderDate(
                    order.created_at,
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1.5 text-sm font-bold ${
                    MENU_ORDER_STATUS_CLASSES[
                      order.status
                    ]
                  }`}
                >
                  {
                    MENU_ORDER_STATUS_LABELS[
                      order.status
                    ]
                  }
                </span>

                <button
                  type="button"
                  disabled={refreshing}
                  onClick={() =>
                    void loadOrder(true)
                  }
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  aria-label="Actualizar pedido"
                >
                  <RefreshCw
                    size={17}
                    className={
                      refreshing
                        ? "animate-spin"
                        : ""
                    }
                  />
                </button>
              </div>
            </div>

            {order.status !== "cancelled" ? (
              <div className="mt-7 grid gap-3 sm:grid-cols-5">
                {MENU_ORDER_STATUS_FLOW.map(
                  (status, index) => {
                    const completed =
                      index <=
                      currentProgress;

                    return (
                      <div
                        key={status}
                        className={`rounded-2xl border p-3 ${
                          completed
                            ? "border-[#168e00]/20 bg-[#168e00]/5"
                            : "border-gray-100 bg-gray-50"
                        }`}
                      >
                        <div
                          className={`flex h-7 w-7 items-center justify-center rounded-full ${
                            completed
                              ? "bg-[#168e00] text-white"
                              : "bg-gray-200 text-gray-500"
                          }`}
                        >
                          {completed ? (
                            <CheckCircle2
                              size={16}
                            />
                          ) : (
                            <span className="text-xs font-black">
                              {index + 1}
                            </span>
                          )}
                        </div>

                        <p
                          className={`mt-2 text-xs font-bold ${
                            completed
                              ? "text-[#004e28]"
                              : "text-gray-400"
                          }`}
                        >
                          {
                            MENU_ORDER_STATUS_LABELS[
                              status
                            ]
                          }
                        </p>
                      </div>
                    );
                  },
                )}
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700">
                <p className="font-bold">
                  Este pedido fue cancelado.
                </p>

                {order.cancellation_reason ? (
                  <p className="mt-1 text-sm">
                    Motivo:{" "}
                    {order.cancellation_reason}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black text-[#004e28]">
                Tu pedido
              </h2>

              <span className="text-xl font-black text-[#168e00]">
                {formatMenuOrderMoney(
                  order.total,
                )}
              </span>
            </div>

            <div className="mt-4 divide-y divide-gray-100">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#168e00]/10 font-black text-[#168e00]">
                    {item.quantity}×
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900">
                          {item.item_name}
                        </p>

                        {item.notes ? (
                          <p className="mt-1 text-sm text-gray-500">
                            Nota: {item.notes}
                          </p>
                        ) : null}
                      </div>

                      <p className="shrink-0 font-black text-[#004e28]">
                        {formatMenuOrderMoney(
                          item.line_total,
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-2 rounded-2xl bg-[#f2f3f4] p-4 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <strong>
                  {formatMenuOrderMoney(
                    order.subtotal,
                  )}
                </strong>
              </div>

              <div className="flex justify-between text-gray-600">
                <span>Entrega</span>
                <strong>
                  {formatMenuOrderMoney(
                    order.delivery_fee,
                  )}
                </strong>
              </div>

              <div className="flex justify-between border-t border-gray-200 pt-2 text-lg">
                <span className="font-black text-[#004e28]">
                  Total
                </span>
                <strong className="text-[#168e00]">
                  {formatMenuOrderMoney(
                    order.total,
                  )}
                </strong>
              </div>
            </div>

            {order.notes ? (
              <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                  Notas
                </p>
                <p className="mt-1 text-sm text-amber-900">
                  {order.notes}
                </p>
              </div>
            ) : null}
          </section>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-[#004e28]">
                Modalidad
              </h2>

              <p className="mt-3 flex items-center gap-2 font-semibold text-gray-800">
                {order.fulfillment_type ===
                "delivery" ? (
                  <Truck
                    size={18}
                    className="text-[#168e00]"
                  />
                ) : (
                  <Store
                    size={18}
                    className="text-[#168e00]"
                  />
                )}

                {fulfillmentLabel(
                  order.fulfillment_type,
                )}
              </p>

              {order.delivery_address ? (
                <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-gray-600">
                  <MapPin
                    size={17}
                    className="mt-1 shrink-0 text-[#168e00]"
                  />
                  {order.delivery_address}
                </p>
              ) : null}
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-[#004e28]">
                Datos del pedido
              </h2>

              <p className="mt-3 font-bold text-gray-900">
                {order.customer_name}
              </p>

              <p className="mt-3 flex items-center gap-2 break-all text-sm text-gray-600">
                <Mail
                  size={16}
                  className="text-[#168e00]"
                />
                {order.customer_email}
              </p>

              <p className="mt-2 flex items-center gap-2 text-sm text-gray-600">
                <Phone
                  size={16}
                  className="text-[#168e00]"
                />
                {order.customer_phone}
              </p>
            </section>

            <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-[#004e28]">
                Actualizaciones
              </h2>

              <p className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                <Clock3
                  size={16}
                  className="text-[#168e00]"
                />
                Última actualización:{" "}
                {formatMenuOrderDate(
                  order.updated_at,
                )}
              </p>

              <p className="mt-3 text-xs leading-5 text-gray-400">
                Mientras el pedido esté activo,
                esta página se actualiza
                automáticamente cada 30 segundos.
              </p>
            </section>

            {isAuthenticated ? (
              <Link
                href="/client/menu-orders"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#004e28] px-4 py-3 font-bold text-white hover:bg-[#003b1f]"
              >
                <ShoppingBag size={17} />
                Ver todos mis pedidos
              </Link>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}
