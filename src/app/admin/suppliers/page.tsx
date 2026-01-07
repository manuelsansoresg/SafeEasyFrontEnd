"use client";

import { useState, useEffect, Fragment } from "react";
import { useAuthStore } from "@/store/useAuthStore";
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

interface Supplier {
  id: number;
  name: string;
  short_name?: string;
  rfc?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  country: string;
  is_active: boolean;
  user_id: number;
}

export default function AdminSuppliersPage() {
  const { token, user } = useAuthStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  // Pagination
  const [skip, setSkip] = useState(0);
  const [limit, setLimit] = useState(50);

  // Modal & Form
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSuppliers();
  }, [skip, limit, token]);

  const fetchSuppliers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Add trailing slash to avoid 307 redirects from backend
      const response = await fetch(`/api/suppliers/?skip=${skip}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Ensure data is an array
        setSuppliers(Array.isArray(data) ? data : []);
      } else {
        console.error("Failed to fetch suppliers");
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    } finally {
      setLoading(false);
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

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de eliminar este proveedor?")) return;
    
    if (!token) return;

    try {
      const response = await fetch(`/api/suppliers/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        fetchSuppliers();
      } else {
        alert("Error al eliminar");
      }
    } catch (error) {
      console.error("Error deleting supplier:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Proveedores</h1>
          <p className="text-gray-500 mt-1">Administra la lista de proveedores del sistema.</p>
        </div>
        <Link 
          href="/admin/suppliers/create"
          className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
        >
          <Plus size={20} />
          <span>Nuevo Proveedor</span>
        </Link>
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
                  <th className="p-4 font-semibold text-gray-600 text-sm">Nombre</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm">RFC</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm hidden md:table-cell">Teléfono</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm hidden lg:table-cell">Email</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm text-center">Estado</th>
                  <th className="p-4 font-semibold text-gray-600 text-sm text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      No hay proveedores registrados.
                    </td>
                  </tr>
                ) : (
                  suppliers.map((supplier) => (
                    <Fragment key={supplier.id}>
                      <tr className="hover:bg-gray-50/50 transition-colors">
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
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => toggleRow(supplier.id)}
                              className="cursor-pointer p-2 text-gray-400 hover:text-primary transition-colors"
                              title="Ver más detalles"
                            >
                              {expandedRows.has(supplier.id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </button>
                            <Link 
                              href={`/admin/suppliers/${supplier.id}`}
                              className="cursor-pointer p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </Link>
                            <button 
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
                          <td colSpan={6} className="p-4">
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
