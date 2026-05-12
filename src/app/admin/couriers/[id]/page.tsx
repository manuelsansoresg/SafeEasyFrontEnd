"use client";

import { useEffect, useState } from "react";
import UserForm from "@/components/admin/UserForm";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { fetchWithAuth } from "@/lib/api";

interface User {
  id: number;
  email: string;
  is_active: boolean;
  name?: string;
  full_name?: string;
  role?: string;
}

export default function EditCourierPage() {
  const params = useParams();
  const id = params.id;
  const { token } = useAuthStore();

  const [courier, setCourier] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCourier = async () => {
      if (!token || !id) return;

      try {
        const response = await fetchWithAuth(`/api/users/${id}`);

        if (response.ok) {
          const data = await response.json();
          setCourier(data);
        } else {
          const listResponse = await fetchWithAuth("/api/users?skip=0&limit=1000");

          if (listResponse.ok) {
            const listData = await listResponse.json();
            const usersList: User[] = Array.isArray(listData)
              ? listData
              : listData && Array.isArray(listData.items)
                ? listData.items
                : [];
            const found = usersList.find((user) => String(user.id) === String(id));

            if (found) {
              setCourier(found);
              return;
            }
          }

          setError("No se pudo cargar el repartidor.");
        }
      } catch (err) {
        console.error(err);
        setError("Error de conexión al cargar repartidor.");
      } finally {
        setLoading(false);
      }
    };

    fetchCourier();
  }, [id, token]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (error || !courier) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error || "Repartidor no encontrado"}</p>
        <Link href="/admin/couriers" className="text-primary hover:underline">
          Volver a la lista
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/couriers"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Editar Repartidor</h1>
          <p className="text-gray-500 mt-1">
            Modifica los datos del repartidor {courier.full_name || courier.name || courier.email}.
          </p>
        </div>
      </div>

      <UserForm
        initialData={courier}
        isEditMode={true}
        fixedRole="courier"
        returnPath="/admin/couriers"
        submitLabel="Guardar Repartidor"
      />
    </div>
  );
}
