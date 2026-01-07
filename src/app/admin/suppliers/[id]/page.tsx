"use client";

import { useState, useEffect } from "react";
import SupplierForm from "@/components/admin/SupplierForm";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

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

export default function EditSupplierPage() {
  const params = useParams();
  const id = params.id;
  const { token } = useAuthStore();
  
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSupplier = async () => {
      if (!token || !id) return;
      
      try {
        const response = await fetch(`/api/suppliers/${id}/`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setSupplier(data);
        } else {
          setError("No se pudo cargar la información del proveedor");
        }
      } catch (err) {
        setError("Error de conexión");
      } finally {
        setLoading(false);
      }
    };

    fetchSupplier();
  }, [id, token]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error || "Proveedor no encontrado"}</p>
        <Link href="/admin/suppliers" className="text-primary hover:underline">
          Volver a la lista
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link 
          href="/admin/suppliers" 
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Editar Proveedor</h1>
          <p className="text-gray-500 mt-1">Modifica los datos del proveedor {supplier.name}.</p>
        </div>
      </div>

      <SupplierForm initialData={supplier} isEditMode={true} />
    </div>
  );
}
