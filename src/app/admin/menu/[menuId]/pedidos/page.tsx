"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  PackageCheck,
  Save,
  Store,
  Truck,
} from "lucide-react";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import { menuOrderService } from "@/services/menuOrderService";
import { menuService } from "@/services/menuService";
import type { Menu } from "@/types/menu";
import type { MenuOrderSettings } from "@/types/menuOrder";

type ToastState = { type: "success" | "error" | "info"; message: string } | null;

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
      setError(err instanceof Error ? err.message : "No se pudo cargar la configuración de pedidos.");
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
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const setAcceptsOrders = (value: boolean) => {
    setSettings((current) => {
      if (!current) return current;
      if (!value) return { ...current, accepts_orders: false };
      if (current.allows_pickup || current.allows_delivery) return { ...current, accepts_orders: true };
      return { ...current, accepts_orders: true, allows_pickup: true };
    });
  };

  const toggleMethod = (key: "allows_pickup" | "allows_delivery") => {
    setSettings((current) => {
      if (!current) return current;
      const next = { ...current, [key]: !current[key] };
      if (next.accepts_orders && !next.allows_pickup && !next.allows_delivery) {
        return current;
      }
      return next;
    });
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await menuOrderService.updateSettings(menuId, {
        accepts_orders: settings.accepts_orders,
        allows_pickup: settings.allows_pickup,
        allows_delivery: settings.allows_delivery,
      });
      setSettings(updated);
      setToast({ type: "success", message: "Configuración de pedidos guardada." });
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "No se pudo guardar la configuración." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 size={34} className="animate-spin text-[#168e00]" /></div>;
  }

  if (error || !menu || !settings) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <Link href="/admin/menu" className="inline-flex items-center gap-2 text-sm font-semibold text-[#168e00]"><ArrowLeft size={17} /> Volver a Menús</Link>
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">{error || "No se pudo cargar esta configuración."}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/admin/menu/${menu.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#168e00] hover:underline"><ArrowLeft size={17} /> Volver a {menu.name}</Link>
        <Link href="/admin/menu/pedidos" className="inline-flex items-center gap-2 text-sm font-semibold text-[#004e28] hover:underline"><PackageCheck size={17} /> Ver pedidos recibidos</Link>
      </div>

      <PageHero eyebrow="Pedidos del menú" title={menu.name} subtitle="Decide si este menú recibe pedidos en línea y qué modalidades ofrece." />

      <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-[#004e28]">Recibir pedidos desde Drooopy</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">Al activarlo, los clientes podrán agregar elementos disponibles con precio y enviarte un pedido directamente desde el menú público.</p>
          </div>
          <button type="button" onClick={() => setAcceptsOrders(!settings.accepts_orders)} className={`relative h-7 w-12 shrink-0 rounded-full transition ${settings.accepts_orders ? "bg-[#168e00]" : "bg-gray-300"}`} aria-pressed={settings.accepts_orders}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${settings.accepts_orders ? "left-6" : "left-1"}`} /></button>
        </div>

        <div className={`mt-7 grid gap-4 sm:grid-cols-2 ${settings.accepts_orders ? "" : "opacity-50"}`}>
          <button type="button" disabled={!settings.accepts_orders} onClick={() => toggleMethod("allows_pickup")} className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition ${settings.allows_pickup ? "border-[#168e00] bg-[#168e00]/5" : "border-gray-200 bg-white"}`}>
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${settings.allows_pickup ? "bg-[#168e00] text-white" : "bg-gray-100 text-gray-500"}`}><Store size={22} /></div>
            <div><p className="font-black text-gray-900">Recoger en el negocio</p><p className="mt-1 text-sm leading-5 text-gray-500">El cliente realiza el pedido y pasa por él cuando esté listo.</p><p className={`mt-3 text-xs font-bold ${settings.allows_pickup ? "text-[#168e00]" : "text-gray-400"}`}>{settings.allows_pickup ? "ACTIVADO" : "DESACTIVADO"}</p></div>
          </button>

          <button type="button" disabled={!settings.accepts_orders} onClick={() => toggleMethod("allows_delivery")} className={`flex items-start gap-4 rounded-2xl border p-5 text-left transition ${settings.allows_delivery ? "border-[#168e00] bg-[#168e00]/5" : "border-gray-200 bg-white"}`}>
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${settings.allows_delivery ? "bg-[#168e00] text-white" : "bg-gray-100 text-gray-500"}`}><Truck size={22} /></div>
            <div><p className="font-black text-gray-900">Entrega a domicilio</p><p className="mt-1 text-sm leading-5 text-gray-500">El cliente captura su dirección. En esta primera versión la tarifa de entrega es $0 y la logística la gestiona el negocio.</p><p className={`mt-3 text-xs font-bold ${settings.allows_delivery ? "text-[#168e00]" : "text-gray-400"}`}>{settings.allows_delivery ? "ACTIVADO" : "DESACTIVADO"}</p></div>
          </button>
        </div>

        {settings.accepts_orders && !settings.allows_pickup && !settings.allows_delivery ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Debes mantener al menos una modalidad activa.</p> : null}

        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-gray-400">Los precios siempre se recalculan en el backend al crear el pedido. Un elemento agotado o sin precio no se puede pedir.</p>
          <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#168e00] px-5 py-3 font-bold text-white hover:bg-[#117500] disabled:opacity-50">{saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Guardar configuración</button>
        </div>
      </section>

      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </div>
  );
}
