"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import Link from "next/link";
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

export default function UsersPage() {
  const { token } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [skip, setSkip] = useState(0);
  const [limit] = useState(50);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [token, skip]);

  const fetchUsers = async () => {
    if (!token) {
        setLoading(false);
        return;
    }

    setLoading(true);
    setError(null);
    try {
      // Reverting to trailing slash because user confirmed it's required and screenshot shows it.
      // Proxy will be updated to handle it correctly without dropping auth.
      const response = await fetchWithAuth(`/api/users/?skip=${skip}&limit=${limit}`);
      
      console.log(`[UsersPage] Fetch status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log("[UsersPage] Data received:", data);
        
        // Handle both direct array and paginated response (e.g. { items: [...] })
        if (Array.isArray(data)) {
            setUsers(data);
        } else if (data && Array.isArray(data.items)) {
            setUsers(data.items);
        } else {
            console.warn("[UsersPage] Unexpected data format:", data);
            setUsers([]);
        }
      } else {
        const text = await response.text();
        let errorMsg = text;
        try {
            const json = JSON.parse(text);
            // If it's our proxy debug object, show it nicely
            if (json.error_source === "proxy_debug") {
                console.error("[UsersPage] PROXY DEBUG INFO:", json);
                
                // Construct a visible error message with debug details
                const backendRes = json.backend_response;
                let backendDetails = backendRes;
                try {
                    const parsed = JSON.parse(backendRes);
                    backendDetails = parsed.detail || parsed.message || JSON.stringify(parsed);
                } catch {}

                errorMsg = `Backend Error (${json.status}): ${backendDetails} | URL: ${json.debug_target_url}`;
            } else {
                errorMsg = JSON.stringify(json, null, 2);
            }
        } catch (e) {
            // Not JSON
        }
        console.error("Error fetching users:", errorMsg);
        setError(`Error: ${errorMsg}`);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      setError("Error de conexión al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este usuario?")) return;
    
    try {
      const response = await fetchWithAuth(`/api/users/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setUsers(prev => prev.filter(u => u.id !== id));
      } else {
        alert("Error al eliminar usuario");
      }
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.name && user.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Usuarios</h1>
          <p className="text-gray-500 mt-1">Gestiona los usuarios del sistema.</p>
        </div>
        <Link 
          href="/admin/users/create" 
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
        >
          <Plus size={20} />
          Nuevo Usuario
        </Link>
      </div>

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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuario</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Cargando usuarios...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No se encontraron usuarios
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
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
