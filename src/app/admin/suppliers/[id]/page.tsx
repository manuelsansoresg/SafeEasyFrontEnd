"use client";

import { useState, useEffect } from "react";
import SupplierForm from "@/components/admin/SupplierForm";
import StepCarousel from "@/components/sell/wizard/StepCarousel";
import StepCertificates from "@/components/sell/wizard/StepCertificates";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";

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
  const [activeTab, setActiveTab] = useState<"info" | "carousel" | "certificates">("info");

  useEffect(() => {
    const fetchSupplier = async () => {
      if (!token || !id) return;

      try {
        const response = await fetchWithAuth(`/api/suppliers/${id}/`);

        if (response.ok) {
          const data = await response.json();
          setSupplier(data);
        } else {
          const listResponse = await fetchWithAuth(`/api/suppliers/?skip=0&limit=1000`);

          if (listResponse.ok) {
            const listData = await listResponse.json();
            const found = Array.isArray(listData)
              ? listData.find((s: Supplier) => String(s.id) === String(id))
              : null;

            if (found) {
              setSupplier(found);
              return;
            }
          }

          const text = await response.text();
          setError(`No se pudo cargar la información del proveedor (Error ${response.status})`);
          console.error(`Error loading supplier ${id}:`, response.status, text);
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(`Error de conexión: ${err.message}`);
          console.error("Fetch error:", err);
        } else {
          setError("Error de conexión desconocido");
          console.error("Fetch error:", err);
        }
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

  if (error || !supplier || !token) {
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex space-x-4 border-b border-gray-200 mb-8">
          <button
            onClick={() => setActiveTab("info")}
            className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "info"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Información General
          </button>
          <button
            onClick={() => setActiveTab("carousel")}
            className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "carousel"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Carrusel de Imágenes
          </button>
          <button
            onClick={() => setActiveTab("certificates")}
            className={`py-3 px-6 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "certificates"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Certificados
          </button>
        </div>

        {activeTab === "info" && (
          <SupplierForm initialData={supplier} isEditMode={true} />
        )}

        {activeTab === "carousel" && (
          <StepCarousel
            supplierId={supplier.id}
            token={token}
            onNext={() => setActiveTab("certificates")}
          />
        )}

        {activeTab === "certificates" && (
          <StepCertificates supplierId={supplier.id} token={token} onNext={() => {}} />
        )}
      </div>
    </div>
  );
}
