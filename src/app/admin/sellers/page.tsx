"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import { Toast } from "@/components/ui/Toast";
import { PageHero } from "@/components/ui/PageHero";
import {
  CheckCircle,
  Edit,
  Plus,
  Search,
  Store,
  Trash2,
  User as UserIcon,
  XCircle,
} from "lucide-react";

interface User {
  id: number;
  email: string;
  is_active: boolean;
  name?: string;
  full_name?: string;
  role?: string;
}

const isSeller = (user: User) => (user.role || "").toLowerCase() === "seller";

const unwrapUsers = (data: unknown): User[] => {
  if (Array.isArray(data)) return data as User[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const items = record.items ?? record.results ?? record.data ?? record.users;
    if (Array.isArray(items)) return items as User[];
  }
  return [];
};

const readErrorMessage = async (response: Response) => {
  const text = await response.text().catch(() => "");
  if (!text) return `Error ${response.status}: ${response.statusText}`;
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    const detail = parsed.detail ?? parsed.message ?? parsed.error;
    if (typeof detail === "string") return detail;
    if (detail) return JSON.stringify(detail);
  } catch {}
  return text;
};

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return `${base.replace(/\/$/, "")}${path}`;
};

const authHeaders = (token: string) => ({
  "Authorization": `Bearer ${token.replace(/^bearer\s+/i, "").trim()}`,
});

export default function SellersPage() {
  const { token } = useAuthStore();
  const [sellers, setSellers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<null | { type: "success" | "error" | "info"; message: string }>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const fetchSellers = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          skip: "0",
          limit: "1000",
        });
        if (searchTerm.trim()) params.set("search", searchTerm.trim());

        const response = await fetchWithAuth(apiUrl(`/users/?${params.toString()}`));

        if (response.ok) {
          const data = await response.json();
          const nextSellers = unwrapUsers(data).filter(isSeller);
          setSellers(nextSellers);
          setSelectedIds((prev) => prev.filter((id) => nextSellers.some((seller) => seller.id === id)));
        } else {
          const message = await readErrorMessage(response);
          setError(message === "Not Found" ? "No se encontró el endpoint /users/." : message);
        }
      } catch (error) {
        console.error("Error fetching sellers:", error);
        setError("Error de conexión al cargar vendedores");
      } finally {
        setLoading(false);
      }
    };

    fetchSellers();
  }, [searchTerm, token]);

  const deleteSeller = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este vendedor?")) return;
    if (!token) return;

    try {
      const response = await fetch(apiUrl(`/admin/users/${id}`), {
        method: "DELETE",
        headers: authHeaders(token),
      });

      if (response.ok) {
        setSellers((prev) => prev.filter((seller) => seller.id !== id));
        setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));
        setToast({ type: "success", message: "Vendedor eliminado correctamente." });
      } else {
        const message = await readErrorMessage(response);
        setToast({ type: "error", message: message || "Error al eliminar vendedor." });
      }
    } catch (error) {
      console.error("Error deleting seller:", error);
      setToast({ type: "error", message: "Error de red al eliminar vendedor." });
    }
  };

  const filteredSellers = sellers.filter((seller) => {
    const term = searchTerm.toLowerCase();
    return (
      seller.email.toLowerCase().includes(term) ||
      (seller.name && seller.name.toLowerCase().includes(term)) ||
      (seller.full_name && seller.full_name.toLowerCase().includes(term))
    );
  });
  const allSelected = filteredSellers.length > 0 && filteredSellers.every((seller) => selectedIds.includes(seller.id));

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : filteredSellers.map((seller) => seller.id));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!token) return;
    if (!confirm(`¿Estás seguro de eliminar ${selectedIds.length} vendedor(es) seleccionados?`)) return;

    try {
      const results = await Promise.all(
        selectedIds.map((id) =>
          fetch(apiUrl(`/admin/users/${id}`), {
            method: "DELETE",
            headers: authHeaders(token),
          })
        )
      );
      const failed = results.filter((response) => !response.ok);

      if (failed.length > 0) {
        setToast({ type: "error", message: "No se pudieron eliminar todos los vendedores seleccionados." });
        return;
      }

      setSellers((prev) => prev.filter((seller) => !selectedIds.includes(seller.id)));
      setSelectedIds([]);
      setToast({ type: "success", message: "Vendedores seleccionados eliminados correctamente." });
    } catch (error) {
      console.error("Error deleting selected sellers:", error);
      setToast({ type: "error", message: "Error de red al eliminar vendedores." });
    }
  };

  return (
    <div className="space-y-6">
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
      <PageHero
        title="Vendedores"
        subtitle="Gestiona los vendedores del sistema."
        eyebrow="Usuarios"
        actions={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={selectedIds.length === 0}
            className="cursor-pointer px-4 py-2 rounded-xl border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-40 disabled:cursor-default transition-colors"
          >
            Eliminar seleccionados {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
          </button>
          <Link
            href="/admin/sellers/create"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
          >
            <Plus size={20} />
            Nuevo Vendedor
          </Link>
        </div>
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
          <XCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar vendedores..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary"
                    aria-label="Seleccionar todos los vendedores"
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendedor</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Cargando vendedores...
                  </td>
                </tr>
              ) : filteredSellers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron vendedores
                  </td>
                </tr>
              ) : (
                filteredSellers.map((seller) => (
                  <tr key={seller.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(seller.id)}
                        onChange={() => toggleSelect(seller.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary"
                        aria-label={`Seleccionar vendedor ${seller.full_name || seller.name || seller.email}`}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <UserIcon size={20} />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{seller.full_name || seller.name || "Sin nombre"}</div>
                          <div className="text-sm text-gray-500">{seller.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <Store size={12} />
                        Vendedor
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          seller.is_active
                            ? "bg-green-50 text-green-700 border border-green-100"
                            : "bg-red-50 text-red-700 border border-red-100"
                        }`}
                      >
                        {seller.is_active ? (
                          <>
                            <CheckCircle size={12} /> Activo
                          </>
                        ) : (
                          <>
                            <XCircle size={12} /> Inactivo
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/sellers/${seller.id}`}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                        >
                          <Edit size={18} />
                        </Link>
                        <button
                          onClick={() => deleteSeller(seller.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-gray-100 md:hidden">
          {loading ? (
            <div className="px-4 py-8 text-center text-gray-500">Cargando vendedores...</div>
          ) : filteredSellers.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">No se encontraron vendedores</div>
          ) : (
            filteredSellers.map((seller) => (
              <article key={seller.id} className="p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(seller.id)}
                    onChange={() => toggleSelect(seller.id)}
                    className="mt-3 h-4 w-4 rounded border-gray-300 text-primary"
                    aria-label={`Seleccionar vendedor ${seller.full_name || seller.name || seller.email}`}
                  />
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <UserIcon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-semibold text-gray-900">{seller.full_name || seller.name || "Sin nombre"}</h3>
                        <p className="mt-1 break-all text-sm text-gray-500">{seller.email}</p>
                      </div>
                      <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        <Store size={12} />
                        Vendedor
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border ${
                        seller.is_active ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"
                      }`}>
                        {seller.is_active ? <><CheckCircle size={12} /> Activo</> : <><XCircle size={12} /> Inactivo</>}
                      </span>
                      <div className="flex gap-2">
                        <Link href={`/admin/sellers/${seller.id}`} className="rounded-lg p-2 text-gray-400 hover:bg-primary/5 hover:text-primary">
                          <Edit size={18} />
                        </Link>
                        <button type="button" onClick={() => deleteSeller(seller.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          <div className="text-sm text-gray-500">Mostrando {filteredSellers.length} vendedores</div>
        </div>
      </div>
    </div>
  );
}
