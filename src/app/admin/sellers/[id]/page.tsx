"use client";

import { useEffect, useState } from "react";
import UserForm from "@/components/admin/UserForm";
import { PageHero } from "@/components/ui/PageHero";
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

const apiUrl = (path: string) => {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || "https://drooopy.com/api";
  return `${base.replace(/\/$/, "")}${path}`;
};

export default function EditSellerPage() {
  const params = useParams();
  const id = params.id;
  const { token } = useAuthStore();

  const [seller, setSeller] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSeller = async () => {
      if (!token || !id) return;

      try {
        const response = await fetchWithAuth(apiUrl(`/users/${id}`));

        if (response.ok) {
          const data = await response.json();
          setSeller(data);
        } else {
          const listResponse = await fetchWithAuth(apiUrl("/users/?skip=0&limit=1000"));

          if (listResponse.ok) {
            const listData = await listResponse.json();
            const usersList: User[] = Array.isArray(listData)
              ? listData
              : listData && Array.isArray(listData.items)
                ? listData.items
                : [];
            const found = usersList.find((user) => String(user.id) === String(id));

            if (found) {
              setSeller(found);
              return;
            }
          }

          setError("No se pudo cargar el vendedor.");
        }
      } catch (err) {
        console.error(err);
        setError("Error de conexión al cargar vendedor.");
      } finally {
        setLoading(false);
      }
    };

    fetchSeller();
  }, [id, token]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (error || !seller) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error || "Vendedor no encontrado"}</p>
        <Link href="/admin/sellers" className="text-primary hover:underline">
          Volver a la lista
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Editar Vendedor"
        subtitle={`Modifica los datos del vendedor ${seller.full_name || seller.name || seller.email}.`}
        eyebrow="Usuarios"
        actions={
          <Link href="/admin/sellers" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      <UserForm
        initialData={seller}
        isEditMode={true}
        fixedRole="seller"
        returnPath="/admin/sellers"
        submitLabel="Guardar Vendedor"
      />
    </div>
  );
}
