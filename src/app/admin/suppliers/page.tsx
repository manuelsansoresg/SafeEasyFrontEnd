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

interface SupplierFormData {
  name: string;
  short_name: string;
  rfc: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  country: string;
  is_active: boolean;
}

const initialFormData: SupplierFormData = {
  name: "",
  short_name: "",
  rfc: "",
  phone: "",
  email: "",
  city: "",
  state: "",
  country: "Mexico",
  is_active: true,
};

export default function AdminSuppliersPage() {
  const { token, user } = useAuthStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  
  // Pagination
  const [skip, setSkip] = useState(0);
  const [limit, setLimit] = useState(100);

  // Modal & Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<SupplierFormData>(initialFormData);
  const [editingId, setEditingId] = useState<number | null>(null);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !user) {
        setError("No hay sesión activa");
        return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        user_id: user.id
      };

      const url = editingId 
        ? `/api/suppliers/${editingId}/` 
        : '/api/suppliers/';
      
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            // Fallback if response is not JSON
            const text = await response.text();
            throw new Error(`Error ${response.status}: ${text || response.statusText}`);
        }
        
        throw new Error(errorData.detail || errorData.message || "Error al guardar proveedor");
      }

      await fetchSuppliers();
      closeModal();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setFormData({
      name: supplier.name,
      short_name: supplier.short_name || "",
      rfc: supplier.rfc || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      city: supplier.city || "",
      state: supplier.state || "",
      country: supplier.country || "Mexico",
      is_active: supplier.is_active,
    });
    setEditingId(supplier.id);
    setIsModalOpen(true);
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

  const openNewModal = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Gestión de Proveedores</h1>
          <p className="text-gray-500 mt-1">Administra la lista de proveedores del sistema.</p>
        </div>
        <button 
          onClick={openNewModal}
          className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20"
        >
          <Plus size={20} />
          <span>Nuevo Proveedor</span>
        </button>
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
                            <button 
                              onClick={() => handleEdit(supplier)}
                              className="cursor-pointer p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </button>
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-gray-800">
                {editingId ? "Editar Proveedor" : "Nuevo Proveedor"}
              </h2>
              <button onClick={closeModal} className="cursor-pointer text-gray-400 hover:text-gray-600">
                <XCircle size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Nombre *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="Nombre de la empresa"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Nombre Corto</label>
                  <input
                    type="text"
                    name="short_name"
                    value={formData.short_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="Alias o nombre comercial"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">RFC</label>
                  <input
                    type="text"
                    name="rfc"
                    value={formData.rfc}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="Registro Federal de Contribuyentes"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Teléfono</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="Número de contacto"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Correo Electrónico</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    placeholder="correo@empresa.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Ciudad</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Estado</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">País</label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>

                <div className="space-y-2 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_active"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({...formData, is_active: e.target.checked})}
                    className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-gray-700 select-none cursor-pointer">
                    Proveedor Activo
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="cursor-pointer px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="cursor-pointer px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors shadow-sm shadow-primary/20 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      Guardar Proveedor
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
