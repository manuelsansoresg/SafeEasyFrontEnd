"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Blocks,
  CheckCircle2,
  CreditCard,
  Loader2,
  Power,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Toast } from "@/components/ui/Toast";
import { supplierModuleScreens } from "@/lib/supplierModules";
import { getSafeMercadoPagoUrl } from "@/lib/security";
import { moduleService } from "@/services/moduleService";
import type {
  ModuleBillingPeriod,
  SupplierModule,
} from "@/types/module";

function formatMoney(value: number | null) {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function periodLabel(period: ModuleBillingPeriod | null) {
  if (period === "monthly") return "al mes";
  if (period === "yearly") return "al año";
  if (period === "one_time") return "pago único";
  return "";
}

function sourceLabel(module: SupplierModule) {
  if (module.included_by_plan && module.specific_supplier_offer) {
    return "Incluido en tu plan y asignado directamente";
  }
  if (module.included_by_plan) return "Disponible por tu plan";
  if (module.specific_supplier_offer) return "Disponible para tu negocio";
  return "Disponible";
}

function moduleScreen(code: string) {
  return supplierModuleScreens.find(
    (item) => item.code.toLowerCase() === code.toLowerCase(),
  );
}

export function SupplierModulesPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [modules, setModules] = useState<SupplierModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);
  const [paymentHandled, setPaymentHandled] = useState(false);

  const load = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const data = await moduleService.available(controller.signal);
      setModules(
        [...data].sort(
          (a, b) =>
            a.display_order - b.display_order ||
            a.name.localeCompare(b.name, "es"),
        ),
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los módulos disponibles.",
      );
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = useMemo(
    () => modules.filter((module) => module.has_access).length,
    [modules],
  );

  useEffect(() => {
    if (paymentHandled) return;

    const paymentResult = searchParams.get("module_payment");
    if (!paymentResult) return;

    const mpPaymentId =
      searchParams.get("payment_id") ||
      searchParams.get("collection_id");

    setPaymentHandled(true);

    const finish = async () => {
      try {
        if (mpPaymentId && (paymentResult === "success" || paymentResult === "pending")) {
          await moduleService.refreshPayment(mpPaymentId);
        }

        await load();
        await queryClient.invalidateQueries({ queryKey: ["supplier-modules"] });

        if (paymentResult === "success") {
          setToast({
            type: "success",
            message: "Pago recibido. Estamos actualizando el acceso a tu módulo.",
          });
        } else if (paymentResult === "pending") {
          setToast({
            type: "info",
            message: "El pago sigue pendiente de confirmación por Mercado Pago.",
          });
        } else {
          setToast({
            type: "error",
            message: "El pago no se completó. Puedes intentarlo nuevamente.",
          });
        }
      } catch (err) {
        setToast({
          type: "error",
          message:
            err instanceof Error
              ? err.message
              : "No se pudo actualizar el estado del pago.",
        });
      } finally {
        const next = new URLSearchParams(searchParams.toString());
        next.delete("module_payment");
        next.delete("payment");
        next.delete("payment_id");
        next.delete("collection_id");
        next.delete("collection_status");
        next.delete("merchant_order_id");
        next.delete("preference_id");
        next.delete("external_reference");
        next.delete("module_id");
        next.set("tab", "overview");
        router.replace(`/admin/my-company?${next.toString()}`, { scroll: false });
      }
    };

    void finish();
  }, [load, paymentHandled, queryClient, router, searchParams]);

  async function mutate(
    module: SupplierModule,
    action: "activate" | "enable" | "disable",
  ) {
    if (busyId !== null) return;
    setBusyId(module.id);
    setError(null);

    try {
      if (action === "activate") {
        await moduleService.activate(module.id);
      } else {
        await moduleService.setEnabled(module.id, action === "enable");
      }

      await load();
      await queryClient.invalidateQueries({ queryKey: ["supplier-modules"] });

      setToast({
        type: "success",
        message:
          action === "disable"
            ? `${module.name} fue desactivado.`
            : `${module.name} está activo.`,
      });
    } catch (err) {
      setToast({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "No se pudo actualizar el módulo.",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function purchase(module: SupplierModule) {
    if (busyId !== null) return;
    setBusyId(module.id);
    setError(null);

    try {
      const result = await moduleService.purchase(module.id);
      const safeUrl = getSafeMercadoPagoUrl(
        result.init_point || result.sandbox_init_point || "",
      );

      if (!safeUrl) {
        throw new Error("Mercado Pago no devolvió una liga de pago válida.");
      }

      try {
        window.sessionStorage.setItem(
          `module-payment:${module.id}`,
          String(result.module_payment_id),
        );
      } catch {
        // No bloquea el pago si el navegador impide sessionStorage.
      }

      window.location.assign(safeUrl);
    } catch (err) {
      setToast({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "No se pudo iniciar el pago del módulo.",
      });
      setBusyId(null);
    }
  }

  if (loading && modules.length === 0) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Loader2 size={20} className="animate-spin text-[#168e00]" />
          Cargando módulos disponibles...
        </div>
      </section>
    );
  }

  if (error && modules.length === 0) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm"
        >
          Reintentar
        </button>
      </section>
    );
  }

  if (modules.length === 0) return null;

  return (
    <>
      <section aria-labelledby="supplier-modules-title" className="rounded-2xl border border-[#004e28]/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#168e00]">Funciones adicionales</p>
            <h3 id="supplier-modules-title" className="mt-1 font-[family-name:var(--font-varela-round)] text-xl text-[#004e28]">
              Módulos de tu negocio
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
              Activa las funciones incluidas en tu plan o contrata las que tienen costo adicional.
            </p>
          </div>
          <span className="rounded-full bg-[#004e28]/[0.06] px-3 py-1.5 text-xs font-bold text-[#004e28]">
            {activeCount} de {modules.length} activos
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {modules.map((module) => {
            const screen = moduleScreen(module.code);
            const Icon = screen?.icon ?? Blocks;
            const assignment = module.assignment;
            const disabled = busyId !== null;
            const isBusy = busyId === module.id;
            const canEnableExisting =
              !module.has_access &&
              Boolean(assignment) &&
              module.can_activate;

            return (
              <article
                key={module.id}
                className={`rounded-2xl border p-5 transition ${
                  module.has_access
                    ? "border-[#168e00]/30 bg-[#168e00]/[0.04]"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div className="flex items-start gap-4">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${module.has_access ? "bg-[#168e00] text-white" : "bg-[#004e28]/[0.06] text-[#004e28]"}`}>
                    <Icon size={23} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-[family-name:var(--font-varela-round)] text-lg font-black text-[#004e28]">{module.name}</h4>
                      {module.has_access ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#168e00]/10 px-2 py-1 text-[11px] font-bold text-[#0b6d00]">
                          <CheckCircle2 size={12} /> Activo
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[#168e00]">{sourceLabel(module)}</p>
                    {module.description ? <p className="mt-2 text-sm leading-5 text-gray-500">{module.description}</p> : null}

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                      {module.has_price ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 font-bold text-gray-800">
                          <CreditCard size={14} />
                          {formatMoney(module.price)} {periodLabel(module.billing_period)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#168e00]/10 px-3 py-1.5 font-bold text-[#0b6d00]">
                          <Sparkles size={14} /> Incluido sin costo adicional
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                  {module.has_access ? (
                    <>
                      {screen ? (
                        <Link
                          href={screen.path}
                          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#117500]"
                        >
                          <Settings2 size={16} /> Configurar
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => void mutate(module, "disable")}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
                        Desactivar
                      </button>
                    </>
                  ) : module.payment_required ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void purchase(module)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#117500] disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                      {assignment ? "Renovar / comprar" : "Comprar módulo"}
                    </button>
                  ) : canEnableExisting ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void mutate(module, "enable")}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#117500] disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
                      Activar
                    </button>
                  ) : module.can_activate ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => void mutate(module, "activate")}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#117500] disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
                      Activar módulo
                    </button>
                  ) : (
                    <p className="w-full rounded-xl bg-gray-50 p-3 text-center text-xs text-gray-500">
                      Este módulo todavía no se puede activar.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
    </>
  );
}
