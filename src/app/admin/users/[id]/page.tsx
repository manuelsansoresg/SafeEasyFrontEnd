"use client";

import { useState, useEffect } from "react";
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

export default function EditUserPage() {
  const params = useParams();
  const id = params.id;
  const { token } = useAuthStore();
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      if (!token || !id) return;
      
      try {
        // Try to fetch specific user first
        const response = await fetchWithAuth(apiUrl(`/users/${id}`));
        
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        } else {
            console.warn(`Direct fetch failed (${response.status}), trying fallback via list...`);
            
            // Fallback: Fetch list and find user
            const listResponse = await fetchWithAuth(apiUrl(`/users/?skip=0&limit=1000`));

            if (listResponse.ok) {
                const listData = await listResponse.json();
                let usersList: User[] = [];
                if (Array.isArray(listData)) {
                    usersList = listData;
                } else if (listData && Array.isArray(listData.items)) {
                    usersList = listData.items;
                }

                const found = usersList.find((u: User) => String(u.id) === String(id));
                
                if (found) {
                    setUser(found);
                    return;
                } else {
                    console.warn(`User ${id} not found in fallback list`);
                }
            }

            const text = await response.text();
            console.warn("Direct fetch error response:", text);
            setError(`No se pudo cargar el usuario. El servidor no permite acceso directo y no se encontró en el listado.`);
        }
      } catch (err: unknown) {
        console.error(err);
        const message =
          err && typeof err === "object" && "message" in err && typeof (err as Record<string, unknown>).message === "string"
            ? String((err as Record<string, unknown>).message)
            : "Error desconocido";
        setError(`Error de conexión: ${message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [id, token]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error || "Usuario no encontrado"}</p>
        <Link href="/admin/users" className="text-primary hover:underline">
          Volver a la lista
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHero
        title="Editar Usuario"
        subtitle={`Modifica los datos del usuario ${user.full_name || user.name || user.email}.`}
        eyebrow="Usuarios"
        actions={
          <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-600 hover:text-primary">
            <ArrowLeft size={16} />
            Volver
          </Link>
        }
      />

      <UserForm initialData={user} isEditMode={true} />
    </div>
  );
}
