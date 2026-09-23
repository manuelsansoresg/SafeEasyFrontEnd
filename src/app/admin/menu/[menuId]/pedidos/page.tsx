"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  Loader2,
  PackageCheck,
  Save,
  Store,
  Truck,
  UserRound,
  WalletCards,
} from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import { startMercadoPagoConnect } from "@/lib/mercadoPagoConnect";
import { menuOrderService } from "@/services/menuOrderService";
import { menuService } from "@/services/menuService";
import type { Menu } from "@/types/menu";
import type { MenuOrderSettings } from "@/types/menuOrder";

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
      role="switch"
      aria-checked={active}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${
        active ? "bg-[#168e00]" : "bg-gray-300"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
          active ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

export default function AdminMenuOrderSettingsPage() {
  const params = useParams<{ menuId: string }>();
  const searchParams = useSearchParams();
  const menuId = Number(params.menuId);

  const [menu, setMenu] = useState<Menu | null>(null);
  const [settings, setSettings] = useState<MenuOrderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(menuId) || menuId <= 0) {
      setError("menuId inválido.");
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
      if (err instanceof DOMException && err.name === "AbortError") return;
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
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  useEffect(() => {
    if (searchParams.get("mp") !== "linked") return;
    if (searchParams.get("account_type") !== "supplier") return;
    setToast({
      type: "info",
      message: "Regresaste de Mercado Pago. Estamos validando la vinculación.",
    });
    void load();
  }, [load, searchParams]);

  const setAcceptsOrders = (value: boolean) => {
    setSettings((current) => {
      if (!current) return current;
      if (!value) return { ...current, accepts_orders: false };

      return {
        ...current,
        accepts_orders: true,
        allows_pickup:
          current.allows_pickup || current.allows_delivery
            ? current.allows_pickup
            : true,
        allows_cash:
          current.allows_cash || current.allows_online_payment
            ? current.allows_cash
            : true,
      };
    });
  };

  const toggleDelivery = (key: "allows_pickup" | "allows_delivery") => {
    setSettings((current) => {
      if (!current) return current;
      const next = { ...current, [key]: !current[key] };
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

  const togglePayment = (key: "allows_cash" | "allows_online_payment") => {
    setSettings((current) => {
      if (!current) return current;

      if (
        key === "allows_online_payment" &&
        !current.allows_online_payment &&
        !current.mercadopago_linked
      ) {
        setToast({
          type: "info",
          message: "Vincula primero tu cuenta de Mercado Pago para habilitar pagos en línea.",
        });
        return current;
      }

      const next = { ...current, [key]: !current[key] };
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

  const connectMercadoPago = async () => {
    setConnecting(true);
    try {
      await startMercadoPagoConnect("supplier");
    } catch (err) {
      setToast({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "No se pudo iniciar la vinculación con Mercado Pago.",
      });
      setConnecting(false);
    }
  };

  const save = async () => {
    if (!settings) return;

    if (
      settings.accepts_orders &&
      !settings.allows_pickup &&
      !settings.allows_delivery
    ) {
      setToast({
        type: "error",
        message: "Debes mantener al menos una forma de entrega activa.",
      });
      return;
    }

    if (
      settings.accepts_orders &&
      !settings.allows_cash &&
      !settings.allows_online_payment
    ) {
      setToast({
        type: "error",
        message: "Debes mantener al menos una forma de pago activa.",
      });
      return;
    }

    setSaving(true);

    try {
      const updated = await menuOrderService.updateSettings(menuId, {
        accepts_orders: settings.accepts_orders,
        allows_pickup: settings.allows_pickup,
        allows_delivery: settings.allows_delivery,
        allow_guest_orders: settings.allow_guest_orders,
        allows_cash: settings.allows_cash,
        allows_online_payment: settings.allows_online_payment,
      });

      setSettings(updated);
      setToast({ type: "success", message: "Configuración de pedidos guardada." });
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
        <Loader2 size={34} className="animate-spin text-[#168e00]" />
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
          <ArrowLeft size={17} /> Volver a Menús
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
          <ArrowLeft size={17} /> Volver a {menu.name}
        </Link>

        <Link
          href="/admin/menu/pedidos"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#004e28] hover:underline"
        >
          <PackageCheck size={17} /> Ver pedidos recibidos
        </Link>
      </div>

      <PageHero
        eyebrow="Pedidos del menú"
        title={menu.name}
        subtitle="Configura pedidos, entrega, clientes y formas de pago."
      />

      <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-[#004e28]">Recibir pedidos desde Drooopy</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
              Al activarlo, los clientes podrán agregar productos disponibles y realizar pedidos directamente desde el menú público.
            </p>
          </div>
          <Toggle
            active={settings.accepts_orders}
            onClick={() => setAcceptsOrders(!settings.accepts_orders)}
            label="Aceptar pedidos desde el menú"
          />
        </div>

        <div className={`mt-8 space-y-8 ${settings.accepts_orders ? "" : "pointer-events-none opacity-50"}`}>
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#004e28]">Formas de entrega</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                disabled={!settings.accepts_orders}
                onClick={() => toggleDelivery("allows_pickup")}
                className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition ${
                  settings.allows_pickup
                    ? "border-[#168e00] bg-[#168e00]/5"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${settings.allows_pickup ? "bg-[#168e00] text-white" : "bg-gray-100 text-gray-500"}`}>
                  <Store size={22} />
                </div>
                <div>
                  <p className="font-black text-gray-900">Recoger en el negocio</p>
                  <p className="mt-1 text-sm leading-5 text-gray-500">El cliente realiza el pedido y pasa por él cuando esté listo.</p>
                  <p className={`mt-3 text-xs font-bold ${settings.allows_pickup ? "text-[#168e00]" : "text-gray-400"}`}>
                    {settings.allows_pickup ? "ACTIVADO" : "DESACTIVADO"}
                  </p>
                </div>
              </button>

              <button
                type="button"
                disabled={!settings.accepts_orders}
                onClick={() => toggleDelivery("allows_delivery")}
                className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition ${
                  settings.allows_delivery
                    ? "border-[#168e00] bg-[#168e00]/5"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${settings.allows_delivery ? "bg-[#168e00] text-white" : "bg-gray-100 text-gray-500"}`}>
                  <Truck size={22} />
                </div>
                <div>
                  <p className="font-black text-gray-900">Entrega a domicilio</p>
                  <p className="mt-1 text-sm leading-5 text-gray-500">El cliente captura su dirección. La logística la gestiona el negocio.</p>
                  <p className={`mt-3 text-xs font-bold ${settings.allows_delivery ? "text-[#168e00]" : "text-gray-400"}`}>
                    {settings.allows_delivery ? "ACTIVADO" : "DESACTIVADO"}
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-7">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#004e28]">Formas de pago</h3>
                <p className="mt-1 text-sm text-gray-500">Puedes aceptar efectivo, pago en línea o ambos.</p>
              </div>
              <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${settings.mercadopago_linked ? "bg-[#168e00]/10 text-[#0b6d00]" : "bg-amber-50 text-amber-700"}`}>
                <WalletCards size={14} />
                {settings.mercadopago_linked ? "Mercado Pago vinculado" : "Mercado Pago no vinculado"}
              </span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className={`rounded-2xl border p-5 ${settings.allows_cash ? "border-[#168e00] bg-[#168e00]/5" : "border-gray-200"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${settings.allows_cash ? "bg-[#168e00] text-white" : "bg-gray-100 text-gray-500"}`}>
                      <Banknote size={22} />
                    </span>
                    <div>
                      <p className="font-black text-gray-900">Efectivo</p>
                      <p className="mt-1 text-sm leading-5 text-gray-500">El cliente paga al recoger o recibir el pedido.</p>
                    </div>
                  </div>
                  <Toggle
                    active={settings.allows_cash}
                    disabled={!settings.accepts_orders}
                    onClick={() => togglePayment("allows_cash")}
                    label="Aceptar efectivo"
                  />
                </div>
              </div>

              <div className={`rounded-2xl border p-5 ${settings.allows_online_payment ? "border-[#168e00] bg-[#168e00]/5" : "border-gray-200"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${settings.allows_online_payment ? "bg-[#168e00] text-white" : "bg-gray-100 text-gray-500"}`}>
                      <CreditCard size={22} />
                    </span>
                    <div>
                      <p className="font-black text-gray-900">Tarjeta / Mercado Pago</p>
                      <p className="mt-1 text-sm leading-5 text-gray-500">El cliente paga en línea antes de que el pedido se procese.</p>
                    </div>
                  </div>
                  <Toggle
                    active={settings.allows_online_payment}
                    disabled={!settings.accepts_orders || (!settings.mercadopago_linked && !settings.allows_online_payment)}
                    onClick={() => togglePayment("allows_online_payment")}
                    label="Aceptar pago en línea"
                  />
                </div>

                {!settings.mercadopago_linked ? (
                  <button
                    type="button"
                    disabled={connecting}
                    onClick={() => void connectMercadoPago()}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#004e28] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#003d20] disabled:opacity-50"
                  >
                    {connecting ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                    {connecting ? "Redirigiendo..." : "Vincular Mercado Pago"}
                  </button>
                ) : (
                  <p className="mt-4 rounded-xl bg-white/70 p-3 text-xs leading-5 text-[#0b6d00]">
                    Tu cuenta está lista. Al activar esta opción el cliente podrá elegir tarjeta y será enviado a Mercado Pago.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-7">
            <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#004e28]">Clientes</h3>
            <div className={`mt-3 flex items-start justify-between gap-5 rounded-2xl border p-5 transition ${settings.allow_guest_orders ? "border-[#168e00]/30 bg-[#168e00]/5" : "border-gray-200 bg-white"}`}>
              <div className="flex min-w-0 gap-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${settings.allow_guest_orders ? "bg-[#168e00] text-white" : "bg-gray-100 text-gray-500"}`}>
                  <UserRound size={22} />
                </div>
                <div>
                  <p className="font-black text-gray-900">Permitir pedidos sin iniciar sesión</p>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">Un visitante podrá comprar como invitado proporcionando nombre, correo y teléfono.</p>
                </div>
              </div>
              <Toggle
                active={settings.allow_guest_orders}
                disabled={!settings.accepts_orders}
                onClick={() =>
                  setSettings((current) =>
                    current
                      ? { ...current, allow_guest_orders: !current.allow_guest_orders }
                      : current,
                  )
                }
                label="Permitir pedidos de invitados"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-gray-400">Los precios y las formas de pago se validan nuevamente en el backend al crear cada pedido.</p>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-bold text-white hover:bg-[#117500] disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Guardar configuración
          </button>
        </div>
      </section>

      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
