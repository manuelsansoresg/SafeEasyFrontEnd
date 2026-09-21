"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  ExternalLink,
  Loader2,
  PackageCheck,
  Save,
  Store,
  Truck,
  UserRound,
} from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import { menuOrderService } from "@/services/menuOrderService";
import { menuService } from "@/services/menuService";
import type { Menu } from "@/types/menu";
import type { MenuOrderSettings } from "@/types/menuOrder";

type ToastState =
  | {
      type: "success" | "error" | "info";
      message: string;
    }
  | null;

function Toggle({
  active,
  onClick,
  disabled = false,
  label,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
        active ? "bg-[#168e00]" : "bg-gray-300"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
          active ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

export default function AdminMenuOrderSettingsPage() {
  const params = useParams<{ menuId: string }>();
  const menuId = Number(params.menuId);

  const [menu, setMenu] = useState<Menu | null>(null);
  const [settings, setSettings] = useState<MenuOrderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(menuId) || menuId <= 0) {
      setError("El identificador del menú no es válido.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const [menuData, settingsData] = await Promise.all([
        menuService.detail(menuId, controller.signal),
        menuOrderService.settings(menuId, controller.signal),
      ]);

      setMenu(menuData);
      setSettings(settingsData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar la configuración de pedidos.",
      );
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  }, [menuId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;

    const id = window.setTimeout(() => {
      setToast(null);
    }, 3500);

    return () => window.clearTimeout(id);
  }, [toast]);

  const setAcceptsOrders = (value: boolean) => {
    setSettings((current) => {
      if (!current) return current;

      if (!value) {
        return {
          ...current,
          accepts_orders: false,
        };
      }

      const next = {
        ...current,
        accepts_orders: true,
      };

      if (!next.allows_pickup && !next.allows_delivery) {
        next.allows_pickup = true;
      }

      if (!next.allows_cash && !next.allows_online_payment) {
        next.allows_cash = true;
      }

      return next;
    });
  };

  const toggleMethod = (
    key: "allows_pickup" | "allows_delivery",
  ) => {
    setSettings((current) => {
      if (!current) return current;

      const next = {
        ...current,
        [key]: !current[key],
      };

      if (
        next.accepts_orders &&
        !next.allows_pickup &&
        !next.allows_delivery
      ) {
        return current;
      }

      return next;
    });
  };

  const togglePaymentMethod = (
    key: "allows_cash" | "allows_online_payment",
  ) => {
    setSettings((current) => {
      if (!current) return current;

      if (
        key === "allows_online_payment" &&
        !current.allows_online_payment &&
        !current.mercadopago_linked
      ) {
        setToast({
          type: "info",
          message:
            "Primero vincula tu cuenta de Mercado Pago para activar pagos en línea.",
        });
        return current;
      }

      const next = {
        ...current,
        [key]: !current[key],
      };

      if (
        next.accepts_orders &&
        !next.allows_cash &&
        !next.allows_online_payment
      ) {
        return current;
      }

      return next;
    });
  };

  const save = async () => {
    if (!settings) return;

    setSaving(true);

    try {
      const updated = await menuOrderService.updateSettings(
        menuId,
        {
          accepts_orders: settings.accepts_orders,
          allows_pickup: settings.allows_pickup,
          allows_delivery: settings.allows_delivery,
          allow_guest_orders: settings.allow_guest_orders,
          allows_cash: settings.allows_cash,
          allows_online_payment: settings.allows_online_payment,
        },
      );

      setSettings(updated);
      setToast({
        type: "success",
        message: "Configuración de pedidos guardada.",
      });
    } catch (err) {
      setToast({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "No se pudo guardar la configuración.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <Loader2
          size={34}
          className="animate-spin text-[#168e00]"
        />
      </div>
    );
  }

  if (error || !menu || !settings) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <Link
          href="/admin/menu"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#168e00]"
        >
          <ArrowLeft size={17} />
          Volver a Menús
        </Link>

        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
          {error || "No se pudo cargar esta configuración."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/admin/menu/${menu.id}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#168e00] hover:underline"
        >
          <ArrowLeft size={17} />
          Volver a {menu.name}
        </Link>

        <Link
          href="/admin/menu/pedidos"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#004e28] hover:underline"
        >
          <PackageCheck size={17} />
          Ver pedidos recibidos
        </Link>
      </div>

      <PageHero
        eyebrow="Pedidos del menú"
        title={menu.name}
        subtitle="Decide si este menú recibe pedidos en línea, las modalidades de entrega y si los visitantes pueden pedir sin crear una cuenta."
      />

      <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-[#004e28]">
              Recibir pedidos desde Drooopy
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
              Al activarlo, los clientes podrán agregar elementos disponibles
              con precio y enviarte un pedido directamente desde el menú público.
            </p>
          </div>

          <Toggle
            active={settings.accepts_orders}
            onClick={() =>
              setAcceptsOrders(!settings.accepts_orders)
            }
            label="Aceptar pedidos desde el menú"
          />
        </div>

        <div
          className={`mt-8 ${
            settings.accepts_orders ? "" : "pointer-events-none opacity-50"
          }`}
        >
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#004e28]">
            Formas de entrega
          </h3>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              disabled={!settings.accepts_orders}
              onClick={() => toggleMethod("allows_pickup")}
              className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition ${
                settings.allows_pickup
                  ? "border-[#168e00] bg-[#168e00]/5"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  settings.allows_pickup
                    ? "bg-[#168e00] text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                <Store size={22} />
              </div>

              <div>
                <p className="font-black text-gray-900">
                  Recoger en el negocio
                </p>
                <p className="mt-1 text-sm leading-5 text-gray-500">
                  El cliente realiza el pedido y pasa por él cuando esté listo.
                </p>
                <p
                  className={`mt-3 text-xs font-bold ${
                    settings.allows_pickup
                      ? "text-[#168e00]"
                      : "text-gray-400"
                  }`}
                >
                  {settings.allows_pickup
                    ? "ACTIVADO"
                    : "DESACTIVADO"}
                </p>
              </div>
            </button>

            <button
              type="button"
              disabled={!settings.accepts_orders}
              onClick={() => toggleMethod("allows_delivery")}
              className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition ${
                settings.allows_delivery
                  ? "border-[#168e00] bg-[#168e00]/5"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  settings.allows_delivery
                    ? "bg-[#168e00] text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                <Truck size={22} />
              </div>

              <div>
                <p className="font-black text-gray-900">
                  Entrega a domicilio
                </p>
                <p className="mt-1 text-sm leading-5 text-gray-500">
                  El cliente captura su dirección. En esta primera versión la
                  tarifa de entrega es $0 y la logística la gestiona el negocio.
                </p>
                <p
                  className={`mt-3 text-xs font-bold ${
                    settings.allows_delivery
                      ? "text-[#168e00]"
                      : "text-gray-400"
                  }`}
                >
                  {settings.allows_delivery
                    ? "ACTIVADO"
                    : "DESACTIVADO"}
                </p>
              </div>
            </button>
          </div>

          {settings.accepts_orders &&
          !settings.allows_pickup &&
          !settings.allows_delivery ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Debes mantener al menos una modalidad activa.
            </p>
          ) : null}

          <div className="mt-8 border-t border-gray-100 pt-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#004e28]">
                  Métodos de pago
                </h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                  Puedes aceptar efectivo, pago en línea o ambos. Debe quedar
                  al menos un método activo.
                </p>
              </div>

              {!settings.mercadopago_linked ? (
                <a
                  href="/api/mercadopago/connect?account_type=supplier&redirect=true"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#168e00]/25 bg-[#168e00]/5 px-4 py-2.5 text-sm font-bold text-[#168e00] hover:bg-[#168e00]/10"
                >
                  Vincular Mercado Pago
                  <ExternalLink size={15} />
                </a>
              ) : (
                <span className="rounded-full bg-[#168e00]/10 px-3 py-1.5 text-xs font-black text-[#168e00]">
                  Mercado Pago vinculado
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                disabled={!settings.accepts_orders}
                onClick={() => togglePaymentMethod("allows_cash")}
                className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition ${
                  settings.allows_cash
                    ? "border-[#168e00] bg-[#168e00]/5"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    settings.allows_cash
                      ? "bg-[#168e00] text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <Banknote size={22} />
                </div>

                <div>
                  <p className="font-black text-gray-900">
                    Pago en efectivo
                  </p>
                  <p className="mt-1 text-sm leading-5 text-gray-500">
                    El cliente paga al recoger o recibir el pedido.
                  </p>
                  <p
                    className={`mt-3 text-xs font-bold ${
                      settings.allows_cash
                        ? "text-[#168e00]"
                        : "text-gray-400"
                    }`}
                  >
                    {settings.allows_cash ? "ACTIVADO" : "DESACTIVADO"}
                  </p>
                </div>
              </button>

              <button
                type="button"
                disabled={
                  !settings.accepts_orders ||
                  !settings.mercadopago_linked
                }
                onClick={() => togglePaymentMethod("allows_online_payment")}
                className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition ${
                  settings.allows_online_payment
                    ? "border-[#168e00] bg-[#168e00]/5"
                    : "border-gray-200 bg-white"
                } ${
                  !settings.mercadopago_linked
                    ? "cursor-not-allowed opacity-60"
                    : ""
                }`}
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    settings.allows_online_payment
                      ? "bg-[#168e00] text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <CreditCard size={22} />
                </div>

                <div>
                  <p className="font-black text-gray-900">
                    Pago en línea
                  </p>
                  <p className="mt-1 text-sm leading-5 text-gray-500">
                    El cobro se procesa con Mercado Pago y llega directamente
                    a tu cuenta vinculada.
                  </p>
                  <p
                    className={`mt-3 text-xs font-bold ${
                      settings.allows_online_payment
                        ? "text-[#168e00]"
                        : "text-gray-400"
                    }`}
                  >
                    {!settings.mercadopago_linked
                      ? "REQUIERE VINCULAR MERCADO PAGO"
                      : settings.allows_online_payment
                        ? "ACTIVADO"
                        : "DESACTIVADO"}
                  </p>
                </div>
              </button>
            </div>

            {settings.accepts_orders &&
            !settings.allows_cash &&
            !settings.allows_online_payment ? (
              <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Debes mantener al menos un método de pago activo.
              </p>
            ) : null}
          </div>

          <div className="mt-8 border-t border-gray-100 pt-7">
            <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#004e28]">
              Clientes
            </h3>

            <div
              className={`mt-3 flex items-start justify-between gap-5 rounded-2xl border p-5 transition ${
                settings.allow_guest_orders
                  ? "border-[#168e00]/30 bg-[#168e00]/5"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex min-w-0 gap-4">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    settings.allow_guest_orders
                      ? "bg-[#168e00] text-white"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  <UserRound size={22} />
                </div>

                <div>
                  <p className="font-black text-gray-900">
                    Permitir pedidos sin iniciar sesión
                  </p>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
                    Si está activado, un visitante podrá comprar como invitado
                    proporcionando nombre, correo y teléfono. Recibirá por correo
                    el enlace privado para consultar el estado de su pedido.
                  </p>

                  {!settings.allow_guest_orders ? (
                    <p className="mt-3 text-xs font-bold text-[#004e28]">
                      SOLO USUARIOS CON CUENTA
                    </p>
                  ) : (
                    <p className="mt-3 text-xs font-bold text-[#168e00]">
                      INVITADOS PERMITIDOS
                    </p>
                  )}
                </div>
              </div>

              <Toggle
                active={settings.allow_guest_orders}
                disabled={!settings.accepts_orders}
                onClick={() =>
                  setSettings((current) =>
                    current
                      ? {
                          ...current,
                          allow_guest_orders:
                            !current.allow_guest_orders,
                        }
                      : current,
                  )
                }
                label="Permitir pedidos de invitados"
              />
            </div>

            <p className="mt-3 text-xs leading-5 text-gray-400">
              Si lo desactivas, el menú seguirá siendo público y visible. Los
              visitantes solamente tendrán que iniciar sesión antes de poder
              agregar productos o finalizar un pedido.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-gray-400">
            Los precios siempre se recalculan en el backend al crear el pedido.
            Un elemento agotado o sin precio no se puede pedir.
          </p>

          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-bold text-white hover:bg-[#117500] disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            Guardar configuración
          </button>
        </div>
      </section>

      {toast ? (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
