"use client";

import { useCallback, useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import Link from "next/link";
import { Toast } from "@/components/ui/Toast";
import { PageHero } from "@/components/ui/PageHero";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Shield,
  User as UserIcon,
  CheckCircle,
  XCircle
} from "lucide-react";

interface User {
  id: number;
  email: string;
  is_active: boolean;
  name?: string;
  full_name?: string;
  role?: string;
}

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

const unwrapUsers = (data: unknown): User[] => {
  if (Array.isArray(data)) return data as User[];
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    const items = record.items ?? record.results ?? record.data ?? record.users;
    if (Array.isArray(items)) return items as User[];
  }
  return [];
};

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return `${base.replace(/\/$/, "")}${path}`;
};

const authHeaders = (token: string) => ({
  "Authorization": `Bearer ${token.replace(/^bearer\s+/i, "").trim()}`,
});

const isVisibleUserRole = (role?: string) => {
  const normalized = String(role || "client").toLowerCase();
  return normalized === "client" || normalized === "admin" || normalized === "superuser";
};

export default function UsersPage() {
  const { token } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [skip, setSkip] = useState(0);
  const [limit] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<null | { type: "success" | "error" | "info"; message: string }>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  const fetchUsers = useCallback(async () => {
    if (!token) {
        setLoading(false);
        return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        skip: String(skip),
        limit: String(limit),
      });
      if (searchTerm.trim()) params.set("search", searchTerm.trim());

      const response = await fetchWithAuth(apiUrl(`/users/?${params.toString()}`));

      if (response.ok) {
        const data = await response.json();
        const nextUsers = unwrapUsers(data);
        setUsers(nextUsers);
        setSelectedIds((prev) => prev.filter((id) => nextUsers.some((user) => user.id === id)));
      } else {
        const errorMsg = await readErrorMessage(response);
        setError(errorMsg === "Not Found" ? "No se encontró el endpoint /users/." : errorMsg);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setError("Error de conexión al cargar usuarios");
    } finally {
      setLoading(false);
    }
  }, [limit, searchTerm, skip, token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const deleteUser = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este usuario?")) return;
    if (!token) return;
    
    try {
      const response = await fetch(apiUrl(`/admin/users/${id}`), {
        method: "DELETE",
        headers: authHeaders(token),
      });

      if (response.ok) {
        setUsers(prev => prev.filter(u => u.id !== id));
        setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));
      } else {
        const message = await readErrorMessage(response);
        setToast({ type: "error", message: message || "Error al eliminar usuario." });
      }
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const filteredUsers = users.filter((user) => isVisibleUserRole(user.role));
  const allSelected = filteredUsers.length > 0 && filteredUsers.every((user) => selectedIds.includes(user.id));

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? [] : filteredUsers.map((user) => user.id));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!token) return;
    if (!confirm(`¿Estás seguro de eliminar ${selectedIds.length} usuario(s) seleccionados?`)) return;

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
        setToast({ type: "error", message: "No se pudieron eliminar todos los usuarios seleccionados." });
        return;
      }

      setUsers((prev) => prev.filter((user) => !selectedIds.includes(user.id)));
      setSelectedIds([]);
      setToast({ type: "success", message: "Usuarios seleccionados eliminados correctamente." });
    } catch (error) {
      console.error("Error deleting selected users:", error);
      setToast({ type: "error", message: "Error de red al eliminar usuarios." });
    }
  };

  return (
    <div className="space-y-6">
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
      <PageHero
        title="Usuarios"
        subtitle="Gestiona los usuarios del sistema."
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
            href="/admin/users/create" 
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
          >
            <Plus size={20} />
            Nuevo Usuario
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
              placeholder="Buscar usuarios..." 
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSkip(0);
              }}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-primary"
                    aria-label="Seleccionar todos los usuarios"
                  />
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuario</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Cargando usuarios...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(user.id)}
                        onChange={() => toggleSelect(user.id)}
                        className="h-4 w-4 rounded border-gray-300 text-primary"
                        aria-label={`Seleccionar usuario ${user.name || user.email}`}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <UserIcon size={20} />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{user.name || "Sin nombre"}</div>
                          <div className="text-sm text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                        ${(user.role || '').toLowerCase() === 'admin' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 
                          (user.role || '').toLowerCase() === 'supplier' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 
                          'bg-gray-50 text-gray-700 border border-gray-100'}`}>
                        {(user.role || '').toLowerCase() === 'admin' && <Shield size={12} />}
                        {user.role || 'client'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium
                        ${user.is_active ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                        {user.is_active ? (
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
                          href={`/admin/users/${user.id}`}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                        >
                          <Edit size={18} />
                        </Link>
                        <button 
                          onClick={() => deleteUser(user.id)}
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

        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Mostrando {filteredUsers.length} usuarios
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setSkip(Math.max(0, skip - limit))}
              disabled={skip === 0}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={() => setSkip(skip + limit)}
              disabled={users.length < limit}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
