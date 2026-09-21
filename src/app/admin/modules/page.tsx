"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Blocks,
  Edit2,
  Layers3,
  Loader2,
  Plus,
  Power,
  Search,
  UserPlus,
} from "lucide-react";
import { ModuleForm } from "@/components/admin/ModuleForm";
import { ModuleSuppliersForm } from "@/components/admin/ModuleSuppliersForm";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import { moduleService } from "@/services/moduleService";
import { useAuthStore } from "@/store/useAuthStore";
import type {
  ModuleAdminList,
  ModuleBillingPeriod,
} from "@/types/module";
import { getLoginUrl } from "@/lib/authRedirect";

const limit = 20;

const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

const actionClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50";

const compactActionClass =
  "inline-flex items-center justify-center rounded-lg p-2 text-gray-400 transition-colors hover:bg-primary/5 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50";

const selectClass =
  "h-11 rounded-xl border border-gray-200 bg-white px-4 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

function formatPrice(price: number | null, hasPrice: boolean) {
  if (!hasPrice) return "Gratis";
  if (price === null) return "-";

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(Number(price));
}

function periodLabel(period: ModuleBillingPeriod | null) {
  if (period === "monthly") return "Mensual";
  if (period === "yearly") return "Anual";
  if (period === "one_time") return "Pago único";
  return "";
}

function activeBadge(active: boolean) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
        active
          ? "border-green-100 bg-green-50 text-green-700"
          : "border-gray-200 bg-gray-50 text-gray-600"
      }`}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

export default function AdminModulesPage() {
  const { user, token } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    clientSnapshot,
    serverSnapshot,
  );

  // El backend de compra de módulos actualmente regresa a /admin/modules.
  // Si quien vuelve es un proveedor, lo enviamos a su panel y conservamos
  // los parámetros de Mercado Pago para que SupplierModulesPanel refresque el pago.
  useEffect(() => {
    if (!mounted || user?.role !== "supplier") return;

    const next = new URLSearchParams();
    next.set("tab", "overview");

    const payment = searchParams.get("payment");
    const moduleId = searchParams.get("module_id");
    const paymentId =
      searchParams.get("payment_id") ||
      searchParams.get("collection_id");

    if (payment) next.set("module_payment", payment);
    if (moduleId) next.set("module_id", moduleId);
    if (paymentId) next.set("payment_id", paymentId);

    router.replace(`/admin/my-company?${next.toString()}`);
  }, [mounted, router, searchParams, user?.role]);

  if (!mounted) {
    return <p role="status" className="py-8 text-center text-gray-500">Cargando...</p>;
  }

  if (!token) {
    return (
      <p className="py-8 text-center">
        Debes{" "}
        <Link href={getLoginUrl("/admin/modules")} className="text-primary underline">
          iniciar sesión
        </Link>{" "}
        para acceder al panel.
      </p>
    );
  }

  if (user?.role === "supplier") {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#168e00]" />
      </div>
    );
  }

  if (user?.role !== "admin") {
    return <p role="alert" className="py-8 text-center">No tienes permiso para administrar módulos.</p>;
  }

  return <ModulesContent />;
}

function ModulesContent() {
  const [items, setItems] = useState<ModuleAdminList[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [skip, setSkip] = useState(0);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<{ id: number | null } | null>(null);
  const [suppliersEditor, setSuppliersEditor] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const result = await moduleService.list(
          {
            search,
            is_active:
              status === "all"
                ? undefined
                : status === "active",
            skip,
            limit,
          },
          controller.signal,
        );

        if (controller.signal.aborted) return;

        if (result.length === 0 && skip > 0) {
          setSkip((current) => Math.max(0, current - limit));
        } else {
          setItems(result);
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudieron cargar los módulos.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [search, status, skip, revision]);

  useEffect(() => {
    if (!toast || toast.type === "error") return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const totals = useMemo(
    () => ({
      plans: items.reduce((sum, item) => sum + (item.linked_plans_count || 0), 0),
      extras: items.reduce((sum, item) => sum + (item.allowed_suppliers_count || 0), 0),
    }),
    [items],
  );

  function refresh(message: string) {
    setToast({ type: "success", message });
    setLoading(true);
    setRevision((value) => value + 1);
  }

  async function toggle(item: ModuleAdminList) {
    if (busyId !== null) return;

    if (
      item.is_active &&
      !window.confirm(
        `¿Desactivar el módulo "${item.name}"?\n\nMientras esté inactivo dejará de operar para todos los proveedores.`,
      )
    ) {
      return;
    }

    setBusyId(item.id);

    try {
      if (item.is_active) {
        await moduleService.deactivate(item.id);
        refresh("Módulo desactivado.");
      } else {
        await moduleService.update(item.id, { is_active: true });
        refresh("Módulo activado.");
      }
    } catch (toggleError) {
      setToast({
        type: "error",
        message:
          toggleError instanceof Error
            ? toggleError.message
            : "No se pudo cambiar el estado.",
      });
    } finally {
      setBusyId(null);
    }
  }

  function actions(item: ModuleAdminList, compact = false) {
    return (
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={busyId !== null}
          onClick={() => setEditor({ id: item.id })}
          className={compact ? compactActionClass : actionClass}
          aria-label={`Editar ${item.name}`}
          title={compact ? "Editar" : undefined}
        >
          <Edit2 size={compact ? 18 : 16} />
          {compact ? null : "Editar"}
        </button>

        <button
          type="button"
          disabled={busyId !== null}
          onClick={() =>
            setSuppliersEditor({
              id: item.id,
              name: item.name,
            })
          }
          className={compact ? compactActionClass : actionClass}
          aria-label={`Administrar proveedores adicionales para ${item.name}`}
          title={compact ? "Proveedores adicionales" : undefined}
        >
          <UserPlus size={compact ? 18 : 16} />
          {compact ? null : "Proveedores"}
        </button>

        <button
          type="button"
          disabled={busyId !== null}
          onClick={() => void toggle(item)}
          className={
            compact
              ? `${compactActionClass} ${item.is_active ? "hover:bg-red-50 hover:text-red-500" : ""}`
              : actionClass
          }
          aria-label={`${item.is_active ? "Desactivar" : "Activar"} ${item.name}`}
          title={compact ? (item.is_active ? "Desactivar" : "Activar") : undefined}
        >
          {busyId === item.id ? (
            <Loader2 size={compact ? 18 : 16} className="animate-spin" />
          ) : (
            <Power size={compact ? 18 : 16} />
          )}
          {compact ? null : item.is_active ? "Desactivar" : "Activar"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast ? <Toast {...toast} onClose={() => setToast(null)} /> : null}

      <PageHero
        title="Módulos"
        subtitle="Define qué planes incluyen cada función, proveedores adicionales y módulos gratuitos o de pago."
        eyebrow="Contenido"
        actions={
          <button
            type="button"
            disabled={busyId !== null}
            onClick={() => setEditor({ id: null })}
            className="flex items-center gap-2 rounded-xl bg-[#168e00] px-4 py-2.5 text-white shadow-sm transition hover:bg-[#004e28] disabled:opacity-50"
          >
            <Plus size={20} />
            Nuevo módulo
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Módulos en esta página</p>
          <p className="mt-1 text-3xl font-black text-[#004e28]">{items.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Relaciones con planes</p>
          <p className="mt-1 text-3xl font-black text-[#168e00]">{totals.plans}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Excepciones de proveedores</p>
          <p className="mt-1 text-3xl font-black text-[#168e00]">{totals.extras}</p>
        </div>
      </div>

      <section aria-label="Listado de módulos" className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row">
          <div className="relative flex-1 sm:max-w-md">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSkip(0);
                setLoading(true);
              }}
              placeholder="Buscar módulos..."
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as "all" | "active" | "inactive");
              setSkip(0);
              setLoading(true);
            }}
            className={selectClass}
          >
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>

        {loading ? (
          <p role="status" className="flex items-center justify-center gap-2 p-10 text-gray-500">
            <Loader2 size={20} className="animate-spin" />
            Cargando módulos...
          </p>
        ) : error ? (
          <div role="alert" className="space-y-3 p-6 text-center">
            <p className="text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setRevision((value) => value + 1);
              }}
              className={actionClass}
            >
              Reintentar
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center text-gray-500">
            <Blocks size={34} className="text-primary" />
            <p>No se encontraron módulos.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 bg-gray-50/50 text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-5 py-4">Módulo</th>
                    <th className="px-5 py-4">Planes</th>
                    <th className="px-5 py-4">Proveedores adicionales</th>
                    <th className="px-5 py-4">Precio</th>
                    <th className="px-5 py-4">Estado</th>
                    <th className="px-5 py-4 text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="max-w-sm px-5 py-4">
                        <div className="flex gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Blocks size={20} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900">{item.name}</p>
                            <p className="mt-0.5 break-all text-xs font-medium text-gray-400">{item.code}</p>
                            {item.description ? <p className="mt-1 line-clamp-2 text-xs text-gray-500">{item.description}</p> : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#004e28]/[0.06] px-2.5 py-1 text-xs font-semibold text-[#004e28]">
                          <Layers3 size={13} /> {item.linked_plans_count} plan{item.linked_plans_count === 1 ? "" : "es"}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span className="font-semibold text-gray-800">{item.allowed_suppliers_count}</span>
                        <span className="ml-1 text-xs text-gray-500">adicionales</span>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-800">{formatPrice(item.price, item.has_price)}</p>
                        {item.has_price ? <p className="text-xs text-gray-500">{periodLabel(item.billing_period)}</p> : null}
                      </td>

                      <td className="px-5 py-4">{activeBadge(item.is_active)}</td>
                      <td className="px-5 py-4">{actions(item, true)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-gray-100 md:hidden">
              {items.map((item) => (
                <article key={item.id} className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Blocks size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h2 className="font-semibold text-gray-900">{item.name}</h2>
                          <p className="break-all text-xs text-gray-400">{item.code}</p>
                        </div>
                        {activeBadge(item.is_active)}
                      </div>
                      {item.description ? <p className="mt-2 text-sm text-gray-600">{item.description}</p> : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">Planes</p>
                      <p className="mt-1 font-semibold text-gray-900">{item.linked_plans_count}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">Extras</p>
                      <p className="mt-1 font-semibold text-gray-900">{item.allowed_suppliers_count}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">Precio</p>
                      <p className="mt-1 truncate font-semibold text-gray-900">{formatPrice(item.price, item.has_price)}</p>
                    </div>
                  </div>

                  {actions(item)}
                </article>
              ))}
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 p-4 text-sm text-gray-500">
          <span>Página {Math.floor(skip / limit) + 1}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || skip === 0}
              onClick={() => {
                setSkip((value) => Math.max(0, value - limit));
                setLoading(true);
              }}
              className={actionClass}
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={loading || !!error || items.length < limit}
              onClick={() => {
                setSkip((value) => value + limit);
                setLoading(true);
              }}
              className={actionClass}
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      {editor ? (
        <ModuleForm
          key={editor.id ?? "new"}
          id={editor.id}
          onClose={() => setEditor(null)}
          onSaved={refresh}
        />
      ) : null}

      {suppliersEditor ? (
        <ModuleSuppliersForm
          moduleId={suppliersEditor.id}
          moduleName={suppliersEditor.name}
          onClose={() => setSuppliersEditor(null)}
          onSaved={refresh}
        />
      ) : null}
    </div>
  );
}
