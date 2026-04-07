"use client";

import { useState, useEffect, Fragment } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Loader2,
  CheckCircle,
  XCircle,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Toast } from "@/components/ui/Toast";

interface Supplier {
  id: number;
  name: string;
  short_name?: string;
  slug?: string;
  rfc?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  country: string;
  is_active: boolean;
  is_verified?: boolean;
  user_id: number;
}

export default function AdminSuppliersPage() {
  const { token, user } = useAuthStore();
  const roleKey = String(user?.role || "").toLowerCase();
  const isAdminUser = roleKey === "admin" || roleKey === "superuser";
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  
  // Pagination
  const [skip, setSkip] = useState(0);
  const [limit, setLimit] = useState(50);

  // Modal & Form
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<null | { type: "success" | "error" | "info"; message: string }>(null);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    fetchSuppliers();
  }, [skip, limit, token]);

  const fetchSuppliers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Add trailing slash to avoid 307 redirects from backend
      const response = await fetchWithAuth(`/api/suppliers/?skip=${skip}&limit=${limit}`);
      
      if (response.ok) {
        const data = await response.json();
        const next = Array.isArray(data) ? (data as Supplier[]) : [];
        setSuppliers((prev) => {
          const prevById = new Map(prev.map((s) => [Number(s.id), s]));
          return next.map((s) => {
            const prevRow = prevById.get(Number(s.id));
            const hasIncomingVerified = typeof s.is_verified === "boolean";
            const preserved = hasIncomingVerified ? s.is_verified : prevRow?.is_verified;
            return typeof preserved === "boolean" ? { ...s, is_verified: preserved } : s;
          });
        });
      } else {
        console.error("Failed to fetch suppliers:", response.status, response.statusText);
        try {
            const errorText = await response.text();
            console.error("Error response:", errorText);
        } catch (e) {
            // Ignore parsing error
        }
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSupplierVerified = async (supplierId: number, isVerified: boolean) => {
    const tryUrls = [`/api/suppliers/${supplierId}`, `/api/suppliers/${supplierId}/`];
    const form = new FormData();
    form.append("is_verified", isVerified ? "true" : "false");
    const formOptions = { method: "PUT", body: form };

    let response: Response | null = null;
    let usedUrl = "";
    for (const url of tryUrls) {
      usedUrl = url;
      response = await fetchWithAuth(url, formOptions);
      if (response.ok) break;
    }

    if (!response || !response.ok) {
      const text = await response?.text().catch(() => "") ?? "";
      throw new Error(`No se pudo actualizar verificación (${response?.status ?? "unknown"}): ${usedUrl} ${text}`.trim());
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) return response.json();
    return null;
  };

  const toggleVerified = async (supplier: Supplier) => {
    if (!token) return;
    if (!isAdminUser) return;
    const next = !Boolean(supplier.is_verified);
    const actionLabel = next ? "verificar" : "desverificar";
    const ok = window.confirm(
      `Vas a ${actionLabel} al proveedor "${supplier.name}". ¿Deseas continuar?`
    );
    if (!ok) return;
    setVerifyingId(supplier.id);
    try {
      const updated = await updateSupplierVerified(supplier.id, next);
      const updatedRec =
        updated && typeof updated === "object" ? (updated as Record<string, unknown>) : null;
      const nextValue =
        typeof updatedRec?.is_verified === "boolean"
          ? updatedRec.is_verified
          : next;
      setSuppliers((prev) => prev.map((s) => (s.id === supplier.id ? { ...s, is_verified: nextValue } : s)));
      fetchSuppliers();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e && typeof (e as Record<string, unknown>).message === "string"
          ? String((e as Record<string, unknown>).message)
          : "No se pudo actualizar la verificación del proveedor.";
      setToast({ type: "error", message: msg });
    } finally {
      setVerifyingId(null);
    }
  };

  const toggleRow = (id: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allSelected = suppliers.length > 0 && selectedIds.length === suppliers.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(suppliers.map((s) => s.id));
    }
  };

  const deleteSupplierInternal = async (
    id: number
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      let numericId = Number(id);
      let targetSlug: string | undefined = undefined;

      if (!Number.isFinite(numericId)) {
        const s =
          suppliers.find((x) => String(x.id) === String(id)) ||
          suppliers.find((x) => x.slug && String(x.slug) === String(id));
        targetSlug = s?.slug;

        if (targetSlug) {
          const resolve = await fetchWithAuth(`/api/suppliers/${encodeURIComponent(targetSlug)}`);
          if (resolve.ok) {
            const data = await resolve.json();
            if (data?.id && Number.isFinite(Number(data.id))) {
              numericId = Number(data.id);
            }
          }
        }
      }

      const response = await fetchWithAuth(`/api/suppliers/${numericId}`, {
        method: "DELETE",
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });

      if (response.ok || response.status === 404) {
        return { success: true };
      }

      let message = `Error al eliminar (${response.status})`;
      try {
        const data = await response.json();
        if (data?.error_source === "proxy_debug") {
          const backendResp =
            typeof data.backend_response === "string"
              ? data.backend_response
              : JSON.stringify(data.backend_response);
          message = `URL: ${data.debug_target_url}\nStatus: ${data.status}\nBackend: ${backendResp}`;
        } else if (typeof data?.backend_response === "string") {
          message = data.backend_response;
        } else if (data?.detail) {
          message =
            typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
        } else if (data?.message) {
          message = data.message;
        }
      } catch {
        try {
          const text = await response.text();
          if (text) message = text;
        } catch {}
      }

      return { success: false, message };
    } catch (error) {
      console.error("Error deleting supplier:", error);
      return { success: false, message: "Error de red al eliminar proveedor" };
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este proveedor?")) return;
    
    if (!token) return;

    const result = await deleteSupplierInternal(id);
    if (result.success) {
      fetchSuppliers();
    } else if (result.message) {
      setToast({ type: "error", message: result.message });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!token) return;

    if (
      !confirm(
        `¿Estás seguro de eliminar ${selectedIds.length} proveedor(es) seleccionados?`
      )
    )
      return;

    const numericIds = selectedIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));

    if (numericIds.length === 0) {
      setToast({ type: "info", message: "No hay IDs válidos para borrar." });
      return;
    }

    try {
      const response = await fetchWithAuth(`/api/suppliers/bulk-delete`, {
        method: "POST",
        body: JSON.stringify({ ids: numericIds }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        setSelectedIds([]);
        fetchSuppliers();
      } else {
        let message = `Error al eliminar (${response.status})`;
        try {
          const data = await response.json();
          if (data?.error_source === "proxy_debug") {
            const backendResp =
              typeof data.backend_response === "string"
                ? data.backend_response
                : JSON.stringify(data.backend_response);
            message = `URL: ${data.debug_target_url}\nStatus: ${data.status}\nBackend: ${backendResp}`;
          } else if (typeof data?.backend_response === "string") {
            message = data.backend_response;
          } else if (data?.detail) {
            message =
              typeof data.detail === "string"
                ? data.detail
                : JSON.stringify(data.detail);
          } else if (data?.message) {
            message = data.message;
          }
        } catch {
          try {
            const text = await response.text();
            if (text) message = text;
          } catch {}
        }
        setToast({ type: "error", message });
      }
    } catch (e) {
      console.error("Error en borrado masivo:", e);
      setToast({ type: "error", message: "Error de red al intentar borrar proveedores." });
    }
  };

  return (
    <div className="space-y-6">
      {toast ? <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} /> : null}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Proveedores</h1>
          <p className="text-gray-500 mt-1">Administra la lista de proveedores del sistema.</p>
        </div>
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
            href="/admin/suppliers/create"
            className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
          >
            <Plus size={20} />
            <span>Nuevo Proveedor</span>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 text-primary border-gray-300 rounded"
                    />
                  </th>
                  <th className="p-4 font-semibold text-gray-600 text-sm">Nombre</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm">RFC</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm hidden md:table-cell">Teléfono</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm hidden lg:table-cell">Email</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm text-center">Estado</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm text-center">Verificado</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      No hay proveedores registrados.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((supplier) => (
                    <Fragment key={supplier.id}>
                      <tr className="hover:bg-gray-50/50 transition-colors">
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(supplier.id)}
                            onChange={() => toggleSelect(supplier.id)}
                            className="h-4 w-4 text-primary border-gray-300 rounded"
                          />
                        </td>
                        <td className="p-4">
                          <div className="font-medium text-gray-800">{supplier.name}</div>
                          {supplier.short_name && (
                            <div className="text-xs text-gray-400">{supplier.short_name}</div>
                          )}
                          {/* Mobile view info */}
                          <div className="md:hidden text-xs text-gray-500 mt-1">
                            {supplier.phone}
                          </div>
                        </td>
                        <td className="p-4 text-sm text-gray-600">{supplier.rfc || '-'}</td>
                        <td className="p-4 text-sm text-gray-600 hidden md:table-cell">{supplier.phone || '-'}</td>
                        <td className="p-4 text-sm text-gray-600 hidden lg:table-cell">{supplier.email || '-'}</td>
                        <td className="p-4 text-center">
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                            supplier.is_active 
                              ? "bg-green-100 text-green-800" 
                              : "bg-red-100 text-red-800"
                          )}>
                            {supplier.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {supplier.is_verified ? (
                            <span className="inline-flex items-center" title="Empresa verificada">
                              <CheckCircle size={16} className="text-[#168e00]" />
                            </span>
                          ) : null}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => toggleRow(supplier.id)}
                              className="cursor-pointer p-2 text-gray-400 hover:text-primary transition-colors"
                              title="Ver más detalles"
                            >
                              {expandedRows.has(supplier.id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                            {isAdminUser ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleVerified(supplier);
                                }}
                                disabled={verifyingId === supplier.id}
                                className={cn(
                                  "cursor-pointer p-2 rounded-lg transition-colors",
                                  supplier.is_verified
                                    ? "text-gray-600 hover:bg-gray-50"
                                    : "text-green-600 hover:bg-green-50",
                                  verifyingId === supplier.id ? "opacity-60 cursor-default" : ""
                                )}
                                title={supplier.is_verified ? "Desverificar" : "Verificar"}
                              >
                                {verifyingId === supplier.id ? (
                                  <Loader2 size={18} className="animate-spin" />
                                ) : supplier.is_verified ? (
                                  <XCircle size={18} />
                                ) : (
                                  <CheckCircle size={18} />
                                )}
                              </button>
                            ) : null}
                            <Link 
                              href={`/admin/suppliers/${supplier.id}`}
                              className="cursor-pointer p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDelete(supplier.id)}
                              className="cursor-pointer p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedRows.has(supplier.id) && (
                        <tr className="bg-gray-50/50">
                          <td colSpan={8} className="p-4">
                            <div className="flex flex-wrap gap-6 text-sm text-gray-600 pl-4 border-l-2 border-primary/20">
                              <div className="flex items-center gap-2">
                                <MapPin size={16} className="text-gray-400" />
                                <span className="font-medium">Ubicación:</span>
                                <span>
                                  {[supplier.city, supplier.state, supplier.country].filter(Boolean).join(", ")}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 lg:hidden">
                                <span className="font-medium">Email:</span>
                                <span>{supplier.email || '-'}</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
