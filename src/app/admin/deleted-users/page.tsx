"use client";

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Search, Trash2, UserRoundX } from "lucide-react";
import { DeletedBadge } from "@/components/admin/DeletedUserControls";
import { PageHero } from "@/components/ui/PageHero";
import { Toast } from "@/components/ui/Toast";
import { fetchWithAuth } from "@/lib/api";
import { useAuthStore } from "@/store/useAuthStore";

type DeletedAccount = {
  id: number;
  email: string;
  name: string;
  role: string;
  deletedAt: string;
};

const DELETED_USERS_PAGE_SIZE = 100;

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  client: "Cliente",
  customer: "Cliente",
  user: "Cliente",
  supplier: "Proveedor",
  proveedor: "Proveedor",
  seller: "Vendedor",
  vendedor: "Vendedor",
  courier: "Repartidor",
  repartidor: "Repartidor",
};

const ROLE_STYLES: Record<string, string> = {
  admin: "border-violet-200 bg-violet-50 text-violet-700",
  supplier: "border-blue-200 bg-blue-50 text-blue-700",
  seller: "border-amber-200 bg-amber-50 text-amber-700",
  courier: "border-cyan-200 bg-cyan-50 text-cyan-700",
};

const unwrapList = (payload: unknown): Record<string, unknown>[] => {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  const candidate =
    payload.items ??
    payload.results ??
    payload.data ??
    payload.users ??
    payload.suppliers ??
    payload.sellers ??
    payload.couriers;
  return Array.isArray(candidate) ? candidate.filter(isRecord) : [];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const readString = (...values: unknown[]) => {
  const value = values.find((candidate) => typeof candidate === "string" && candidate.trim());
  return typeof value === "string" ? value.trim() : "";
};

const normalizeRole = (value: unknown) => {
  if (isRecord(value)) {
    return readString(value.name, value.slug, value.key).toLowerCase();
  }
  return readString(value).toLowerCase();
};

const normalizeDeletedAccount = (
  item: Record<string, unknown>,
): DeletedAccount | null => {
  const nestedUser = isRecord(item.user) ? item.user : {};
  const id = Number(item.user_id ?? nestedUser.id ?? item.id);
  const deletedAt = readString(
    item.user_deleted_at,
    item.deleted_at,
    nestedUser.deleted_at,
  );
  if (!Number.isFinite(id) || !deletedAt) return null;

  const role = normalizeRole(item.role ?? nestedUser.role) || "client";
  const email = readString(item.user_email, item.email, nestedUser.email);
  const name = readString(
    item.full_name,
    item.user_name,
    item.name,
    item.short_name,
    nestedUser.full_name,
    nestedUser.name,
  );

  return {
    id,
    email,
    name: name || email.split("@")[0] || `Usuario #${id}`,
    role: role || "client",
    deletedAt,
  };
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const roleLabel = (role: string) => ROLE_LABELS[role] ?? (role || "Usuario");

export default function DeletedUsersPage() {
  const token = useAuthStore((state) => state.token);
  const [accounts, setAccounts] = useState<DeletedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [toast, setToast] = useState<null | { type: "success" | "error" | "info"; message: string }>(null);

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadDeletedAccounts = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const deletedAccounts: DeletedAccount[] = [];
        let skip = 0;

        while (true) {
          const query = new URLSearchParams({
            skip: String(skip),
            limit: String(DELETED_USERS_PAGE_SIZE),
          });
          const response = await fetchWithAuth(`/api/users/deleted?${query.toString()}`);
          if (!response.ok) throw new Error("No se pudieron cargar las cuentas eliminadas.");

          const payload: unknown = await response.json();
          const page = unwrapList(payload);
          deletedAccounts.push(
            ...page
              .map((item) => normalizeDeletedAccount(item))
              .filter((item): item is DeletedAccount => item !== null),
          );

          if (page.length < DELETED_USERS_PAGE_SIZE) break;
          skip += DELETED_USERS_PAGE_SIZE;
        }

        if (cancelled) return;
        const byUserId = new Map<number, DeletedAccount>();
        for (const account of deletedAccounts) {
          byUserId.set(account.id, account);
        }

        setAccounts(
          Array.from(byUserId.values()).sort(
            (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime(),
          ),
        );
      } catch (error) {
        console.error("Error al cargar cuentas eliminadas:", error);
        if (!cancelled) {
          setAccounts([]);
          setLoadError("No se pudieron cargar todas las cuentas eliminadas. Intenta nuevamente.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDeletedAccounts();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const roles = useMemo(
    () => Array.from(new Set(accounts.map((account) => account.role))).sort(),
    [accounts],
  );

  const filteredAccounts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return accounts.filter((account) => {
      if (roleFilter !== "all" && account.role !== roleFilter) return false;
      if (!term) return true;
      return [account.name, account.email, roleLabel(account.role)]
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [accounts, roleFilter, search]);

  const restoreAccount = async (account: DeletedAccount) => {
    if (!window.confirm(`¿Restaurar a ${account.name}?`)) return;
    setRestoringId(account.id);
    try {
      const response = await fetchWithAuth(`/api/admin/users/${account.id}/restore`, {
        method: "PATCH",
      });
      if (!response.ok) {
        const message = await response.text().catch(() => "");
        throw new Error(message || "No se pudo restaurar la cuenta.");
      }
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      setToast({ type: "success", message: `${account.name} fue restaurado correctamente.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo restaurar la cuenta.";
      setToast({ type: "error", message });
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="space-y-6">
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
      <PageHero
        eyebrow="Usuarios"
        title="Eliminados"
        subtitle="Consulta y restaura cuentas eliminadas de todos los roles."
      />

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, correo o rol..."
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            aria-label="Filtrar por rol"
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          >
            <option value="all">Todos los roles</option>
            {roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
          </select>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead className="bg-gray-50/70">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Cuenta</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Rol</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Eliminado</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">Cargando cuentas eliminadas...</td></tr>
              ) : loadError ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-red-600">{loadError}</td></tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-14 text-center">
                    <UserRoundX className="mx-auto text-gray-300" size={34} />
                    <p className="mt-3 font-medium text-gray-600">No se encontraron cuentas eliminadas</p>
                  </td>
                </tr>
              ) : filteredAccounts.map((account) => (
                <tr key={account.id} className="transition-colors hover:bg-red-50/25">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{account.name}</div>
                    <div className="text-sm text-gray-500">{account.email || "Sin correo"}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${ROLE_STYLES[account.role] ?? "border-gray-200 bg-gray-50 text-gray-700"}`}>
                      {roleLabel(account.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <DeletedBadge deletedAt={account.deletedAt} />
                    <div className="mt-1 text-xs text-gray-400">{formatDate(account.deletedAt)}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => restoreAccount(account)}
                      disabled={restoringId === account.id}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RotateCcw size={16} />
                      {restoringId === account.id ? "Restaurando..." : "Restaurar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 md:hidden">
          {loading ? (
            <div className="px-4 py-12 text-center text-gray-500">Cargando cuentas eliminadas...</div>
          ) : loadError ? (
            <div className="px-4 py-12 text-center text-red-600">{loadError}</div>
          ) : filteredAccounts.length === 0 ? (
            <div className="px-4 py-12 text-center text-gray-500">No se encontraron cuentas eliminadas</div>
          ) : filteredAccounts.map((account) => (
            <article key={account.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <Trash2 size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-gray-900">{account.name}</h2>
                      <p className="break-all text-sm text-gray-500">{account.email || "Sin correo"}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${ROLE_STYLES[account.role] ?? "border-gray-200 bg-gray-50 text-gray-700"}`}>
                      {roleLabel(account.role)}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-gray-400">Eliminado: {formatDate(account.deletedAt)}</p>
                  <button
                    type="button"
                    onClick={() => restoreAccount(account)}
                    disabled={restoringId === account.id}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 disabled:opacity-50"
                  >
                    <RotateCcw size={16} /> Restaurar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <footer className="border-t border-gray-100 px-4 py-4 text-sm text-gray-500 sm:px-6">
          Mostrando {filteredAccounts.length} de {accounts.length} cuentas eliminadas
        </footer>
      </section>
    </div>
  );
}
